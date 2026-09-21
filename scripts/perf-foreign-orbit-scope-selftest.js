#!/usr/bin/env node
'use strict';

/**
 * Team-scope contracts (1.3.091821c)
 *
 * Fixture: Rohith × Venkata · od_d6b16c91-fe8a-4a5f-8ffe-cbaa153c8e27
 * List 169 Rohith-tw / 170 Venkata-tw · orphan SS 439 Narendra-tw
 * lastActive 2026-09-21T00:00:00Z (= Sep 20 5:00 PM PT).
 *
 * Arrival truth: Venkata lastGeo.at / sessionCompletedAt (~Sep 21 2:48 AM PT).
 * Client must not label Arrival or LATEST UPDATE as Narendra.
 *
 * Contracts:
 *   WD-TEAM-SS-FILTER
 *   WD-SS-WRITE-MEMBERSHIP
 *   WD-SOFTMERGE-NO-FOREIGN
 *   WD-ARRIVAL-ATTRIBUTION
 *   WD-FLAG-TEAM-COMPLETE
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

console.log('Foreign-orbit team-scope self-test (1.3.091821c)');

assert('APP_VERSION 1.3.091821c',
  /const APP_VERSION = '1\.3\.091821c'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091821c'));

assert('WD-TEAM-SS-FILTER named', /WD-TEAM-SS-FILTER/.test(src));
assert('WD-SS-WRITE-MEMBERSHIP named', /WD-SS-WRITE-MEMBERSHIP/.test(src));
assert('WD-SOFTMERGE-NO-FOREIGN named', /WD-SOFTMERGE-NO-FOREIGN/.test(src));
assert('WD-ARRIVAL-ATTRIBUTION named', /WD-ARRIVAL-ATTRIBUTION/.test(src));
assert('WD-FLAG-TEAM-COMPLETE named', /WD-FLAG-TEAM-COMPLETE/.test(src));

assert('booked-only default on sessionStateRowsForAssignment',
  /function sessionStateRowsForAssignment\(asgnId, rows, opts\)/.test(src)
  && /bookedOnly === false/.test(src)
  && /sessionStateRowIsAuthoritativeForAssignment/.test(src));

assert('write membership rejects foreign orbit',
  /function operatorMayWriteAssignmentSession/.test(src)
  && /Master Admin excepted/.test(src)
  && /foreign_assignment/.test(src));

assert('Done detail hides not-on-team badge',
  !/⚠ not on team/.test(src)
  && /Foreign orbits are dropped before attribution/.test(src));

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

const AID = 'od_d6b16c91-fe8a-4a5f-8ffe-cbaa153c8e27';
const VENKATA_GEO_AT = Date.parse('2026-09-21T09:48:00.000Z'); // Sep 21 2:48 AM PT

const asgn = {
  id: AID,
  teamId: null,
  date: '2026-09-20',
  status: 'Booked',
  startMin: 20 * 60,
  endMin: 3 * 60,
  teamName: 'Rohith × Venkata',
  participantData: { firstName: 'Danica' },
  modSnapshots: [
    { orbitLoginId: 'Rohith-tw' },
    { orbitLoginId: 'Venkata-tw' },
  ],
};

const ss439 = {
  id: 439,
  sessionStateId: 'ss_' + AID + '_narendratw',
  orbitLoginId: 'Narendra-tw',
  assignmentId: AID,
  lastActive: '2026-09-21T00:00:00.000Z',
  sessionStatus: 'arrived',
  stateJson: JSON.stringify({
    sessionStatus: 'arrived',
    arrivedAt: '2026-09-20T18:00:00.000Z',
    lastGeo: { lat: 47.6, lng: -122.1, at: Date.parse('2026-09-20T18:00:00.000Z'), name: 'Narendra Palanati' },
    participantName: 'Danica',
  }),
};

const ss477 = {
  id: 477,
  sessionStateId: 'ss_' + AID + '_rohithtw',
  orbitLoginId: 'Rohith-tw',
  assignmentId: AID,
  lastActive: '2026-09-21T03:00:00.000Z',
  sessionStatus: 'session_done',
  sessionCompletedAt: '2026-09-21T03:00:00.000Z',
  stateJson: JSON.stringify({
    sessionStatus: 'session_done',
    sessionCompletedAt: '2026-09-21T03:00:00.000Z',
    arrivedAt: '2026-09-21T04:10:00.000Z',
  }),
};

const ss479 = {
  id: 479,
  sessionStateId: 'ss_' + AID + '_venkatatw',
  orbitLoginId: 'Venkata-tw',
  assignmentId: AID,
  lastActive: '2026-09-21T03:10:00.000Z',
  sessionStatus: 'session_done',
  sessionCompletedAt: '2026-09-21T09:48:00.000Z',
  stateJson: JSON.stringify({
    sessionStatus: 'session_done',
    sessionCompletedAt: '2026-09-21T09:48:00.000Z',
    arrivedAt: '2026-09-21T09:48:00.000Z',
    lastGeo: { lat: 47.65, lng: -122.14, at: VENKATA_GEO_AT, name: 'Venkata' },
  }),
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
  _derivedStatusCache: { sourceRef: null, byAsgnId: {} },
  adminState: {
    assignments: [asgn],
    teams: [],
    perfSessionStateRows: [ss439, ss477, ss479],
  },
  state: { username: 'Narendra-tw', isMasterAdmin: false, lastGeo: { lat: 47.6, lng: -122.1 } },
  STATIONS: [
    { key: 'station1' }, { key: 'station2' }, { key: 'station3' }, { key: 'station4' },
  ],
  assignmentIdsMatch: (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase(),
  parseLastActiveMs: (v) => {
    const t = Date.parse(v);
    return isNaN(t) ? 0 : t;
  },
  lastGeoPingAtMs: (g) => {
    if (!g || g.at == null) return 0;
    const n = Number(g.at);
    if (Number.isFinite(n) && n > 1e11) return n;
    return Date.parse(g.at) || (Number.isFinite(n) ? n : 0);
  },
  parseSessionStateJson: (r) => {
    try {
      return typeof r.stateJson === 'string' ? JSON.parse(r.stateJson || '{}') : (r.stateJson || {});
    } catch (_) { return {}; }
  },
  isGeoPresenceOrRemoteSessionStateRow: (r) => {
    const id = String((r && (r.sessionStateId || r.assignmentId)) || '');
    return id.indexOf('geo_presence_') >= 0 || id.indexOf('asgn_remote_') >= 0;
  },
  getModeratorDisplayName: (id) => {
    const s = String(id || '');
    if (/narendra/i.test(s)) return 'Narendra Palanati';
    if (/venkata/i.test(s)) return 'Venkata';
    if (/rohith/i.test(s)) return 'Rohith';
    return s.replace(/-tw$/i, '');
  },
  getTeamBackupIds: () => [],
  isMasterAdminUser: (name) => {
    const id = String(name == null ? (ctx.state && ctx.state.username) : name || '').toLowerCase();
    return id === 'david-tw' || !!(ctx.state && ctx.state.isMasterAdmin && id === 'david-tw');
  },
  statusOrderIdx: (s) => ({
    office_checkin: 0, arrived: 1,
    station_1_done: 5, station_2_done: 6, station_3_done: 7, station_4_done: 8,
    session_done: 9, office_checkout: 10,
  }[s] ?? -1),
  isScenarioDoneForStation: () => false,
  resolveAssignmentBookingYmd: () => '2026-09-20',
  scrubSessionStateProgressToBooking: (parsed) => parsed,
  sessionStateStampOnOrAfterBooking: () => true,
  firstStationCompletedStamp: (map, keys) => {
    if (!map) return null;
    for (const k of keys) if (map[k]) return map[k];
    return null;
  },
  loadWorklogCache: () => [],
};

const fns = [
  'assignmentOrbitKey',
  'lookupAssignmentForScope',
  'assignmentBookedOrbitLoginIds',
  'sessionStateRowOrbitId',
  'sessionStateRowIsAuthoritativeForAssignment',
  'isAssignmentScopedSessionWrite',
  'operatorMayWriteAssignmentSession',
  'resolveAssignmentArrivalAttribution',
  'sessionStateRowMatchesAssignment',
  'sessionStateRowsForAssignment',
  'sessionStateStatusHint',
  'sessionStateCompletionStamp',
  'sessionStateHasStation4Stamp',
  'sessionStateAllStationsHappypath',
  'sessionStateParsedIsHappypathComplete',
  'assignmentSessionStateRowsForHappypath',
  'isAssignmentTeamHappypathComplete',
  'deriveLatestStatusFromSessionState',
  'getLatestStatusForAssignment',
  'perfGeoTrackDisplay',
];

vm.createContext(ctx);
let extractedOk = true;
for (const name of fns) {
  try {
    vm.runInContext(extractFn(name), ctx);
  } catch (e) {
    extractedOk = false;
    assert('extract ' + name, false, String(e && e.message || e));
  }
}
if (extractedOk) assert('extract team-scope helpers', true);

const booked = ctx.assignmentBookedOrbitLoginIds(asgn);
assert('booked set is Rohith + Venkata only',
  booked.has('rohith-tw') && booked.has('venkata-tw') && !booked.has('narendra-tw')
  && booked.size === 2);

assert('WD-TEAM-SS-FILTER drops SS 439',
  ctx.sessionStateRowsForAssignment(AID, [ss439, ss477, ss479]).every(r =>
    String(r.orbitLoginId).toLowerCase() !== 'narendra-tw')
  && ctx.sessionStateRowsForAssignment(AID, [ss439, ss477, ss479]).length === 2);

assert('audit bookedOnly:false still sees orphan',
  ctx.sessionStateRowsForAssignment(AID, [ss439, ss477, ss479], { bookedOnly: false })
    .some(r => String(r.orbitLoginId).toLowerCase() === 'narendra-tw'));

const live = ctx.deriveLatestStatusFromSessionState(AID) || {};
assert('LATEST UPDATE is booked co-mod (not Narendra)',
  /^(rohith-tw|venkata-tw)$/i.test(String(live.moderatorId || ''))
  && !/narendra/i.test(String(live.moderatorId || ''))
  && !/narendra/i.test(String(live.moderatorName || '')),
  JSON.stringify({ moderatorId: live.moderatorId, moderatorName: live.moderatorName }));

assert('WD-FLAG-TEAM-COMPLETE still session_done',
  live.status === 'session_done'
  && ctx.isAssignmentTeamHappypathComplete(asgn) === true);

const arrival = ctx.resolveAssignmentArrivalAttribution(asgn, [ss439, ss477, ss479]);
assert('WD-ARRIVAL-ATTRIBUTION actor is Venkata',
  arrival
  && /venkata/i.test(String(arrival.orbitId || ''))
  && !/narendra/i.test(String(arrival.orbitId || ''))
  && !/narendra/i.test(String(arrival.name || '')),
  JSON.stringify(arrival));

assert('Arrival time is Venkata lastGeo/arrivedAt (2:48 AM PT), not orphan 5 PM',
  arrival && arrival.atMs === VENKATA_GEO_AT);

ctx.adminState.perfSessionStateRows = [ss439, ss477, ss479];
const track = ctx.perfGeoTrackDisplay(asgn);
assert('Arrival pill names Venkata, not Narendra',
  track && track.key === 'arrived'
  && /venkata/i.test(String(track.detail || ''))
  && !/narendra/i.test(String(track.detail || '')),
  JSON.stringify(track));

assert('WD-SS-WRITE-MEMBERSHIP rejects Narendra on this aid',
  ctx.operatorMayWriteAssignmentSession(asgn, 'Narendra-tw') === false);

assert('booked Rohith may write',
  ctx.operatorMayWriteAssignmentSession(asgn, 'Rohith-tw') === true);
assert('booked Venkata may write',
  ctx.operatorMayWriteAssignmentSession(asgn, 'Venkata-tw') === true);

ctx.state.username = 'david-tw';
ctx.state.isMasterAdmin = true;
assert('WD-SS-WRITE-MEMBERSHIP Master Admin excepted',
  ctx.operatorMayWriteAssignmentSession(asgn, 'david-tw') === true);
ctx.state.username = 'Narendra-tw';
ctx.state.isMasterAdmin = false;

assert('geo_presence write still allowed',
  ctx.operatorMayWriteAssignmentSession({
    id: 'geo_presence_Narendra-tw_2026-09-21',
    _geoPresenceOnly: true,
  }, 'Narendra-tw') === true);

const happypathRows = ctx.assignmentSessionStateRowsForHappypath(asgn);
assert('WD-SOFTMERGE-NO-FOREIGN happypath ignores orphan',
  happypathRows.every(r => String(r.orbitLoginId).toLowerCase() !== 'narendra-tw')
  && happypathRows.length === 2);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
