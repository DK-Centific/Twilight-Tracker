#!/usr/bin/env node
'use strict';

/**
 * Moderator Cancel session.
 * After cancel, the overnight pin drops and the next Booked row can bind.
 * Cancel is not Done, not Flagged, and not od-sync-soft-close.
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

console.log('Moderator cancel-session self-test (1.3.091825a)');

assert('APP_VERSION 1.3.091825a',
  /const APP_VERSION = '1\.3\.091825a'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091825a'));

assert('hold is 2 seconds',
  /const MOD_CANCEL_HOLD_MS = 2000/.test(src)
  && html.includes('transition: width 2s linear'));
assert('dialog title',
  src.includes('Are you sure you want to cancel the current session?'));
assert('dialog asks them to reach the Twilight team',
  /reach out to the Twilight team/i.test(src));
assert('dialog says the team session is cancelled',
  /cancels the team session/i.test(src));
assert('buttons are Cancel and Confirm',
  /confirmLabel:\s*'Confirm'/.test(src) && /cancelLabel:\s*'Cancel'/.test(src));
assert('pre-check-in still says Confirm Arrival',
  src.includes('Confirm Arrival'));

const persist = extractFn('persistModeratorCancelSession');
const patch = extractFn('patchStateJsonModCancel');
const commentFn = extractFn('modCancelSessionComment');
assert('list comment is mod-cancel-session',
  /mod-cancel-session:/.test(commentFn) && persist.indexOf('modCancelSessionComment') >= 0);
assert('cancel writer does not use od-sync-soft-close',
  persist.indexOf('od-sync-soft-close') < 0 && patch.indexOf('od-sync-soft-close') < 0);
assert('cancel writer does not complete or wipe progress',
  persist.indexOf('completeAssignment') < 0
  && persist.indexOf('clearOperatorProgressForNewBooking') < 0
  && !/sessionCompletedAt\s*=\s*null/.test(patch)
  && src.indexOf('mod_cancel_session') < 0);
assert('cancel writer sets sessionStatus Cancelled',
  /sessionStatus = 'Cancelled'/.test(patch));
assert('cancel uses terminal lock like admin cancel',
  /_terminalLockUntil:\s*terminalLockUntil\(\)/.test(extractFn('writeModCancelAssignmentListRow')));
assert('cancel writer does not touch Skip or strikes',
  persist.indexOf('skippedTeams') < 0
  && persist.indexOf('resolvedTeams') < 0
  && persist.indexOf('modStrike') < 0);
assert('cancel writer uses Assignment list write, not a new stack',
  persist.indexOf('writeModCancelAssignmentListRow') >= 0
  && src.includes('ASSIGNMENT_PA_WRITE_URL')
  && extractFn('writeModCancelAssignmentListRow').indexOf('buildAssignmentExcelRow') >= 0);
assert('happypath treats Cancelled as not Done',
  /a\.status === 'Cancelled'/.test(extractFn('isAssignmentTeamHappypathComplete')));
assert('Flagged excludes mod cancel',
  /assignmentIsModCancelForQueue/.test(extractFn('isAssignmentFlaggedForPerf')));
assert('strike evidence has a cancelled result',
  /return 'cancelled'/.test(extractFn('modStrikeAssignmentEvidence')));

const begin = src.indexOf('/* BOOKING_QUEUE_BEGIN */');
const end = src.indexOf('/* BOOKING_QUEUE_END */');
assert('BOOKING_QUEUE block present', begin >= 0 && end > begin);
const block = src.slice(begin, end);

