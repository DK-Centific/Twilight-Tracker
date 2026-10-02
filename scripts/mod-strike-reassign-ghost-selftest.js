#!/usr/bin/env node
'use strict';

/**
 * 1.3.100226i · Venkata×Rohith Manish false strike regression.
 * - Prefer live team-complete booking over a deleted/reassigned ghost
 *   (Ryan od_4b0f085d vs Manish od_466726cb on the same crew/night).
 * - Primaries come from modSnapshots, not a wrong teamId.
 * - Sibling crew-night complete blocks auto-strike on the ghost.
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

console.log('Auto-strike reassign-ghost / team-complete picker (1.3.100226i)');

assert('version 1.3.100226i',
  /const APP_VERSION = '1\.3\.100226i'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.100226i'));
assert('teamBookingOnDateForStrike prefers complete / crew match',
  /Prefer team-complete \/ live progress over a deleted-reassign ghost/.test(src)
  && /crewMatch = hit === primarySet.size/.test(src));
assert('primaries prefer modSnapshots',
  /Prefer the booking's own co-mod snapshots/.test(src));
assert('sibling crew-night complete gate',
  /function modStrikeCrewNightAlreadyComplete/.test(src)
  && /modStrikeCrewNightAlreadyComplete\(booking\)/.test(src));

const sliceStart = src.indexOf('function ymd(d)');
const sliceEnd = src.indexOf('function fmtTimeOfDay(min)', sliceStart);
assert('strike slice found', sliceStart > 0 && sliceEnd > sliceStart);

const block = src.slice(sliceStart, sliceEnd) + `
function classifyBookingForPerf(a) {
  if (!a) return null;
  if (a.status === 'Completed') return 'completed';
  if (a.status === 'Cancelled') return 'cancelled';
  return 'scheduled';
}
function assignmentCoerceClockMin(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) ? n : (fb || 0);
}
function assignmentModalNormalizeEndMin(s, e) {
  e = assignmentCoerceClockMin(e, s);
  return e <= s ? e + 24 * 60 : e;
}
function escapeHTML(s) { return String(s); }
function getPSTDateString() { return '2026-09-28'; }
function toast() {}
function syncOverviewLiveStatusStrikeAttention() {}
function modStrikeRefreshUi() {}
function parseSessionStateJson(row) {
  if (!row) return {};
  if (row._parsed) return row._parsed;
  if (typeof row.stateJson === 'object' && row.stateJson) return row.stateJson;
  try { return JSON.parse(row.stateJson || '{}'); } catch (_) { return {}; }
}
function sessionStateRowsForAssignment(aid, all) {
  return (all || []).filter(r => r && String(r.assignmentId || '') === String(aid));
}
`;

const ctx = {
  setTimeout(fn) { if (typeof fn === 'function') fn(); return 0; },
  clearTimeout() {},
  localStorage: {
    _m: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
    setItem(k, v) { this._m[k] = String(v); },
    removeItem(k) { delete this._m[k]; },
  },
  adminState: {
    teams: [
      { id: 100035, name: 'Venkata x Rohith', primaryIds: ['Venkata-tw', 'Rohith-tw'] },
      { id: 200063, name: 'Matthew', primaryIds: ['Matthew-tw'] },
    ],
    assignments: [],
    overview: { timeScope: 'all' },
    perfSessionStateRows: [],
    _perfSSOk: true,
  },
  console,
  Date,
  Math,
  JSON,
  Number,
  String,
  Array,
  Object,
  Set,
  Map,
  Intl,
  isFinite,
  parseInt,
  parseFloat,
};

vm.createContext(ctx);
vm.runInContext(block, ctx);

const ryan = {
  id: 'od_4b0f085d-f24b-41bd-af11-d40f32f247f8',
  odScheduleId: '4b0f085d-f24b-41bd-af11-d40f32f247f8',
  teamId: 100035,
  date: '2026-09-27',
  startMin: 1140,
  endMin: 120 + 24 * 60,
  status: 'Booked',
  participantName: 'Ryan Nguyen',
  modSnapshots: [
    { orbitLoginId: 'Venkata-tw' },
    { orbitLoginId: 'Rohith-tw' },
  ],
};
const manish = {
  id: 'od_466726cb-c00b-4d39-b932-8ca0df84ea6c',
  odScheduleId: '466726cb-c00b-4d39-b932-8ca0df84ea6c',
  teamId: null, // live OD List often has null teamId after sync
  date: '2026-09-27',
  startMin: 1140,
  endMin: 120 + 24 * 60,
  status: 'Booked',
  participantName: 'Manish Sharma',
  modSnapshots: [
    { orbitLoginId: 'Venkata-tw' },
    { orbitLoginId: 'Rohith-tw' },
  ],
};

ctx.adminState.assignments = [ryan, manish];
ctx.adminState.perfSessionStateRows = [
  {
    assignmentId: manish.id,
    orbitLoginId: 'Rohith-tw',
    stateJson: JSON.stringify({
      sessionDate: '2026-09-27',
      sessionStatus: 'station_4_done',
      participantName: 'Manish Sharma',
      stationCompletedAt: { station1: 'x', station2: 'x', station3: 'x', station4: 'x' },
      stations: {
        station1: { scenarios: { a: { status: 'Uploaded' } }, done: 1, total: 1 },
        station2: { scenarios: { a: { status: 'Uploaded' } }, done: 1, total: 1 },
        station3: { scenarios: { a: { status: 'Uploaded' } }, done: 1, total: 1 },
        station4: { scenarios: { a: { status: 'Uploaded' } }, done: 1, total: 1 },
      },
    }),
  },
  {
    assignmentId: manish.id,
    orbitLoginId: 'Venkata-tw',
    stateJson: JSON.stringify({
      sessionDate: '2026-09-27',
      sessionStatus: '',
      participantName: 'Manish Sharma',
      stations: {},
    }),
  },
];

// Wire happypath helpers if present in slice; otherwise stub complete check via co-mod status.
if (typeof ctx.isAssignmentTeamHappypathComplete !== 'function') {
  ctx.isAssignmentCompleteForStrike = function (a) {
    return typeof ctx.modStrikeCoModStatusBlocksStrike === 'function'
      && ctx.modStrikeCoModStatusBlocksStrike(a);
  };
} else {
  ctx.isAssignmentCompleteForStrike = function (a) {
    return ctx.isAssignmentTeamHappypathComplete(a);
  };
}

const picked = ctx.teamBookingOnDateForStrike(100035, '2026-09-27');
assert('picker returns Manish (live) not Ryan ghost',
  picked && picked.id === manish.id,
  picked && picked.id);

assert('Manish evidence complete via co-mod station_4_done',
  ctx.modStrikeAssignmentEvidence(manish) === 'complete',
  ctx.modStrikeAssignmentEvidence(manish));

assert('Ryan ghost blocked by crew-night sibling complete',
  ctx.modStrikeCrewNightAlreadyComplete(ryan) === true);

const wrongTeamManish = Object.assign({}, manish, { teamId: 200063 });
const primaries = ctx.modStrikePrimariesForBooking(wrongTeamManish);
assert('primaries from modSnapshots even when teamId wrong',
  primaries.map(x => x.toLowerCase()).sort().join('|') === 'rohith-tw|venkata-tw',
  primaries.join(','));

const ckRow = { teamAutoStrike: {} };
const nowMs = Date.parse('2026-09-28T18:42:00.000Z'); // after 9 AM PT
const struckGhost = ctx.modStrikeAttemptAutoStrike(
  ryan,
  ['Venkata-tw', 'Rohith-tw'],
  nowMs,
  ckRow,
  'test ghost'
);
assert('auto-strike skips Ryan ghost when Manish complete', struckGhost === 0, String(struckGhost));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
