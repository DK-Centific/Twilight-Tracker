#!/usr/bin/env node
/* Overview Live teams · arrival check-in gate (mirrors twilight.js). */

const WORKLOG_STATUS_ORDER = [
  'office_checkin',
  'arrived', 'station_0a_done', 'station_0b_done', 'station_0c_done',
  'station_1_done', 'station_2_done', 'station_3_done', 'station_4_done',
  'session_done',
  'office_checkout',
];

function statusOrderIdx(status) {
  return WORKLOG_STATUS_ORDER.indexOf(status);
}

function assignmentHasModeratorArrivalCheckIn(a, liveStatus) {
  if (!a) return false;
  if (a.status === 'Cancelled' || a.status === 'Unassigned') return false;
  if (a.status === 'Completed') return false;
  if (!liveStatus) return false;
  const idx = statusOrderIdx(liveStatus);
  const arrivedIdx = statusOrderIdx('arrived');
  const doneIdx = statusOrderIdx('session_done');
  if (idx < 0 || arrivedIdx < 0 || doneIdx < 0) return false;
  return idx >= arrivedIdx && idx < doneIdx;
}

let passed = 0;
let failed = 0;
function assert(name, cond) {
  if (cond) { passed++; console.log('ok  -', name); }
  else { failed++; console.error('FAIL -', name); }
}

const booked = { id: '1', status: 'Booked' };
assert('office check-in alone is not live', !assignmentHasModeratorArrivalCheckIn(booked, 'office_checkin'));
assert('arrived counts as live', assignmentHasModeratorArrivalCheckIn(booked, 'arrived'));
assert('station 3 counts as live', assignmentHasModeratorArrivalCheckIn(booked, 'station_3_done'));
assert('session_done is not live', !assignmentHasModeratorArrivalCheckIn(booked, 'session_done'));
assert('Completed assignment is not live', !assignmentHasModeratorArrivalCheckIn({ status: 'Completed' }, 'station_2_done'));

console.log(failed ? `\n${failed} failed, ${passed} passed` : `\n${passed} passed`);
process.exit(failed ? 1 : 0);
