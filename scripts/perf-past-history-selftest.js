#!/usr/bin/env node
'use strict';

/**
 * Admin Performance Past / history review (1.3.091821a).
 *
 * Reproduces: PA-healed Sep 19 session_done teams (PxM / MxS) with
 * Skip+resolved on checkpoint 2026-09-20 disappear from the Today/Live
 * admin queue, but must remain reviewable under All time / Custom / Done.
 * Past is only the rolling last 24 hours (booked session end).
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'twilight.js'), 'utf8');

function sliceBetween(startMarker, endMarker) {
  const begin = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, begin + 1);
  if (begin < 0 || end <= begin) {
    console.error('Could not slice', startMarker);
    process.exit(1);
  }
  return src.slice(begin, end);
}

const TODAY = '2026-09-21';
const SKIP_DAY = '2026-09-20';

const pxm = {
  id: 'od_27c50635-pxm',
  teamId: 100210,
  teamName: 'Pradeepreddy × Manoj',
  date: '2026-09-19',
  startMin: 14 * 60,
  endMin: 22 * 60,
  status: 'Rescheduled',
  odStatus: 'Rescheduled',
  participantData: { firstName: 'Rohit' },
  modSnapshots: [{ orbitLoginId: 'Pradeepreddy-tw' }, { orbitLoginId: 'Manoj-tw' }],
};

const mxs = {
  id: 'od_d9286d02-mxs',
  teamId: 100211,
  teamName: 'Muhammad × Sravya',
  date: '2026-09-19',
  startMin: 14 * 60,
  endMin: 22 * 60,
  status: 'Booked',
  odStatus: 'Scheduled',
  participantData: { firstName: 'lisa' },
  modSnapshots: [{ orbitLoginId: 'Muhammad-tw' }, { orbitLoginId: 'Sravya-tw' }],
};

const todayLive = {
  id: 'od_today_live',
  teamId: 77,
  teamName: 'Today Live team',
  date: TODAY,
  startMin: 9 * 60,
  endMin: 17 * 60,
  status: 'Booked',
  modSnapshots: [{ orbitLoginId: 'Live-tw' }],
};

const todayDone = {
  id: 'od_today_done',
  teamId: 88,
  teamName: 'Today Done team',
  date: TODAY,
  startMin: 8 * 60,
  endMin: 12 * 60,
  status: 'Booked',
  modSnapshots: [{ orbitLoginId: 'Done-tw' }],
};

const skipOnly = {
  id: 'od_skip_only',
  teamId: 100210,
  teamName: 'Pradeepreddy × Manoj',
  date: '2026-09-18',
  startMin: 10 * 60,
  endMin: 16 * 60,
  status: 'Booked',
  modSnapshots: [{ orbitLoginId: 'Pradeepreddy-tw' }],
};

// Ended Sep 20 10:00 PM PT. At the frozen now (Sep 21 4:00 PM PT) that
// end is 18 hours ago — inside the Past rolling 24h window.
const recentPast = {
  id: 'od_recent_past',
  teamId: 100212,
  teamName: 'Recent Past team',
  date: '2026-09-20',
  startMin: 18 * 60,
  endMin: 22 * 60,
  status: 'Booked',
  modSnapshots: [{ orbitLoginId: 'Recent-tw' }],
};

const liveStatus = {
  'od_27c50635-pxm': { status: 'session_done', sessionCompletedAt: '2026-09-20T04:00:00Z' },
  'od_d9286d02-mxs': { status: 'session_done', sessionCompletedAt: '2026-09-20T05:00:00Z' },
  'od_today_live': { status: 'arrived' },
  'od_today_done': { status: 'session_done', sessionCompletedAt: '2026-09-21T19:00:00Z' },
};

const skippedIds = new Set(['od_27c50635-pxm', 'od_d9286d02-mxs', 'od_skip_only']);
const resolvedIds = new Set(['od_27c50635-pxm', 'od_d9286d02-mxs']);

const ctx = {
  console,
  Date,
  Intl,
  _derivedStatusCache: { sourceRef: null, byAsgnId: {} },
  adminState: {
    perfDateRange: 'today',
    perfStatusScope: 'all',
    perfView: 'teams',
    assignments: [pxm, mxs, todayLive, todayDone, skipOnly, recentPast],
    teams: [
      { id: 100210, name: 'Pradeepreddy × Manoj', primaryIds: ['Pradeepreddy-tw', 'Manoj-tw'] },
      { id: 100211, name: 'Muhammad × Sravya', primaryIds: ['Muhammad-tw', 'Sravya-tw'] },
      { id: 77, name: 'Today Live team', primaryIds: ['Live-tw'] },
      { id: 88, name: 'Today Done team', primaryIds: ['Done-tw'] },
      { id: 100212, name: 'Recent Past team', primaryIds: ['Recent-tw'] },
    ],
    moderators: [
      { firstName: 'Pradeepreddy', lastName: 'T', orbitLoginId: 'Pradeepreddy-tw' },
      { firstName: 'Live', lastName: 'Mod', orbitLoginId: 'Live-tw' },
    ],
    perfSessionStateRows: [
      { id: 468, orbitLoginId: 'Pradeepreddy-tw', assignmentId: pxm.id, sessionStatus: 'session_done', sessionDate: '2026-09-19', teamId: null, lastActive: '2026-09-20T04:10:00Z' },
      { id: 470, orbitLoginId: 'Manoj-tw', assignmentId: pxm.id, sessionStatus: 'session_done', sessionDate: '2026-09-19', teamId: null, lastActive: '2026-09-20T04:12:00Z' },
      { id: 454, orbitLoginId: 'Muhammad-tw', assignmentId: mxs.id, sessionStatus: 'session_done', sessionDate: '2026-09-19', teamId: null, lastActive: '2026-09-20T05:10:00Z' },
      { id: 455, orbitLoginId: 'Sravya-tw', assignmentId: mxs.id, sessionStatus: 'session_done', sessionDate: '2026-09-19', teamId: null, lastActive: '2026-09-20T05:12:00Z' },
    ],
  },
  getPSTDateString: () => TODAY,
  statusOrderIdx: s => ({
    office_checkin: 0, arrived: 1,
    station_1_done: 5, station_2_done: 6, station_3_done: 7, station_4_done: 8,
    session_done: 9, office_checkout: 10,
  }[s] ?? -1),
  isTerminalStatus: s => s === 'Cancelled' || s === 'Unassigned',
  getLatestStatusForAssignment: (id) => liveStatus[id] || null,
  isSessionWrapUpDone: (a) => {
    const st = liveStatus[a && a.id];
    return !!(st && (st.status === 'session_done' || st.status === 'office_checkout'));
  },
  perfAssignmentHasRecentGeoActivity: () => false,
  isPastModStrikeCheckpointHour: () => true,
  assignmentCoerceClockMin: (v, fb) => (v == null ? fb : v),
  assignmentModalNormalizeEndMin: (s, e) => (e < s ? e + 24 * 60 : e),
  parseYMD: (s) => {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  },
  ymd: (d) => {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  },
  startOfWeek: (d) => {
    const x = new Date(d.getTime());
    const day = x.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    x.setDate(x.getDate() + diff);
    x.setHours(0, 0, 0, 0);
    return x;
  },
  assignmentQueueEndCalendarYmd: (a) => String((a && a.date) || ''),
  applySameTeamSequentialBookingGate: (list) => list,
  bookingQueueGateBlocker: () => null,
  operatorProgressOnAssignment: () => false,
  isAssignmentCompleteForStrike: (a) => !!(liveStatus[a && a.id] && liveStatus[a.id].status === 'session_done'),
  modStrikeCheckpointIsSkipped: (day, teamId, asgnId) => {
    if (day !== SKIP_DAY && day !== TODAY) return false;
    return skippedIds.has(String(asgnId));
  },
  modStrikeCheckpointIsResolved: (day, teamId, asgnId) => {
    if (day !== SKIP_DAY && day !== TODAY) return false;
    return resolvedIds.has(String(asgnId));
  },
  perfModId: (m) => (m && (m.orbitLoginId || m.orbit_login_id)) || '',
};

vm.createContext(ctx);

vm.runInContext(sliceBetween('function addDaysToYmd', 'function teamBookingOnDateForStrike'), ctx);
vm.runInContext(sliceBetween('function pacificWallClockToMs', 'function modStrikeCheckpointSkippedTeamIds'), ctx);
vm.runInContext(sliceBetween('function perfBookingOverlapsPacificDay', 'function perfDateRangeOptions'), ctx);
vm.runInContext(sliceBetween('function assignmentSessionEndYmdPt', 'function perfFlaggedStatusPillForOrbit'), ctx);
vm.runInContext(sliceBetween('function assignmentPerfSessionStarted', 'function perfLiveStatusDisplay'), ctx);
vm.runInContext(sliceBetween('function assignmentQueueNormalizedEndMin', 'function operatorProgressOnAssignment'), ctx);
vm.runInContext(sliceBetween('function assignmentSessionStartedNotDone', 'function operatorInProgressAssignment'), ctx);
vm.runInContext(sliceBetween('function adminOpenBookingAssignment', 'function applyBookingQueueGate'), ctx);
vm.runInContext(sliceBetween('function bookingQueueGateBlocker', 'function operatorCarouselCandidateAssignments'), ctx);
vm.runInContext(sliceBetween('function perfTeamBookingCandidates', 'function perfBookingComparator'), ctx);
vm.runInContext(sliceBetween('function overviewAssignmentIsPerfLive', 'function computeOverviewMetrics'), ctx);

const realNow = Date.now;
Date.now = () => ctx.pacificWallClockToMs(TODAY, 16 * 60);

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

function idsOf(list) {
  return (list || []).map(a => String(a.id));
}

function setPerf(range, scope) {
  ctx.adminState.perfDateRange = range;
  ctx.adminState.perfStatusScope = scope;
}

function scopedTeamBookings(teamId) {
  const range = ctx.adminState.perfDateRange || 'today';
  const scope = ctx.adminState.perfStatusScope || 'all';
  return ctx.perfTeamBookings(teamId).filter(a =>
    ctx.perfDateInRange(a, range) &&
    (scope === 'all' || ctx.classifyBookingForPerf(a) === scope)
  );
}

function scopedModBookings(orbitId) {
  const range = ctx.adminState.perfDateRange || 'today';
  const scope = ctx.adminState.perfStatusScope || 'all';
  return ctx.perfModBookings(orbitId).filter(a =>
    ctx.perfDateInRange(a, range) &&
    (scope === 'all' || ctx.classifyBookingForPerf(a) === scope)
  );
}

console.log('Performance Past / history self-test (1.3.091821a)');

assert('APP_VERSION 1.3.091821+', /const APP_VERSION = '1\.3\.09182[1-9][a-z]'/.test(src));
assert('cache-bust matches version', /twilight\.js\?v=twilight-1\.3\.09182[1-9][a-z]/.test(
  fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')));

assert('PxM Rescheduled + session_done classifies Done (SS wins over Assignment/odStatus)',
  ctx.classifyBookingForPerf(pxm) === 'completed');
assert('MxS Booked/Scheduled + session_done classifies Done',
  ctx.classifyBookingForPerf(mxs) === 'completed');
assert('history source keeps Rescheduled (not Cancelled/Unassigned)',
  ctx.perfHistoryAssignments().some(a => a.id === pxm.id)
  && ctx.perfHistoryAssignments().some(a => a.id === mxs.id));

assert('healed session_done is wrap-up done',
  ctx.isSessionWrapUpDone(pxm) && ctx.isSessionWrapUpDone(mxs));

assert('live queue hides PxM after session_done + 9 AM',
  !ctx.perfAssignmentVisibleInAdminQueue(pxm));
assert('live queue hides MxS after session_done + 9 AM',
  !ctx.perfAssignmentVisibleInAdminQueue(mxs));
assert('live queue still shows today arrived',
  ctx.perfAssignmentVisibleInAdminQueue(todayLive));
assert('live queue hides today session_done wrap-up',
  !ctx.perfAssignmentVisibleInAdminQueue(todayDone));

assert('Overview Live does not surface healed PxM',
  !ctx.overviewAssignmentIsPerfLive(pxm));
assert('Overview Live still surfaces today arrived',
  ctx.overviewAssignmentIsPerfLive(todayLive));

setPerf('today', 'all');
assert('Today default uses live queue (not history)',
  ctx.perfUsesHistoryBookings() === false);
assert('Today All tiles omit PxM/MxS',
  !idsOf(scopedTeamBookings(100210)).includes(pxm.id)
  && !idsOf(scopedTeamBookings(100211)).includes(mxs.id));
assert('Today All tiles include live team',
  idsOf(scopedTeamBookings(77)).includes(todayLive.id));
assert('Today All tiles omit today completed wrap-up',
  !idsOf(scopedTeamBookings(88)).includes(todayDone.id));

setPerf('today', 'completed');
assert('Today + Done uses history source',
  ctx.perfUsesHistoryBookings() === true);
assert('Today + Done includes today session_done',
  idsOf(scopedTeamBookings(88)).includes(todayDone.id));
assert('Today + Done still omits Sep 19 completed (no Pacific overlap)',
  !idsOf(scopedTeamBookings(100210)).includes(pxm.id));

setPerf('past', 'all');
assert('Past uses history source',
  ctx.perfUsesHistoryBookings() === true);
assert('Past is the rolling last 24 hours on booked session end',
  ctx.perfDateInRange(recentPast, 'past'));
assert('Past drops Sep 19 PxM (ended more than 24h ago)',
  ctx.perfDateInRange(pxm, 'past') === false);
assert('Past drops Sep 19 MxS (ended more than 24h ago)',
  ctx.perfDateInRange(mxs, 'past') === false);
assert('Past date excludes today live (end still ahead)',
  !ctx.perfDateInRange(todayLive, 'past'));
assert('Past tiles include the session that ended within 24h',
  idsOf(scopedTeamBookings(100212)).includes(recentPast.id));
assert('Past tiles omit Sep 19 Skip’d completed PxM',
  !idsOf(scopedTeamBookings(100210)).includes(pxm.id));
assert('Past tiles omit Sep 19 Skip’d completed MxS',
  !idsOf(scopedTeamBookings(100211)).includes(mxs.id));
assert('Past tiles omit Skip-only booking older than 24h',
  !idsOf(scopedTeamBookings(100210)).includes(skipOnly.id));
assert('Past tiles exclude today live',
  !idsOf(scopedTeamBookings(77)).includes(todayLive.id));

setPerf('all', 'all');
assert('All time uses history and includes PxM + today live + today done',
  idsOf(scopedTeamBookings(100210)).includes(pxm.id)
  && idsOf(scopedTeamBookings(77)).includes(todayLive.id)
  && idsOf(scopedTeamBookings(88)).includes(todayDone.id));

setPerf('week', 'all');
{
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const wk = ctx.startOfWeek(now);
  const wkEnd = new Date(wk.getTime()); wkEnd.setDate(wkEnd.getDate() + 7);
  const inWeek = (ymd) => {
    const d = ctx.parseYMD(ymd); d.setHours(0, 0, 0, 0);
    return d.getTime() >= wk.getTime() && d.getTime() < wkEnd.getTime();
  };
  assert('This week is calendar Monday–Sunday (Sep 19 follows startOfWeek)',
    ctx.perfDateInRange(pxm, 'week') === inWeek(pxm.date));
  assert('This week date predicate matches todayLive.date',
    ctx.perfDateInRange(todayLive, 'week') === inWeek(todayLive.date));
}

setPerf('custom', 'all');
ctx.adminState.perfCustomStart = '2026-09-19';
ctx.adminState.perfCustomEnd = '2026-09-19';
assert('Custom Sep 19–19 includes PxM',
  ctx.perfDateInRange(pxm, 'custom') && idsOf(scopedTeamBookings(100210)).includes(pxm.id));
assert('Custom Sep 19–19 excludes today live',
  !ctx.perfDateInRange(todayLive, 'custom'));

assert('Skip+resolved completed is NOT flagged',
  ctx.isAssignmentFlaggedForPerf(pxm) === false
  && ctx.isAssignmentFlaggedForPerf(mxs) === false);
assert('Skip-only incomplete is NOT flagged (Skip preserved)',
  ctx.isAssignmentFlaggedForPerf(skipOnly) === false);
assert('Skip helper still true for healed assignment ids',
  ctx.isAssignmentSkipOrResolvedForFlagged(pxm) === true);

assert('Past pill is last 24 hours',
  /key: 'past'/.test(src) && /label: 'Past'/.test(src) && /last 24 hours/.test(src));

assert('mod history on All time includes PxM for Pradeepreddy', (() => {
  setPerf('all', 'all');
  return idsOf(scopedModBookings('Pradeepreddy-tw')).includes(pxm.id);
})());
assert('mod history on Past omits PxM (older than 24h)', (() => {
  setPerf('past', 'all');
  return !idsOf(scopedModBookings('Pradeepreddy-tw')).includes(pxm.id);
})());

Date.now = realNow;

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll passed');
