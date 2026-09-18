#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'twilight.js'), 'utf8');
const begin = src.indexOf('function assignmentIdsMatch(a, b)');
const end = src.indexOf('function buildAssignmentTeamMap()');
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
};
vm.createContext(ctx);
vm.runInContext(src.slice(lakituBegin, lakituEnd), ctx);
vm.runInContext(src.slice(validateBegin, validateEnd + 200), ctx);
vm.runInContext(src.slice(begin, end), ctx);

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

ctx.adminState.perfSessionStateRows = rows;
assert('pick Lakitu from record + participantId', ctx.pickLakituUrlFromSessionStateParsed(JSON.parse(rows[0].stateJson)) === lakitu);

assert('validate strict session URL', ctx.validateLakituUrl(lakitu) === 'ok');
assert('review URL transform', ctx.lakituReviewUrl(lakitu).includes('/review?session='));

if (failed) {
  console.error(failed + ' perf SessionState checks failed');
  process.exit(1);
}
console.log('All perf SessionState checks passed');
