#!/usr/bin/env node
'use strict';

/**
 * David policy (authoritative) · moderator Booking/Session day gate
 * ------------------------------------------------------------------
 * 1. Same team's prior incomplete OR Admin Skip on flag gate must NEVER
 *    interfere with current/today's moderator Booking/Session flow.
 * 2. Sep 17 → Sep 18 before 9:00 AM PT discarded from mod Booking/Session.
 * 3. After 9 AM PT day gate, mod flow binds only to current/today
 *    (assignmentId + sessionDate scoped).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

function extractFn(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let i = start, depth = 0, begun = false;
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

console.log('Moderator session day-gate policy self-test (1.3.091820a)');

assert('APP_VERSION is 1.3.091820a',
  /const APP_VERSION = '1\.3\.091820a'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091820a'));
assert('scrubSyncableStateForOpenBooking present',
  /function scrubSyncableStateForOpenBooking\(/.test(src)
  && /mergeTeammateState\(/.test(src)
  && src.indexOf('scrubSyncableStateForOpenBooking')
    < src.indexOf('function mergeTeammateState') + 400);
assert('applySelfSyncReplace scrubs before adopt',
  /function applySelfSyncReplace\(/.test(src)
  && /scrubSyncableStateForOpenBooking\(s\)/.test(src));
assert('legacy Skip today+ unmute guard present',
  /never a today\+ booking for that team/.test(src));

// --- Booking queue: after 9 AM + today booked → yesterday excluded ---
const begin = src.indexOf('/* BOOKING_QUEUE_BEGIN */');
const end = src.indexOf('/* BOOKING_QUEUE_END */');
assert('BOOKING_QUEUE block present', begin >= 0 && end > begin);
const block = src.slice(begin, end);

function runQueue(opts) {
  const gateOpen = opts.gateOpen !== false;
  const ctx = {
    state: opts.state || {},
    console, Date, Number, String, Array,
    isTerminalStatus: (s) => s === 'Cancelled' || s === 'Unassigned',
    isSessionWrapUpDone: opts.isSessionWrapUpDone || (() => false),
    getMyLatestStatusForAssignment: () => null,
    getOperatorAssignments: () => opts.assignments || [],
    getPSTDateString: () => opts.today || '2026-09-18',
    isPastModStrikeCheckpointHour: () => gateOpen,
    addDaysToYmd: (ymd, delta) => {
      const d = new Date(String(ymd).slice(0, 10) + 'T12:00:00');
      d.setDate(d.getDate() + delta);
      return d.toISOString().slice(0, 10);
    },
    assignmentCoerceClockMin: (v, fb) => (Number.isFinite(Number(v)) ? Number(v) : (fb || 0)),
    assignmentModalNormalizeEndMin: (s, e) => (e <= s ? e + 24 * 60 : e),
    statusOrderIdx: (status) => {
      const order = ['arrived', 'station_0a_done', 'station_1_done', 'station_3_done', 'session_done'];
      return order.indexOf(status);
    },
    getLatestStatusForAssignment: () => null,
  };
  vm.createContext(ctx);
  vm.runInNewContext(block, ctx);
  return ctx.operatorCarouselCandidateAssignments().map(a => a.id);
}

{
  const ids = runQueue({
    today: '2026-09-18',
    gateOpen: true,
    assignments: [
      { id: 'patrick', teamId: 'vxj', date: '2026-09-17', startMin: 19 * 60, endMin: 26 * 60, status: 'Booked' },
      { id: 'rebecca', teamId: 'vxj', date: '2026-09-18', startMin: 14 * 60, endMin: 22 * 60, status: 'Booked' },
    ],
    state: { sessionDate: '2026-09-17', arrivedAt: '2026-09-18T05:00:00.000Z' },
  });
  assert('after 9 AM carousel drops Sep17 incomplete when today booked',
    !ids.includes('patrick') && ids.includes('rebecca'), JSON.stringify(ids));
}

{
  const ids = runQueue({
    today: '2026-09-18',
    gateOpen: false,
    assignments: [
      { id: 'patrick', date: '2026-09-17', startMin: 19 * 60, endMin: 26 * 60, status: 'Booked' },
      { id: 'rebecca', date: '2026-09-18', startMin: 14 * 60, endMin: 22 * 60, status: 'Booked' },
    ],
    state: { sessionDate: '2026-09-17', arrivedAt: '2026-09-18T05:00:00.000Z' },
  });
  assert('before 9 AM overnight Sep17 still binds (pre-gate keep)',
    ids.includes('patrick') && !ids.includes('rebecca'), JSON.stringify(ids));
}

