#!/usr/bin/env node
'use strict';

/**
 * Overview donut: total booked = Completed + Cancelled + Open.
 * Demo and Unassigned are out. Not checked-in is not a slice.
 */

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
  assignmentCommentIsModCancel: (c) => String(c || '').trim().indexOf('mod-cancel-session') === 0,
  classifyBookingForPerf: (a) => {
    if (!a || a.status === 'Cancelled' || a.status === 'Unassigned') return null;
    if (String(a.comment || '').indexOf('mod-cancel-session') === 0) return null;
    if (a.status === 'Completed' || a.id === 'wrap-only' || a.id === 'happypath') return 'completed';
    if (a.id === 'live-1') return 'inprogress';
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

console.log('Overview donut total booked self-test');

const demo = {
  id: 'd1',
  teamId: 'demo-team-01',
  status: 'Completed',
  participantName: 'Annie Demo',
  modSnapshots: [{ orbitLoginId: 'demo-annie' }],
};
const cancelled = { id: 'c1', teamId: '99', status: 'Cancelled' };
const modCancel = {
  id: 'c2',
  teamId: '99',
  status: 'Booked',
  comment: 'mod-cancel-session:amy:2026-09-25T16:00:00Z',
  participantName: 'Pat Smith',
};
const realDone = { id: 'r1', teamId: '99', status: 'Completed', participantName: 'Pat Smith' };
const realOpen = { id: 'r2', teamId: '99', status: 'Booked', participantName: 'Jane Doe' };
const wrapOnly = { id: 'wrap-only', teamId: '100', status: 'Booked' };
const testing = { id: 't1', teamId: '99', status: 'Booked', participantName: 'For Testing Only' };
const live = { id: 'live-1', teamId: '100', status: 'Booked', participantName: 'Sam Lee' };
const unassigned = { id: 'u1', teamId: '100', status: 'Unassigned' };
const happypath = { id: 'happypath', teamId: '100', status: 'Booked', participantName: 'Ada' };

assert('demo team booking is demo', ctx.assignmentIsDemoBooking(demo));
assert('for testing name is demo', ctx.assignmentIsDemoBooking(testing));
assert('real booking is not demo', !ctx.assignmentIsDemoBooking(realDone));
assert('mod-cancel comment is cancelled for the donut', ctx.overviewAssignmentIsCancelledForDonut(modCancel));
assert('status Cancelled is cancelled for the donut', ctx.overviewAssignmentIsCancelledForDonut(cancelled));
assert('cancel wins over a Completed status on the same row',
  ctx.overviewAssignmentIsCancelledForDonut({ id: 'both', status: 'Completed', comment: 'mod-cancel-session:x' })
  && !ctx.overviewAssignmentIsCompletedForDonut({ id: 'both', status: 'Completed', comment: 'mod-cancel-session:x' }));

const list = [demo, cancelled, modCancel, realDone, realOpen, wrapOnly, testing, live, unassigned, happypath];
const counts = ctx.computeOverviewDonutCounts(list);

assert('demo and Unassigned are outside total booked', counts.progressTotal === 7);
assert('completed is Completed status plus Performance Done', counts.completedCount === 3);
assert('cancelled is status Cancelled plus mod-cancel-session', counts.cancelledCount === 2);
assert('open is live and not-started bookings', counts.openCount === 2);
assert('slices sum to total booked',
  counts.completedCount + counts.cancelledCount + counts.openCount === counts.progressTotal);
assert('not-checked-in is not the opposing count',
  counts.remainingCount === counts.cancelledCount + counts.openCount
  && !('checkedInCount' in counts));

const onlyOpen = ctx.computeOverviewDonutCounts([realOpen]);
assert('a single open booking is 1 booked, 0 completed, 0 cancelled',
  onlyOpen.progressTotal === 1 && onlyOpen.completedCount === 0
  && onlyOpen.cancelledCount === 0 && onlyOpen.openCount === 1);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll passed');
