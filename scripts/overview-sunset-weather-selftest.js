#!/usr/bin/env node
'use strict';

/**
 * Admin Overview sunset line + tonight weather chip (1.3.100226i).
 * Sunset is the HQ solar altitude crossing −0.83° in America/Los_Angeles.
 * Tonight's chip reads the same Open-Meteo payload Booking already uses.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

console.log('Overview sunset + tonight weather (1.3.100226i)');

assert('APP_VERSION 1.3.100226i',
  /const APP_VERSION = '1\.3\.100226i'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.100226i'));

const start = src.indexOf('const OVERVIEW_HQ_LAT');
const end = src.indexOf('function applyOverviewHeliosWeather');
assert('helio helpers are contiguous', start > 0 && end > start);
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src.slice(start, end), ctx);

assert('Sep 30 2026 sunset matches Open-Meteo 6:49 PM PT',
  ctx.overviewSunsetLabel(new Date('2026-09-30T20:00:00Z')) === 'Sunset 6:49 PM');
assert('Jun 21 2026 sunset is 9:10 PM PT',
  ctx.overviewSunsetLabel(new Date('2026-06-21T20:00:00Z')) === 'Sunset 9:10 PM');
assert('Dec 21 2026 sunset is 4:19 PM PT',
  ctx.overviewSunsetLabel(new Date('2026-12-21T20:00:00Z')) === 'Sunset 4:19 PM');

const cache = {
  currentTempF: 64.2,
  currentKind: 'clear',
  hours: [
    { time: '2026-09-30T15:00', tempF: 70, code: 1 },
    { time: '2026-09-30T18:00', tempF: 55.4, code: 61 },
  ],
};
const before = ctx.heliosTonightSnapshot(cache, new Date('2026-09-30T17:00:00-07:00'));
assert('before sunset hour uses the 6 PM forecast',
  before && before.source === 'tonight' && before.kind === 'rain' && Math.round(before.tempF) === 55,
  JSON.stringify(before));
const after = ctx.heliosTonightSnapshot(cache, new Date('2026-09-30T19:30:00-07:00'));
assert('after sunset hour uses the live reading',
  after && after.source === 'current' && after.kind === 'clear' && after.tempF === 64.2,
  JSON.stringify(after));
assert('missing forecast stays empty',
  ctx.heliosTonightSnapshot(null, new Date('2026-09-30T17:00:00-07:00')) == null);
const fallback = ctx.heliosTonightSnapshot({
  currentTempF: 48,
  currentKind: 'cloudy',
  hours: [],
}, new Date('2026-09-30T12:00:00-07:00'));
assert('no evening hour falls back to current',
  fallback && fallback.source === 'current' && fallback.kind === 'cloudy');

const stage = src.slice(src.indexOf('function overviewVizStageHTML'), src.indexOf('function overviewModStarLadder'));
const timeAt = stage.indexOf('id="ovVizTime"');
const sunsetAt = stage.indexOf('id="ovVizSunset"');
const stageAt = stage.indexOf('class="ov-viz-stage"');
const wxAt = stage.indexOf('id="ovVizWx"');
assert('sunset sits under the clock', timeAt > 0 && sunsetAt > timeAt);
assert('weather chip is inside ov-viz-stage', stageAt > 0 && wxAt > stageAt && wxAt < timeAt);
assert('chip reuses Booking markup classes',
  stage.includes('bk-optimal') && stage.includes('bk-optimal-temp') && stage.includes('bk-optimal-cond'));

const bookStart = src.indexOf('function paintBookingHeliosWeather');
const bookEnd = src.indexOf('let _ovWxChipTimer');
const bookFn = src.slice(bookStart, bookEnd);
assert('Booking weather still targets bkOptimal',
  bookFn.includes("getElementById('bkOptimal')") && bookFn.includes('heliosSnapshotForDate'));
assert('Booking paint does not use the tonight helper',
  !bookFn.includes('heliosTonightSnapshot'));

assert('sunset and weather styles exist',
  html.includes('.ov-viz-sunset') && html.includes('.ov-viz-weather'));
assert('chip sits 1px under the stage frame inside the well',
  html.includes('.ov-viz-weather {\n  position: absolute;\n  top: 1px;')
  && stage.indexOf('id="ovVizWeather"') > stage.indexOf('id="ovVizWell"')
  && stage.indexOf('id="ovVizWeather"') < stage.indexOf('id="ovVizSky"'));

console.log(failed ? '\n' + failed + ' failed' : '\n' + 'passed');
process.exit(failed ? 1 : 0);
