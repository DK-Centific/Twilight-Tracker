#!/usr/bin/env node
'use strict';

/**
 * Admin progress mirror (1.3.091825n)
 * Home picker keeps tonight's Booked/Rescheduled teams and Live kits, and drops
 * Cancelled, soft-close, mod-cancel, demo, orphans, and admin-skip.
 * Latest checklist wins over a newer empty or geo-only row.
 * The write gate blocks SessionState sync while the mirror flag is set.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

function extractFn(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let i = start, depth = 0, begun = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') { depth++; begun = true; }
    else if (ch === '}') {
      depth--;
      if (begun && depth === 0) { i++; break; }
    }
  }
  return src.slice(start, i);
}

console.log('Admin progress mirror (1.3.091825n)');

assert('APP_VERSION 1.3.091825n',
  /const APP_VERSION = '1\.3\.091825n'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091825n'));

const mirrorStart = src.indexOf('Admin progress mirror (1.3.091825n)');
const mirrorEnd = src.indexOf('function renderPerfStationListHTML', mirrorStart);
const mirrorSrc = src.slice(mirrorStart, mirrorEnd);
assert('mirror reuses pick + checklist hydrate and does not switch apps',
  mirrorSrc.includes('pickLatestTeamProgress')
  && mirrorSrc.includes('mergeTeammateState')
  && mirrorSrc.includes('allowMirror: true')
  && mirrorSrc.includes('fetchAssignmentsFromPA')
  && mirrorSrc.includes('_adminProgressMirrorSnapshot')
  && mirrorSrc.includes('You are now seeing ')
  && mirrorSrc.includes('No progress yet')
  && !/switchMasterAdminApp/.test(mirrorSrc));
assert('home picker and live entry are wired',
  mirrorSrc.includes('railBrandAdmin')
  && mirrorSrc.includes('railBrandOp')
  && mirrorSrc.includes('opNavHome')
  && mirrorSrc.includes('getBoundingClientRect')
  && mirrorSrc.includes('fromLive')
  && src.includes('adminProgressMirrorLiveEntryHTML(bookings)')
  && src.includes("openAdminProgressMirror(btn.getAttribute('data-admin-progress-mirror'), { fromLive: true })"));
assert('checklist logo still sends a real moderator home',
  html.includes('id="railBrandOp"')
  && html.includes('id="opNavHome"')
  && /id="railBrandOp"[^>]*onclick="showWelcome\(\)"/.test(html)
  && /id="opNavHome"[^>]*onclick="showWelcome\(\)"/.test(html));
const triggerSrc = extractFn('triggerSessionStateSync');
const flushSrc = extractFn('flushSessionStateSync');
assert('sync is gated while the mirror flag is set',
  triggerSrc.includes('adminProgressMirrorBlocksWrites')
  && triggerSrc.indexOf('adminProgressMirrorBlocksWrites') < triggerSrc.indexOf('SESSIONSTATE_PA_WRITE_URL')
  && flushSrc.includes("reason: 'admin-progress-mirror'")
  && flushSrc.indexOf('admin-progress-mirror') < flushSrc.indexOf("reason: 'notconfigured'")
  && extractFn('mergeTeammateState').includes('adminProgressMirrorBlocksWrites')
  && extractFn('postSessionStatePayloadDirect').includes('admin-progress-mirror')
  && extractFn('writePanicLog').includes('admin-progress-mirror')
  && extractFn('maybeRunModStrikeNineAmCheckpoint').includes('admin-progress-mirror'));
const mergeSrc = extractFn('mergeTeammateState');
assert('checklist hydrate is local-only while the mirror flag blocks a real sync',
  mergeSrc.includes('allowMirror')
  && mergeSrc.includes('adminProgressMirrorBlocksWrites')
  && mergeSrc.indexOf('if (opts.allowMirror) return;') < mergeSrc.indexOf('flushSessionStateSync()')
  && extractFn('getActiveOperatorAssignment').includes('adminProgressMirrorBlocksWrites')
  && extractFn('saveState').includes('_adminProgressMirrorSnapshot'));

const TODAY = '2026-09-26';
const YDAY = '2026-09-25';
const NOW = Date.parse('2026-09-26T18:00:00.000Z');

const ctx = {
  console, Date, Intl, Number, String, Array, Math, Object, JSON, Set,
  state: { appView: 'admin', isAdmin: true, isMasterAdmin: false, isReviewer: false },
  adminState: { teams: [], assignments: [], moderators: [] },
  isReviewerSession() { return !!(ctx.state && (ctx.state.isReviewer || ctx.state.appView === 'reviewer')); },
  isAdminSession() {
    if (ctx.isReviewerSession()) return false;
    return !!(ctx.state && (ctx.state.isAdmin || ctx.state.appView === 'admin'));
  },
  assignmentIsDemoBooking(a) { return !!(a && a.isDemo); },
  assignmentIsOdSoftClose(a) {
    return !!(a && String(a.status) === 'Cancelled'
      && String(a.comment || '').indexOf('od-sync-soft-close') >= 0);
  },
  assignmentCommentIsOdSoftClose(c) { return String(c || '').indexOf('od-sync-soft-close') >= 0; },
  assignmentCommentIsModCancel(c) { return String(c || '').indexOf('mod-cancel-session') >= 0; },
  isGeoPresenceOrRemoteAssignmentId(id) {
    const s = String(id || '').toLowerCase();
    return s.indexOf('geo_presence_') === 0 || s.indexOf('asgn_remote_') === 0;
  },
  isGeoPresenceOrRemoteSessionStateRow(r) {
    if (!r) return false;
    const id = String(r.assignmentId || '').toLowerCase();
    const sid = String(r.sessionStateId || '').toLowerCase();
    return id.indexOf('geo_presence_') === 0 || id.indexOf('asgn_remote_') === 0
      || sid.indexOf('ss_geo_presence_') === 0 || sid.indexOf('ss_asgn_remote_') === 0;
  },
  perfBookingOverlapsPacificDay(a, day) {
    return !!(a && Array.isArray(a._days) && a._days.indexOf(day) >= 0);
  },
  assignmentBookingSessionEndMs(a) { return a && a._endMs; },
  modStrikeSessionAlreadyMuted(a) { return !!(a && a._skip); },
  addDaysToYmd(ymd, n) {
    const d = new Date(String(ymd) + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  },
  getPSTDateString() { return TODAY; },
  STATIONS: [{ key: 'station1' }, { key: 'station2' }],
  isScenarioDoneForStation(sc) {
    return !!(sc && (sc.status === 'Uploaded' || sc.status === 'Completed'));
  },
  isScenarioComplete(sc) { return ctx.isScenarioDoneForStation(sc); },
  sessionStateRowMatchesAssignment(r, id) {
    return !!(r && String(r.assignmentId || '') === String(id));
  },
  assignmentIdsMatch(a, b) { return String(a || '') === String(b || ''); },
  classifyBookingForPerf(a) { return (a && a._cls) || null; },
  overviewAssignmentIsPerfLive(a) { return !!(a && a._cls === 'inprogress'); },
  assignmentPerfSessionStarted(a) { return !!(a && a._arrived); },
  buildAssignmentTeamMap() { return {}; },
  sessionStateRowTeamId() { return ''; },
  parseLastActiveMs(v) {
    const t = Date.parse(v);
    return isNaN(t) ? 0 : t;
  },
  sessionStateRowFreshnessMs(row, parsed) {
    return ctx.parseLastActiveMs((parsed && parsed.progressAt) || (row && row.lastActive) || '');
  },
  parseSessionStateJson(r) {
    if (!r) return {};
    if (r.stateJson && typeof r.stateJson === 'object') return r.stateJson;
    try { return JSON.parse(r.stateJson || '{}'); } catch (_) { return {}; }
  },
};
vm.createContext(ctx);

for (const name of [
  'adminProgressMirrorBlocksWrites',
  'adminProgressMirrorDropPendingFlushes',
  'adminProgressMirrorRoleAllowed',
  'adminProgressMirrorTeamName',
  'adminProgressMirrorStatusIsBookedOrRescheduled',
  'adminProgressMirrorIsSkippedNight',
  'adminProgressMirrorIsClosedOut',
  'adminProgressMirrorIsLiveTonight',
  'adminProgressMirrorBookingEligible',
  'adminProgressMirrorOnSessionDay',
  'adminProgressMirrorTonightBookings',
  'sessionStateProgressScore',
  'pickLatestTeamProgress',
]) {
  vm.runInContext(extractFn(name), ctx);
}

assert('admin can open the mirror', ctx.adminProgressMirrorRoleAllowed() === true);
ctx.state = { appView: 'admin', isAdmin: true, isMasterAdmin: true };
assert('master admin in admin view is allowed', ctx.adminProgressMirrorRoleAllowed() === true);
ctx.state = { appView: 'moderator', isAdmin: true, isMasterAdmin: true };
assert('moderator view is denied, including master switch', ctx.adminProgressMirrorRoleAllowed() === false);
ctx.state = { appView: 'reviewer', isReviewer: true, isAdmin: false };
assert('reviewer is denied', ctx.adminProgressMirrorRoleAllowed() === false);
ctx.state = { appView: 'admin', isAdmin: true };

function booked(id, extra) {
  return Object.assign({
    id: id,
    teamId: 11,
    status: 'Booked',
    date: TODAY,
    startMin: 20 * 60,
    _days: [TODAY],
    _endMs: NOW + 6 * 60 * 60 * 1000,
  }, extra || {});
}

const tonight = ctx.adminProgressMirrorTonightBookings([
  booked('od_live'),
  booked('od_live'),
  booked('od_resched', { status: 'Rescheduled', teamId: 12 }),
  booked('od_same_team_b', { teamId: 11, startMin: 21 * 60 }),
  booked('od_cancel', { status: 'Cancelled' }),
  booked('od_soft', { status: 'Cancelled', comment: '<div>od-sync-soft-close</div>' }),
  booked('od_soft_comment', { status: 'Booked', comment: 'od-sync-soft-close leftover' }),
  booked('od_mod_cancel', { comment: 'mod-cancel-session by alex' }),
  booked('od_demo', { isDemo: true, teamId: 'demo-team-1' }),
  booked('od_orphan', { teamId: '' }),
  booked('asgn_remote_shell', { teamId: 14 }),
  booked('od_unassigned', { status: 'Unassigned' }),
  booked('od_notified', { status: 'Notified' }),
  booked('od_live_status', { status: 'In Progress', _cls: 'inprogress', teamId: 15 }),
  booked('od_arrived', { status: 'Arrived', _arrived: true, teamId: 16 }),
  booked('od_cancel_live', { status: 'Cancelled', _cls: 'inprogress', teamId: 17 }),
  booked('od_skip', { _skip: true }),
  booked('od_old', { date: '2026-09-20', _days: ['2026-09-20'], teamId: 30 }),
], { today: TODAY, gateOpen: true, nowMs: NOW });

const ids = tonight.map(a => a.id);
assert('tonight keeps booked, rescheduled, and live kits, one row per assignment',
  ids.indexOf('od_live') >= 0 && ids.indexOf('od_resched') >= 0
  && ids.indexOf('od_live_status') >= 0
  && ids.indexOf('od_arrived') >= 0
  && ids.filter(id => id === 'od_live').length === 1
  && ids.indexOf('od_same_team_b') >= 0);
assert('picker drops cancelled, soft-close, mod-cancel, demo, orphan, remote, skip',
  ids.indexOf('od_cancel') < 0
  && ids.indexOf('od_soft') < 0
  && ids.indexOf('od_soft_comment') < 0
  && ids.indexOf('od_mod_cancel') < 0
  && ids.indexOf('od_demo') < 0
  && ids.indexOf('od_orphan') < 0
  && ids.indexOf('asgn_remote_shell') < 0
  && ids.indexOf('od_unassigned') < 0
  && ids.indexOf('od_cancel_live') < 0
  && ids.indexOf('od_notified') < 0
  && ids.indexOf('od_skip') < 0
  && ids.indexOf('od_old') < 0);

const beforeGate = ctx.adminProgressMirrorTonightBookings([
  booked('yday_done', { date: YDAY, _days: [YDAY, TODAY], _endMs: NOW - 1000, teamId: 40 }),
  booked('yday_open', { date: YDAY, _days: [YDAY, TODAY], _endMs: NOW + 3600000, teamId: 41 }),
  booked('tonight_booked', { teamId: 42 }),
  booked('skip_night', { _skip: true, teamId: 43 }),
], { today: TODAY, yesterday: YDAY, gateOpen: false, nowMs: NOW });
const beforeIds = beforeGate.map(a => a.id);
assert('before 9 AM keeps the open overnight and tonight, not a finished or skipped night',
  beforeIds.indexOf('yday_open') >= 0
  && beforeIds.indexOf('tonight_booked') >= 0
  && beforeIds.indexOf('yday_done') < 0
  && beforeIds.indexOf('skip_night') < 0);

const afterGate = ctx.adminProgressMirrorTonightBookings([
  booked('yday_open'),
  booked('prior', { date: YDAY, _days: [YDAY, TODAY], _endMs: NOW + 3600000, teamId: 41 }),
], { today: TODAY, gateOpen: true, nowMs: NOW });
assert('after 9 AM the prior-day row stays out of tonight',
  afterGate.some(a => a.id === 'yday_open')
  && !afterGate.some(a => a.id === 'prior'));

const ASGN = 'od_team_night';
const richOld = {
  sessionStateId: 'ss_' + ASGN + '_moda',
  assignmentId: ASGN,
  orbitLoginId: 'mod-a',
  lastActive: '2026-09-26T02:00:00.000Z',
  stateJson: JSON.stringify({
    progressScore: 40,
    progressAt: '2026-09-26T02:00:00.000Z',
    arrivedAt: '2026-09-26T01:00:00.000Z',
    stations: { station1: { scenarios: { '01': { status: 'Uploaded' } } } },
  }),
};
const emptyNew = {
  sessionStateId: 'ss_' + ASGN + '_modb',
  assignmentId: ASGN,
  orbitLoginId: 'mod-b',
  lastActive: '2026-09-26T08:00:00.000Z',
  stateJson: JSON.stringify({
    progressScore: 0,
    progressAt: '2026-09-26T08:00:00.000Z',
    stations: {},
  }),
};
const geoNew = {
  sessionStateId: 'ss_geo_presence_modb_2026-09-26',
  assignmentId: 'geo_presence_modb_2026-09-26',
  orbitLoginId: 'mod-b',
  lastActive: '2026-09-26T09:00:00.000Z',
  stateJson: JSON.stringify({
    progressScore: 999999,
    progressAt: '2026-09-26T09:00:00.000Z',
    sessionStatus: 'session_done',
  }),
};
const picked = ctx.pickLatestTeamProgress([geoNew, emptyNew, richOld], { assignmentId: ASGN });
assert('richer checklist beats a newer empty heartbeat and a newer geo shell',
  picked && picked.row && picked.row.sessionStateId === richOld.sessionStateId,
  picked && picked.row && picked.row.sessionStateId);

ctx.state._adminProgressMirror = { open: true, assignmentId: ASGN };
assert('write gate blocks while the mirror flag is set',
  ctx.adminProgressMirrorBlocksWrites() === true);
ctx.adminProgressMirrorDropPendingFlushes();
ctx.state._adminProgressMirror = null;
assert('write gate is closed after the flag is cleared',
  ctx.adminProgressMirrorBlocksWrites() === false);

if (failed) {
  console.error('\n' + failed + ' admin progress mirror checks failed');
  process.exit(1);
}
console.log('\nAll admin progress mirror checks passed');
