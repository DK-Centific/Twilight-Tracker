#!/usr/bin/env node
/* Self-test: Worklog / Arrived geofence unlock helpers. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcPath = path.join(__dirname, '..', 'twilight.js');
const src = fs.readFileSync(srcPath, 'utf8');
const begin = src.indexOf('/* FENCE_UNLOCK_BEGIN */');
const end = src.indexOf('/* FENCE_UNLOCK_END */');
if (begin < 0 || end < 0 || end <= begin) {
  console.error('Could not find FENCE_UNLOCK markers in twilight.js');
  process.exit(1);
}

const context = {
  console,
  Date,
  Number,
  GEO_PING_STALE_MS: 15 * 60 * 1000,
  GEOFENCE_HOME_RADIUS_M: 200,
  lastGeoPingAtMs: function (g) {
    if (!g || g.at == null) return 0;
    const n = Number(g.at);
    return Number.isFinite(n) ? n : Date.parse(g.at) || 0;
  },
  assignmentFenceAddress: function (asgn) {
    if (!asgn) return '';
    return String((asgn.address || (asgn.participantData && asgn.participantData.address) || '')).trim();
  },
  loadGeocodeCache: function () { return context._geoCache || {}; },
  haversineMeters: function (aLat, aLng, bLat, bLng) {
    const toRad = d => d * Math.PI / 180;
    const R = 6371000;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  },
};
vm.createContext(context);
vm.runInContext(src.slice(begin, end + '/* FENCE_UNLOCK_END */'.length), context);

const {
  lastGeoIsFreshEnough,
  liveLocationInsideAssignmentFence,
  isWorklogUnlockedByGeofence,
  isArrivedControlUnlocked,
} = context;

let failed = 0;
function assert(name, cond) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name);
  }
}

console.log('Fence unlock self-test');

const now = Date.now();
assert('fresh lastGeo is fresh', lastGeoIsFreshEnough({ at: now }, 15 * 60 * 1000));
assert('stale lastGeo is not fresh', !lastGeoIsFreshEnough({ at: now - 40 * 60 * 1000 }, 15 * 60 * 1000));

assert('no assignment stays locked', liveLocationInsideAssignmentFence(null, { lat: 1, lng: 2, at: now }).reason === 'noassignment');
assert('no address is treated as inside (legacy skip)', liveLocationInsideAssignmentFence({ id: 'a' }, { lat: 1, lng: 2, at: now }).inside === true);

const asgn = { id: 'a', address: '123 Main St' };
assert('missing geocode stays locked', liveLocationInsideAssignmentFence(asgn, { lat: 47.6, lng: -122.3, at: now }).reason === 'nogeocode');

context._geoCache = { '123 main st': { lat: 47.6446, lng: -122.1370 } };
const insidePos = { lat: 47.6446, lng: -122.1370, at: now };
const farPos = { lat: 47.6062, lng: -122.3321, at: now };
assert('inside fence unlocks worklog', isWorklogUnlockedByGeofence(asgn, insidePos) === true);
assert('outside fence keeps worklog locked', isWorklogUnlockedByGeofence(asgn, farPos) === false);
assert('unknown location keeps worklog locked', isWorklogUnlockedByGeofence(asgn, null) === false);
assert('arrived needs booked session + fence', isArrivedControlUnlocked(asgn, insidePos) === true);
assert('arrived stays locked without session', isArrivedControlUnlocked(null, insidePos) === false);

if (failed) {
  console.error(failed + ' fence unlock checks failed');
  process.exit(1);
}
console.log('All fence unlock checks passed');
