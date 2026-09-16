#!/usr/bin/env node
/* Self-test: Admin Booking auto end-from-start defaults are +8 hours. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let passed = 0;
let failed = 0;
function assert(name, cond, detail) {
  if (cond) {
    passed++;
    console.log('  ok  ' + name);
  } else {
    failed++;
    console.error('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

console.log('Booking end-from-start +8h self-test');

assert('APP_VERSION is 1.3.091626f', /const APP_VERSION = '1\.3\.091626f'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091626f'));
assert('duration constant is 8 hours', /const BOOKING_DEFAULT_DURATION_MIN = 8 \* 60/.test(src));
assert('default end is start + duration',
  /const BOOKING_DEFAULT_END_MIN = BOOKING_DEFAULT_START_MIN \+ BOOKING_DEFAULT_DURATION_MIN/.test(src));
assert('helper bookingDefaultEndFromStart exists', src.includes('function bookingDefaultEndFromStart(startMin)'));

const helperBegin = src.indexOf('const BOOKING_DEFAULT_DURATION_MIN = 8 * 60;');
const helperEnd = src.indexOf('function bookingTeamInitials(team)');
assert('helper slice located', helperBegin >= 0 && helperEnd > helperBegin);

const context = { console };
vm.createContext(context);
vm.runInContext(src.slice(helperBegin, helperEnd), context, { filename: 'booking-duration-helpers' });

const {
  bookingDefaultEndFromStart,
  bookingNormalizeEndMin,
  bookingMinToInput,
  bookingWrapClockMin,
} = context;

assert('5 PM default end is 1 AM (start + 8h)',
  bookingDefaultEndFromStart(17 * 60) === 25 * 60);
assert('9 AM default end is 5 PM', bookingDefaultEndFromStart(9 * 60) === 17 * 60);
assert('9 PM default end is 5 AM next clock (+8h stored as 29:00 min)',
  bookingDefaultEndFromStart(21 * 60) === 29 * 60
    && bookingMinToInput(29 * 60) === '05:00'
    && bookingWrapClockMin(29 * 60) === 5 * 60);
assert('null end clock uses start + 8h', bookingNormalizeEndMin(15 * 60, null) === 23 * 60);
assert('explicit overnight end is kept (not forced to +8h)',
  bookingNormalizeEndMin(17 * 60, 3 * 60) === 27 * 60);
assert('source duration constant is 8 * 60',
  /const BOOKING_DEFAULT_DURATION_MIN = 8 \* 60/.test(src)
    && /BOOKING_DEFAULT_START_MIN \+ BOOKING_DEFAULT_DURATION_MIN/.test(src));

assert('Booking Start Time change auto-sets end from helper',
  /bookingStartTime[\s\S]{0,900}bookingDefaultEndFromStart\(startClock\)/.test(src));
assert('openAssignmentModal default end uses helper, not CAL_SLOT_MIN',
  /const endMin\s*=\s*\(opts\.endMin\s*!= null\)\s*\? opts\.endMin\s*:\s*bookingDefaultEndFromStart\(startMin\)/.test(src)
    && !/slotMin \+ CAL_SLOT_MIN/.test(src));
assert('assignment modal start change auto-sets end from helper',
  /asgnStartTime[\s\S]{0,1200}bookingDefaultEndFromStart\(startMin\)/.test(src)
    && !/endMin = startMin \+ 60/.test(src));
assert('team-grid empty cell uses helper',
  /tg-cell[\s\S]{0,1800}bookingDefaultEndFromStart\(startMin\)/.test(src));
assert('month empty cell uses helper',
  /month-cell[\s\S]{0,2200}bookingDefaultEndFromStart\(startMin\)/.test(src));
assert('Schedule-by-mod create uses helper (not 9–11)',
  /kind: 'newAssignment'[\s\S]{0,180}bookingDefaultEndFromStart\(9 \* 60\)/.test(src)
    && !/endMin: 11 \* 60/.test(src));
assert('Book button still passes the chosen timeslot through',
  /bookingBookBtn[\s\S]{0,2200}openAssignmentModal\(dateStr, startMin, \{/.test(src)
    && /const endMin = adminState\.bookingEndMin != null \? adminState\.bookingEndMin : BOOKING_DEFAULT_END_MIN/.test(src));
assert('OD-mapped rows still keep a supplied end time',
  /startMin: dateInfo \? dateInfo\.startMin : 8 \* 60/.test(src)
    && /endMin: dateInfo \? dateInfo\.endMin : 17 \* 60/.test(src));
assert('edit assignment keeps the saved end until start changes',
  /kind: 'editAssignment'[\s\S]{0,220}endMin: a\.endMin/.test(src));

console.log('');
console.log(failed ? `FAILED ${failed} · passed ${passed}` : `All ${passed} checks passed`);
process.exit(failed ? 1 : 0);