function runQueue(opts) {
  const gateOpen = opts.gateOpen !== false;
  const ctx = {
    state: opts.state || {},
    console, Date, Number, String, Array,
    isTerminalStatus: (s) => s === 'Cancelled' || s === 'Unassigned',
    isSessionWrapUpDone: opts.isSessionWrapUpDone || (() => false),
    getMyLatestStatusForAssignment: opts.getMyLatestStatusForAssignment || (() => null),
    getOperatorAssignments: () => opts.assignments || [],
    getPSTDateString: () => opts.today || '2026-09-24',
    isPastModStrikeCheckpointHour: () => gateOpen,
    addDaysToYmd: (ymd, delta) => {
      const d = new Date(String(ymd).slice(0, 10) + 'T12:00:00');
      d.setDate(d.getDate() + delta);
      return d.toISOString().slice(0, 10);
    },
    assignmentCoerceClockMin: (v, fb) => (Number.isFinite(Number(v)) ? Number(v) : (fb || 0)),
    assignmentModalNormalizeEndMin: (s, e) => (e <= s ? e + 24 * 60 : e),
    statusOrderIdx: (status) => {
      const order = ['arrived', 'station_1_done', 'session_done'];
      return order.indexOf(status);
    },
    getLatestStatusForAssignment: opts.getLatestStatusForAssignment || (() => null),
  };
  vm.createContext(ctx);
  vm.runInNewContext(block, ctx);
  const carousel = ctx.operatorCarouselCandidateAssignments();
  return {
    ids: carousel.map(a => String(a.id)),
    pin: ctx.operatorInProgressAssignment(carousel),
    rawPin: ctx.operatorInProgressAssignment(opts.assignments || []),
    ctx: ctx,
  };
}

const PM7 = 19 * 60;
const AM2 = 2 * 60;

function row(date, extra) {
  return Object.assign({
    date: date,
    startMin: PM7,
    endMin: AM2,
    status: 'Booked',
    odStatus: 'Scheduled',
  }, extra);
}

// Satya cancel on Sep 24 after 9 AM. Amy (Sep 25) can bind. Isaiah stays dropped.
{
  const isaiah = row('2026-09-22', {
    id: '116', status: 'Booked', teamName: 'Narendra x Isaiah', endMin: 3 * 60, startMin: 20 * 60,
  });
  const satya = row('2026-09-23', {
    id: '115', status: 'Cancelled', odStatus: 'Scheduled',
    comment: 'mod-cancel-session:Narendra-tw:2026-09-24T22:00:00.000Z',
    teamName: 'Narendra x Satya',
  });
  const amy = row('2026-09-25', {
    id: '218', status: 'Booked', teamName: 'Narendra x Amy',
  });
  const q = runQueue({
    today: '2026-09-24',
    gateOpen: true,
    assignments: [isaiah, satya, amy],
    state: { sessionDate: '2026-09-23', arrivedAt: '2026-09-24T02:00:00.000Z' },
    getLatestStatusForAssignment: (id) => (String(id) === '115' ? { status: 'arrived' } : null),
  });
  assert('cancelled Satya is not the overnight pin',
    !q.pin || String(q.pin.id) !== '115',
    q.pin && q.pin.id);
  assert('raw pin is not cancelled Satya',
    !q.rawPin || String(q.rawPin.id) !== '115',
    q.rawPin && q.rawPin.id);
  assert('Amy can bind after Satya cancel',
    q.ids.indexOf('218') >= 0 && q.ids.indexOf('115') < 0,
    q.ids.join(','));
  assert('Isaiah leftover still does not bind',
    q.ids.indexOf('116') < 0, q.ids.join(','));
  const snap = q.ctx.reconcileOperatorCarouselIdx([satya, amy], 0);
  assert('sticky index on cancelled Satya moves to Amy',
    String([satya, amy][snap].id) === '218', String(snap));
}

// Incomplete last night still pins when it is not cancelled.
{
  const satya = row('2026-09-23', { id: '115', status: 'Rescheduled', teamName: 'Narendra x Satya' });
  const amy = row('2026-09-25', { id: '218', status: 'Booked', teamName: 'Narendra x Amy' });
  const q = runQueue({
    today: '2026-09-24',
    gateOpen: true,
    assignments: [satya, amy],
    getLatestStatusForAssignment: () => ({ status: 'arrived' }),
  });
  assert('incomplete overnight still pins',
    q.pin && String(q.pin.id) === '115' && q.ids.indexOf('218') < 0,
    q.ids.join(',') + ' pin=' + (q.pin && q.pin.id));
}

