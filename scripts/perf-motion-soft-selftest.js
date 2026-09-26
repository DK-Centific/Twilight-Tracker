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

function sliceFn(startMark, endMark) {
  const i = src.indexOf(startMark);
  const j = src.indexOf(endMark, i + startMark.length);
  if (i < 0 || j < 0) return '';
  return src.slice(i, j);
}

console.log('Performance calm motion self-test (1.3.091825m)');

assert('APP_VERSION 1.3.091825m',
  /const APP_VERSION = '1\.3\.091825m'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091825m'));

const perfFn = sliceFn('function renderPerformance(body, opts)', 'function renderPerfTilesHTML');
const incidentFn = sliceFn('function renderIncidentReport', 'function renderIncidentTilesHTML');
assert('sessions tile/filter/date/view queue soft',
  perfFn.includes("perfQueueMotion('soft')")
  && !perfFn.includes("perfQueueMotion('enter')"));
assert('incident tile/filter/date queue soft',
  incidentFn.includes("perfQueueMotion('soft')")
  && !incidentFn.includes("perfQueueMotion('enter')"));
assert('layout and section still crossfade',
  perfFn.includes("perfQueueMotion('crossfade')")
  && src.includes("perfQueueMotion('crossfade')"));
assert('flagged filter sort search use soft fade',
  /fhRefreshBody\(root, \{ motion: 'soft'/.test(src)
  && !/motion: 'restagger'/.test(src));
assert('leaving Flagged queues soft',
  /perfQueueMotion\('soft'\)[\s\S]{0,80}perfRepaintFromFlagged\(/.test(src));
assert('first paint still defaults to Helios enter',
  /_perfMotionKind\) \|\| 'enter'/.test(src)
  && /fhPlayMotion\(root, 'enter'\)/.test(src)
  && html.includes('.perf-shell.perf-enter')
  && html.includes('.fh-shell.fh-enter'));
assert('opening Flagged skips the outer shell fade',
  /kind === 'enter' \|\| kind === 'soft' \|\| kind === 'crossfade'\)\) kind = 'none'/.test(perfFn));
assert('soft fade is opacity-only and 160ms',
  html.includes('@keyframes perfSoftIn')
  && /@keyframes perfSoftIn \{[^}]*from \{ opacity: 0; \}[^}]*to\s+\{\s*opacity: 1; \}/.test(html)
  && html.includes('animation: perfSoftIn 0.16s')
  && html.includes('.fh-body.fh-soft')
  && html.includes('animation: fhFade 0.16s'));
assert('filter fade does not re-enter status tiles or toolbar',
  !/perf-soft > \.perf-status-tiles/.test(html)
  && !/perf-crossfade > \.perf-status-tiles/.test(html)
  && !/perf-crossfade > \.perf-toolbar/.test(html)
  && !/fh-restagger/.test(html)
  && !/\.perf-restagger > #perfTileGrid > \.perf-tile/.test(html));
assert('search uses soft play, not a tile restagger',
  (src.match(/perfPlayMotion\(body, 'soft'\)/g) || []).length >= 2
  && !/classList\.add\('perf-restagger'\)/.test(src));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('all passed');
