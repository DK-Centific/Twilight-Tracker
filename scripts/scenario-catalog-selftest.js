#!/usr/bin/env node
/* Self-test: Admin Checklist scenario catalog edit + changelog undo. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcPath = path.join(__dirname, '..', 'twilight.js');
const src = fs.readFileSync(srcPath, 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const begin = src.indexOf('/* SCENARIO_CATALOG_BEGIN */');
const end = src.indexOf('/* SCENARIO_CATALOG_END */');
if (begin < 0 || end < 0 || end <= begin) {
  console.error('Could not find SCENARIO_CATALOG markers in twilight.js');
  process.exit(1);
}

const context = { console };
vm.createContext(context);
vm.runInContext(src.slice(begin, end + '/* SCENARIO_CATALOG_END */'.length), context);

const {
  scenarioCatalogKey,
  applyScenarioCatalogEdit,
  resolveScenarioCatalogEditorName,
  undoScenarioCatalogChange,
  redoScenarioCatalogChange,
  lastUndoableScenarioChange,
  lastRedoableScenarioChange,
  scenarioCatalogPatchSummary,
  buildScenarioCatalogPayload,
  collectScenarioCatalogFromSessionRows,
  normalizeScenarioCatalog,
  scenarioCatalogEditAllowed,
  scenarioStationTileEditAllowed,
  scenarioCatalogRigFlagsFromFields,
  scenarioCatalogIdIsCalRig,
  buildScenarioCatalogEditorRigCardHTML,
  scenarioCatalogResolvedFields,
  scenarioCatalogDraftEqualsPublished,
  scenarioDescriptionLooksLikeHtml,
  scenarioDescriptionToSafeHtml,
  scenarioDescriptionDisplayHTML,
  scenarioDescriptionBlockHTML,
  scenarioDescriptionSanitizeHtml,
  collectScenarioDescriptionFromEditor,
} = context;

let failed = 0;
function assert(name, cond) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name);
  }
}

console.log('Scenario catalog self-test');

assert('catalog key joins station and num', scenarioCatalogKey('station1', '01') === 'station1|01');

const first = applyScenarioCatalogEdit(
  { overrides: {}, changelog: [] },
  'station1',
  '01',
  { name: 'Air Cal · updated', id: 'CAL_EXT', description: 'Hold the board high', iter: 2 },
  'Admin-Twilight'
);
assert('edit records a changelog entry', first.changed && first.entry && first.entry.id);
assert('edit stamps the passed editor name', first.entry.by === 'Admin-Twilight');
assert('blank editor name falls back to Admin', applyScenarioCatalogEdit(
  { overrides: {}, changelog: [] },
  'station1',
  '01',
  { name: 'Air Cal · blank by', id: 'CAL_EXT', description: 'Hold' },
  '   '
).entry.by === 'Admin');
assert('named admin username wins over profile display name',
  typeof resolveScenarioCatalogEditorName === 'function'
    && resolveScenarioCatalogEditorName({ username: 'jsmith', modProfile: { name: 'Jane Smith' } }) === 'jsmith');
assert('Admin-Twilight login stamps Admin-Twilight',
  resolveScenarioCatalogEditorName({ username: 'Admin-Twilight' }) === 'Admin-Twilight');
assert('admin-orbit alias maps to Admin-Twilight',
  resolveScenarioCatalogEditorName({ username: 'admin-orbit' }) === 'Admin-Twilight');
assert('whitespace username falls back to profile name',
  resolveScenarioCatalogEditorName({ username: '  ', modProfile: { name: 'Ritu Shah' } }) === 'Ritu Shah');
assert('empty session falls back to Admin',
  resolveScenarioCatalogEditorName({}) === 'Admin');
assert('Master Admin named account uses Orbit login id',
  resolveScenarioCatalogEditorName({ username: 'Ritu-Orbit', modProfile: { name: 'Ritu' } }) === 'Ritu-Orbit');
assert('edit stores before/after', first.entry.before.name !== first.entry.after.name
  && first.entry.after.description === 'Hold the board high');
