#!/usr/bin/env node
/* Self-test: Admin can edit checklist scenarios past the approval gate.
 * Moderators and reviewers stay locked. Submit still requires approval.
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

console.log('Admin scenario edit vs approval gate');

assert('APP_VERSION 1.3.091823c',
  /const APP_VERSION = '1\.3\.091823c'/.test(src));
assert('cache-bust matches',
  html.includes('twilight.js?v=twilight-1.3.091823c'));

assert('role bypass helper exists',
  /function adminBypassesScenarioEditLock\(/.test(src));
assert('cover-flow can focus later scenarios for Admin',
  /function scenarioFlowCanFocus\(stationKey, num\) \{\s*if \(typeof adminBypassesScenarioEditLock === 'function' && adminBypassesScenarioEditLock\(\)\) return true;/.test(src));
assert('checkpoint hold does not trap Admin on calibration',
  /function shouldHoldAtApprovalCheckpoint\(stationKey, doneNum\) \{\s*if \(typeof adminBypassesScenarioEditLock === 'function' && adminBypassesScenarioEditLock\(\)\) return false;/.test(src));
assert('station list lets Admin open a later station',
  /if \(toIdx > fromIdx && stationApprovalBlocksAdvance\(from\)\) \{\s*if \(typeof adminBypassesScenarioEditLock === 'function' && adminBypassesScenarioEditLock\(\)\) return true;/.test(src));
assert('phone station stepper lets Admin move ahead',
  /const editBypass = typeof adminBypassesScenarioEditLock === 'function' && adminBypassesScenarioEditLock\(\);[\s\S]{0,180}const nextBlocked = hasNext\s*&& !editBypass/.test(src));
assert('locked row keeps the catalog pencil for Admin',
  /function _applyScenarioGateLock\(container\)/.test(src)
    && /el\.classList\.contains\('sc-scen-pencil'\)/.test(src)
    && /el\.classList\.contains\('cl-scen-pencil'\)/.test(src)
    && /appr-edit-open/.test(src)
    && /appr-locked\.appr-edit-open::after \{ content: none; \}/.test(html));
assert('submit still uses the approval gate',
  /function submitStation\(\) \{[\s\S]{0,1200}stationApprovalBlocksAdvance\(currentStationKey\)/.test(src));

const advanceStart = src.indexOf('function stationApprovalBlocksAdvance(k)');
const advanceEnd = src.indexOf('function shouldHoldAtApprovalCheckpoint', advanceStart);
const advanceBody = src.slice(advanceStart, advanceEnd);
assert('station advance check itself is unchanged',
  advanceBody.indexOf('adminBypassesScenarioEditLock') < 0
    && /isGateActive\(k\)/.test(advanceBody));

function sliceFn(name, nextName) {
  const start = src.indexOf('function ' + name);
  const end = src.indexOf('function ' + nextName, start);
  if (start < 0 || end < 0) throw new Error('missing ' + name);
  return src.slice(start, end);
}

const roleCtx = {
  state: {},
  isReviewerSession() { return !!roleCtx.state.isReviewer; },
  isMasterAdminUser() { return !!roleCtx.state.isMasterAdminUser; },
  isAdminUsername(name) { return String(name || '').toLowerCase() === 'admin-twilight'; },
  isAdminSession() { return !!roleCtx.state.adminSession; },
};
vm.createContext(roleCtx);
vm.runInContext(sliceFn('adminBypassesScenarioEditLock()', 'stationApprovalBlocksAdvance(k)'), roleCtx);

roleCtx.state = {};
assert('moderator is not exempt', roleCtx.adminBypassesScenarioEditLock() === false);

roleCtx.state = { isReviewer: true, isAdmin: true, isMasterAdmin: true };
assert('reviewer stays locked even with admin flags', roleCtx.adminBypassesScenarioEditLock() === false);

roleCtx.state = { isAdmin: true };
assert('signed-in Admin is exempt', roleCtx.adminBypassesScenarioEditLock() === true);

roleCtx.state = { isMasterAdmin: true };
assert('Master Admin flag is exempt', roleCtx.adminBypassesScenarioEditLock() === true);

roleCtx.state = { isMasterAdminUser: true };
assert('Master Admin account is exempt', roleCtx.adminBypassesScenarioEditLock() === true);

roleCtx.state = { username: 'Admin-Twilight' };
assert('Admin-Twilight username is exempt', roleCtx.adminBypassesScenarioEditLock() === true);

roleCtx.state = { adminSession: true };
assert('admin session is exempt', roleCtx.adminBypassesScenarioEditLock() === true);

function fakeControl(classes) {
  const attrs = {};
  const set = new Set(classes);
  return {
    classList: { contains(c) { return set.has(c); } },
    style: {},
    setAttribute(k, v) { attrs[k] = v; },
    attrs,
  };
}
function fakeContainer(children) {
  const classes = new Set();
  return {
    classList: { add(c) { classes.add(c); }, has(c) { return classes.has(c); } },
    querySelectorAll() { return children; },
  };
}

const lockCtx = {
  adminBypassesScenarioEditLock() { return !!lockCtx.bypass; },
  bypass: false,
};
vm.createContext(lockCtx);
vm.runInContext(sliceFn('_applyScenarioGateLock(container)', '_lockAllScenarios(c, k)'), lockCtx);

function runLock(bypass) {
  lockCtx.bypass = bypass;
  const pencil = fakeControl(['sc-scen-pencil']);
  const status = fakeControl(['scenario-status-btn']);
  const note = fakeControl(['scenario-notes']);
  const box = fakeContainer([pencil, status, note]);
  lockCtx._applyScenarioGateLock(box);
  return { box, pencil, status, note };
}

const modLock = runLock(false);
assert('moderator lock disables the edit pencil', modLock.pencil.attrs.disabled === 'disabled');
assert('moderator lock disables status', modLock.status.attrs.disabled === 'disabled');
assert('moderator row is marked locked', modLock.box.classList.has('appr-locked'));
assert('moderator row keeps the lock badge', modLock.box.classList.has('appr-edit-open') === false);

const adminLock = runLock(true);
assert('Admin lock leaves the edit pencil enabled', adminLock.pencil.attrs.disabled == null
  && adminLock.pencil.style.pointerEvents !== 'none');
assert('Admin lock still disables status buttons', adminLock.status.attrs.disabled === 'disabled');
assert('Admin lock still disables notes', adminLock.note.attrs.disabled === 'disabled');
assert('Admin row hides the lock badge over Edit', adminLock.box.classList.has('appr-edit-open'));

const checklistPencil = fakeControl(['cl-scen-pencil']);
lockCtx.bypass = true;
const checklistBox = fakeContainer([checklistPencil]);
lockCtx._applyScenarioGateLock(checklistBox);
assert('Admin checklist pencil stays enabled', checklistPencil.attrs.disabled == null);

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
