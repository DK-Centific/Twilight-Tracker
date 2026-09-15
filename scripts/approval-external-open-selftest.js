#!/usr/bin/env node
/* Self-test: Approval Lakitu / Ring side-panel helpers.
 * Resolves selected-request URLs with catalog fallbacks, and opens a
 * right-docked named window (side-panel analogue) with a new-tab
 * fallback when blocked. True Chrome Side Panel API is not available
 * to a GitHub Pages app.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcPath = path.join(__dirname, '..', 'twilight.js');
const src = fs.readFileSync(srcPath, 'utf8');

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

console.log('Approval Lakitu / Ring side-panel self-test');

assert(
  'shared window helper exists',
  /function openExternalAppWindow\(url, windowName, opts\)/.test(src)
);
assert(
  'side-panel geometry helper exists',
  /function desktopWindowGeometry\(opts\)/.test(src)
    && /opts\.layout === 'sidePanel'/.test(src)
);
assert(
  'record-flow reuses the shared helper without side-panel layout',
  /openExternalAppWindow\(url, 'lakituRecord', \{ allowOpener: true \}\)/.test(src)
    && !/openExternalAppWindow\(url, 'lakituRecord'[\s\S]{0,80}sidePanel/.test(src)
);
assert(
  'Approval click opens a side panel via the shared helper',
  /openExternalAppWindow\(href, a\.getAttribute\('data-appr-win'\)[\s\S]{0,40}\{ layout: 'sidePanel' \}\)/.test(src)
);
assert(
  'no iframe embed on Approval panel',
  !/appr-icon-row[\s\S]{0,400}<iframe/.test(src)
);
assert(
  'Approval empty state still offers Open Lakitu / Open Ring',
  /Select a request to review\.[\s\S]{0,180}approvalExternalOpenRowHTML/.test(src)
);
assert(
  'Approval labels are Open Lakitu / Open Ring',
  /const label = isLakitu \? 'Open Lakitu' : 'Open Ring'/.test(src)
);
assert(
  'named windows reuse Approval side panels',
  /const APPROVAL_LAKITU_WINDOW = 'twilightApprovalLakitu'/.test(src)
    && /const APPROVAL_RING_WINDOW = 'twilightApprovalRing'/.test(src)
);
assert(
  'Ring fallback is nighttime-centific-4',
  /const DEFAULT_APPROVAL_RING_DASHBOARD_KEY = 'nighttime-centific-4'/.test(src)
    && !/getRingDashboardByKey\('nighttime-centific-1'\)\s*\n\s*:/.test(src)
);
assert(
  'Lakitu empty fallback is DEFAULT_LAKITU_URL / sessions',
  /function resolveApprovalLakituUrl/.test(src)
    && /return \(typeof DEFAULT_LAKITU_URL !== 'undefined'\)/.test(src)
);

const defaultLakituBegin = src.indexOf("const DEFAULT_LAKITU_URL = 'https://lakitu.ring.amazon.dev/sessions';");
const lakituReBegin = src.indexOf('const LAKITU_URL_RE =');
const lakituReEnd = src.indexOf('function isValidLakituUrl(v)');
const validLakituEnd = src.indexOf('// ---- Admin-assigned Lakitu PROJECT links');
const ringBegin = src.indexOf('const RING_DASHBOARDS = [');
const ringKeyEnd = src.indexOf('function getRingDashboardByKey(key)');
const getRingFn = src.indexOf('function getRingDashboardByKey(key)');
const getRingFnEnd = src.indexOf('const TEAM_LAKITU_PROJECT_PAYLOAD_TYPE');
const safeBegin = src.indexOf('function isSafeHttpUrl(v)');
const teamRingEnd = src.indexOf('function getTeamOfficeAddress(team)');
const reviewBegin = src.indexOf('function lakituReviewUrl(url)');
const reviewEnd = src.indexOf('// Centralized renderer for the Lakitu pill');
const apprBegin = src.indexOf('function defaultApprovalRingUrl()');
const apprEnd = src.indexOf('function renderApprovalPanelInto()');
const popupBegin = src.indexOf('function desktopWindowGeometry(opts)');
const popupEnd = src.indexOf('function openLakituForRecord(stationKey, num)');
const escapeBegin = src.indexOf('function escapeHTML(s)');
const escapeEnd = src.indexOf('/* =====================================================================\n   ADMIN APP');

assert('source slices located',
  defaultLakituBegin >= 0 && lakituReBegin >= 0 && ringBegin >= 0
  && getRingFn >= 0 && safeBegin >= 0 && reviewBegin >= 0 && apprBegin >= 0
  && popupBegin >= 0 && escapeBegin >= 0 && apprEnd > apprBegin
  && popupEnd > popupBegin && escapeEnd > escapeBegin && getRingFnEnd > getRingFn);

const opens = [];
const fakeWin = {
  opener: { keep: true },
  closed: false,
  resizeTo(w, h) { this._resized = { w: w, h: h }; },
  moveTo(left, top) { this._moved = { left: left, top: top }; },
};
const context = {
  console,
  URL,
  window: {
    screen: { availWidth: 1600, availHeight: 1000, availLeft: 0, availTop: 0 },
    open(url, name, features) {
      opens.push({ url, name, features });
      if (name === 'blocked') return null;
      return fakeWin;
    },
  },
  adminState: { teams: [], assignments: [] },
};
vm.createContext(context);

function runSlice(from, to, label) {
  if (from < 0 || to <= from) throw new Error('bad slice ' + label);
  vm.runInContext(src.slice(from, to), context, { filename: label });
}

runSlice(defaultLakituBegin, defaultLakituBegin + 90, 'DEFAULT_LAKITU_URL');
runSlice(lakituReBegin, validLakituEnd, 'isValidLakituUrl');
runSlice(ringBegin, src.indexOf('// Legacy catalog entry only. Open Ring'), 'RING_DASHBOARDS');
runSlice(getRingFn, getRingFnEnd, 'getRingDashboardByKey');
runSlice(safeBegin, teamRingEnd, 'isSafeHttpUrl + team ring');
runSlice(reviewBegin, reviewEnd, 'lakituReviewUrl');
runSlice(escapeBegin, escapeEnd, 'escapeHTML');
runSlice(popupBegin, popupEnd, 'openExternalAppWindow + side panel');
runSlice(apprBegin, apprEnd, 'approval resolvers');

const sessionUrl = 'https://lakitu.ring.amazon.dev/p/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa?session=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const reviewUrl = 'https://lakitu.ring.amazon.dev/p/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/review?session=bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const ring4 = 'https://account.ring.com/account/dashboard?l=cf59ccd3-2f3d-441f-ac44-6b2e8befd904';
const ring1 = 'https://account.ring.com/account/dashboard?l=7f2fba81-0d37-49be-bff7-291f59c36747';
const teamRing = 'https://account.ring.com/account/dashboard?l=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

assert(
  'empty Lakitu falls back to sessions list',
  context.resolveApprovalLakituUrl(null) === 'https://lakitu.ring.amazon.dev/sessions'
);
assert(
  'missing Lakitu on a request falls back to sessions list',
  context.resolveApprovalLakituUrl({ approval_id: '1' }) === 'https://lakitu.ring.amazon.dev/sessions'
);
assert(
  'valid session URL becomes /review',
  context.resolveApprovalLakituUrl({ lakitu_url: sessionUrl }) === reviewUrl,
  context.resolveApprovalLakituUrl({ lakitu_url: sessionUrl })
);
assert(
  'already-review URL is kept via safe http',
  context.resolveApprovalLakituUrl({ lakitu_url: reviewUrl }) === reviewUrl
);
assert(
  'javascript: Lakitu is rejected and falls back',
  context.resolveApprovalLakituUrl({ lakitu_url: 'javascript:alert(1)' }) === 'https://lakitu.ring.amazon.dev/sessions'
);
assert(
  'empty Ring falls back to nighttime-centific-4',
  context.resolveApprovalRingUrl(null) === ring4,
  context.resolveApprovalRingUrl(null)
);
assert(
  'unmapped request Ring also uses nighttime-centific-4 (not -1)',
  context.resolveApprovalRingUrl({ approval_id: '1', team_name: 'Unknown' }) === ring4
    && context.resolveApprovalRingUrl({ approval_id: '1' }) !== ring1
);

context.adminState.teams = [{ id: 't1', name: 'Night Team', ringDashboardUrl: teamRing }];
assert(
  'team-mapped Ring is preferred over the catalog fallback',
  context.resolveApprovalRingUrl({ team_id: 't1' }) === teamRing
);

const html = context.approvalExternalOpenRowHTML(
  context.resolveApprovalLakituUrl(null),
  context.resolveApprovalRingUrl(null)
);
assert('empty-state HTML includes Open Lakitu', html.includes('Open Lakitu') && html.includes('data-appr-ext="lakitu"'));
assert('empty-state HTML includes Open Ring', html.includes('Open Ring') && html.includes('data-appr-ext="ring"'));
assert('empty-state Lakitu href is sessions list', html.includes('https://lakitu.ring.amazon.dev/sessions'));
assert('empty-state Ring href is nighttime-centific-4', html.includes('cf59ccd3-2f3d-441f-ac44-6b2e8befd904'));
assert('empty-state links keep target=_blank fallback', (html.match(/target="_blank"/g) || []).length === 2);
assert('empty-state tooltips mention side panel', html.includes('Open Lakitu in a side panel') && html.includes('Open Ring in a side panel'));

function parseFeatures(features) {
  const out = {};
  String(features || '').split(',').forEach(part => {
    const i = part.indexOf('=');
    if (i < 0) return;
    out[part.slice(0, i)] = part.slice(i + 1);
  });
  return out;
}

opens.length = 0;
fakeWin.opener = { keep: true };
fakeWin._resized = null;
fakeWin._moved = null;
const win = context.openExternalAppWindow(
  'https://lakitu.ring.amazon.dev/sessions',
  'twilightApprovalLakitu',
  { layout: 'sidePanel' }
);
const panelFeat = parseFeatures(opens[0] && opens[0].features);
const expectedPanelW = Math.min(560, Math.max(420, Math.floor(1600 * 0.34)));
const expectedPanelLeft = 1600 - expectedPanelW;
assert('side-panel open uses the named window', opens[0] && opens[0].name === 'twilightApprovalLakitu');
assert(
  'side-panel is a tall right-docked window',
  panelFeat.popup === 'yes'
    && Number(panelFeat.width) === expectedPanelW
    && Number(panelFeat.height) === 1000
    && Number(panelFeat.left) === expectedPanelLeft
    && Number(panelFeat.top) === 0,
  JSON.stringify(panelFeat)
);
assert('Approval side panel does not request opener', opens[0] && !/noopener=no/.test(opens[0].features));
assert('Approval side panel nulls window.opener', win && win.opener === null);
assert(
  'side-panel also resizes/moves the opened window',
  fakeWin._resized && fakeWin._resized.w === expectedPanelW && fakeWin._resized.h === 1000
    && fakeWin._moved && fakeWin._moved.left === expectedPanelLeft && fakeWin._moved.top === 0,
  JSON.stringify({ resized: fakeWin._resized, moved: fakeWin._moved })
);

opens.length = 0;
fakeWin.opener = { keep: true };
fakeWin._resized = null;
fakeWin._moved = null;
const rec = context.openExternalAppWindow('https://lakitu.ring.amazon.dev/sessions', 'lakituRecord', { allowOpener: true });
const recFeat = parseFeatures(opens[0] && opens[0].features);
assert('record-flow keeps opener=no in features', opens[0] && /noopener=no/.test(opens[0].features));
assert('record-flow keeps the window reference', rec === fakeWin && rec.opener !== null);
assert(
  'record-flow stays a centered popup, not a side panel',
  Number(recFeat.width) === 1100
    && Number(recFeat.left) === 250
    && Number(recFeat.left) !== expectedPanelLeft,
  JSON.stringify(recFeat)
);

opens.length = 0;
context.window.open = function (url, name) {
  opens.push({ url, name });
  return null;
};
const fallback = context.openExternalAppWindow(
  'https://account.ring.com/account/dashboard?l=cf59ccd3-2f3d-441f-ac44-6b2e8befd904',
  'twilightApprovalRing',
  { layout: 'sidePanel' }
);
assert(
  'blocked side panel falls back to a new tab',
  opens.length === 2 && opens[0].name === 'twilightApprovalRing' && opens[1].name === '_blank' && fallback === null
);
assert('empty URL does not open a window', context.openExternalAppWindow('', 'twilightApprovalLakitu', { layout: 'sidePanel' }) === null);

context.window.screen = { availWidth: 1024, availHeight: 768, availLeft: 0, availTop: 0 };
const narrow = context.desktopWindowGeometry({ layout: 'sidePanel' });
assert(
  'narrow screens still keep a usable side-panel width',
  narrow.w === 420 && narrow.left === 1024 - 420 && narrow.h === 768,
  JSON.stringify(narrow)
);

console.log('');
console.log(failed ? `FAILED ${failed} · passed ${passed}` : `All ${passed} checks passed`);
process.exit(failed ? 1 : 0);
