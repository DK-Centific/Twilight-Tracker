#!/usr/bin/env node
/* Self-test: Lakitu how-to guide sanitize, publish upsert, and nav wiring. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const js = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const begin = js.indexOf('/* LAKITU_GUIDE_BEGIN */');
const end = js.indexOf('/* LAKITU_GUIDE_END */');
if (begin < 0 || end < 0 || end <= begin) {
  console.error('Could not find LAKITU_GUIDE markers in twilight.js');
  process.exit(1);
}

const context = { console };
vm.createContext(context);
vm.runInContext(js.slice(begin, end + '/* LAKITU_GUIDE_END */'.length), context);

const {
  LAKITU_GUIDE_SETTING_ID,
  LAKITU_GUIDE_ASSIGNMENT_ID,
  LAKITU_GUIDE_DRAFT_KEY,
  LAKITU_GUIDE_NAV,
  LAKITU_GUIDE_DEFAULTS,
  LAKITU_GUIDE_MAX_STATE_BYTES,
  sanitizeLakituGuideHtml,
  normalizeLakituGuide,
  preferNewerLakituGuide,
  lakituGuideForView,
  lakituGuideForEditor,
  buildLakituGuideRecord,
  buildLakituGuideUndoRecord,
  buildLakituGuideAppSettingPayload,
  lakituGuidePublishBlockReason,
  collectLakituGuideFromSessionRows,
  renderLakituGuideViewHtml,
  collectLakituGuideEditorDraft,
  readLakituGuideDraft,
  serializeLakituGuideDraft,
  lakituGuideIsEmpty,
} = context;

let failed = 0;
function assert(name, cond) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name);
  }
}

console.log('Lakitu guide self-test');

assert('version bumped', /const APP_VERSION = '1\.3\.091823d'/.test(js));
assert('cache bust matches', /twilight\.js\?v=twilight-1\.3\.091823d/.test(html));
assert('draft key', LAKITU_GUIDE_DRAFT_KEY === 'centific_twilight_lakitu_guide_draft_v1');
assert('nav keys', LAKITU_GUIDE_NAV.join(',') === 'steps,metadata,badTakes,troubleshooting,faq');

const defaults = LAKITU_GUIDE_DEFAULTS;
assert('defaults mention Lakitu V4', /Lakitu V4/.test(defaults.sectionsHtml.steps));
assert('defaults keep bad-takes id', /id="badTakes"/.test(defaults.sectionsHtml.badTakes));
assert('defaults keep Station 1 warning', /Station 1/.test(defaults.sectionsHtml.metadata));
assert('defaults keep FAQ', /Floodlight/.test(defaults.sectionsHtml.faq));
assert('defaults are not empty', !lakituGuideIsEmpty(defaults));
const view = renderLakituGuideViewHtml(defaults);
assert('view renders a table', /<table/.test(view));
assert('view keeps colspan', /colspan="2"/.test(view));
assert('view has no script', !/<script/i.test(view));

const dirty = sanitizeLakituGuideHtml(
  '<p onclick="alert(1)">Hi</p><script>alert(1)</script>'
  + '<img src="https://evil.example/a.png" alt="x">'
  + '<img src="http://evil.example/a.png">'
  + '<a href="javascript:alert(1)">x</a>'
  + '<a href="https://claudeusercontent.example/doc#iterations">Bad</a>'
  + '<a href="#iterations">Takes</a>'
  + '<h2 id="iterations" class="section-title">Bad takes</h2>'
);
assert('strips script and handlers', !/script|onclick|javascript:/i.test(dirty) && /Hi/.test(dirty));
assert('strips remote images', !/<img/i.test(dirty));
assert('rewrites iteration hashes', /href="#badTakes"/.test(dirty) && /id="badTakes"/.test(dirty));
assert('claude hash becomes in-drawer link', (dirty.match(/href="#badTakes"/g) || []).length >= 2);

const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const kept = sanitizeLakituGuideHtml('<img alt="dot" src="' + png + '">');
assert('keeps small data-url image', kept.indexOf('src="' + png + '"') >= 0 && /alt="dot"/.test(kept));
const huge = 'data:image/png;base64,' + 'A'.repeat(120000);
assert('strips oversized data-url', !/<img/i.test(sanitizeLakituGuideHtml('<img src="' + huge + '" alt="big">')));
assert('keeps text color and size', /color:#c5a059/i.test(sanitizeLakituGuideHtml('<span style="color:#C5A059;font-size:18px;background:url(javascript:1)">A</span>'))
  && /font-size:18px/.test(sanitizeLakituGuideHtml('<span style="color:#C5A059;font-size:18px">A</span>'))
  && !/background/i.test(sanitizeLakituGuideHtml('<span style="color:#C5A059;font-size:18px;background:url(javascript:1)">A</span>')));

