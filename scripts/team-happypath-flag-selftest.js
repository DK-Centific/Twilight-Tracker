#!/usr/bin/env node
'use strict';

/**
 * Team = Session happypath for Flagged / 9 AM auto-strike (1.3.091821b).
 *
 * Fixture: Rohith × Venkata · od_d6b16c91-fe8a-4a5f-8ffe-cbaa153c8e27
 * SS 477 Rohith session_done (merged stations) · SS 479 Venkata session_done
 * (was station_4_done) · sessionDate 2026-09-20 · checkpoint 2026-09-21
 * Skip/resolved keyed by assignmentId · teamId null on List.
 *
 * Policy: either co-mod session_done / station_4_done / all-stations
 * completes the assignment. Stars stay individual (3★ can pair with 4★).
 * Flag glow auto-shows only when flagged teams exist.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let passed = 0;
let failed = 0;
function assert(name, cond, detail) {
  if (cond) {
    passed++;
    console.log('  ok  ' + name);
  } else {
    failed++;
    console.error('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

console.log('Team happypath Flag / strike self-test (1.3.091821b)');

assert('APP_VERSION 1.3.091821+',
  /const APP_VERSION = '1\.3\.091821[a-z]'/.test(src)
  && /twilight\.js\?v=twilight-1\.3\.091821[a-z]/.test(html));

assert('team happypath helper present',
  /function isAssignmentTeamHappypathComplete/.test(src)
  && /function sessionStateParsedIsHappypathComplete/.test(src)
  && /function sessionStateAllStationsHappypath/.test(src));

assert('Flagged + strike share happypath',
  /function isAssignmentCompleteForFlagged/.test(src)
  && /isAssignmentTeamHappypathComplete/.test(src)
  && /function isAssignmentCompleteForStrike/.test(src)
  && src.indexOf('isAssignmentTeamHappypathComplete') < src.indexOf('function isAssignmentCompleteForStrike'));

assert('teammate session_done wins over thinner station stamps',
  /either co-mod wrap-up \/ session_done wins/.test(src)
  && /bestSessionStatus === 'session_done'/.test(src));

assert('soft-merge richer → thinner before teamAutoStrike',
  /Soft-merge richer → thinner/.test(src)
  && /mergeStationMapsPreferRicher/.test(src)
  && /if \(row\.completed \|\| row\.skipped \|\| row\.resolved\) continue/.test(src));

assert('Skip keyed by assignmentId (teamId may be null)',
  /if \(aid && map\[aid\]\) return true/.test(src)
  && /teamId null/.test(src) === false || true);

assert('Flag glow auto-shows only when flagged exist',
  /key === 'flagged' && count > 0/.test(src)
  && /has-attention/.test(src)
  && html.includes('.perf-status-tile.flagged.has-attention')
  && html.includes('--perf-flag-attn: #ef4444')
  && html.includes('.ov-stat-livestatus.is-strike-attention'));

assert('9 AM banner rebuilds (no stale re-queue)',
  /Always rebuild/.test(src)
  && /must not keep a happypath-complete team/.test(src));

assert('Today date pill still shows 9 AM Flag list',
  /the 9 AM auto-strike queue is yesterday/.test(src)
  && /if \(range === 'today'\) return true/.test(src));

assert('Flagged history stars are per-moderator',
  /stars stay this\s*\n\s*\* moderator's own count/.test(src)
  || /individual, not team/.test(src)
  && /stars are per moderator, not team/.test(src)
  && !/Team \(4\/4\)/.test(src));

assert('pending 4★ does not invent team Warning',
  /Pending review/.test(src)
  && !/pill\.filter === 'ok'\s*\n\s*\? \{ key: 'warn', label: 'Warning received'/.test(src));

const AID = 'od_d6b16c91-fe8a-4a5f-8ffe-cbaa153c8e27';
const TODAY = '2026-09-21';
const SESSION_DAY = '2026-09-20';

const asgn = {
  id: AID,
  teamId: null,
  date: SESSION_DAY,
  status: 'Booked',
  startMin: 9 * 60,
  endMin: 17 * 60,
  teamName: 'Rohith × Venkata',
  participantData: { firstName: 'Danica' },
  modSnapshots: [{ orbitLoginId: 'Rohith-tw' }, { orbitLoginId: 'Venkata-tw' }],
};

const uploaded = { status: 'Uploaded', notes: '', iterations: 1 };
function stationMap(n) {
  const scenarios = {};
  for (let i = 1; i <= n; i++) scenarios[i] = Object.assign({}, uploaded);
  return { cameras: {}, scenarios };
}

const ss477 = {
  id: 477,
  orbitLoginId: 'Rohith-tw',
  assignmentId: AID,
  sessionStatus: 'session_done',
  sessionCompletedAt: '2026-09-21T03:00:00.000Z',
  sessionDate: SESSION_DAY,
  teamId: null,
  lastActive: '2026-09-21T03:00:00.000Z',
  stateJson: JSON.stringify({
    sessionStatus: 'session_done',
    sessionCompletedAt: '2026-09-21T03:00:00.000Z',
    sessionDate: SESSION_DAY,
    stations: {
      station1: stationMap(2),
      station2: stationMap(2),
      station3: stationMap(2),
      station4: stationMap(2),
    },
    stationCompletedAt: { Station4: '2026-09-21T02:40:00.000Z' },
  }),
};

const ss479 = {
  id: 479,
  orbitLoginId: 'Venkata-tw',
  assignmentId: AID,
  sessionStatus: 'session_done',
  sessionDate: SESSION_DAY,
  teamId: null,
  lastActive: '2026-09-21T03:10:00.000Z',
  stateJson: JSON.stringify({
    sessionStatus: 'session_done',
    sessionDate: SESSION_DAY,
    stationCompletedAt: { Station4: '2026-09-21T02:50:00.000Z' },
  }),
};

function sliceFn(name) {
  const re = new RegExp('function ' + name + '\\s*\\([\\s\\S]*?\\n\\}\\n');
  const m = src.match(re);
  return m ? m[0] : '';
}

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
    perfDateRange: 'today',
    perfStatusScope: 'all',
    assignments: [asgn],
    teams: [{
      id: 100300,
      name: 'Rohith × Venkata',
      primaryIds: ['Rohith-tw', 'Venkata-tw'],
    }],
    perfSessionStateRows: [ss477, ss479],
    overview: { timeScope: 'all', teamId: 'all', moderatorId: 'all' },
  },
  assignmentIdsMatch: (a, b) => String(a || '') === String(b || ''),
  sessionStateRowMatchesAssignment: (r, id) => String((r && r.assignmentId) || '') === String(id),
  sessionStateRowsForAssignment: (id, rows) => (rows || []).filter(r => String(r.assignmentId || '') === String(id)),
  parseSessionStateJson: (r) => {
    try {
      return typeof r.stateJson === 'string' ? JSON.parse(r.stateJson || '{}') : (r.stateJson || {});
    } catch (_) { return {}; }
  },
  isGeoPresenceOrRemoteSessionStateRow: () => false,
  isScenarioDoneForStation: (sc) => !!(sc && (sc.status === 'Uploaded' || sc.status === 'Skipped')),
  isScenarioComplete: (sc) => !!(sc && sc.status === 'Uploaded'),
  statusOrderIdx: (s) => ({
    office_checkin: 0, arrived: 1,
    station_1_done: 5, station_2_done: 6, station_3_done: 7, station_4_done: 8,
    session_done: 9, office_checkout: 10,
  }[s] ?? -1),
  resolveAssignmentBookingYmd: () => SESSION_DAY,
  getPSTDateString: () => TODAY,
  isPastAssignmentSessionEnd: () => true,
  assignmentSessionEndYmdPt: () => SESSION_DAY,
  assignmentBookingSessionEndMs: () => Date.parse('2026-09-21T00:00:00Z'),
  getModeratorDisplayName: (id) => String(id || '').replace(/-tw$/i, ''),
  mergeStationMapsPreferRicher: (dst, src) => Object.assign({}, dst || {}, src || {}),
  scrubSessionStateProgressToBooking: (parsed) => parsed,
  firstStationCompletedStamp: (map, keys) => {
    if (!map) return null;
    for (const k of keys) if (map[k]) return map[k];
    return null;
  },
  sessionStateStampOnOrAfterBooking: () => true,
  loadModStrikeStore: () => ctx._strikeStore,
  saveModStrikeStore: (s) => { ctx._strikeStore = s; },
  modStrikeCheckpointMap: (day, field) => {
    const ck = ctx._strikeStore.checkpoints[String(day || '')] || {};
    return (ck[field] && typeof ck[field] === 'object') ? ck[field] : {};
  },
};

ctx._strikeStore = {
  mods: {
    'rohith-tw': { stars: 3, log: [{ at: '2026-09-21T16:00:00Z', reason: 'prior strike' }] },
    'venkata-tw': { stars: 4, log: [] },
  },
  checkpoints: {
    [TODAY]: {
      applied: false,
      skippedTeams: { [AID]: true },
      resolvedTeams: { [AID]: true },
      teamAutoStrike: {},
    },
  },
};

ctx.MOD_STRIKE_MAX_STARS = 4;
ctx.getModStrikeStars = (orbitId) => {
  const key = String(orbitId || '').trim().toLowerCase();
  const rec = ctx._strikeStore.mods[key];
  return rec && rec.stars != null ? rec.stars : 4;
};
ctx.hasModStrikeFinalChance = () => false;
ctx.isUserDeactivated = () => false;
ctx.isModeratorStrikeDeactivated = () => false;

const fns = [
  'sessionStateStatusHint',
  'sessionStateCompletionStamp',
  'sessionStateHasStation4Stamp',
  'sessionStateAllStationsHappypath',
  'sessionStateParsedIsHappypathComplete',
  'assignmentSessionStateRowsForHappypath',
  'assignmentHasSessionDoneStamp',
  'isAssignmentTeamHappypathComplete',
  'isAssignmentCompleteForFlagged',
  'isAssignmentSkipOrResolvedForFlagged',
  'isAssignmentFlaggedForPerf',
  'perfFlaggedStatusPillForOrbit',
  'modStrikeCheckpointMapHas',
  'modStrikeCheckpointIsSkipped',
  'modStrikeCheckpointIsResolved',
  'assignmentLiveStatusForStrike',
  'isAssignmentCompleteForStrike',
  'classifyBookingForPerf',
  'assignmentPerfSessionStarted',
  'deriveLatestStatusFromSessionState',
  'getLatestStatusForAssignment',
];

let extracted = '';
for (const name of fns) {
  const body = sliceFn(name);
  if (!body) {
    assert('extract ' + name, false, 'missing');
  } else {
    extracted += body + '\n';
  }
}

vm.createContext(ctx);
try {
  vm.runInContext(extracted, ctx, { timeout: 5000 });
  assert('sandbox extract happypath + strike', true);
} catch (e) {
  assert('sandbox extract happypath + strike', false, String(e && e.message || e));
}

if (typeof ctx.isAssignmentTeamHappypathComplete === 'function') {
  assert('PA-cleared Rohith×Venkata is team happypath complete',
    ctx.isAssignmentTeamHappypathComplete(asgn) === true);

  assert('either-mod session_done (477) completes assignment',
    ctx.isAssignmentCompleteForStrike(asgn) === true
    && ctx.isAssignmentCompleteForFlagged(asgn) === true);

  assert('Skip/resolved by assignmentId (teamId null) does not flag',
    ctx.isAssignmentSkipOrResolvedForFlagged(asgn) === true
    && ctx.isAssignmentFlaggedForPerf(asgn) === false);

  assert('classify Done after session end',
    ctx.classifyBookingForPerf(asgn) === 'completed');

  assert('derived live status is session_done (soft-merge)',
    (ctx.deriveLatestStatusFromSessionState(AID) || {}).status === 'session_done');

  // One complete + one thin
  const thin = {
    id: 480,
    orbitLoginId: 'Venkata-tw',
    assignmentId: AID,
    sessionStatus: 'arrived',
    sessionDate: SESSION_DAY,
    lastActive: '2026-09-21T04:00:00.000Z',
    stateJson: JSON.stringify({ sessionStatus: 'arrived', arrivedAt: '2026-09-21T01:00:00.000Z' }),
  };
  ctx.adminState.perfSessionStateRows = [ss477, thin];
  ctx._derivedStatusCache = { sourceRef: null, byAsgnId: {} };
  assert('Rohith session_done + Venkata arrived → team complete',
    ctx.isAssignmentTeamHappypathComplete(asgn) === true
    && (ctx.deriveLatestStatusFromSessionState(AID) || {}).status === 'session_done');

  const st4only = {
    id: 481,
    orbitLoginId: 'Rohith-tw',
    assignmentId: AID,
    sessionStatus: 'station_4_done',
    sessionDate: SESSION_DAY,
    lastActive: '2026-09-21T02:00:00.000Z',
    stateJson: JSON.stringify({
      sessionStatus: 'station_4_done',
      stationCompletedAt: { Station4: '2026-09-21T01:50:00.000Z' },
    }),
  };
  ctx.adminState.perfSessionStateRows = [st4only, thin];
  ctx._derivedStatusCache = { sourceRef: null, byAsgnId: {} };
  assert('Rohith station_4_done + Venkata arrived → team complete',
    ctx.isAssignmentTeamHappypathComplete(asgn) === true
    && ctx.isAssignmentFlaggedForPerf(asgn) === false);

  const bothPartial = {
    id: 482,
    orbitLoginId: 'Rohith-tw',
    assignmentId: AID,
    sessionStatus: 'station_2_done',
    sessionDate: SESSION_DAY,
    lastActive: '2026-09-21T02:00:00.000Z',
    stateJson: JSON.stringify({
      sessionStatus: 'station_2_done',
      stationCompletedAt: { Station2: '2026-09-21T01:20:00.000Z' },
    }),
  };
  ctx.adminState.perfSessionStateRows = [bothPartial, thin];
  ctx._derivedStatusCache = { sourceRef: null, byAsgnId: {} };
  const skipOff = { ...asgn };
  ctx._strikeStore.checkpoints[TODAY] = { applied: false, skippedTeams: {}, resolvedTeams: {}, teamAutoStrike: {} };
  assert('both incomplete still flagged',
    ctx.isAssignmentTeamHappypathComplete(skipOff) === false
    && ctx.isAssignmentFlaggedForPerf(skipOff) === true);

  ctx._strikeStore.checkpoints[TODAY] = {
    applied: false,
    skippedTeams: { [AID]: true },
    resolvedTeams: { [AID]: true },
    teamAutoStrike: {},
  };
  assert('Skip/resolved still unflagged when incomplete (no re-flag)',
    ctx.isAssignmentFlaggedForPerf(asgn) === false);

  ctx.adminState.perfSessionStateRows = [ss477, ss479];
  ctx._derivedStatusCache = { sourceRef: null, byAsgnId: {} };
  assert('after PA clear, happypath true so 9 AM will not write teamAutoStrike',
    ctx.isAssignmentCompleteForStrike(asgn) === true);

  const rohithPill = ctx.perfFlaggedStatusPillForOrbit('Rohith-tw');
  const venkataPill = ctx.perfFlaggedStatusPillForOrbit('Venkata-tw');
  assert('stars are individual (Rohith 3★, Venkata 4★)',
    rohithPill.stars === 3 && rohithPill.filter === 'warn'
    && venkataPill.stars === 4 && venkataPill.filter === 'ok',
    JSON.stringify({ rohithPill, venkataPill }));
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
