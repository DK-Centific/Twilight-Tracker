#!/usr/bin/env node
'use strict';

/**
 * Past 9:00 AM PT, Overview and Performance incomplete alerts drop a team
 * the auto-strike gate already processed for that assignment + date.
 * Stars may be healed. kind=auto logs (or the teamAutoStrike stamp) are
 * what clear the alert. An unstruck incomplete team still shows.
 * Skip and Cancel stay off the alert. Before 9:00 AM the clear does not run.
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

console.log('Incomplete alert clears after auto-strike');

assert('version 1.3.091825f',
  /const APP_VERSION = '1\.3\.091825f'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091825f'));

assert('Overview and Performance share the auto-strike clear',
  /function modStrikeAutoStrikeClearsIncompleteAlert/.test(src)
  && /function modStrikeCheckpointRowStillAlerts/.test(src)
  && /modStrikeCheckpointRowStillAlerts\(row\)/.test(src)
  && /modStrikeAutoStrikeClearsIncompleteAlert\(a\)/.test(src)
  && /kind=auto/.test(src));

function sliceFn(name) {
  const re = new RegExp('function ' + name + '\\s*\\([\\s\\S]*?\\n\\}\\n');
  const m = src.match(re);
  if (!m) throw new Error('missing ' + name);
  return m[0];
}

const sliceStart = src.indexOf('function ymd(d)');
const sliceEnd = src.indexOf('function fmtTimeOfDay(min)', sliceStart);
if (sliceStart < 0 || sliceEnd <= sliceStart) {
  console.error('strike slice missing');
  process.exit(1);
}

const OD = 'od_8d6bedbf-amanda';
const OTHER = 'od_other_night';

const block = src.slice(sliceStart, sliceEnd) + '\n'
  + sliceFn('computeOverviewLiveTeamSnapshots') + '\n'
  + sliceFn('isAssignmentSkipOrResolvedForFlagged') + '\n'
  + sliceFn('isAssignmentFlaggedForPerf') + '\n'
  + sliceFn('perfFlaggedAssignmentsInDateRange') + '\n'
  + `
function escapeHTML(s) { return String(s == null ? '' : s); }
function getPSTDateString() { return '2026-09-25'; }
function isPastModStrikeCheckpointHour() { return _pastGate === true; }
function overviewAssignmentIsPerfLive() { return false; }
function assignmentHasModeratorArrivalCheckIn() { return true; }
function perfAssignmentIsTeamCancelled(a) {
  return !!(a && String(a.comment || '').indexOf('mod-cancel-session') === 0);
}
function assignmentSessionStateSaysCancelled() { return false; }
function assignmentIsModCancelForQueue(a) { return !!(a && a.status === 'Cancelled'); }
function assignmentCommentIsModCancel(c) { return String(c || '').indexOf('mod-cancel-session') === 0; }
function isPastAssignmentSessionEnd() { return true; }
function isAssignmentCompleteForFlagged() { return false; }
function perfDateInRange() { return true; }
function perfActiveDateRange() { return 'today'; }
function assignmentBookingSessionEndMs() { return Date.parse('2026-09-25T06:00:00Z'); }
`;

const ctx = {
  ctx: null,
  setTimeout(fn) { if (typeof fn === 'function') fn(); return 0; },
  clearTimeout() {},
  localStorage: {
    _m: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
    setItem(k, v) { this._m[k] = String(v); },
    removeItem(k) { delete this._m[k]; },
  },
  adminState: {
    teams: [],
    assignments: [],
    overview: { timeScope: 'all', teamId: 'all', moderatorId: 'all' },
    perfDateRange: 'today',
    _perfSSOk: true,
    perfSessionStateRows: [],
  },
  state: { username: 'Admin-Twilight' },
  console,
  document: {
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
  },
  _pastGate: true,
};
ctx.ctx = ctx;
vm.createContext(ctx);
vm.runInContext(block, ctx);

function booking(id, teamId, od, extra) {
  return Object.assign({
    id: id,
    teamId: teamId,
    date: '2026-09-24',
    status: 'Booked',
    startMin: 19 * 60,
    endMin: 2 * 60,
    odScheduleId: od,
    participantName: 'Amanda',
    modSnapshots: [],
  }, extra || {});
}

function emptyStore() {
  ctx.saveModStrikeStore({ mods: {}, checkpoints: {}, version: 1, lastWriter: 'test' });
}

function autoEntry(bookingRow) {
  return {
    kind: 'auto',
    assignmentId: bookingRow.id,
    sessionDate: bookingRow.date,
    odScheduleId: bookingRow.odScheduleId,
    sessionAliases: ctx.modStrikeSessionAliasKeys(bookingRow),
    at: '2026-09-25T16:20:00.000Z',
  };
}

function setStarsAndLogs(map) {
  const mods = {};
  Object.keys(map).forEach(orbit => {
    mods[String(orbit).toLowerCase()] = {
      stars: 3,
      log: map[orbit],
    };
  });
  ctx.saveModStrikeStore({
    mods: mods,
    checkpoints: {
      '2026-09-25': { applied: false, skippedTeams: {}, resolvedTeams: {}, teamAutoStrike: {} },
    },
    version: 1,
    lastWriter: 'test',
  });
}

function baseWorld() {
  const struck = booking('list-vj', 't-vj', OD);
  struck.modSnapshots = [{ orbitLoginId: 'Venkata-tw' }, { orbitLoginId: 'Jashit-tw' }];
  const open = booking('list-open', 't-open', OTHER, { participantName: 'Other' });
  open.modSnapshots = [{ orbitLoginId: 'Ada-tw' }, { orbitLoginId: 'Bea-tw' }];
  const skipped = booking('list-skip', 't-skip', 'od_skip');
  skipped.modSnapshots = [{ orbitLoginId: 'SkipA-tw' }, { orbitLoginId: 'SkipB-tw' }];
  const cancelled = booking('list-cancel', 't-cancel', 'od_cancel', {
    status: 'Cancelled',
    comment: 'mod-cancel-session:mod:2026-09-24T20:00:00Z',
  });
  cancelled.modSnapshots = [{ orbitLoginId: 'CanA-tw' }, { orbitLoginId: 'CanB-tw' }];
  ctx.adminState.teams = [
    { id: 't-vj', name: 'Venkata × Jashit', primaryIds: ['Venkata-tw', 'Jashit-tw'] },
    { id: 't-open', name: 'North Crew', primaryIds: ['Ada-tw', 'Bea-tw'] },
    { id: 't-skip', name: 'Skip Crew', primaryIds: ['SkipA-tw', 'SkipB-tw'] },
    { id: 't-cancel', name: 'Cancel Crew', primaryIds: ['CanA-tw', 'CanB-tw'] },
  ];
  ctx.adminState.assignments = [struck, open, skipped, cancelled];
  ctx.adminState.perfSessionStateRows = ctx.adminState.assignments.map(a => ({
    id: 'ss-' + a.id,
    assignmentId: a.id,
    orbitLoginId: (a.modSnapshots[0] || {}).orbitLoginId,
    sessionStatus: 'station_2_done',
    sessionDate: '2026-09-24',
    stateJson: '{}',
  }));
  ctx.adminState._perfSSOk = true;
  emptyStore();
  ctx._pastGate = true;
  return { struck, open, skipped, cancelled };
}

function names(list) {
  return (list || []).map(r => r.teamName || r.name || '').join('|');
}

let world = baseWorld();
setStarsAndLogs({
  'Venkata-tw': [autoEntry(world.struck)],
  'Jashit-tw': [autoEntry(world.struck)],
});
ctx._pastGate = true;

assert('healed 3-star mods with kind=auto still clear the alert',
  ctx.modStrikeAutoStrikeClearsIncompleteAlert(world.struck) === true
  && (ctx.loadModStrikeStore().mods['venkata-tw'].stars === 3));

const snaps = ctx.computeOverviewLiveTeamSnapshots(ctx.adminState.assignments, 6);
assert('Overview live status omits the auto-struck team',
  !snaps.some(r => String(r.teamId) === 't-vj' || /Venkata/.test(r.teamName)));
assert('Overview live status still lists the unstruck incomplete team',
  snaps.some(r => String(r.teamId) === 't-open' && r.kind === 'flagged'));

const banner = ctx.renderPerfStrikeCheckpointBannerHTML();
assert('Performance banner omits the auto-struck team', !/Venkata/.test(banner));
assert('Performance banner still lists the unstruck team', /North Crew/.test(banner));
assert('attention glow is on only while an unstruck incomplete remains',
  ctx.modStrikeCheckpointAttentionActive() === true);

const flagged = ctx.perfFlaggedAssignmentsInDateRange();
assert('Flagged incomplete list omits the auto-struck assignment',
  !flagged.some(a => String(a.id) === 'list-vj'));
assert('Flagged incomplete list keeps the unstruck assignment',
  flagged.some(a => String(a.id) === 'list-open'));

ctx._pastGate = false;
assert('before 9 AM the same kind=auto logs do not clear the alert',
  ctx.modStrikeAutoStrikeClearsIncompleteAlert(world.struck) === false);
const early = ctx.computeOverviewLiveTeamSnapshots(ctx.adminState.assignments, 6);
assert('before 9 AM Overview can still list that team',
  early.some(r => String(r.teamId) === 't-vj'));
ctx._pastGate = true;

setStarsAndLogs({
  'Venkata-tw': [autoEntry(world.struck)],
  'Jashit-tw': [],
});
assert('one primary with kind=auto and no stamp still alerts',
  ctx.modStrikeAutoStrikeClearsIncompleteAlert(world.struck) === false);
const partial = ctx.computeOverviewLiveTeamSnapshots(ctx.adminState.assignments, 6);
assert('Overview keeps a partly struck team',
  partial.some(r => String(r.teamId) === 't-vj'));

setStarsAndLogs({
  'Venkata-tw': [{ kind: 'manual', assignmentId: world.struck.id, sessionDate: '2026-09-24', sessionAliases: ctx.modStrikeSessionAliasKeys(world.struck) }],
  'Jashit-tw': [{ kind: 'manual', assignmentId: world.struck.id, sessionDate: '2026-09-24', sessionAliases: ctx.modStrikeSessionAliasKeys(world.struck) }],
});
assert('manual logs alone do not clear the incomplete alert',
  ctx.modStrikeAutoStrikeClearsIncompleteAlert(world.struck) === false);

const otherBooking = booking('list-else', 't-vj', 'od_different', {
  startMin: 8 * 60,
  endMin: 9 * 60,
  participantName: 'Other Person',
  participantData: { firstName: 'Other', lastName: 'Person' },
});
setStarsAndLogs({
  'Venkata-tw': [autoEntry(otherBooking)],
  'Jashit-tw': [autoEntry(otherBooking)],
});
const struckKeys = ctx.modStrikeSessionAliasKeys(world.struck);
const otherKeys = ctx.modStrikeSessionAliasKeys(otherBooking);
assert('a later session the same day is a different strike slot',
  struckKeys.every(k => otherKeys.indexOf(k) < 0));
assert('kind=auto for a different assignment does not clear this one',
  ctx.modStrikeAutoStrikeClearsIncompleteAlert(world.struck) === false);

emptyStore();
const aliases = ctx.modStrikeSessionAliasKeys(world.struck);
const store = ctx.loadModStrikeStore();
store.checkpoints['2026-09-25'] = {
  applied: true,
  skippedTeams: {},
  resolvedTeams: {},
  teamAutoStrike: {},
};
aliases.forEach(k => { store.checkpoints['2026-09-25'].teamAutoStrike[k] = true; });
ctx.saveModStrikeStore(store);
assert('teamAutoStrike stamp clears the alert even when logs were dropped',
  ctx.modStrikeAutoStrikeClearsIncompleteAlert(world.struck) === true
  && !ctx.computeOverviewLiveTeamSnapshots(ctx.adminState.assignments, 6).some(r => String(r.teamId) === 't-vj')
  && !/Venkata/.test(ctx.renderPerfStrikeCheckpointBannerHTML()));

emptyStore();
store.checkpoints = {
  '2026-09-25': {
    applied: false,
    skippedTeams: { 'list-skip': true },
    resolvedTeams: { 'list-skip': true },
    teamAutoStrike: {},
  },
};
ctx.saveModStrikeStore(store);
const skipBanner = ctx.renderPerfStrikeCheckpointBannerHTML();
const skipSnaps = ctx.computeOverviewLiveTeamSnapshots(ctx.adminState.assignments, 6);
assert('Skip stays off Overview Not completed',
  !skipSnaps.some(r => String(r.teamId) === 't-skip'));
assert('Skip is not an open Strike row on the Performance banner',
  !/data-mod-strike-checkpoint-strike="t-skip"/.test(skipBanner)
  && ctx.isAssignmentFlaggedForPerf(world.skipped) === false);
assert('Cancelled stays off the incomplete alert',
  !/Cancel Crew/.test(skipBanner)
  && !skipSnaps.some(r => String(r.teamId) === 't-cancel')
  && ctx.isAssignmentFlaggedForPerf(world.cancelled) === false);
assert('unstruck incomplete is not a special-case team name',
  names(ctx.computeOverviewLiveTeamSnapshots(ctx.adminState.assignments, 6)).indexOf('North Crew') >= 0);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
