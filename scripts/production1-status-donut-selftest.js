#!/usr/bin/env node
'use strict';

/**
 * Overview ring counts Production1 rows by Status.
 * One real Session Kit row is one session. Kit numbers are not summed.
 * Select and a blank Status are left out. Not complete / Not Complete
 * are one slice. Performance booking counts are a different path.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'production1-status-sample.csv'), 'utf8');

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.error('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

console.log('Production1 status donut (1.3.100726a)');

assert('APP_VERSION 1.3.100726a',
  /const APP_VERSION = '1\.3\.100726a'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.100726a'));

const begin = src.indexOf('// PRODUCTION1_STATUS_COUNTS_START');
const end = src.indexOf('// PRODUCTION1_STATUS_COUNTS_END');
assert('count helpers are marked for the self-test', begin > 0 && end > begin);
if (begin < 0 || end <= begin) process.exit(1);

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(src.slice(begin, end), ctx);

const counts = ctx.countProduction1StatusSlices(fixture);
const by = {};
counts.slices.forEach(s => { by[s.status] = s.count; });

assert('total is counted sessions, not the sum of kit numbers', counts.total === 8, JSON.stringify(counts));
assert('Completed is 3', by.Completed === 3, JSON.stringify(by));
assert('Not complete merges both casings', by['Not complete'] === 2, JSON.stringify(by));
assert('Confirmed is 1', by.Confirmed === 1, JSON.stringify(by));
assert('Cancelled is 1', by.Cancelled === 1, JSON.stringify(by));
assert('On hold stays its own slice', by['On hold'] === 1, JSON.stringify(by));
assert('kit 12 did not add twelve sessions', counts.total === 8 && by['Not complete'] === 2);
assert('slice order is stable',
  counts.slices.map(s => s.status).join('|') === 'Completed|Confirmed|Not complete|Cancelled|On hold',
  counts.slices.map(s => s.status).join('|'));

const noHeader = [];
function rawRow(kit, status) {
  const row = new Array(11).fill('');
  row[3] = kit;
  row[10] = status;
  return row;
}
noHeader.push(rawRow('9', 'Completed'));
noHeader.push(rawRow('Select', 'Confirmed'));
noHeader.push(rawRow('2', ''));
noHeader.push(rawRow('', 'Cancelled'));
const indexed = ctx.countProduction1StatusSlices(noHeader);
assert('column D and K count without a header row',
  indexed.total === 1 && indexed.slices[0].status === 'Completed' && indexed.slices[0].count === 1,
  JSON.stringify(indexed));

const fromRows = ctx.production1CountsFromFeed(JSON.stringify({
  rows: [
    { sessionKit: '1', status: 'Completed' },
    { sessionKit: 'Select', status: 'Confirmed' },
    { sessionKit: '4', status: 'not complete' },
  ],
}));
assert('proxy rows use the same kit and status rules',
  fromRows && fromRows.total === 2
  && fromRows.slices.map(s => s.status + ':' + s.count).join(',') === 'Completed:1,Not complete:1',
  JSON.stringify(fromRows));

const fromSlices = ctx.production1CountsFromFeed(JSON.stringify({
  slices: [
    { status: 'Not complete', count: 2 },
    { status: 'Not Complete', count: 3 },
  ],
}));
assert('pre-counted slices still merge status casing',
  fromSlices && fromSlices.total === 5 && fromSlices.slices[0].status === 'Not complete' && fromSlices.slices[0].count === 5,
  JSON.stringify(fromSlices));

const proxyShape = ctx.production1CountsFromFeed(JSON.stringify({
  slices: [
    { status: 'Completed', count: 52 },
    { status: 'Confirmed', count: 16 },
    { status: 'Not complete', count: 4 },
    { status: 'Cancelled', count: 1 },
  ],
}));
assert('counts-only proxy slices add up to 73',
  proxyShape && proxyShape.total === 73
  && proxyShape.slices.map(s => s.status + ':' + s.count).join(',') === 'Completed:52,Confirmed:16,Not complete:4,Cancelled:1',
  JSON.stringify(proxyShape));

assert('an HTML login page is not a sheet', ctx.production1CountsFromFeed('<!DOCTYPE html><html></html>') === null);
assert('Select is not a real kit', ctx.production1KitIsRealSession('Select') === false);
assert('a numeric kit is one session', ctx.production1KitIsRealSession('12') === true);

const metrics = src.slice(src.indexOf('function updateOverviewMetrics'), src.indexOf('function tweenNumber'));
assert('the Overview ring paints Production1 counts',
  metrics.includes('paintProduction1OverviewDonut')
  && metrics.includes('refreshProduction1OverviewStatus')
  && !metrics.includes('animateDonutChart('));
assert('the Bookings tile still uses the booking completed count',
  /setOverviewTileFoot\('bookings', m\.completedCount \+ ' completed'\)/.test(src));
assert('Performance booking donut helper is still in the file',
  src.includes('function computeOverviewDonutCounts'));
assert('the ring refreshes on a short timer',
  src.includes('PRODUCTION1_STATUS_REFRESH_MS = 60 * 1000')
  && src.includes('function startProduction1StatusPoll'));
assert('proxy URL is the counts-only feed',
  src.includes("const PRODUCTION1_STATUS_PROXY_URL = 'https://dk-centific.github.io/twilight-production1-status/production1-status.json'"));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('all passed');
