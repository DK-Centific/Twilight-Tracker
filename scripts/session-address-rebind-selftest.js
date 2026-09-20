#!/usr/bin/env node
'use strict';

/**
 * 1.3.091820w — My session address rebind after same-id OD reschedule
 * (Narendra×Pradeepreddy Romo → Yuan He).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'twilight.js'), 'utf8');

function extractFn(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let i = start;
  let depth = 0;
  let begun = false;
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

const ROMO = '123 Old Romo Rd, Seattle, WA 98101';
const YUAN = '456 Yuan He Ave, Bellevue, WA 98004';
const ASGN_ID = 'od_e3dc4442-1e61-43bd-80ba-8c88d366d399';

const state = {
  participantAddress: ROMO,
  _lastSeenAddressBindKey: ASGN_ID + '|2026-09-17|' + ROMO.toLowerCase(),
  username: 'Narendra-tw',
};

const yuanAsgn = {
  id: ASGN_ID,
  date: '2026-09-18',
  teamId: 100019,
  status: 'Booked',
  participantData: {
    firstName: 'Yuan',
    lastName: 'He',
    address: YUAN,
  },
};

const ctx = {
  console,
  state,
  getActiveOperatorAssignment: () => yuanAsgn,
  getOperatorAssignment: () => yuanAsgn,
  assignmentFenceAddress: (a) => {
    if (!a || !a.participantData) return '';
    return String(a.participantData.address || '').trim();
  },
  assignmentParticipantContact: (a) => ({
    address: a && a.participantData ? String(a.participantData.address || '').trim() : '',
    phone: '',
    email: '',
  }),
  formatParticipantAddressLine: (pd) => String((pd && pd.address) || '').trim(),
  sanitizeSharePointPlainText: (v) => String(v == null ? '' : v).trim(),
  collapseDuplicateLocationParts: (v) => String(v || '').trim(),
  saveState: () => {},
};

vm.createContext(ctx);
for (const name of [
  'resolveBookedParticipantAddress',
  'addressBindKeyForAssignment',
  'syncBookedParticipantAddress',
]) {
  vm.runInContext(extractFn(name), ctx);
}

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed++;
    console.error('  FAIL ' + name + (detail ? ' · ' + detail : ''));
  }
}

console.log('session-address-rebind-selftest (1.3.091820w)');

assert('starts with Romo sticky', state.participantAddress === ROMO);

const changed = ctx.syncBookedParticipantAddress(yuanAsgn);
assert('rebind reports change', changed === true);
assert('address is Yuan He', state.participantAddress === YUAN,
  'got: ' + state.participantAddress);
assert('bind key stamped',
  state._lastSeenAddressBindKey === ASGN_ID + '|2026-09-18|' + YUAN.toLowerCase(),
  state._lastSeenAddressBindKey);

const again = ctx.syncBookedParticipantAddress(yuanAsgn);
assert('second sync is no-op', again === false);
assert('address stays Yuan He', state.participantAddress === YUAN);

// Simulate clearOperatorProgress path
state.participantAddress = '';
state._lastSeenAddressBindKey = null;
ctx.syncBookedParticipantAddress(yuanAsgn);
assert('rebinds after clear', state.participantAddress === YUAN);

// assignmentLocationSnapshot prefer booking
vm.runInContext(extractFn('assignmentLocationSnapshot'), ctx);
ctx.loadGeocodeCache = () => ({});
ctx.GEO_HQ_CENTER = { lat: 0, lng: 0 };
state.participantAddress = ROMO; // stale local
const loc = ctx.assignmentLocationSnapshot(yuanAsgn);
assert('location snapshot uses booking not stale local',
  loc.address === YUAN, 'got: ' + (loc && loc.address));

if (failed) {
  console.error('\n' + failed + ' failure(s)');
  process.exit(1);
}
console.log('\nAll passed.');
