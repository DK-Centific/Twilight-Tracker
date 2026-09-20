#!/usr/bin/env node
'use strict';
/**
 * 1.3.091820m — Yuan He team unlock + Team A→Team B day bind
 * ----------------------------------------------------------
 * 1. Reviewer Approve for one primary unlocks BOTH (assignmentId+sessionDate).
 * 2. teammateAtMs defined so checkAndOfferTeammateSync does not throw.
 * 3. After 9 AM + today Team B: getAssignedOpenSession / getSessionDisplayTeam
 *    never rehydrate yesterday Team A (Reset-irrelevant bind bug).
 * 4. Teammate fallback blocks cross-team after day gate.
 * 5. Duplicate SessionState rows prefer higher progress score.
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

console.log('Approval team unlock + day-bind self-test (1.3.091820m)');

assert('APP_VERSION 1.3.091820m',
  /const APP_VERSION = '1\.3\.091820m'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091820m'));
assert('findApprovalRowForGate present',
  /function findApprovalRowForGate\(/.test(src));
assert('poll uses findApprovalRowForGate',
  /findApprovalRowForGate\(resolved, k, label, asgnId, sessionYmd, orbitId, teamIdForGate\)/.test(src));
assert('teammateAtMs defined before use',
  /const teammateAtMs = parseLastActiveMs\(teammateAt\);/.test(src)
  && src.indexOf('const teammateAtMs = parseLastActiveMs(teammateAt);')
    < src.indexOf('const alreadyAdopted = !!(localAtMs && teammateAtMs'));
assert('soft-merge when teammateNewer (not only !bHasOwnWork)',
  /if \(teammateNewer\) \{/.test(src)
  && /pickBetterScenario so local work is never downgraded/.test(src));
assert('getAssignedOpenSession preferToday guard',
  /After 9 AM PT with a today\+ booking: NEVER bind/.test(src));
assert('getSessionDisplayTeam blocks teams\[0\] fallback after gate',
  /NEVER fall back to\n  \/\/ getOperatorTeam\(\)/.test(src)
  || /NEVER fall back to/.test(src));
assert('teammate fallback skips when active assignment set',
  /FALLBACK skipped · active assignment set/.test(src)
  || /never adopt unscoped \/ other-team progress/.test(src));
assert('newestSessionStatePerUser prefers progress score',
  /Duplicate SS rows \(Narendra 444\/445\)/.test(src)
  || /nextScore > prevScore/.test(src));

// --- Behavioral: findApprovalRowForGate ---
{
  const ctx = {
    console, String, Date,
    state: { approvalGate: {} },
    getGate(k) { return { status: 'none' }; },
    assignmentIdsMatch(a, b) { return String(a) === String(b); },
    approvalRowBelongsToActiveSession(row, asgnId, sessionYmd) {
      if (String(row.assignment_id) !== String(asgnId)) return false;
      if (sessionYmd && row.session_date && row.session_date !== sessionYmd) return false;
      return true;
    },
  };
  vm.createContext(ctx);
  vm.runInContext(extractFn('findApprovalRowForGate'), ctx);

  const asgn = 'od_e3dc4442-team';
  const day = '2026-09-18';
  const rows = [
    {
      approval_id: 'appr_pradeep_1', orbit_login_id: 'Pradeepreddy-tw',
      station: 'Station1', status: 'Approved', assignment_id: asgn,
      session_date: day, team_id: '100019', resubmit_count: 0,
    },
    {
      approval_id: 'appr_other_pending', orbit_login_id: 'Narendra-tw',
      station: 'Station1', status: 'Pending', assignment_id: asgn,
      session_date: day, team_id: '100019',
    },
  ];
  const hit = ctx.findApprovalRowForGate(
    rows, 'station1', 'Station1', asgn, day, 'Narendra-tw', '100019');
  assert('Narendra unlocks from Pradeep Approved even with own Pending',
    hit && hit.fromTeammate === true && hit.row.approval_id === 'appr_pradeep_1'
    && hit.row.status === 'Approved');

  const ownApproved = {
    approval_id: 'appr_naren_ok', orbit_login_id: 'Narendra-tw',
    station: 'Station1', status: 'Approved', assignment_id: asgn,
    session_date: day, team_id: '100019',
  };
  const preferOwn = ctx.findApprovalRowForGate(
    [ownApproved, rows[0]], 'station1', 'Station1', asgn, day, 'Narendra-tw', '100019');
  assert('own Approved preferred when both Approved',
    preferOwn && preferOwn.fromTeammate === false
    && preferOwn.row.approval_id === 'appr_naren_ok');

  const onlyTeam = ctx.findApprovalRowForGate(
    [rows[0]], 'station1', 'Station1', asgn, day, 'Narendra-tw', '100019');
  assert('team Approved unlocks when no own row',
    onlyTeam && onlyTeam.fromTeammate && onlyTeam.row.status === 'Approved');

  // Same assignmentId + divergent TeamLog team_id still unlocks (100018 vs 100019).
  const divergeTeam = ctx.findApprovalRowForGate(
    [{ ...rows[0], team_id: '999' }], 'station1', 'Station1', asgn, day, 'Narendra-tw', '100019');
  assert('assignmentId match unlocks despite divergent team_id',
    divergeTeam && divergeTeam.row.status === 'Approved');

  const wrongAsgn = ctx.findApprovalRowForGate(
    [{ ...rows[0], assignment_id: 'od_other', team_id: '999' }],
    'station1', 'Station1', asgn, day, 'Narendra-tw', '100019');
  assert('wrong assignment_id does not unlock', !wrongAsgn);
}

// --- Behavioral: getAssignedOpenSession prefer today ---
{
  const yesterday = {
    id: 'asgn-teamA-y', date: '2026-09-17', status: 'Assigned',
    teamId: 'teamA', teamName: 'Team A · ModA x ModB',
  };
  const todayB = {
    id: 'asgn-teamB-t', date: '2026-09-18', status: 'Assigned',
    teamId: 'teamB', teamName: 'Team B · ModA x ModC',
  };
  const ctx = {
    console, String, Date, Math,
    window: { _mySessionCarouselIdx: 0 }, // sticky idx on yesterday if unfiltered
    getPSTDateString: () => '2026-09-18',
    isPastModStrikeCheckpointHour: () => true,
    isSessionWrapUpDone: () => false,
    getOperatorCarouselAssignments: () => [todayB], // gated list · today only
    getActiveOperatorAssignment: () => yesterday, // sticky wrong active
    getOperatorTeam: () => ({ id: 'teamA', name: 'Team A · ModA x ModB' }),
    teamForAssignment(asgn) {
      if (!asgn) return null;
      return { id: asgn.teamId, name: asgn.teamName, primaryIds: [], backupIds: [] };
    },
  };
  vm.createContext(ctx);
  vm.runInContext(extractFn('getAssignedOpenSession'), ctx);
  vm.runInContext(extractFn('getSessionDisplayTeam'), ctx);

  const open = ctx.getAssignedOpenSession();
  assert('getAssignedOpenSession ignores sticky yesterday active after gate',
    open && open.id === 'asgn-teamB-t', open && open.id);

  const team = ctx.getSessionDisplayTeam();
  assert('getSessionDisplayTeam is Team B not teams[0] Team A',
    team && String(team.id) === 'teamB'
    && /Team B/.test(String(team.name || '')),
    team && team.name);
}

// --- newestSessionStatePerUser prefers score ---
{
  const ctx = {
    console, String, Map, Date, Number, Math,
    parseLastActiveMs(v) { return Date.parse(v) || 0; },
    sessionStateRowResolvedAssignmentId(r) { return String(r.assignmentId || ''); },
    parseSessionStateJson(r) {
      try { return JSON.parse(r.stateJson || '{}'); } catch (_) { return {}; }
    },
    sessionStateProgressScore(parsed) {
      return Number((parsed && parsed.progressScore) || 0);
    },
  };
  vm.createContext(ctx);
  vm.runInContext(extractFn('newestSessionStatePerUser'), ctx);
  const asgn = 'od_e3dc4442';
  const rows = [
    {
      orbitLoginId: 'Narendra-tw', assignmentId: asgn,
      lastActive: '2026-09-18T20:00:00Z',
      stateJson: JSON.stringify({ progressScore: 50, stations: { station1: {} } }),
      sessionStateId: 'ss_444',
    },
    {
      orbitLoginId: 'Narendra-tw', assignmentId: asgn,
      lastActive: '2026-09-18T21:00:00Z', // newer heartbeat
      stateJson: JSON.stringify({ progressScore: 0, stations: {} }),
      sessionStateId: 'ss_445',
    },
  ];
  const out = ctx.newestSessionStatePerUser(rows);
  assert('duplicate SS prefers richer progress over newer empty',
    out.length === 1 && out[0].sessionStateId === 'ss_444',
    out[0] && out[0].sessionStateId);
}

console.log(failed ? (`FAILED ${failed}`) : 'All checks passed');
process.exit(failed ? 1 : 0);
