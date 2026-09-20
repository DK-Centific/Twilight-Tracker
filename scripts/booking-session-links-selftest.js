#!/usr/bin/env node
/* Self-test: Booking missing Lakitu/Ring chips + URL resolution.
 * OD / TeamLog values win. Admin SessionState overrides fill gaps only.
 * Also checks Week (1.5-row) vs Month (4.5-row) team-list CSS, hidden
 * scrollbars, Sessions-under-hero grid areas, and structured session cards.
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

console.log('Booking session Lakitu / Ring self-test');

const begin = src.indexOf('/* SESSION_LINK_RESOLVE_BEGIN */');
const end = src.indexOf('/* SESSION_LINK_RESOLVE_END */');
assert('resolve helpers are marked for extraction', begin >= 0 && end > begin);

const lakituProjectsBegin = src.indexOf('const LAKITU_PROJECTS = [');
const lakituProjectsEnd = src.indexOf('const LAKITU_PROJECT_URL_RE');
const lakituReBegin = src.indexOf('const LAKITU_URL_RE =');
const validLakituEnd = src.indexOf('// ---- Admin-assigned Lakitu PROJECT links');
const projectUrlBegin = src.indexOf('const LAKITU_PROJECT_URL_RE =');
const getLakituEnd = src.indexOf('const RING_DASHBOARDS = [');
const ringBegin = src.indexOf('const RING_DASHBOARDS = [');
const ringKeyEnd = src.indexOf('function getRingDashboardByKey(key)');
const getRingFn = src.indexOf('function getRingDashboardByKey(key)');
const getRingFnEnd = src.indexOf('const TEAM_LAKITU_PROJECT_PAYLOAD_TYPE');
const safeBegin = src.indexOf('function isSafeHttpUrl(v)');
const teamRingEnd = src.indexOf('function getTeamOfficeAddress(team)');

assert('catalog + URL slices located',
  lakituProjectsBegin >= 0 && lakituReBegin >= 0 && projectUrlBegin >= 0
  && ringBegin >= 0 && getRingFn >= 0 && safeBegin >= 0
  && begin > safeBegin);

const context = { console, URL, Date };
vm.createContext(context);

function runSlice(from, to, label) {
  if (from < 0 || to <= from) throw new Error('bad slice ' + label);
  vm.runInContext(src.slice(from, to), context, { filename: label });
}

runSlice(lakituReBegin, validLakituEnd, 'isValidLakituUrl');
runSlice(lakituProjectsBegin, lakituProjectsEnd, 'LAKITU_PROJECTS');
runSlice(projectUrlBegin, getLakituEnd, 'isLakituProjectUrl + getLakituProjectByKey');
runSlice(ringBegin, src.indexOf('// Legacy catalog entry only. Open Ring'), 'RING_DASHBOARDS');
runSlice(getRingFn, getRingFnEnd, 'getRingDashboardByKey');
runSlice(safeBegin, teamRingEnd, 'isSafeHttpUrl + team resolvers + SESSION_LINK_RESOLVE');

const {
  resolveLakituUrlFromRecord,
  resolveRingUrlFromRecord,
  resolveAssignmentLakituUrl,
  resolveAssignmentRingUrl,
  assignmentMissingSessionLinks,
  sessionLinkMissingChipLabels,
  applySessionLinkOverrideGapFill,
  keepRicherTeamSessionLinks,
  buildSessionLinkOverrideEntry,
  mergeSessionLinkOverrideMaps,
  getLakituProjectByKey,
} = context;

const centific1 = getLakituProjectByKey('centific-1');
const ring4 = context.getRingDashboardByKey('nighttime-centific-4');
assert('catalog has centific-1 and nighttime-centific-4', !!(centific1 && centific1.url && ring4 && ring4.url));

const emptyAsgn = { id: 'asgn_gap' };
const emptyTeam = { id: 12, name: 'Alex x Blair' };
const missingBoth = assignmentMissingSessionLinks(emptyAsgn, emptyTeam, null);
assert('empty session is missing both links', missingBoth.lakitu && missingBoth.ring);
assert(
  'chip labels cover both gaps and stay quiet when filled',
  sessionLinkMissingChipLabels(missingBoth).join('|') === 'Missing Lakitu|Missing Ring'
    && sessionLinkMissingChipLabels({ lakitu: false, ring: false }).length === 0
    && sessionLinkMissingChipLabels({ lakitu: true, ring: false }).join('|') === 'Missing Lakitu'
);

