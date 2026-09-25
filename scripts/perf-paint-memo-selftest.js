#!/usr/bin/env node
'use strict';

/**
 * Performance paint memo must not change strike alias keys or stripped
 * comments. The paint index and the full-list scan return the same keys.
 * A second strip of the same SharePoint comment does not run the regex again.
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

console.log('Performance paint memo self-test');

assert('APP_VERSION 1.3.091825i',
  /const APP_VERSION = '1\.3\.091825i'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091825i'));

const memoStart = src.indexOf('let _perfMemoDepth = 0;');
const memoEnd = src.indexOf('function classifyBookingForPerf(a)', memoStart);
const aliasStart = src.indexOf('function modStrikeBookingYmd(booking)');
const aliasEnd = src.indexOf('function modStrikeUnionStruckSessions(a, b)', aliasStart);
const stripStart = src.indexOf('function stripHtmlTagsToPlainText(s)');
const stripEnd = src.indexOf('function decodeHtmlEntitiesToPlainText(s)', stripStart);
const plainStart = src.indexOf('let _plainCommentCache = new Map();');
const plainEnd = src.indexOf('function assignmentCommentIsModCancel(comment)', plainStart);

assert('memo, alias, and comment slices found',
  memoStart > 0 && memoEnd > memoStart
  && aliasStart > 0 && aliasEnd > aliasStart
  && stripStart > 0 && stripEnd > stripStart
  && plainStart > 0 && plainEnd > plainStart);

const block = src.slice(stripStart, stripEnd)
  + '\n'
  + src.slice(plainStart, plainEnd)
  + '\n'
  + src.slice(memoStart, memoEnd)
  + '\n'
  + 'function assignmentPerfMaterialize(a) { return a; }\n'
  + src.slice(aliasStart, aliasEnd);

const ctx = { console, adminState: { teams: [], assignments: [] } };
vm.createContext(ctx);
vm.runInContext(block, ctx);

function sameList(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const shared = {
  date: '2026-09-20',
  startMin: 1080,
  participantName: 'Pat Example',
  modSnapshots: [{ orbitLoginId: 'Mod-A' }, { orbitLoginId: 'mod-b' }],
};
const rowA = Object.assign({ id: 'row-a', odScheduleId: 'od_shared' }, shared);
const rowB = Object.assign({
  id: 'row-b',
  odScheduleId: 'od_shared',
  assignmentId: 'explicit-asgn',
}, shared);
const otherDay = Object.assign({}, rowA, { id: 'row-c', date: '2026-09-21' });
const bg1 = {
  id: 'bg-1',
  bookingGroupId: 'bg_night',
  date: '2026-09-20',
  startMin: 600,
  participantName: 'Other',
  modSnapshots: [{ orbitLoginId: 'mod-c' }, { orbitLoginId: 'mod-d' }],
};
const bg2 = Object.assign({}, bg1, { id: 'bg-2' });
const lone = {
  id: 'lone',
  odScheduleId: 'od_other',
  date: '2026-09-20',
  startMin: 900,
  participantName: 'Solo',
  modSnapshots: [{ orbitLoginId: 'mod-e' }, { orbitLoginId: 'mod-f' }],
};
ctx.adminState.assignments = [rowA, rowB, otherDay, bg1, bg2, lone];

function keysOff(booking) {
  ctx.perfMemoEnd();
  return ctx.modStrikeSessionAliasKeys(booking);
}
function keysOn(booking) {
  ctx.perfMemoBegin();
  const out = ctx.modStrikeSessionAliasKeys(booking);
  ctx.perfMemoEnd();
  return out;
}

const bookings = [rowA, rowB, otherDay, bg1, bg2, lone];
bookings.forEach(b => {
  const off = keysOff(b);
  const on = keysOn(b);
  assert('paint index matches full scan · ' + b.id, sameList(off, on),
    'off ' + off.join(',') + ' on ' + on.join(','));
});

const aKeys = keysOff(rowA);
assert('shared od sibling aid is included', aKeys.indexOf('aid:row-b') >= 0);
assert('other date is not a sibling', aKeys.indexOf('aid:row-c') < 0);
assert('unrelated booking is not a sibling', aKeys.indexOf('aid:lone') < 0);
assert('canonical od date key', aKeys.indexOf('asgn:od_shared|2026-09-20') >= 0);
const bgKeys = keysOff(bg1);
assert('booking group sibling aid is included', bgKeys.indexOf('aid:bg-2') >= 0);
assert('booking group does not pull the od pair', bgKeys.indexOf('aid:row-a') < 0);

ctx.perfMemoBegin();
const first = ctx.modStrikeSessionAliasKeys(rowA);
first.push('MUTATED');
const second = ctx.modStrikeSessionAliasKeys(rowA);
ctx.perfMemoEnd();
assert('memo returns a copy', second.indexOf('MUTATED') < 0 && second.indexOf('aid:row-b') >= 0);

let strips = 0;
const origStrip = ctx.stripHtmlTagsToPlainText;
ctx.stripHtmlTagsToPlainText = function (s) {
  strips++;
  return origStrip(s);
};
const wrapped = '<div class="ExternalClassABC">od-sync-soft-close</div>';
const plain1 = ctx.assignmentCommentPlainForMarker(wrapped);
const afterFirst = strips;
const plain2 = ctx.assignmentCommentPlainForMarker(wrapped);
assert('html comment strips to the marker', plain1 === 'od-sync-soft-close' && plain2 === plain1);
assert('same comment is not stripped twice', strips === afterFirst && afterFirst === 1,
  'strips ' + strips + ' after first ' + afterFirst);
const cancelHtml = '<p>mod-cancel-session</p>';
const cancelPlain = ctx.assignmentCommentPlainForMarker(cancelHtml);
assert('mod-cancel comment still strips', cancelPlain === 'mod-cancel-session');

console.log(failed ? ('FAILED ' + failed + ' / ' + (passed + failed)) : ('passed ' + passed));
process.exit(failed ? 1 : 0);
