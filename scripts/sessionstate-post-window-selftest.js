#!/usr/bin/env node
'use strict';

/**
 * Post-window checklist ignore (1.3.100426c).
 *
 * Venkata × Adidela, Renyu Chen, booking od_56991291… Sat Oct 3
 * 7 PM–2 AM PT. A Station 4 tap at 12:42 AM PT Mon Oct 5 must not
 * count as team complete. A finish inside booking end + 4 hours still
 * counts. Progress from before the booking day still does not.
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
    console.error('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

console.log('Post-window SessionState ignore (1.3.100426c)');

assert('APP_VERSION 1.3.100426c',
  /const APP_VERSION = '1\.3\.100426c'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.100426c'));
assert('four-hour grace after booked end',
  /SESSION_PROGRESS_AFTER_END_GRACE_MS = 4 \* 60 \* 60 \* 1000/.test(src)
  && /function applySessionProgressUpperBound/.test(src)
  && /function sessionStatePostWindowWriteDecision/.test(src));
assert('team complete and derive pass the booking into the scrub',
  /assignment: a/.test(src.slice(src.indexOf('function isAssignmentTeamHappypathComplete'), src.indexOf('function isAssignmentCompleteForFlagged')))
  && /assignment: bookingAsgn/.test(src));
assert('saves refuse after the window',
  src.indexOf('sessionStatePostWindowWriteDecision') < src.indexOf('function flushSessionStateSync')
  && /refuse-post-window/.test(src)
  && src.slice(src.indexOf('function sendSessionStateBeacon'), src.indexOf('function postSessionStateLifecycleUpdate')).includes('sessionStatePostWindowWriteDecision')
  && src.slice(src.indexOf('async function postSessionStatePayloadDirect'), src.indexOf('async function writeModCancelSessionState')).includes('sessionStatePostWindowWriteDecision'));

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

const AID = 'od_56991291-58d9-42ef-af2a-6f1a7ddcafee';
const NEXT = 'od_oct4_venkata';
const uploaded = { status: 'Uploaded', notes: '', iterations: 1 };
function stationMap(n) {
  const scenarios = {};
  for (let i = 1; i <= n; i++) scenarios[String(i)] = Object.assign({}, uploaded);
  return { cameras: {}, scenarios };
}

const booking = {
  id: AID,
  teamId: 100501,
  date: '2026-10-03',
  status: 'Booked',
  startMin: 19 * 60,
  endMin: 2 * 60,
  teamName: 'Venkata × Adidela',
  modSnapshots: [{ orbitLoginId: 'Venkata-tw' }, { orbitLoginId: 'Adidela-tw' }],
};
const nextBooking = {
  id: NEXT,
  teamId: 100501,
  date: '2026-10-04',
  status: 'Booked',
  startMin: 19 * 60,
  endMin: 2 * 60,
  modSnapshots: [{ orbitLoginId: 'Venkata-tw' }, { orbitLoginId: 'Adidela-tw' }],
};

const ctx = {
  console,
  Date,
  Intl,
  Object,
  String,
  Array,
  Number,
  Set,
  Map,
  JSON,
  Math,
  STATIONS: [
    { key: 'station1' }, { key: 'station2' }, { key: 'station3' }, { key: 'station4' },
  ],
  _derivedStatusCache: { sourceRef: null, byAsgnId: {} },
  adminState: {
    assignments: [booking, nextBooking],
    teams: [{
      id: 100501,
      name: 'Venkata × Adidela',
      primaryIds: ['Venkata-tw', 'Adidela-tw'],
    }],
    perfSessionStateRows: [],
    perfDateRange: 'all',
    perfStatusScope: 'all',
  },
  state: { modProfile: { orbitLoginId: 'Venkata-tw' } },
  assignmentIdsMatch: (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase(),
  assignmentPerfMaterialize: (a) => a,
  assignmentCoerceClockMin: (val, fallback) => {
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0) return fallback != null ? fallback : 0;
    return n;
  },
  assignmentModalNormalizeEndMin: (startMin, endMin) => {
    const s = Number(startMin) || 0;
    let e = Number(endMin);
    if (!Number.isFinite(e)) e = s;
    if (e <= s) e += 24 * 60;
    return e;
  },
  addDaysToYmd: (ymd, delta) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd || ''));
    if (!m) return '';
    const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + delta));
    return dt.toISOString().slice(0, 10);
  },
  parseLastActiveMs: (v) => {
    const t = Date.parse(v);
    return isNaN(t) ? 0 : t;
  },
  parseSessionStateJson: (r) => {
    try {
      return typeof r.stateJson === 'string' ? JSON.parse(r.stateJson || '{}') : (r.stateJson || {});
    } catch (_) { return {}; }
  },
  sessionStateRowMatchesAssignment: (r, id) => String((r && r.assignmentId) || '') === String(id),
  sessionStateRowsForAssignment: (id, rows) => (rows || []).filter(r => String(r.assignmentId || '') === String(id)),
  sessionStateRowSaysCancelled: () => false,
  isGeoPresenceOrRemoteSessionStateRow: () => false,
  isScenarioDoneForStation: (sc) => !!(sc && sc.status === 'Uploaded'),
  isScenarioComplete: (sc) => !!(sc && sc.status === 'Uploaded'),
  statusOrderIdx: (s) => ({
    office_checkin: 0, arrived: 1,
    station_1_done: 5, station_2_done: 6, station_3_done: 7, station_4_done: 8,
    session_done: 9, office_checkout: 10,
  }[s] ?? -1),
  resolveAssignmentBookingYmd: () => '2026-10-03',
  getModeratorDisplayName: (id) => String(id || ''),
  mergeStationMapsPreferRicher: (dst, srcMap) => Object.assign({}, dst || {}, srcMap || {}),
  assignmentCommentIsModCancel: () => false,
  assignmentIsOdSoftClose: () => false,
  perfAssignmentIsTeamCancelled: () => false,
  assignmentSessionStateSaysCancelled: () => false,
  assignmentIsModCancelForQueue: () => false,
  isAssignmentSkipOrResolvedForFlagged: () => false,
  modStrikeAutoStrikeClearsIncompleteAlert: () => false,
  getTeamBackupIds: (t) => (t && t.backupIds) || [],
  sessionStateBlobIsModCancelWipe: (p) => String((p && p.sessionStatus) || '').toLowerCase() === 'cancelled',
};
ctx.assignmentModalNormalizeEndMin = (startMin, endMin) => {
  const s = ctx.assignmentCoerceClockMin(startMin, 0);
  let e = ctx.assignmentCoerceClockMin(endMin, s);
  if (e <= s) e += 24 * 60;
  return e;
};
ctx.isPastAssignmentSessionEnd = (a, nowMs) => {
  const end = ctx.assignmentBookingSessionEndMs(a);
  const now = nowMs != null ? nowMs : Date.parse('2026-10-05T07:42:00.000Z');
  return Number.isFinite(end) && now >= end;
};

const names = [
  'pacificWallClockToMs',
  'assignmentBookingSessionStartMs',
  'assignmentBookingSessionEndMs',
  'pstYmdFromTimestamp',
  'sessionStateStampOnOrAfterBooking',
  'sessionStateProgressForeignToBooking',
  'sessionCompletionStampBelongsToBooking',
  'sessionStateStampMs',
  'assignmentProgressDeadlineMs',
  'sessionStateStampAfterProgressDeadline',
  'sessionProgressStatusRank',
  'sessionProgressStatusFromRank',
  'canonicalStationProgressKey',
  'stationProgressStampKeys',
  'stationMapHasInWindowStamp',
  'sessionStateFinishClockMs',
  'applySessionProgressUpperBound',
  'assignmentOrbitOnBooking',
  'bookingWindowHasStarted',
  'moderatorHasNewerStartedBooking',
  'sessionStatePostWindowWriteDecision',
  'scrubSessionStateProgressToBooking',
  'firstStationCompletedStamp',
  'sessionStateStatusHint',
  'sessionStateCompletionStamp',
  'sessionStateHasStation4Stamp',
  'sessionStateAllStationsHappypath',
  'sessionStateParsedIsHappypathComplete',
  'assignmentHappypathMemberOrbitIds',
  'sessionStateBestTeamStatus',
  'sessionStateStampsAllBeforeBooking',
  'sessionStateCountsAsTeamComplete',
  'assignmentSessionStateRowsForHappypath',
  'isAssignmentTeamHappypathComplete',
  'isAssignmentCompleteForFlagged',
  'isAssignmentFlaggedForPerf',
  'classifyBookingForPerf',
  'perfLiveStatusDisplay',
  'deriveLatestStatusFromSessionState',
  'getLatestStatusForAssignment',
];

vm.createContext(ctx);
try {
  for (const name of names) {
    vm.runInContext(extractFn(name), ctx);
  }
  assert('sandbox extract', true);
} catch (e) {
  assert('sandbox extract', false, String(e && e.message || e));
  process.exit(1);
}

const endMs = ctx.assignmentBookingSessionEndMs(booking);
const deadline = ctx.assignmentProgressDeadlineMs(booking);
assert('booked end is 2:00 AM PT Oct 4',
  endMs === Date.parse('2026-10-04T09:00:00.000Z'),
  new Date(endMs).toISOString());
assert('grace ends four hours later',
  deadline === endMs + 4 * 60 * 60 * 1000);

function row(partial) {
  return Object.assign({
    id: 599,
    orbitLoginId: 'Venkata-tw',
    assignmentId: AID,
    sessionDate: '2026-10-03',
    lastActive: '2026-10-05T07:42:00.000Z',
  }, partial);
}

const lateBlob = {
  sessionDate: '2026-10-03',
  sessionStatus: 'station_4_done',
  progressScore: 4400,
  stationCompletedAt: {
    station2: '2026-10-04T06:00:00.000Z',
    Station2: '2026-10-04T06:00:00.000Z',
    station3: '2026-10-05T07:41:00.000Z',
    Station3: '2026-10-05T07:41:00.000Z',
    station4: '2026-10-05T07:42:00.000Z',
    Station4: '2026-10-05T07:42:00.000Z',
  },
  stations: {
    station2: stationMap(8),
    station3: stationMap(8),
    station4: stationMap(4),
  },
};
const lateRow = row({
  sessionStatus: 'station_4_done',
  stateJson: JSON.stringify(lateBlob),
});
const adidela = row({
  id: 600,
  orbitLoginId: 'Adidela-tw',
  sessionStatus: '',
  lastActive: '2026-10-04T05:00:00.000Z',
  stateJson: JSON.stringify({ sessionDate: '2026-10-03', sessionStatus: '' }),
});

const bounded = ctx.applySessionProgressUpperBound(lateBlob, lateRow, booking);
assert('late Station 4 stamp is dropped',
  !(bounded.parsed.stationCompletedAt.Station4 || bounded.parsed.stationCompletedAt.station4));
assert('in-window Station 2 stamp stays',
  !!(bounded.parsed.stationCompletedAt.Station2 || bounded.parsed.stationCompletedAt.station2));
assert('status falls back to Station 2',
  bounded.parsed.sessionStatus === 'station_2_done',
  bounded.parsed.sessionStatus);

ctx.adminState.perfSessionStateRows = [lateRow, adidela];
ctx._derivedStatusCache = { sourceRef: null, byAsgnId: {} };
assert('late Station 4 does not complete the team',
  ctx.isAssignmentTeamHappypathComplete(booking) === false);
assert('Flagged stays on',
  ctx.isAssignmentFlaggedForPerf(booking) === true);
assert('Performance does not classify Done',
  ctx.classifyBookingForPerf(booking) !== 'completed',
  ctx.classifyBookingForPerf(booking));
assert('late Station 4 classifies Incomplete',
  ctx.classifyBookingForPerf(booking) === 'incomplete',
  ctx.classifyBookingForPerf(booking));
assert('Incomplete pill is Incomplete',
  ctx.perfLiveStatusDisplay(booking).label === 'Incomplete',
  ctx.perfLiveStatusDisplay(booking).label);
const derived = ctx.deriveLatestStatusFromSessionState(AID);
assert('derived live status is not station 4',
  derived && derived.status === 'station_2_done',
  derived && derived.status);

const graceBlob = {
  sessionDate: '2026-10-03',
  sessionStatus: 'station_4_done',
  stationCompletedAt: {
    Station4: '2026-10-04T09:30:00.000Z',
    station4: '2026-10-04T09:30:00.000Z',
  },
  stations: { station4: stationMap(4) },
};
const graceRow = row({
  id: 601,
  sessionStatus: 'station_4_done',
  lastActive: '2026-10-04T09:30:00.000Z',
  stateJson: JSON.stringify(graceBlob),
});
ctx.adminState.perfSessionStateRows = [graceRow];
ctx._derivedStatusCache = { sourceRef: null, byAsgnId: {} };
assert('finish 30 minutes after end still completes',
  ctx.isAssignmentTeamHappypathComplete(booking) === true
  && ctx.isAssignmentFlaggedForPerf(booking) === false
  && ctx.classifyBookingForPerf(booking) === 'completed'
  && ctx.perfLiveStatusDisplay(booking).label === 'Completed');

const priorBlob = {
  sessionDate: '2026-10-02',
  sessionStatus: 'station_4_done',
  stationCompletedAt: { Station4: '2026-10-02T06:00:00.000Z' },
};
const priorRow = row({
  id: 602,
  sessionStatus: 'station_4_done',
  sessionDate: '2026-10-02',
  lastActive: '2026-10-02T06:00:00.000Z',
  stateJson: JSON.stringify(priorBlob),
});
ctx.adminState.perfSessionStateRows = [priorRow];
ctx._derivedStatusCache = { sourceRef: null, byAsgnId: {} };
assert('progress before the booking day still does not complete',
  ctx.isAssignmentTeamHappypathComplete(booking) === false);

const stampLessGrace = row({
  id: 603,
  sessionStatus: 'station_4_done',
  lastActive: '2026-10-04T11:00:00.000Z',
  stateJson: JSON.stringify({
    sessionDate: '2026-10-03',
    sessionStatus: 'station_4_done',
    arrivedAt: '2026-10-04T03:00:00.000Z',
  }),
});
ctx.adminState.perfSessionStateRows = [stampLessGrace];
ctx._derivedStatusCache = { sourceRef: null, byAsgnId: {} };
assert('Station 4 with no stamp still completes inside the grace',
  ctx.isAssignmentTeamHappypathComplete(booking) === true
  && (ctx.deriveLatestStatusFromSessionState(AID) || {}).status === 'station_4_done');

const stampLessLate = row({
  id: 604,
  sessionStatus: 'station_4_done',
  lastActive: '2026-10-05T07:42:00.000Z',
  stateJson: JSON.stringify({
    sessionDate: '2026-10-03',
    sessionStatus: 'station_4_done',
    stations: {
      station1: stationMap(2),
      station2: stationMap(2),
      station3: stationMap(2),
      station4: stationMap(2),
    },
  }),
});
ctx.adminState.perfSessionStateRows = [stampLessLate];
ctx._derivedStatusCache = { sourceRef: null, byAsgnId: {} };
assert('stamp-less Station 4 after the grace does not complete',
  ctx.isAssignmentTeamHappypathComplete(booking) === false);

const during = Date.parse('2026-10-04T04:00:00.000Z');
const inGrace = Date.parse('2026-10-04T10:00:00.000Z');
const pastGrace = Date.parse('2026-10-04T14:00:00.000Z');
const lateNow = Date.parse('2026-10-05T07:42:00.000Z');

assert('save during the booking is allowed',
  ctx.sessionStatePostWindowWriteDecision(booking, lateBlob, {
    nowMs: during, orbitLoginId: 'Venkata-tw',
  }).refuse === false);

const graceDecision = ctx.sessionStatePostWindowWriteDecision(booking, lateBlob, {
  nowMs: inGrace, orbitLoginId: 'Venkata-tw',
});
assert('grace save is allowed when the next booking has not started',
  graceDecision.refuse === false && graceDecision.reason === 'grace',
  JSON.stringify(graceDecision));

const pastDecision = ctx.sessionStatePostWindowWriteDecision(booking, lateBlob, {
  nowMs: pastGrace, orbitLoginId: 'Venkata-tw',
});
assert('save after the grace is refused',
  pastDecision.refuse === true && pastDecision.reason === 'refuse-post-window' && pastDecision.pastGrace === true,
  JSON.stringify(pastDecision));

const newerDecision = ctx.sessionStatePostWindowWriteDecision(booking, lateBlob, {
  nowMs: lateNow, orbitLoginId: 'Venkata-tw',
});
assert('late save is refused when a newer booking has started',
  newerDecision.refuse === true && newerDecision.newerBooking === true,
  JSON.stringify(newerDecision));

const cancelDecision = ctx.sessionStatePostWindowWriteDecision(booking, {
  sessionStatus: 'Cancelled',
  checklistCleared: true,
}, { nowMs: lateNow, orbitLoginId: 'Venkata-tw' });
assert('Cancel session can still be saved',
  cancelDecision.refuse === false && cancelDecision.reason === 'mod-cancel',
  JSON.stringify(cancelDecision));

if (failed) {
  console.error(failed + ' post-window checks failed');
  process.exit(1);
}
console.log('All post-window checks passed');
