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

assert('version bump 091823c',
  /const APP_VERSION = '1\.3\.091823c'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091823c'));
assert('grid card stars replace the orbit id line',
  /class="mod-card-stars"/.test(src)
  && !/class="mod-id"/.test(src)
  && html.includes('.mod-card-stars')
  && /mod-card-stars[\s\S]{0,320}flex-wrap:\s*nowrap/.test(html)
  && /mod-card-stars[\s\S]{0,400}min-height:\s*16px/.test(html));
assert('per-orbit strike freshness + write barrier',
  /function modStrikeRecordFreshnessMs/.test(src)
  && /function modStrikeShouldKeepLocal/.test(src)
  && /function modStrikeLoweringBlocked/.test(src)
  && /heal-stale-strike-stomp/.test(src)
  && /refuse-older-version/.test(src)
  && /updatedAt: touchedAt/.test(src)
  && /deactivated: false/.test(src));
assert('strike scale v4 one-shot helpers',
  /function ensureModStrikeScaleV4/.test(src)
  && /function mergeModStrikeMods/.test(src)
  && /function modStrikeStoreSig/.test(src)
  && /MOD_STRIKE_SCALE_V4_FLAG_KEY/.test(src)
  && /Cloud wins over empty/.test(src));
assert('perf Helios motion helpers + tokens (v)',
  /function perfPlayMotion/.test(src)
  && /function perfQueueMotion/.test(src)
  && /function perfApplyDetailEnter/.test(src)
  && /perfQueueMotion\('crossfade'\)/.test(src)
  && html.includes('--perf-ease')
  && html.includes('perf-shell.perf-enter')
  && html.includes('perf-detail-enter'));
assert('perf poll signature skip (no Flagged re-stagger)',
  /function perfLiveContentSig/.test(src)
  && /function refreshPerfLiveDataInPlace/.test(src)
  && /refreshPerfLiveDataInPlace\(\{ reason: 'modStrike' \}\)/.test(src)
  && /fhRefreshBody\(root, \{ motion: 'none'/.test(src));
assert('SS persist refuses empty mods + flush on strike writes',
  /refuse-empty-mods/.test(src)
  && /backfill-local-to-cloud/.test(src)
  && /flushPersistModeratorStrikesSetting\(\{ reason: 'set-stars'/.test(src)
  && /flushPersistModeratorStrikesSetting\(\{ reason: 'final-chance'/.test(src)
  && /flushPersistModeratorStrikesSetting\(\{ reason: 'reset-stars'/.test(src));
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
  && /function foldModeratorStrikesBlobs/.test(src)
  && /MOD_STRIKE_BARRIER_LS_KEY/.test(src)
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
  localStorage: {
    _m: {},
    getItem(k) { return this._m[k] || null; },
    setItem(k, v) { this._m[k] = v; },
    removeItem(k) { delete this._m[k]; },
  },
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
ctx.console = console;
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
const realPersistStrikes = ctx.persistModeratorStrikesSetting;
ctx._persistReasons = [];
ctx.persistModeratorStrikesSetting = async function(opts) {
  ctx._persistReasons.push((opts && opts.reason) || '');
  return { ok: true };
};
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

function strikeRow(mods, extra) {
  return {
    sessionStateId: 'ss_app_setting_moderator_strikes',
    lastActive: (extra && extra.lastActive) || '2026-09-21T22:30:00.000Z',
    stateJson: JSON.stringify(Object.assign({
      type: 'appSetting',
      key: 'moderatorStrikes',
      mods: mods,
      checkpoints: {},
      starScale: 4,
    }, extra || {})),
  };
}

ctx._deactCalls = [];
ctx.setUserDeactivatedInCache = (id, on) => { ctx._deactCalls.push([String(id), !!on]); };
ctx.persistDeactivatedUsersSetting = async () => ({ ok: true });

// PA heal already live: david-tw Active, 4★, deactivated false, blob version 1.
// A local 0★ / deactivated cache must take that heal and must not write 0★ back.
ctx._persistReasons = [];
ctx.saveModStrikeStore({
  mods: {
    'david-tw': {
      stars: 0,
      starScale: 4,
      strikeDeactivated: true,
      log: [{ at: '2026-09-21T18:00:00.000Z', kind: 'auto', reason: 'old strike' }],
    },
  },
  checkpoints: {},
  version: 0,
  lastWriter: '',
});
ctx.ingestModeratorStrikesFromSessionRows([strikeRow({
  'david-tw': {
    stars: 4,
    starScale: 4,
    deactivated: false,
    updatedAt: '2026-09-21T22:00:00.000Z',
    updatedBy: 'PA',
    log: [{ at: '2026-09-21T22:00:00.000Z', kind: 'reset', reason: 'PA heal', by: 'PA' }],
  },
}, { version: 1, lastWriter: 'PA', lastActive: '2026-09-21T22:05:00.000Z' })]);
let healed = ctx.loadModStrikeStore();
assert('PA heal ingest restores david-tw to 4★',
  healed.mods['david-tw'] && healed.mods['david-tw'].stars === 4 && healed.version === 1,
  JSON.stringify(healed.mods['david-tw'] || {}));
assert('PA heal clears strikeDeactivated', !(healed.mods['david-tw'] && healed.mods['david-tw'].strikeDeactivated));
assert('PA heal does not re-deactivate', !ctx._deactCalls.some(c => c[1] === true), JSON.stringify(ctx._deactCalls));
assert('PA heal marks the user active', ctx._deactCalls.some(c => c[0] === 'david-tw' && c[1] === false));
assert('PA heal does not flush a stale lower blob', !ctx._persistReasons.includes('heal-stale-strike-stomp'));

// Stale poll (older stars, older updatedAt, older blob version) must not undo the heal.
ctx._deactCalls = [];
ctx.ingestModeratorStrikesFromSessionRows([strikeRow({
  'david-tw': {
    stars: 1,
    starScale: 4,
    strikeDeactivated: true,
    deactivated: true,
    updatedAt: '2026-09-21T19:00:00.000Z',
    updatedBy: 'Brian-tw',
    log: [{ at: '2026-09-21T19:00:00.000Z', kind: 'manual', reason: 'stale' }],
  },
}, { version: 0, lastWriter: 'Brian-tw', lastActive: '2026-09-21T22:06:00.000Z' })]);
healed = ctx.loadModStrikeStore();
assert('stale poll does not regress PA heal', healed.mods['david-tw'] && healed.mods['david-tw'].stars === 4);
assert('stale poll does not re-deactivate after heal', !ctx._deactCalls.some(c => c[1] === true));

// Fresher Admin reset beats an older remote with fewer stars.
const mergedReset = ctx.mergeModStrikeMods(
  {
    'david-tw': {
      stars: 4, starScale: 4, deactivated: false,
      updatedAt: '2026-09-21T22:20:00.000Z', updatedBy: 'Admin-Twilight',
      log: [{ at: '2026-09-21T22:20:00.000Z', kind: 'reset', reason: 'Stars reset', by: 'Admin-Twilight' }],
    },
  },
  {
    'david-tw': {
      stars: 0, starScale: 4, strikeDeactivated: true,
      updatedAt: '2026-09-21T21:00:00.000Z', updatedBy: 'Brian-tw',
      log: [{ at: '2026-09-21T21:00:00.000Z', kind: 'auto', reason: 'old' }],
    },
  }
);
assert('fresher reset wins over older lower stars',
  mergedReset['david-tw'] && mergedReset['david-tw'].stars === 4 && !mergedReset['david-tw'].strikeDeactivated);

// No updatedAt → fall back to log[0].at. Newer log wins.
const mergedLog = ctx.mergeModStrikeMods(
  { 'solo-mod': { stars: 4, starScale: 4, log: [{ at: '2026-09-21T22:00:00.000Z', kind: 'reset' }] } },
  { 'solo-mod': { stars: 1, starScale: 4, log: [{ at: '2026-09-21T20:00:00.000Z', kind: 'manual' }] } }
);
assert('log[0].at fallback keeps newer reset', mergedLog['solo-mod'] && mergedLog['solo-mod'].stars === 4);

// updatedAt is the primary stamp even when log[0].at is older.
const mergedUpdated = ctx.mergeModStrikeMods(
  { 'solo-mod': { stars: 4, starScale: 4, updatedAt: '2026-09-21T18:00:00.000Z', log: [{ at: '2026-09-21T23:00:00.000Z', kind: 'reset' }] } },
  { 'solo-mod': { stars: 2, starScale: 4, updatedAt: '2026-09-21T22:00:00.000Z', log: [{ at: '2026-09-21T22:00:00.000Z', kind: 'manual' }] } }
);
assert('newer updatedAt wins over an older updatedAt', mergedUpdated['solo-mod'] && mergedUpdated['solo-mod'].stars === 2);

// Older blob version loses even if a per-mod stamp looks newer.
const mergedBlob = ctx.mergeModStrikeMods(
  { 'david-tw': { stars: 4, starScale: 4, updatedAt: '2026-09-21T22:00:00.000Z', log: [{ at: '2026-09-21T22:00:00.000Z', kind: 'reset' }] } },
  { 'david-tw': { stars: 0, starScale: 4, updatedAt: '2026-09-21T23:00:00.000Z', strikeDeactivated: true, log: [{ at: '2026-09-21T23:00:00.000Z', kind: 'manual' }] } },
  { remoteBlobOlder: true }
);
assert('older blob version loses merge', mergedBlob['david-tw'] && mergedBlob['david-tw'].stars === 4);

// A real newer strike (no write barrier) still applies.
ctx._deactCalls = [];
ctx.saveModStrikeStore({
  mods: {
    'other-mod': {
      stars: 4, starScale: 4, deactivated: false,
      updatedAt: '2026-09-21T22:00:00.000Z', updatedBy: 'Admin-Twilight',
      log: [{ at: '2026-09-21T22:00:00.000Z', kind: 'reset', by: 'Admin-Twilight' }],
    },
  },
  checkpoints: {},
  version: 1,
  lastWriter: 'Admin-Twilight',
});
ctx.ingestModeratorStrikesFromSessionRows([strikeRow({
  'other-mod': {
    stars: 3, starScale: 4,
    updatedAt: '2026-09-21T22:40:00.000Z', updatedBy: 'Brian-tw',
    log: [{ at: '2026-09-21T22:40:00.000Z', kind: 'manual', reason: 'Admin strike', by: 'Brian-tw' }],
  },
}, { version: 2, lastWriter: 'Brian-tw' })]);
assert('newer remote strike still applies', ctx.getModStrikeStars('other-mod') === 3);
assert('newer non-zero strike does not deactivate', !ctx._deactCalls.some(c => c[1] === true));

// Post-reset window: a poll that would lower stars must not re-deactivate.
ctx._deactCalls = [];
ctx._persistReasons = [];
ctx.resetModStrikeStars('david-tw');
const resetRec = ctx.loadModStrikeStore().mods['david-tw'];
assert('reset stamps updatedAt and updatedBy',
  !!(resetRec && resetRec.updatedAt && resetRec.updatedBy && resetRec.log[0] && resetRec.log[0].kind === 'reset'
    && resetRec.log[0].at === resetRec.updatedAt && resetRec.deactivated === false));
assert('reset bumps blob version', ctx.loadModStrikeStore().version >= 2);
ctx.ingestModeratorStrikesFromSessionRows([strikeRow({
  'david-tw': {
    stars: 0, starScale: 4, strikeDeactivated: true, deactivated: true,
    updatedAt: '2026-09-21T22:50:00.000Z', updatedBy: 'Brian-tw',
    log: [{ at: '2026-09-21T22:50:00.000Z', kind: 'manual', reason: 'late stale', by: 'Brian-tw' }],
  },
}, { version: 9, lastWriter: 'Brian-tw', lastActive: '2026-09-21T22:51:00.000Z' })]);
assert('post-reset poll cannot lower stars', ctx.getModStrikeStars('david-tw') === 4);
assert('post-reset poll does not re-deactivate', !ctx._deactCalls.some(c => c[1] === true), JSON.stringify(ctx._deactCalls));

// In-flight persist blocks a lowering poll for that orbit.
ctx.console = console;
ctx.SESSIONSTATE_PA_WRITE_URL = 'https://example.test/write';
ctx.fetch = async () => ({ ok: true });
let releaseInflight = null;
ctx.fetchWithRetry = () => new Promise(resolve => { releaseInflight = resolve; });
ctx.persistModeratorStrikesSetting = realPersistStrikes;
ctx.saveModStrikeStore({
  mods: {
    'inflight-mod': {
      stars: 4, starScale: 4, deactivated: false,
      updatedAt: '2026-09-21T22:10:00.000Z', updatedBy: 'Admin-Twilight',
      log: [{ at: '2026-09-21T22:10:00.000Z', kind: 'reset', by: 'Admin-Twilight' }],
    },
  },
  checkpoints: {},
  version: 9,
  lastWriter: 'Admin-Twilight',
});
ctx._deactCalls = [];
ctx.persistModeratorStrikesSetting({ reason: 'reset-stars', orbitId: 'inflight-mod' });
ctx.ingestModeratorStrikesFromSessionRows([strikeRow({
  'inflight-mod': {
    stars: 0, starScale: 4, strikeDeactivated: true, deactivated: true,
    updatedAt: '2026-09-21T22:12:00.000Z', updatedBy: 'Brian-tw',
    log: [{ at: '2026-09-21T22:12:00.000Z', kind: 'manual', by: 'Brian-tw' }],
  },
}, { version: 8, lastWriter: 'Brian-tw' })]);
assert('in-flight persist blocks lowering ingest', ctx.getModStrikeStars('inflight-mod') === 4);
assert('in-flight persist does not re-deactivate', !ctx._deactCalls.some(c => c[1] === true), JSON.stringify(ctx._deactCalls));
if (releaseInflight) releaseInflight({ ok: true });
try { vm.runInContext('_modStrikePersistInFlight = 0;', ctx); } catch (_) {}

// --- Reload-after-push holes (1.3.091822c) ---
ctx.persistModeratorStrikesSetting = async function(opts) {
  const store = ctx.loadModStrikeStore();
  ctx._persistReasons.push((opts && opts.reason) || '');
  ctx._persistedStars = ctx._persistedStars || [];
  ctx._persistedStars.push({
    reason: (opts && opts.reason) || '',
    empty: ctx.modStrikeModsAreEmpty(store.mods),
    david: store.mods['david-tw'] && store.mods['david-tw'].stars,
  });
  return { ok: true };
};
ctx._persistReasons = [];
ctx._persistedStars = [];
ctx._deactCalls = [];

// Empty cloud must not replace a healthy local 3★.
ctx.saveModStrikeStore({
  mods: {
    'david-tw': {
      stars: 3, starScale: 4,
      updatedAt: '2026-09-22T04:00:00.000Z', updatedBy: 'Admin-Twilight',
      log: [{ at: '2026-09-22T04:00:00.000Z', kind: 'manual', by: 'Admin-Twilight' }],
    },
  },
  checkpoints: {},
  version: 4,
  lastWriter: 'Admin-Twilight',
});
ctx._persistReasons = [];
ctx._persistedStars = [];
ctx.ingestModeratorStrikesFromSessionRows([strikeRow({}, {
  version: 8, lastWriter: 'shell', lastActive: '2026-09-22T18:00:00.000Z',
})]);
assert('empty cloud does not wipe non-empty local', ctx.getModStrikeStars('david-tw') === 3);
assert('empty cloud backfill writes local 3',
  ctx._persistedStars.some(p => p.reason === 'backfill-local-to-cloud' && p.empty !== true && p.david === 3),
  JSON.stringify(ctx._persistedStars));

// Cold localStorage: newer-lastActive empty SS row must not hide an older healthy blob.
ctx.localStorage.removeItem('centific_mod_strike_scale_v4_done');
ctx.saveModStrikeStore({ mods: {}, checkpoints: {}, version: 0, lastWriter: '' });
ctx.ingestModeratorStrikesFromSessionRows([
  strikeRow({
    'david-tw': {
      stars: 3, starScale: 4,
      updatedAt: '2026-09-22T01:00:00.000Z',
      log: [{ at: '2026-09-22T01:00:00.000Z', kind: 'manual', by: 'Admin-Twilight' }],
    },
  }, { version: 4, lastActive: '2026-09-22T01:00:00.000Z', lastWriter: 'Admin-Twilight' }),
  strikeRow({}, { version: 9, lastActive: '2026-09-22T06:00:00.000Z', lastWriter: 'shell' }),
]);
assert('newer-lastActive empty row does not wipe cold local',
  ctx.getModStrikeStars('david-tw') === 3,
  JSON.stringify(ctx.loadModStrikeStore().mods['david-tw'] || {}));

// Blob starScale 4 + unstamped remaining 3 must not remap to 4 on cold ingest.
ctx.localStorage.removeItem('centific_mod_strike_scale_v4_done');
ctx.saveModStrikeStore({ mods: {}, checkpoints: {}, version: 0, lastWriter: '' });
ctx.ingestModeratorStrikesFromSessionRows([strikeRow({
  'david-tw': {
    stars: 3,
    updatedAt: '2026-09-22T02:00:00.000Z',
    log: [{ at: '2026-09-22T02:00:00.000Z', kind: 'manual', by: 'Admin-Twilight' }],
  },
}, { version: 3, lastActive: '2026-09-22T02:00:00.000Z' })]);
const unstamped = ctx.loadModStrikeStore().mods['david-tw'];
assert('v4 blob does not remap unstamped remaining 3',
  unstamped && unstamped.stars === 3 && unstamped.starScale === 4,
  JSON.stringify(unstamped || {}));

// Already-stamped 3 survives a read and a same-count cloud poll (version bump / hard refresh).
ctx.saveModStrikeStore({
  mods: {
    'david-tw': {
      stars: 3, starScale: 4,
      updatedAt: '2026-09-22T04:00:00.000Z',
      log: [{ at: '2026-09-22T04:00:00.000Z', kind: 'manual' }],
    },
  },
  checkpoints: {},
  version: 6,
  lastWriter: 'Admin-Twilight',
});
ctx._persistReasons = [];
assert('read path does not change stamped 3', ctx.getModStrikeStars('david-tw') === 3);
assert('read path does not schedule a cloud write', ctx._persistReasons.length === 0, JSON.stringify(ctx._persistReasons));
assert('scale helper does not remigrate stamped 3',
  ctx.ensureModStrikeScaleV4(ctx.loadModStrikeStore().mods['david-tw']).stars === 3);
ctx.ingestModeratorStrikesFromSessionRows([strikeRow({
  'david-tw': {
    stars: 3, starScale: 4,
    updatedAt: '2026-09-22T04:00:00.000Z',
    log: [{ at: '2026-09-22T04:00:00.000Z', kind: 'manual' }],
  },
}, { version: 6, lastActive: '2026-09-22T20:00:00.000Z' })]);
assert('version-bump poll keeps stamped 3', ctx.getModStrikeStars('david-tw') === 3);

// Same updatedAt poison (cloud 4, local 3) must not raise stars.
ctx.ingestModeratorStrikesFromSessionRows([strikeRow({
  'david-tw': {
    stars: 4, starScale: 4, deactivated: false,
    updatedAt: '2026-09-22T04:00:00.000Z',
    log: [{ at: '2026-09-22T04:00:00.000Z', kind: 'reset' }],
  },
}, { version: 7, lastActive: '2026-09-22T21:00:00.000Z', lastWriter: 'bad-scale' })]);
assert('tied cloud copy cannot raise stamped 3 to 4', ctx.getModStrikeStars('david-tw') === 3);

// Stale lower remote after an Admin reset (barrier still in memory).
ctx._deactCalls = [];
ctx.resetModStrikeStars('david-tw');
ctx.ingestModeratorStrikesFromSessionRows([strikeRow({
  'david-tw': {
    stars: 1, starScale: 4,
    updatedAt: '2026-09-21T08:00:00.000Z',
    log: [{ at: '2026-09-21T08:00:00.000Z', kind: 'manual' }],
  },
}, { version: 1, lastActive: '2026-09-22T22:00:00.000Z' })]);
assert('stale lower remote after Admin reset stays at 4', ctx.getModStrikeStars('david-tw') === 4);
assert('stale lower after reset does not deactivate', !ctx._deactCalls.some(c => c[1] === true));

// Hard refresh drops the in-memory barrier. The stored barrier must still block.
ctx.localStorage.setItem('centific_mod_strike_barrier_v1', JSON.stringify({
  'reload-mod': Date.now() + 120000,
}));
ctx.saveModStrikeStore({
  mods: {
    'reload-mod': {
      stars: 4, starScale: 4, deactivated: false,
      updatedAt: '2026-09-21T01:00:00.000Z', updatedBy: 'Admin-Twilight',
      log: [{ at: '2026-09-21T01:00:00.000Z', kind: 'reset', by: 'Admin-Twilight' }],
    },
  },
  checkpoints: {},
  version: 2,
  lastWriter: 'Admin-Twilight',
});
ctx._deactCalls = [];
ctx.ingestModeratorStrikesFromSessionRows([strikeRow({
  'reload-mod': {
    stars: 0, starScale: 4, strikeDeactivated: true, deactivated: true,
    updatedAt: '2026-09-22T12:00:00.000Z',
    log: [{ at: '2026-09-22T12:00:00.000Z', kind: 'manual' }],
  },
}, { version: 8, lastActive: '2026-09-22T12:01:00.000Z' })]);
assert('stored barrier blocks stale lower after reload', ctx.getModStrikeStars('reload-mod') === 4);
assert('stored barrier does not deactivate', !ctx._deactCalls.some(c => c[1] === true), JSON.stringify(ctx._deactCalls));

// Pre-v4 bare {stars:3} (old "full") still remaps once when the blob has no starScale.
ctx.localStorage.removeItem('centific_mod_strike_scale_v4_done');
ctx.saveModStrikeStore({ mods: {}, checkpoints: {}, version: 0, lastWriter: '' });
ctx.ingestModeratorStrikesFromSessionRows([strikeRow(
  { 'legacy-mod': { stars: 3 } },
  { starScale: null, version: 1, lastActive: '2020-01-01T00:00:00.000Z' }
)]);
assert('pre-v4 bare 3 still remaps once to 4', ctx.getModStrikeStars('legacy-mod') === 4);

assert('auto-strike waits for SessionState and rechecks team-OR',
  /function modStrikeSessionStateReady/.test(src)
  && /function modStrikeAssignmentEvidence/.test(src)
  && /function commitAutoModStrike/.test(src)
  && /_perfSSOk/.test(src)
  && /evidence !== 'incomplete'/.test(src)
  && /pacificWallClockToMs\(today, 9 \* 60\)/.test(src));
assert('skip stamps every checkpoint day for that booking',
  /modStrikeCheckpointDaysForBooking\(booking\)/.test(src)
  && /modStrikeBumpBlobVersion\(store\)/.test(src));

// --- 9 AM gate + completed teams + Skip (1.3.091823c) ---
ctx.isAssignmentTeamHappypathComplete = (a) => !!ctx._teamComplete;
ctx._teamComplete = false;
ctx.adminState.assignments = [{
  id: 'asgn1', teamId: 't1', date: '2026-09-16', status: 'Booked',
  startMin: 10 * 60, endMin: 12 * 60,
}];
ctx.adminState._perfSSOk = true;
ctx.adminState.perfSessionStateRows = [];
ctx.resetModStrikeStars('a-orbit');
ctx.resetModStrikeStars('b-orbit');
ctx.saveModStrikeStore({
  mods: ctx.loadModStrikeStore().mods,
  checkpoints: {},
  version: ctx.loadModStrikeStore().version,
  lastWriter: 'Admin-Twilight',
});
const gateMs = ctx.assignmentAutoStrikeDeadlineMs(ctx.adminState.assignments[0]);
assert('deadline is 9:00 AM PT the morning after the booking',
  Number.isFinite(gateMs) && gateMs === ctx.pacificWallClockToMs('2026-09-17', 9 * 60));

ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: gateMs - 60 * 1000 });
assert('before 9 AM PT incomplete does not remove a star',
  ctx.getModStrikeStars('a-orbit') === 4 && ctx.getModStrikeStars('b-orbit') === 4);

ctx._teamComplete = true;
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: gateMs + 60 * 1000 });
assert('completed team (team-OR) is not struck after 9 AM',
  ctx.getModStrikeStars('a-orbit') === 4 && ctx.getModStrikeStars('b-orbit') === 4);

ctx._teamComplete = false;
ctx.adminState._perfSSOk = false;
ctx.adminState.perfSessionStateRows = null;
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: gateMs + 60 * 1000 });
assert('no auto-strike before SessionState has loaded',
  ctx.getModStrikeStars('a-orbit') === 4);

ctx.adminState._perfSSOk = true;
ctx.adminState.perfSessionStateRows = new Array(256).fill(null).map((_, i) => ({
  id: i, assignmentId: 'other', orbitLoginId: 'x', stateJson: '{}',
}));
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: gateMs + 60 * 1000 });
assert('truncated SessionState page does not strike a booking with no row',
  ctx.getModStrikeStars('a-orbit') === 4 && ctx.getModStrikeStars('b-orbit') === 4);

ctx.adminState.perfSessionStateRows = [];
ctx.skipModStrikeCheckpointTeam('t1');
const skipCk = ctx.loadModStrikeStore().checkpoints['2026-09-17'] || {};
const skipBook = ctx.loadModStrikeStore().checkpoints['2026-09-16'] || {};
assert('skip persists on the strike day and the booking day',
  !!(skipCk.skippedTeams && skipCk.skippedTeams.asgn1)
  && !!(skipBook.skippedTeams && skipBook.skippedTeams.asgn1));
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: gateMs + 60 * 1000 });
assert('skip blocks the strike for that session',
  ctx.getModStrikeStars('a-orbit') === 4 && ctx.getModStrikeStars('b-orbit') === 4);

ctx.saveModStrikeStore({
  mods: ctx.loadModStrikeStore().mods,
  checkpoints: {},
  version: ctx.loadModStrikeStore().version,
  lastWriter: 'Admin-Twilight',
});
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: gateMs + 60 * 1000 });
assert('after 9 AM an incomplete team is strike eligible',
  ctx.getModStrikeStars('a-orbit') === 3 && ctx.getModStrikeStars('b-orbit') === 3);
const struckStore = ctx.loadModStrikeStore();
const autoMark = struckStore.checkpoints['2026-09-17'] || {};
assert('auto-strike is scoped to assignmentId and session date',
  !!(autoMark.teamAutoStrike && autoMark.teamAutoStrike.asgn1 && autoMark.teamAutoStrike['asgn1|2026-09-16'])
  && !autoMark.teamAutoStrike.t1);
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: gateMs + 5 * 60 * 1000 });
assert('same session is not struck twice',
  ctx.getModStrikeStars('a-orbit') === 3 && ctx.getModStrikeStars('b-orbit') === 3);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
