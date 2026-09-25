#!/usr/bin/env node
'use strict';

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

const ctx = {
  console,
  Date,
  Intl,
  _derivedStatusCache: { sourceRef: null, byAsgnId: {} },
  adminState: {
    assignments: [
      { id: 'od_e3dc4442-1e61-43bd-80ba-8c88d366d399', date: '2026-09-18', teamId: 100019, status: 'Booked' },
    ],
    perfSessionStateRows: [],
  },
  STATIONS: [
    { key: 'station1' }, { key: 'station2' }, { key: 'station3' }, { key: 'station4' },
  ],
  statusOrderIdx: s => ({
    office_checkin: 0, arrived: 1,
    station_1_done: 5, station_2_done: 6, station_3_done: 7, station_4_done: 8,
    session_done: 9,
  }[s] ?? -1),
  isScenarioDoneForStation: (s) => s && (s.status === 'Uploaded' || s.status === 'Calibrated' || s.status === 'All Recorded'),
  getModeratorDisplayName: id => id,
  parseLastActiveMs: v => {
    const t = Date.parse(v);
    return isNaN(t) ? 0 : t;
  },
  lastGeoFromSessionRow: () => null,
  assignmentIdsMatch: (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase(),
};

const chunks = [
  'assignmentIdsMatch',
  'pstYmdFromTimestamp',
  'sessionStateStampOnOrAfterBooking',
  'sessionStateProgressForeignToBooking',
  'scrubSessionStateProgressToBooking',
  'resolveAssignmentBookingYmd',
  'parseSessionStateJson',
  'firstStationCompletedStamp',
  'sessionStateRowMatchesAssignment',
  'invalidateSessionStateAssignmentIndex',
  'sessionStateAssignmentIndexKeys',
  'sessionStateAssignmentIndex',
  'sessionStateRowsForAssignment',
  'deriveLatestStatusFromSessionState',
];

// assignmentIdsMatch already in twilight before helpers — extract from file
vm.createContext(ctx);
vm.runInContext('var _derivedStatusCache = { sourceRef: null, byAsgnId: {} };', ctx);
vm.runInContext('var _ssAssignIndex = { sourceRef: null, byId: null };', ctx);
for (const name of chunks) {
  const code = extractFn(name);
  vm.runInContext(code, ctx);
}

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

console.log('SessionState booking-scope self-test');

const booking = '2026-09-18';
const foreign = {
  sessionDate: '2026-09-18',
  sessionStatus: 'station_4_done',
  stationCompletedAt: {
    station1: '2026-09-17T11:41:37.049Z',
    Station1: '2026-09-17T11:41:37.049Z',
    station4: '2026-09-17T11:44:02.492Z',
    Station4: '2026-09-17T11:44:02.492Z',
  },
  stations: {
    station4: { scenarios: { '01': { status: 'Uploaded' }, '02': { status: 'Uploaded' } } },
  },
};

assert('foreign progress detected', ctx.sessionStateProgressForeignToBooking(foreign, booking));
const scrubbed = ctx.scrubSessionStateProgressToBooking(foreign, booking);
assert('scrub clears sessionStatus', !scrubbed.sessionStatus, scrubbed.sessionStatus);
assert('scrub clears station stamps', Object.keys(scrubbed.stationCompletedAt || {}).length === 0);
assert('scrub clears stations map', !scrubbed.stations || Object.keys(scrubbed.stations).length === 0);

const fresh = {
  sessionDate: '2026-09-18',
  sessionStatus: 'arrived',
  arrivedAt: '2026-09-18T20:10:00.000Z',
  stationCompletedAt: {},
};
assert('fresh today not foreign', !ctx.sessionStateProgressForeignToBooking(fresh, booking));

ctx.adminState.perfSessionStateRows = [{
  sessionStateId: 'ss_od_e3dc4442-1e61-43bd-80ba-8c88d366d399_narendratw',
  assignmentId: '',
  orbitLoginId: 'Narendra-tw',
  lastActive: '2026-09-19T01:00:00.000Z',
  stateJson: JSON.stringify(foreign),
}];

const derived = ctx.deriveLatestStatusFromSessionState('od_e3dc4442-1e61-43bd-80ba-8c88d366d399');
assert('derive ignores foreign station_4', !derived || derived.status !== 'station_4_done',
  derived && derived.status);
assert('derive returns null or arrived-or-less',
  !derived || ctx.statusOrderIdx(derived.status) <= ctx.statusOrderIdx('arrived'),
  derived && derived.status);

const liveRow = {
  sessionStateId: 'ss_od_e3dc4442-1e61-43bd-80ba-8c88d366d399_pradeepreddytw',
  assignmentId: 'od_e3dc4442-1e61-43bd-80ba-8c88d366d399',
  orbitLoginId: 'Pradeepreddy-tw',
  lastActive: '2026-09-19T03:30:00.000Z',
  stateJson: JSON.stringify({
    sessionDate: '2026-09-18',
    sessionStatus: 'station_2_done',
    stationCompletedAt: {
      station1: '2026-09-18T20:20:00.000Z',
      Station1: '2026-09-18T20:20:00.000Z',
      station2: '2026-09-18T21:00:00.000Z',
      Station2: '2026-09-18T21:00:00.000Z',
    },
  }),
};
ctx.adminState.perfSessionStateRows = [ctx.adminState.perfSessionStateRows[0], liveRow];
// bust cache
ctx.adminState.perfSessionStateRows = ctx.adminState.perfSessionStateRows.slice();
const derived2 = ctx.deriveLatestStatusFromSessionState('od_e3dc4442-1e61-43bd-80ba-8c88d366d399');
assert('derive keeps same-day station_2', derived2 && derived2.status === 'station_2_done',
  derived2 && derived2.status);

// Duplicate SessionState rows for same mod: one foreign (pre-reset) + one
// clean post-reset. Booking-scoped scrub must not let the stale duplicate
// inflate Live to station_4.
ctx.adminState.perfSessionStateRows = [
  {
    sessionStateId: 'ss_od_e3dc4442-1e61-43bd-80ba-8c88d366d399_narendratw',
    assignmentId: 'od_e3dc4442-1e61-43bd-80ba-8c88d366d399',
    orbitLoginId: 'Narendra-tw',
    lastActive: '2026-09-19T04:00:00.000Z',
    stateJson: JSON.stringify({
      sessionDate: '2026-09-18',
      sessionStatus: '',
      stationCompletedAt: {},
      stations: {},
      progressScore: 0,
    }),
  },
  {
    sessionStateId: 'ss_od_e3dc4442-1e61-43bd-80ba-8c88d366d399_narendratw',
    assignmentId: '',
    orbitLoginId: 'Narendra-tw',
    lastActive: '2026-09-18T12:00:00.000Z',
    stateJson: JSON.stringify(foreign),
  },
];
const derivedDup = ctx.deriveLatestStatusFromSessionState('od_e3dc4442-1e61-43bd-80ba-8c88d366d399');
assert('duplicate foreign row ignored', !derivedDup || derivedDup.status !== 'station_4_done',
  derivedDup && derivedDup.status);

if (failed) {
  console.error(failed + ' booking-scope checks failed');
  process.exit(1);
}
console.log('All booking-scope checks passed');
