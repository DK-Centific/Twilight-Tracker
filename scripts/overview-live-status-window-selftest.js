#!/usr/bin/env node
'use strict';

/**
 * Overview Live status lists only teams that are Live right now (checked
 * in and inside their booked window). Last night's unfinished sessions
 * (flagged / Not completed) are not listed there; they stay on the
 * Performance Flagged tile. The status reads Checked in until a station
 * is done, then In session, and "Just checked in" only while checked in.
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

function sliceFn(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let i = start, depth = 0, begun = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') { depth++; begun = true; }
    else if (ch === '}') { depth--; if (begun && depth === 0) { i++; break; } }
  }
  return src.slice(start, i);
}

console.log('Overview Live status: Live teams only (1.3.101926a)');

assert('APP_VERSION 1.3.101926a',
  /const APP_VERSION = '1\.3\.101926a'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.101926a'));

const live = { a_live: 'insession', a_checkin: 'checkin' };
const ctx = {
  adminState: {
    overview: { teamId: 'all' },
    teams: [{ id: 1, name: 'Live crew' }, { id: 2, name: 'Last night crew' }, { id: 3, name: 'Just arrived crew' }],
    assignments: [],
  },
  overviewAssignmentIsPerfLive: a => !!live[a.id],
  perfLiveStatusDisplay: a => ({ key: live[a.id] || 'incomplete', label: '' }),
  overviewLiveStatusStationLabel: a => (a.id === 'a_live' ? '2' : ''),
  buildModStrikeCheckpointReport: () => ({ teams: [{ teamId: 2, assignmentId: 'a_last', flagIncomplete: true }] }),
  modStrikeCheckpointRowStillAlerts: () => true,
  assignmentHasModeratorArrivalCheckIn: () => true,
};
vm.createContext(ctx);
vm.runInContext(sliceFn('computeOverviewLiveTeamSnapshots') + '\n' + sliceFn('overviewLiveStatusPillLabel'), ctx);

const asgns = [
  { id: 'a_live', teamId: 1 },
  { id: 'a_last', teamId: 2 },
  { id: 'a_checkin', teamId: 3 },
];
const snaps = ctx.computeOverviewLiveTeamSnapshots(asgns, 3);
const names = snaps.map(s => s.teamName);
assert('live team is listed', names.indexOf('Live crew') >= 0, names.join(','));
assert('last night\'s unfinished team is not listed', names.indexOf('Last night crew') < 0, names.join(','));
assert('no flagged rows in Live status', !snaps.some(s => s.kind === 'flagged'));
assert('just-arrived team is listed', names.indexOf('Just arrived crew') >= 0);

const byName = n => snaps.find(s => s.teamName === n) || {};
assert('checked-in team reads Checked in',
  ctx.overviewLiveStatusPillLabel('inprogress', byName('Just arrived crew').liveKey) === 'Checked in');
assert('team past a station reads In session',
  ctx.overviewLiveStatusPillLabel('inprogress', byName('Live crew').liveKey) === 'In session');

const render = sliceFn('renderOverviewLiveStatusList');
assert('"Just checked in" only while the team is checked in',
  /const isFresh = !!\(asgnId && row\.liveKey === 'checkin'/.test(render));

if (failed) { console.log(failed + ' failed'); process.exit(1); }
console.log('all passed');
