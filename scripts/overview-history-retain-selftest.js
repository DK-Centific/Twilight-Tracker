#!/usr/bin/env node
'use strict';

/**
 * Overview / Performance history after List hygiene (1.3.091830a).
 *
 * List may drop older rows (reschedule hard-delete of leftover
 * non-Cancelled, or a short read). The donut and Performance history
 * still count Completed and Cancelled from the local ledger and from
 * SessionState. Open Booked leftovers stay dropped. Past is still the
 * last 24 hours.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function sliceBetween(startMarker, endMarker) {
  const begin = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, begin + 1);
  if (begin < 0 || end <= begin) {
    console.error('Could not slice', startMarker);
    process.exit(1);
  }
  return src.slice(begin, end);
}

const mem = {};
const localStorage = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
  setItem: (k, v) => { mem[k] = String(v); },
};

function classifyBookingForPerf(a) {
  if (!a || a.status === 'Unassigned') return null;
  const c = String(a.comment || '');
  if (c.indexOf('mod-cancel-session') >= 0) return null;
  const soft = a.status === 'Cancelled' && c.indexOf('od-sync-soft-close') >= 0;
  if (!soft && a.status === 'Cancelled') return null;
  if (a.status === 'Completed') return 'completed';
  if (soft) {
    const rows = (ctx.adminState && ctx.adminState.perfSessionStateRows) || [];
    const happy = rows.some(r => String(r.assignmentId || '') === String(a.id)
      && r.stateJson
      && (r.stateJson.sessionStatus === 'session_done' || r.stateJson.sessionCompletedAt));
    return happy ? 'completed' : null;
  }
  if (a.status === 'Booked') return 'scheduled';
  return null;
}

const ctx = {
  console,
  localStorage,
  adminState: {
    overview: { timeScope: 'all', teamId: 'all', moderatorId: 'all' },
    assignments: [],
    teams: [],
    perfSessionStateRows: [],
  },
  assignmentIsDemoBooking: (a) => !!(a && (a.isDemo || String(a.teamId || '').indexOf('demo-team-') === 0)),
  assignmentCommentIsModCancel: (c) => String(c || '').indexOf('mod-cancel-session') >= 0,
  assignmentIsOdSoftClose: (a) => !!(a && a.status === 'Cancelled' && String(a.comment || '').indexOf('od-sync-soft-close') >= 0),
  classifyBookingForPerf,
  isTerminalStatus: (s) => s === 'Cancelled' || s === 'Unassigned',
  parseSessionStateJson: (r) => (r && r.stateJson && typeof r.stateJson === 'object') ? r.stateJson : {},
  sessionStateRowSaysCancelled: (r) => {
    const st = String((r && (r.sessionStatus || (r.stateJson && r.stateJson.sessionStatus))) || '').toLowerCase();
    return st === 'cancelled';
  },
  sessionStateParsedIsHappypathComplete: (parsed) => {
    if (!parsed) return false;
    const st = String(parsed.sessionStatus || '').toLowerCase();
    if (st === 'cancelled') return false;
    return st === 'session_done' || !!parsed.sessionCompletedAt;
  },
  sessionStateRowResolvedAssignmentId: (r) => String((r && r.assignmentId) || '').trim(),
  isGeoPresenceOrRemoteSessionStateRow: (r) => !!(r && r._geo),
  isGeoPresenceOrRemoteAssignmentId: (id) => {
    const s = String(id || '').toLowerCase();
    return s.indexOf('geo_presence_') === 0 || s.indexOf('asgn_remote_') === 0;
  },
  pstYmdFromTimestamp: (v) => String(v || '').slice(0, 10),
  perfAssignmentIsTeamCancelled: (a) => String((a && a.comment) || '').indexOf('mod-cancel-session') >= 0,
  assignmentBookingSessionEndMs: (a) => (a && Number.isFinite(a._end) ? a._end : NaN),
  PERF_PAST_WINDOW_MS: 24 * 60 * 60 * 1000,
};
vm.createContext(ctx);
vm.runInContext(sliceBetween('const ASGN_HISTORY_LEDGER_KEY', '// Pure function: filters + raw state'), ctx);
vm.runInContext(sliceBetween('function overviewAssignmentIsCancelledForDonut', 'function overviewAssignmentIsPerfLive'), ctx);
vm.runInContext(sliceBetween('function perfHistoryAssignments', 'function perfTeamHistoryBookings'), ctx);
vm.runInContext(sliceBetween('function perfMergeTeamCancelledBookings', 'function perfTeamBookings'), ctx);
vm.runInContext(sliceBetween('function perfDateInRange', 'function perfDateRangeOptions'), ctx);

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

console.log('Overview history retain self-test (1.3.091830a)');

assert('APP_VERSION 1.3.091830a',
  src.includes("const APP_VERSION = '1.3.091830a'")
  && html.includes('twilight.js?v=twilight-1.3.091830a'));

const rememberAt = src.indexOf('rememberAssignmentHistory([].concat(local.assignments');
const dropAt = src.indexOf('Dropped ${droppedStale} stale local assignment');
assert('ledger is written before List stale-drop', rememberAt > 0 && dropAt > rememberAt);

const queueFn = sliceBetween('function perfTeamBookingCandidates', 'function perfAssignmentVisibleInAdminQueue');
assert('live Performance queue does not read retained history',
  queueFn.indexOf('assignmentsWithRetainedHistory') < 0);

const tonight = [1, 2, 3, 4].map(n => ({
  id: 'tonight-' + n,
  teamId: '9',
  date: '2026-09-28',
  status: 'Completed',
  startMin: 19 * 60,
  endMin: 23 * 60,
}));
const pastDone = {
  id: 'past-done', teamId: '1', date: '2026-09-10', status: 'Completed', comment: '',
};
const pastCancel = {
  id: 'past-cancel', teamId: '2', date: '2026-09-12', status: 'Cancelled',
  comment: 'mod-cancel-session:amy:2026-09-12T16:00:00Z',
};
const pastSoftOpen = {
  id: 'past-soft-open', teamId: '3', date: '2026-09-14', status: 'Cancelled',
  comment: 'od-sync-soft-close',
};
const pastSoftHappy = {
  id: 'past-soft-happy', teamId: '4', date: '2026-09-15', status: 'Cancelled',
  comment: 'od-sync-soft-close',
};
const bookedLeftover = {
  id: 'leftover-booked', teamId: '5', date: '2026-09-01', status: 'Booked',
};
const demoDone = {
  id: 'demo-done', teamId: 'demo-team-01', date: '2026-09-02', status: 'Completed', isDemo: true,
};

ctx.rememberAssignmentHistory([].concat(tonight, [
  pastDone, pastCancel, pastSoftOpen, pastSoftHappy, bookedLeftover, demoDone,
]));
const ledgerIds = ctx.loadAssignmentHistoryLedger().map(a => a.id);
assert('ledger keeps completed, mod-cancel, and soft-close',
  ledgerIds.indexOf('past-done') >= 0
  && ledgerIds.indexOf('past-cancel') >= 0
  && ledgerIds.indexOf('past-soft-open') >= 0
  && ledgerIds.indexOf('past-soft-happy') >= 0);
assert('ledger does not keep a Booked leftover or a demo',
  ledgerIds.indexOf('leftover-booked') < 0 && ledgerIds.indexOf('demo-done') < 0);

ctx.adminState.assignments = tonight.slice();
ctx.adminState.perfSessionStateRows = [{
  assignmentId: 'past-soft-happy',
  stateJson: { sessionStatus: 'session_done', sessionCompletedAt: '2026-09-16T05:00:00Z', sessionDate: '2026-09-15' },
}];
const combined = ctx.assignmentsWithRetainedHistory(ctx.adminState.assignments);
const combinedAgain = ctx.assignmentsWithRetainedHistory(ctx.adminState.assignments);
assert('retained history is reused until List or SessionState changes', combinedAgain === combined);
const ids = combined.map(a => a.id);
assert('live list alone is tonight, combined puts past facts back',
  ids.filter(id => String(id).indexOf('tonight-') === 0).length === 4
  && ids.indexOf('past-done') >= 0
  && ids.indexOf('past-cancel') >= 0
  && ids.indexOf('leftover-booked') < 0);
assert('same id is not counted twice',
  combined.filter(a => a.id === 'tonight-1').length === 1);

const counts = ctx.computeOverviewDonutCounts(combined);
assert('donut completed includes tonight plus past done plus finished soft-close',
  counts.completedCount === 6, 'completed=' + counts.completedCount);
assert('donut cancelled is mod-cancel plus unfinished soft-close',
  counts.cancelledCount === 2, 'cancelled=' + counts.cancelledCount);
assert('open bookings were not invented from dropped leftovers',
  counts.openCount === 0);
assert('slices sum to total booked',
  counts.completedCount + counts.cancelledCount + counts.openCount === counts.progressTotal);

const hist = ctx.perfHistoryAssignments();
const histIds = hist.map(a => a.id);
assert('Performance history keeps completed and soft-close',
  histIds.indexOf('past-done') >= 0
  && histIds.indexOf('past-soft-open') >= 0
  && histIds.indexOf('past-soft-happy') >= 0);
assert('Performance history list still drops mod-cancel until the merge',
  histIds.indexOf('past-cancel') < 0);
const merged = ctx.perfMergeTeamCancelledBookings(hist, () => true);
assert('mod-cancel is merged back onto Performance history',
  merged.some(a => a.id === 'past-cancel'));

const now = Date.now();
const recent = { id: 'recent', date: '2026-09-27', status: 'Completed', _end: now - (2 * 60 * 60 * 1000) };
const older = { id: 'older', date: '2026-09-10', status: 'Completed', _end: now - (3 * 24 * 60 * 60 * 1000) };
assert('Past filter is still the last 24 hours',
  ctx.perfDateInRange(recent, 'past') === true
  && ctx.perfDateInRange(older, 'past') === false);
assert('All time still includes the older completed session',
  ctx.perfDateInRange(older, 'all') === true);

// Fresh browser: List no longer has the past rows and the ledger is empty.
// SessionState still has the outcome.
Object.keys(mem).forEach(k => delete mem[k]);
ctx.adminState.assignments = tonight.slice();
ctx.adminState.perfSessionStateRows = [
  {
    assignmentId: 'ss-done',
    teamId: '20',
    orbitLoginId: 'amy',
    sessionStateId: 'ss_ss-done_amy',
    stateJson: { sessionStatus: 'session_done', sessionDate: '2026-09-18', sessionCompletedAt: '2026-09-19T06:00:00Z' },
  },
  {
    assignmentId: 'ss-cancel',
    teamId: '21',
    orbitLoginId: 'jo',
    sessionStatus: 'cancelled',
    stateJson: { sessionStatus: 'cancelled', sessionDate: '2026-09-17' },
  },
  {
    assignmentId: 'ss-open',
    teamId: '22',
    stateJson: { sessionStatus: 'arrived', sessionDate: '2026-09-16' },
  },
  {
    assignmentId: 'app_setting_deactivated_users',
    sessionStateId: 'ss_app_setting_deactivated_users',
    stateJson: { type: 'appSetting', sessionStatus: 'session_done', sessionDate: '2026-09-01' },
  },
  {
    assignmentId: 'tonight-1',
    teamId: '9',
    stateJson: { sessionStatus: 'session_done', sessionDate: '2026-09-28' },
  },
  {
    assignmentId: 'ss-same-night',
    teamId: '9',
    stateJson: { sessionStatus: 'session_done', sessionDate: '2026-09-28' },
  },
];
const fromSs = ctx.assignmentsWithRetainedHistory(ctx.adminState.assignments);
assert('clearing the ledger rebuilds history from SessionState', fromSs !== combined);
const ssIds = fromSs.map(a => a.id);
assert('SessionState restores a finished session the List no longer has',
  ssIds.indexOf('ss-done') >= 0 && fromSs.find(a => a.id === 'ss-done').status === 'Completed');
assert('SessionState cancel stays Cancelled',
  ssIds.indexOf('ss-cancel') >= 0 && fromSs.find(a => a.id === 'ss-cancel').status === 'Cancelled');
assert('an arrived-only SessionState row is not a booked history row',
  ssIds.indexOf('ss-open') < 0);
assert('app settings are not bookings',
  ssIds.indexOf('app_setting_deactivated_users') < 0);
assert('SessionState does not double-count a List row or the same team-night',
  fromSs.filter(a => a.id === 'tonight-1').length === 1
  && ssIds.indexOf('ss-same-night') < 0);

const ssCounts = ctx.computeOverviewDonutCounts(fromSs);
assert('donut after a wiped List is tonight plus SessionState history',
  ssCounts.completedCount === 5 && ssCounts.cancelledCount === 1 && ssCounts.openCount === 0,
  JSON.stringify(ssCounts));

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll passed');
