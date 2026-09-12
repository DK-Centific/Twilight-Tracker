#!/usr/bin/env node
/* Self-test: moderator approval submit must not hard-block when
 * there is no active session, and participant contact must surface
 * whenever Assignment.participantData has address / phone / email.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcPath = path.join(__dirname, '..', 'twilight.js');
const src = fs.readFileSync(srcPath, 'utf8');

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

console.log('Approval submit / contact self-test');

assert(
  'source no longer hard-blocks submit with No active session alert',
  !/Start your booked session before submitting calibration for review/.test(src)
);
assert(
  'beginApprovalSubmit still exists',
  /async function beginApprovalSubmit\(stationKey, resubmit\)/.test(src)
);
assert(
  'submit uses unbound fallback when assignment is missing',
  /asgnId === 'unbound' \? '' : asgnId/.test(src) && /const asgnId = \(ctx\.asgn && ctx\.asgn\.id\)/.test(src)
);
assert(
  'pollMyApprovals runs when orbitId is set even without asgnId',
  /if \(orbitId\) \{\s*for \(const k of GATE_ALL_KEYS\)/.test(src)
);

const beginIdx = src.indexOf('function _resolveGateAssignment()');
const beginEnd = src.indexOf('function _gateAsgnId()');
assert('_resolveGateAssignment is present', beginIdx > 0 && beginEnd > beginIdx);

const contactIdx = src.indexOf('function assignmentParticipantContact(asgn)');
const contactEnd = src.indexOf('function stampTeamOpenSession');
assert('assignmentParticipantContact is present', contactIdx > 0 && contactEnd > contactIdx);

const context = {
  console,
  getActiveOperatorAssignment: null,
  getAssignedOpenSession: null,
  getOperatorAssignment: null,
};
vm.createContext(context);
vm.runInContext(src.slice(beginIdx, beginEnd), context);
vm.runInContext(src.slice(contactIdx, contactEnd), context);

context.getActiveOperatorAssignment = () => null;
context.getAssignedOpenSession = () => null;
context.getOperatorAssignment = () => null;
assert('resolve returns null when no session exists', context._resolveGateAssignment() === null);

context.getActiveOperatorAssignment = () => ({ id: 'asgn_carousel' });
context.getAssignedOpenSession = () => ({ id: 'asgn_open' });
context.getOperatorAssignment = () => ({ id: 'asgn_first' });
assert(
  'resolve prefers the carousel-active assignment',
  context._resolveGateAssignment() && context._resolveGateAssignment().id === 'asgn_carousel'
);

context.getActiveOperatorAssignment = () => null;
assert(
  'resolve falls back to open assigned session (OD bookings)',
  context._resolveGateAssignment() && context._resolveGateAssignment().id === 'asgn_open'
);

context.getAssignedOpenSession = () => null;
assert(
  'resolve falls back to first upcoming assignment',
  context._resolveGateAssignment() && context._resolveGateAssignment().id === 'asgn_first'
);

const empty = context.assignmentParticipantContact({ participantData: {} });
assert('empty participantData yields blank contact', !empty.address && !empty.phone && !empty.email);

const teamish = context.assignmentParticipantContact({
  source: 'team-session',
  participantData: {
    address: '12 Oak St',
    state: 'CA',
    zipCode: '94016',
    phone: '555-0100',
    email: 'pat@example.com',
  },
});
assert('shows address even on team-session rows', teamish.address === '12 Oak St, CA, 94016', teamish.address);
assert('shows phone when present', teamish.phone === '555-0100');
assert('shows email when present', teamish.email === 'pat@example.com');

console.log('');
console.log(failed ? `FAILED ${failed} · passed ${passed}` : `All ${passed} checks passed`);
process.exit(failed ? 1 : 0);
