#!/usr/bin/env node
/* Self-test: Master-Admin-only Approval list Delete (1.3.091820j). */
'use strict';

const fs = require('fs');
const path = require('path');

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

console.log('Approval Master-Admin delete self-test (1.3.091820j)');

assert('APP_VERSION 1.3.091820j',
  /const APP_VERSION = '1\.3\.091820j'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091820j'));

assert('APPROVAL_PA_DELETE_URL constant exists',
  /const APPROVAL_PA_DELETE_URL\s*=/.test(src));

assert('delete payload uses operation delete + requestingAdminOrbitId',
  /operation:\s*'delete'/.test(src)
  && /requestingAdminOrbitId:\s*\(typeof requestingAdminOrbitId === 'function'\)/.test(src)
  && /async function deleteApprovalRequest\(approvalId\)/.test(src));

assert('Master Admin gate on delete (UI + writer)',
  /const canDeleteAppr = typeof isMasterAdminUser === 'function' && isMasterAdminUser\(\)/.test(src)
  && /async function deleteApprovalRequest\(approvalId\) \{[\s\S]{0,220}isMasterAdminUser\(\)/.test(src)
  && /async function confirmAndDeleteApproval\(approvalId\) \{[\s\S]{0,180}isMasterAdminUser\(\)/.test(src));

assert('per-row Delete button + confirm dialog',
  /class="appr-row-delete"/.test(src)
  && /data-appr-del=/.test(src)
  && /confirmAndDeleteApproval/.test(src)
  && /variant:\s*'danger'/.test(src)
  && /title:\s*'Delete approval\?'/.test(src));

assert('Delete not configured toast when endpoint empty',
  /Delete not configured/.test(src)
  && /function approvalDeleteEndpoint\(\)/.test(src));

assert('soft-deleted rows filtered from resolveApprovals',
  /function isApprovalSoftDeleted\(a\)/.test(src)
  && /return \[\.\.\.byId\.values\(\)\]\.filter\(a => !isApprovalSoftDeleted\(a\)\)/.test(src)
  && /Deleted:\s*5/.test(src));

assert('pollMyApprovals still revokes gate when cloud row gone',
  /revoking unverified gate approval \(no cloud row\)/.test(src)
  && /else if \(readOk\) \{/.test(src));

assert('CSS for appr-row-delete',
  /\.appr-row-delete\s*\{/.test(html));

assert('refresh list after delete',
  /Approval deleted/.test(src)
  && /ensureApprovalData\(\{\s*force:\s*true\s*\}\)/.test(src)
  && /adminState\.approvals = adminState\.approvals\.filter/.test(src));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
