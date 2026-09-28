#!/usr/bin/env node
'use strict';

/**
 * 9 AM auto-strike forward gate (1.3.091827b).
 * Older than yesterday is never auto-struck. Yesterday unfinished catch-up
 * runs at today's 9:00 AM PT. Skipped, resolved, and team-complete still block.
 * Today strikes after the gate and after the booked end. Tomorrow is watch-only.
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

console.log('9 AM auto-strike forward gate');

assert('version 1.3.091827b',
  /const APP_VERSION = '1\.3\.091827b'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091827b'));
assert('forward gate helpers exist',
  /function modStrikeForwardAutoStrikeEligible/.test(src)
  && /function modStrikeAssignmentMutedBySkipOrResolve/.test(src)
  && /function modStrikeCoModStatusBlocksStrike/.test(src)
  && /function modStrikeApplyForwardAutoStrikes/.test(src));

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
function getPSTDateString() { return '2026-09-26'; }
function toast() {}
function syncOverviewLiveStatusStrikeAttention() {}
function modStrikeRefreshUi() {}
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
    teams: [{ id: '200015', name: 'Narendra x Amy', primaryIds: ['Narendra-tw', 'Amy-tw'] }],
    assignments: [],
    overview: { timeScope: 'all' },
    perfDateRange: 'all',
    _perfSSOk: true,
    perfSessionStateRows: [],
  },
  state: { username: 'Admin-Twilight' },
  console: console,
  document: {
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
  },
};
vm.createContext(ctx);
vm.runInContext(block, ctx);

const TODAY = '2026-09-26';
const YESTERDAY = '2026-09-25';
const OLDER = '2026-09-24';
const TOMORROW = '2026-09-27';
const afterGate = ctx.pacificWallClockToMs(TODAY, 10 * 60);
const beforeGate = ctx.pacificWallClockToMs(TODAY, 8 * 60 + 30);

function stars() {
  return {
    n: ctx.getModStrikeStars('Narendra-tw'),
    a: ctx.getModStrikeStars('Amy-tw'),
  };
}

function reset(assignments, rows, checkpoints) {
  ctx.adminState.teams = [
    { id: '200015', name: 'Narendra x Amy', primaryIds: ['Narendra-tw', 'Amy-tw'] },
    { id: '200016', name: 'Adidela x Jashit', primaryIds: ['Adidela-tw', 'Jashit-tw'] },
  ];
  ctx.adminState.assignments = assignments || [];
  ctx.adminState._perfSSOk = true;
  ctx.adminState.perfSessionStateRows = rows || [];
  ctx.saveModStrikeStore({
    mods: {},
    checkpoints: checkpoints || {},
    version: 1,
    lastWriter: 'test',
  });
}

function booking(opts) {
  return Object.assign({
    id: '200015',
    teamId: '200015',
    assignmentId: 'od_6a8daffa',
    odScheduleId: 'od_6a8daffa',
    date: TODAY,
    status: 'Booked',
    startMin: 6 * 60,
    endMin: 8 * 60,
    modSnapshots: [{ orbitLoginId: 'Narendra-tw' }, { orbitLoginId: 'Amy-tw' }],
  }, opts || {});
}

function row(opts) {
  return Object.assign({
    id: 'ss1',
    assignmentId: 'od_6a8daffa',
    orbitLoginId: 'Amy-tw',
    sessionStatus: 'station_2_done',
    sessionDate: TODAY,
    stateJson: '{}',
  }, opts || {});
}

const past = booking({ date: YESTERDAY, id: '200015' });
const older = booking({
  id: 'ancient',
  date: OLDER,
  assignmentId: 'od_ancient',
  odScheduleId: 'od_ancient',
});
const todayEarly = booking({ date: TODAY });
const todayLate = booking({ date: TODAY, startMin: 18 * 60, endMin: 21 * 60 });
const tomorrow = booking({ id: 'fut', date: TOMORROW, assignmentId: 'od_future', odScheduleId: 'od_future' });

assert('sessionDate before yesterday is not eligible',
  ctx.modStrikeForwardAutoStrikeEligible(older, afterGate) === false);
assert('yesterday before the 9 AM gate is not eligible',
  ctx.modStrikeForwardAutoStrikeEligible(past, beforeGate) === false);
assert('yesterday after the 9 AM gate is eligible',
  ctx.modStrikeForwardAutoStrikeEligible(past, afterGate) === true);
assert('today before the 9 AM gate is not eligible',
  ctx.modStrikeForwardAutoStrikeEligible(todayEarly, beforeGate) === false);
assert('today after the 9 AM gate is eligible',
  ctx.modStrikeForwardAutoStrikeEligible(todayEarly, afterGate) === true);
assert('tomorrow-forward is eligible',
  ctx.modStrikeForwardAutoStrikeEligible(tomorrow, afterGate) === true
  && ctx.modStrikeForwardAutoStrikeEligible(tomorrow, beforeGate) === true);

reset([older], [row({
  assignmentId: 'od_ancient',
  sessionDate: OLDER,
  sessionStatus: 'station_2_done',
})]);
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate });
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate + 60000 });
assert('sessionDate before yesterday never auto-strikes',
  stars().n === 4 && stars().a === 4,
  JSON.stringify(stars()));

reset([past], [row({ sessionDate: YESTERDAY, sessionStatus: 'station_2_done' })]);
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: beforeGate });
assert('yesterday before 9 AM does not catch up',
  stars().n === 4 && stars().a === 4, JSON.stringify(stars()));
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate });
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate + 60000 });
assert('yesterday unfinished at today 9 AM strikes once',
  stars().n === 3 && stars().a === 3,
  JSON.stringify(stars()));

reset(
  [past],
  [row({ sessionDate: YESTERDAY, sessionStatus: 'station_2_done' })],
  { '2026-09-26': { applied: false, skippedTeams: { od_6a8daffa: true }, resolvedTeams: { od_6a8daffa: true } } }
);
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate });
assert('yesterday skipped/resolved does not catch up',
  stars().n === 4 && stars().a === 4, JSON.stringify(stars()));

reset([past], [row({ sessionDate: YESTERDAY, sessionStatus: 'station_4_done' })]);
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate });
assert('yesterday team-complete does not catch up',
  stars().n === 4 && stars().a === 4, JSON.stringify(stars()));

const healedIds = [
  'od_6a8daffa',
  'od_cf455467',
  'od_3f751074',
  'od_d6b16c91',
  'od_0eb4f98f',
  'od_2e9f20e3',
];
const skipped = {};
const resolved = {};
healedIds.forEach(id => { skipped[id] = true; resolved[id] = true; });
reset(
  [booking({
    id: '200015',
    date: TODAY,
    assignmentId: 'od_6a8daffa',
    odScheduleId: 'od_6a8daffa',
  })],
  [row({ sessionStatus: 'station_2_done' })],
  { '2026-09-26': { applied: false, skippedTeams: skipped, resolvedTeams: resolved } }
);
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate });
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate + 60000 });
assert('skipped/resolved assignment id never re-strikes',
  stars().n === 4 && stars().a === 4,
  JSON.stringify(stars()));

function blockCase(label, rowPatch) {
  reset(
    [booking({ id: 'done-' + label, assignmentId: 'od_' + label, odScheduleId: 'od_' + label })],
    [row(Object.assign({
      assignmentId: 'od_' + label,
      sessionDate: TODAY,
    }, rowPatch))]
  );
  ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate });
  assert(label + ' blocks the auto-strike', stars().n === 4 && stars().a === 4, JSON.stringify(stars()));
}

blockCase('station_4_done', { sessionStatus: 'station_4_done' });
blockCase('session_done', { sessionStatus: 'session_done' });
blockCase('sessionCompletedAt', {
  sessionStatus: 'station_3_done',
  sessionCompletedAt: '2026-09-26T15:00:00.000Z',
});

reset(
  [booking()],
  [row({
    sessionStatus: 'station_4_done',
    sessionDate: YESTERDAY,
    stateJson: JSON.stringify({ sessionStatus: 'station_4_done', sessionDate: YESTERDAY }),
  })]
);
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate });
assert('prior-day station_4_done does not block tonight and does not strike that old row',
  stars().n === 3 && stars().a === 3,
  JSON.stringify(stars()));

reset([todayEarly], [row({ sessionStatus: 'station_2_done' })]);
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: beforeGate });
assert('today before the 9 AM gate does not strike',
  stars().n === 4 && stars().a === 4, JSON.stringify(stars()));

reset([todayLate], [row({ sessionStatus: 'station_1_done', sessionDate: TODAY })]);
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate });
assert('today after the gate but before the booked end does not strike',
  stars().n === 4 && stars().a === 4, JSON.stringify(stars()));

reset([todayEarly], [row({ sessionStatus: 'station_2_done' })]);
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate });
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate + 5 * 60 * 1000 });
assert('today after the gate and after the booked end strikes once each',
  stars().n === 3 && stars().a === 3, JSON.stringify(stars()));

reset([
  booking({ id: 'row-a', teamId: '200015' }),
  booking({ id: 'row-b', teamId: '200016', assignmentId: 'od_6a8daffa', odScheduleId: 'od_6a8daffa' }),
], [
  row({ assignmentId: 'od_6a8daffa', orbitLoginId: 'Narendra-tw', sessionStatus: 'station_2_done' }),
  row({ id: 'ss2', assignmentId: 'row-b', orbitLoginId: 'Amy-tw', sessionStatus: 'station_2_done' }),
]);
ctx.adminState.teams = [
  { id: '200015', name: 'Narendra x Amy', primaryIds: ['Narendra-tw', 'Amy-tw'] },
  { id: '200016', name: 'Narendra x Amy', primaryIds: ['Amy-tw', 'Narendra-tw'] },
];
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate });
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate + 10000 });
assert('two co-mod rows are one strike per moderator',
  stars().n === 3 && stars().a === 3, JSON.stringify(stars()));

reset([tomorrow], []);
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate });
assert('tomorrow-forward does not lose a star early',
  stars().n === 4 && stars().a === 4, JSON.stringify(stars()));

reset([booking({ status: 'Cancelled', comment: 'mod-cancel-session:Narendra-tw:2026-09-26T14:00:00Z' })], []);
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate });
assert('cancelled session does not strike',
  stars().n === 4 && stars().a === 4, JSON.stringify(stars()));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
