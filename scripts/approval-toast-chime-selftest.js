#!/usr/bin/env node
/* Self-test: Approval toast + soft chime (1.3.091820w).
 * Mirrors arrival check-in alerts for Admin/Reviewer Pending edges and
 * Moderator Approved/Rejected transitions.
 */
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

console.log('Approval toast + soft chime self-test (1.3.091820w)');

assert('APP_VERSION 1.3.091820w',
  /const APP_VERSION = '1\.3\.091820w'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091820w'));

assert('day-scoped LS store key twilight_approval_alerts_v1',
  /const APPROVAL_ALERTS_LS_KEY = 'twilight_approval_alerts_v1'/.test(src)
  && /function loadApprovalAlertsStore\(/.test(src)
  && /function markApprovalAlertSeen\(/.test(src));

assert('edge-detect syncApprovalIncomingAlerts + seed-without-toast',
  /function syncApprovalIncomingAlerts\(/.test(src)
  && /_apprPrevOpenIds === null/.test(src)
  && /playArrivalChimeOnce/.test(src));

assert('unbound / empty assignment_id rows excluded from open alerts',
  /function listOpenApprovalAlertRows\(/.test(src)
  && /asgn\.toLowerCase\(\) === 'unbound'/.test(src));

assert('Admin/Reviewer toast copy Calibration submitted for review',
  /Calibration submitted for review/.test(src)
  && /ovApprovalToastStack/.test(src)
  && /function pushApprovalIncomingToast\(/.test(src));

assert('startApprovalPoll wires syncApprovalIncomingAlerts',
  /function startApprovalPoll\(/.test(src)
  && /syncApprovalIncomingAlerts/.test(src));

assert('Moderator Approved/Rejected toast hooks in pollMyApprovals',
  /notifyModApprovalDecisionToast\('approved'/.test(src)
  && /notifyModApprovalDecisionToast\('rejected'/.test(src)
  && /notifyModApprovalDecisionToast\('autoapproved'/.test(src));

assert('notifyModApprovalDecisionToast respects ack tokens + day-gate',
  /function notifyModApprovalDecisionToast\(/.test(src)
  && /isApprovalAcked/.test(src)
  && /_gateAsgnId/.test(src)
  && /dec:' \+ token/.test(src));

assert('prefers-reduced-motion skips chime via playArrivalChimeOnce',
  /function playArrivalChimeOnce\(/.test(src)
  && /prefersArrivalReducedMotion\(\)/.test(src));

assert('markApprovalsSeen also day-scopes toast snooze',
  /function markApprovalsSeen\(/.test(src)
  && /markApprovalAlertSeen\(id\)/.test(src));

assert('CSS approval-toast-stack Soft Sage gold accent',
  /\.approval-toast-stack\s*\{/.test(html)
  && /\.approval-toast\s*\{/.test(html)
  && /border-left:3px solid #C5A059/.test(html)
  && /prefers-reduced-motion: reduce/.test(html)
  && /\.approval-toast\{animation:none!important\}/.test(html.replace(/\s+/g, ''))
    || (html.includes('.approval-toast') && html.includes('animation:none!important')));

assert('reuse arrival Soft Sage tokens (.at-kicker / #C5A059)',
  html.includes('#C5A059')
  && /className = 'approval-toast-stack'/.test(src));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
