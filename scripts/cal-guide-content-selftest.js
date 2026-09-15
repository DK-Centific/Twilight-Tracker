#!/usr/bin/env node
/* Self-test: calibration guide content render + Admin publish upsert.
 * Extracts CAL_GUIDE_SECTIONS through CAL_GUIDE_CONTENT_END from twilight.js.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcPath = path.join(__dirname, '..', 'twilight.js');
const src = fs.readFileSync(srcPath, 'utf8');
const begin = src.indexOf('const CAL_GUIDE_SECTIONS = [');
const end = src.indexOf('/* CAL_GUIDE_CONTENT_END */');
if (begin < 0 || end < 0 || end <= begin) {
  console.error('Could not find CAL_GUIDE_SECTIONS / CAL_GUIDE_CONTENT markers in twilight.js');
  process.exit(1);
}

const context = { console };
vm.createContext(context);
vm.runInContext(src.slice(begin, end + '/* CAL_GUIDE_CONTENT_END */'.length), context);

const {
  CAL_GUIDE_SECTIONS,
  CAL_GUIDE_CHECKLIST,
  CAL_GUIDE_SETTING_ID,
  CAL_GUIDE_ASSIGNMENT_ID,
  cloneCalGuideDefaults,
  normalizeCalGuideContent,
  currentCalGuideContent,
  preferNewerCalGuide,
  buildCalGuideRecord,
  buildCalGuideAppSettingPayload,
  collectCalGuideFromSessionRows,
  renderCalGuideSectionsHtml,
  calGuideLineList,
} = context;

let failed = 0;
function assert(name, cond) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name);
  }
}

console.log('Calibration guide content self-test');

assert('built-in sections include General Requirements',
  CAL_GUIDE_SECTIONS.some(s => /General Requirements/i.test(s.title)));
assert('built-in sections include Checkerboard',
  CAL_GUIDE_SECTIONS.some(s => /Checkerboard/i.test(s.title)));
assert('built-in sections include Air Calibration',
  CAL_GUIDE_SECTIONS.some(s => /Air Calibration/i.test(s.title)));
assert('built-in sections include Ground Calibration',
  CAL_GUIDE_SECTIONS.some(s => /Ground Calibration/i.test(s.title)));
assert('built-in checklist has timestamp item',
  CAL_GUIDE_CHECKLIST.some(i => /Timestamp/i.test(i)));

const defaults = cloneCalGuideDefaults();
assert('defaults clone is independent',
  defaults.sections[0].dos !== CAL_GUIDE_SECTIONS[0].dos
  && defaults.sections[0].dos[0] === CAL_GUIDE_SECTIONS[0].dos[0]);

const html = renderCalGuideSectionsHtml(defaults);
assert('render shows General Requirements', /General Requirements/.test(html));
assert('render shows DO and DON\'T columns', /cal-guide-col do/.test(html) && /cal-guide-col dont/.test(html));
assert('render shows pre-recording checklist', /Pre-recording checklist/.test(html));
assert('render does not include script tags from titles', !/<script/i.test(html));

const edited = buildCalGuideRecord({
  sections: [{
    emoji: '🏁',
    title: 'Checkerboard Handling · updated',
    note: 'Hold the edge.',
    dos: ['Hold the checkerboard at the edge', ''],
    donts: ['Cover squares with fingers'],
  }],
  checklist: ['Timestamp is visible', ''],
}, 'Admin-Twilight');
assert('edit drops empty bullets', edited.sections[0].dos.length === 1 && edited.checklist.length === 1);
assert('edit keeps new title', edited.sections[0].title === 'Checkerboard Handling · updated');
assert('publish stamps publishedBy', edited.publishedBy === 'Admin-Twilight' && !!edited.publishedAt);

const payload = buildCalGuideAppSettingPayload(edited);
assert('guide write uses upsert', payload.writeMode === 'upsert' && payload.overwrite === true);
assert('guide write keeps a stable sessionStateId', payload.sessionStateId === 'ss_app_setting_cal_guide');
assert('guide write is not the team-feedback row', payload.sessionStateId !== 'ss_app_setting_team_feedback');
assert('guide assignment id is stable', payload.assignmentId === CAL_GUIDE_ASSIGNMENT_ID);
const parsed = JSON.parse(payload.stateJson);
assert('guide stateJson key is calGuide', parsed.type === 'appSetting' && parsed.key === 'calGuide');
assert('guide stateJson carries edited title', parsed.guide.sections[0].title === 'Checkerboard Handling · updated');

const rows = [
  {
    sessionStateId: 'ss_app_setting_cal_guide',
    orbitLoginId: '_app_setting',
    lastActive: '2026-09-15T19:40:00.000Z',
    stateJson: JSON.stringify({ type: 'appSetting', key: 'calGuide', guide: edited }),
  },
  {
    sessionStateId: 'ss_app_setting_team_feedback',
    orbitLoginId: '_app_setting',
    lastActive: '2026-09-15T19:41:00.000Z',
    stateJson: JSON.stringify({ type: 'appSetting', key: 'teamFeedback', announcement: { title: 'Tonight' } }),
  },
  {
    sessionStateId: 'ss_asgn_123_alextw',
    orbitLoginId: 'Alex-tw',
    lastActive: '2026-09-15T19:42:00.000Z',
    stateJson: JSON.stringify({ stations: {}, calGuideAck: { acknowledgedAt: '2026-09-15T10:00:00.000Z' } }),
  },
];
const collected = collectCalGuideFromSessionRows(rows);
assert('ingest finds the published guide', collected && collected.sections[0].title === 'Checkerboard Handling · updated');
assert('ingest ignores team feedback rows', collected.sections.length === 1);
assert('ingest ignores session calGuideAck', !collected.calGuideAck);

assert('empty cloud keeps local publish',
  preferNewerCalGuide(edited, null).sections[0].title === edited.sections[0].title);
assert('newer publishedAt wins',
  preferNewerCalGuide(edited, Object.assign({}, defaults, { publishedAt: '2099-01-01T00:00:00.000Z' })).publishedAt.indexOf('2099') === 0);
assert('invalid payload falls back to built-in',
  currentCalGuideContent(null).sections.some(s => /General Requirements/i.test(s.title)));
assert('line list splits textarea input',
  calGuideLineList('a\n\nb\n').join('|') === 'a|b');
assert('normalize rejects empty guide', normalizeCalGuideContent({ sections: [] }) === null);

if (failed) {
  console.log('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nAll calibration guide content checks passed');
