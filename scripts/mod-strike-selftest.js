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

assert('version bump 091818b',
  /const APP_VERSION = '1\.3\.091818b'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091818b'));
assert('overview live status strike attention glow',
  /function modStrikeCheckpointAttentionActive/.test(src)
  && /function syncOverviewLiveStatusStrikeAttention/.test(src)
  && html.includes('.ov-stat-livestatus.is-strike-attention'));
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
  /MOD_STRIKE_MAX_STARS = 3/.test(src)
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
    }],
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
`;
vm.createContext(ctx);
vm.runInContext(patched, ctx);

assert('warning copy level 1 bold', ctx.modStrikeWarningMessageHTML(1).includes('<strong>Warning 1</strong>'));
assert('warning contact line break', ctx.modStrikeWarningMessageHTML(1).includes('<br><br>Please contact'));
assert('warning copy level 3 locked', ctx.modStrikeWarningMessageHTML(3).includes('under review.<br><br>Please contact'));
assert('lock overlay has no wasted banner', !/mod-strike-mod-wasted/.test(src));
assert('warning level from stars', ctx.getModStrikeWarningLevel('c-orbit') === 0);
ctx.manualModStrike('c-orbit', 't');
assert('one strike is warning 1', ctx.getModStrikeWarningLevel('c-orbit') === 1);

for (let i = 0; i < 3; i++) ctx.manualModStrike('a-orbit', 'test');
assert('three strikes lock account', ctx.getModStrikeStars('a-orbit') === 0 && ctx.isModeratorStrikeLocked('a-orbit'));
ctx.manualModStrike('b-orbit', 'test');
assert('manual strike decrements', ctx.getModStrikeStars('b-orbit') === 2);
ctx.resetModStrikeStars('a-orbit');
assert('reset restores three stars', ctx.getModStrikeStars('a-orbit') === 3 && !ctx.isModeratorStrikeLocked('a-orbit'));
ctx.resetModStrikeStars('b-orbit');

const rep = ctx.buildModStrikeCheckpointReport();
assert('report finds yesterday booking', rep.yesterday === '2026-09-16' && rep.teams.length === 1);
assert('incomplete booking flagged', rep.teams[0] && rep.teams[0].completed === false);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