const edited = buildLakituGuideRecord({
  sectionsHtml: {
    steps: '<h2 class="section-title" id="steps">Updated steps</h2><p>Stay on Lakitu V4.</p>',
    metadata: defaults.sectionsHtml.metadata,
  },
}, 'Admin-Twilight', null);
assert('publish stamps admin', edited && edited.publishedBy === 'Admin-Twilight' && !!edited.publishedAt);
assert('first publish has no previous', edited && edited.previous == null);
assert('empty publish refused', buildLakituGuideRecord({ sectionsHtml: { steps: '<p> </p>' } }, 'Admin', null) == null);
assert('empty reason', lakituGuidePublishBlockReason(null) === 'empty');

const payload = buildLakituGuideAppSettingPayload(edited);
assert('upsert envelope', payload.writeMode === 'upsert' && payload.overwrite === true);
assert('stable lakitu ids', payload.sessionStateId === 'ss_app_setting_lakitu_guide'
  && payload.assignmentId === LAKITU_GUIDE_ASSIGNMENT_ID
  && payload.sessionStateId === LAKITU_GUIDE_SETTING_ID);
assert('not the cal guide row', payload.sessionStateId !== 'ss_app_setting_cal_guide');
const parsed = JSON.parse(payload.stateJson);
assert('stateJson key is lakituGuide', parsed.type === 'appSetting' && parsed.key === 'lakituGuide');
assert('stateJson keeps edited title', /Updated steps/.test(parsed.guide.sectionsHtml.steps));

const second = buildLakituGuideRecord({
  sectionsHtml: { steps: '<h2 id="steps" class="section-title">Second</h2><p>Again</p>' },
}, 'Admin-Twilight', edited);
assert('previous is depth 1', second && second.previous && /Updated steps/.test(second.previous.sectionsHtml.steps)
  && second.previous.previous == null);
const undone = buildLakituGuideUndoRecord(second, 'Admin-Twilight');
assert('undo restores previous text', undone && /Updated steps/.test(undone.sectionsHtml.steps));
assert('undo stores the version just replaced', undone && /Second/.test(undone.previous.sectionsHtml.steps)
  && undone.previous.previous == null);

const rows = [
  {
    sessionStateId: 'ss_app_setting_cal_guide',
    stateJson: JSON.stringify({ type: 'appSetting', key: 'calGuide', guide: { sections: [{ title: 'No' }] } }),
  },
  {
    sessionStateId: 'ss_app_setting_lakitu_guide',
    stateJson: JSON.stringify({ type: 'appSetting', key: 'lakituGuide', guide: {
      sectionsHtml: { steps: '<p></p>' },
      publishedAt: '2099-01-01T00:00:00.000Z',
    } }),
  },
  {
    sessionStateId: 'ss_app_setting_lakitu_guide',
    stateJson: JSON.stringify({ type: 'appSetting', key: 'lakituGuide', guide: edited }),
  },
];
const collected = collectLakituGuideFromSessionRows(rows);
assert('collect ignores cal guide and empty lakitu', collected && /Updated steps/.test(collected.sectionsHtml.steps));
assert('newer cloud wins over defaults', /Updated steps/.test(lakituGuideForView(edited).sectionsHtml.steps));
assert('older cloud loses to newer', preferNewerLakituGuide(edited, Object.assign({}, edited, {
  publishedAt: '2000-01-01T00:00:00.000Z',
  sectionsHtml: { steps: '<p>Old</p>' },
})).publishedAt === edited.publishedAt);

const mem = {
  _v: '',
  getItem() { return this._v; },
  setItem(k, v) { this._v = v; },
};
mem.setItem(LAKITU_GUIDE_DRAFT_KEY, serializeLakituGuideDraft({
  sectionsHtml: { steps: '<h2 id="steps" class="section-title">Draft only</h2><p>Local</p>' },
}));
const draft = readLakituGuideDraft(mem);
assert('draft roundtrip', draft && /Draft only/.test(draft.sectionsHtml.steps));
assert('mods view published not draft', /Updated steps/.test(lakituGuideForView(edited).sectionsHtml.steps)
  && /Draft only/.test(lakituGuideForEditor(edited, draft).sectionsHtml.steps));

