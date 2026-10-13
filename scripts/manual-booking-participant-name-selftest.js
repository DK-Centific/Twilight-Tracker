#!/usr/bin/env node
/* Self-test: a manual Admin booking with a participant must never be
 * treated as a team session, even when it carries source/comment
 * 'team-session' from the team "New session" pointer. My Session shows
 * the participant name for it, like OD-synced bookings.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');

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

console.log('Manual booking participant name self-test');

const from = src.indexOf('function assignmentHasParticipant(a)');
const to = src.indexOf('// Participant contact as stored on the assignment.');
assert('helpers located', from >= 0 && to > from);

const context = {};
vm.createContext(context);
vm.runInContext(src.slice(from, to), context, { filename: 'team-session-helpers' });
const { isTeamSessionAssignment, assignmentHasParticipant } = context;

const manual = {
  id: 'asgn_1', teamId: 3, teamName: 'Team Three', source: 'team-session',
  comment: 'team-session', participantOrbitId: 'p_42',
  participantData: { firstName: 'Ana', lastName: 'Lopez' },
};
assert('manual booking has participant', assignmentHasParticipant(manual));
assert('manual booking tagged team-session is not a team session', !isTeamSessionAssignment(manual));

const nameOnly = { teamId: 3, source: 'team-session', participantData: { firstName: 'Ana' } };
assert('name without orbit id still counts as participant', !isTeamSessionAssignment(nameOnly));

const teamSession = { teamId: 3, source: 'team-session', participantOrbitId: null, participantData: { address: '1 Main St' } };
assert('real team session stays a team session', isTeamSessionAssignment(teamSession));

const bareTeam = { teamId: 3, source: 'booking', participantData: {} };
assert('team booking with no participant is a team session', isTeamSessionAssignment(bareTeam));

assert('no team, no participant is not a team session', !isTeamSessionAssignment({ participantData: {} }));

assert('ensureTeamSessionAssignments does not tag bookings with a participant',
  src.includes("if (!existing.source && !isOd && !assignmentHasParticipant(existing)) existing.source = 'team-session';"));
assert('Assignment READ does not tag rows with a participant as team-session',
  /&& !pid && !firstName && !lastName\)\s*\n\s*\? 'team-session'/.test(src));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
