#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'twilight.js'), 'utf8');

function sliceBetween(startMarker, endMarker) {
  const begin = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, begin + 1);
  if (begin < 0 || end <= begin) {
    console.error('Could not slice', startMarker);
    process.exit(1);
  }
  return src.slice(begin, end);
}

const ctx = {
  console,
  adminState: {
    teams: [
      { id: 'demo-team-01', name: 'Team 01' },
      { id: '99', name: 'Field A' },
      { id: '100', name: 'Field B' },
    ],
  },
  isTerminalStatus: s => s === 'Cancelled' || s === 'Unassigned',
  classifyBookingForPerf: (a) => {
    if (a.id === 'wrap-only') return 'completed';
    return 'scheduled';
  },
  assignmentHasModeratorArrivalCheckIn: (a) => a.id === 'r2' || a.id === 'r3',
  getLatestStatusForAssignment: (id) => {
    if (id === 'wrap-only') return { status: 'session_done' };
    return null;
  },
};

vm.createContext(ctx);
vm.runInContext(sliceBetween('function assignmentIsDemoBooking', 'function overviewAssignmentInBookedMetricsScope'), ctx);
vm.runInContext(sliceBetween('function overviewAssignmentInBookedMetricsScope', 'function overviewAssignmentIsPerfLive'), ctx);

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

console.log('Overview donut + demo exclusion self-test');

const demo = {
  id: 'd1',
  teamId: 'demo-team-01',
  status: 'Completed',
  participantName: 'Annie Demo',
  modSnapshots: [{ orbitLoginId: 'demo-annie' }],
};
const cancelled = { id: 'c1', teamId: '99', status: 'Cancelled' };
const realDoneNoCheckIn = { id: 'r1', teamId: '99', status: 'Completed', participantName: 'Pat Smith' };
const realCheckedIn = { id: 'r2', teamId: '99', status: 'Booked', participantName: 'Jane Doe' };
const wrapOnly = { id: 'wrap-only', teamId: '100', status: 'Booked' };
const testing = { id: 't1', teamId: '99', status: 'Booked', participantName: 'For Testing Only' };
const teamBOpen = { id: 'r3', teamId: '100', status: 'Booked', participantName: 'Sam Lee' };

assert('demo team booking is demo', ctx.assignmentIsDemoBooking(demo));
assert('for testing name is demo', ctx.assignmentIsDemoBooking(testing));
assert('real booking is not demo', !ctx.assignmentIsDemoBooking(realDoneNoCheckIn));

const list = [demo, cancelled, realDoneNoCheckIn, realCheckedIn, wrapOnly, testing, teamBOpen];
const counts = ctx.computeOverviewDonutCounts(list);

assert('denominator is distinct in-scope teams', counts.progressTotal === 2);
assert('numerator is checked-in teams not booking rows', counts.completedCount === 2);
assert('Completed without check-in does not inflate numerator', counts.remainingCount === 0);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll passed');
