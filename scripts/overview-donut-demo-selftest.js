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
    ],
  },
  isTerminalStatus: s => s === 'Cancelled' || s === 'Unassigned',
  classifyBookingForPerf: (a) => {
    if (a.id === 'wrap-only') return 'completed';
    return 'scheduled';
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
const realDone = { id: 'r1', teamId: '99', status: 'Completed', participantName: 'Pat Smith' };
const realOpen = { id: 'r2', teamId: '99', status: 'Booked', participantName: 'Jane Doe' };
const wrapOnly = { id: 'wrap-only', teamId: '99', status: 'Booked' };
const testing = { id: 't1', teamId: '99', status: 'Booked', participantName: 'For Testing Only' };

assert('demo team booking is demo', ctx.assignmentIsDemoBooking(demo));
assert('for testing name is demo', ctx.assignmentIsDemoBooking(testing));
assert('real booking is not demo', !ctx.assignmentIsDemoBooking(realDone));

const list = [demo, cancelled, realDone, realOpen, wrapOnly, testing];
const counts = ctx.computeOverviewDonutCounts(list);

assert('cancelled excluded from total', counts.progressTotal === 3);
assert('demo excluded from total', counts.progressTotal === 3);
assert('completed includes status Completed', counts.completedCount === 2);
assert('remaining is total minus completed', counts.remainingCount === 1);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll passed');
