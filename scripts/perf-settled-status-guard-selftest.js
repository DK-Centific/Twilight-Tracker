#!/usr/bin/env node
'use strict';

/**
 * Settled Performance status must not flip to Incomplete + Flagged.
 *
 * Yesterday's teams (2026-10-06), shaped like the live rows:
 *   Venkata x Muhammad · Booked + all stations uploaded (status still station_3_done)
 *   Jashit x Amy       · Booked + station_4_done
 *   Narendra x Pradeepreddy · Booked echo + checklist Confirm Cancel
 *
 * A paint before SessionState has loaded must not call them Incomplete
 * or Flagged. After they have been Completed or Cancelled, dropping
 * those rows must not downgrade them. A night that really never
 * finished, once SessionState has loaded, still says Incomplete.
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

console.log('Settled Performance status guard (1.3.100726c)');

assert('APP_VERSION 1.3.100726c',
  /const APP_VERSION = '1\.3\.100726c'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.100726c'));

assert('Incomplete waits for SessionState, same as the 9 AM strike',
  /function perfSettledStatusAwaitingSessionState/.test(src)
  && /perfSettledStatusAwaitingSessionState\(\)/.test(src.slice(src.indexOf('function classifyBookingForPerf')))
  && /perfSettledStatusAwaitingSessionState\(\)/.test(src.slice(src.indexOf('function isAssignmentFlaggedForPerf'))));

assert('already auto-struck teams stay off the incomplete alert',
  /modStrikeAutoStrikeClearsIncompleteAlert/.test(
    src.slice(src.indexOf('function isAssignmentFlaggedForPerf'), src.indexOf('function perfFlaggedAssignmentsInDateRange'))
  ));

const uploaded = { status: 'Uploaded', notes: '', iterations: 1 };
function stationMap() {
  const scenarios = {};
  for (let i = 1; i <= 4; i++) scenarios[String(i)] = Object.assign({}, uploaded);
  return { cameras: {}, scenarios };
}
function allStations() {
  return {
    station1: stationMap(),
    station2: stationMap(),
    station3: stationMap(),
    station4: stationMap(),
  };
}

const venkata = {
  id: 'od_332c61a0-3b75-482a-b1f9-d14d7892ac8e',
  teamId: 't-vm',
  date: '2026-10-06',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Booked',
  comment: 'od-sync',
  odScheduleId: 'OD-VENKATA',
  modSnapshots: [{ orbitLoginId: 'Venkata-tw' }, { orbitLoginId: 'Muhammad-tw' }],
};
const jashit = {
  id: 'od_8cabcd32-6fc2-4a30-8602-c8e6e1a501fa',
  teamId: 't-ja',
  date: '2026-10-06',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Booked',
  comment: 'od-sync',
  odScheduleId: 'OD-JASHIT',
  modSnapshots: [{ orbitLoginId: 'Jashit-tw' }, { orbitLoginId: 'Amy-tw' }],
};
const narendra = {
  id: 'od_25b80ff5-27e0-4302-a6ae-dd6f8e0df008',
  teamId: 't-np',
  date: '2026-10-06',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Booked',
  comment: 'od-sync',
  odScheduleId: 'OD-NARENDRA',
  modSnapshots: [{ orbitLoginId: 'Narendra-tw' }, { orbitLoginId: 'Pradeepreddy-tw' }],
};
const unfinished = {
  id: 'od_unfinished_example',
  teamId: 't-open',
  date: '2026-10-06',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Booked',
  comment: 'od-sync',
  odScheduleId: 'OD-OPEN',
  modSnapshots: [{ orbitLoginId: 'open-a@example.test' }, { orbitLoginId: 'open-b@example.test' }],
};

const venkataRows = [
  {
    assignmentId: venkata.id,
    orbitLoginId: 'Muhammad-tw',
    sessionStatus: 'station_3_done',
    sessionDate: '2026-10-06',
    stateJson: JSON.stringify({
      sessionStatus: 'station_3_done',
      sessionDate: '2026-10-06',
      stations: allStations(),
      progressScore: 8571,
    }),
  },
  {
    assignmentId: venkata.id,
    orbitLoginId: 'Venkata-tw',
    sessionStatus: 'arrived',
    sessionDate: '2026-10-06',
    stateJson: JSON.stringify({
      sessionStatus: 'arrived',
      sessionDate: '2026-10-06',
      stations: { station1: stationMap() },
    }),
  },
];
const jashitRows = [
  {
    assignmentId: jashit.id,
    orbitLoginId: 'Jashit-tw',
    sessionStatus: 'station_4_done',
    sessionDate: '2026-10-06',
    stateJson: JSON.stringify({
      sessionStatus: 'station_4_done',
      sessionDate: '2026-10-06',
      sessionCompletedAt: '',
      stations: allStations(),
      stationCompletedAt: { Station4: '2026-10-07T08:30:00.000Z' },
    }),
  },
];
const narendraRows = [
  {
    assignmentId: narendra.id,
    orbitLoginId: 'Narendra-tw',
    sessionStatus: 'Cancelled',
    sessionDate: '2026-10-06',
    stateJson: JSON.stringify({
      sessionStatus: 'Cancelled',
      sessionDate: '2026-10-06',
      checklistCleared: true,
      sessionCancelledAt: '2026-10-07T02:51:56.153Z',
      cancelComment: 'mod-cancel-session:Narendra-tw:2026-10-07T02:51:56.153Z',
      stations: {},
    }),
  },
];

const ctx = {
  console,
  Date,
  JSON,
  String,
  Number,
  Array,
  Object,
  Map,
  Set,
  Math,
  _perfSettledBookings: null,
  STATIONS: [
    { key: 'station1' }, { key: 'station2' }, { key: 'station3' }, { key: 'station4' },
  ],
  PERF_STATUS_STATION_SHORT: {
    station_1_done: 'St 1',
    station_2_done: 'St 2',
    station_3_done: 'St 3',
    station_4_done: 'St 4',
  },
  adminState: {
    assignments: [venkata, jashit, narendra, unfinished],
    teams: [
      { id: 't-vm', name: 'Venkata x Muhammad', primaryIds: ['Venkata-tw', 'Muhammad-tw'] },
      { id: 't-ja', name: 'Jashit x Amy', primaryIds: ['Jashit-tw', 'Amy-tw'] },
      { id: 't-np', name: 'Narendra x Pradeepreddy', primaryIds: ['Narendra-tw', 'Pradeepreddy-tw'] },
      { id: 't-open', name: 'Open example', primaryIds: ['open-a@example.test', 'open-b@example.test'] },
    ],
    perfSessionStateRows: [],
    _perfSSOk: false,
  },
  isPastAssignmentSessionEnd: () => true,
  assignmentInPerfLiveWindow: () => false,
  assignmentPerfSessionStarted: () => false,
  getLatestStatusForAssignment: () => null,
  isScenarioDoneForStation: (sc) => !!(sc && (sc.status === 'Uploaded' || sc.status === 'Skipped')),
  isScenarioComplete: (sc) => !!(sc && sc.status === 'Uploaded'),
  statusOrderIdx: (s) => ({
    office_checkin: 0, arrived: 1,
    station_1_done: 5, station_2_done: 6, station_3_done: 7, station_4_done: 8,
    session_done: 9, office_checkout: 10,
  }[String(s || '').toLowerCase()] ?? -1),
  resolveAssignmentBookingYmd: (id) => {
    const hit = ctx.adminState.assignments.find(a => String(a.id) === String(id));
    return hit ? hit.date : '';
  },
  assignmentIdsMatch: (a, b) => String(a || '') === String(b || ''),
  sessionStateRowsForAssignment: (id, rows) => (rows || []).filter(r => String(r.assignmentId || '') === String(id)),
  parseSessionStateJson: (r) => {
    try {
      return typeof r.stateJson === 'string' ? JSON.parse(r.stateJson || '{}') : (r.stateJson || {});
    } catch (_) { return {}; }
  },
  isGeoPresenceOrRemoteSessionStateRow: () => false,
  sessionStateStampOnOrAfterBooking: () => true,
  scrubSessionStateProgressToBooking: (parsed) => parsed,
  mergeStationMapsPreferRicher: (dst, srcMap) => Object.assign({}, dst || {}, srcMap || {}),
  getTeamBackupIds: (t) => (t && t.backupIds) || [],
  modStrikeCheckpointDaysForBooking: () => ['2026-10-07'],
  modStrikeCheckpointIsSkipped: () => false,
  modStrikeCheckpointIsResolved: () => false,
  modStrikeAutoStrikeClearsIncompleteAlert: () => false,
  assignmentIsOdSoftClose: () => false,
  perfAssignmentHasRecentGeoActivity: () => false,
};
vm.createContext(ctx);

[
  'stripHtmlTagsToPlainText',
  'assignmentCommentPlainForMarker',
  'assignmentCommentIsModCancel',
  'sessionStateRowSaysCancelled',
  'assignmentSessionStateSaysCancelled',
  'assignmentSameModCancelSlot',
  'assignmentRowHasDirectModCancel',
  'assignmentListsForModCancelSlot',
  'assignmentSlotHasModCancel',
  'assignmentLiveSiblingHasModCancel',
  'perfBookingFactKey',
  'perfAssignmentIsTeamCancelled',
  'perfSettledBookingsMap',
  'perfNoteSettledBooking',
  'perfSettledBookingKind',
  'perfClearSettledBooking',
  'perfSettledStatusAwaitingSessionState',
  'perfAssignmentHasHappypathRows',
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
  'isAssignmentSkipOrResolvedForFlagged',
  'classifyBookingForPerf',
  'perfLiveStatusDisplay',
  'isAssignmentFlaggedForPerf',
].forEach(name => vm.runInContext(extractFn(name), ctx));

assert('before SessionState loads, a finished Booked night is not Incomplete',
  ctx.classifyBookingForPerf(venkata) === 'scheduled'
  && ctx.perfLiveStatusDisplay(venkata).label !== 'Incomplete'
  && ctx.isAssignmentFlaggedForPerf(venkata) === false);
assert('before SessionState loads, a checklist cancel echo is not Flagged',
  ctx.classifyBookingForPerf(narendra) === 'scheduled'
  && ctx.isAssignmentFlaggedForPerf(narendra) === false);

ctx.adminState.perfSessionStateRows = venkataRows.concat(jashitRows, narendraRows);
ctx.adminState._perfSSOk = true;

assert('Venkata x Muhammad stays Completed when every station is uploaded',
  ctx.classifyBookingForPerf(venkata) === 'completed'
  && ctx.perfLiveStatusDisplay(venkata).label === 'Completed'
  && ctx.isAssignmentFlaggedForPerf(venkata) === false);
assert('Jashit x Amy stays Completed on station 4',
  ctx.classifyBookingForPerf(jashit) === 'completed'
  && ctx.perfLiveStatusDisplay(jashit).label === 'Completed'
  && ctx.isAssignmentFlaggedForPerf(jashit) === false);
assert('Narendra x Pradeepreddy stays Cancelled with no strike flag',
  ctx.classifyBookingForPerf(narendra) == null
  && ctx.perfLiveStatusDisplay(narendra).label === 'Cancelled'
  && ctx.isAssignmentFlaggedForPerf(narendra) === false);

ctx.adminState.perfSessionStateRows = [];
assert('dropping SessionState does not turn Completed into Incomplete',
  ctx.classifyBookingForPerf(venkata) === 'completed'
  && ctx.classifyBookingForPerf(jashit) === 'completed'
  && ctx.perfLiveStatusDisplay(venkata).label === 'Completed'
  && ctx.isAssignmentFlaggedForPerf(venkata) === false
  && ctx.isAssignmentFlaggedForPerf(jashit) === false);
assert('dropping SessionState does not turn checklist Cancelled into Incomplete',
  ctx.classifyBookingForPerf(narendra) == null
  && ctx.perfLiveStatusDisplay(narendra).label === 'Cancelled'
  && ctx.isAssignmentFlaggedForPerf(narendra) === false);

assert('a night that never finished is still Incomplete after SessionState loads',
  ctx.classifyBookingForPerf(unfinished) === 'incomplete'
  && ctx.perfLiveStatusDisplay(unfinished).label === 'Incomplete'
  && ctx.isAssignmentFlaggedForPerf(unfinished) === true);

ctx.modStrikeAutoStrikeClearsIncompleteAlert = () => true;
assert('after 9 AM an already auto-struck team stays off Flagged',
  ctx.isAssignmentFlaggedForPerf(unfinished) === false);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll passed');
