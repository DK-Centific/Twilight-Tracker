#!/usr/bin/env node
'use strict';

/**
 * Overview donut vs Performance All-time Incomplete (1.3.100726c).
 *
 * The donut and the Performance Incomplete tile use the same
 * classifier. The donut was also counting bookings whose team had
 * been purged, and it counted a repeated assignment id twice.
 * Performance walks live teams and skips an id it has already seen.
 *
 * All time Incomplete is only the late Station 4 night. An arrived-only
 * past Rescheduled night is not Incomplete. A Rescheduled night the
 * team finished inside the window stays Completed. The three purged-team
 * bookings, the old co-mod orphan, and the duplicate id stay out.
 * Today uses the same booking set. This week is a different window on
 * each screen, so it is not compared here.
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

console.log('Overview donut / Performance Incomplete parity (1.3.100726c)');

assert('APP_VERSION 1.3.100726c',
  /const APP_VERSION = '1\.3\.100726c'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.100726c'));

assert('donut keeps a booking only when its team is still live',
  /function overviewAssignmentTeamIsLive/.test(src)
  && /overviewAssignmentTeamIsLive\(a\)/.test(src.slice(
    src.indexOf('function overviewAssignmentInDonutBookedScope'),
    src.indexOf('function overviewAssignmentIsIncompleteForDonut')
  )));

assert('donut skips a duplicate assignment id before it counts',
  /function forEachOverviewDonutBooking/.test(src)
  && /const seen = new Set\(\)/.test(src.slice(
    src.indexOf('function forEachOverviewDonutBooking'),
    src.indexOf('function computeOverviewDonutCounts')
  ))
  && /String\(a\.id\)/.test(src.slice(
    src.indexOf('function forEachOverviewDonutBooking'),
    src.indexOf('function computeOverviewDonutCounts')
  ))
  && /forEachOverviewDonutBooking\(filteredAsgns/.test(src));

const keepAt = src.indexOf('const localTeamSessionsKeep');
const dropFn = src.indexOf('function dropCachedTeamSessionsForMissingTeams');
const dropCall = src.indexOf('mergedAssignments = dropCachedTeamSessionsForMissingTeams(');
const teamsReady = src.indexOf('mergedTeams = mat.teams');
assert('assignment read drops cached team sessions after the team list is merged',
  dropFn > 0 && keepAt > dropFn && dropCall > keepAt && dropCall > teamsReady);

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

const LATE_ID = 'od_56991291-58d9-42ef-af2a-6f1a7ddcafee';
const ARRIVED_ID = 'od_3f751074-0fc8-4d85-9a3b-e9f16e77dc39';
const ORPHAN_IDS = [
  'asgn_1788926966277_dxlxy8',
  'asgn_1789014509536_tc4j6t',
  'asgn_1790319380654_8atmr0',
];
const COMOD_ID = 'asgn_old_comod_orphan';
const TONIGHT_ID = 'od_tonight_20261005';
const SOFT_ID = 'od_soft_close_unfinished';
const RESCHED_DONE_ID = 'od_resched_station4_done';
const EXPECT_INCOMPLETE = [LATE_ID];

const FIXED_NOW = Date.parse('2026-10-05T23:30:00.000Z');
const RealDate = Date;
class FrozenDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(FIXED_NOW);
    else super(...args);
  }
  static now() { return FIXED_NOW; }
  static parse(v) { return RealDate.parse(v); }
  static UTC(...args) { return RealDate.UTC(...args); }
}

function stationMap(n) {
  const scenarios = {};
  const uploaded = { status: 'Uploaded', notes: '', iterations: 1 };
  for (let i = 1; i <= n; i++) scenarios[String(i)] = Object.assign({}, uploaded);
  return { cameras: {}, scenarios };
}

const late = {
  id: LATE_ID,
  teamId: 100050,
  teamName: 'Venkata x Adidela',
  date: '2026-10-03',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Booked',
  odStatus: 'Scheduled',
  comment: 'od-sync-soft-close',
  participantName: 'Renyu Chen',
  modSnapshots: [{ orbitLoginId: 'Venkata-tw' }, { orbitLoginId: 'Adidela-tw' }],
};
const lateDup = Object.assign({}, late);
const arrived = {
  id: ARRIVED_ID,
  teamId: 100023,
  teamName: 'Narendra x Satya',
  date: '2026-09-23',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Rescheduled',
  odStatus: 'Rescheduled',
  comment: 'od-sync',
  modSnapshots: [{ orbitLoginId: 'Narendra-tw' }, { orbitLoginId: 'Satya-tw' }],
};
const orphanTeam01 = {
  id: ORPHAN_IDS[0],
  teamId: 409,
  teamName: 'Team 01',
  date: '2026-09-08',
  startMin: 8 * 60,
  endMin: 17 * 60,
  status: 'Booked',
  source: 'team-session',
  _excelSynced: true,
  comment: 'team-session',
  modSnapshots: [{ orbitLoginId: 'David-tw' }, { orbitLoginId: 'Lesther-tw' }],
};
const orphanBig = {
  id: ORPHAN_IDS[1],
  teamId: 100003,
  teamName: 'Muhammed X Rohith X Manoj X Isaiah X Fleming',
  date: '2026-09-09',
  startMin: 8 * 60,
  endMin: 17 * 60,
  status: 'Booked',
  source: 'team-session',
  _excelSynced: true,
  comment: 'team-session',
  modSnapshots: [
    { orbitLoginId: 'Muhammad-tw' },
    { orbitLoginId: 'Rohith-tw' },
  ],
};
const orphanCancelDemo = {
  id: ORPHAN_IDS[2],
  teamId: 200062,
  teamName: 'Cancel button demo',
  date: '2026-09-24',
  startMin: 17 * 60,
  endMin: 13 * 60,
  status: 'Booked',
  source: 'team-session',
  _excelSynced: true,
  comment: '',
  modSnapshots: [{ orbitLoginId: 'David-tw' }, { orbitLoginId: 'Ritu-tw' }],
};
const coModOrphan = {
  id: COMOD_ID,
  teamId: 100018,
  teamName: 'Venkata x Lesther',
  date: '2026-08-15',
  startMin: 8 * 60,
  endMin: 17 * 60,
  status: 'Booked',
  comment: 'old-co-mod',
  modSnapshots: [{ orbitLoginId: 'Venkata-tw' }, { orbitLoginId: 'Lesther-tw' }],
};
const tonight = {
  id: TONIGHT_ID,
  teamId: 100080,
  teamName: 'Matthew x Pradeepreddy',
  date: '2026-10-05',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Booked',
  odStatus: 'Scheduled',
  modSnapshots: [{ orbitLoginId: 'Matthew-tw' }, { orbitLoginId: 'Pradeepreddy-tw' }],
};
const reschedDone = {
  id: RESCHED_DONE_ID,
  teamId: 100023,
  teamName: 'Narendra x Satya',
  date: '2026-09-20',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Rescheduled',
  odStatus: 'Rescheduled',
  modSnapshots: [{ orbitLoginId: 'Narendra-tw' }, { orbitLoginId: 'Satya-tw' }],
};
const softClose = {
  id: SOFT_ID,
  teamId: 100050,
  teamName: 'Venkata x Adidela',
  date: '2026-09-15',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Cancelled',
  comment: 'od-sync-soft-close',
  modSnapshots: [{ orbitLoginId: 'Venkata-tw' }, { orbitLoginId: 'Adidela-tw' }],
};

const assignments = [
  late, arrived, reschedDone, orphanTeam01, orphanBig, orphanCancelDemo,
  lateDup, coModOrphan, tonight, softClose,
];

const lateBlob = {
  sessionDate: '2026-10-03',
  sessionStatus: 'station_4_done',
  progressScore: 4400,
  stationCompletedAt: {
    station2: '2026-10-04T06:00:00.000Z',
    Station2: '2026-10-04T06:00:00.000Z',
    station4: '2026-10-05T07:42:00.000Z',
    Station4: '2026-10-05T07:42:00.000Z',
  },
  stations: {
    station2: stationMap(8),
    station4: stationMap(4),
  },
};

function ssRow(partial) {
  return Object.assign({
    sessionDate: partial.sessionDate || '',
    lastActive: partial.lastActive || '2026-10-05T07:42:00.000Z',
  }, partial);
}

const ctx = {
  console,
  Date: FrozenDate,
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
    overview: { teamId: 'all', moderatorId: 'all', timeScope: 'all' },
    perfView: 'teams',
    perfDateRange: 'all',
    perfStatusScope: 'all',
    assignments: assignments,
    teams: [
      { id: 100050, name: 'Venkata x Adidela', primaryIds: ['Venkata-tw', 'Adidela-tw'], backupIds: [] },
      { id: 100023, name: 'Narendra x Satya', primaryIds: ['Narendra-tw', 'Satya-tw'], backupIds: [] },
      { id: 100080, name: 'Matthew x Pradeepreddy', primaryIds: ['Matthew-tw', 'Pradeepreddy-tw'], backupIds: [] },
    ],
    moderators: [],
    participants: [],
    perfSessionStateRows: [
      ssRow({
        id: 599,
        orbitLoginId: 'Venkata-tw',
        assignmentId: LATE_ID,
        sessionDate: '2026-10-03',
        sessionStatus: 'station_4_done',
        stateJson: JSON.stringify(lateBlob),
      }),
      ssRow({
        id: 600,
        orbitLoginId: 'Adidela-tw',
        assignmentId: LATE_ID,
        sessionDate: '2026-10-03',
        sessionStatus: '',
        lastActive: '2026-10-04T05:00:00.000Z',
        stateJson: JSON.stringify({ sessionDate: '2026-10-03', sessionStatus: '' }),
      }),
      ssRow({
        id: 701,
        orbitLoginId: 'Narendra-tw',
        assignmentId: ARRIVED_ID,
        sessionDate: '2026-09-23',
        sessionStatus: 'arrived',
        lastActive: '2026-09-24T04:10:00.000Z',
        stateJson: JSON.stringify({
          sessionDate: '2026-09-23',
          sessionStatus: 'arrived',
          arrivedAt: '2026-09-24T03:10:00.000Z',
        }),
      }),
      ssRow({
        id: 710,
        orbitLoginId: 'Narendra-tw',
        assignmentId: RESCHED_DONE_ID,
        sessionDate: '2026-09-20',
        sessionStatus: 'station_4_done',
        lastActive: '2026-09-21T09:30:00.000Z',
        stateJson: JSON.stringify({
          sessionDate: '2026-09-20',
          sessionStatus: 'station_4_done',
          stationCompletedAt: {
            Station4: '2026-09-21T09:30:00.000Z',
            station4: '2026-09-21T09:30:00.000Z',
          },
          stations: { station4: stationMap(4) },
        }),
      }),
      ssRow({
        id: 801,
        orbitLoginId: 'Lesther-tw',
        assignmentId: COMOD_ID,
        sessionDate: '2026-08-15',
        sessionStatus: 'arrived',
        lastActive: '2026-08-15T20:00:00.000Z',
        stateJson: JSON.stringify({
          sessionDate: '2026-08-15',
          sessionStatus: 'arrived',
          arrivedAt: '2026-08-15T18:00:00.000Z',
        }),
      }),
    ],
  },
  state: { modProfile: { orbitLoginId: 'Venkata-tw' } },
  assignmentIdsMatch: (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase(),
  assignmentPerfMaterialize: (a) => a,
  assignmentCoerceClockMin: (val, fallback) => {
    const n = Number(val);
    if (!Number.isFinite(n) || n < 0) return fallback != null ? fallback : 0;
    return n;
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
  resolveAssignmentBookingYmd: (id) => {
    const hit = (ctx.adminState.assignments || []).find(a => a && String(a.id) === String(id));
    return hit ? String(hit.date || '') : '';
  },
  getModeratorDisplayName: (id) => String(id || ''),
  mergeStationMapsPreferRicher: (dst, srcMap) => Object.assign({}, dst || {}, srcMap || {}),
  getTeamBackupIds: (t) => (t && t.backupIds) || [],
  loadWorklogCache: () => [],
  perfTeamBookingCandidates: (teamId) => (ctx.adminState.assignments || []).filter(a =>
    a && String(a.teamId) === String(teamId)
    && a.status !== 'Cancelled' && a.status !== 'Unassigned' && a.status !== 'Completed'
  ),
  isTerminalStatus: (s) => s === 'Cancelled' || s === 'Unassigned',
  sessionStateBlobIsModCancelWipe: (p) => String((p && p.sessionStatus) || '').toLowerCase() === 'cancelled',
};
ctx.assignmentModalNormalizeEndMin = (startMin, endMin) => {
  const s = ctx.assignmentCoerceClockMin(startMin, 0);
  let e = ctx.assignmentCoerceClockMin(endMin, s);
  if (e <= s) e += 24 * 60;
  return e;
};

const names = [
  'pacificWallClockToMs',
  'assignmentBookingSessionStartMs',
  'assignmentBookingSessionEndMs',
  'isPastAssignmentSessionEnd',
  'getPSTDateString',
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
  'stripHtmlTagsToPlainText',
  'assignmentCommentPlainForMarker',
  'assignmentCommentIsModCancel',
  'assignmentCommentIsOdSoftClose',
  'assignmentIsOdSoftClose',
  'assignmentIsModCancelForQueue',
  'assignmentSessionStateSaysCancelled',
  'perfAssignmentIsTeamCancelled',
  'classifyBookingForPerf',
  'deriveLatestStatusFromSessionState',
  'getLatestStatusForAssignment',
  'assignmentIsDemoBooking',
  'overviewAssignmentInBookedMetricsScope',
  'overviewAssignmentIsCancelledForDonut',
  'overviewAssignmentIsCompletedForDonut',
  'overviewAssignmentTeamIsLive',
  'overviewAssignmentInDonutBookedScope',
  'overviewAssignmentIsIncompleteForDonut',
  'forEachOverviewDonutBooking',
  'computeOverviewDonutCounts',
  'overviewAssignmentIsPerfLive',
  'overviewDateRange',
  'computeOverviewModStarCounts',
  'computeOverviewMetrics',
  'ymd',
  'parseYMD',
  'startOfWeek',
  'perfBookingOverlapsPacificDay',
  'perfActiveDateRange',
  'perfDateInRange',
  'perfHistoryAssignments',
  'perfTeamHistoryBookings',
  'perfMergeTeamCancelledBookings',
  'perfTeamAssignmentsForSource',
  'perfStatusToolbarCounts',
  'teamIdIsDeleted',
  'dropCachedTeamSessionsForMissingTeams',
];

vm.createContext(ctx);
try {
  for (const name of names) {
    vm.runInContext(extractFn(name), ctx);
  }
  assert('sandbox loads production counters', true);
} catch (e) {
  assert('sandbox loads production counters', false, String(e && e.message || e));
  process.exit(1);
}

function sameIds(a, b) {
  const left = (a || []).map(String).sort();
  const right = (b || []).slice().sort();
  return left.length === right.length && left.every((id, i) => id === right[i]);
}

function asgnStartMs(a) {
  if (!a || !a.date) return 0;
  const parts = String(a.date).split('-').map(Number);
  const sm = a.startMin || 0;
  return new ctx.Date(parts[0], parts[1] - 1, parts[2], Math.floor(sm / 60), sm % 60).getTime();
}

function overviewScoped(scope) {
  ctx.adminState.overview.timeScope = scope;
  const startEnd = ctx.overviewDateRange(scope);
  const startMs = startEnd[0];
  const endMs = startEnd[1];
  const inDateRange = (ms) => (startMs === null) || (ms >= startMs && ms <= endMs);
  return ctx.adminState.assignments.filter(a => {
    if (scope === 'day') return ctx.perfBookingOverlapsPacificDay(a);
    return inDateRange(asgnStartMs(a));
  });
}

function donutSliceIds(list) {
  const out = { completed: [], cancelled: [], incomplete: [], open: [] };
  ctx.forEachOverviewDonutBooking(list, (a, key) => {
    if (ctx.overviewAssignmentIsCancelledForDonut(a)) out.cancelled.push(key);
    else if (ctx.overviewAssignmentIsCompletedForDonut(a)) out.completed.push(key);
    else if (ctx.overviewAssignmentIsIncompleteForDonut(a)) out.incomplete.push(key);
    else out.open.push(key);
  });
  Object.keys(out).forEach(k => out[k].sort());
  return out;
}

function perfIncompleteIds() {
  const dateRange = ctx.perfActiveDateRange();
  const seen = new Set();
  const ids = [];
  (ctx.adminState.teams || []).forEach(t => {
    const list = ctx.perfTeamAssignmentsForSource(t.id, 'history', { dateFirst: true });
    list.forEach(a => {
      if (!a || !a.id) return;
      if (!ctx.perfDateInRange(a, dateRange)) return;
      if (ctx.classifyBookingForPerf(a) !== 'incomplete') return;
      if (seen.has(a.id)) return;
      seen.add(a.id);
      ids.push(String(a.id));
    });
  });
  ids.sort();
  return ids;
}

assert('demo check still misses the purged team bookings',
  ORPHAN_IDS.every(id => {
    const row = assignments.find(a => a.id === id);
    return ctx.assignmentIsDemoBooking(row) === false;
  }));

assert('late Station 4 stays Incomplete',
  ctx.classifyBookingForPerf(late) === 'incomplete',
  ctx.classifyBookingForPerf(late));
assert('arrived-only past Rescheduled is not Incomplete',
  ctx.classifyBookingForPerf(arrived) == null,
  ctx.classifyBookingForPerf(arrived));
assert('odStatus Rescheduled alone is not Incomplete',
  ctx.classifyBookingForPerf(Object.assign({}, arrived, {
    id: 'od_status_booked_od_resched',
    status: 'Booked',
    odStatus: 'Rescheduled',
  })) == null);
assert('finished Rescheduled still counts as Completed',
  ctx.classifyBookingForPerf(reschedDone) === 'completed',
  ctx.classifyBookingForPerf(reschedDone));
assert('tonight is not Incomplete',
  ctx.classifyBookingForPerf(tonight) !== 'incomplete',
  ctx.classifyBookingForPerf(tonight));
assert('unfinished soft-close is not Incomplete',
  ctx.classifyBookingForPerf(softClose) == null);

ctx.adminState.overview.timeScope = 'all';
ctx.adminState.perfDateRange = 'all';
const allSlices = donutSliceIds(overviewScoped('all'));
const allMetrics = ctx.computeOverviewMetrics();
const allPerfIds = perfIncompleteIds();
const allPerfCounts = ctx.perfStatusToolbarCounts();

assert('All time donut Incomplete is only the late Station 4 night',
  sameIds(allSlices.incomplete, EXPECT_INCOMPLETE),
  allSlices.incomplete.join(','));
assert('All time donut Incomplete count is 1',
  allMetrics.incompleteCount === 1 && allSlices.incomplete.length === 1,
  'metrics=' + allMetrics.incompleteCount + ' ids=' + allSlices.incomplete.join(','));
assert('All time Performance Incomplete ids match the donut',
  sameIds(allPerfIds, allSlices.incomplete) && allPerfCounts.incomplete === 1,
  'perf=' + allPerfIds.join(',') + ' count=' + allPerfCounts.incomplete);
assert('duplicate id is stored twice and counted once',
  assignments.filter(a => a.id === LATE_ID).length === 2
  && allSlices.incomplete.filter(id => id === LATE_ID).length === 1
  && allPerfIds.filter(id => id === LATE_ID).length === 1);
assert('purged-team bookings and the old co-mod orphan are outside every donut slice',
  ORPHAN_IDS.concat([COMOD_ID]).every(id =>
    allSlices.incomplete.indexOf(id) < 0
    && allSlices.completed.indexOf(id) < 0
    && allSlices.cancelled.indexOf(id) < 0
    && allSlices.open.indexOf(id) < 0
    && allPerfIds.indexOf(id) < 0
  ));
assert('All time Open is tonight, Cancelled includes the unfinished Rescheduled night, and the finished Rescheduled night is Completed',
  sameIds(allSlices.open, [TONIGHT_ID])
  && sameIds(allSlices.cancelled, [ARRIVED_ID, SOFT_ID])
  && sameIds(allSlices.completed, [RESCHED_DONE_ID])
  && allMetrics.openCount === 1
  && allMetrics.cancelledCount === 2
  && allMetrics.completedCount === 1
  && allSlices.incomplete.indexOf(ARRIVED_ID) < 0,
  JSON.stringify(allSlices));

const shared = [
  { label: 'All time', ov: 'all', perf: 'all' },
  { label: 'Today', ov: 'day', perf: 'today' },
];
shared.forEach(pair => {
  ctx.adminState.overview.timeScope = pair.ov;
  ctx.adminState.perfDateRange = pair.perf;
  const donutIds = donutSliceIds(overviewScoped(pair.ov)).incomplete;
  const metrics = ctx.computeOverviewMetrics();
  const perfIds = perfIncompleteIds();
  const perfCounts = ctx.perfStatusToolbarCounts();
  assert(pair.label + ' Incomplete ids match',
    sameIds(donutIds, perfIds) && metrics.incompleteCount === perfCounts.incomplete
      && donutIds.length === metrics.incompleteCount,
    'donut=' + donutIds.join(',') + ' perf=' + perfIds.join(',')
      + ' counts ' + metrics.incompleteCount + '/' + perfCounts.incomplete);
});

['today', 'past', 'week', 'all'].forEach(range => {
  ctx.adminState.perfDateRange = range;
  const perfIds = perfIncompleteIds();
  const subset = ctx.adminState.assignments.filter(a => ctx.perfDateInRange(a, range));
  const donutIds = donutSliceIds(subset).incomplete;
  assert('Performance ' + range + ' Incomplete matches the donut on that same date set',
    sameIds(perfIds, donutIds) && ctx.perfStatusToolbarCounts().incomplete === perfIds.length,
    'perf=' + perfIds.join(',') + ' donut=' + donutIds.join(','));
});

ctx.adminState.overview.timeScope = 'day';
ctx.adminState.perfDateRange = 'today';
const todaySlices = donutSliceIds(overviewScoped('day'));
assert('Today keeps tonight in Open and leaves Incomplete empty',
  sameIds(todaySlices.open, [TONIGHT_ID]) && todaySlices.incomplete.length === 0);

const liveTeams = ctx.adminState.teams.slice();
const kept = [orphanTeam01, orphanBig, orphanCancelDemo, {
  id: 'asgn_live_team_session',
  teamId: 100080,
  source: 'team-session',
  _excelSynced: true,
  status: 'Booked',
}];
const remoteTonight = Object.assign({}, tonight, { source: 'od-sync' });
const merged = [remoteTonight].concat(kept);
const deleted = new Set([409, '100003']);
const after = ctx.dropCachedTeamSessionsForMissingTeams(merged, kept, liveTeams, deleted);
const afterIds = after.map(a => String(a.id)).sort();
assert('cached team sessions for a gone or deleted team are dropped',
  afterIds.indexOf(ORPHAN_IDS[0]) < 0
  && afterIds.indexOf(ORPHAN_IDS[1]) < 0
  && afterIds.indexOf(ORPHAN_IDS[2]) < 0
  && afterIds.indexOf('asgn_live_team_session') >= 0
  && afterIds.indexOf(TONIGHT_ID) >= 0,
  afterIds.join(','));

const stillThere = ctx.dropCachedTeamSessionsForMissingTeams(
  [orphanTeam01],
  [orphanTeam01],
  [{ id: 409, name: 'Team 01' }],
  new Set()
);
assert('a cached team session stays when that team is still in the merged list',
  stillThere.length === 1 && stillThere[0].id === ORPHAN_IDS[0]);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll passed');
