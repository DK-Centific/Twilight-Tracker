#!/usr/bin/env node
/* Self-test: Station 1 scenario 1 Lakitu URL popup, approval re-prompt,
 * and recorded-URL precedence for Performance + Approval Open Lakitu.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcPath = path.join(__dirname, '..', 'twilight.js');
const htmlPath = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(srcPath, 'utf8');
const html = fs.readFileSync(htmlPath, 'utf8');

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

console.log('Lakitu session URL prompt self-test (1.3.091830a)');

assert('APP_VERSION 1.3.091830a',
  src.includes("const APP_VERSION = '1.3.091830a'")
  && html.includes('twilight.js?v=twilight-1.3.091830a'));

assert(
  'desktop Station 1 entry offers the existing Lakitu popup',
  /maybeOfferStation1LakituUrl\(station\.key, station1OpeningScenarioNum\(\)\)/.test(src)
    && /isScenarioFlowMode\(\)/.test(src)
);
assert(
  'phone scenario flow offers the popup when scenario 1 is focused',
  /function noteScenarioFlowLakituPrompt\(stationKey, num\)/.test(src)
    && /noteScenarioFlowLakituPrompt\(stationKey, nextNum\)/.test(src)
    && /noteScenarioFlowLakituPrompt\(stationKey, _scenarioFlowFocusNum\)/.test(src)
);
assert(
  'popup reuses promptStation1LakituUrl and recordLakituUrl',
  /url = await promptStation1LakituUrl\(\)/.test(src)
    && /function applyRecordedLakituUrl\(url\)/.test(src)
    && /state\.recordLakituUrl = v/.test(src)
);
assert(
  'approval gate re-prompts only while the URL is still missing',
  /if \(approvalGateNeedsLakituPrompt\(stationKey\)\) \{\s*lakituUrl = await promptStation1LakituUrl\(\);\s*if \(!lakituUrl\) return;/.test(src)
    && /else if \(stationKey === 'station1'\) \{\s*lakituUrl = recordedSessionLakituUrl\(\);/.test(src)
);
assert(
  'read-only admin mirror does not offer the popup',
  /function shouldOfferStation1LakituPrompt[\s\S]{0,500}adminProgressMirrorBlocksWrites\(\)/.test(src)
);
assert(
  'Performance lookup prefers the recorded session URL',
  /const recordedFirst = String\(recordedSessionLakituForAssignment\(asgnId\)/.test(src)
    && /getLakituUrlForAssignment prefers the recorded session URL/.test(src)
);
assert(
  'Approval Open Lakitu prefers the recorded session URL',
  /function resolveApprovalLakituUrl\(appr\) \{\s*const recordedId = appr && \(appr\.assignment_id \|\| appr\.assignmentId\)/.test(src)
);

const sessionUrl = 'https://lakitu.ring.amazon.dev/p/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa?session=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const reviewUrl = 'https://lakitu.ring.amazon.dev/p/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/review?session=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const projectUrl = 'https://lakitu.ring.amazon.dev/?session=366312c2-735e-4062-8e16-ef065f1061df';
const assignedUrl = 'https://lakitu.ring.amazon.dev/?session=64e4968b-7b04-49a0-a0b9-1ab3fb69fd34';

function slice(fromMarker, toMarker, label) {
  const from = src.indexOf(fromMarker);
  const to = src.indexOf(toMarker, from + fromMarker.length);
  if (from < 0 || to <= from) throw new Error('bad slice ' + label);
  return src.slice(from, to);
}

function baseContext(extra) {
  const ctx = {
    console,
    URL,
    state: { recordLakituUrl: '', participantId: '' },
    STATIONS: [{ key: 'station1', scenarios: [{ num: '01', id: 'CAL_EXT', name: 'Extrinsic Calibration' }] }],
    adminState: { perfSessionStateRows: [], teams: [], assignments: [] },
    adminProgressMirrorBlocksWrites: () => false,
    _gateAsgnId: () => 'asgn-1',
    getAssignedLakituUrl: () => assignedUrl,
    saveCount: 0,
    syncCount: 0,
    promptCount: 0,
    promptResult: null,
    saveState() { ctx.saveCount += 1; },
    triggerSessionStateSync() { ctx.syncCount += 1; },
    document: { body: {}, getElementById() { return null; } },
    promptStation1LakituUrl() {
      ctx.promptCount += 1;
      return Promise.resolve(ctx.promptResult);
    },
  };
  Object.assign(ctx, extra || {});
  vm.createContext(ctx);
  return ctx;
}

function loadShared(ctx) {
  vm.runInContext(slice('const LAKITU_URL_RE =', 'function getLakituProjectByKey(key)', 'lakitu url'), ctx);
  vm.runInContext(slice('function isSafeHttpUrl(v)', 'function isSafeHttpsUrl(v)', 'safe http'), ctx);
  vm.runInContext(slice('function isSubmitLakituUrl(v)', 'function lakituInfoPopoverMarkup(idPrefix)', 'submit url'), ctx);
  vm.runInContext(slice('function lakituReviewUrl(url)', '// Centralized renderer for the Lakitu pill', 'review url'), ctx);
  vm.runInContext(slice('function validateLakituUrl(url)', 'function lakituReviewUrl(url)', 'validate'), ctx);
}

function loadPrompt(ctx) {
  loadShared(ctx);
  vm.runInContext(slice(
    'let _station1LakituOfferKey = \'\';',
    'function promptStation1LakituUrl()',
    'prompt helpers'
  ), ctx);
  vm.runInContext(slice(
    'function resolveLakituSessionHref()',
    'function resolveEffectiveLakituUrlForAssignment(asgn, team, override)',
    'open lakitu href'
  ), ctx);
}

function loadLookup(ctx) {
  loadShared(ctx);
  vm.runInContext(slice(
    'let _lakituUrlCache = { sourceRef: null, byAsgnId: {} };',
    'function debugLakituUrlLookup(asgnId)',
    'get lakitu'
  ), ctx);
  vm.runInContext(slice(
    'function resolveApprovalLakituUrl(appr)',
    'const APPROVAL_LAKITU_WINDOW',
    'approval resolve'
  ), ctx);
  vm.runInContext(slice(
    'function resolveLakituSessionHref()',
    'function resolveEffectiveLakituUrlForAssignment(asgn, team, override)',
    'open lakitu href'
  ), ctx);
}

const fresh = baseContext();
loadPrompt(fresh);
assert('popup when Station 1 scenario 1 has no URL', fresh.shouldOfferStation1LakituPrompt('station1', '01') === true);
assert('no popup on Station 2', fresh.shouldOfferStation1LakituPrompt('station2', '01') === false);
assert('no popup on a later Station 1 scenario', fresh.shouldOfferStation1LakituPrompt('station1', '03') === false);

fresh.state.participantId = projectUrl;
assert('assigned project link alone still asks for the session URL', fresh.shouldOfferStation1LakituPrompt('station1', '01') === true);
fresh.state.participantId = sessionUrl;
assert('no popup when a session URL is already pasted', fresh.shouldOfferStation1LakituPrompt('station1', '01') === false);
fresh.state.participantId = '';
fresh.state.recordLakituUrl = sessionUrl;
assert('no popup when recordLakituUrl is already saved', fresh.shouldOfferStation1LakituPrompt('station1', '01') === false);
fresh.state.recordLakituUrl = '';
fresh.adminProgressMirrorBlocksWrites = () => true;
assert('no popup while the read-only checklist mirror is open', fresh.shouldOfferStation1LakituPrompt('station1', '01') === false);
fresh.adminProgressMirrorBlocksWrites = () => false;
assert('popup returns after leaving the mirror', fresh.shouldOfferStation1LakituPrompt('station1', '01') === true);

const saved = baseContext();
loadPrompt(saved);
saved.promptResult = sessionUrl;
saved.maybeOfferStation1LakituUrl('station1', '01').then(() => {
  assert('saving the popup writes recordLakituUrl', saved.state.recordLakituUrl === sessionUrl);
  assert('saving the popup replaces a non-session participant id', saved.state.participantId === sessionUrl);
  assert('saving the popup stores once', saved.saveCount === 1 && saved.syncCount === 1 && saved.promptCount === 1);
  assert('no second popup after the URL is saved', saved.shouldOfferStation1LakituPrompt('station1', '01') === false);
  assert('approval gate does not ask again after save', saved.approvalGateNeedsLakituPrompt('station1') === false);
  assert('Open Lakitu uses the recorded session URL over the assigned project',
    saved.resolveLakituSessionHref() === sessionUrl);

  saved.state.recordLakituUrl = sessionUrl;
  saved.state.participantId = projectUrl;
  assert('recorded session URL beats an auto-bound project link', saved.resolveLakituSessionHref() === sessionUrl);

  const dismissed = baseContext();
  loadPrompt(dismissed);
  dismissed.promptResult = null;
  return dismissed.maybeOfferStation1LakituUrl('station1', '01').then(() => {
    assert('skipping the popup does not write a URL', dismissed.state.recordLakituUrl === '' && dismissed.promptCount === 1);
    assert('skipping does not ask again on scenario 1', dismissed.shouldOfferStation1LakituPrompt('station1', '01') === false);
    assert('approval gate asks again when the URL is still missing', dismissed.approvalGateNeedsLakituPrompt('station1') === true);
    assert('approval gate does not ask for other stations', dismissed.approvalGateNeedsLakituPrompt('station3') === false);
    return dismissed.maybeOfferStation1LakituUrl('station1', '01');
  }).then(() => {
    assert('scenario 1 does not stack a second popup after skip', dismissed.promptCount === 1);
  });
}).then(() => {
  const look = baseContext();
  look.resolveEffectiveLakituUrlForAssignment = () => assignedUrl;
  loadLookup(look);
  const older = {
    assignmentId: 'asgn-1',
    lastActive: '2026-09-30T18:00:00.000Z',
    stateJson: JSON.stringify({ recordLakituUrl: sessionUrl, participantId: projectUrl }),
  };
  const newerProjectOnly = {
    assignmentId: 'asgn-1',
    lastActive: '2026-09-30T20:00:00.000Z',
    stateJson: JSON.stringify({ recordLakituUrl: '', participantId: projectUrl }),
  };
  look.adminState.perfSessionStateRows = [newerProjectOnly, older];
  look.parseLastActiveMs = (v) => Date.parse(v) || 0;
  assert(
    'Performance resolves the recorded session URL ahead of a newer project link',
    look.recordedSessionLakituForAssignment('asgn-1') === sessionUrl
      && look.getLakituUrlForAssignment('asgn-1') === sessionUrl
  );
  look.state.recordLakituUrl = '';
  look.state.participantId = projectUrl;
  assert('mod project paste still opens when no session URL was recorded', look.resolveLakituSessionHref() === projectUrl);
  look.state.participantId = '';
  assert('assigned catalog link is the last resort', look.resolveLakituSessionHref() === assignedUrl);

  const apprRecorded = look.resolveApprovalLakituUrl({
    assignment_id: 'asgn-1',
    lakitu_url: projectUrl,
  });
  assert('Approval Open Lakitu uses the recorded session URL', apprRecorded === reviewUrl, apprRecorded);

  look.adminState.perfSessionStateRows = [];
  look._lakituUrlCache = { sourceRef: null, byAsgnId: {} };
  const apprFallback = look.resolveApprovalLakituUrl({
    approval_id: 'only-assigned',
    assignment_id: 'asgn-missing',
    lakitu_url: '',
  });
  assert('Approval falls back to the assigned project when nothing was recorded',
    apprFallback === assignedUrl, apprFallback);

  const onlyProject = {
    assignmentId: 'asgn-2',
    lastActive: '2026-09-30T21:00:00.000Z',
    stateJson: JSON.stringify({ recordLakituUrl: '', participantId: projectUrl }),
  };
  look.adminState.perfSessionStateRows = [onlyProject];
  assert('no recorded session URL when SessionState only has the project link',
    look.recordedSessionLakituForAssignment('asgn-2') === '');
  assert('Performance still opens the project link when nothing was recorded',
    look.getLakituUrlForAssignment('asgn-2') === projectUrl);

  if (failed) {
    console.error(failed + ' Lakitu session URL prompt checks failed');
    process.exit(1);
  }
  console.log('All ' + passed + ' Lakitu session URL prompt checks passed');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