const fakeRoot = {
  querySelector(sel) {
    const m = String(sel).match(/data-lg-section="([^"]+)"/);
    return { innerHTML: m && m[1] === 'steps' ? '<h2 id="steps" class="section-title">From editor</h2>' : '' };
  },
};
const fromEditor = collectLakituGuideEditorDraft(fakeRoot);
assert('editor collect reads sections', /From editor/.test(fromEditor.sectionsHtml.steps));

const bulky = buildLakituGuideRecord({
  sectionsHtml: { steps: '<p>' + 'word '.repeat(120000) + '</p>' },
}, 'Admin', null);
assert('oversized stateJson refused', lakituGuidePublishBlockReason(bulky) === 'tooLarge');
assert('cap constant is 400KB', LAKITU_GUIDE_MAX_STATE_BYTES === 400 * 1024);

const calBtn = html.indexOf('id="navCalGuideBtn"');
const lgBtn = html.indexOf('id="navLakituGuideBtn"');
const refreshBtn = html.indexOf('id="navRefreshBtn"');
assert('mod button sits after cal guide', calBtn >= 0 && lgBtn > calBtn && lgBtn < refreshBtn);
const apprBtn = html.indexOf('id="adminApprovalGuideBtn"');
const adminLg = html.indexOf('id="adminLakituGuideBtn"');
const adminRefresh = html.indexOf('id="adminNavRefreshBtn"');
assert('admin button sits beside approval guide', apprBtn >= 0 && adminLg > apprBtn && adminLg < adminRefresh);
assert('separate drawer nodes', html.indexOf('id="lakituGuideOverlay"') >= 0 && html.indexOf('id="lakituGuideDrawer"') >= 0);
assert('lakitu mark is circle plus triangle', /id="navLakituGuideBtn"[\s\S]{0,400}M8 4 L11\.6 11\.5/.test(html));
assert('drawer width is 80vw', /lakitu-guide-drawer \{[\s\S]{0,280}min\(80vw, 960px\)/.test(html));

const rail = js.slice(js.indexOf('function setupNavRails'), js.indexOf('function init('));
const op = rail.indexOf("id:'navCalGuideBtn'");
const opLg = rail.indexOf("id:'navLakituGuideBtn'");
const opRefresh = rail.indexOf("id:'navRefreshBtn'");
assert('op rail lists lakitu guide after cal guide', op >= 0 && opLg > op && opLg < opRefresh);
const ad = rail.indexOf("id:'adminApprovalGuideBtn'");
const adLg = rail.indexOf("id:'adminLakituGuideBtn'");
const adRefresh = rail.indexOf("id:'adminNavRefreshBtn'");
assert('admin rail lists lakitu guide beside approval', ad >= 0 && adLg > ad && adLg < adRefresh);

const openFn = js.slice(js.indexOf('function openLakituGuideDrawer'), js.indexOf('function closeLakituGuideDrawer'));
assert('opening lakitu closes the other guides', /closeCalGuideModal/.test(openFn) && /closeApprovalGuideSlide/.test(openFn));
assert('lakitu opener does not use navLakituBtn', !/navLakituBtn/.test(openFn));
const ring = js.slice(js.indexOf('function syncModeratorRingLinks'), js.indexOf('function lakituUrlState'));
assert('navLakituBtn stays on the external link hook', /getElementById\('navLakituBtn'\)/.test(ring));
const pure = js.slice(begin, end);
assert('guide block does not gate submit', !/calGuideAck|lakituGuideAck/.test(pure));
assert('scoped table css', /\.lakitu-guide-root table \{/.test(html));
assert('no bare lakitu table rule', !/\n\s*table \{[^}]*lakitu/i.test(html));
const lakituCss = html.slice(html.indexOf('Lakitu how-to drawer'), html.indexOf('Booking page · Helios'));
assert('lakitu styles do not load a new font', lakituCss.length > 200 && !/Barlow|fonts\.googleapis\.com|@import/i.test(lakituCss));
assert('raised button includes lakitu guide', /\.nav-lakitu-guide-btn \{/.test(html));

if (failed) {
  console.error(failed + ' failed');
  process.exit(1);
}
console.log('All lakitu guide checks passed');
