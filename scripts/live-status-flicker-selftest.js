#!/usr/bin/env node
'use strict';

/**
 * Live status flicker · Venkata×Jashit / arrived stays Live across poll.
 * Reproduces: unfinished yesterday (Patrick) pins admin queue after SessionState
 * loads and hides today's checked-in Rebecca from Overview/Performance Live.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'twilight.js'), 'utf8');

function extractFn(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let i = start;
  let depth = 0;
  let begun = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') { depth++; begun = true; }
    else if (ch === '}') {
      depth--;
      if (begun && depth === 0) { i++; break; }
    }
  }
  return src.slice(start, i);
}

function sliceBetween(startMarker, endMarker) {
  const begin = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, begin + 1);
  if (begin < 0 || end <= begin) throw new Error('slice fail ' + startMarker);
  return src.slice(begin, end);
}

const patrick = {
  id: 'od_patrick_yest',
  teamId: 77,
  teamName: 'Venkata x Jashit',
  date: '2026-09-17',
  startMin: 20 * 60,
  endMin: 3 * 60,
  status: 'Booked',
  modSnapshots: [{ orbitLoginId: 'Jashit-tw' }, { orbitLoginId: 'Venkata-tw' }],
};

const rebecca = {
  id: 'od_917b4f60-rebecca',
  teamId: 77,
  teamName: 'Venkata x Jashit',
  date: '2026-09-18',
  startMin: 14 * 60,
  endMin: 18 * 60,
  status: 'Booked',
  modSnapshots: [{ orbitLoginId: 'Jashit-tw' }, { orbitLoginId: 'Venkata-tw' }],
};

const ctx = {
  console,
  Date,
  Intl,
  _derivedStatusCache: { sourceRef: null, byAsgnId: {} },
  adminState: {
    overview: { teamId: 'all', moderatorId: 'all', timeScope: 'day' },
    assignments: [patrick, rebecca],
    teams: [{ id: 77, name: 'Venkata x Jashit', primaryIds: ['Jashit-tw', 'Venkata-tw'] }],
    perfSessionStateRows: [],
  },
  getPSTDateString: () => '2026-09-18',
  statusOrderIdx: s => ({
    office_checkin: 0, arrived: 1,
    station_1_done: 5, station_2_done: 6, station_3_done: 7, station_4_done: 8,
    session_done: 9,
  }[s] ?? -1),
  isTerminalStatus: s => s === 'Cancelled' || s === 'Unassigned',
  isSessionWrapUpDone: () => false,
  isPastModStrikeCheckpointHour: () => true, // after 9 AM PT
  assignmentCoerceClockMin: (v, fb) => (v == null ? fb : Number(v) || fb),
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
  parseAssignedDate: () => null,
  getModeratorDisplayName: id => id,
  parseLastActiveMs: v => {
    const t = Date.parse(v);
    return isNaN(t) ? 0 : t;
  },
  lastGeoFromSessionRow: () => null,
  assignmentIdsMatch: (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase(),
  isScenarioDoneForStation: (s) => s && (s.status === 'Uploaded' || s.status === 'Calibrated'),
  STATIONS: [{ key: 'station1' }, { key: 'station2' }, { key: 'station3' }, { key: 'station4' }],
  perfAssignmentHasRecentGeoActivity: () => false,
};

vm.createContext(ctx);
vm.runInContext('var _derivedStatusCache = { sourceRef: null, byAsgnId: {} };', ctx);

// Shared helpers
for (const name of [
  'assignmentIdsMatch',
  'pstYmdFromTimestamp',
  'sessionStateStampOnOrAfterBooking',
  'sessionStateProgressForeignToBooking',
  'scrubSessionStateProgressToBooking',
  'resolveAssignmentBookingYmd',
  'parseSessionStateJson',
  'firstStationCompletedStamp',
  'sessionStateRowMatchesAssignment',
  'sessionStateRowsForAssignment',
  'deriveLatestStatusFromSessionState',
]) {
  vm.runInContext(extractFn(name), ctx);
}

vm.runInContext(sliceBetween('function addDaysToYmd', 'function teamBookingOnDateForStrike'), ctx);
vm.runInContext(sliceBetween('function pacificWallClockToMs', 'function modStrikeCheckpointSkippedTeamIds'), ctx);
vm.runInContext(sliceBetween('function perfBookingOverlapsPacificDay', 'function perfDateRangeOptions'), ctx);
vm.runInContext(extractFn('assignmentPerfSessionStarted'), ctx);
vm.runInContext(extractFn('classifyBookingForPerf'), ctx);
vm.runInContext(sliceBetween('function assignmentQueueNormalizedEndMin', 'function operatorProgressOnAssignment'), ctx);
vm.runInContext(extractFn('assignmentSessionStartedNotDone'), ctx);
vm.runInContext(extractFn('adminOpenBookingAssignment'), ctx);
vm.runInContext(extractFn('applyAdminBookingQueueGate'), ctx);
vm.runInContext(extractFn('applySameTeamSequentialBookingGate'), ctx);
vm.runInContext(extractFn('bookingQueueGateBlocker'), ctx);
vm.runInContext(extractFn('perfTeamBookingCandidates'), ctx);
vm.runInContext(extractFn('perfAssignmentVisibleInAdminQueue'), ctx);
vm.runInContext(extractFn('overviewAssignmentIsPerfLive'), ctx);

// Wire getLatestStatusForAssignment to SS derive (admin path)
ctx.getLatestStatusForAssignment = (id) => ctx.deriveLatestStatusFromSessionState(id);

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

console.log('Live status flicker self-test (1.3.091820a)');

// Mid-afternoon PT on booking day
const realNow = Date.now;
Date.now = () => ctx.pacificWallClockToMs('2026-09-18', 15 * 60);

// --- Scrub: foreign stations + today arrived must stay arrived ---
const mixed = {
  sessionDate: '2026-09-18',
  sessionStatus: 'arrived',
  arrivedAt: '2026-09-18T21:00:00.000Z',
  stationCompletedAt: {
    station4: '2026-09-17T11:44:02.492Z',
    Station4: '2026-09-17T11:44:02.492Z',
  },
  stations: {
    station4: { scenarios: { '01': { status: 'Uploaded' } } },
  },
};
assert('mixed arrived+foreign not fully foreign',
  !ctx.sessionStateProgressForeignToBooking(mixed, '2026-09-18'));
const scrubbedMixed = ctx.scrubSessionStateProgressToBooking(mixed, '2026-09-18');
assert('scrub keeps arrivedAt', !!scrubbedMixed.arrivedAt);
assert('scrub keeps arrived status or arrivedAt',
  scrubbedMixed.sessionStatus === 'arrived' || !!scrubbedMixed.arrivedAt,
  scrubbedMixed.sessionStatus);

ctx.adminState.perfSessionStateRows = [{
  sessionStateId: 'ss_od_917b4f60-rebecca_venkatatw',
  assignmentId: rebecca.id,
  orbitLoginId: 'Venkata-tw',
  lastActive: '2026-09-18T22:00:00.000Z',
  stateJson: JSON.stringify(mixed),
}];
ctx._derivedStatusCache = { sourceRef: null, byAsgnId: {} };
vm.runInContext('_derivedStatusCache = { sourceRef: null, byAsgnId: {} };', ctx);

const derived = ctx.deriveLatestStatusFromSessionState(rebecca.id);
assert('derive arrived (not station_4) after scrub',
  derived && derived.status === 'arrived', derived && derived.status);

// --- Queue gate: after 9 AM, yesterday arrived must not hide today Live ---
ctx.adminState.perfSessionStateRows = [
  {
    sessionStateId: 'ss_od_patrick_yest_jashittw',
    assignmentId: patrick.id,
    orbitLoginId: 'Jashit-tw',
    lastActive: '2026-09-18T08:00:00.000Z',
    stateJson: JSON.stringify({
      sessionDate: '2026-09-17',
      sessionStatus: 'arrived',
      arrivedAt: '2026-09-18T03:00:00.000Z',
    }),
  },
  {
    sessionStateId: 'ss_od_917b4f60-rebecca_venkatatw',
    assignmentId: rebecca.id,
    orbitLoginId: 'Venkata-tw',
    lastActive: '2026-09-18T22:05:00.000Z',
    stateJson: JSON.stringify({
      sessionDate: '2026-09-18',
      sessionStatus: 'arrived',
      arrivedAt: '2026-09-18T21:10:00.000Z',
    }),
  },
];
vm.runInContext('_derivedStatusCache = { sourceRef: null, byAsgnId: {} };', ctx);

assert('Rebecca classified inprogress',
  ctx.classifyBookingForPerf(rebecca) === 'inprogress',
  ctx.classifyBookingForPerf(rebecca));

const candidates = ctx.perfTeamBookingCandidates(77);
const ids = candidates.map(a => a.id);
assert('admin queue after 9 AM includes Rebecca',
  ids.includes(rebecca.id), JSON.stringify(ids));
assert('admin queue after 9 AM excludes Patrick',
  !ids.includes(patrick.id), JSON.stringify(ids));

assert('Rebecca visible in admin queue',
  ctx.perfAssignmentVisibleInAdminQueue(rebecca));
assert('overview Live includes Rebecca',
  ctx.overviewAssignmentIsPerfLive(rebecca));

// Simulate poll re-derive (cache bust) — arrived must stay Live
for (let i = 0; i < 3; i++) {
  vm.runInContext('_derivedStatusCache = { sourceRef: null, byAsgnId: {} };', ctx);
  ctx.adminState.perfSessionStateRows = ctx.adminState.perfSessionStateRows.slice();
  const live = ctx.overviewAssignmentIsPerfLive(rebecca);
  assert('arrived stays Live across poll #' + (i + 1), live);
}

Date.now = realNow;

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll live-flicker checks passed');
