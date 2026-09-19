#!/usr/bin/env node
/* Self-test: approval Approved popup must not reappear after Confirm
 * on TTL re-verify / reload / poll (v1.3.091818s).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'twilight.js'), 'utf8');

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

console.log('Approval ack / re-prompt self-test');

assert(
  'poll uses prior local status (not gateApproved/TTL) for popup decision',
  /const wasLocallyApproved = \(prevStatus === 'Approved' \|\| prevStatus === 'AutoApproved'\)/.test(src)
    && /PRIOR local status/.test(src)
);

assert(
  'markApprovalAcked + approvalAckedTokens map exist',
  /function markApprovalAcked\(k, token\)/.test(src)
    && /state\.approvalAckedTokens/.test(src)
);

assert(
  'showApprovalApprovedPopup records ack via markApprovalAcked',
  /markApprovalAcked\(k, token\)/.test(src)
);

assert(
  'isApprovalAcked checks token map before gate row',
  /state\.approvalAckedTokens\[String\(token\)\]/.test(src)
);

assert(
  'resetOperatorSessionState preserves approvalAckedTokens',
  /fresh\.approvalAckedTokens = \{ \.\.\.state\.approvalAckedTokens \}/.test(src)
);

// Behavioral: simulate ack map surviving a gate-key change
const ctx = {
  state: { approvalGate: {}, approvalAckedTokens: {} },
  console,
  Date,
  String,
  saveState() {},
};
function getGate(k) {
  ctx.state.approvalGate = ctx.state.approvalGate || {};
  return ctx.state.approvalGate[k] || { status: 'none' };
}
function setGate(k, patch) {
  ctx.state.approvalGate = ctx.state.approvalGate || {};
  ctx.state.approvalGate[k] = { ...(ctx.state.approvalGate[k] || { status: 'none' }), ...patch };
}
ctx.getGate = getGate;
ctx.setGate = setGate;
ctx.state = ctx.state;

const isBegin = src.indexOf('function isApprovalAcked(k, token)');
const markBegin = src.indexOf('function markApprovalAcked(k, token)');
const markEnd = src.indexOf('// Transient (NOT persisted) guard so two overlapping polls', markBegin);
assert('ack helpers locatable', isBegin > 0 && markBegin > isBegin && markEnd > markBegin);

vm.createContext(ctx);
vm.runInContext(src.slice(isBegin, markEnd), ctx);

ctx.markApprovalAcked('asgnA|station1', 'appr1#0');
assert(
  'ack survives under original gate key',
  ctx.isApprovalAcked('asgnA|station1', 'appr1#0') === true
);
assert(
  'ack survives when carousel assignment id changes',
  ctx.isApprovalAcked('asgnB|station1', 'appr1#0') === true,
  'token map should ignore gate key'
);
assert(
  'new resubmit token is not acked',
  ctx.isApprovalAcked('asgnA|station1', 'appr1#1') === false
);

console.log(failed ? (`FAILED ${failed} · passed ${passed}`) : (`All ${passed} checks passed`));
process.exit(failed ? 1 : 0);
