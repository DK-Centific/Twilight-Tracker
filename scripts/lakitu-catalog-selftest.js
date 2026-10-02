#!/usr/bin/env node
/* Self-test: Admin Night Time Lakitu catalog (1.3.100226h).
 * Any Admin can save the five shared catalog URLs. Code defaults
 * stay until overrides load. New bookings copy the saved catalog.
 * Apply to tonight rewrites only today's Night Time sessions.
 * Stored session URLs stay in place for Checklist / Performance / Approval.
 */
'use strict';

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

console.log('Night Time Lakitu catalog (1.3.100226h)');

assert('APP_VERSION 1.3.100226h',
  /const APP_VERSION = '1\.3\.100226h'/.test(src)
    && html.includes('twilight.js?v=twilight-1.3.100226h'));

const rowAt = html.indexOf('id="lakituCatalogRow"');
const masterAt = html.indexOf('id="masterlistRow"');
const modalAt = html.indexOf('id="lakituCatalogModal"');
assert('tile sits under Master List and opens a popup',
  masterAt >= 0 && rowAt > masterAt && modalAt > rowAt
    && html.includes('id="lakituCatalogRow"')
    && html.includes('menu-row menu-row-admin-only')
    && html.includes('Night Time Lakitu')
    && /function openLakituCatalogPopup\(/.test(src)
    && /function closeLakituCatalogPopup\(/.test(src));
for (let n = 1; n <= 5; n++) {
  assert('fixed label and url field for Night Time ' + n,
    html.includes('US - BEV+ LeapFrog Night Time - ' + n)
      && html.includes('id="lakituCatalogUrl-night-time-' + n + '"'));
}
assert('Save and Apply to tonight actions',
  html.includes('id="lakituCatalogSaveBtn"')
    && html.includes('>Save<')
    && html.includes('id="lakituCatalogApplyBtn"')
    && html.includes('Apply to tonight'));

const gate = src.slice(src.indexOf('function lakituCatalogEditAllowed'), src.indexOf('function loadLakituCatalogCache'));
assert('any Admin can save, not Master-Admin-only',
  /isAdminSession\(\)/.test(gate) && !/isMasterAdmin/.test(gate));
assert('catalog persists as a SessionState app setting',
  src.includes('ss_app_setting_lakitu_catalog')
    && src.includes("key: 'lakituCatalog'")
    && src.includes('function ingestLakituCatalogFromSessionRows')
    && src.includes('LAKITU_CATALOG_LS_KEY'));
assert('confirm names the count before tonight is overwritten',
  /nightTimeSessionsBookedOnDate\(/.test(src)
    && /This will change the Lakitu link on /.test(src)
    && /Past nights stay the same/.test(src)
    && /confirmLabel: 'Update tonight'/.test(src));

const saveFn = src.slice(src.indexOf('async function saveAssignment'), src.indexOf('function openViewAssignmentModal'));
assert('new bookings stamp the catalog; edits keep the stored link',
  saveFn.includes('lakituLinksForNewBooking(team)')
    && saveFn.indexOf('...existing') < saveFn.indexOf('lakituLinksForNewBooking(team)'));

const context = { console, URL, Date, Intl };
vm.createContext(context);
function runSlice(from, to, label) {
  if (from < 0 || to <= from) throw new Error('bad slice ' + label);
  vm.runInContext(src.slice(from, to), context, { filename: label });
}

const lakituReBegin = src.indexOf('const LAKITU_URL_RE =');
const catalogEnd = src.indexOf('/* LAKITU_CATALOG_END */');
runSlice(lakituReBegin, catalogEnd, 'catalog');
const safeBegin = src.indexOf('function isSafeHttpUrl(v)');
const resolveEnd = src.indexOf('/* SESSION_LINK_RESOLVE_END */');
runSlice(safeBegin, resolveEnd, 'resolve');

const {
  getLakituProjectByKey,
  setLakituCatalogOverrides,
  lakituCatalogOverridesFromFields,
  lakituLinksForNewBooking,
  lakituCatalogPacificTodayYmd,
  nightTimeSessionsBookedOnDate,
  applyLakituCatalogToSessions,
  lakituCatalogSettingBody,
  lakituCatalogOverridesFromSessionRows,
  resolveLakituUrlFromRecord,
} = context;

const builtin = getLakituProjectByKey('night-time-1').url;
const builtin2 = getLakituProjectByKey('night-time-2').url;
assert('code default is used before an override loads',
  !!builtin && getLakituProjectByKey('centific-1').url === builtin);

const NEW1 = 'https://lakitu.ring.amazon.dev/?session=aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const NEW2 = 'https://lakitu.ring.amazon.dev/?session=22222222-2222-4222-8222-222222222222';
const STORED = 'https://lakitu.ring.amazon.dev/?session=11111111-1111-4111-8111-111111111111';
setLakituCatalogOverrides({ 'night-time-1': NEW1, 'night-time-2': 'javascript:alert(1)' });
assert('valid override replaces the code default', getLakituProjectByKey('night-time-1').url === NEW1);
assert('invalid override is ignored', getLakituProjectByKey('night-time-2').url === builtin2);
setLakituCatalogOverrides({});
assert('clearing overrides restores the code default', getLakituProjectByKey('night-time-1').url === builtin);
setLakituCatalogOverrides({ 'night-time-1': NEW1 });

const fields = lakituCatalogOverridesFromFields({
  'night-time-1': NEW1,
  'night-time-3': 'not a link',
});
assert('a bad link is rejected with its label',
  fields.ok === false && /Night Time - 3/.test(fields.label));
const good = lakituCatalogOverridesFromFields({ 'night-time-2': '  ' + NEW2 + '  ' });
assert('a trimmed Lakitu link is accepted', good.ok === true && good.urls['night-time-2'] === NEW2);

const stamped = lakituLinksForNewBooking({
  lakituProjectKey: 'centific-1',
  lakituProjectUrl: STORED,
});
assert('new booking copies the saved catalog, not the old team link',
  stamped.lakituProjectKey === 'night-time-1' && stamped.lakituProjectUrl === NEW1);

assert('stored session URL wins over the live catalog',
  resolveLakituUrlFromRecord({ lakituProjectKey: 'night-time-1', lakituProjectUrl: STORED }) === STORED);
assert('a key with no stored URL still uses the catalog',
  resolveLakituUrlFromRecord({ lakituProjectKey: 'night-time-1', lakituProjectUrl: '' }) === NEW1);

assert('Pacific today follows America/Los_Angeles',
  lakituCatalogPacificTodayYmd(new Date('2026-10-02T07:30:00Z')) === '2026-10-02'
    && lakituCatalogPacificTodayYmd(new Date('2026-10-02T06:30:00Z')) === '2026-10-01');

const OLD = 'https://lakitu.ring.amazon.dev/?session=33333333-3333-4333-8333-333333333333';
const teams = [{ id: 9, lakituProjectKey: 'centific-3', lakituProjectUrl: OLD }];
const assignments = [
  { id: 'tonight', date: '2026-10-02', status: 'Booked', lakituProjectKey: 'night-time-1', lakituProjectUrl: STORED },
  { id: 'via-team', date: '2026-10-02', status: 'Notified', teamId: 9, lakituProjectUrl: '' },
  { id: 'past', date: '2026-10-01', status: 'Booked', lakituProjectKey: 'night-time-1', lakituProjectUrl: STORED },
  { id: 'cancelled', date: '2026-10-02', status: 'Cancelled', lakituProjectKey: 'night-time-1', lakituProjectUrl: STORED },
  { id: 'other', date: '2026-10-02', status: 'Booked', lakituProjectKey: '', lakituProjectUrl: '' },
];
const preview = nightTimeSessionsBookedOnDate(assignments, teams, '2026-10-02');
assert('tonight count is only Night Time sessions booked today',
  preview.map(a => a.id).join(',') === 'tonight,via-team');
const updated = applyLakituCatalogToSessions(assignments, teams, '2026-10-02');
assert('apply overwrites tonight and leaves the past night',
  updated.length === 2
    && assignments.find(a => a.id === 'tonight').lakituProjectUrl === NEW1
    && assignments.find(a => a.id === 'via-team').lakituProjectKey === 'night-time-3'
    && assignments.find(a => a.id === 'past').lakituProjectUrl === STORED
    && assignments.find(a => a.id === 'cancelled').lakituProjectUrl === STORED
    && teams[0].lakituProjectUrl === OLD);

const body = lakituCatalogSettingBody({ 'night-time-1': NEW1 }, 'admin-example.test', '2026-10-02T08:00:00.000Z');
assert('setting body is an appSetting lakituCatalog payload',
  body.type === 'appSetting' && body.key === 'lakituCatalog' && body.urls['night-time-1'] === NEW1
    && body.updatedBy === 'admin-example.test');
const rows = [
  { sessionStateId: 'ss_other', assignmentId: 'nope', lastActive: '2026-10-02T09:00:00.000Z', stateJson: '{"type":"appSetting","key":"calGuide"}' },
  { sessionStateId: 'ss_app_setting_lakitu_catalog', assignmentId: 'app_setting_lakitu_catalog', lastActive: '2026-10-02T08:00:00.000Z', stateJson: JSON.stringify(body) },
];
const ingested = lakituCatalogOverridesFromSessionRows(rows);
assert('session rows yield the saved catalog urls',
  ingested && ingested.urls['night-time-1'] === NEW1 && ingested.updatedAt === '2026-10-02T08:00:00.000Z');

console.log('');
console.log(failed ? `FAILED ${failed} · passed ${passed}` : `All ${passed} checks passed`);
process.exit(failed ? 1 : 0);
