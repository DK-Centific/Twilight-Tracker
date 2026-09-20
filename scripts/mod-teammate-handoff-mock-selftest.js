#!/usr/bin/env node
/* Mock walkthrough: Moderator A → Moderator B handoff on one team session. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcPath = path.join(__dirname, '..', 'twilight.js');
const src = fs.readFileSync(srcPath, 'utf8');

function sliceFn(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let depth = 0;
  let i = src.indexOf('{', start);
  for (; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('unclosed ' + name);
}

const STATIONS = [
  { key: 'station1', label: 'Station 1' },
  { key: 'station2', label: 'Station 2' },
  { key: 'station3', label: 'Station 3' },
  { key: 'station4', label: 'Station 4' },
];

const ctx = {
  console,
  Date,
  STATIONS,
  state: null,
  adminState: { teams: [], assignments: [], perfSessionStateRows: [], _lastTeammateLiveAt: null },
  saveState() {},
  flushSessionStateSync() {},
  getActiveOperatorAssignment() {
    return { id: 'asgn_team1_today', teamId: 7, date: '2026-09-17' };
  },
  getOperatorAssignment() {
    return ctx.getActiveOperatorAssignment();
  },
  getPSTDateString() { return '2026-09-17'; },
  statusOrderIdx(s) {
    const order = ['office_checkin', 'arrived', 'station_1_done', 'station_2_done', 'station_3_done', 'station_4_done', 'session_done', 'office_checkout'];
    const i = order.indexOf(s);
    return i >= 0 ? i : -1;
  },
  deriveLatestStatusFromSessionState() { return null; },
  loadWorklogCache() { return []; },
  isScenarioDoneForStation(sc) {
    return sc && (sc.status === 'Uploaded' || (sc.status === 'Skipped' && String(sc.notes || '').trim()));
  },
  isScenarioComplete(sc) {
    return ctx.isScenarioDoneForStation(sc);
  },
  normalizeCalRigFlags(sc) {
    return { rig1: !!(sc && sc.rig1Completed), rig2: !!(sc && sc.rig2Completed) };
  },
};

vm.createContext(ctx);
[
  'scenarioProgressRank',
  'pickBetterScenario',
  'sessionStateProgressScore',
  'extractSyncableState',
  'mergeTeammateState',
  'isCalGuideAcknowledged',
  'parseLastActiveMs',
  'isStaleSessionStateWrite',
  'assignmentTeamSessionComplete',
  'isSessionLocked',
  'getMyLatestStatusForAssignment',
].forEach((name) => {
  vm.runInContext(sliceFn(name), ctx);
});

const {
  extractSyncableState,
  mergeTeammateState,
  sessionStateProgressScore,
  isCalGuideAcknowledged,
  isStaleSessionStateWrite,
  pickBetterScenario,
  isSessionLocked,
} = ctx;

let failed = 0;
function assert(name, cond) {
  if (cond) console.log('  ok  ' + name);
  else { failed++; console.error('  FAIL  ' + name); }
}

function defaultModState(orbitId) {
  return {
    modProfile: { orbitLoginId: orbitId },
    username: orbitId,
    theme: 'dark',
    participantId: '',
    participantName: '',
    participantAddress: '',
    sessionDate: '2026-09-17',
    equipment: {},
    stations: {},
    stationCompletedAt: {},
    arrivedAt: '',
    calGuideAck: null,
    recordLakituUrl: '',
    _progressScore: 0,
  };
}

console.log('Moderator A → B handoff mock walkthrough');

const modA = defaultModState('mod-a');
modA.participantId = 'participant-99';
modA.arrivedAt = '2026-09-17T10:05:00.000Z';
modA.calGuideAck = { acknowledgedAt: '2026-09-17T10:06:00.000Z', acknowledgedBy: 'mod-a' };
modA.stations = {
  station1: {
    cameras: { cam1: true },
    scenarios: {
      '1': { status: 'Uploaded', notes: '', iterations: 1 },
      '2': { status: 'Partially Recorded', notes: 'rain', iterations: 1 },
    },
  },
};
const cloud = extractSyncableState(modA);

const modB = defaultModState('mod-b');
ctx.state = modB;
mergeTeammateState(cloud);

assert('B inherits cal guide ack', isCalGuideAcknowledged());
assert('B inherits station progress', !!(modB.stations.station1 && modB.stations.station1.scenarios['1']));
assert('B inherits arrival', !!modB.arrivedAt);

modB.stations.station1.scenarios['2'] = { status: 'Uploaded', notes: '', iterations: 2 };
const merged = pickBetterScenario(
  modB.stations.station1.scenarios['2'],
  { status: 'Partially Recorded', notes: 'rain', iterations: 1 }
);
assert('re-merge keeps B Uploaded scenario', merged.status === 'Uploaded' && merged.iterations >= 2);

const staleCloud = { sessionDate: '2026-09-16' };
const oldAt = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();
assert('prior-day row stale after 6h', isStaleSessionStateWrite(oldAt, staleCloud));
assert('same-day row not stale at 7h', !isStaleSessionStateWrite(oldAt, { sessionDate: '2026-09-17' }));

modB.sessionCompletedAt = '2026-09-17T18:00:00.000Z';
ctx.state = modB;
assert('team completion locks session', isSessionLocked({ id: 'asgn_team1_today', date: '2026-09-17' }));

assert('wrap-up comment says Station 4', /after Station 4 Submit/.test(src));
assert('APP_VERSION 1.3.091820m', /const APP_VERSION = '1\.3\.091820m'/.test(src));

console.log(failed ? '\n' + failed + ' failed' : '\nAll handoff mock checks passed');
process.exit(failed ? 1 : 0);