// Comment prefix drops the pin even if a sync bounce put status back to Booked.
{
  const satya = row('2026-09-23', {
    id: '115', status: 'Booked', odStatus: 'Scheduled',
    comment: 'mod-cancel-session:Narendra-tw:2026-09-24T22:00:00.000Z',
  });
  const amy = row('2026-09-25', { id: '218', status: 'Booked' });
  const q = runQueue({
    today: '2026-09-24',
    gateOpen: true,
    assignments: [satya, amy],
  });
  assert('mod-cancel comment drops the pin while status is Booked',
    q.ids.indexOf('115') < 0 && q.ids.indexOf('218') >= 0,
    q.ids.join(','));
}

// Soft-close comment is not a mod cancel.
{
  const night = row('2026-09-23', {
    id: 'soft', status: 'Booked', comment: 'od-sync-soft-close',
  });
  const q = runQueue({
    today: '2026-09-24',
    gateOpen: true,
    assignments: [night],
    getLatestStatusForAssignment: () => ({ status: 'arrived' }),
  });
  assert('od-sync-soft-close does not drop an incomplete night',
    q.ids.indexOf('soft') >= 0 && q.pin && String(q.pin.id) === 'soft',
    q.ids.join(','));
}

// SessionState cancel marker drops the pin without List status Cancelled.
{
  const satya = row('2026-09-23', { id: '115', status: 'Booked', comment: '' });
  const amy = row('2026-09-25', { id: '218', status: 'Booked' });
  const q = runQueue({
    today: '2026-09-24',
    gateOpen: true,
    assignments: [satya, amy],
    getLatestStatusForAssignment: (id) => (String(id) === '115' ? { status: 'Cancelled' } : null),
  });
  assert('SessionState Cancelled drops the pin',
    q.ids.indexOf('115') < 0 && q.ids.indexOf('218') >= 0,
    q.ids.join(','));
}

const pure = vm.createContext({ console, String, JSON });
vm.runInContext(commentFn + '\n' + patch, pure);
const comment = pure.modCancelSessionComment('Narendra-tw', '2026-09-24T22:00:00.000Z');
assert('comment shape',
  comment === 'mod-cancel-session:Narendra-tw:2026-09-24T22:00:00.000Z', comment);
const patched = JSON.parse(pure.patchStateJsonModCancel(JSON.stringify({
  sessionStatus: 'station_4_done',
  sessionCompletedAt: '2026-09-24T04:00:00.000Z',
  stations: { station4: { scenarios: { '01': { status: 'Uploaded' } } } },
}), '2026-09-24T22:00:00.000Z', 'Narendra-tw', comment));
assert('SS marker keeps audit progress',
  patched.sessionStatus === 'Cancelled'
  && patched.sessionCompletedAt === '2026-09-24T04:00:00.000Z'
  && patched.stations && patched.stations.station4,
  JSON.stringify(patched));

function showCtx() {
  const ctx = {
    state: {},
    statusOrderIdx: (s) => ['arrived', 'station_1_done', 'session_done'].indexOf(s),
    isSessionWrapUpDone: () => false,
    sessionStateStampBelongsToAssignment: () => true,
  };
  vm.createContext(ctx);
  vm.runInContext(
    extractFn('operatorArrivedForCancelSession') + '\n' + extractFn('assignmentShowsCancelSession'),
    ctx
  );
  return ctx;
}

{
  const ui = showCtx();
  const booked = { status: 'Booked', date: '2026-09-23' };
  assert('Cancel stays hidden before arrival',
    ui.assignmentShowsCancelSession(booked, null, null) === false);
  ui.state.arrivedAt = '2026-09-24T02:00:00.000Z';
  assert('Cancel shows from state.arrivedAt',
    ui.assignmentShowsCancelSession(booked, null, null) === true);
  assert('Cancel shows from worklog arrived',
    ui.assignmentShowsCancelSession(booked, 'arrived', null) === true);
  assert('Cancel hides when already Cancelled',
    ui.assignmentShowsCancelSession({ status: 'Cancelled' }, 'arrived', null) === false);
  assert('Cancel hides when Completed',
    ui.assignmentShowsCancelSession({ status: 'Completed' }, 'arrived', null) === false);
  assert('Cancel hides on session_done',
    ui.assignmentShowsCancelSession(booked, 'session_done', null) === false);
  ui.state.sessionStatus = 'session_done';
  assert('Cancel hides when local wrap-up is session_done',
    ui.assignmentShowsCancelSession(booked, 'arrived', null) === false);
}

