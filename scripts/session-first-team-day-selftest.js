#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'twilight.js'), 'utf8');

function sliceFn(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let depth = 0;
  let i = src.indexOf('{', start);
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  throw new Error('unclosed ' + name);
}

const ctx = {
  adminState: { assignments: [] },
  ENFORCE_MOD_AVAILABILITY: false,
  isTerminalStatus(s) {
    return s === 'Cancelled' || s === 'Unassigned' || s === 'Completed';
  },
  isSessionWrapUpDone() { return false; },
  normalizedPrimaryModSetKey(ids) {
    return (ids || []).map(x => String(x).toLowerCase()).sort().join('|');
  },
};

vm.createContext(ctx);
[
  'findActiveTeamBookingOnDate',
  'findReusableTeamByPrimarySet',
  'checkTeamHoursForAssignment',
].forEach((n) => vm.runInContext(sliceFn(n), ctx));

const { findActiveTeamBookingOnDate, findReusableTeamByPrimarySet, checkTeamHoursForAssignment } = ctx;

let failed = 0;
function assert(name, cond) {
  if (cond) console.log('  ok  ' + name);
  else { failed++; console.error('  FAIL  ' + name); }
}

ctx.adminState.assignments = [
  { id: 'a1', teamId: 1, date: '2026-09-17', status: 'Booked', participantData: { firstName: 'Pat' } },
  { id: 'a2', teamId: 2, date: '2026-09-17', status: 'Booked', participantData: { firstName: 'Sam' } },
];

console.log('Session-first · one team session per day');
assert('Team A blocked second session same day', !!findActiveTeamBookingOnDate(1, '2026-09-17', null));
assert('Team B allowed parallel different team', !findActiveTeamBookingOnDate(2, '2026-09-17', 'a2'));
assert('Edit excludes self', !findActiveTeamBookingOnDate(1, '2026-09-17', 'a1'));
assert('Different date allowed', !findActiveTeamBookingOnDate(1, '2026-09-18', null));
assert('Cancelled row ignored', (() => {
  ctx.adminState.assignments.push({ id: 'c1', teamId: 3, date: '2026-09-17', status: 'Cancelled' });
  return !findActiveTeamBookingOnDate(3, '2026-09-17', null);
})());
assert('Reuses team by primary mod set', !!findReusableTeamByPrimarySet(
  [{ id: 9, primaryIds: ['mod-a', 'mod-b'] }],
  ['mod-b', 'mod-a']
));
assert('Availability enforcement off', checkTeamHoursForAssignment({ primaryIds: ['x'] }, '2026-09-17', 540, 1020).ok);
assert('startNewTeamSession uses booking source', /function startNewTeamSession[\s\S]{0,1200}source: 'booking'/.test(src));
assert('ENFORCE_MOD_AVAILABILITY false', /const ENFORCE_MOD_AVAILABILITY = false/.test(src));
assert('assignment modal team display helper', /function assignmentModalTeamDisplayName/.test(src));
assert('team picker search mode gate', /inTeamSearchMode && m\.teamPickOpen/.test(src));
assert('edit modal seeds teamName fallback', /teamLabel = assignmentModalTeamDisplayName\(a\.teamId, a\.teamName\)/.test(src));
assert('booking min duration enforcement off', /const ENFORCE_BOOKING_MIN_DURATION = false/.test(src));

console.log(failed ? '\n' + failed + ' failed' : '\nAll checks passed');
process.exit(failed ? 1 : 0);
