#!/usr/bin/env node
/* Self-test: Admin Checklist scenario catalog edit + changelog undo. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcPath = path.join(__dirname, '..', 'twilight.js');
const src = fs.readFileSync(srcPath, 'utf8');
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
  undoScenarioCatalogChange,
  lastUndoableScenarioChange,
  scenarioCatalogPatchSummary,
  buildScenarioCatalogPayload,
  collectScenarioCatalogFromSessionRows,
  normalizeScenarioCatalog,
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
assert('edit stores before/after', first.entry.before.name !== first.entry.after.name
  && first.entry.after.description === 'Hold the board high');
assert('summary names the changed fields', /title|description/.test(scenarioCatalogPatchSummary(first.entry.before, first.entry.after, 'station1')));

const last = lastUndoableScenarioChange(first.catalog);
assert('last undoable is the new edit', last && last.id === first.entry.id);

const undone = undoScenarioCatalogChange(first.catalog, first.entry.id);
assert('undo marks the entry undone', undone.undone && undone.undone.undone);
assert('undo restores override or clears it', !undone.catalog.overrides['station1|01']
  || undone.catalog.overrides['station1|01'].name === first.entry.before.name);
assert('undone entry is no longer last-undoable', !lastUndoableScenarioChange(undone.catalog)
  || lastUndoableScenarioChange(undone.catalog).id !== first.entry.id);

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

if (failed) {
  console.error(failed + ' scenario catalog checks failed');
  process.exit(1);
}
console.log('All scenario catalog checks passed');
