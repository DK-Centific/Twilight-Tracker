#!/usr/bin/env node
'use strict';

/**
 * 9 AM auto-strike team-complete gate (1.3.100426b).
 * Completed, soft-close Completed, and either co-mod's finish
 * (happypath / station_4_done / session_done / sessionCompletedAt)
 * must not take a star. An unfinished overnight still can, once.
 * Skip+Resolve still blocks. No star restore.
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

console.log('9 AM team-complete gate');

assert('version 1.3.100426b',
  /const APP_VERSION = '1\.3\.100426b'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.100426b'));
assert('gate uses happypath helper and soft-close sibling',
  /function modStrikeCoModSessionDateOk/.test(src)
  && /sessionStateCountsAsTeamComplete/.test(src.slice(src.indexOf('function modStrikeCoModStatusBlocksStrike')))
  && /assignmentIsOdSoftClose/.test(src.slice(src.indexOf('function modStrikeCrewNightAlreadyComplete'), src.indexOf('function modStrikeAttemptAutoStrike'))));
assert('no one-time star restore in the strike gate',
  src.indexOf('function maybeRunModStrikeNineAmCheckpoint') > 0
  && !/restoreStars|STAR_RESTORE|oneTimeStar/.test(src.slice(
    src.indexOf('function modStrikeCoModSessionDateOk'),
    src.indexOf('function stampModStrikeCheckpointOccurrence')
  )));

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
function assignmentCommentPlainForMarker(comment) {
  return String(comment == null ? '' : comment).replace(/<[^>]+>/g, ' ').trim();
}
function assignmentCommentIsOdSoftClose(comment) {
  return assignmentCommentPlainForMarker(comment).indexOf('od-sync-soft-close') >= 0;
}
function assignmentIsOdSoftClose(a) {
  if (!a) return false;
  if (String(a.status || '') !== 'Cancelled') return false;
  return assignmentCommentIsOdSoftClose(a.comment);
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
  console,
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
const SOFT = 'od-sync-soft-close';
const afterGate = ctx.pacificWallClockToMs(TODAY, 10 * 60);

function stars() {
  return {
    n: ctx.getModStrikeStars('Narendra-tw'),
    a: ctx.getModStrikeStars('Amy-tw'),
  };
}

function reset(assignments, rows, checkpoints) {
  ctx.adminState.teams = [
    { id: '200015', name: 'Narendra x Amy', primaryIds: ['Narendra-tw', 'Amy-tw'] },
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
    assignmentId: 'od_team',
    odScheduleId: 'od_team',
    date: YESTERDAY,
    status: 'Booked',
    startMin: 18 * 60,
    endMin: 2 * 60,
    modSnapshots: [{ orbitLoginId: 'Narendra-tw' }, { orbitLoginId: 'Amy-tw' }],
  }, opts || {});
}

function row(opts) {
  return Object.assign({
    id: 'ss1',
    assignmentId: 'od_team',
    orbitLoginId: 'Amy-tw',
    sessionStatus: 'station_2_done',
    sessionDate: YESTERDAY,
    stateJson: '{}',
  }, opts || {});
}

function run() {
  ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate });
  ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate + 60000 });
}

reset(
  [booking({ status: 'Completed' })],
  [row({ sessionStatus: 'station_2_done' })]
);
run();
assert('Assignment Completed does not auto-strike',
  stars().n === 4 && stars().a === 4, JSON.stringify(stars()));

reset(
  [booking({ status: 'Cancelled', comment: SOFT })],
  [row({ sessionStatus: 'station_4_done', orbitLoginId: 'Amy-tw' })]
);
run();
assert('soft-close with station_4_done on one co-mod does not auto-strike',
  stars().n === 4 && stars().a === 4, JSON.stringify(stars()));
assert('that soft-close row counts as complete',
  ctx.modStrikeAssignmentEvidence(ctx.adminState.assignments[0]) === 'complete');

reset(
  [
    booking({ id: 'ghost', assignmentId: 'od_ghost', odScheduleId: 'od_ghost', status: 'Booked' }),
    booking({
      id: 'live',
      assignmentId: 'od_live',
      odScheduleId: 'od_live',
      status: 'Cancelled',
      comment: SOFT,
    }),
  ],
  [
    row({ assignmentId: 'od_live', orbitLoginId: 'Narendra-tw', sessionStatus: 'station_2_done' }),
    row({ id: 'ss-done', assignmentId: 'od_live', orbitLoginId: 'Amy-tw', sessionStatus: 'station_4_done' }),
  ]
);
run();
assert('Booked ghost does not strike when soft-close sibling is finished',
  stars().n === 4 && stars().a === 4, JSON.stringify(stars()));

reset(
  [
    booking({ id: 'open', assignmentId: 'od_open', odScheduleId: 'od_open', status: 'Booked' }),
    booking({
      id: 'soft-open',
      assignmentId: 'od_soft_open',
      odScheduleId: 'od_soft_open',
      status: 'Cancelled',
      comment: SOFT,
    }),
  ],
  [row({ assignmentId: 'od_soft_open', sessionStatus: 'station_2_done' })]
);
run();
assert('unfinished soft-close does not protect a real incomplete',
  stars().n === 3 && stars().a === 3, JSON.stringify(stars()));

reset(
  [booking()],
  [
    row({ orbitLoginId: 'Narendra-tw', sessionStatus: 'station_1_done' }),
    row({ id: 'ss-b', orbitLoginId: 'Amy-tw', sessionStatus: 'station_4_done' }),
  ]
);
run();
assert('station_4_done on either co-mod blocks the strike',
  stars().n === 4 && stars().a === 4, JSON.stringify(stars()));

reset(
  [booking()],
  [row({
    sessionStatus: 'station_3_done',
    stateJson: JSON.stringify({
      sessionDate: YESTERDAY,
      sessionStatus: 'station_3_done',
      stationCompletedAt: { Station4: '2026-09-26T07:00:00.000Z' },
    }),
  })]
);
run();
assert('Station4 stamp blocks the strike',
  stars().n === 4 && stars().a === 4, JSON.stringify(stars()));

reset([booking()], [row({ sessionStatus: 'session_done' })]);
run();
assert('session_done blocks the strike',
  stars().n === 4 && stars().a === 4, JSON.stringify(stars()));

reset(
  [booking()],
  [row({
    sessionStatus: 'station_3_done',
    sessionCompletedAt: '2026-09-26T07:10:00.000Z',
  })]
);
run();
assert('sessionCompletedAt blocks the strike',
  stars().n === 4 && stars().a === 4, JSON.stringify(stars()));

reset([booking()], [row({ sessionStatus: 'completed' })]);
run();
assert('session status Completed blocks the strike',
  stars().n === 4 && stars().a === 4, JSON.stringify(stars()));

reset(
  [booking()],
  [row({ sessionStatus: 'station_4_done', sessionDate: TODAY })]
);
run();
assert('overnight finish stamped the next morning does not strike',
  stars().n === 4 && stars().a === 4, JSON.stringify(stars()));

reset(
  [booking({ date: TODAY, startMin: 6 * 60, endMin: 8 * 60 })],
  [row({ sessionStatus: 'station_4_done', sessionDate: OLDER })]
);
run();
assert('prior-day station_4_done does not block tonight',
  stars().n === 3 && stars().a === 3, JSON.stringify(stars()));

reset([booking()], [row({ sessionStatus: 'station_2_done' })]);
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate });
assert('incomplete overnight strikes once',
  stars().n === 3 && stars().a === 3, JSON.stringify(stars()));
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate + 5 * 60 * 1000 });
assert('second pass does not double-strike',
  stars().n === 3 && stars().a === 3, JSON.stringify(stars()));

reset(
  [booking()],
  [row({ sessionStatus: 'station_2_done' })],
  { '2026-09-26': { applied: false, skippedTeams: { od_team: true }, resolvedTeams: { od_team: true } } }
);
run();
assert('Skip+Resolve still blocks the catch-up',
  stars().n === 4 && stars().a === 4, JSON.stringify(stars()));

ctx.sessionStateCountsAsTeamComplete = function () { return false; };
reset([booking()], [row({ sessionStatus: 'station_4_done' })]);
run();
assert('happypath helper rejection is not overridden by the raw status',
  stars().n === 3 && stars().a === 3, JSON.stringify(stars()));

ctx.sessionStateCountsAsTeamComplete = function () { return true; };
reset([booking()], [row({ sessionStatus: 'station_2_done' })]);
run();
assert('happypath helper complete blocks the strike',
  stars().n === 4 && stars().a === 4, JSON.stringify(stars()));
delete ctx.sessionStateCountsAsTeamComplete;

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
