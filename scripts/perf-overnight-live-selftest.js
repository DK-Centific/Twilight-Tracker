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
  Date,
  Intl,
  adminState: { assignments: [], perfSessionStateRows: [] },
  getPSTDateString: () => '2026-09-18',
  statusOrderIdx: s => ({
    office_checkin: 0, arrived: 1, station_1_done: 5, session_done: 9,
  }[s] ?? -1),
  isTerminalStatus: s => s === 'Cancelled' || s === 'Unassigned',
  isSessionWrapUpDone: () => false,
  getLatestStatusForAssignment: (id) => {
    if (id === 'od_ea9941e3') return { status: 'arrived' };
    if (id === 'od_d9286d02') return { status: 'arrived' };
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
  parseAssignedDate: (str) => {
    const m = String(str).match(/^(\d{4}-\d{2}-\d{2})\s+(\d{1,2})\s*PM\s*[–\-]\s*(\d{1,2})\s*AM$/i);
    if (!m) return null;
    return { date: m[1], startMin: 20 * 60, endMin: 3 * 60 };
  },
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

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

console.log('Performance overnight Live self-test');

const overnight = {
  id: 'od_ea9941e3',
  teamId: 42,
  date: '2026-09-17',
  startMin: 20 * 60,
  endMin: 3 * 60,
  status: 'Booked',
};

const nextQueued = {
  id: 'od_d9286d02',
  teamId: 42,
  date: '2026-09-19',
  startMin: 20 * 60,
  endMin: 3 * 60,
  status: 'Booked',
};

assert('overnight overlaps Today PT on Sep 18 morning',
  ctx.perfBookingOverlapsPacificDay(overnight, '2026-09-18'));

assert('next queued Sep 19 does not overlap Today Sep 18',
  !ctx.perfBookingOverlapsPacificDay(nextQueued, '2026-09-18'));

const realNow = Date.now;
Date.now = () => ctx.pacificWallClockToMs('2026-09-18', 2 * 60); // 2 AM PT still in window
assert('classify overnight as Live when arrived in window',
  ctx.classifyBookingForPerf(overnight) === 'inprogress');
Date.now = realNow;

ctx.adminState.assignments = [overnight, nextQueued];
ctx.isPastModStrikeCheckpointHour = () => false;
const visible = ctx.perfTeamBookingCandidates(42);
assert('9 AM gate hides next queued while overnight active',
  visible.length === 1 && String(visible[0].id) === 'od_ea9941e3');

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll passed');