const teamFilled = {
  id: 12,
  lakituProjectKey: 'centific-1',
  lakituProjectUrl: centific1.url,
  ringDashboardKey: 'nighttime-centific-4',
  ringDashboardUrl: ring4.url,
};
assert(
  'team links resolve and hide chips',
  resolveAssignmentLakituUrl(emptyAsgn, teamFilled, null) === centific1.url
    && resolveAssignmentRingUrl(emptyAsgn, teamFilled, null) === ring4.url
    && !assignmentMissingSessionLinks(emptyAsgn, teamFilled, null).lakitu
    && !assignmentMissingSessionLinks(emptyAsgn, teamFilled, null).ring
);

const override = buildSessionLinkOverrideEntry('asgn_gap', 'centific-2', 'nighttime-centific-2');
assert(
  'override fills gaps when OD/team are empty',
  resolveAssignmentLakituUrl(emptyAsgn, emptyTeam, override) === context.getLakituProjectByKey('centific-2').url
    && resolveAssignmentRingUrl(emptyAsgn, emptyTeam, override) === context.getRingDashboardByKey('nighttime-centific-2').url
);

const odAsgn = {
  id: 'asgn_od',
  lakituProjectKey: 'centific-1',
  lakituProjectUrl: centific1.url,
};
const steal = buildSessionLinkOverrideEntry('asgn_od', 'centific-3', 'nighttime-centific-1');
assert(
  'OD assignment Lakitu wins over Admin override',
  resolveAssignmentLakituUrl(odAsgn, emptyTeam, steal) === centific1.url
);

const target = { id: 'asgn_gap2' };
applySessionLinkOverrideGapFill(target, steal);
assert(
  'gap-fill writes keys/urls onto an empty assignment',
  target.lakituProjectKey === 'centific-3' && !!target.lakituProjectUrl && target.ringDashboardKey === 'nighttime-centific-1'
);

const already = {
  lakituProjectKey: 'centific-1',
  lakituProjectUrl: centific1.url,
  ringDashboardKey: '',
};
applySessionLinkOverrideGapFill(already, steal);
assert(
  'gap-fill does not overwrite an existing Lakitu, only fills Ring',
  already.lakituProjectKey === 'centific-1'
    && already.ringDashboardKey === 'nighttime-centific-1'
);

const mergedTeam = keepRicherTeamSessionLinks(
  { id: 9, name: 'Night', lakituProjectKey: '', lakituProjectUrl: '', ringDashboardKey: '', ringDashboardUrl: '' },
  { id: 9, lakituProjectKey: 'centific-4', lakituProjectUrl: context.getLakituProjectByKey('centific-4').url }
);
assert(
  'TeamLog empty row keeps richer local Lakitu',
  mergedTeam.lakituProjectKey === 'centific-4' && !!mergedTeam.lakituProjectUrl
);

const map = mergeSessionLinkOverrideMaps(
  { a1: { assignmentId: 'a1', lakituProjectKey: 'centific-1', updatedAt: '2026-09-15T10:00:00.000Z' } },
  { a1: { assignmentId: 'a1', lakituProjectKey: 'centific-2', updatedAt: '2026-09-15T11:00:00.000Z' }, a2: { assignmentId: 'a2', ringDashboardKey: 'nighttime-centific-4' } }
);
assert(
  'newer override map entry wins and new ids merge in',
  map.a1.lakituProjectKey === 'centific-2' && map.a2.ringDashboardKey === 'nighttime-centific-4'
);

assert(
  'unsafe Ring URL is dropped',
  resolveRingUrlFromRecord({ ringDashboardUrl: 'javascript:alert(1)' }) === ''
    && resolveLakituUrlFromRecord({ lakituProjectUrl: 'javascript:alert(1)' }) === ''
);

