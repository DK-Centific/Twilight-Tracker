#!/usr/bin/env node
/* Self-test: One Approval per team/session (1.3.091820n).
 * approval_id = appr_{assignmentId}_{StationLabel} (no orbit/timestamp).
 * Admin list dedupes one card per assignment_id|station.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

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

console.log('One Approval per team/session self-test (1.3.091820n)');

assert('APP_VERSION 1.3.091820n',
  /const APP_VERSION = '1\.3\.091820n'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091820n'));

assert('buildTeamSessionApprovalId helper present',
  /function buildTeamSessionApprovalId\(assignmentId, station\)/.test(src));

assert('id format has no orbit / Date.now default',
  /const id = buildTeamSessionApprovalId\(asgn, station\) \|\| p\.approval_id \|\| ''/.test(src)
  && !/`appr_\$\{orbitId\}_\$\{asgn\}_/.test(src)
  && !/appr_' \+ ctx\.orbitId \+ '_' \+ asgnId/.test(src));

assert('submitApprovalFromStation uses buildTeamSessionApprovalId',
  /async function submitApprovalFromStation[\s\S]{0,900}buildTeamSessionApprovalId\(asgnId, stationLabel\)/.test(src));

assert('createApprovalRequest keeps orbit_login_id submitter',
  /orbit_login_id: orbitId/.test(src)
  && /async function createApprovalRequest\(p\)/.test(src)
  && /moderator_name: p\.moderatorName/.test(src));

assert('Admin ensureApprovalData dedupes by team/station',
  /adminState\.approvals = dedupeApprovalsByTeamStation\(resolveApprovals\(rows\)\)/.test(src)
  && /function dedupeApprovalsByTeamStation\(list\)/.test(src)
  && /function approvalTeamStationDedupeKey\(a\)/.test(src));

assert('soft-delete still keyed by approval_id',
  /async function deleteApprovalRequest\(approvalId\)/.test(src)
  && /approval_id: id/.test(src)
  && /operation: 'delete'/.test(src));

assert('Admin list shows team + submitter',
  /Submitted by /.test(src)
  && /appr-row-team/.test(src));

// --- Behavioral: id builder + dedupe ---
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

const ctx = {
  console, String, Map, Array,
  _APPR_STATUS_RANK: { Pending: 0, InReview: 1, Rejected: 2, AutoApproved: 3, Approved: 3, Cancelled: 4, Deleted: 5 },
  _apprRank(s) {
    const rank = { Pending: 0, InReview: 1, Rejected: 2, AutoApproved: 3, Approved: 3, Cancelled: 4, Deleted: 5 };
    return rank[s] != null ? rank[s] : 0;
  },
  approvalEpoch(r) {
    const raw = (r && (r.last_modified || r.submitted_at)) || '';
    let t = Date.parse(raw);
    if (!isNaN(t)) return t;
    return 0;
  },
};
vm.createContext(ctx);
vm.runInContext(
  extractFn('approvalStationKey') + '\n'
  + extractFn('buildTeamSessionApprovalId') + '\n'
  + extractFn('approvalTeamStationDedupeKey') + '\n'
  + extractFn('dedupeApprovalsByTeamStation'),
  ctx
);

const id1 = ctx.buildTeamSessionApprovalId('asgn_abc', 'Station1');
const id2 = ctx.buildTeamSessionApprovalId('asgn_abc', 'Station 1');
const id3 = ctx.buildTeamSessionApprovalId('asgn_abc', 'Station2');
assert('id = appr_{assignmentId}_{StationLabel}',
  id1 === 'appr_asgn_abc_Station1', id1);
assert('spaces stripped from station label',
  id2 === 'appr_asgn_abc_Station1', id2);
assert('different stations get different ids',
  id3 === 'appr_asgn_abc_Station2' && id3 !== id1);
assert('blank assignment yields empty id',
  ctx.buildTeamSessionApprovalId('', 'Station1') === '');
assert('id does not include orbit',
  !/orbit|modA|modB/i.test(id1));

const dual = ctx.dedupeApprovalsByTeamStation([
  {
    approval_id: 'appr_modA_asgn_abc_Station1_111',
    assignment_id: 'asgn_abc', station: 'Station1',
    status: 'Pending', orbit_login_id: 'ModA',
    team_name: 'A × B', _epoch: 1000, last_modified: '2026-09-19T10:00:00.000Z',
  },
  {
    approval_id: 'appr_modB_asgn_abc_Station1_222',
    assignment_id: 'asgn_abc', station: 'Station1',
    status: 'Pending', orbit_login_id: 'ModB',
    team_name: 'A × B', _epoch: 2000, last_modified: '2026-09-19T11:00:00.000Z',
  },
  {
    approval_id: 'appr_asgn_abc_Station2',
    assignment_id: 'asgn_abc', station: 'Station2',
    status: 'Pending', orbit_login_id: 'ModA',
    team_name: 'A × B', _epoch: 1500, last_modified: '2026-09-19T10:30:00.000Z',
  },
]);
assert('Admin dedupe → one card per assignment|station',
  dual.length === 2, 'got ' + dual.length);
const s1 = dual.find(a => a.station === 'Station1');
assert('newer Pending wins for same station',
  s1 && s1.orbit_login_id === 'ModB' && s1.approval_id.includes('modB'),
  s1 && s1.approval_id);
assert('other station kept',
  dual.some(a => a.station === 'Station2'));

const decided = ctx.dedupeApprovalsByTeamStation([
  {
    approval_id: 'appr_asgn_x_Station1',
    assignment_id: 'asgn_x', station: 'Station1',
    status: 'Approved', orbit_login_id: 'ModA',
    _epoch: 3000, last_modified: '2026-09-19T12:00:00.000Z',
  },
  {
    approval_id: 'appr_legacy_asgn_x_Station1_999',
    assignment_id: 'asgn_x', station: 'Station1',
    status: 'Pending', orbit_login_id: 'ModB',
    _epoch: 3000, last_modified: '2026-09-19T12:00:00.000Z',
  },
]);
assert('tie → Approved beats Pending',
  decided.length === 1 && decided[0].status === 'Approved',
  decided[0] && decided[0].status);

const sameStable = ctx.dedupeApprovalsByTeamStation([
  {
    approval_id: 'appr_asgn_y_Station1',
    assignment_id: 'asgn_y', station: 'Station1',
    status: 'Pending', orbit_login_id: 'ModA', _epoch: 1,
  },
  {
    approval_id: 'appr_asgn_y_Station1',
    assignment_id: 'asgn_y', station: 'Station1',
    status: 'Approved', orbit_login_id: 'ModA', _epoch: 2,
  },
]);
assert('same stable id · newest status kept after prior resolve',
  sameStable.length === 1 && sameStable[0].status === 'Approved');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
