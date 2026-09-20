#!/usr/bin/env node
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

console.log('Moderator strike self-test');

assert('version bump 091820h',
  /const APP_VERSION = '1\.3\.091820h'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091820h'));
assert('skip/strike checkpoint merge on SessionState ingest',
  /function mergeModStrikeCheckpoints/.test(src)
  && /function mergeModStrikeBoolMap/.test(src)
  && /function modStrikeCheckpointsHaveLocalExtras/.test(src)
  && /mergedCheckpoints/.test(src)
  && /needRepersist/.test(src));
assert('skip/strike flush persist (no debounce race)',
  /function flushPersistModeratorStrikesSetting/.test(src)
  && /flushPersistModeratorStrikesSetting\(\)/.test(src)
  && /stampModStrikeCheckpointOccurrence\('resolvedTeams'/.test(src));
assert('skip keyed by assignment occurrence',
  /function modStrikeCheckpointOccurrenceKey/.test(src)
  && /function modStrikeCheckpointIsSkipped/.test(src)
  && /function stampModStrikeCheckpointOccurrence/.test(src)
  && /Do not also stamp bare teamId/.test(src));
assert('live tile prefers new session over prior flag',
  /A new Live assignment must not stay blanked/.test(src)
  && /prev\.kind === 'flagged' && snap\.kind === 'inprogress'/.test(src));
assert('banner gated by date filter + hides when resolved',
  /function modStrikeCheckpointRowMatchesPerfDateFilter/.test(src)
  && /After admin confirms Skip\/Strike for every incomplete, hide by default/.test(src)
  && /Only show when pending rows match the Performance date-range filter/.test(src));
assert('reviewer lockdown chrome',
  /function syncReviewerChrome/.test(src)
  && /is-reviewer-hidden/.test(src)
  && /isAdminSession\(\)/.test(src)
  && html.includes('reviewer-lockdown-style')
  && html.includes('body.is-reviewer #resetRow')
  && html.includes('body.is-reviewer .menu-row-admin-only')
  && html.includes('menu-section-quick-links'));
assert('menu Ring quick link removed',
  /Menu Ring Quick Link removed for all roles/.test(src)
  && /ringRow\.style\.display = 'none'/.test(src)
  && html.includes('id="lakituRow" style="display: none;"'));
assert('overview live status strike attention glow',
  /function modStrikeCheckpointAttentionActive/.test(src)
  && /function syncOverviewLiveStatusStrikeAttention/.test(src)
  && html.includes('.ov-stat-livestatus.is-strike-attention::after')
  && html.includes('ov-livestatus-strike-inset'));
assert('checkpoint banner strike resolves team for attention',
  /function resolveModStrikeCheckpointTeam/.test(src)
  && /resolvedTeams/.test(src)
  && /!t\.resolved/.test(src));
assert('perf checkpoint banner strike button',
  /data-mod-strike-checkpoint-strike/.test(src)
  && /function confirmAndStrikeModStrikeCheckpointTeam/.test(src)
  && /mod-strike-check-strike/.test(src));
assert('live status tile opens performance banner',
  /scrollTo: 'modStrikeCheckpointBanner'/.test(src)
  && /id="modStrikeCheckpointBanner"/.test(src));
assert('strike checkpoint waits for session end',
  /function isPastAssignmentSessionEnd/.test(src)
  && /function assignmentBookingSessionEndMs/.test(src)
  && /flagIncomplete:/.test(src)
  && /teamAutoStrike/.test(src));
assert('perf checkpoint skip lifts auto-strike',
  /function skipModStrikeCheckpointTeam/.test(src)
  && /data-mod-strike-checkpoint-skip/.test(src)
  && /modStrikeCheckpointSkippedTeamIds/.test(src));
assert('activities map preserved on renderModerators refresh',
  /keepActivitiesDom/.test(src)
  && /refreshModActivitiesViewInPlace\(\)/.test(src));
assert('activities map paint de-bounce',
  /buildActivitiesGeofencePaintSig/.test(src)
  && /scheduleActivitiesPrefetch/.test(src)
  && /scheduleActivitiesGeofenceUpdate/.test(src)
  && /activitiesMapShellMounted/.test(src));
assert('booking sessions default today',
  /bookingSessionScope:\s*'day'/.test(src)
  && /adminState\.bookingSessionScope = 'day'/.test(src));
assert('activities date range defaults today',
  /activitiesDateRange:\s*'today'/.test(src)
  && /data-activities-range="today"/.test(src)
  && /function getActivitiesDateRange/.test(src));
assert('perf strike refresh targets tab body only',
  /modStrikeRefreshUi[\s\S]*?getElementById\('adminTabBody'\)/.test(src)
  && !/modStrikeRefreshUi[\s\S]*?getElementById\('adminContent'\)/.test(src));
assert('strikes SessionState app setting sync',
  /MODERATOR_STRIKES_SETTING_ID = 'ss_app_setting_moderator_strikes'/.test(src)
  && /function persistModeratorStrikesSetting/.test(src)
  && /function ingestModeratorStrikesFromSessionRows/.test(src)
  && /ingestModeratorStrikesFromSessionRows\(rows\)/.test(src));
assert('strike delegation + eligibility',
  /function ensureModStrikeActionDelegation/.test(src)
  && /function modStrikeEligible/.test(src)
  && /function modStrikeBeginAction/.test(src)
  && /function renderTeamModChipHTML/.test(src));
assert('moderator strike warnings',
  /function modStrikeWarningMessage/.test(src)
  && /function syncModStrikeModeratorChrome/.test(src)
  && html.includes('mod-strike-mod-overlay'));
assert('wasted overlays avatar',
  /function renderModAvatarHTML/.test(src)
  && html.includes('mod-strike-wasted-on-avatar'));
assert('zero stars in-app lock + wasted-style label',
  /function isModeratorStrikeLocked/.test(src)
  && /function isModAppStrikeLocked/.test(src)
  && /function renderModStrikeWastedLabelHTML/.test(src)
  && html.includes('.mod-strike-wasted-word')
  && html.includes('Passion+One'));
assert('strike animations wired',
  /function runModStrikeRemoveAnim/.test(src)
  && html.includes('mod-star-strike-away')
  && html.includes('mod-strike-wasted-enter'));
assert('strike store + stars helpers',
  /MOD_STRIKE_MAX_STARS = 4/.test(src)
  && /MOD_STRIKE_LOCK_AT_LOST = 3/.test(src)
  && /function getModStrikeStars/.test(src)
  && /function maybeRunModStrikeNineAmCheckpoint/.test(src));
assert('mod hub overlay + perf banner',
  /function renderModStrikeOverlayHTML/.test(src)
  && /function renderPerfStrikeCheckpointBannerHTML/.test(src)
  && html.includes('.mod-strike-overlay'));

const sliceStart = src.indexOf('function ymd(d)');
const sliceEnd = src.indexOf('function fmtTimeOfDay(min)', sliceStart);
const block = src.slice(sliceStart, sliceEnd);
const ctx = {
  setTimeout(fn) { if (typeof fn === 'function') fn(); return 0; },
  clearTimeout() {},
  localStorage: { _m: {}, getItem(k) { return this._m[k] || null; }, setItem(k, v) { this._m[k] = v; } },
  adminState: {
    teams: [{ id: 't1', name: 'Alpha', primaryIds: ['a-orbit', 'b-orbit'] }],
    assignments: [{
      id: 'asgn1', teamId: 't1', date: '2026-09-16', status: 'Booked',
      startMin: 10 * 60, endMin: 12 * 60,
    }],
    overview: { timeScope: 'all', teamId: 'all', moderatorId: 'all' },
    perfDateRange: 'all',
    perfCustomStart: '',
    perfCustomEnd: '',
  },
  state: { username: 'Admin-Twilight' },
  MOD_STRIKE_LS_KEY: 'centific_moderator_strikes_v1_test',
};
ctx.MOD_STRIKE_LS_KEY = 'centific_moderator_strikes_v1_test';
const patched = block.replace(/const MOD_STRIKE_LS_KEY = '[^']+'/, "const MOD_STRIKE_LS_KEY = 'centific_moderator_strikes_v1_test'")
  + `
function classifyBookingForPerf(a) {
  if (!a) return null;
  if (a.status === 'Completed') return 'completed';
  return 'scheduled';
}
function assignmentCoerceClockMin(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) ? n : (fb || 0);
}
function assignmentModalNormalizeEndMin(s, e) {
  e = assignmentCoerceClockMin(e, s);
  return e <= s ? e + 24 * 60 : e;
}
function escapeHTML(s) { return String(s); }
function getPSTDateString() { return '2026-09-17'; }
function toast() {}
function syncOverviewLiveStatusStrikeAttention() {}
function modStrikeRefreshUi() {}
function perfDateInRange(a, range) {
  if (!range || range === 'all') return true;
  if (range === 'custom') {
    const d = String((a && a.date) || '');
    const cs = String(adminState.perfCustomStart || '');
    const ce = String(adminState.perfCustomEnd || '');
    if (cs && d < cs) return false;
    if (ce && d > ce) return false;
    return true;
  }
  return true;
}
function overviewDateRange() { return [null, null]; }
function perfBookingOverlapsPacificDay() { return true; }
`;
ctx.document = { querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; } };
vm.createContext(ctx);
vm.runInContext(patched, ctx);

assert('warning copy level 1 bold', ctx.modStrikeWarningMessageHTML(1).includes('<strong>Warning 1</strong>'));
assert('warning contact line break', ctx.modStrikeWarningMessageHTML(1).includes('<br><br>Please contact'));
assert('warning copy level 3 locked', ctx.modStrikeWarningMessageHTML(3).includes('under review.<br><br>Please contact'));
assert('lock overlay has no wasted banner', !/mod-strike-mod-wasted/.test(src));
assert('4 stars is Ok (no warn)', ctx.getModStrikeWarningLevel('c-orbit') === 0);
assert('4 stars not locked', !ctx.isModeratorStrikeLocked('c-orbit'));
ctx.manualModStrike('c-orbit', 't');
assert('3 stars is Warning 1', ctx.getModStrikeStars('c-orbit') === 3 && ctx.getModStrikeWarningLevel('c-orbit') === 1);
assert('3 stars not locked', !ctx.isModeratorStrikeLocked('c-orbit'));
ctx.manualModStrike('c-orbit', 't');
assert('2 stars is Warning 2', ctx.getModStrikeStars('c-orbit') === 2 && ctx.getModStrikeWarningLevel('c-orbit') === 2);
assert('2 stars not locked (Final Chance is at 1★)', !ctx.isModeratorStrikeLocked('c-orbit'));
ctx.manualModStrike('c-orbit', 't');
assert('1 star locks until Final Chance', ctx.getModStrikeStars('c-orbit') === 1 && ctx.isModeratorStrikeLocked('c-orbit'));
assert('1 star warn level is lock path (no Warning 1/2 popup)', ctx.getModStrikeWarningLevel('c-orbit') === 3);
assert('Warning 1 modal not shown at 1★', !ctx.shouldShowModStrikeWarningModal('c-orbit', 1));
assert('Warning 2 modal not shown at 1★', !ctx.shouldShowModStrikeWarningModal('c-orbit', 2));
ctx.grantModStrikeFinalChance('c-orbit');
assert('Final Chance unlocks at 1★', ctx.getModStrikeStars('c-orbit') === 1 && !ctx.isModeratorStrikeLocked('c-orbit'));
ctx.manualModStrike('c-orbit', 't');
assert('0 stars deactivates', ctx.getModStrikeStars('c-orbit') === 0 && ctx.isModeratorStrikeDeactivated('c-orbit'));

for (let i = 0; i < 3; i++) ctx.manualModStrike('a-orbit', 'test');
assert('three strikes → 1★ lock', ctx.getModStrikeStars('a-orbit') === 1 && ctx.isModeratorStrikeLocked('a-orbit'));
ctx.manualModStrike('b-orbit', 'test');
assert('manual strike decrements', ctx.getModStrikeStars('b-orbit') === 3);
ctx.resetModStrikeStars('a-orbit');
assert('reset restores four stars', ctx.getModStrikeStars('a-orbit') === 4 && !ctx.isModeratorStrikeLocked('a-orbit'));
ctx.resetModStrikeStars('b-orbit');
ctx.resetModStrikeStars('c-orbit');

assert('Final Chance UI gated at 1★', /stars === 1 && !\(typeof hasModStrikeFinalChance/.test(src));
assert('warning ladder comment', /4→Ok, 3→Warning 1, 2→Warning 2/.test(src));

const rep = ctx.buildModStrikeCheckpointReport();
assert('report finds yesterday booking', rep.yesterday === '2026-09-16' && rep.teams.length === 1);
assert('incomplete booking flagged', rep.teams[0] && rep.teams[0].completed === false);

// Skip must survive a stale SessionState ingest that lacks skippedTeams.
ctx.persistModeratorStrikesSetting = async function() { return { ok: true }; };
ctx.SESSIONSTATE_PA_WRITE_URL = 'https://example.test/write';
ctx.fetchWithRetry = async () => ({ ok: true });
ctx.fetch = async () => ({ ok: true });
ctx.skipModStrikeCheckpointTeam('t1');
let afterSkip = ctx.buildModStrikeCheckpointReport();
assert('skip marks team skipped', afterSkip.teams[0] && afterSkip.teams[0].skipped === true);
assert('skip also marks resolved', afterSkip.teams[0] && afterSkip.teams[0].resolved === true);
assert('skip clears attention', !ctx.modStrikeCheckpointAttentionActive());

const todayPst = ctx.getPSTDateString();
const staleRow = {
  sessionStateId: ctx.MODERATOR_STRIKES_SETTING_ID || 'ss_app_setting_moderator_strikes',
  lastActive: '2099-01-01T00:00:00.000Z',
  stateJson: JSON.stringify({
    type: 'appSetting',
    key: 'moderatorStrikes',
    mods: {},
    checkpoints: {
      [todayPst]: { applied: false, skippedTeams: {}, resolvedTeams: {} },
    },
    updatedAt: '2099-01-01T00:00:00.000Z',
  }),
};
ctx.ingestModeratorStrikesFromSessionRows([staleRow]);
const afterIngest = ctx.buildModStrikeCheckpointReport();
assert('skip survives stale SessionState ingest', afterIngest.teams[0] && afterIngest.teams[0].skipped === true,
  JSON.stringify(afterIngest.teams[0] || {}));
assert('resolved survives stale ingest', afterIngest.teams[0] && afterIngest.teams[0].resolved === true);
assert('attention stays clear after stale ingest', !ctx.modStrikeCheckpointAttentionActive());

// Pure merge helper: local skip ∪ remote resolve
const merged = ctx.mergeModStrikeCheckpoints(
  { '2026-09-18': { skippedTeams: { t1: true }, applied: false } },
  { '2026-09-18': { resolvedTeams: { t2: true }, applied: false } }
);
assert('merge unions skipped+resolved maps',
  merged['2026-09-18'].skippedTeams.t1 === true
  && merged['2026-09-18'].resolvedTeams.t2 === true);

// Session-scoped skip: same incomplete stays gone; new assignment for team is not muted.
const storeAfterSkip = ctx.loadModStrikeStore();
const ckAfter = storeAfterSkip.checkpoints[todayPst] || {};
assert('skip stamps assignment id key', !!(ckAfter.skippedTeams && ckAfter.skippedTeams.asgn1));
assert('skip does not bare-mute teamId', !(ckAfter.skippedTeams && ckAfter.skippedTeams.t1 === true));
assert('same incomplete still skipped via assignment key',
  ctx.modStrikeCheckpointIsSkipped(todayPst, 't1', 'asgn1') === true);
assert('new session for skipped team is not muted',
  ctx.modStrikeCheckpointIsSkipped(todayPst, 't1', 'asgn_new') === false);

// Legacy teamId:true still covers the same incomplete (PR #125 regression).
ctx.saveModStrikeStore({
  mods: {},
  checkpoints: {
    [todayPst]: { applied: false, skippedTeams: { t1: true }, resolvedTeams: { t1: true } },
  },
});
assert('legacy teamId skip still covers checkpoint row',
  ctx.modStrikeCheckpointIsSkipped(todayPst, 't1', 'asgn1') === true);

// Seed a today booking for the same team · legacy bare-team Skip must
// not mute today's new assignment (David policy: Admin Skip never
// interferes with current/today moderator Booking/Session flow).
ctx.adminState.assignments = (ctx.adminState.assignments || []).concat([{
  id: 'asgn_today', teamId: 't1', date: '2026-09-17', status: 'Booked',
  startMin: 14 * 60, endMin: 18 * 60,
}]);
assert('legacy teamId skip does not mute today booking',
  ctx.modStrikeCheckpointIsSkipped(todayPst, 't1', 'asgn_today') === false);
assert('bare mute does not hitch unknown assignmentId',
  ctx.modStrikeCheckpointIsSkipped(todayPst, 't1', 'od_unknown_yuan') === false);

// Banner: hides when no pending; shows only when date filter matches.
ctx.saveModStrikeStore({
  mods: {},
  checkpoints: {
    [todayPst]: {
      applied: false,
      skippedTeams: { asgn1: true },
      resolvedTeams: { asgn1: true },
    },
  },
});
ctx.adminState.perfDateRange = 'all';
ctx.isPastModStrikeCheckpointHour = () => true;
let banner = ctx.renderPerfStrikeCheckpointBannerHTML();
assert('banner gone after skip confirm (no pending)', banner === '');

// Re-seed an unskipped incomplete and gate by date filter
ctx.saveModStrikeStore({ mods: {}, checkpoints: { [todayPst]: { applied: false } } });
ctx.adminState._modStrikeCheckpointReport = null;
ctx.adminState.perfDateRange = 'custom';
ctx.adminState.perfCustomStart = '2026-01-01';
ctx.adminState.perfCustomEnd = '2026-01-31';
banner = ctx.renderPerfStrikeCheckpointBannerHTML();
assert('banner hidden when pending outside date filter', banner === '');

ctx.adminState.perfDateRange = 'all';
ctx.adminState._modStrikeCheckpointReport = null;
banner = ctx.renderPerfStrikeCheckpointBannerHTML();
assert('banner returns when pending matches filter', /mod-strike-check-banner/.test(banner));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
