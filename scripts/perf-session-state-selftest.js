#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'twilight.js'), 'utf8');
const begin = src.indexOf('function assignmentIdsMatch(a, b)');
const end = src.indexOf('function sessionStateProgressScore(syncable)');
const lakituBegin = src.indexOf('const LAKITU_URL_RE =');
const lakituEnd = src.indexOf('const RING_DASHBOARDS = [');
const validateBegin = src.indexOf('function validateLakituUrl(url)');
const validateEnd = src.indexOf('// Centralized renderer for the Lakitu pill');

if (begin < 0 || end <= begin || lakituBegin < 0 || validateBegin < 0) {
  console.error('Could not locate perf SessionState helpers in twilight.js');
  process.exit(1);
}

const ctx = {
  console,
  Date,
  adminState: { perfSessionStateRows: [] },
  STATIONS: [{ key: 'station1' }, { key: 'station2' }],
  statusOrderIdx: s => ({
    office_checkin: 0, arrived: 1, station_1_done: 5, session_done: 9,
  }[s] ?? -1),
  isScenarioDoneForStation: () => false,
  getModeratorDisplayName: id => id,
  parseLastActiveMs: v => Date.parse(v) || 0,
  lastGeoFromSessionRow: () => null,
  JSON,
};
vm.createContext(ctx);
vm.runInContext(src.slice(lakituBegin, lakituEnd), ctx);
vm.runInContext(src.slice(validateBegin, validateEnd + 200), ctx);
vm.runInContext(src.slice(begin, end) + `
adminState.__parseCalls = 0;
var __parseOrig = parseSessionStateJson;
parseSessionStateJson = function (r) {
  adminState.__parseCalls++;
  return __parseOrig(r);
};
`, ctx);

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

console.log('Performance SessionState self-test');

const lakitu = 'https://lakitu.ring.amazon.dev/p/11111111-1111-1111-1111-111111111111?session=22222222-2222-2222-2222-222222222222';
const rows = [
  {
    sessionStateId: 'ss_asgn_x_mod-a',
    orbitLoginId: 'mod-a',
    lastActive: '2026-09-17T20:00:00.000Z',
    stateJson: JSON.stringify({
      participantId: lakitu,
      recordLakituUrl: '',
      stationCompletedAt: { station1: '2026-09-17T19:00:00.000Z' },
      arrivedAt: '2026-09-17T18:00:00.000Z',
    }),
  },
  {
    sessionStateId: 'ss_app_setting_foo',
    assignmentId: '',
    stateJson: '{}',
  },
];

assert('matches by sessionStateId prefix', ctx.sessionStateRowMatchesAssignment(rows[0], 'asgn_x'));
assert('ignores unrelated rows', !ctx.sessionStateRowMatchesAssignment(rows[1], 'asgn_x'));
assert('sessionStateRowsForAssignment count', ctx.sessionStateRowsForAssignment('asgn_x', rows).length === 1);

// Index must return the same rows, in the same order, as the matcher.
// The second pass must not JSON.parse the history again.
const mixed = [];
for (let i = 0; i < 80; i++) {
  const id = 'od_row_' + i;
  mixed.push({
    assignmentId: i % 5 === 0 ? '' : (i === 1 ? 'Od_Row_1' : id),
    sessionStateId: 'ss_' + id + '_mod' + (i % 3),
    stateJson: JSON.stringify({
      assignmentId: i % 7 === 0 ? ('json_' + i) : id,
      sessionStatus: 'arrived',
    }),
    orbitLoginId: 'mod' + (i % 3),
  });
}
mixed.push({
  assignmentId: '',
  sessionStateId: 'ss_other_thing_mod',
  stateJson: JSON.stringify({ assignmentId: 'only-json' }),
});
mixed.push({
  assignmentId: null,
  sessionStateId: 'ss_asgn_x_mod-a',
  stateJson: '{}',
});
function sameRows(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
const queries = ['od_row_1', 'Od_Row_1', 'od_row_0', 'json_0', 'json_7', 'only-json', 'asgn_x', 'asgn', 'nope', 'od'];
for (let q = 0; q < queries.length; q++) {
  const id = queries[q];
  const fast = ctx.sessionStateRowsForAssignment(id, mixed);
  const slow = mixed.filter(r => ctx.sessionStateRowMatchesAssignment(r, id));
  assert('index matches matcher · ' + id, sameRows(fast, slow),
    'fast ' + fast.length + ' slow ' + slow.length);
}
ctx.invalidateSessionStateAssignmentIndex();
ctx.adminState.__parseCalls = 0;
ctx.sessionStateRowsForAssignment('od_row_4', mixed);
const built = ctx.adminState.__parseCalls;
ctx.adminState.__parseCalls = 0;
ctx.sessionStateRowsForAssignment('od_row_8', mixed);
ctx.sessionStateRowsForAssignment('only-json', mixed);
assert('index parses the row set once', built > 0 && ctx.adminState.__parseCalls === 0,
  'build ' + built + ' later ' + ctx.adminState.__parseCalls);
assert('json-only id is findable',
  ctx.sessionStateRowsForAssignment('only-json', mixed).length === 1);
assert('blank-column sessionStateId id is findable',
  ctx.sessionStateRowsForAssignment('asgn_x', mixed).some(r => r.sessionStateId === 'ss_asgn_x_mod-a'));

ctx.adminState.perfSessionStateRows = rows;
assert('pick Lakitu from record + participantId', ctx.pickLakituUrlFromSessionStateParsed(JSON.parse(rows[0].stateJson)) === lakitu);

assert('validate strict session URL', ctx.validateLakituUrl(lakitu) === 'ok');
assert('review URL transform', ctx.lakituReviewUrl(lakitu).includes('/review?session='));

if (failed) {
  console.error(failed + ' perf SessionState checks failed');
  process.exit(1);
}
console.log('All perf SessionState checks passed');