assert('summary names the changed fields', /title|description/.test(scenarioCatalogPatchSummary(first.entry.before, first.entry.after, 'station1')));

const noIter = applyScenarioCatalogEdit(
  {
    overrides: {
      'station1|01': { num: '01', id: 'CAL_EXT', name: 'Air Cal', iter: 2, description: 'old' },
    },
    changelog: [],
  },
  'station1',
  '01',
  { name: 'Air Cal · no iter field', id: 'CAL_EXT', description: 'Hold the board high' },
  'Admin-Twilight'
);
assert('save without iter keeps the previous iteration target', noIter.changed
  && Number(noIter.entry.after.iter) === 2
  && Number(noIter.entry.before.iter) === 2);

const last = lastUndoableScenarioChange(first.catalog);
assert('last undoable is the new edit', last && last.id === first.entry.id);

const sourceBeforeUndo = first.catalog.changelog.find(e => e.id === first.entry.id);
assert('source changelog entry starts active', sourceBeforeUndo && !sourceBeforeUndo.undone);

const undone = undoScenarioCatalogChange(first.catalog, first.entry.id);
assert('undo marks the entry undone', undone.undone && undone.undone.undone);
assert('undo restores override or clears it', !undone.catalog.overrides['station1|01']
  || undone.catalog.overrides['station1|01'].name === first.entry.before.name);
assert('undone entry is no longer last-undoable', !lastUndoableScenarioChange(undone.catalog)
  || lastUndoableScenarioChange(undone.catalog).id !== first.entry.id);
assert('undo clones so the source catalog entry stays active', sourceBeforeUndo && !sourceBeforeUndo.undone);
assert('undone entry is last-redoable', lastRedoableScenarioChange(undone.catalog)
  && lastRedoableScenarioChange(undone.catalog).id === first.entry.id);

const redone = redoScenarioCatalogChange(undone.catalog, first.entry.id);
assert('redo clears the undone flag', redone.redone && !redone.redone.undone);
assert('redo restores the after override', redone.catalog.overrides['station1|01']
  && redone.catalog.overrides['station1|01'].name === first.entry.after.name);
assert('redone entry is last-undoable again', lastUndoableScenarioChange(redone.catalog)
  && lastUndoableScenarioChange(redone.catalog).id === first.entry.id);
assert('redo of an active entry is a no-op', !redoScenarioCatalogChange(redone.catalog, first.entry.id).redone);
assert('draft fingerprint matches after redo', typeof scenarioCatalogDraftEqualsPublished === 'function'
  && scenarioCatalogDraftEqualsPublished(redone.catalog, first.catalog));
assert('draft fingerprint differs after undo', typeof scenarioCatalogDraftEqualsPublished === 'function'
  && !scenarioCatalogDraftEqualsPublished(undone.catalog, first.catalog));

const payload = buildScenarioCatalogPayload(first.catalog);
assert('payload uses scenario catalog setting id', payload.sessionStateId === 'ss_app_setting_scenario_catalog');
assert('payload is upsert overwrite', payload.overwrite === true && payload.writeMode === 'upsert');
const parsed = JSON.parse(payload.stateJson);
assert('payload stateJson key is scenarioCatalog', parsed.type === 'appSetting' && parsed.key === 'scenarioCatalog');

const collected = collectScenarioCatalogFromSessionRows([{
  sessionStateId: 'ss_app_setting_scenario_catalog',
  stateJson: payload.stateJson,
}]);
assert('collect reads the published catalog', collected && collected.changelog.length >= 1);

const empty = normalizeScenarioCatalog(null);
assert('normalize null is empty catalog', empty && empty.changelog.length === 0);

