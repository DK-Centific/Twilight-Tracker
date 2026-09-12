#!/usr/bin/env node
/* Self-test: moderator location tracking helpers.
 * Extracts the MOD_GEO_TRACK block from twilight.js so a stale Sept 9
 * lastGeo cannot block a newer GPS write.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcPath = path.join(__dirname, '..', 'twilight.js');
const src = fs.readFileSync(srcPath, 'utf8');
const begin = src.indexOf('/* MOD_GEO_TRACK_BEGIN */');
const end = src.indexOf('/* MOD_GEO_TRACK_END */');
if (begin < 0 || end < 0 || end <= begin) {
  console.error('Could not find MOD_GEO_TRACK markers in twilight.js');
  process.exit(1);
}

const context = { console };
vm.createContext(context);
vm.runInContext(src.slice(begin, end), context);

const {
  lastGeoPingAtMs,
  shouldCaptureModeratorGeo,
  resolveSessionStateWriteTarget,
  pickBestCloudLastGeo,
  shouldKeepLocalLastGeo,
} = context;

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

console.log('Moderator location tracking self-test');

const sept9 = Date.parse('2026-09-09T18:00:00.000Z');
const sept12 = Date.parse('2026-09-12T18:00:00.000Z');

assert('lastGeoPingAtMs reads epoch ms', lastGeoPingAtMs({ at: sept9 }) === sept9);
assert('lastGeoPingAtMs reads ISO', lastGeoPingAtMs({ at: '2026-09-09T18:00:00.000Z' }) === sept9);
assert('lastGeoPingAtMs ignores empty', lastGeoPingAtMs({}) === 0);

assert('Master Admin in moderator app is tracked',
  shouldCaptureModeratorGeo({
    hasProfile: true,
    isPasswordlessAdmin: false,
    appView: 'moderator',
    isAdmin: true,
    modAppVisible: true,
  }) === true);

assert('Admin shell is not tracked',
  shouldCaptureModeratorGeo({
    hasProfile: true,
    isPasswordlessAdmin: false,
    appView: 'admin',
    isAdmin: true,
    modAppVisible: false,
  }) === false);

assert('Passwordless admin is not tracked',
  shouldCaptureModeratorGeo({
    hasProfile: true,
    isPasswordlessAdmin: true,
    appView: 'moderator',
    isAdmin: true,
    modAppVisible: true,
  }) === false);

assert('Regular moderator is tracked',
  shouldCaptureModeratorGeo({
    hasProfile: true,
    isPasswordlessAdmin: false,
    appView: 'moderator',
    isAdmin: false,
    modAppVisible: true,
  }) === true);

const openWrite = resolveSessionStateWriteTarget({
  orbitLoginId: 'David-tw',
  sessionCompletedAt: null,
  openAssignmentId: 'asgn_1',
  teamId: '12',
  hasLastGeo: true,
  persistCompletion: false,
  day: '2026-09-12',
});
assert('open session writes the assignment row', openWrite && openWrite.kind === 'assignment' && openWrite.id === 'asgn_1');

const blocked = resolveSessionStateWriteTarget({
  orbitLoginId: 'David-tw',
  sessionCompletedAt: '2026-09-09T20:00:00.000Z',
  openAssignmentId: 'asgn_1',
  teamId: '12',
  hasLastGeo: true,
  persistCompletion: false,
  day: '2026-09-12',
});
assert('completed session uses presence row instead of blocking',
  blocked && blocked.kind === 'presence' && blocked.id === 'geo_presence_David-tw_2026-09-12');

const wrapup = resolveSessionStateWriteTarget({
  orbitLoginId: 'David-tw',
  sessionCompletedAt: '2026-09-12T20:00:00.000Z',
  openAssignmentId: 'asgn_1',
  teamId: '12',
  hasLastGeo: true,
  persistCompletion: true,
  day: '2026-09-12',
});
assert('wrap-up still writes the assignment row once', wrapup && wrapup.kind === 'assignment');

const oldRow = {
  orbitLoginId: 'david-tw',
  lastActive: '2026-09-12T16:00:00.000Z',
  stateJson: JSON.stringify({
    lastGeo: { lat: 47.61, lng: -122.33, at: sept9, name: 'David' },
  }),
};
const newRow = {
  orbitLoginId: 'david-tw',
  lastActive: '2026-09-12T17:00:00.000Z',
  stateJson: JSON.stringify({
    lastGeo: { lat: 47.6446, lng: -122.1370, at: sept12, name: 'David' },
  }),
};
const pickedOldFirst = pickBestCloudLastGeo([oldRow, newRow]).get('david-tw');
const pickedNewFirst = pickBestCloudLastGeo([newRow, oldRow]).get('david-tw');
assert('newer GPS wins when old Sept 9 row is first',
  pickedOldFirst && pickedOldFirst.at === sept12 && pickedOldFirst.lat === 47.6446,
  JSON.stringify(pickedOldFirst));
assert('newer GPS wins when new row is first',
  pickedNewFirst && pickedNewFirst.at === sept12 && pickedNewFirst.lat === 47.6446);

const heartbeatReuse = pickBestCloudLastGeo([
  oldRow,
  {
    orbitLoginId: 'david-tw',
    lastActive: '2026-09-12T19:00:00.000Z',
    stateJson: JSON.stringify({
      lastGeo: { lat: 47.61, lng: -122.33, at: sept9, name: 'David' },
    }),
  },
]).get('david-tw');
assert('heartbeat that reused Sept 9 coords does not look newer than the GPS fix',
  heartbeatReuse && heartbeatReuse.at === sept9 && heartbeatReuse.lat === 47.61);

assert('local newer lastGeo is kept over cloud Sept 9',
  shouldKeepLocalLastGeo({ at: sept12, lat: 47.64 }, { at: sept9, lat: 47.61 }) === true);
assert('cloud newer lastGeo replaces local Sept 9',
  shouldKeepLocalLastGeo({ at: sept9, lat: 47.61 }, { at: sept12, lat: 47.64 }) === false);

console.log(failed ? ('FAILED ' + failed + ' / ' + (passed + failed)) : ('All ' + passed + ' checks passed'));
process.exit(failed ? 1 : 0);
