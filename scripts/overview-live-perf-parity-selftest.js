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

const patrick = {
  id: 'od_1155244b',
  teamId: 11,
  teamName: 'Patrick team',
  date: '2026-09-17',
  startMin: 20 * 60,
  endMin: 3 * 60,
  status: 'Booked',
};

const kajol = {
  id: 'od_ea9941e3',
  teamId: 42,
  teamName: 'Kajol team',
  date: '2026-09-17',
  startMin: 20 * 60,
  endMin: 3 * 60,
  status: 'Booked',
};

const nextQueued = {
  id: 'od_d9286d02',
  teamId: 42,
  teamName: 'Kajol team',
  date: '2026-09-19',
  startMin: 20 * 60,
  endMin: 3 * 60,
  status: 'Booked',
};

const ctx = {
  console,
  Date,
  Intl,
  adminState: {
    overview: { teamId: 'all', moderatorId: 'all', timeScope: 'day' },
    assignments: [patrick, kajol, nextQueued],
    teams: [
      { id: 11, name: 'Patrick team' },
      { id: 42, name: 'Kajol team' },
    ],
    perfSessionStateRows: [],
  },
  getPSTDateString: () => '2026-09-18',
  statusOrderIdx: s => ({
    office_checkin: 0, arrived: 1, station_1_done: 5, session_done: 9,
  }[s] ?? -1),
  isTerminalStatus: s => s === 'Cancelled' || s === 'Unassigned',
  isSessionWrapUpDone: () => false,
  getLatestStatusForAssignment: (id) => {
    if (id === 'od_1155244b' || id === 'od_ea9941e3' || id === 'od_d9286d02') {
      return { status: 'arrived' };
    }
    return null;
  },
  assignmentCoerceClockMin: (v, fb) => (v == null ? fb : v),
  assignmentModalNormalizeEndMin: (s, e) => (e < s ? e + 24 * 60 : e),
  parseYMD: (s) => {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  },
  ymd: (d) => {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  },
  perfLiveStatusDisplay: () => ({ key: 'checkin', label: 'Check-in' }),
};

vm.createContext(ctx);

vm.runInContext(sliceBetween('function addDaysToYmd', 'function teamBookingOnDateForStrike'), ctx);
vm.runInContext(sliceBetween('function pacificWallClockToMs', 'function modStrikeCheckpointSkippedTeamIds'), ctx);
vm.runInContext(sliceBetween('function perfBookingOverlapsPacificDay', 'function perfDateRangeOptions'), ctx);
vm.runInContext(sliceBetween('function assignmentPerfSessionStarted', 'function perfLiveStatusDisplay'), ctx);
vm.runInContext(sliceBetween('function assignmentQueueNormalizedEndMin', 'function operatorProgressOnAssignment'), ctx);
vm.runInContext(sliceBetween('function assignmentSessionStartedNotDone', 'function operatorInProgressAssignment'), ctx);
vm.runInContext(sliceBetween('function adminOpenBookingAssignment', 'function applyBookingQueueGate'), ctx);
vm.runInContext(sliceBetween('function bookingQueueGateBlocker', 'function operatorCarouselCandidateAssignments'), ctx);
vm.runInContext(sliceBetween('function perfTeamBookingCandidates', 'function perfModBookings'), ctx);
vm.runInContext(sliceBetween('function overviewAssignmentIsPerfLive', 'function computeOverviewMetrics'), ctx);
vm.runInContext(sliceBetween('function overviewLiveStatusStationLabel', 'function overviewLiveStatusPillLabel'), ctx);

const realNow = Date.now;
Date.now = () => ctx.pacificWallClockToMs('2026-09-18', 2 * 60);

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

console.log('Overview Live / Performance parity self-test');

ctx.isPastModStrikeCheckpointHour = () => false;

const dayScoped = [patrick, kajol];

assert('Patrick overnight is Performance Live',
  ctx.classifyBookingForPerf(patrick) === 'inprogress');
assert('Kajol overnight is Performance Live',
  ctx.classifyBookingForPerf(kajol) === 'inprogress');

assert('overviewAssignmentIsPerfLive includes Patrick',
  ctx.overviewAssignmentIsPerfLive(patrick));
assert('overviewAssignmentIsPerfLive includes Kajol',
  ctx.overviewAssignmentIsPerfLive(kajol));
assert('9 AM gate hides next queued in admin queue',
  !ctx.perfAssignmentVisibleInAdminQueue(nextQueued));
assert('9 AM gate blocks next queued for overview live',
  !ctx.overviewAssignmentIsPerfLive(nextQueued));

const liveTeamIds = new Set();
dayScoped.forEach(a => {
  if (ctx.overviewAssignmentIsPerfLive(a)) liveTeamIds.add(a.teamId);
});
assert('live team count matches Performance overnight (2 teams)',
  liveTeamIds.size === 2);

const snaps = ctx.computeOverviewLiveTeamSnapshots(dayScoped, 10);
const inprogressTeams = snaps.filter(s => s.kind === 'inprogress').map(s => String(s.teamId)).sort();
assert('snapshots list same overnight Live teams as Performance',
  inprogressTeams.join(',') === '11,42');

const pastEndPatrick = { ...patrick, date: '2026-09-16', startMin: 20 * 60, endMin: 22 * 60 };
assert('after booked end, arrived alone is not overview live',
  !ctx.overviewAssignmentIsPerfLive(pastEndPatrick));

Date.now = realNow;

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll passed');