assert(
  'canonicalLakituProjectKey maps legacy centific keys onto Night Time',
  typeof context.canonicalLakituProjectKey === 'function'
    && context.canonicalLakituProjectKey('centific-1') === 'night-time-1'
    && context.canonicalLakituProjectKey('night-time-3') === 'night-time-3'
    && context.canonicalLakituProjectKey('centific-6') === ''
);

// Simulate Admin Save links after Night Time migration: assignment still
// carries a legacy key that resolves via alias. Gap-fill alone would leave
// centific-1 in place (select blank). Force-stamp like saveAssignmentSessionLinks.
{
  const legacyAsgn = {
    id: 'asgn_legacy',
    lakituProjectKey: 'centific-1',
    lakituProjectUrl: centific1.url,
  };
  const pick = buildSessionLinkOverrideEntry('asgn_legacy', 'night-time-2', '');
  // Mirror the Save links force-write for the Lakitu side.
  legacyAsgn.lakituProjectKey = pick.lakituProjectKey;
  legacyAsgn.lakituProjectUrl = pick.lakituProjectUrl;
  const displayKey = context.canonicalLakituProjectKey(
    legacyAsgn.lakituProjectKey || ''
  );
  assert(
    'Save links force-write makes Night Time select key stick after legacy alias',
    displayKey === 'night-time-2'
      && resolveAssignmentLakituUrl(legacyAsgn, emptyTeam, pick) === context.getLakituProjectByKey('night-time-2').url
  );
}

assert(
  'saveAssignmentSessionLinks force-stamps assignment (not gap-fill only)',
  /Explicit Admin Save links must stamp/.test(src)
    && /canonicalLakituProjectKey\(rawLakitu\)/.test(src)
    && /upsertSessionLinkOverride\(entry, \{ lakitu: !!lakituKey, ring: !!ringKey \}\)/.test(src)
);

assert(
  'key-only records resolve through the catalog',
  resolveLakituUrlFromRecord({ lakituProjectKey: 'centific-5' }) === context.getLakituProjectByKey('centific-5').url
    && resolveRingUrlFromRecord({ ringDashboardKey: 'nighttime-centific-5' }) === context.getRingDashboardByKey('nighttime-centific-5').url
);

const weekCap = html.includes('.bk-dash-grid.is-week .bk-team-list')
  && html.includes('1.5 * var(--bk-team-card-h)')
  && html.includes('scrollbar-width: none')
  && html.includes('.bk-dash-grid.is-week .bk-team-list::-webkit-scrollbar');
const monthCap = html.includes('.bk-dash-grid.is-month .bk-team-list')
  && html.includes('4.5 * var(--bk-team-card-h)')
  && html.includes('4 * var(--bk-team-gap)');