async function runAhP() {
  const posts = [];
  const reasons = [];
  const side = { flagged: 0, strike: 0, skipStamp: 0 };
  const skipStore = {
    '2026-09-24': { skippedTeams: { asgnSkip: true }, resolvedTeams: { asgnSkip: true } },
  };
  const audit = {
    sessionStatus: 'station_2_done',
    sessionCompletedAt: '2026-09-24T04:00:00.000Z',
    stations: { station2: { ok: true } },
    arrivedAt: '2026-09-24T02:00:00.000Z',
  };
  const ssRow = {
    sessionStateId: 'ss_115_Narendra-tw',
    assignmentId: '115',
    orbitLoginId: 'Narendra-tw',
    teamId: 't-narendra',
    stateJson: JSON.stringify(audit),
    sessionStatus: 'station_2_done',
  };
  const satya = row('2026-09-23', {
    id: '115', odScheduleId: 'OD-SATYA', teamId: 't-narendra',
    status: 'Booked', odStatus: 'Scheduled', teamName: 'Narendra x Satya', comment: '',
  });
  const jodie = row('2026-09-23', {
    id: '115b', odScheduleId: 'OD-SATYA', teamId: 't-narendra',
    status: 'Booked', odStatus: 'Scheduled', teamName: 'Narendra x Satya', comment: '',
  });
  const amy = row('2026-09-25', {
    id: '218', odScheduleId: 'OD-AMY', teamId: 't-narendra',
    status: 'Booked', odStatus: 'Scheduled', teamName: 'Narendra x Amy',
  });
  const other = row('2026-09-26', {
    id: '999', odScheduleId: 'OD-OTHER', teamId: 't-narendra',
    status: 'Booked', odStatus: 'Scheduled',
  });
  const todayBooked = row('2026-09-24', {
    id: '300', odScheduleId: 'OD-TODAY', teamId: 't-other',
    status: 'Booked', odStatus: 'Scheduled', startMin: 10 * 60, endMin: 12 * 60,
  });
  const ctx = {
    console, Date, JSON, String, Number, Array, Object, Promise,
    fetch: async (url, opts) => {
      posts.push({ url: String(url), body: JSON.parse(opts.body) });
      return { ok: true, status: 202 };
    },
    state: {
      username: 'Narendra-tw',
      modProfile: { orbitLoginId: 'Narendra-tw' },
      arrivedAt: audit.arrivedAt,
      sessionDate: '2026-09-23',
      sessionStatus: 'station_2_done',
      sessionCompletedAt: audit.sessionCompletedAt,
      stations: { station2: { ok: true } },
    },
    adminState: {
      assignments: [satya, jodie, amy, other, todayBooked],
      perfSessionStateRows: [ssRow],
      modStrikeStore: JSON.parse(JSON.stringify(skipStore)),
      teams: [
        { id: 't-narendra', name: 'Narendra x Satya', primaryIds: ['Narendra-tw', 'Jodie-tw'] },
        { id: 't-other', name: 'Other team', primaryIds: ['A-tw', 'B-tw'] },
      ],
    },
    ASSIGNMENT_PA_WRITE_URL: 'https://assignment.test/write',
    SESSIONSTATE_PA_WRITE_URL: 'https://ss.test/write',
    _sessionStateSyncState: { timer: null },
    _modCancelPersistBusy: false,
    window: {},
    currentStationKey: null,
    saveAssignmentData() {},
    saveState() {},
    renderMySessionSection() {},
    renderWelcome() {},
    renderApp() {},
    toast() {},
    waitForSessionStateSyncIdle: async () => {},
    terminalLockUntil: () => '2099-01-01T00:00:30.000Z',
    buildAssignmentExcelRow(a) {
      return [{
        id: a.id,
        status: a.status,
        comment: a.comment,
        odStatus: a.odStatus,
        cancelledAt: a.cancelledAt,
        updatedAt: a.updatedAt,
        savedAt: a.savedAt,
      }];
    },
    buildSessionStateCloudPayload(asgn, reason) {
      reasons.push(reason);
      return {
        sessionStateId: 'ss_' + asgn.id + '_Narendra-tw',
        assignmentId: String(asgn.id),
        teamId: String(asgn.teamId || ''),
        orbitLoginId: 'Narendra-tw',
        stateJson: JSON.stringify(audit),
      };
    },
    sessionStateRowsForAssignment(id, rows) {
      return (rows || []).filter(r => r && String(r.assignmentId) === String(id));
    },
    sessionStateStableId(asgn, orbit) { return 'ss_' + asgn.id + '_' + orbit; },
    isAssignmentFlaggedForPerf() { side.flagged++; return false; },
    commitAutoModStrike() { side.strike++; return false; },
    stampModStrikeCheckpointOccurrence() { side.skipStamp++; },
  };
  vm.createContext(ctx);
  vm.runInContext([
    'modCancelSessionComment',
    'modCancelActorOrbit',
    'assignmentsSharingModCancel',
    'patchStateJsonModCancel',
    'postSessionStatePayloadDirect',
    'writeModCancelSessionState',
    'writeModCancelAssignmentListRow',
    'persistModeratorCancelSession',
    'assignmentCommentIsModCancel',
  ].map(extractFn).join('\n'), ctx);

  const skipBefore = JSON.stringify(ctx.adminState.modStrikeStore);
  const result = await ctx.persistModeratorCancelSession(satya);
  const listPosts = posts.filter(p => p.url.indexOf('assignment.test') >= 0);
  const ssPosts = posts.filter(p => p.url.indexOf('ss.test') >= 0);
  const byId = (id) => ctx.adminState.assignments.find(a => String(a.id) === id);

  assert('1 cancel writes Cancelled plus terminal lock',
    result && result.ok === true
    && byId('115').status === 'Cancelled'
    && byId('115b').status === 'Cancelled'
    && byId('115')._terminalLockUntil === '2099-01-01T00:00:30.000Z'
    && byId('115b')._terminalLockUntil === '2099-01-01T00:00:30.000Z'
    && String(byId('115').comment).indexOf('mod-cancel-session:Narendra-tw:') === 0
    && byId('115').odStatus === 'Scheduled'
    && byId('115b').odStatus === 'Scheduled'
    && byId('115').cancelledAt && byId('115').updatedAt && byId('115').savedAt,
    JSON.stringify({ ok: result && result.ok, wrote: result && result.wrote, st: byId('115') && byId('115').status }));
  assert('1 co-mod schedule is cancelled and other bookings stay Booked',
    byId('218').status === 'Booked' && byId('999').status === 'Booked'
    && listPosts.length === 2
    && listPosts.every(p => p.body.status === 'Cancelled' && p.body.odStatus === 'Scheduled'));
  assert('1 open session becomes the next Booked row',
    (() => {
      const q = runQueue({
        today: '2026-09-24',
        gateOpen: true,
        assignments: ctx.adminState.assignments.filter(a => String(a.teamId) === 't-narendra' && String(a.id) !== '300'),
        state: { sessionDate: '2026-09-23', arrivedAt: audit.arrivedAt },
        getLatestStatusForAssignment: () => ({ status: 'arrived' }),
      });
      return q.ids.indexOf('218') >= 0 && q.ids.indexOf('115') < 0 && q.ids.indexOf('115b') < 0;
    })());
  assert('1 SessionState progress stays for audit',
    ctx.state.sessionCompletedAt === audit.sessionCompletedAt
    && ctx.state.stations && ctx.state.stations.station2 && ctx.state.stations.station2.ok
    && reasons[0] === 'mod-cancel-session'
    && ssPosts.some(p => {
      const parsed = JSON.parse(p.body.stateJson);
      return parsed.sessionStatus === 'Cancelled'
        && parsed.sessionCompletedAt === audit.sessionCompletedAt
        && parsed.stations && parsed.stations.station2;
    }));

  const night = byId('115');
  ctx.adminState.assignments.push(row('2026-09-23', {
    id: 'open', teamId: 't-other', status: 'Booked', odStatus: 'Scheduled',
  }));
  const todayQ = runQueue({
    today: '2026-09-24',
    gateOpen: true,
    assignments: [night, todayBooked, amy],
  });
  assert('2 cancelled overnight after 9 AM binds today, not the cancelled night',
    todayQ.ids.indexOf('300') >= 0 && todayQ.ids.indexOf('115') < 0,
    todayQ.ids.join(','));

  const perf = {
    console, String, Number, Date, JSON, Array, Object,
    adminState: ctx.adminState,
    getLatestStatusForAssignment: () => ({ status: 'arrived', sessionCompletedAt: audit.sessionCompletedAt }),
    isPastAssignmentSessionEnd: () => true,
    assignmentInPerfLiveWindow: () => true,
    assignmentPerfSessionStarted: () => true,
    isAssignmentTeamHappypathComplete: () => false,
    isAssignmentCompleteForFlagged: () => false,
    isAssignmentSkipOrResolvedForFlagged: () => false,
    isAssignmentCompleteForStrike: () => false,
    modStrikeSessionStateReady: () => true,
    getPSTDateString: () => '2026-09-24',
    addDaysToYmd: (ymd, delta) => {
      const d = new Date(String(ymd).slice(0, 10) + 'T12:00:00');
      d.setDate(d.getDate() + delta);
      return d.toISOString().slice(0, 10);
    },
    isPastModStrikeCheckpointHour: () => true,
    assignmentAutoStrikeDeadlineMs: () => 1,
    modStrikeCheckpointDaysForBooking: () => ['2026-09-24'],
    modStrikeCheckpointIsSkipped: (day, teamId, asgnId) => String(asgnId) === 'asgnSkip',
    modStrikeCheckpointIsResolved: () => false,
  };
  vm.createContext(perf);
  vm.runInContext([
    'assignmentCommentIsModCancel',
    'assignmentIsModCancelForQueue',
    'classifyBookingForPerf',
    'isAssignmentFlaggedForPerf',
    'modStrikeAssignmentEvidence',
    'teamBookingOnDateForStrike',
    'buildModStrikeCheckpointReport',
  ].map(extractFn).join('\n'), perf);
  const bucket = perf.classifyBookingForPerf(night);
  const flagged = perf.isAssignmentFlaggedForPerf(night);
  const evidence = perf.modStrikeAssignmentEvidence(night);
  const report = perf.buildModStrikeCheckpointReport(Date.parse('2026-09-24T18:00:00.000Z'));
  const narendraRow = (report.teams || []).find(t => String(t.teamId) === 't-narendra');
  const otherRow = (report.teams || []).find(t => String(t.teamId) === 't-other');
  assert('3 Cancelled is not Live, Next, or Done',
    bucket == null, String(bucket));
  assert('3 Cancelled is not Flagged', flagged === false);
  assert('3 Cancelled is not a strike incomplete',
    evidence === 'cancelled'
    && (!narendraRow || narendraRow.flagIncomplete !== true)
    && otherRow && otherRow.flagIncomplete === true,
    JSON.stringify(report.teams));
  assert('4 cancel does not write Flagged or a strike',
    side.flagged === 0 && side.strike === 0
    && ctx.adminState.assignments.every(a => a.status !== 'Flagged' && a.status !== 'Completed')
    && listPosts.every(p => p.body.status !== 'Flagged' && String(p.body.comment).indexOf('session_done') < 0));
  assert('5 Admin Skip record is unchanged',
    side.skipStamp === 0
    && JSON.stringify(ctx.adminState.modStrikeStore) === skipBefore
    && persist.indexOf('skippedTeams') < 0
    && persist.indexOf('stampModStrikeCheckpointOccurrence') < 0);
}

runAhP().then(() => {
  console.log(failed ? ('FAILED ' + failed) : 'All checks passed');
  process.exit(failed ? 1 : 0);
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
