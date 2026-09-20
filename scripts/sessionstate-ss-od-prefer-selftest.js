#!/usr/bin/env node
'use strict';

/**
 * PA cutover harden (1.3.091820l):
 * Never bind Booking/Session from geo_presence / asgn_remote when an
 * ss_od_{schedule}_{login} SessionState row exists for the live assignment.
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
  let i = start, depth = 0, begun = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') { depth++; begun = true; }
    else if (ch === '}') {
      depth--;
      if (begun && depth === 0) { i++; break; }
    }
  }
  return src.slice(start, i);
}

console.log('SessionState ss_od_ prefer over geo_presence self-test (1.3.091820l)');

assert('APP_VERSION is 1.3.091820l',
  /const APP_VERSION = '1\.3\.091820l'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091820l'));
assert('presence/remote helpers present',
  /function isGeoPresenceOrRemoteSessionStateRow\(/.test(src)
  && /function sessionStateRowResolvedAssignmentId\(/.test(src));
assert('PA WRITE stateJson string caveat comment present',
  /PA WRITE caveat: SessionState Write expects stateJson as a String/.test(src));

const ASGN = 'od_e3dc4442-1e61-43bd-80ba-8c88d366d399';
const ctx = {
  console, Date, Intl, Number, String, Array, Math, Object, JSON,
  adminState: {
    assignments: [
      { id: ASGN, teamId: 100019, date: '2026-09-18', status: 'Booked' },
    ],
  },
  STATIONS: [],
  getPSTDateString: () => '2026-09-18',
};
vm.createContext(ctx);
for (const name of [
  'sessionStateOrbitSafe',
  'assignmentIdsMatch',
  'isGeoPresenceOrRemoteAssignmentId',
  'isGeoPresenceOrRemoteSessionStateRow',
  'assignmentIdFromSessionStateId',
  'sessionStateRowResolvedAssignmentId',
  'parseSessionStateJson',
  'sessionStateRowMatchesAssignment',
  'sessionStateRowTeamId',
  'buildAssignmentTeamMap',
  'sessionStateProgressScore',
  'parseLastActiveMs',
  'newestSessionStatePerUser',
  'pickLatestTeamProgress',
]) {
  vm.runInContext(extractFn(name), ctx);
}

const ssOd = {
  sessionStateId: 'ss_' + ASGN + '_narendratw',
  assignmentId: null, // PA sometimes leaves column null
  orbitLoginId: 'Narendra-tw',
  teamId: '100019',
  lastActive: '2026-09-18T20:10:00.000Z',
  stateJson: JSON.stringify({
    sessionDate: '2026-09-18',
    sessionStatus: 'arrived',
    progressScore: 10,
    arrivedAt: '2026-09-18T20:05:00.000Z',
  }),
};
const geoBleed = {
  sessionStateId: 'ss_geo_presence_Narendra-tw_2026-09-17_narendratw',
  assignmentId: 'geo_presence_Narendra-tw_2026-09-17',
  orbitLoginId: 'Narendra-tw',
  teamId: '100019',
  lastActive: '2026-09-18T20:20:00.000Z',
  stateJson: JSON.stringify({
    sessionDate: '2026-09-18',
    sessionStatus: 'session_done',
    progressScore: 108600,
    sessionCompletedAt: '2026-09-17T11:44:09.510Z',
    participantAddress: '14267 209th Ave ne 98077, Woodinville, Washington',
  }),
};
const remoteBleed = {
  sessionStateId: 'ss_asgn_remote_fyq0gp_pradeepreddytw',
  assignmentId: 'asgn_remote_fyq0gp',
  orbitLoginId: 'Pradeepreddy-tw',
  teamId: '100019',
  lastActive: '2026-09-18T20:15:00.000Z',
  stateJson: JSON.stringify({
    sessionDate: '2026-09-18',
    sessionStatus: 'session_done',
    progressScore: 108620,
  }),
};
const ssOdPartner = {
  sessionStateId: 'ss_' + ASGN + '_pradeepreddytw',
  assignmentId: ASGN,
  orbitLoginId: 'Pradeepreddy-tw',
  teamId: '100019',
  lastActive: '2026-09-18T20:12:00.000Z',
  stateJson: JSON.stringify({
    sessionDate: '2026-09-18',
    sessionStatus: 'arrived',
    progressScore: 12,
    arrivedAt: '2026-09-18T20:06:00.000Z',
  }),
};

assert('detects geo_presence row',
  ctx.isGeoPresenceOrRemoteSessionStateRow(geoBleed) === true);
assert('detects asgn_remote row',
  ctx.isGeoPresenceOrRemoteSessionStateRow(remoteBleed) === true);
assert('ss_od_ is not presence/remote',
  ctx.isGeoPresenceOrRemoteSessionStateRow(ssOd) === false);
assert('resolves assignmentId from ss_od_ sessionStateId when column null',
  ctx.sessionStateRowResolvedAssignmentId(ssOd) === ASGN);
assert('sessionStateRowMatchesAssignment hits null-column ss_od_',
  ctx.sessionStateRowMatchesAssignment(ssOd, ASGN) === true);

const newest = ctx.newestSessionStatePerUser([geoBleed, ssOd, remoteBleed, ssOdPartner]);
assert('newest includes null-column ss_od_',
  newest.some(r => r.sessionStateId === ssOd.sessionStateId));

const primary = ctx.pickLatestTeamProgress(newest, {
  teamId: '100019',
  assignmentId: ASGN,
  excludeOrbitId: 'narendra-tw',
  asgnTeamMap: ctx.buildAssignmentTeamMap(),
});
assert('PRIMARY prefers ss_od_ partner over geo/remote bleed',
  primary && primary.row.sessionStateId === ssOdPartner.sessionStateId,
  primary && primary.row && primary.row.sessionStateId);

const fallback = ctx.pickLatestTeamProgress(
  ctx.newestSessionStatePerUser([geoBleed, remoteBleed]),
  {
    teamId: '100019',
    assignmentId: '',
    excludeOrbitId: 'someone-else',
    asgnTeamMap: ctx.buildAssignmentTeamMap(),
  });
assert('FALLBACK ignores geo_presence/asgn_remote when no ss_od_',
  fallback == null);

const withBoth = ctx.pickLatestTeamProgress(
  ctx.newestSessionStatePerUser([geoBleed, ssOdPartner]),
  {
    teamId: '100019',
    assignmentId: ASGN,
    excludeOrbitId: '',
    asgnTeamMap: ctx.buildAssignmentTeamMap(),
  });
assert('live assignment bind never picks geo_presence even with higher score',
  withBoth && withBoth.row.sessionStateId === ssOdPartner.sessionStateId
  && withBoth.score < 1000,
  withBoth && JSON.stringify({ id: withBoth.row.sessionStateId, score: withBoth.score }));

if (failed) {
  console.error('\n' + failed + ' ss_od_ prefer checks failed');
  process.exit(1);
}
console.log('\nAll ss_od_ prefer checks passed');
