#!/usr/bin/env node
/* Unit tests for moderator ↔ OD/Assignment identity matching.
   Mirrors the helpers in twilight.js (normalizeOrbitKey, email→orbitLoginId). */

function normalizeOrbitKey(raw) {
  return String(raw || '').trim().toLowerCase().replace(/\s+/g, '');
}
function isEmailLike(raw) {
  const s = String(raw || '').trim();
  const at = s.indexOf('@');
  return at > 0 && at < s.length - 1 && !/\s/.test(s);
}
function normalizeEmailKey(raw) {
  return String(raw || '').trim().toLowerCase();
}
function collectModeratorEmails(src) {
  if (!src || typeof src !== 'object') return [];
  const seen = new Set();
  const out = [];
  const add = (v) => {
    const email = normalizeEmailKey(v);
    if (!email || !isEmailLike(email) || seen.has(email)) return;
    seen.add(email);
    out.push(email);
  };
  add(src.centificEmail);
  add(src.personalEmail);
  add(src.email);
  add(src.workEmail);
  return out;
}
function snapshotMatchesOperator(snap, identity, emailToOrbit) {
  if (!snap || !identity) return false;
  const idRaw = snap.orbitLoginId || snap.orbitId || '';
  const idKey = normalizeOrbitKey(idRaw);
  if (idKey && identity.ids.has(idKey)) return true;
  if (idKey && isEmailLike(idRaw)) {
    const email = normalizeEmailKey(idRaw);
    if (identity.emails.has(email)) return true;
    const mapped = emailToOrbit && emailToOrbit.get(email);
    if (mapped && identity.ids.has(mapped)) return true;
  }
  for (const email of collectModeratorEmails(snap)) {
    if (identity.emails.has(email)) return true;
    const mapped = emailToOrbit && emailToOrbit.get(email);
    if (mapped && identity.ids.has(mapped)) return true;
  }
  return false;
}
function assignmentBelongsToOperator(asgn, identity, emailToOrbit, myTeamIds) {
  if (!asgn) return false;
  if ((asgn.modSnapshots || []).some(s => snapshotMatchesOperator(s, identity, emailToOrbit))) return true;
  if (snapshotMatchesOperator(asgn, identity, emailToOrbit)) return true;
  if (asgn.teamId != null && myTeamIds && myTeamIds.has(String(asgn.teamId))) return true;
  return false;
}

function identity(ids, emails) {
  return { ids: new Set(ids.map(normalizeOrbitKey)), emails: new Set(emails.map(normalizeEmailKey)) };
}

let passed = 0;
let failed = 0;
function assert(name, cond) {
  if (cond) { passed++; console.log('ok  -', name); }
  else { failed++; console.error('FAIL -', name); }
}

const david = identity(['David-tw'], ['david@centific.com', 'dave.personal@gmail.com']);
const emailMap = new Map([
  ['david@centific.com', 'david-tw'],
  ['dave.personal@gmail.com', 'david-tw'],
]);

assert('direct orbitLoginId match',
  assignmentBelongsToOperator({
    modSnapshots: [{ orbitLoginId: 'David-tw' }],
  }, david, emailMap, new Set()));

assert('case / whitespace orbitLoginId match',
  assignmentBelongsToOperator({
    modSnapshots: [{ orbitLoginId: ' david-TW ' }],
  }, david, emailMap, new Set()));

assert('OD row wrote email as orbitLoginId',
  assignmentBelongsToOperator({
    modSnapshots: [{ orbitLoginId: 'david@centific.com' }],
  }, david, emailMap, new Set()));

assert('OD row wrote personal email, empty orbitLoginId',
  assignmentBelongsToOperator({
    modSnapshots: [{ orbitLoginId: '', personalEmail: 'dave.personal@gmail.com' }],
  }, david, emailMap, new Set()));

assert('Masterlist email maps to orbitLoginId',
  assignmentBelongsToOperator({
    modSnapshots: [{ orbitLoginId: '', centificEmail: 'david@centific.com' }],
  }, david, emailMap, new Set()));

assert('team membership still matches',
  assignmentBelongsToOperator({
    teamId: 7,
    modSnapshots: [],
  }, david, emailMap, new Set(['7'])));

assert('unrelated booking does not match',
  !assignmentBelongsToOperator({
    teamId: 3,
    modSnapshots: [{ orbitLoginId: 'Jamie-tw', centificEmail: 'jamie@centific.com' }],
  }, david, emailMap, new Set(['9'])));

assert('Mod-Twilight / NotFound id is not a false positive for David',
  !assignmentBelongsToOperator({
    modSnapshots: [{ orbitLoginId: 'Mod-Twilight' }],
  }, david, emailMap, new Set()));

function operatorOwnsTeam(team, identity, emailToOrbit) {
  if (!team) return false;
  const ids = [...(team.primaryIds || []), ...(team.backupIds || [])];
  return ids.some(id => snapshotMatchesOperator({ orbitLoginId: id }, identity, emailToOrbit));
}

assert('team roster with email-as-orbitLoginId still belongs to David',
  operatorOwnsTeam({ primaryIds: ['david@centific.com'], backupIds: [] }, david, emailMap));

assert('unrelated team roster does not belong to David',
  !operatorOwnsTeam({ primaryIds: ['Jamie-tw'], backupIds: [] }, david, emailMap));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
