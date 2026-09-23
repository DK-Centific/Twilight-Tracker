#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

console.log('Performance hub redirect + click latency (1.3.091823b)');

assert('APP_VERSION 1.3.091823b',
  /const APP_VERSION = '1\.3\.091823b'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091823b'));

const paintFn = src.match(/function moderatorLoadPaintTarget\(tab, subtab\) \{[\s\S]*?\n\}/);
assert('paint target helper exists', !!paintFn);
if (paintFn) {
  const fn = new Function(paintFn[0] + '\nreturn moderatorLoadPaintTarget;')();
  assert('Performance directory load does not paint the hub',
    fn('performance', 'moderators') === 'performance');
  assert('default hub subtab still paints the hub',
    fn('moderators', 'moderators') === 'hub');
  assert('Overview directory load does not paint the hub',
    fn('overview', 'moderators') === 'overview');
  assert('Participants subtab on Performance still is not the hub',
    fn('performance', 'participants') === 'performance');
  assert('assignment deep path stays assignment',
    fn('assignment', 'moderators') === 'assignment');
}

assert('hub renderer refuses to write #subtabBody off the hub tab',
  /function renderModerators\(\) \{[\s\S]{0,1200}adminState\.tab !== 'moderators'/.test(src));
assert('participants renderer refuses to write #subtabBody off the hub tab',
  /function renderParticipants\(\) \{[\s\S]{0,1600}adminState\.tab !== 'moderators'/.test(src));
assert('directory load finishes through paintAfterModeratorLoad',
  /paintAfterModeratorLoad\(\)/.test(src)
  && !/else \{\s*renderModerators\(\);\s*\}/.test(src.slice(src.indexOf('async function loadModerators'))));

assert('filter clicks schedule one repaint instead of a full mount',
  /function schedulePerfInteractiveRepaint\(/.test(src)
  && /schedulePerfInteractiveRepaint\(body\)/.test(src));
assert('live signature does not rebuild tile HTML',
  /function perfSessionsBodyFingerprint\(/.test(src)
  && !/perfLiveContentSig\(\) \{[\s\S]{0,1800}renderPerfTilesHTML\(/.test(src));
assert('tile reaction is shorter than the first-open motion',
  /color 0\.09s var\(--perf-ease\)/.test(html)
  && html.includes('animation: perfSoftIn 0.16s')
  && html.includes('.perf-shell.perf-enter'));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('all passed');
