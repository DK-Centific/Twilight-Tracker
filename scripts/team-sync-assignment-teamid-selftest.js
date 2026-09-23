#!/usr/bin/env node
'use strict';
/**
 * 1.3.091820x — Team sync audit pack
 * - assignmentId match ignores teamId diverge
 * - freshness from progressAt when lastActive null
 * - soft-merge when score ahead (even with local partial)
 * - _lastSyncMergeScore so Decline cannot block richer later sync
 * - Team sync complete toast on auto + manual merge
 */
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

console.log('team-sync-assignment-teamid-selftest (1.3.091823c)');
assert('APP_VERSION 1.3.091823c', /const APP_VERSION = '1\.3\.091823c'/.test(src));
assert('index cache-bust 823c', /twilight\.js\?v=twilight-1\.3\.091823c/.test(html));
assert('sessionStateRowFreshnessMs helper', /function sessionStateRowFreshnessMs\(/.test(src));
assert('sessionStateRowFreshnessIso helper', /function sessionStateRowFreshnessIso\(/.test(src));
assert('isStale falls back to freshness when lastActive empty',
  /let atMs = parseLastActiveMs\(lastActive\);/.test(src)
  && /sessionStateRowFreshnessMs\(null, syncableState\)/.test(src));
assert('pickLatest uses freshness for lastActiveMs',
  /lastActiveMs: sessionStateRowFreshnessMs\(r, parsed\)/.test(src));
assert('sessionStateRowTeamId uses resolved assignment id', (() => {
  const start = src.indexOf('function sessionStateRowTeamId');
  const end = src.indexOf('\nfunction ', start + 10);
  return /sessionStateRowResolvedAssignmentId/.test(src.slice(start, end > start ? end : start + 800));
})());
assert('pickLatestTeamProgress: assignment match skips teamId exclude',
  /Same assignmentId is authoritative/.test(src));
assert('soft-merge when teammateNewer via score > lastMergeScore',
  /teammateScore > myScore && teammateScore > lastMergeScore/.test(src));
assert('_lastSyncMergeScore stamped on auto-merge',
  /state\._lastSyncMergeScore = teammateScore/.test(src));
assert('modal gated by lastMergeScore not wall-clock alone',
  /teammateScoreForModal <= lastMergeScoreForModal/.test(src));
assert('formatTeamSyncCompleteToast helper',
  /function formatTeamSyncCompleteToast\(/.test(src)
  && /Team sync complete/.test(src));
assert('auto-merge shows Team sync complete toast', (() => {
  const i = src.indexOf('Soft-merge + banner (1.3.091820x)');
  const slice = src.slice(i, i + 3500);
  return /formatTeamSyncCompleteToast/.test(slice) && /showToast\(msg, 'success'/.test(slice);
})());
assert('forceTeammateSync shows Team sync complete toast', (() => {
  const start = src.indexOf('window.forceTeammateSync = async function forceTeammateSync');
  const slice = src.slice(start, start + 4000);
  return /formatTeamSyncCompleteToast/.test(slice) && /Team sync complete/.test(src);
})());
assert('banner Sync re-fetches before merge',
  /Re-fetch before merge so a stale banner closure/.test(src));
assert('banner copy mentions merge + auto-merge',
  /keeps your richer rows/.test(src) && /Auto-merge also runs when they are ahead/.test(src));
assert('FALLBACK still skipped when active assignment set',
  /FALLBACK skipped · active assignment set/.test(src));
assert('mergeTeammateState still soft-merges via pickBetterScenario',
  /function mergeTeammateState\(/.test(src)
  && /pickBetterScenario/.test(src.slice(src.indexOf('function mergeTeammateState('),
    src.indexOf('function mergeTeammateState(') + 8000)));

if (failed) {
  console.log('\n' + failed + ' failure(s)');
  process.exit(1);
}
console.log('\nAll checks passed.');
