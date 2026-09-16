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
  renderCalGuideBannerHtml,
  renderCalGuideMotionHtml,
  renderCalGuideLengthHtml,
  renderCalGuideIconHtml,
  calGuideLineList,
  calGuideCalloutPreviewText,
  renderCalGuideBannerEditorHtml,
  renderCalGuideCalloutToolbar,
  renderCalGuideStyleToolbar,
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

assert('defaults include live warning banner',
  /Recording rejections delay the entire study/.test(defaults.banner.bodyHtml));
assert('defaults include motion-off title',
  /Motion Detection must be OFF/.test(defaults.motion.titleHtml));
assert('defaults include 90-second length copy',
  /minimum of 90 seconds/.test(defaults.length.bodyHtml));
assert('default length has no extra icon', defaults.length.icon === '');
assert('default motion icon is the motion preset', defaults.motion.icon === 'motion');

const bannerHtml = renderCalGuideBannerHtml(defaults.banner);
assert('banner render uses warning class', /cal-guide-banner/.test(bannerHtml));
assert('banner render shows live warning copy', /Recording rejections delay the entire study/.test(bannerHtml));
assert('motion render shows OFF title', /Motion Detection must be OFF/.test(renderCalGuideMotionHtml(defaults.motion)));
assert('motion preset uses svg icon', /<svg/.test(renderCalGuideMotionHtml(defaults.motion)));
assert('length render shows 90 seconds', /90 seconds/.test(renderCalGuideLengthHtml(defaults.length)));
assert('length default has no extra icon well', !/len-reminder-icon/.test(renderCalGuideLengthHtml(defaults.length)));

assert('old payload without intro keeps default banner',
  /Recording rejections/.test(normalizeCalGuideContent({
    sections: [{ title: 'General Requirements', dos: ['x'], donts: [] }],
    checklist: ['Timestamp is visible'],
  }).banner.bodyHtml));

const introEdited = buildCalGuideRecord({
  sections: defaults.sections,
  checklist: defaults.checklist,
  banner: { icon: '📷', accent: 'red', bodyHtml: '<strong>Stop</strong> if cameras fail.<script>x</script>' },
  motion: {
    icon: 'clock',
    accent: 'amber',
    eyebrowHtml: 'Every camera',
    titleHtml: 'Motion stays <em>off</em>',
    subHtml: 'Keep it off.',
  },
  length: {
    icon: 'clock',
    accent: 'coral',
    eyebrowHtml: 'Length',
    bodyHtml: '<div class="len-reminder-title">120 seconds minimum</div>',
  },
}, 'Admin-Twilight');
assert('banner keeps custom emoji icon', introEdited.banner.icon === '📷');
assert('banner accent is red', introEdited.banner.accent === 'red');
assert('banner sanitizes script but keeps bold',
  /<strong>Stop<\/strong>/.test(introEdited.banner.bodyHtml) && !/<script/i.test(introEdited.banner.bodyHtml));
assert('motion icon can switch to clock', introEdited.motion.icon === 'clock');
assert('motion keeps italic', /<em>off<\/em>/.test(introEdited.motion.titleHtml));
assert('length icon can be set', introEdited.length.icon === 'clock');
assert('length body keeps title class', /len-reminder-title/.test(introEdited.length.bodyHtml));

assert('published banner uses red accent',
  /data-accent="red"/.test(renderCalGuideBannerHtml(introEdited.banner)));
assert('published length shows clock icon well',
  /len-reminder-icon/.test(renderCalGuideLengthHtml(introEdited.length)));
assert('published length shows 120 seconds',
  /120 seconds/.test(renderCalGuideLengthHtml(introEdited.length)));
assert('custom emoji is not treated as a preset svg',
  /cg-icon-glyph/.test(renderCalGuideIconHtml('🎯')) && !/<svg/.test(renderCalGuideIconHtml('🎯')));
assert('guide payload still includes intro blocks',
  JSON.parse(buildCalGuideAppSettingPayload(introEdited).stateJson).guide.banner.accent === 'red');

const introRows = [{
  sessionStateId: 'ss_app_setting_cal_guide',
  stateJson: JSON.stringify({ type: 'appSetting', key: 'calGuide', guide: introEdited }),
}];
const introCollected = collectCalGuideFromSessionRows(introRows);
assert('ingest restores custom banner icon', introCollected && introCollected.banner.icon === '📷');
assert('ingest restores length body', /120 seconds/.test(introCollected.length.bodyHtml));

const bannerEditor = renderCalGuideBannerEditorHtml(defaults.banner);
assert('edit banner starts collapsed', /data-open="false"/.test(bannerEditor));
assert('edit banner has a clickable summary card', /cg-callout-summary/.test(bannerEditor) && /Warning banner/.test(bannerEditor));
assert('edit banner keeps the editor fields in the card', /data-cg-field="bannerBody"/.test(bannerEditor));
assert('callout preview uses live warning copy',
  /Recording rejections/.test(calGuideCalloutPreviewText('banner', defaults.banner)));
assert('shared style toolbar has bold italic underline and colors',
  typeof renderCalGuideStyleToolbar === 'function'
  && /data-cg-cmd="bold"/.test(renderCalGuideStyleToolbar())
  && /data-cg-cmd="italic"/.test(renderCalGuideStyleToolbar())
  && /data-cg-cmd="underline"/.test(renderCalGuideStyleToolbar())
  && /data-cg-text-color="red"/.test(renderCalGuideStyleToolbar())
  && !/data-cg-icon/.test(renderCalGuideStyleToolbar())
  && !/data-cg-block-accent/.test(renderCalGuideStyleToolbar()));
assert('callout toolbar still has icons plus shared style controls',
  typeof renderCalGuideCalloutToolbar === 'function'
  && /data-cg-icon/.test(renderCalGuideCalloutToolbar('warn', 'amber'))
  && /data-cg-block-accent/.test(renderCalGuideCalloutToolbar('warn', 'amber'))
  && /data-cg-cmd="underline"/.test(renderCalGuideCalloutToolbar('warn', 'amber')));
assert('banner editor still uses the shared callout toolbar',
  /data-cg-cmd="bold"/.test(bannerEditor) && /data-cg-text-color/.test(bannerEditor));
assert('callout bind still uses shared rich-text commands',
  /function bindCalGuideIntroEditors\(/.test(src)
  && /function bindCalGuideRichTextCommands\(/.test(src)
  && /bindCalGuideRichTextCommands\(block/.test(src));

if (failed) {
  console.log('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nAll calibration guide content checks passed');
