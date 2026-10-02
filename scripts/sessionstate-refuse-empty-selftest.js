#!/usr/bin/env node
'use strict';

/**
 * SessionState refuse-empty / refuse-regressive write barrier (1.3.100226j).
 * An empty Not-Started shell must not overwrite a richer row for the same
 * assignment. Mirrors the Venkata app_close and Manoj app_resume wipes.
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
  const asyncAt = start - 'async '.length;
  const from = (asyncAt >= 0 && src.slice(asyncAt, start) === 'async ') ? asyncAt : start;
  let i = from;
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
  return src.slice(from, i);
}

console.log('SessionState refuse-empty shell (1.3.100226j)');

assert('APP_VERSION 1.3.100226j',
  /const APP_VERSION = '1\.3\.100226j'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.100226j'));

const flushSrc = extractFn('flushSessionStateSync');
const beaconSrc = extractFn('sendSessionStateBeacon');
const lifeSrc = extractFn('postSessionStateLifecycleUpdate');
const directSrc = extractFn('postSessionStatePayloadDirect');
const prepareSrc = extractFn('sessionStatePrepareGuardedPayload');
assert('flush asks the barrier before the cloud post',
  flushSrc.includes('sessionStatePrepareGuardedPayload')
  && flushSrc.indexOf('sessionStatePrepareGuardedPayload') < flushSrc.indexOf('fetchWithRetry(SESSIONSTATE_PA_WRITE_URL'));
assert('close beacon asks the barrier before sendBeacon',
  beaconSrc.includes('sessionStateRegressiveWriteDecision')
  && beaconSrc.indexOf('sessionStateRegressiveWriteDecision') < beaconSrc.indexOf('navigator.sendBeacon'));
assert('logout lifecycle asks the barrier before fetch',
  lifeSrc.includes('sessionStatePrepareGuardedPayload')
  && lifeSrc.indexOf('sessionStatePrepareGuardedPayload') < lifeSrc.indexOf('keepalive: true'));
assert('direct SessionState post asks the barrier',
  directSrc.includes('sessionStateRegressiveWriteDecision')
  && directSrc.indexOf('sessionStateRegressiveWriteDecision') < directSrc.indexOf('fetchWithRetry(SESSIONSTATE_PA_WRITE_URL'));
assert('app resume merges a richer cloud row before the write',
  prepareSrc.includes("why === 'app_resume'")
  && prepareSrc.includes('applySelfSyncReplace'));
assert('poll remembers the self row used as a baseline',
  extractFn('findSelfSessionStateUpdate').includes('rememberSessionStatePolledSelf'));
assert('confirmed Reset is the menu reset and start-new-session',
  src.includes('resetOperatorSessionState({ preserveEquipment: false, confirmedReset: true })')
  && src.includes('resetOperatorSessionState({ preserveEquipment: true, confirmedReset: true })'));
assert('end-of-day reset is not a confirmed cloud wipe',
  extractFn('finishSessionForDay').includes('resetOperatorSessionState({ preserveEquipment: false })')
  && extractFn('finishSessionForDay').indexOf('confirmedReset') < 0);
assert('strike refuse-empty-mods is unchanged',
  extractFn('persistModeratorStrikesSetting').includes('refuse-empty-mods'));
assert('refusing an empty location write stays quiet',
  extractFn('isSilentGeoSaveReason').includes('refuse-regressive')
  && extractFn('isSilentGeoSaveReason').includes('refuse-empty-beacon')
  && extractFn('isSilentGeoSaveReason').includes('refuse-empty-resume'));

const ASGN = 'od_faa1bfb8-28aa-4360-964b-036eb9a2b33a';
const ctx = {
  console,
  Date,
  JSON,
  state: {
    _progressScore: 0,
    _lastSeenActiveAsgnId: ASGN,
    modProfile: { orbitLoginId: 'venkatatw' },
  },
  _sessionStateSyncState: {
    lastSyncedAsgnId: null,
    lastSyncedStateJson: null,
    lastPolledSelfAsgnId: null,
    lastPolledSelfSessionStateId: null,
    lastPolledSelfStateJson: null,
  },
  _sessionStateConfirmedResetUntil: 0,
  adminState: { perfSessionStateRows: [] },
  STATIONS: [
    { key: 'station1' },
    { key: 'station2' },
    { key: 'station3' },
    { key: 'station4' },
  ],
  sessionStateRowMatchesAssignment: (r, id) => String(r && r.assignmentId || '') === String(id || ''),
  SESSIONSTATE_REAL_PROGRESS_SCORE: 100,
};
vm.createContext(ctx);

const names = [
  'sessionStateProgressScore',
  'sessionStateBlobIsModCancelWipe',
  'sessionStateParseBlob',
  'sessionStateComputedProgressScore',
  'sessionStateHasStationCompletion',
  'sessionStateStationsAllNotStarted',
  'sessionStateStatusIsEmptyOrArrivedOnly',
  'sessionStateIsEmptyOrRegressiveShell',
  'sessionStateBaselineHasRealProgress',
  'sessionStateBaselineScore',
  'rememberSessionStatePolledSelf',
  'sessionStateRememberSelfFromRows',
  'sessionStateSelfRowFromCache',
  'resolveSessionStateLastGoodBaseline',
  'sessionStateRegressiveWriteDecision',
];
names.forEach(name => {
  vm.runInContext(extractFn(name), ctx);
});

function shell(extra) {
  return Object.assign({
    participantId: 'https://lakitu.example/p/venkata',
    sessionStatus: '',
    arrivedAt: '',
    sessionCompletedAt: null,
    stationCompletedAt: {},
    stations: {
      station1: { scenarios: { 1: { status: 'Not Started', notes: '', iterations: 0 } } },
      station2: { scenarios: { 1: { status: 'Not Started', notes: '', iterations: 0 } } },
      station3: { scenarios: { 1: { status: 'Not Started', notes: '', iterations: 0 } } },
      station4: { scenarios: { 1: { status: 'Not Started', notes: '', iterations: 0 } } },
    },
  }, extra || {});
}

function richBlob() {
  const stations = {};
  ['station1', 'station2', 'station3', 'station4'].forEach(key => {
    const scenarios = {};
    for (let n = 1; n <= 8; n++) {
      scenarios[n] = { status: 'Uploaded', notes: 'done', iterations: 1 };
    }
    stations[key] = { scenarios: scenarios };
  });
  return {
    participantId: 'https://lakitu.example/p/venkata',
    sessionStatus: 'station_2_done',
    arrivedAt: '2026-10-02T04:00:00.000Z',
    stationCompletedAt: {
      station1: '2026-10-02T05:00:00.000Z',
      station2: '2026-10-02T06:17:01.000Z',
    },
    stations: stations,
    progressScore: 5321,
  };
}

function resetBaseline() {
  ctx._sessionStateSyncState.lastSyncedAsgnId = null;
  ctx._sessionStateSyncState.lastSyncedStateJson = null;
  ctx._sessionStateSyncState.lastPolledSelfAsgnId = null;
  ctx._sessionStateSyncState.lastPolledSelfSessionStateId = null;
  ctx._sessionStateSyncState.lastPolledSelfStateJson = null;
  ctx.adminState.perfSessionStateRows = [];
  ctx.state._progressScore = 0;
  ctx.state._lastSeenActiveAsgnId = ASGN;
}

const empty = shell();
const rich = richBlob();
const emptyScore = ctx.sessionStateComputedProgressScore(empty);
const richScore = ctx.sessionStateBaselineScore(rich);
assert('empty shell score is the Lakitu-only bump', emptyScore === 1, String(emptyScore));
assert('rich blob scores as real progress', richScore >= 100, String(richScore));
assert('empty shell is regressive', ctx.sessionStateIsEmptyOrRegressiveShell(empty) === true);
assert('rich blob is not an empty shell', ctx.sessionStateIsEmptyOrRegressiveShell(rich) === false);

resetBaseline();
ctx._sessionStateSyncState.lastSyncedAsgnId = ASGN;
ctx._sessionStateSyncState.lastSyncedStateJson = JSON.stringify(rich);
const venkata = ctx.sessionStateRegressiveWriteDecision(empty, ASGN, { syncReason: 'app_close' });
assert('Venkata app_close empty shell vs last good write is refused',
  venkata.refuse === true && venkata.reason === 'refuse-regressive' && venkata.baselineSource === 'lastSynced',
  JSON.stringify(venkata));

resetBaseline();
ctx.rememberSessionStatePolledSelf(ASGN, rich, 'ss_' + ASGN + '_manojtw');
const manoj = ctx.sessionStateRegressiveWriteDecision(shell({ progressAt: '2026-10-01T00:09:05.000Z' }), ASGN, {
  syncReason: 'app_resume',
  sessionStateId: 'ss_' + ASGN + '_manojtw',
});
assert('Manoj app_resume empty shell vs polled self row is refused',
  manoj.refuse === true && manoj.reason === 'refuse-regressive' && manoj.baselineSource === 'polledSelf',
  JSON.stringify(manoj));

resetBaseline();
ctx._sessionStateSyncState.lastSyncedAsgnId = ASGN;
ctx._sessionStateSyncState.lastSyncedStateJson = JSON.stringify(shell());
ctx.rememberSessionStatePolledSelf(ASGN, rich, 'ss_' + ASGN + '_venkatatw');
const staleEmptySync = ctx.sessionStateRegressiveWriteDecision(empty, ASGN, { syncReason: '' });
assert('an empty last write does not hide a richer polled row',
  staleEmptySync.refuse === true && staleEmptySync.baselineSource === 'polledSelf',
  JSON.stringify(staleEmptySync));

resetBaseline();
ctx.state._progressScore = 5321;
const peak = ctx.sessionStateRegressiveWriteDecision(empty, ASGN, {
  memoryPeakScore: 5321,
  memoryPeakAsgnId: ASGN,
});
assert('in-memory peak blocks an empty overwrite',
  peak.refuse === true && peak.baselineSource === 'memoryPeak',
  JSON.stringify(peak));

resetBaseline();
ctx._sessionStateSyncState.lastSyncedAsgnId = 'other-booking';
ctx._sessionStateSyncState.lastSyncedStateJson = JSON.stringify(rich);
const otherBooking = ctx.sessionStateRegressiveWriteDecision(empty, ASGN, { syncReason: '' });
assert('a different assignment is not the baseline',
  otherBooking.refuse === false && otherBooking.reason === 'no-rich-baseline',
  JSON.stringify(otherBooking));

resetBaseline();
ctx.rememberSessionStatePolledSelf(ASGN, shell(), 'ss_' + ASGN + '_venkatatw');
const cloudEmpty = ctx.sessionStateRegressiveWriteDecision(empty, ASGN, { syncReason: '' });
assert('empty cloud baseline allows a first empty write',
  cloudEmpty.refuse === false && cloudEmpty.reason === 'cloud-empty',
  JSON.stringify(cloudEmpty));

resetBaseline();
const arrived = shell({ sessionStatus: 'arrived', arrivedAt: '2026-10-02T04:00:00.000Z' });
ctx._sessionStateSyncState.lastSyncedAsgnId = ASGN;
ctx._sessionStateSyncState.lastSyncedStateJson = JSON.stringify(rich);
const arrivedOverRich = ctx.sessionStateRegressiveWriteDecision(arrived, ASGN, { syncReason: '' });
assert('arrived-only shell does not overwrite station progress',
  ctx.sessionStateIsEmptyOrRegressiveShell(arrived) === true
  && arrivedOverRich.refuse === true,
  JSON.stringify(arrivedOverRich));

resetBaseline();
const partial = shell({
  stations: {
    station1: { scenarios: { 1: { status: 'Partially Recorded', notes: '', iterations: 1 } } },
  },
});
ctx._sessionStateSyncState.lastSyncedAsgnId = ASGN;
ctx._sessionStateSyncState.lastSyncedStateJson = JSON.stringify(rich);
const partialWrite = ctx.sessionStateRegressiveWriteDecision(partial, ASGN, { syncReason: '' });
assert('partial station work is not treated as an empty shell',
  ctx.sessionStateIsEmptyOrRegressiveShell(partial) === false
  && partialWrite.refuse === false && partialWrite.reason === 'not-empty-shell',
  JSON.stringify(partialWrite));

resetBaseline();
ctx._sessionStateSyncState.lastSyncedAsgnId = ASGN;
ctx._sessionStateSyncState.lastSyncedStateJson = JSON.stringify(rich);
const progressWrite = ctx.sessionStateRegressiveWriteDecision(rich, ASGN, { syncReason: '' });
assert('a richer local write is allowed',
  progressWrite.refuse === false && progressWrite.reason === 'not-empty-shell');

resetBaseline();
ctx._sessionStateSyncState.lastSyncedAsgnId = ASGN;
ctx._sessionStateSyncState.lastSyncedStateJson = JSON.stringify(rich);
const cancelBlob = {
  sessionStatus: 'Cancelled',
  checklistCleared: true,
  stations: {},
  stationCompletedAt: {},
  cancelComment: 'mod-cancel-session:venkatatw:2026-10-02T07:00:00.000Z',
  progressScore: 0,
};
const cancelWrite = ctx.sessionStateRegressiveWriteDecision(cancelBlob, ASGN, { syncReason: 'direct' });
assert('moderator Cancel may clear the checklist',
  cancelWrite.refuse === false && cancelWrite.reason === 'mod-cancel',
  JSON.stringify(cancelWrite));

resetBaseline();
ctx._sessionStateSyncState.lastSyncedAsgnId = ASGN;
ctx._sessionStateSyncState.lastSyncedStateJson = JSON.stringify(rich);
const resetWrite = ctx.sessionStateRegressiveWriteDecision(empty, ASGN, { confirmedReset: true, syncReason: '' });
assert('confirmed Reset may clear',
  resetWrite.refuse === false && resetWrite.reason === 'confirmed-reset');
const healWrite = ctx.sessionStateRegressiveWriteDecision(empty, ASGN, { adminHealForce: true, syncReason: '' });
assert('Admin heal force may clear',
  healWrite.refuse === false && healWrite.reason === 'admin-heal');

resetBaseline();
const closeUnknown = ctx.sessionStateRegressiveWriteDecision(empty, ASGN, { syncReason: 'app_close' });
assert('app_close skips an empty beacon when cloud progress is unknown',
  closeUnknown.refuse === true && closeUnknown.reason === 'refuse-empty-beacon',
  JSON.stringify(closeUnknown));
ctx.rememberSessionStatePolledSelf(ASGN, shell(), 'ss_' + ASGN + '_venkatatw');
const closeKnownEmpty = ctx.sessionStateRegressiveWriteDecision(empty, ASGN, { syncReason: 'app_close' });
assert('app_close may post when the cloud row is also empty',
  closeKnownEmpty.refuse === false && closeKnownEmpty.reason === 'cloud-empty',
  JSON.stringify(closeKnownEmpty));

resetBaseline();
const resumeUnknown = ctx.sessionStateRegressiveWriteDecision(empty, ASGN, { syncReason: 'app_resume' });
assert('app_resume does not write empty when the cloud row was not read',
  resumeUnknown.refuse === true && resumeUnknown.reason === 'refuse-empty-resume',
  JSON.stringify(resumeUnknown));

resetBaseline();
ctx.adminState.perfSessionStateRows = [{
  assignmentId: ASGN,
  orbitLoginId: 'venkatatw',
  sessionStateId: 'ss_' + ASGN + '_venkatatw',
  stateJson: JSON.stringify(rich),
}];
const fromCache = ctx.sessionStateRegressiveWriteDecision(empty, ASGN, {
  syncReason: '',
  orbitLoginId: 'venkatatw',
});
assert('cached self row for this assignment blocks the empty write',
  fromCache.refuse === true && (fromCache.baselineSource === 'cachedSelf' || fromCache.baselineSource === 'polledSelf'),
  JSON.stringify(fromCache));

resetBaseline();
ctx.adminState.perfSessionStateRows = [{
  assignmentId: ASGN,
  orbitLoginId: 'manojtw',
  sessionStateId: 'ss_' + ASGN + '_manojtw',
  stateJson: JSON.stringify(rich),
}];
const teammateOnly = ctx.sessionStateRegressiveWriteDecision(empty, ASGN, {
  syncReason: '',
  orbitLoginId: 'venkatatw',
});
assert('a teammate row is not this browser baseline',
  teammateOnly.refuse === false,
  JSON.stringify(teammateOnly));

if (failed) {
  console.log(failed + ' failed');
  process.exit(1);
}
console.log('all passed');
