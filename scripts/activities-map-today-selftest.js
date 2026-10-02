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
  date: '2026-09-17',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Booked',
  address: 'Patrick site',
};

const kajol = {
  id: 'od_ea9941e3',
  teamId: 42,
  date: '2026-09-17',
  startMin: 20 * 60,
  endMin: 3 * 60,
  status: 'Booked',
  address: 'Kajol site',
};

const nextQueued = {
  id: 'od_d9286d02',
  teamId: 42,
  date: '2026-09-19',
  startMin: 20 * 60,
  endMin: 3 * 60,
  status: 'Booked',
  address: 'Next MxS site',
};

// Ended before midnight, so a Pacific-day overlap would drop it at
// 12:00 AM. Performance Today still keeps it until the 9 AM gate.
const eveningOnly = {
  id: 'od_evening_only',
  teamId: 77,
  date: '2026-09-17',
  startMin: 19 * 60,
  endMin: 23 * 60,
  status: 'Booked',
  address: 'Evening site',
};

// Later calendar day only. The live queue can still keep this row.
// Activities Today must not.
const futureOnly = {
  id: 'od_future_only',
  teamId: 88,
  date: '2026-09-19',
  startMin: 19 * 60,
  endMin: 23 * 60,
  status: 'Booked',
  address: 'Future site',
};

const ctx = {
  console,
  Date,
  Intl,
  adminState: {
    activitiesDateRange: 'today',
    assignments: [patrick, kajol, nextQueued, eveningOnly, futureOnly],
    teams: [
      { id: 11, name: 'Patrick team' },
      { id: 42, name: 'Kajol team' },
      { id: 77, name: 'Evening team' },
      { id: 88, name: 'Future only team' },
      { id: 99, name: 'Idle roster team' },
    ],
    perfSessionStateRows: [],
  },
  getPSTDateString: () => '2026-09-18',
  assignmentFenceAddress: (a) => String((a && a.address) || '').trim(),
  assignmentMatchesActivitiesFocus: () => true,
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
vm.runInContext(sliceBetween('function listActivitiesTeams()', 'function listActivitiesTeamMemberIds'), ctx);
vm.runInContext(sliceBetween('function getActivitiesDateRange()', 'function normalizeActivitiesFilterState'), ctx);

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

console.log('Activities Map Today parity self-test');

ctx.isPastModStrikeCheckpointHour = () => false;

assert('Patrick overnight in Today range (calendar date is Sep 17)',
  ctx.activitiesAssignmentInDateRange(patrick));

assert('Kajol overnight in Today range',
  ctx.activitiesAssignmentInDateRange(kajol));

assert('next queued Sep 19 not in Today range',
  !ctx.activitiesAssignmentInDateRange(nextQueued));

assert('midnight overlap still sees Patrick overnight',
  ctx.perfBookingOverlapsPacificDay(patrick));
assert('midnight overlap misses a night that ended at 11 PM',
  !ctx.perfBookingOverlapsPacificDay(eveningOnly)
    && !ctx.perfDateInRange(eveningOnly, 'today'));
assert('Today still lists that 11 PM night before 9 AM',
  ctx.activitiesAssignmentInDateRange(eveningOnly));
assert('queue can keep a later night, Today does not',
  ctx.perfAssignmentVisibleInAdminQueue(futureOnly)
    && !ctx.activitiesAssignmentInDateRange(futureOnly));

const mapIds = ctx.listActivitiesMapAssignments().map(a => String(a.id));
assert('Map Today includes Patrick overnight fence',
  mapIds.includes('od_1155244b'), mapIds.join(','));
assert('Map Today includes Kajol overnight fence',
  mapIds.includes('od_ea9941e3'), mapIds.join(','));
assert('Map Today excludes next queued before 9 AM gate',
  !mapIds.includes('od_d9286d02'), mapIds.join(','));

const teamIds = ctx.listActivitiesTeamsForDateRange().map(t => String(t.id));
assert('Team list includes Patrick team for Today overnight',
  teamIds.includes('11'));
assert('Team list for Kajol team without surfacing gated next booking alone',
  teamIds.includes('42'));
assert('Team list includes the 11 PM night before 9 AM',
  teamIds.includes('77'));
assert('Team dropdown omits a later night and an unbooked roster team',
  !teamIds.includes('88') && !teamIds.includes('99'), teamIds.join(','));

ctx.isPastModStrikeCheckpointHour = () => true;
assert('live queue still holds the prior night after 9 AM',
  ctx.perfAssignmentVisibleInAdminQueue(eveningOnly));
assert('that prior night is not a Today booking after 9 AM',
  !ctx.activitiesAssignmentInDateRange(eveningOnly));
const droppedIds = ctx.listActivitiesTeamsForDateRange().map(t => String(t.id));
assert('Team dropdown drops a queue-only older pairing',
  !droppedIds.includes('77'), droppedIds.join(','));

const todayStart = {
  id: 'od_evening_today',
  teamId: 77,
  date: '2026-09-18',
  startMin: 19 * 60,
  endMin: 23 * 60,
  status: 'Booked',
  address: 'Evening today',
};
ctx.adminState.assignments.push(todayStart);
assert('after 9 AM a today booking drops last night, same as Performance',
  !ctx.activitiesAssignmentInDateRange(eveningOnly)
    && ctx.activitiesAssignmentInDateRange(todayStart));
const afterGateTeams = ctx.listActivitiesTeamsForDateRange().map(t => String(t.id));
assert('that team stays on Today because tonight is booked',
  afterGateTeams.includes('77'));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll passed');
