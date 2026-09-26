#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
function assert(name, cond) {
  if (cond) console.log('  ok  ' + name);
  else { failed++; console.error('  FAIL ' + name); }
}

function sliceBetween(startMarker, endMarker) {
  const begin = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, begin + 1);
  if (begin < 0 || end <= begin) {
    console.error('Could not slice', startMarker);
    process.exit(1);
  }
  return src.slice(begin, end);
}

console.log('Day Summary in-progress kits (1.3.091825m)');

assert('APP_VERSION 1.3.091825m',
  /const APP_VERSION = '1\.3\.091825m'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091825m'));

const tileSrc = sliceBetween('function daySummaryKitIsInProgress', 'function renderCalendarMonthHTML');
assert('day tile label is In progress and has no Claimed breakdown',
  tileSrc.includes("tile('inprogress', inProgressCount, 'In progress', 'inprogress')")
  && tileSrc.includes("view === 'day'")
  && !/Claimed/.test(tileSrc)
  && tileSrc.includes("tile('booked'"));

const buckets = {};
function classifyBookingForPerf(a) {
  return buckets[a.id] || null;
}
function assignmentIsDemoBooking(a) {
  return !!(a && a.isDemo);
}
function perfBookingOverlapsPacificDay(a, day) {
  return !!(a && a._overlap === day);
}

const ctx = {
  classifyBookingForPerf,
  assignmentIsDemoBooking,
  perfBookingOverlapsPacificDay,
  adminState: { assignments: [], calTeamFilter: null, teams: [] },
  ymd: (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + dd;
  },
  console,
};
vm.createContext(ctx);
vm.runInContext(tileSrc, ctx);

const day = '2026-09-26';
const live = { id: 'kit-live', date: day, status: 'Booked', teamId: 1 };
const done = { id: 'kit-done', date: day, status: 'Completed', teamId: 1 };
const cancelled = { id: 'kit-cancel', date: day, status: 'Cancelled', teamId: 1 };
const booked = { id: 'kit-booked', date: day, status: 'Booked', teamId: 1 };
const notified = { id: 'kit-note', date: day, status: 'Notified', teamId: 1 };
const overnight = { id: 'kit-night', date: '2026-09-25', status: 'Booked', teamId: 2, _overlap: day };
const otherDay = { id: 'kit-other', date: '2026-09-20', status: 'Booked', teamId: 1, _overlap: '2026-09-20' };
const demo = { id: 'kit-demo', date: day, status: 'Booked', teamId: 'demo-team-1', isDemo: true };
const dup = { id: 'kit-live', date: day, status: 'Booked', teamId: 1 };

buckets['kit-live'] = 'inprogress';
buckets['kit-done'] = 'completed';
buckets['kit-cancel'] = null;
buckets['kit-booked'] = 'scheduled';
buckets['kit-note'] = 'scheduled';
buckets['kit-night'] = 'inprogress';
buckets['kit-other'] = 'inprogress';
buckets['kit-demo'] = 'inprogress';

const rows = [live, done, cancelled, booked, notified, overnight, otherDay, demo, dup];
assert('predicate is Performance Live only',
  ctx.daySummaryKitIsInProgress(live, day, day) === true
  && ctx.daySummaryKitIsInProgress(done, day, day) === false
  && ctx.daySummaryKitIsInProgress(cancelled, day, day) === false
  && ctx.daySummaryKitIsInProgress(booked, day, day) === false
  && ctx.daySummaryKitIsInProgress(notified, day, day) === false
  && ctx.daySummaryKitIsInProgress(demo, day, day) === false);
assert('overnight live kit on the selected Pacific day counts',
  ctx.daySummaryKitIsInProgress(overnight, day, day) === true
  && ctx.daySummaryKitIsInProgress(otherDay, day, day) === false);
assert('count is unique in-progress kits, not booked+done+cancelled',
  ctx.daySummaryInProgressKitCount(rows, day, day, null) === 2);

ctx.adminState.assignments = rows;
const days = [new Date(2026, 8, 26)];
const dayHtml = ctx.renderCalendarStatTilesHTML('day', days);
assert('day summary tile shows only the In progress count',
  dayHtml.includes('cal-stat-inprogress')
  && dayHtml.includes('>In progress<')
  && dayHtml.includes('cal-stat-tile-num">2<')
  && !dayHtml.includes('Claimed')
  && !/cal-stat-booked/.test(dayHtml)
  && !/pending/.test(dayHtml.split('cal-stat-inprogress')[0] || ''));
const weekDays = [];
for (let i = 0; i < 7; i++) weekDays.push(new Date(2026, 8, 20 + i));
const weekHtml = ctx.renderCalendarStatTilesHTML('week', weekDays);
assert('week view still shows Booked, not the day In progress tile',
  weekHtml.includes('cal-stat-booked')
  && weekHtml.includes('Booked this week')
  && !weekHtml.includes('cal-stat-inprogress'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('all passed');
