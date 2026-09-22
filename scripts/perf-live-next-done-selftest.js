#!/usr/bin/env node
'use strict';

/**
 * Admin Performance Live / Next / Done window (1.3.091821d).
 *
 * Policy:
 *   Live — checked in from the app AND still in the relevant live
 *          window (Pacific today, including open overnight).
 *   Next — upcoming / not yet checked in, including today not-started.
 *   Done — wrap-up / happypath, including past-day and overnight finished.
 *
 * Reproduces: leftover arrived on a session that is not today must not
 * land in Live. Overnight in-progress must not stay Live after booked end.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'twilight.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

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

const todayAm = {
  id: 'od_today_am',
  teamId: 11,
  date: TODAY,
  startMin: 9 * 60,
  endMin: 17 * 60,
  status: 'Booked',
};

const todayNight = {
  id: 'od_today_night',
  teamId: 12,
  date: TODAY,
  startMin: 20 * 60,
  endMin: 3 * 60,
  status: 'Booked',
};

const futureArrived = {
  id: 'od_future_stale',
  teamId: 13,
  date: '2026-09-24',
  startMin: 20 * 60,
  endMin: 3 * 60,
  status: 'Booked',
};

const lastWeekArrived = {
  id: 'od_lastweek_stale',
  teamId: 14,
  date: '2026-09-17',
  startMin: 14 * 60,
  endMin: 22 * 60,
  status: 'Booked',
};

const overnightOpen = {
  id: 'od_overnight_open',
  teamId: 15,
  date: '2026-09-20',
  startMin: 20 * 60,
  endMin: 3 * 60,
  status: 'Booked',
};

const overnightDone = {
  id: 'od_overnight_done',
  teamId: 16,
  date: '2026-09-20',
  startMin: 20 * 60,
  endMin: 3 * 60,
  status: 'Booked',
};

const overnightStuck = {
  id: 'od_overnight_stuck',
  teamId: 17,
  date: '2026-09-20',
  startMin: 20 * 60,
  endMin: 3 * 60,
  status: 'Booked',
};

const pastEveningDone = {
  id: 'od_past_evening_done',
  teamId: 18,
  date: '2026-09-19',
  startMin: 20 * 60,
  endMin: 3 * 60,
  status: 'Rescheduled',
};

const todayNotified = {
  id: 'od_today_notified',
  teamId: 19,
  date: TODAY,
  startMin: 9 * 60,
  endMin: 17 * 60,
  status: 'Notified',
};

const liveStatus = {
  'od_today_am': { status: 'arrived' },
  'od_today_night': { status: 'arrived' },
  'od_future_stale': { status: 'arrived' },
  'od_lastweek_stale': { status: 'arrived' },
  'od_overnight_open': { status: 'arrived' },
  'od_overnight_done': { status: 'session_done' },
  'od_overnight_stuck': { status: 'arrived' },
  'od_past_evening_done': { status: 'session_done' },
  'od_today_notified': null,
};

const ctx = {
  console,
  Date,
  Intl,
  adminState: {
    assignments: [
      todayAm, todayNight, futureArrived, lastWeekArrived,
      overnightOpen, overnightDone, overnightStuck, pastEveningDone, todayNotified,
    ],
    teams: [
      { id: 11, name: 'Today AM' },
      { id: 12, name: 'Today night' },
      { id: 13, name: 'Future' },
      { id: 14, name: 'Last week' },
      { id: 15, name: 'Overnight open' },
      { id: 16, name: 'Overnight done' },
      { id: 17, name: 'Overnight stuck' },
      { id: 18, name: 'Past evening' },
      { id: 19, name: 'Today notified' },
    ],
    perfSessionStateRows: [],
    perfDateRange: 'today',
    perfStatusScope: 'all',
    perfView: 'teams',
  },
  getPSTDateString: () => TODAY,
  statusOrderIdx: s => ({
    office_checkin: 0, arrived: 1,
    station_1_done: 5, station_2_done: 6, station_3_done: 7, station_4_done: 8,
    session_done: 9, office_checkout: 10,
  }[s] ?? -1),
  isTerminalStatus: s => s === 'Cancelled' || s === 'Unassigned',
  isSessionWrapUpDone: (a) => {
    const st = liveStatus[a && a.id];
    return !!(st && (st.status === 'session_done' || st.status === 'office_checkout'));
  },
  getLatestStatusForAssignment: (id) => liveStatus[id] || null,
  isAssignmentTeamHappypathComplete: (a) => {
    const st = liveStatus[a && a.id];
    return !!(st && (st.status === 'session_done' || st.status === 'office_checkout' || st.status === 'station_4_done'));
  },
  perfAssignmentHasRecentGeoActivity: () => false,
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
  parseAssignedDate: () => null,
  isPastModStrikeCheckpointHour: () => true,
};

vm.createContext(ctx);

vm.runInContext(sliceBetween('function addDaysToYmd', 'function teamBookingOnDateForStrike'), ctx);
vm.runInContext(sliceBetween('function pacificWallClockToMs', 'function modStrikeCheckpointSkippedTeamIds'), ctx);
vm.runInContext(sliceBetween('function perfBookingOverlapsPacificDay', 'function perfDateRangeOptions'), ctx);
vm.runInContext(sliceBetween('function assignmentPerfSessionStarted', 'function perfLiveStatusDisplay'), ctx);
vm.runInContext(sliceBetween('function assignmentQueueNormalizedEndMin', 'function operatorProgressOnAssignment'), ctx);
vm.runInContext(sliceBetween('function assignmentSessionStartedNotDone', 'function operatorInProgressAssignment'), ctx);
vm.runInContext(sliceBetween('function adminOpenBookingAssignment', 'function applyBookingQueueGate'), ctx);
vm.runInContext(sliceBetween('function bookingQueueGateBlocker', 'function operatorCarouselCandidateAssignments'), ctx);
vm.runInContext(sliceBetween('function perfTeamBookingCandidates', 'function perfModBookings'), ctx);
vm.runInContext(sliceBetween('function overviewAssignmentIsPerfLive', 'function computeOverviewMetrics'), ctx);

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

function cls(a) {
  return ctx.classifyBookingForPerf(a);
}

console.log('Performance Live / Next / Done window self-test (1.3.091821g)');

assert('APP_VERSION 1.3.091821g',
  /const APP_VERSION = '1\.3\.091821g'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091821g'));
assert('live-window helper present',
  /function assignmentInPerfLiveWindow/.test(src)
  && /LIVE \/ NEXT \/ DONE CONTRACT/.test(src));

const realNow = Date.now;

// --- Afternoon PT · typical Admin view ---
Date.now = () => ctx.pacificWallClockToMs(TODAY, 14 * 60);

assert('today AM checked-in in window is Live', cls(todayAm) === 'inprogress');
assert('today AM not-started is Next', cls({ ...todayAm, id: 'od_today_am_wait' }) === 'scheduled');
assert('today night checked in at 2 PM is still Next (session is tonight)',
  cls(todayNight) === 'scheduled');
assert('today night not checked in is Next',
  cls({ ...todayNight, id: 'od_today_night_wait' }) === 'scheduled');
assert('future-day leftover arrived is Next, not Live',
  cls(futureArrived) === 'scheduled');
assert('last-week leftover arrived is not Live',
  cls(lastWeekArrived) !== 'inprogress');
assert('Notified without app check-in is Next',
  cls(todayNotified) === 'scheduled');
assert('yesterday-evening completed is Done',
  cls(pastEveningDone) === 'completed');
assert('overnight already wrapped is Done (not Live)',
  cls(overnightDone) === 'completed');
assert('overnight still arrived after booked end is not Live',
  cls(overnightStuck) !== 'inprogress');

assert('Overview Live includes today AM checked-in',
  ctx.overviewAssignmentIsPerfLive(todayAm));
assert('Overview Live excludes future-day arrived',
  !ctx.overviewAssignmentIsPerfLive(futureArrived));
assert('Overview Live excludes last-week arrived',
  !ctx.overviewAssignmentIsPerfLive(lastWeekArrived));
assert('Overview Live excludes overnight after window',
  !ctx.overviewAssignmentIsPerfLive(overnightStuck));
assert('future-day arrived is outside the live window helper',
  ctx.assignmentInPerfLiveWindow(futureArrived) === false);
assert('overnight after end is outside the live window helper',
  ctx.assignmentInPerfLiveWindow(overnightStuck) === false);
assert('future-day arrived may stay queued as Next, never Live',
  cls(futureArrived) === 'scheduled'
  && !ctx.overviewAssignmentIsPerfLive(futureArrived));
assert('overnight after end may stay queued for wrap-up, never Live',
  cls(overnightStuck) !== 'inprogress'
  && !ctx.overviewAssignmentIsPerfLive(overnightStuck));

assert('Past filter still sees overnight completed',
  ctx.perfDateInRange(overnightDone, 'past') || ctx.perfDateInRange(overnightDone, 'today'));
assert('Past filter sees yesterday-evening completed',
  ctx.perfDateInRange(pastEveningDone, 'past'));
assert('Today filter excludes last-week stale',
  !ctx.perfDateInRange(lastWeekArrived, 'today'));
assert('Today filter excludes future-day stale',
  !ctx.perfDateInRange(futureArrived, 'today'));

// --- 6:30 PM PT · tonight's session is inside the 2h early-check-in grace ---
Date.now = () => ctx.pacificWallClockToMs(TODAY, 18 * 60 + 30);
assert('6:30 PM · tonight checked-in is Live (2h early-arrival grace)',
  cls(todayNight) === 'inprogress');
assert('6:30 PM · tonight not checked in is still Next',
  cls({ ...todayNight, id: 'od_today_night_wait2' }) === 'scheduled');

// --- 9 PM PT · tonight in booked clock window ---
Date.now = () => ctx.pacificWallClockToMs(TODAY, 21 * 60);
assert('9 PM · tonight checked-in is Live', cls(todayNight) === 'inprogress');

// --- 2 AM PT · overnight still in booked window ---
Date.now = () => ctx.pacificWallClockToMs(TODAY, 2 * 60);

assert('2 AM · last-night overnight arrived is Live',
  cls(overnightOpen) === 'inprogress');
assert('2 AM · last-night overnight session_done is Done',
  cls(overnightDone) === 'completed');
assert('2 AM · today AM (not started yet, no check-in) is Next',
  cls({ ...todayAm, id: 'od_today_am_early' }) === 'scheduled');
assert('2 AM · future-day arrived still not Live',
  cls(futureArrived) === 'scheduled');
assert('2 AM · Overview Live includes open overnight',
  ctx.overviewAssignmentIsPerfLive(overnightOpen));
assert('2 AM · queue keeps open overnight visible',
  ctx.perfAssignmentVisibleInAdminQueue(overnightOpen));

// --- After overnight end, before 9 AM ---
Date.now = () => ctx.pacificWallClockToMs(TODAY, 6 * 60);

assert('6 AM · overnight arrived after end is not Live',
  cls(overnightStuck) !== 'inprogress');
assert('6 AM · overnight session_done is Done',
  cls(overnightDone) === 'completed');
assert('6 AM · today AM not checked in is Next',
  cls({ ...todayAm, id: 'od_today_am_pre' }) === 'scheduled');

Date.now = realNow;

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll passed');
