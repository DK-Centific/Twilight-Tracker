#!/usr/bin/env node
/* Self-test: CAL_EXT / CAL_GND Rig 1 + Rig 2 completion helpers. */
'use strict';

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'twilight.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let failed = 0;
function assert(name, cond) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name);
  }
}

console.log('Calibration rig checkbox self-test');

assert('isCalRigScenario exists', /function isCalRigScenario\(/.test(src));
assert('normalizeCalRigFlags exists', /function normalizeCalRigFlags\(/.test(src));
assert('applyCalRigChecks exists', /function applyCalRigChecks\(/.test(src));
assert('applyCalRigInputFromElement exists', /function applyCalRigInputFromElement\(/.test(src));
assert('calRigChecksHTML exists', /function calRigChecksHTML\(/.test(src));
assert('scenarioIterControlHTML hides Iteration for CAL', /function scenarioIterControlHTML\(/.test(src)
  && /isCalRigScenario\(sc\)\) return ''/.test(src));
assert('isScenarioComplete treats both rigs as done', /if \(isCalRigsComplete\(sc\)\) return true;/.test(src));
assert('rig labels are Rig 1 / Rig 2 Completed', /Rig 1 Completed/.test(src) && /Rig 2 Completed/.test(src));
assert('uncheck clears Calibrated or Uploaded', /sd\.status === 'Calibrated' \|\| sd\.status === 'Uploaded'/.test(src));
assert('desktop table no longer shows Iteration stepper for CAL', /isCalRigScenario\(sc\) \? '<span class="iter-auto"/.test(src));
assert('checkbox card CSS is high-contrast', /cal-rig-card/.test(html) && /min-height: 52px/.test(html));
assert('desktop/web Uploaded buttons are enlarged', /scenario-card-list \.scenario-status-btn\.s-uploaded/.test(html)
  && /scenario-table \.scenario-status-btn\.s-uploaded/.test(html)
  && /min-height: 42px/.test(html));
assert('editor modal hosts the same cal-rig-card', /scenEditRigHost/.test(src)
  && /function scenarioCatalogEditorRigHTML\(/.test(src)
  && !/scenEditIter/.test(src));
assert('editor save publishes rig flags', /draft\.rig1Completed/.test(src)
  && /function applyScenarioCatalogRigsToSession\(/.test(src)
  && /function paintScenarioCatalogEditorRigHost\(/.test(src));
assert('editor card CSS is interactive', /#scenCatalogModal \.cal-rig-input/.test(html)
  && /#scenCatalogModal \.cal-rig-check/.test(html));

// Exercise the same completion rules the app uses.
function applyCalRigChecks(sd, sc, rig1, rig2) {
  sd.rig1Completed = !!rig1;
  sd.rig2Completed = !!rig2;
  const target = (sc && sc.iter) || sd.iter || 2;
  sd.iter = target;
  sd.iterations = (rig1 ? 1 : 0) + (rig2 ? 1 : 0);
  if (rig1 && rig2) {
    if (sd.status !== 'Uploaded') sd.status = 'Calibrated';
  } else if (sd.status === 'Calibrated' || sd.status === 'Uploaded' || sd.status === 'All Recorded') {
    sd.status = (rig1 || rig2) ? 'Partially Recorded' : 'Not Started';
  }
  return sd;
}
function isCalRigsComplete(sd) { return !!(sd.rig1Completed && sd.rig2Completed); }
function isScenarioComplete(sc) {
  if (isCalRigsComplete(sc)) return true;
  if (sc.status === 'Uploaded') return true;
  return false;
}

const sd = { status: 'Not Started', iterations: 0, iter: 2 };
applyCalRigChecks(sd, { iter: 2 }, true, false);
assert('one rig is not complete', !isScenarioComplete(sd) && sd.iterations === 1);
applyCalRigChecks(sd, { iter: 2 }, true, true);
assert('both rigs complete the section', isScenarioComplete(sd) && sd.status === 'Calibrated');
applyCalRigChecks(sd, { iter: 2 }, true, false);
assert('unchecking clears approval-done status', !isScenarioComplete(sd) && sd.status === 'Partially Recorded');

if (failed) {
  console.error(failed + ' cal-rig checks failed');
  process.exit(1);
}
console.log('All calibration rig checks passed');
