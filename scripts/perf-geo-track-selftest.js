#!/usr/bin/env node
/* Self-test: Performance tab geo / arrival track helpers (v1.3.091626p). */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'twilight.js'), 'utf8');
const begin = src.indexOf('function classifyBookingForPerf(a)');
const end = src.indexOf('function perfDateRangeOptions()');
if (begin < 0 || end < 0 || end <= begin) {
  console.error('Could not locate Performance geo helpers in twilight.js');
  process.exit(1);
}

const fenceBegin = src.indexOf('/* FENCE_UNLOCK_BEGIN */');
const fenceEnd = src.indexOf('/* FENCE_UNLOCK_END */');
const geoBegin = src.indexOf('function lastGeoFromSessionRow(r, parsed)');
const geoEnd = src.indexOf('/* MOD_GEO_TRACK_END */');

const ctx = {
  console,
  Date,
  Number,
  adminState: {
    perfSessionStateRows: [{
      assignmentId: 'asgn_1',
      orbitLoginId: 'david-tw',
      lastActive: new Date().toISOString(),
      assignmentAddress: '123 Main St',
      assignmentLat: 47.6446,
      assignmentLng: -122.1370,
      stateJson: JSON.stringify({
        lastGeo: { lat: 47.6446, lng: -122.1370, at: Date.now(), name: 'David' },
      }),
    }],
    assignments: [{ id: 'asgn_1', address: '123 Main St', modSnapshots: [{ orbitLoginId: 'david-tw' }] }],
    moderators: [{ orbitLoginId: 'david-tw', firstName: 'David' }],
  },
  GEOFENCE_HOME_RADIUS_M: 200,
  GEO_PING_STALE_MS: 15 * 60 * 1000,
  lastGeoPingAtMs: function (g) {
    if (!g || g.at == null) return 0;
    const n = Number(g.at);
    return Number.isFinite(n) ? n : Date.parse(g.at) || 0;
  },
  parseLastActiveMs: v => Date.parse(v) || 0,
  assignmentFenceAddress: asgn => String((asgn && asgn.address) || '').trim(),
  loadGeocodeCache: () => (ctx._geoCache || {}),
  saveGeocodeCache: cache => { ctx._geoCache = cache; },
  haversineMeters: (aLat, aLng, bLat, bLng) => {
    const toRad = d => d * Math.PI / 180;
    const R = 6371000;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const s = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  },
  getModeratorDisplayName: id => id === 'david-tw' ? 'David' : id,
  getLatestStatusForAssignment: () => null,
  statusOrderIdx: s => ({ arrived: 5, office_checkin: 4, station_1_done: 6 }[s] ?? -1),
  escapeHTML: s => String(s),
  parseYMD: ymd => {
    const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  },
  startOfWeek: d => {
    const x = new Date(d);
    const day = x.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
  },
  loadGeoPings: () => ({}),
  getTeamBackupIds: () => [],
};
vm.createContext(ctx);
vm.runInContext(src.slice(fenceBegin, fenceEnd + '/* FENCE_UNLOCK_END */'.length), ctx);
vm.runInContext(src.slice(geoBegin, geoEnd), ctx);
vm.runInContext(src.slice(begin, end), ctx);

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

console.log('Performance geo track self-test');

const asgn = { id: 'asgn_1', address: '123 Main St' };
const inside = ctx.perfGeoTrackDisplay(asgn);
assert('inside fence shows At assigned address', inside && inside.key === 'ataddress', JSON.stringify(inside));

ctx.getLatestStatusForAssignment = () => ({
  status: 'arrived',
  moderatorName: 'David',
  timestamp: '2026-09-16T18:05:00.000Z',
});
const arrived = ctx.perfGeoTrackDisplay(asgn);
assert('arrived status shows confirmation from app', arrived && arrived.key === 'arrived', JSON.stringify(arrived));

ctx.getLatestStatusForAssignment = () => null;
const todayYmd = new Date();
todayYmd.setHours(0, 0, 0, 0);
const todayStr = todayYmd.getFullYear() + '-'
  + String(todayYmd.getMonth() + 1).padStart(2, '0') + '-'
  + String(todayYmd.getDate()).padStart(2, '0');
const todayAsgn = { id: 'asgn_today', status: 'Booked', date: todayStr, address: '123 Main St' };
ctx.adminState.perfSessionStateRows = [{
  assignmentId: 'asgn_today',
  orbitLoginId: 'david-tw',
  lastActive: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  assignmentAddress: '123 Main St',
  assignmentLat: 47.6446,
  assignmentLng: -122.1370,
  stateJson: JSON.stringify({
    lastGeo: { lat: 47.6446, lng: -122.1370, at: Date.now() - 30 * 60 * 1000 },
  }),
}];
assert('recent geo on today booking classifies Live', ctx.classifyBookingForPerf(todayAsgn) === 'inprogress');
assert('recent geo shows Live tracking label', ctx.perfLiveStatusDisplay(todayAsgn).label.indexOf('Live') >= 0);

const staleAsgn = Object.assign({}, todayAsgn, { id: 'asgn_stale' });
ctx.adminState.perfSessionStateRows[0].assignmentId = 'asgn_stale';
ctx.adminState.perfSessionStateRows[0].stateJson = JSON.stringify({
  lastGeo: { lat: 47.6446, lng: -122.1370, at: Date.now() - 3 * 60 * 60 * 1000 },
});
assert('geo older than 2h stays Next', ctx.classifyBookingForPerf(staleAsgn) === 'scheduled');

if (failed) {
  console.error(failed + ' perf geo track checks failed');
  process.exit(1);
}
console.log('All perf geo track checks passed');