assert('Week team list is capped to 1.5 rows with hidden scrollbars', weekCap);
assert('Month team list is restored to the 4.5-row cap', monthCap);
assert(
  'Week 1.5 cap is not applied as a shared Month+Week max-height',
  !/is-week \.bk-team-list,\s*\n\s*\.bk-dash-grid\.is-month \.bk-team-list \{[\s\S]{0,220}1\.5 \* var\(--bk-team-card-h\)/.test(html)
);

assert(
  'Week grid parks Sessions under bk-hero (not inside .bk-right)',
  html.includes('grid-template-areas:')
    && html.includes('"hero slot"')
    && html.includes('"sessions sessions"')
    && /<\/div>\s*<\/div>\s*<section class="bk-sessions"/.test(src)
    && !html.includes('is-assign-collapsed .bk-sessions')
    && !html.includes('is-assign-open .bk-right { display: contents')
);
assert(
  'Week Assign-a-Team starts open so the 1.5-row list is visible',
  /bookingAssignOpen:\s*true/.test(src)
    && src.includes('adminState.bookingAssignOpen = true;')
);
assert('session cards render missing-link chips', /bk-link-chip/.test(src) && /Missing Lakitu/.test(src));
assert('assignment modal can save session links', /function saveAssignmentSessionLinks\(asgnId\)/.test(src));
assert('SessionState override setting id exists', /ss_app_setting_session_links/.test(src));
assert('getAssignedLakituUrl uses assignment resolver', /resolveAssignmentLakituUrl\(asgn, team, override\)/.test(src));
assert('getAssignedRingUrl uses assignment resolver', /resolveAssignmentRingUrl\(asgn, team, override\)/.test(src));
assert('Approval Lakitu prefers assigned project before DEFAULT', /resolveAssignmentLakituUrl\(asgn, team, override\)/.test(src)
  && /return \(typeof DEFAULT_LAKITU_URL !== 'undefined'\)/.test(src));
assert('APP_VERSION is 1.3.091820f', /const APP_VERSION = '1\.3\.091820f'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091820f'));
assert(
  'Week + assign open locks booking page scroll',
  html.includes('body.booking-week-assign-open')
    && html.includes('#bookingPage.is-week-assign-open')
    && /#bookingPage\.is-week-assign-open \.booking-page-body/.test(html)
    && /overflow:\s*hidden/.test(html.slice(html.indexOf('body.booking-week-assign-open'), html.indexOf('body.booking-week-assign-open') + 700))
    && /function applyBookingWeekAssignScrollLock\(/.test(src)
    && /applyBookingWeekAssignScrollLock\(view === 'week' && assignOpen\)/.test(src)
    && /applyBookingWeekAssignScrollLock\(false\)/.test(src)
    && /function bindBookingDashboardEvents\(/.test(src)
    && /applyBookingMotionChrome\(\)/.test(src.slice(src.indexOf('function bindBookingDashboardEvents'), src.indexOf('function bindBookingDashboardEvents') + 500))
);

assert(
  'session cards put the date in bk-session-time and split time / team / address',
  /class="bk-session-time">\$\{escapeHTML\(dateLabel\)\}/.test(src)
    && /weekday: 'short', month: 'short', day: 'numeric'/.test(src)
    && src.includes('const when = `${fmtBookingClock(a.startMin || 0)} – ${fmtBookingClock(a.endMin || 0)}`;')
    && src.includes('class="bk-session-when"')
    && src.includes('class="bk-session-teamline"')
    && src.includes('class="bk-session-addr"')
    && src.includes('class="bk-status-pill"')
    && !/const sub = \[\s*when,/.test(src)
);

assert(
  'session-card CSS uses structured lines and 2-line address clamp',
  html.includes('.bk-session-when')
    && html.includes('.bk-session-teamline')
    && html.includes('.bk-session-addr')
    && html.includes('-webkit-line-clamp: 2')
    && html.includes('overflow-wrap: break-word')
    && html.includes('word-break: normal')
);

assert(
  'missing-link chips sit on their own full-width card row',
  html.includes('.bk-link-chips')
    && html.includes('flex: 1 0 100%')
    && /bk-origin-pill[\s\S]{0,180}<\/div>\s*\$\{chips \? `<div class="bk-link-chips">/.test(src)
);

assert(
  'Assign-a-Team Booked status follows OneData, not team-session placeholders',
  /function bookingOdStatusIsActive\(odStatus\)/.test(src)
    && /function assignmentBelongsToBookingTeam\(a, team\)/.test(src)
    && /function bookingAssignmentCountsAsBooked\(a\)/.test(src)
    && /isTeamSessionAssignment\(a\)\) return false/.test(src)
    && /assignmentIsOdOrigin\(a\)/.test(src)
    && /bookingOdStatusIsActive\(a\.odStatus\)/.test(src)
);

const emailSlice = src.slice(
  src.indexOf('const ORBIT_EMAIL_TEMPLATE_HTML'),
  src.indexOf('function buildEmailTimeLabel')
);
assert(
  'booking emails no longer use low-contrast grey / cyan / magenta tokens',
  !/#9A9AA0|#5A6A72|#7A7A80|#00B4D8|#C23287|#F0F7FA|#D6E5EA|#FAF5F8|#F0E0EA/.test(emailSlice)
);
assert(
  'booking emails use Helios contrast tokens',
  emailSlice.includes('#A34B2E')
    && emailSlice.includes('#3D4A52')
    && emailSlice.includes('#2F3D46')
    && emailSlice.includes('#F6F3EC')
    && emailSlice.includes('#E4DDD0')
    && emailSlice.includes('#001528')
);

console.log('');
console.log(failed ? `FAILED ${failed} · passed ${passed}` : `All ${passed} checks passed`);
process.exit(failed ? 1 : 0);
