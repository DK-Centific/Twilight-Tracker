#!/usr/bin/env node
'use strict';

/**
 * 9 AM auto-strike: booked crew, fresh read, window (Oct 11–17 false strikes).
 * One check per case from the Oct 19 fix:
 *  - team roster differs from the booking crew and the booking mod finished
 *  - Rescheduled booking (status or odStatus)
 *  - struck mod not on the OneData booking
 *  - assignment Cancelled after the session, or gone from the List
 *  - co-mod row od-sync created later: the crew is the current snapshots
 *  - SessionState read of exactly 256 rows refuses; paging returns 367
 *  - wrong sessionDate, stamps inside the window: complete
 *  - stamp after the window end does not count
 *  - real miss (Amy x Pradeepreddy, Oct 15, e2484183) still strikes once
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

function slice(startMarker, endMarker) {
  const s = src.indexOf(startMarker);
  const e = src.indexOf(endMarker, s);
  if (s < 0 || e <= s) throw new Error('slice not found: ' + startMarker);
  return src.slice(s, e);
}

console.log('9 AM strike: booked crew, fresh read, completion window');

assert('version 1.3.102026a',
  /const APP_VERSION = '1\.3\.102026a'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.102026a'));
assert('time zone and 9 AM gate helpers unchanged',
  /function pacificWallClockToMs\(ymd, minutesFromMidnight\)/.test(src)
  && /function assignmentAutoStrikeDeadlineMs\(a\)[\s\S]{0,600}pacificWallClockToMs\(morningAfter, 9 \* 60\)/.test(src));

const block = [
  slice('function assignmentSessionEndYmdPt(a)', 'function isAssignmentCompleteForFlagged(a)'),
  slice('function ymd(d)', 'function fmtTimeOfDay(min)'),
  slice('function pstYmdFromTimestamp(value)', 'function assignmentOrbitOnBooking(a, orbit)'),
  slice('function scrubSessionStateProgressToBooking(parsed, bookingYmd, opts)', 'function resolveOpenBookingYmdForScrub()'),
  slice('async function fetchSessionStateRowsAllPages()', 'function ingestGeoPingsFromSessionRows(rows)'),
].join('\n') + `
function classifyBookingForPerf(a) {
  if (!a) return null;
  if (a.status === 'Completed') return 'completed';
  if (a.status === 'Cancelled') return 'cancelled';
  return 'scheduled';
}
function assignmentCommentPlainForMarker(comment) {
  return String(comment == null ? '' : comment).replace(/<[^>]+>/g, ' ').trim();
}
function assignmentCommentIsModCancel(comment) {
  return assignmentCommentPlainForMarker(comment).indexOf('mod-cancel-session') >= 0;
}
function assignmentCommentIsOdSoftClose(comment) {
  return assignmentCommentPlainForMarker(comment).indexOf('od-sync-soft-close') >= 0;
}
function assignmentIsOdSoftClose(a) {
  return !!a && String(a.status || '') === 'Cancelled' && assignmentCommentIsOdSoftClose(a.comment);
}
function assignmentCoerceClockMin(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) ? n : (fb || 0);
}
function assignmentModalNormalizeEndMin(s, e) {
  e = assignmentCoerceClockMin(e, s);
  return e <= s ? e + 24 * 60 : e;
}
function parseSessionStateJson(r) {
  let p = {};
  try { p = typeof r.stateJson === 'string' ? JSON.parse(r.stateJson || '{}') : (r.stateJson || {}); } catch (_) { p = {}; }
  if (!p.sessionStatus && r.sessionStatus) p.sessionStatus = r.sessionStatus;
  if (!p.sessionDate && r.sessionDate) p.sessionDate = r.sessionDate;
  return p;
}
function sessionStateRowsForAssignment(id, rows) {
  const key = String(id || '').toLowerCase();
  return (rows || []).filter(r => r && String(r.assignmentId || '').toLowerCase() === key);
}
function resolveAssignmentBookingYmd(id) {
  const a = (adminState.assignments || []).find(x => x && String(x.id) === String(id));
  return a ? String(a.date) : '';
}
function escapeHTML(s) { return String(s); }
function getPSTDateString() { return '2026-10-16'; }
function toast() {}
function syncOverviewLiveStatusStrikeAttention() {}
function modStrikeRefreshUi() {}
`;

const ctx = {
  setTimeout(fn) { if (typeof fn === 'function') fn(); return 0; },
  clearTimeout() {},
  localStorage: {
    _m: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
    setItem(k, v) { this._m[k] = String(v); },
    removeItem(k) { delete this._m[k]; },
  },
  adminState: { teams: [], assignments: [], _perfSSOk: true, perfSessionStateRows: [] },
  state: { username: 'Admin-Twilight' },
  console: { log() {}, warn() {}, error: console.error },
  document: {
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
  },
};
vm.createContext(ctx);
vm.runInContext(block, ctx);

const TODAY = '2026-10-16';
const NIGHT = '2026-10-15';
const afterGate = ctx.pacificWallClockToMs(TODAY, 10 * 60);
const endMs = ctx.pacificWallClockToMs(TODAY, 2 * 60);          // 7 PM–2 AM booking
const iso = (ms) => new Date(ms).toISOString();
const STRIKE_ROW = { sessionStateId: 'ss_app_setting_moderator_strikes', assignmentId: 'app_setting_moderator_strikes', orbitLoginId: '_app_setting', stateJson: '{}' };
const OTHER_ROW = { sessionStateId: 'ss_other', assignmentId: 'other', orbitLoginId: 'someone', stateJson: '{}' };

function snaps(ids) { return ids.map(id => ({ orbitLoginId: id })); }
function booking(o) {
  return Object.assign({
    id: 'asgn_e2484183',
    teamId: 'team_ap',
    odScheduleId: 'od_e2484183',
    date: NIGHT,
    startMin: 19 * 60,
    endMin: 2 * 60,
    status: 'Booked',
    savedAt: '2026-10-14T18:00:00.000Z',
    modSnapshots: snaps(['Amy-tw', 'Pradeepreddy-tw']),
  }, o || {});
}
function ssRow(o) {
  return Object.assign({
    sessionStateId: 'ss_' + Math.random().toString(36).slice(2),
    assignmentId: 'asgn_e2484183',
    orbitLoginId: 'Amy-tw',
    sessionDate: NIGHT,
    stateJson: '{}',
  }, o || {});
}
function reset(assignments, rows, teams) {
  ctx.adminState.teams = teams || [];
  ctx.adminState.assignments = assignments;
  ctx.adminState._perfSSOk = true;
  ctx.adminState.perfSessionStateRows = (rows || []).concat([OTHER_ROW, STRIKE_ROW]);
  ctx.saveModStrikeStore({ mods: {}, checkpoints: {}, version: 1, lastWriter: 'test' });
}
function stars(id) { return ctx.getModStrikeStars(id); }
function runSync() {
  ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate });
  ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate + 60000 });
}

(async () => {
  // 1. Team roster differs from the booking crew; the booking mod finished.
  reset(
    [booking({ id: 'asgn_c4553535', odScheduleId: 'od_c4553535', teamId: 200073, modSnapshots: snaps(['Manoj-tw', 'Venkata-tw']) })],
    [ssRow({ assignmentId: 'asgn_c4553535', orbitLoginId: 'Manoj-tw', stateJson: JSON.stringify({
      sessionDate: NIGHT, sessionStatus: 'session_done', sessionCompletedAt: iso(endMs - 90 * 60000) }) })],
    [{ id: 200073, name: 'Pradeepreddy x Adidela', primaryIds: ['Pradeepreddy-tw', 'Adidela-tw'] }]
  );
  const b1 = ctx.adminState.assignments[0];
  assert('crew for completion is the booking snapshots, not the team roster',
    ctx.assignmentHappypathMemberOrbitIds(b1).has('manoj-tw')
    && !ctx.assignmentHappypathMemberOrbitIds(b1).has('pradeepreddy-tw'));
  assert('booking mod finish reads as team complete', ctx.isAssignmentTeamHappypathComplete(b1) === true);
  runSync();
  assert('roster differs, booking mod finished: no strike',
    [stars('Manoj-tw'), stars('Venkata-tw'), stars('Pradeepreddy-tw'), stars('Adidela-tw')].every(n => n === 4));

  // 2. Rescheduled, by status and by odStatus.
  reset([booking({ odStatus: 'Rescheduled' })], [ssRow({ sessionStatus: 'arrived' })]);
  assert('odStatus Rescheduled is excluded', ctx.modStrikeAssignmentEvidence(ctx.adminState.assignments[0]) === 'excluded');
  assert('Rescheduled booking is not on the checkpoint report',
    ctx.buildModStrikeCheckpointReport(afterGate).teams.length === 0);
  runSync();
  assert('Rescheduled (odStatus): no strike', stars('Amy-tw') === 4 && stars('Pradeepreddy-tw') === 4);
  reset([booking({ status: 'Rescheduled' })], [ssRow({ sessionStatus: 'arrived' })]);
  runSync();
  assert('Rescheduled (status): no strike',
    ctx.modStrikeAssignmentEvidence(ctx.adminState.assignments[0]) === 'excluded'
    && stars('Amy-tw') === 4 && stars('Pradeepreddy-tw') === 4);

  // 3. Struck mod not on the OneData booking (22086f11: booked Muhammad and Sravya).
  reset([
    booking({ id: 'asgn_22086f11', odScheduleId: 'od_22086f11', modSnapshots: snaps(['Amy-tw', 'Muhammad-tw']), savedAt: '2026-10-14T18:00:00.000Z' }),
    booking({ id: 'asgn_remote_22086f11', odScheduleId: 'od_22086f11', modSnapshots: snaps(['Muhammad-tw', 'Sravya-tw']), savedAt: '2026-10-15T09:11:00.000Z' }),
  ], [ssRow({ assignmentId: 'asgn_22086f11', orbitLoginId: 'Muhammad-tw', sessionStatus: 'arrived' })]);
  assert('OneData crew is the newest od-matched booking',
    ctx.modStrikeOdMatchedCrewIds(ctx.adminState.assignments[0]).join(',') === 'Muhammad-tw,Sravya-tw');
  runSync();
  assert('mod not on the OneData booking is not struck', stars('Amy-tw') === 4, 'Amy ' + stars('Amy-tw'));
  assert('booked mods on that unfinished session still lose one star each',
    stars('Muhammad-tw') === 3 && stars('Sravya-tw') === 3,
    'Muhammad ' + stars('Muhammad-tw') + ' Sravya ' + stars('Sravya-tw'));

  // 4. Cancelled after the session, or missing from the List.
  const cancelledLate = booking({ status: 'Cancelled', comment: 'od-sync', savedAt: '2026-10-16T09:11:00.000Z' });
  reset([cancelledLate], []);
  assert('Cancelled after the session is unknown', ctx.modStrikeAssignmentEvidence(cancelledLate) === 'unknown');
  runSync();
  assert('Cancelled after the session: no strike', stars('Amy-tw') === 4 && stars('Pradeepreddy-tw') === 4);
  reset([booking({ id: 'asgn_other', odScheduleId: 'od_other', modSnapshots: snaps(['Jashit-tw', 'Sravya-tw']) })], []);
  const missing = booking({ id: 'asgn_73fef94c', odScheduleId: 'od_73fef94c' });
  assert('assignment gone from the List is unknown', ctx.modStrikeAssignmentEvidence(missing) === 'unknown');
  assert('missing assignment cannot be struck',
    ctx.commitAutoModStrike('Amy-tw', missing, { kind: 'auto', at: iso(afterGate) }, afterGate) === false
    && stars('Amy-tw') === 4);

  // 7. Wrong sessionDate, stamps inside the window (Rohith 9c56ecdd).
  reset([booking()], [ssRow({ orbitLoginId: 'Amy-tw', sessionDate: '2026-10-19', stateJson: JSON.stringify({
    sessionDate: '2026-10-19', sessionStatus: 'session_done', sessionCompletedAt: iso(endMs - 3 * 3600000) }) })]);
  assert('wrong sessionDate with in-window stamps is complete',
    ctx.modStrikeAssignmentEvidence(ctx.adminState.assignments[0]) === 'complete');
  runSync();
  assert('wrong sessionDate, in-window finish: no strike', stars('Amy-tw') === 4 && stars('Pradeepreddy-tw') === 4);

  // 8. Stamp after the window end (booked end + 4 h), still before 9 AM.
  const b8 = booking();
  assert('completion window ends at booked end + 4 h',
    ctx.assignmentProgressDeadlineMs(b8) === endMs + 4 * 3600000);
  reset([b8], [ssRow({ orbitLoginId: 'Amy-tw', stateJson: JSON.stringify({
    sessionDate: TODAY, sessionStatus: 'session_done', sessionCompletedAt: iso(endMs + 5 * 3600000),
    stationCompletedAt: { Station4: iso(endMs + 5 * 3600000) } }) })]);
  assert('late stamp is not inside the window',
    ctx.sessionStateFinishInsideBookingWindow(ctx.parseSessionStateJson(ctx.adminState.perfSessionStateRows[0]), ctx.adminState.perfSessionStateRows[0], b8) === false);
  assert('stamp after the window end does not complete the team',
    ctx.isAssignmentTeamHappypathComplete(b8) === false
    && ctx.modStrikeAssignmentEvidence(b8) === 'incomplete');

  // 9. Real miss (e2484183, Amy x Pradeepreddy): booked, in window, no progress.
  reset([booking()], [ssRow({ orbitLoginId: 'Amy-tw', sessionStatus: 'arrived' })]);
  const correctedEntry = {
    at: '2026-10-14T16:00:00.000Z', kind: 'auto', assignmentId: 'asgn_22086f11', sessionDate: '2026-10-13',
    corrected: true, correctedAt: '2026-10-18T20:00:00.000Z', correctedReason: 'not on the OD booking',
  };
  const seeded = ctx.loadModStrikeStore();
  seeded.mods[ctx.modStrikeOrbitKey('Amy-tw')] = { stars: 4, starScale: 4, log: [correctedEntry], updatedAt: correctedEntry.correctedAt };
  ctx.saveModStrikeStore(seeded);
  runSync();
  assert('real miss strikes both booked mods once',
    stars('Amy-tw') === 3 && stars('Pradeepreddy-tw') === 3,
    'Amy ' + stars('Amy-tw') + ' Pradeepreddy ' + stars('Pradeepreddy-tw'));
  const amyLog = (ctx.loadModStrikeStore().mods[ctx.modStrikeOrbitKey('Amy-tw')] || {}).log || [];
  const kept = amyLog.find(e => e && e.corrected === true);
  assert('corrected, correctedAt and correctedReason stay on the log',
    !!kept && kept.correctedAt === correctedEntry.correctedAt && kept.correctedReason === correctedEntry.correctedReason);

  // Fresh read before write. The app has a SessionState reader; tests 1–9
  // above ran the decision on rows already in memory.
  const page = (rows, skip) => rows.slice(skip || 0, (skip || 0) + 256);
  const pad = (n) => Array.from({ length: n }, (_, i) => ({ sessionStateId: 'ss_pad_' + i, assignmentId: 'pad_' + i, orbitLoginId: 'pad', lastActive: '2026-10-01T00:00:' + String(i % 60).padStart(2, '0') + '.000Z', stateJson: '{}' }));

  // 6. Exactly 256 rows, flow ignores skip: refuse, no strike.
  const capped = pad(255).concat([STRIKE_ROW]);
  ctx.fetchSessionStateRowsNow = async () => capped.slice();
  reset([booking()], [ssRow({ orbitLoginId: 'Amy-tw', sessionStatus: 'arrived' })]);
  const rep6 = ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: afterGate });
  assert('with a reader, the in-memory pass reports but does not strike',
    rep6 && rep6.teams.length === 1 && stars('Amy-tw') === 4);
  const job6 = ctx.modStrikeScheduleFreshCheckpoint({ silent: true, nowMs: afterGate });
  const res6 = job6 ? await job6 : null;
  assert('a 256-row read that cannot page is refused', res6 && res6.refused === 'capped-256', JSON.stringify(res6));
  assert('refused read: no strike', stars('Amy-tw') === 4 && stars('Pradeepreddy-tw') === 4);

  // 6b. Paging returns all 367 rows; the real miss then strikes.
  const full = pad(365).concat([STRIKE_ROW, ssRow({ sessionStateId: 'ss_amy', orbitLoginId: 'Amy-tw', sessionStatus: 'arrived', lastActive: '2026-10-16T04:00:00.000Z' })]);
  ctx.fetchSessionStateRowsNow = async (o) => page(full, o && o.skip);
  const paged = await ctx.fetchSessionStateRowsAllPages();
  assert('paging returns all 367 rows', paged.ok && paged.rows.length === 367, JSON.stringify({ ok: paged.ok, n: paged.rows && paged.rows.length }));
  reset([booking()], []);
  ctx.adminState.perfSessionStateRows = [OTHER_ROW];
  await ctx.runModStrikeCheckpointOnFreshRead({ silent: true, nowMs: afterGate });
  assert('fresh paged read replaces the in-memory rows', ctx.adminState.perfSessionStateRows.length === 367);
  assert('fresh paged read: real miss strikes once',
    stars('Amy-tw') === 3 && stars('Pradeepreddy-tw') === 3);
  await ctx.runModStrikeCheckpointOnFreshRead({ silent: true, nowMs: afterGate + 60000 });
  assert('second fresh pass does not double-strike', stars('Amy-tw') === 3 && stars('Pradeepreddy-tw') === 3);

  // 6c. Fresh read sees the finish another device saved after this tab loaded.
  const finished = full.slice(0, 366).concat([ssRow({ sessionStateId: 'ss_amy', orbitLoginId: 'Amy-tw', lastActive: '2026-10-16T05:00:00.000Z',
    stateJson: JSON.stringify({ sessionDate: NIGHT, sessionStatus: 'session_done', sessionCompletedAt: iso(endMs - 30 * 60000) }) })]);
  ctx.fetchSessionStateRowsNow = async (o) => page(finished, o && o.skip);
  reset([booking()], [ssRow({ orbitLoginId: 'Amy-tw', sessionStatus: 'arrived' })]);
  await ctx.runModStrikeCheckpointOnFreshRead({ silent: true, nowMs: afterGate });
  assert('stale tab: fresh rows show the finish, no strike', stars('Amy-tw') === 4 && stars('Pradeepreddy-tw') === 4);

  // 5. Co-mod row od-sync created after the session: crew is the current snapshots.
  const stale = booking({ id: 'asgn_remote_fbc', odScheduleId: 'od_fbc', modSnapshots: snaps(['Amy-tw', 'Narendra-tw']), savedAt: '2026-10-15T01:00:00.000Z' });
  const repaired = booking({ id: 'asgn_remote_fbc', odScheduleId: 'od_fbc', modSnapshots: snaps(['Muhammad-tw', 'Sravya-tw']), savedAt: '2026-10-16T09:11:00.000Z' });
  const rows5 = pad(10).concat([STRIKE_ROW]);
  ctx.fetchSessionStateRowsNow = async () => rows5.slice();
  ctx.ASSIGNMENT_PA_READ_URL = 'https://example.invalid/assignment-read';
  ctx.fetchAssignmentsFromPA = async () => {
    ctx.adminState.assignments = [repaired];
    ctx.adminState._asgnFetchInfo = { error: null, rowCount: 12 };
  };
  reset([stale], []);
  await ctx.runModStrikeCheckpointOnFreshRead({ silent: true, nowMs: afterGate });
  assert('late co-mod row: the old crew is not struck', stars('Amy-tw') === 4 && stars('Narendra-tw') === 4);
  assert('late co-mod row: the current crew is the one checked',
    ctx.modStrikeOdMatchedCrewIds(repaired).join(',') === 'Muhammad-tw,Sravya-tw'
    && stars('Muhammad-tw') === 3 && stars('Sravya-tw') === 3);

  ctx.fetchAssignmentsFromPA = async () => { ctx.adminState._asgnFetchInfo = { error: 'HTTP 502', rowCount: 0 }; };
  reset([booking()], [ssRow({ orbitLoginId: 'Amy-tw', sessionStatus: 'arrived' })]);
  const res5 = await ctx.runModStrikeCheckpointOnFreshRead({ silent: true, nowMs: afterGate });
  assert('failed Assignment read refuses, no strike',
    res5 && res5.refused === 'assignment-read-failed' && stars('Amy-tw') === 4);

  console.log('\n' + passed + ' passed, ' + failed + ' failed');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
