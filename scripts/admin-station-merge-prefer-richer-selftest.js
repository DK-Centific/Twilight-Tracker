#!/usr/bin/env node
'use strict';
/**
 * 1.3.091820w — Admin Performance station panel soft-merges teammate
 * SessionState maps with pickBetterScenario. A newer partial heartbeat
 * (Muhammad Station3 2/8) must not clobber a completed teammate map
 * (Sravya 8/8). Approval Pending vs session-complete is covered in
 * approval-one-per-team-selftest.js.
 */
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

console.log('Admin station merge prefer-richer self-test (1.3.091820w)');

assert('APP_VERSION 1.3.091820w',
  /const APP_VERSION = '1\.3\.091820w'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091820w'));

assert('mergeStationMapsPreferRicher helper present',
  /function mergeStationMapsPreferRicher\(dst, src\)/.test(src)
  && /function stationMapProgressScore\(stationData\)/.test(src));

assert('renderPerfStationListHTML uses prefer-richer merge',
  /mergeStationMapsPreferRicher\(merged\.stations, st\.stations\)/.test(src)
  && /isGeoPresenceOrRemoteSessionStateRow/.test(src)
  && !/if \(!merged\.stations\[key\]\) merged\.stations\[key\] = st\.stations\[key\];/.test(src));

assert('Approved-beats-Pending helpers present',
  /function approvalStatusIsTerminalApprove/.test(src)
  && /function approvalStatusIsOpen/.test(src)
  && /aTerm && approvalStatusIsOpen\(prev\.status\)/.test(src));

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
  console, String, Map, Set, Array, Object,
  isScenarioDoneForStation(sc) {
    if (!sc) return false;
    return sc.status === 'Uploaded' || sc.status === 'Completed' || sc.status === 'Calibrated';
  },
  isScenarioComplete(sc) { return ctx.isScenarioDoneForStation(sc); },
};
vm.createContext(ctx);
vm.runInContext(
  extractFn('scenarioProgressRank') + '\n'
  + extractFn('pickBetterScenario') + '\n'
  + extractFn('stationMapProgressScore') + '\n'
  + extractFn('mergeStationMapsPreferRicher'),
  ctx
);

function stMap(done, total) {
  const scenarios = {};
  for (let i = 1; i <= total; i++) {
    const id = String(i).padStart(2, '0');
    scenarios[id] = { status: i <= done ? 'Uploaded' : 'Not Started', notes: '', iterations: 0 };
  }
  return { cameras: {}, scenarios };
}

const muhammad = { station3: stMap(2, 8), station1: stMap(0, 18) };
const sravya = {
  station1: stMap(18, 18),
  station2: stMap(14, 14),
  station3: stMap(8, 8),
  station4: stMap(4, 4),
};

// Newer-but-emptier first (as lastActive-desc would walk Muhammad first)
let merged = ctx.mergeStationMapsPreferRicher({}, muhammad);
merged = ctx.mergeStationMapsPreferRicher(merged, sravya);
const st3 = merged.station3;
const done3 = Object.values(st3.scenarios).filter(s => ctx.isScenarioDoneForStation(s)).length;
assert('Sravya 8/8 wins after Muhammad 2/8 first',
  done3 === 8 && Object.keys(st3.scenarios).length === 8,
  'done=' + done3);

// Reverse order
merged = ctx.mergeStationMapsPreferRicher({}, sravya);
merged = ctx.mergeStationMapsPreferRicher(merged, muhammad);
const done3b = Object.values(merged.station3.scenarios).filter(s => ctx.isScenarioDoneForStation(s)).length;
assert('Muhammad 2/8 after Sravya cannot downgrade',
  done3b === 8, 'done=' + done3b);

assert('Station1 fully done preserved',
  Object.values(merged.station1.scenarios).every(s => ctx.isScenarioDoneForStation(s)));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