// --- SessionState scrub: foreign pre-booking stamps discarded ---
const scrubCtx = {
  console, Date, Intl,
  assignmentIdsMatch: (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase(),
};
vm.createContext(scrubCtx);
for (const name of [
  'pstYmdFromTimestamp',
  'sessionStateStampOnOrAfterBooking',
  'sessionStateProgressForeignToBooking',
  'scrubSessionStateProgressToBooking',
]) {
  vm.runInContext(extractFn(name), scrubCtx);
}

const foreign = {
  sessionDate: '2026-09-18',
  sessionStatus: 'station_4_done',
  stationCompletedAt: {
    station4: '2026-09-17T11:44:02.492Z',
    Station4: '2026-09-17T11:44:02.492Z',
  },
  stations: { station4: { scenarios: { '01': { status: 'Uploaded' } } } },
};
assert('pre-booking Sep17 station progress is foreign to Sep18',
  scrubCtx.sessionStateProgressForeignToBooking(foreign, '2026-09-18'));
const scrubbed = scrubCtx.scrubSessionStateProgressToBooking(foreign, '2026-09-18');
assert('scrub clears foreign station_4 for today booking',
  !scrubbed.sessionStatus || scrubbed.sessionStatus === '',
  scrubbed.sessionStatus);
assert('scrub clears foreign station stamps',
  Object.keys(scrubbed.stationCompletedAt || {}).length === 0);

// --- mergeTeammateState must not rehydrate foreign stations onto today ---
const mergeCtx = {
  console, Date, Intl,
  state: {
    sessionDate: '2026-09-18',
    stationCompletedAt: {},
    stations: {},
    participantAddress: '',
    sessionCompletedAt: null,
    arrivedAt: '',
    remindersShown: [],
    equipment: {},
    _progressScore: 0,
  },
  adminState: {
    assignments: [
      { id: 'od_rebecca', date: '2026-09-18', teamId: 77, status: 'Booked',
        participantData: { address: '15022 W. Lake Goodwin Rd., Stanwood, WA 98292' } },
    ],
  },
  getActiveOperatorAssignment: null,
  getOperatorAssignment: null,
  getAssignedOpenSession: null,
  assignmentFenceAddress: (a) => (a && a.participantData && a.participantData.address) || '',
  getPSTDateString: () => '2026-09-18',
  saveState: () => {},
  flushSessionStateSync: () => {},
  sessionStateProgressScore: () => 0,
  pickBetterScenario: (a, b) => Object.assign({}, a || {}, b || {}),
  assignmentIdsMatch: (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase(),
};
mergeCtx.getActiveOperatorAssignment = () => mergeCtx.adminState.assignments[0];
mergeCtx.getOperatorAssignment = mergeCtx.getActiveOperatorAssignment;
mergeCtx.getAssignedOpenSession = mergeCtx.getActiveOperatorAssignment;
vm.createContext(mergeCtx);
for (const name of [
  'pstYmdFromTimestamp',
  'sessionStateStampOnOrAfterBooking',
  'sessionStateProgressForeignToBooking',
  'scrubSessionStateProgressToBooking',
  'resolveOpenBookingYmdForScrub',
  'scrubSyncableStateForOpenBooking',
  'mergeTeammateState',
]) {
  vm.runInContext(extractFn(name), mergeCtx);
}

mergeCtx.mergeTeammateState({
  sessionDate: '2026-09-18',
  sessionStatus: 'station_4_done',
  stationCompletedAt: {
    station4: '2026-09-17T11:44:02.492Z',
    Station4: '2026-09-17T11:44:02.492Z',
  },
  stations: {
    station4: { cameras: {}, scenarios: { '01': { status: 'Uploaded' } } },
  },
  participantAddress: '123 Old Romo Rd',
  arrivedAt: '',
});

assert('teammate merge does not import foreign stationCompletedAt',
  Object.keys(mergeCtx.state.stationCompletedAt || {}).length === 0,
  JSON.stringify(mergeCtx.state.stationCompletedAt));
assert('teammate merge does not import foreign stations map',
  !mergeCtx.state.stations || !mergeCtx.state.stations.station4
  || !Object.keys((mergeCtx.state.stations.station4.scenarios || {})).length,
  JSON.stringify(mergeCtx.state.stations));
assert('teammate merge prefers today booking fence over stale cloud address',
  mergeCtx.state.participantAddress.indexOf('Lake Goodwin') >= 0
  || mergeCtx.state.participantAddress.indexOf('Stanwood') >= 0,
  mergeCtx.state.participantAddress);

// --- Legacy Admin Skip must not mute today's assignment ---
const skipCtx = {
  console, Date, Intl,
  adminState: {
    assignments: [
      { id: 'asgn_yest', teamId: 't1', date: '2026-09-17', status: 'Booked' },
      { id: 'asgn_today', teamId: 't1', date: '2026-09-18', status: 'Booked' },
    ],
  },
  getPSTDateString: () => '2026-09-18',
};
vm.createContext(skipCtx);
vm.runInContext(extractFn('modStrikeCheckpointMapHas'), skipCtx);
const legacyMap = { t1: true };
assert('legacy Skip still covers yesterday assignment',
  skipCtx.modStrikeCheckpointMapHas(legacyMap, 't1', 'asgn_yest') === true);
assert('legacy Skip does not mute today assignment',
  skipCtx.modStrikeCheckpointMapHas(legacyMap, 't1', 'asgn_today') === false);
assert('occurrence Skip does not mute different today assignment',
  skipCtx.modStrikeCheckpointMapHas({ t1: true, asgn_yest: true }, 't1', 'asgn_today') === false);
assert('occurrence Skip still mutes the skipped assignment',
  skipCtx.modStrikeCheckpointMapHas({ asgn_yest: true }, 't1', 'asgn_yest') === true);

if (failed) {
  console.error('\n' + failed + ' policy checks failed');
  process.exit(1);
}
console.log('\nAll moderator day-gate policy checks passed');
