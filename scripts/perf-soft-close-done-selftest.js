#!/usr/bin/env node
'use strict';

/**
 * Overnight soft-close (List status Cancelled, comment od-sync-soft-close)
 * with a real team happypath shows under Admin Performance Done.
 * Soft-close without happypath stays out. Mod-cancel, Unassigned, and
 * other Cancelled stay hidden from Done / Live / Next. The booking
 * carousel still drops every Cancelled row. No List or SessionState writes.
 *
 * Fixtures follow the 2026-09-15 past-completed audit (class A misses).
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
  const asyncAt = start - 'async '.length;
  const from = (asyncAt >= 0 && src.slice(asyncAt, start) === 'async ') ? asyncAt : start;
  let i = from, depth = 0, begun = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') { depth++; begun = true; }
    else if (ch === '}') {
      depth--;
      if (begun && depth === 0) { i++; break; }
    }
  }
  return src.slice(from, i);
}

console.log('Performance soft-close Done carve-out (1.3.091825i)');

assert('APP_VERSION 1.3.091825i',
  /const APP_VERSION = '1\.3\.091825i'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091825i'));
assert('soft-close and mod-cancel plain-text the comment before the marker',
  /function assignmentCommentIsOdSoftClose/.test(src)
  && /od-sync-soft-close/.test(extractFn('assignmentCommentIsOdSoftClose'))
  && extractFn('assignmentCommentIsModCancel').indexOf('od-sync-soft-close') < 0
  && /stripHtmlTagsToPlainText/.test(extractFn('assignmentCommentPlainForMarker'))
  && extractFn('assignmentCommentIsOdSoftClose').indexOf('assignmentCommentPlainForMarker') >= 0
  && extractFn('assignmentCommentIsModCancel').indexOf('assignmentCommentPlainForMarker') >= 0);
assert('queue still treats every Cancelled row as a drop',
  /String\(a\.status \|\| ''\) === 'Cancelled'/.test(extractFn('assignmentIsModCancelForQueue')));
assert('history keeps soft-close Cancelled and drops other Cancelled',
  /assignmentIsOdSoftClose/.test(extractFn('perfHistoryAssignments')));

const SOFT = 'od-sync-soft-close';
// Live SharePoint Note fields wrap the marker. Raw indexOf === 0 misses this.
const SOFT_HTML = '<div class="ExternalClassAABC6FCFB38B4C1CBA91962FD918F19B">od-sync-soft-close</div>';
const MOD_CANCEL_HTML = '<div class="ExternalClassMODCANCEL99">mod-cancel-session:Narendra-tw:2026-09-24T22:00:00.000Z</div>';

function asgn(extra) {
  return Object.assign({
    date: '2026-09-18',
    startMin: 20 * 60,
    endMin: 3 * 60,
    status: 'Cancelled',
    comment: SOFT,
    teamId: 't-vj',
    modSnapshots: [{ orbitLoginId: 'Venkata-tw' }, { orbitLoginId: 'Jashit-tw' }],
  }, extra);
}

function ssRow(id, orbit, status, extra) {
  const body = Object.assign({
    sessionStatus: status,
    sessionDate: '2026-09-18',
  }, extra || {});
  return {
    assignmentId: id,
    orbitLoginId: orbit,
    sessionStatus: status,
    sessionCompletedAt: body.sessionCompletedAt || '',
    sessionDate: body.sessionDate,
    stateJson: JSON.stringify(body),
    lastActive: '2026-09-19T08:19:20.623Z',
  };
}

// Class A · soft-close + happypath (the eight Admin Done misses).
const rebecca = asgn({
  id: 'od_917b4f60-efc6-4b94-8058-9d9c71324827',
  date: '2026-09-18',
  participantData: { firstName: 'REBECCA', lastName: 'Young' },
});
const lisa = asgn({
  id: 'od_d9286d02-2c9f-404e-b897-34ee252afff6',
  date: '2026-09-19',
  teamId: 't-sm',
  participantData: { firstName: 'lisa', lastName: 'payne' },
  modSnapshots: [{ orbitLoginId: 'Muhammad-tw' }, { orbitLoginId: 'Sravya-tw' }],
});
const danica = asgn({
  id: 'od_d6b16c91-fe8a-4a5f-8ffe-cbaa153c8e27',
  date: '2026-09-20',
  teamId: 't-rv',
  participantData: { firstName: 'Danica', lastName: 'Kjorsvik' },
  modSnapshots: [{ orbitLoginId: 'Rohith-tw' }, { orbitLoginId: 'Venkata-tw' }],
});
const seth = asgn({
  id: 'od_2e9f20e3-f448-4375-b5ff-63f50de20c56',
  date: '2026-09-21',
  participantData: { firstName: 'Seth', lastName: 'Schnurman' },
});
const shelly = asgn({
  id: 'od_65bef3ad-b8f9-40d3-b321-e5b72e3781a7',
  date: '2026-09-21',
  teamId: 't-sm',
  participantData: { firstName: 'Shelly', lastName: 'Bowman' },
  modSnapshots: [{ orbitLoginId: 'Sravya-tw' }, { orbitLoginId: 'Muhammad-tw' }],
});
const zekelia = asgn({
  id: 'od_0706c044-b098-4f7b-8139-4863c560fe0f',
  date: '2026-09-22',
  teamId: 't-pm',
  participantData: { firstName: 'Zekelia', lastName: 'Sanders' },
  modSnapshots: [{ orbitLoginId: 'Pradeepreddy-tw' }, { orbitLoginId: 'Manoj-tw' }],
});
const wendy = asgn({
  id: 'od_0eb4f98f-223c-4d6f-935e-10266bd0f985',
  date: '2026-09-22',
  teamId: 't-ja',
  participantData: { firstName: 'Wendy', lastName: 'Clough' },
  modSnapshots: [{ orbitLoginId: 'Adidela-tw' }, { orbitLoginId: 'Jashit-tw' }],
});
const michael = asgn({
  id: 'od_bcc6893f-9fcc-42cc-84d3-c701f93635ed',
  date: '2026-09-23',
  teamId: 't-ap',
  participantData: { firstName: 'Michael', lastName: 'Luo' },
  modSnapshots: [{ orbitLoginId: 'Adidela-tw' }, { orbitLoginId: 'Pradeepreddy-tw' }],
});

const happypathRows = [rebecca, lisa, danica, seth, shelly, zekelia, wendy, michael];

// Class C · soft-close without happypath. Stay out of Done.
const patrick = asgn({
  id: 'od_patrick',
  date: '2026-09-17',
  participantData: { firstName: 'Patrick', lastName: 'Steffens' },
});

const modCancel = asgn({
  id: 'od_mod_cancel',
  date: '2026-09-24',
  status: 'Cancelled',
  comment: 'mod-cancel-session:Narendra-tw:2026-09-24T22:00:00.000Z',
  teamId: 't-narendra',
  modSnapshots: [{ orbitLoginId: 'Narendra-tw' }],
});
const adminCancel = asgn({
  id: 'od_admin_cancel',
  date: '2026-09-16',
  status: 'Cancelled',
  comment: 'admin removed',
  teamId: 't-narendra',
});
const unassigned = asgn({
  id: 'od_unassigned',
  status: 'Unassigned',
  comment: '',
  teamId: 't-vj',
});
const stillBooked = asgn({
  id: 'od_next',
  date: '2026-09-25',
  status: 'Booked',
  comment: '',
  teamId: 't-vj',
});

const doneStamp = '2026-09-19T08:19:20.623Z';
const ss = [
  ssRow(rebecca.id, 'Venkata-tw', 'session_done', { sessionCompletedAt: doneStamp, sessionDate: rebecca.date }),
  ssRow(rebecca.id, 'Jashit-tw', 'session_done', { sessionCompletedAt: doneStamp, sessionDate: rebecca.date }),
  ssRow(lisa.id, 'Sravya-tw', 'session_done', { sessionCompletedAt: doneStamp, sessionDate: lisa.date }),
  ssRow(lisa.id, 'Muhammad-tw', 'session_done', { sessionCompletedAt: doneStamp, sessionDate: lisa.date }),
  ssRow(danica.id, 'Rohith-tw', 'session_done', { sessionCompletedAt: doneStamp, sessionDate: danica.date }),
  ssRow(danica.id, 'Venkata-tw', 'session_done', { sessionCompletedAt: doneStamp, sessionDate: danica.date }),
  ssRow(seth.id, 'Venkata-tw', 'session_done', { sessionCompletedAt: doneStamp, sessionDate: seth.date }),
  ssRow(seth.id, 'Jashit-tw', 'session_done', { sessionCompletedAt: doneStamp, sessionDate: seth.date }),
  ssRow(shelly.id, 'Sravya-tw', 'session_done', { sessionCompletedAt: doneStamp, sessionDate: shelly.date }),
  ssRow(shelly.id, 'Muhammad-tw', 'station_4_done', { sessionDate: shelly.date, stationCompletedAt: { Station4: doneStamp } }),
  ssRow(zekelia.id, 'Pradeepreddy-tw', 'station_4_done', { sessionDate: zekelia.date, stationCompletedAt: { Station4: doneStamp } }),
  ssRow(zekelia.id, 'Manoj-tw', 'station_4_done', { sessionDate: zekelia.date, stationCompletedAt: { Station4: doneStamp } }),
  ssRow(wendy.id, 'Adidela-tw', 'station_4_done', { sessionDate: wendy.date, stationCompletedAt: { Station4: doneStamp } }),
  ssRow(michael.id, 'Adidela-tw', 'station_4_done', { sessionDate: michael.date, stationCompletedAt: { Station4: doneStamp } }),
  ssRow(patrick.id, 'Venkata-tw', 'arrived', { sessionDate: patrick.date }),
  ssRow(patrick.id, 'Jashit-tw', 'arrived', { sessionDate: patrick.date }),
  ssRow(modCancel.id, 'Narendra-tw', 'Cancelled', {
    sessionDate: modCancel.date,
    cancelComment: modCancel.comment,
    sessionCompletedAt: doneStamp,
  }),
];

const ctx = {
  console,
  Date,
  JSON,
  String,
  Number,
  Array,
  Object,
  Set,
  Math,
  STATIONS: ['station1', 'station2', 'station3', 'station4'].map(key => ({ key })),
  adminState: {
    perfDateRange: 'all',
    perfStatusScope: 'completed',
    assignments: happypathRows.concat([patrick, modCancel, adminCancel, unassigned, stillBooked]),
    teams: [
      { id: 't-vj', primaryIds: ['Venkata-tw', 'Jashit-tw'], backupIds: [] },
      { id: 't-sm', primaryIds: ['Muhammad-tw', 'Sravya-tw'], backupIds: [] },
      { id: 't-rv', primaryIds: ['Rohith-tw', 'Venkata-tw'], backupIds: [] },
      { id: 't-pm', primaryIds: ['Pradeepreddy-tw', 'Manoj-tw'], backupIds: [] },
      { id: 't-ja', primaryIds: ['Adidela-tw', 'Jashit-tw'], backupIds: [] },
      { id: 't-ap', primaryIds: ['Adidela-tw', 'Pradeepreddy-tw'], backupIds: [] },
      { id: 't-narendra', primaryIds: ['Narendra-tw'], backupIds: [] },
    ],
    perfSessionStateRows: ss,
  },
  isPastAssignmentSessionEnd: () => true,
  isAssignmentSkipOrResolvedForFlagged: () => false,
  modStrikeAutoStrikeClearsIncompleteAlert: () => false,
  modStrikeSessionStateReady: () => true,
  isGeoPresenceOrRemoteSessionStateRow: () => false,
  assignmentIdsMatch: (a, b) => String(a || '') === String(b || ''),
  sessionStateRowsForAssignment: (id, rows) => (rows || []).filter(r => r && String(r.assignmentId) === String(id)),
  parseSessionStateJson: (row) => {
    try { return JSON.parse((row && row.stateJson) || '{}'); } catch (_) { return {}; }
  },
  resolveAssignmentBookingYmd: (id) => {
    const hit = ctx.adminState.assignments.find(a => a && String(a.id) === String(id));
    return hit ? String(hit.date || '') : '';
  },
  scrubSessionStateProgressToBooking: (parsed) => parsed,
  sessionStateStampOnOrAfterBooking: () => true,
  sessionStateProgressForeignToBooking: () => false,
  statusOrderIdx: (s) => ({
    arrived: 1,
    station_4_done: 4,
    session_done: 5,
    office_checkout: 6,
  }[s] != null ? { arrived: 1, station_4_done: 4, session_done: 5, office_checkout: 6 }[s] : -1),
  getLatestStatusForAssignment: (id) => {
    const rows = ss.filter(r => String(r.assignmentId) === String(id));
    const rank = { session_done: 5, office_checkout: 6, station_4_done: 4, arrived: 1, cancelled: 0 };
    let best = null;
    let bestRank = -1;
    rows.forEach(r => {
      const st = String(r.sessionStatus || '').toLowerCase();
      const n = rank[st] != null ? rank[st] : -1;
      if (n > bestRank) {
        bestRank = n;
        best = { status: st, sessionCompletedAt: r.sessionCompletedAt || '' };
      }
    });
    return best;
  },
};
vm.createContext(ctx);
vm.runInContext([
  'stripHtmlTagsToPlainText',
  'assignmentCommentPlainForMarker',
  'assignmentCommentIsModCancel',
  'assignmentCommentIsOdSoftClose',
  'assignmentIsOdSoftClose',
  'assignmentIsModCancelForQueue',
  'sessionStateRowSaysCancelled',
  'assignmentSessionStateSaysCancelled',
  'perfAssignmentIsTeamCancelled',
  'sessionStateStatusHint',
  'sessionStateCompletionStamp',
  'sessionStateHasStation4Stamp',
  'sessionStateAllStationsHappypath',
  'sessionStateParsedIsHappypathComplete',
  'assignmentHappypathMemberOrbitIds',
  'sessionStateBestTeamStatus',
  'sessionStateStampsAllBeforeBooking',
  'sessionStateCountsAsTeamComplete',
  'assignmentSessionStateRowsForHappypath',
  'isAssignmentTeamHappypathComplete',
  'isAssignmentCompleteForFlagged',
  'isAssignmentFlaggedForPerf',
  'isAssignmentCompleteForStrike',
  'classifyBookingForPerf',
  'perfLiveStatusDisplay',
  'assignmentPerfSessionStarted',
  'modStrikeAssignmentEvidence',
  'teamBookingOnDateForStrike',
  'perfHistoryAssignments',
  'perfTeamHistoryBookings',
  'perfTeamAssignmentsForSource',
  'perfMergeTeamCancelledBookings',
].map(extractFn).join('\n'), ctx);

assert('soft-close helper matches the comment after HTML strip, only on Cancelled',
  ctx.assignmentCommentIsOdSoftClose(SOFT) === true
  && ctx.assignmentCommentIsOdSoftClose('od-sync-soft-close:2026-09-19T08:00:00Z') === true
  && ctx.assignmentCommentIsOdSoftClose('mod-cancel-session:x') === false
  && SOFT_HTML.trim().indexOf('od-sync-soft-close') !== 0
  && ctx.assignmentCommentIsOdSoftClose(SOFT_HTML) === true
  && ctx.assignmentIsOdSoftClose(rebecca) === true
  && ctx.assignmentIsOdSoftClose(stillBooked) === false
  && ctx.assignmentIsOdSoftClose({ status: 'Booked', comment: SOFT }) === false
  && ctx.assignmentIsOdSoftClose({ status: 'Booked', comment: SOFT_HTML }) === false);

const rebeccaHtml = Object.assign({}, rebecca, { comment: SOFT_HTML });
assert('ExternalClass soft-close happypath is Done',
  ctx.assignmentIsOdSoftClose(rebeccaHtml) === true
  && ctx.classifyBookingForPerf(rebeccaHtml) === 'completed',
  ctx.classifyBookingForPerf(rebeccaHtml));
assert('ExternalClass soft-close happypath pill says Completed',
  ctx.perfLiveStatusDisplay(rebeccaHtml).label === 'Completed');

const modCancelHtml = Object.assign({}, modCancel, {
  id: 'od_mod_cancel_html',
  comment: MOD_CANCEL_HTML,
});
assert('ExternalClass mod-cancel is detected and is not Done',
  MOD_CANCEL_HTML.trim().indexOf('mod-cancel-session') !== 0
  && ctx.assignmentCommentIsModCancel(MOD_CANCEL_HTML) === true
  && ctx.assignmentCommentIsOdSoftClose(MOD_CANCEL_HTML) === false
  && ctx.classifyBookingForPerf(modCancelHtml) == null
  && ctx.assignmentIsModCancelForQueue(modCancelHtml) === true
  && ctx.perfLiveStatusDisplay(modCancelHtml).label === 'Cancelled');

happypathRows.forEach(a => {
  const who = (a.participantData.firstName + ' ' + a.participantData.lastName).trim();
  assert(who + ' soft-close happypath is Done',
    ctx.classifyBookingForPerf(a) === 'completed',
    ctx.classifyBookingForPerf(a));
  assert(who + ' pill says Completed',
    ctx.perfLiveStatusDisplay(a).label === 'Completed');
  assert(who + ' is in history',
    ctx.perfHistoryAssignments().some(x => x.id === a.id));
  assert(who + ' is not Flagged',
    ctx.isAssignmentFlaggedForPerf(a) === false);
  assert(who + ' strike evidence is complete, not incomplete',
    ctx.modStrikeAssignmentEvidence(a) === 'complete',
    ctx.modStrikeAssignmentEvidence(a));
});

const shownVj = ctx.perfTeamAssignmentsForSource('t-vj', 'history').map(a => String(a.id));
assert('Done history lists Rebecca and Seth',
  shownVj.indexOf(rebecca.id) >= 0 && shownVj.indexOf(seth.id) >= 0,
  shownVj.join(','));
assert('soft-close without happypath stays out of the Performance list',
  shownVj.indexOf(patrick.id) < 0
  && ctx.classifyBookingForPerf(patrick) == null
  && ctx.isAssignmentTeamHappypathComplete(patrick) === false,
  shownVj.join(','));
assert('soft-close without happypath is not invented Completed',
  ctx.perfLiveStatusDisplay(patrick).label === 'Cancelled'
  && ctx.modStrikeAssignmentEvidence(patrick) === 'cancelled'
  && ctx.isAssignmentFlaggedForPerf(patrick) === false);

assert('mod-cancel is not Done, Live, or Next',
  ctx.classifyBookingForPerf(modCancel) == null
  && ctx.isAssignmentTeamHappypathComplete(modCancel) === false);
assert('mod-cancel pill stays Cancelled',
  ctx.perfLiveStatusDisplay(modCancel).label === 'Cancelled');
assert('mod-cancel still surfaces on the team list',
  ctx.perfTeamAssignmentsForSource('t-narendra', 'history').some(a => a.id === modCancel.id));
assert('mod-cancel is not a strike incomplete',
  ctx.modStrikeAssignmentEvidence(modCancel) === 'cancelled');

const historyIds = ctx.perfHistoryAssignments().map(a => String(a.id));
assert('admin cancel without soft-close stays out of history',
  historyIds.indexOf(adminCancel.id) < 0, historyIds.join(','));
assert('Unassigned stays out of history',
  historyIds.indexOf(unassigned.id) < 0);
assert('visible list does not count admin cancel as Done',
  ctx.perfTeamAssignmentsForSource('t-narendra', 'history').every(a => a.id !== adminCancel.id)
  && ctx.classifyBookingForPerf(adminCancel) == null);

assert('carousel helper still drops soft-close Cancelled',
  ctx.assignmentIsModCancelForQueue(rebecca) === true
  && ctx.assignmentIsModCancelForQueue(patrick) === true
  && ctx.assignmentIsModCancelForQueue({ status: 'Booked', comment: SOFT }) === false);

assert('strike subject picker still skips Cancelled soft-close',
  ctx.teamBookingOnDateForStrike('t-vj', '2026-09-18') == null
  && ctx.teamBookingOnDateForStrike('t-vj', '2026-09-17') == null);

// Booking carousel: Cancelled soft-close drops so the next Booked row binds.
const begin = src.indexOf('/* BOOKING_QUEUE_BEGIN */');
const end = src.indexOf('/* BOOKING_QUEUE_END */');
assert('BOOKING_QUEUE block present', begin >= 0 && end > begin);
const block = src.slice(begin, end);
{
  const night = {
    id: rebecca.id,
    date: '2026-09-18',
    startMin: 20 * 60,
    endMin: 3 * 60,
    status: 'Cancelled',
    comment: SOFT,
    odStatus: 'Scheduled',
  };
  const next = {
    id: 'od_next_booked',
    date: '2026-09-25',
    startMin: 19 * 60,
    endMin: 2 * 60,
    status: 'Booked',
    comment: '',
    odStatus: 'Scheduled',
  };
  const qctx = {
    state: {},
    console, Date, Number, String, Array,
    isTerminalStatus: (s) => s === 'Cancelled' || s === 'Unassigned',
    isSessionWrapUpDone: () => false,
    getMyLatestStatusForAssignment: () => null,
    getOperatorAssignments: () => [night, next],
    getPSTDateString: () => '2026-09-25',
    isPastModStrikeCheckpointHour: () => true,
    addDaysToYmd: (ymd, delta) => {
      const d = new Date(String(ymd).slice(0, 10) + 'T12:00:00');
      d.setDate(d.getDate() + delta);
      return d.toISOString().slice(0, 10);
    },
    assignmentCoerceClockMin: (v, fb) => (Number.isFinite(Number(v)) ? Number(v) : (fb || 0)),
    assignmentModalNormalizeEndMin: (s, e) => (e <= s ? e + 24 * 60 : e),
    statusOrderIdx: () => -1,
    getLatestStatusForAssignment: () => ({ status: 'session_done' }),
  };
  vm.createContext(qctx);
  vm.runInNewContext(block, qctx);
  const ids = qctx.operatorCarouselCandidateAssignments().map(a => String(a.id));
  assert('soft-close Cancelled drops off the carousel',
    ids.indexOf(night.id) < 0 && ids.indexOf(next.id) >= 0,
    ids.join(','));
  const pin = qctx.operatorInProgressAssignment(qctx.operatorCarouselCandidateAssignments());
  assert('next booking can bind after soft-close',
    !pin || String(pin.id) !== night.id,
    pin && pin.id);
}

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll passed');