assert('Admin Checklist editor allows Admin in admin app', scenarioCatalogEditAllowed({
  isAdmin: true, adminAppActive: true, isMasterAdmin: false, isReviewer: false,
}));
assert('Admin Checklist editor allows Master Admin', scenarioCatalogEditAllowed({
  isAdmin: true, adminAppActive: false, isMasterAdmin: true, isReviewer: false,
}));
assert('Reviewer cannot edit catalog', !scenarioCatalogEditAllowed({
  isAdmin: false, adminAppActive: false, isMasterAdmin: false, isReviewer: true,
}));
assert('regular Admin outside admin app cannot edit catalog', !scenarioCatalogEditAllowed({
  isAdmin: true, adminAppActive: false, isMasterAdmin: false, isReviewer: false,
}));
assert('station-tile pencils are Master Admin only', scenarioStationTileEditAllowed({
  isMasterAdmin: true, isReviewer: false,
}) && !scenarioStationTileEditAllowed({
  isMasterAdmin: false, isReviewer: false, isAdmin: true,
}) && !scenarioStationTileEditAllowed({
  isMasterAdmin: true, isReviewer: true,
}));

const fullSrc = src;
assert('station tiles render a Master-Admin pencil helper', /function scenarioStationTilePencilHTML\(/.test(fullSrc)
  && /function liveScenarioStationTileEditAllowed\(/.test(fullSrc)
  && /bindScenarioStationTilePencils/.test(fullSrc));
assert('cover-flow tiles include the station pencil', /function scenarioFlowTileHTML\(/.test(fullSrc)
  && /scenarioStationTilePencilHTML\(station, sc\)/.test(fullSrc));
assert('editor from station tiles requires Master Admin', /opts\.fromStation/.test(fullSrc)
  && /liveScenarioStationTileEditAllowed\(\)/.test(fullSrc));
assert('save refreshes station view as well as Checklist', /function refreshScenarioCatalogSurfaces\(/.test(fullSrc));
assert('editor has no Required iterations field', !/Required iterations/.test(fullSrc) && !/scenEditIter/.test(fullSrc));
assert('editor draft no longer writes iter from a number field', /function collectScenarioCatalogEditorDraft\(/.test(fullSrc)
  && !/scenEditIter/.test(fullSrc)
  && /collectScenarioDescriptionFromEditor\(desc\)/.test(fullSrc));
assert('editor description is a Cal Guide style rich editor', /function scenarioCatalogEditorHTML\(/.test(fullSrc)
  && /scen-desc-editor/.test(fullSrc)
  && /contenteditable="true"/.test(fullSrc.slice(fullSrc.indexOf('function scenarioCatalogEditorHTML'), fullSrc.indexOf('function paintScenarioCatalogEditorRigHost')))
  && /renderCalGuideStyleToolbar/.test(fullSrc)
  && /function bindScenarioCatalogEditorDesc\(/.test(fullSrc)
  && /bindCalGuideRichTextCommands/.test(fullSrc)
  && !/<textarea class="tf-note" id="scenEditDesc"/.test(fullSrc));
assert('tiles and station views render sanitized description HTML', /scenarioDescriptionBlockHTML\(sc\.description/.test(fullSrc)
  && /scenarioDescriptionBlockHTML\(\(over && over\.description\)/.test(fullSrc)
  && !/escapeHTML\(sc\.description\)/.test(fullSrc));
assert('editor shows a dedicated cal-rig-card-editor for CAL_EXT / CAL_GND', /function scenarioCatalogEditorRigHTML\(/.test(fullSrc)
  && /scenEditRigHost/.test(fullSrc)
  && /function buildScenarioCatalogEditorRigCardHTML\(/.test(fullSrc)
  && /cal-rig-card-editor/.test(fullSrc)
  && /cal-rig-edit-toggle/.test(fullSrc)
  && /function bindScenarioCatalogEditorRigCard\(/.test(fullSrc));
assert('editor does not reuse the live station calRigChecksHTML card', (() => {
  const start = fullSrc.indexOf('function scenarioCatalogEditorRigHTML');
  const end = fullSrc.indexOf('function applyScenarioCatalogRigsToSession');
  if (start < 0 || end < 0 || end <= start) return false;
  return !/calRigChecksHTML\(/.test(fullSrc.slice(start, end));
})());
assert('editor rig card is draft-editable until save', /function paintScenarioCatalogEditorRigHost\(/.test(fullSrc)
  && /function collectScenarioCatalogEditorDraft\(/.test(fullSrc)
  && /draft\.rig1Completed/.test(fullSrc)
  && /draft\.rig2Completed/.test(fullSrc)
  && /applyScenarioCatalogRigsToSession\(/.test(fullSrc)
  && /function applyScenarioCatalogEditorRigVisuals\(/.test(fullSrc));
assert('editor toggles are buttons, not hidden station checkboxes', /function bindScenarioCatalogEditorRigCard\(/.test(fullSrc)
  && /cal-rig-edit-toggle/.test(fullSrc.slice(fullSrc.indexOf('function bindScenarioCatalogEditorRigCard')))
  && !/applyCalRigInputFromElement\(inp\)/.test(fullSrc.slice(fullSrc.indexOf('function bindScenarioCatalogEditorRigCard')))
  && !/\.cal-rig-input/.test(fullSrc.slice(fullSrc.indexOf('function bindScenarioCatalogEditorRigCard'), fullSrc.indexOf('function bindScenarioCatalogEditorChrome'))));
assert('editor does not rebuild the card on every toggle', /function bindScenarioCatalogEditorRigCard\(/.test(fullSrc)
  && !/paintScenarioCatalogEditorRigHost\(/.test(fullSrc.slice(fullSrc.indexOf('function bindScenarioCatalogEditorRigCard'), fullSrc.indexOf('function bindScenarioCatalogEditorChrome'))));
assert('editor refill does not wait for the open animation', /function bindScenarioCatalogEditorChrome\(/.test(fullSrc)
  && /if \(!modal \|\| modal\.hidden\) return;/.test(fullSrc.slice(fullSrc.indexOf('function bindScenarioCatalogEditorChrome'), fullSrc.indexOf('function collectScenarioCatalogEditorDraft'))));
assert('editor undo/redo is draft-only until save', /function applyScenarioCatalogEditorDraftUndo\(/.test(fullSrc)
  && /function applyScenarioCatalogEditorDraftRedo\(/.test(fullSrc)
  && /function beginScenarioCatalogEditorDraft\(/.test(fullSrc)
  && /function discardScenarioCatalogEditorDraft\(/.test(fullSrc)
  && /refill\(\)/.test(fullSrc.slice(fullSrc.indexOf('function bindScenarioCatalogEditorChrome'), fullSrc.indexOf('function collectScenarioCatalogEditorDraft')))
  && !/persistScenarioCatalogRecord\(/.test(fullSrc.slice(fullSrc.indexOf('function bindScenarioCatalogEditorChrome'), fullSrc.indexOf('function collectScenarioCatalogEditorDraft')))
  && !/applyScenarioCatalogUndoLocal\(/.test(fullSrc.slice(fullSrc.indexOf('function bindScenarioCatalogEditorChrome'), fullSrc.indexOf('function collectScenarioCatalogEditorDraft'))));
const draftUndoFn = fullSrc.slice(fullSrc.indexOf('function applyScenarioCatalogEditorDraftUndo'), fullSrc.indexOf('function applyScenarioCatalogEditorDraftRedo'));
assert('draft undo does not persist or touch the live session', /undoScenarioCatalogChange\(_scenarioCatalogDraft/.test(draftUndoFn)
  && !/saveScenarioCatalogCache/.test(draftUndoFn)
  && !/persistScenarioCatalogRecord/.test(draftUndoFn)
  && !/applyScenarioCatalogRigsToSession/.test(draftUndoFn)
  && !/refreshScenarioCatalogSurfaces/.test(draftUndoFn));
const draftRedoFn = fullSrc.slice(fullSrc.indexOf('function applyScenarioCatalogEditorDraftRedo'), fullSrc.indexOf('function bindScenarioCatalogEditorChrome'));
assert('draft redo does not persist or touch the live session', /redoScenarioCatalogChange\(_scenarioCatalogDraft/.test(draftRedoFn)
  && !/saveScenarioCatalogCache/.test(draftRedoFn)
  && !/persistScenarioCatalogRecord/.test(draftRedoFn)
  && !/applyScenarioCatalogRigsToSession/.test(draftRedoFn));
assert('cancel/close discards the editor draft', /function closeScenarioCatalogEditor\(/.test(fullSrc)
  && /discardScenarioCatalogEditorDraft\(\)/.test(fullSrc.slice(fullSrc.indexOf('function closeScenarioCatalogEditor'), fullSrc.indexOf('function persistScenarioCatalogRecord'))));
assert('save publishes the draft catalog', /function submitScenarioCatalogEditor\(/.test(fullSrc)
  && /_scenarioCatalogDraft/.test(fullSrc.slice(fullSrc.indexOf('function submitScenarioCatalogEditor'), fullSrc.indexOf('function applyScenarioCatalogUndoLocal')))
  && /persistScenarioCatalogRecord\(catalog\)/.test(fullSrc.slice(fullSrc.indexOf('function submitScenarioCatalogEditor'), fullSrc.indexOf('function applyScenarioCatalogUndoLocal'))));
assert('changelog marks undone rows as redoable in the editor', /draftMode: true/.test(fullSrc)
  && /scen-log-redo/.test(fullSrc)
  && /tap to redo/.test(fullSrc)
  && /is-redoable/.test(fullSrc)
  && /scen-log-row\.is-undone\[data-chg\]/.test(fullSrc));
assert('editor rig flags do not fall back to the live session row', /function scenarioCatalogEditorRigFlags\(/.test(fullSrc)
  && /rig1: false, rig2: false/.test(fullSrc.slice(fullSrc.indexOf('function scenarioCatalogEditorRigFlags'), fullSrc.indexOf('function scenarioCatalogEditorRigHTML')))
  && !/state\.stations\[stationKey\]/.test(fullSrc.slice(fullSrc.indexOf('function scenarioCatalogEditorRigFlags'), fullSrc.indexOf('function scenarioCatalogEditorRigHTML'))));

const rigFlags = scenarioCatalogRigFlagsFromFields(
  { rig1Completed: true, rig2Completed: false },
  { rig1: false, rig2: true }
);
assert('catalog rig flags prefer explicit fields', rigFlags.rig1 === true && rigFlags.rig2 === false);

const onlyRigs = applyScenarioCatalogEdit(
  {
    overrides: {
      'station1|01': { num: '01', id: 'CAL_EXT', name: 'Air Cal', iter: 2, description: 'Hold the board high' },
    },
    changelog: [],
  },
  'station1',
  '01',
  { name: 'Air Cal', id: 'CAL_EXT', description: 'Hold the board high', rig1Completed: true, rig2Completed: true },
  'Admin-Twilight'
);
assert('rig-only save is a catalog change', onlyRigs.changed && onlyRigs.entry.after.rig1Completed === true
  && onlyRigs.entry.after.rig2Completed === true);
assert('changelog names Rig 1 / Rig 2', /Rig 1/.test(onlyRigs.entry.summary) && /Rig 2/.test(onlyRigs.entry.summary));

const undoneRigs = undoScenarioCatalogChange(onlyRigs.catalog, onlyRigs.entry.id);
assert('undo restores previous rig flags', undoneRigs.undone
  && !undoneRigs.catalog.overrides['station1|01'].rig1Completed
  && !undoneRigs.catalog.overrides['station1|01'].rig2Completed);
const redoneRigs = redoScenarioCatalogChange(undoneRigs.catalog, onlyRigs.entry.id);
assert('redo restores published rig flags', redoneRigs.redone
  && redoneRigs.catalog.overrides['station1|01'].rig1Completed
  && redoneRigs.catalog.overrides['station1|01'].rig2Completed);

assert('resolved fields prefer draft override over live tiles', typeof scenarioCatalogResolvedFields === 'function'
  && scenarioCatalogResolvedFields('station1', '01', {
    overrides: { 'station1|01': { num: '01', id: 'CAL_EXT', name: 'Draft title', description: 'from draft' } },
    changelog: [],
  }).name === 'Draft title');

assert('cal id helper trims and ignores case', typeof scenarioCatalogIdIsCalRig === 'function'
  && scenarioCatalogIdIsCalRig(' cal_ext ')
  && scenarioCatalogIdIsCalRig({ id: 'Cal_Gnd' })
  && !scenarioCatalogIdIsCalRig({ id: 'CAL_PHONE' })
  && !scenarioCatalogIdIsCalRig({ id: '3' }));

const editorCard = typeof buildScenarioCatalogEditorRigCardHTML === 'function'
  ? buildScenarioCatalogEditorRigCardHTML({ rig1: true, rig2: false })
  : '';
assert('editor card HTML is a dedicated interactive control', /cal-rig-card-editor/.test(editorCard)
  && /Catalog default · editable/.test(editorCard)
  && /cal-rig-edit-toggle/.test(editorCard)
  && /aria-pressed="true"/.test(editorCard)
  && /aria-pressed="false"/.test(editorCard)
  && !/cal-rig-input/.test(editorCard)
  && !/type="checkbox"/.test(editorCard)
  && !/Mark each rig/.test(editorCard)
  && !/Approval review unlocks/.test(editorCard));
const emptyCard = typeof buildScenarioCatalogEditorRigCardHTML === 'function'
  ? buildScenarioCatalogEditorRigCardHTML({ rig1: false, rig2: false })
  : '';
assert('editor card still renders when both rigs are off', /cal-rig-card-editor/.test(emptyCard)
  && /Rig 1/.test(emptyCard)
  && /Rig 2/.test(emptyCard));

assert('APP_VERSION is 1.3.091820b', /const APP_VERSION = '1\.3\.091820b'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091820b'));
assert('editor change log is capped to 5.5 rows with hidden scrollbars',
  html.includes('#scenCatalogModal .scen-log')
    && html.includes('5.5 * var(--scen-log-row-h)')
    && html.includes('scrollbar-width: none')
    && html.includes('#scenCatalogModal .scen-log::-webkit-scrollbar'));
assert('save stamps trimmed editor name on changelog.by',
  /by:\s*String\(adminName \|\| ''\)\.trim\(\) \|\| 'Admin'/.test(src)
    && /function resolveScenarioCatalogEditorName\(/.test(src)
    && /function scenarioCatalogAdminName\(/.test(src)
    && /applyScenarioCatalogEdit\(catalog, stationKey, num, fieldDraft, scenarioCatalogAdminName\(\)\)/.test(src));
assert('changelog redo styles distinguish undone rows', /#scenCatalogModal \.scen-log-row\.is-undone\.is-redoable/.test(html)
  && /\.scen-log-redo/.test(html)
  && /text-decoration: line-through/.test(html));
assert('scenario editor reuses Cal Guide rich CSS', /#scenCatalogModal \.scen-desc-editor/.test(html)
  && /\.tf-editor\.cg-rich/.test(html)
  && /\.cg-callout-tools/.test(html));

assert('plain description is not treated as HTML', typeof scenarioDescriptionLooksLikeHtml === 'function'
  && !scenarioDescriptionLooksLikeHtml('Hold the board high')
  && !scenarioDescriptionLooksLikeHtml('use <3 seconds')
  && scenarioDescriptionLooksLikeHtml('<strong>Hold</strong> the board'));
assert('plain description stays readable', typeof scenarioDescriptionToSafeHtml === 'function'
  && scenarioDescriptionToSafeHtml('Hold the board high') === 'Hold the board high'
  && scenarioDescriptionToSafeHtml('line1\nline2') === 'line1<br>line2');
assert('rich description keeps color and style', typeof scenarioDescriptionDisplayHTML === 'function'
  && /<strong>Hold<\/strong>/.test(scenarioDescriptionDisplayHTML('<span style="color:#ef4444"><strong>Hold</strong></span> the board'))
  && /color:#ef4444/.test(scenarioDescriptionDisplayHTML('<span style="color:#ef4444"><strong>Hold</strong></span> the board')));
assert('description sanitize strips script XSS', typeof scenarioDescriptionSanitizeHtml === 'function'
  && /Hi/.test(scenarioDescriptionSanitizeHtml('<script>alert(1)</script>Hi'))
  && !/<script/i.test(scenarioDescriptionSanitizeHtml('<script>alert(1)</script>Hi'))
  && !/\sonerror/i.test(scenarioDescriptionSanitizeHtml('<div onerror=alert(1)>Hi</div>')));
assert('description tile wrapper uses the class', typeof scenarioDescriptionBlockHTML === 'function'
  && scenarioDescriptionBlockHTML('', 'cl-scen-desc') === ''
  && /cl-scen-desc/.test(scenarioDescriptionBlockHTML('Hold the board', 'cl-scen-desc'))
  && /Hold the board/.test(scenarioDescriptionBlockHTML('Hold the board', 'cl-scen-desc')));
assert('editor collect reads contenteditable innerHTML', typeof collectScenarioDescriptionFromEditor === 'function'
  && collectScenarioDescriptionFromEditor({ isContentEditable: true, innerHTML: '<strong>Hold</strong>' }) === '<strong>Hold</strong>'
  && collectScenarioDescriptionFromEditor({ isContentEditable: true, innerHTML: '<br>' }) === ''
  && collectScenarioDescriptionFromEditor({ isContentEditable: false, value: '  Hold the board  ' }) === 'Hold the board');
assert('font color input is normalized to a hex span', typeof scenarioDescriptionSanitizeHtml === 'function'
  && scenarioDescriptionSanitizeHtml('<font color="#ef4444">Hold</font>') === '<span style="color:#ef4444">Hold</span>'
  && /color:#ef4444/.test(scenarioDescriptionDisplayHTML('<font color="#ef4444">Hold</font>'))
  && /Hold/.test(scenarioDescriptionDisplayHTML('<font color="#ef4444">Hold</font>'))
  && !/<font/i.test(scenarioDescriptionDisplayHTML('<font color="#ef4444">Hold</font>')));
assert('collect keeps applied hex color on a span',
  /color:#ef4444/.test(collectScenarioDescriptionFromEditor({
    isContentEditable: true,
    innerHTML: '<span style="color:#ef4444">Hold</span>',
  }))
  && collectScenarioDescriptionFromEditor({
    isContentEditable: true,
    innerHTML: '<font color="#ef4444">Hold</font>',
  }) === '<span style="color:#ef4444">Hold</span>');
assert('color swatches wrap spans instead of font/foreColor', /function calGuideApplyTextColor\(/.test(fullSrc)
  && /calGuideApplyTextColor\(color, lastEdit, savedRange\)/.test(fullSrc)
  && /pointerdown/.test(fullSrc.slice(fullSrc.indexOf('function bindCalGuideRichTextCommands'), fullSrc.indexOf('function bindCalGuideEditor')))
  && !/execCommand\(\s*['"]foreColor['"]/.test(fullSrc));
assert('tile description CSS does not force descendant color',
  !/\.cl-scen-desc\s+[^{]+\{[^}]*\bcolor:/.test(html)
  && !/\.scenario-desc\s+[^{]+\{[^}]*\bcolor:/.test(html)
  && !/\.sc-flow-desc\s+[^{]+\{[^}]*\bcolor:/.test(html));

const richEdit = applyScenarioCatalogEdit(
  { overrides: {}, changelog: [] },
  'station1',
  '01',
  { name: 'Air Cal · styled', id: 'CAL_EXT', description: '<span style="color:#ef4444"><strong>Hold</strong> high</span>' },
  'Admin-Twilight'
);
assert('changelog tracks rich description changes', richEdit.changed
  && /description/.test(richEdit.entry.summary)
  && /<strong>Hold<\/strong>/.test(richEdit.entry.after.description)
  && /color:#ef4444/.test(richEdit.entry.after.description));

if (failed) {
  console.error(failed + ' scenario catalog checks failed');
  process.exit(1);
}
console.log('All scenario catalog checks passed');
