#!/usr/bin/env node
/* Self-test: E2E approval / arrival / session-date fixes (v1.3.091626s).
 * Covers contradictory Approved+Rejected copy, undo-arrival confirm,
 * Reviewer side-panel openers, session-date chrome, and arrival helper copy.
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

console.log('E2E approval / arrival / session-date self-test');

assert('APP_VERSION is 1.3.091820m', /const APP_VERSION = '1\.3\.091820m'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091820m'));

assert(
  'Approved panel does not render leftover Rejected-by copy',
  /approvalQaFeedbackHtml\(a\.feedback_note \|\| '', a\.decided_by, a\.status\)/.test(src)
    && /if \(isApproved\) return ''/.test(src)
);

assert(
  'undo-arrival uses in-app confirm titled Undo arrival?',
  /title: 'Undo arrival\?'/.test(src)
    && /function confirmUndoOperatorArrival\(/.test(src)
    && /function undoOperatorArrival\(/.test(src)
    && /if \(!confirm\('Undo arrival\? The progress-reminder timer will reset\.'\)\) return;/.test(src) === false
);

assert(
  'undo-arrival clears arrivedAt and calls renderApp/refreshGeoFlowUi',
  /state\.arrivedAt = ''/.test(src)
    && /state\.suppressAutoArrival = true/.test(src)
    && /allowDowngrade: true/.test(src)
    && /refreshGeoFlowUi/.test(src)
    && /confirmUndoOperatorArrival\(\)/.test(src)
);

assert(
  'Reviewer/Admin Approval Lakitu+Ring stay on sidePanel + #apprPanel',
  /\{ layout: 'sidePanel' \}/.test(src)
    && /document\.addEventListener\('click', onApprovalExternalOpenClick, true\)/.test(src)
    && /bindApprovalExternalOpeners\(panel\)/.test(src)
    && /startReviewerApp\(\) \{[\s\S]{0,220}adminState\.tab = 'approval'/.test(src)
);

assert(
  'session date chrome follows the active assignment',
  /function sessionDateChromeLabel\(/.test(src)
    && /function syncSessionDateFromActiveAssignment\(/.test(src)
    && /sessionDateChromeLabel\(arrivedAsgn\)/.test(src)
    && /syncSessionDateFromActiveAssignment\(asgn\)/.test(src)
);

assert(
  'Confirm Arrival disabled copy names equipment and/or fence',
  /function arrivalUnlockHelper\(/.test(src)
    && /all required equipment is packed/.test(src)
    && /you are inside the assigned address area/.test(src)
    && /Confirm Arrival unlocks when /.test(src)
);

assert(
  'arrival unlock uses shared context + welcome banner refresh',
  /function resolveArrivalUnlockContext\(/.test(src)
    && /function applyArrivalUnlockUi\(/.test(src)
    && /id="welcomeWorklogBanner"/.test(src)
    && /scheduleArrivalUnlockUiRefresh/.test(src)
);

assert(
  'welcome home shows equipment checklist with wired confirm button',
  /operator-home-setup/.test(src)
    && /equipmentCardHTML\(\)/.test(src)
    && /bindEquipmentRows\(\)/.test(src)
    && /Confirm equipment packed/.test(src)
    && (/eq-confirm-packed-btn/.test(html) || /eq-confirm-packed-btn/.test(src))
);

const escapeBegin = src.indexOf('function escapeHTML(s)');
const escapeEnd = src.indexOf('/* =====================================================================\n   ADMIN APP');
assert('escapeHTML slice located', escapeBegin >= 0 && escapeEnd > escapeBegin);

const qaBegin = src.indexOf('const APPROVAL_QA_REASONS = [');
const qaEnd = src.indexOf('function collectApprovalQaReasonIds()');
assert('approval QA helpers slice located', qaBegin >= 0 && qaEnd > qaBegin);

const dateBegin = src.indexOf('function formatSessionDateYmd(ymd)');
const dateEnd = src.indexOf('function todayPretty()') > dateBegin
  ? src.indexOf('/* =====================================================================\n   PERSISTENCE')
  : src.indexOf('/* =====================================================================\n   PERSISTENCE');
assert('session date helper slice located', dateBegin >= 0 && dateEnd > dateBegin);

const arrivalBegin = src.indexOf('function requiredEquipmentPacked(eqState)');
const arrivalEnd = src.indexOf('function refreshArrivalUnlockControls()');
assert('arrival helper slice located', arrivalBegin >= 0 && arrivalEnd > arrivalBegin);

const context = {
  console,
  state: { equipment: {} },
  EQUIPMENT_LIST: [
    { id: 'cam', optional: false },
    { id: 'tripod', optional: false },
    { id: 'snack', optional: true },
  ],
};
vm.createContext(context);
vm.runInContext(src.slice(escapeBegin, escapeEnd), context);
vm.runInContext(src.slice(qaBegin, qaEnd), context);
vm.runInContext(src.slice(dateBegin, src.indexOf('/* =====================================================================\n   PERSISTENCE')), context);
vm.runInContext(src.slice(arrivalBegin, arrivalEnd), context);

assert(
  'Approved status yields no Rejected-by HTML',
  context.approvalQaFeedbackHtml('QA leftover', 'Admin-Twilight', 'Approved') === ''
);
assert(
  'AutoApproved status yields no Rejected-by HTML',
  context.approvalQaFeedbackHtml('', 'Admin-Twilight', 'AutoApproved') === ''
);
const rejectedHtml = context.approvalQaFeedbackHtml('', 'Admin-Twilight', 'Rejected');
assert(
  'Rejected status still names the reviewer',
  rejectedHtml.indexOf('Rejected by Admin-Twilight') >= 0,
  rejectedHtml
);

assert(
  'wrong stored date conflicts with the active assignment',
  context.sessionDateConflictsWithAssignment('2024-09-10', '2026-09-15', '2026-09-16') === true
);
assert(
  'matching assignment date is not a conflict',
  context.sessionDateConflictsWithAssignment('2026-09-15', '2026-09-15', '2026-09-16') === false
);

const both = context.arrivalUnlockHelper('worklog', { known: true, inside: false, reason: 'outside' }, false);
assert(
  'both gates name equipment and fence',
  /equipment is packed/.test(both.helper) && /inside the assigned address area/.test(both.helper),
  both.helper
);
const eqOnly = context.arrivalUnlockHelper('worklog', { known: true, inside: true, reason: '' }, false);
assert(
  'equipment-only helper mentions packed equipment',
  /equipment is packed/.test(eqOnly.helper) && !/inside the assigned address area/.test(eqOnly.helper),
  eqOnly.helper
);
const fenceOnly = context.arrivalUnlockHelper('worklog', { known: true, inside: false, reason: 'outside' }, true);
assert(
  'fence-only helper mentions the assigned address area',
  /inside the assigned address area/.test(fenceOnly.helper) && !/equipment is packed/.test(fenceOnly.helper),
  fenceOnly.helper
);
const ready = context.arrivalUnlockHelper('worklog', { known: true, inside: true }, true);
assert('both gates met unlocks Confirm Arrival', ready.unlocked === true);

assert(
  'catalog draft undo/redo helpers still present',
  /function undoScenarioCatalogChange\(/.test(src)
    && /keep scenario-editor undo\/redo in a draft/.test(src) === false
    && /function applyScenarioCatalogRigsToSession\(/.test(src)
    && /cal-rig-card-editor/.test(src)
);

console.log('');
console.log(failed ? `FAILED ${failed} · passed ${passed}` : `All ${passed} checks passed`);
process.exit(failed ? 1 : 0);
