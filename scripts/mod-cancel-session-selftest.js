#!/usr/bin/env node
'use strict';

/**
 * Moderator Cancel session.
 * After cancel, the overnight pin drops and the next Booked row can bind.
 * Checklist progress on that assignment is wiped. Cancel markers stay.
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

console.log('Moderator cancel-session self-test (1.3.091825d)');

assert('APP_VERSION 1.3.091825n',
  /const APP_VERSION = '1\.3\.091825n'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091825n'));

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
const wipe = extractFn('wipeChecklistProgressForModCancel');
const commentFn = extractFn('modCancelSessionComment');
assert('list comment is mod-cancel-session',
  /mod-cancel-session:/.test(commentFn) && persist.indexOf('modCancelSessionComment') >= 0);
assert('cancel writer does not use od-sync-soft-close',
  persist.indexOf('od-sync-soft-close') < 0 && patch.indexOf('od-sync-soft-close') < 0);
assert('cancel writer wipes checklist and does not complete',
  persist.indexOf('completeAssignment') < 0
  && persist.indexOf('clearOperatorProgressForNewBooking') >= 0
  && persist.indexOf('dropPendingQueueWritesForModCancel') >= 0
  && persist.indexOf('blockModCancelAssignmentRehydrate') >= 0
  && patch.indexOf('wipeChecklistProgressForModCancel') >= 0
  && /sessionCompletedAt:\s*null/.test(wipe)
  && /stations:\s*\{\}/.test(wipe)
  && /sessionStartedAt:\s*null/.test(wipe)
  && /clearedEquipmentTicksForModCancel/.test(wipe)
  && src.indexOf('mod_cancel_session') < 0);
assert('cancel upsert does not scrub Cancelled into a Booked shell',
  extractFn('writeModCancelSessionState').indexOf('scrubSessionStateProgressToBooking') < 0
  && extractFn('writeModCancelSessionState').indexOf('buildSessionStateCloudPayload') < 0
  && extractFn('scrubSessionStateProgressToBooking').indexOf('sessionStateBlobIsModCancelWipe') >= 0);
assert('stale richer shell loses to a cancel wipe',
  extractFn('newestSessionStatePerUser').indexOf('prevWipe && !nextWipe') >= 0
  && extractFn('mergeTeammateState').indexOf('sessionStateBlobIsModCancelWipe') >= 0
  && extractFn('flushSessionStateSync').indexOf('sessionStateRehydrateBlockedForModCancel') >= 0);
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

const pure = vm.createContext({ console, String, JSON, Object });
vm.runInContext(commentFn + '\n' + extractFn('clearedEquipmentTicksForModCancel') + '\n' + wipe + '\n' + patch, pure);
const comment = pure.modCancelSessionComment('Narendra-tw', '2026-09-24T22:00:00.000Z');
assert('comment shape',
  comment === 'mod-cancel-session:Narendra-tw:2026-09-24T22:00:00.000Z', comment);
const patched = JSON.parse(pure.patchStateJsonModCancel(JSON.stringify({
  sessionStatus: 'station_4_done',
  sessionCompletedAt: '2026-09-24T04:00:00.000Z',
  sessionStartedAt: '2026-09-24T02:00:00.000Z',
  stationCompletedAt: { station4: '2026-09-24T04:00:00.000Z' },
  stationProgress: { station4: 'done' },
  progressScore: 8601,
  progressAt: '2026-09-24T04:00:00.000Z',
  progressBy: 'Narendra-tw',
  approvalGate: { '115|station1': { status: 'Approved' } },
  equipment: { tripod: true, laptop: true },
  stations: { station4: { scenarios: { '01': { status: 'Uploaded' }, '03': { status: 'In Progress' } } } },
  scenarios: { '01': { status: 'Uploaded' } },
  participantName: 'Jodie',
  participantAddress: '1 Satya St',
  assignmentId: '115',
}), '2026-09-24T22:00:00.000Z', 'Narendra-tw', comment));
assert('SS marker wipes checklist and keeps cancel',
  patched.sessionStatus === 'Cancelled'
  && patched.sessionStatus !== 'session_done'
  && patched.checklistCleared === true
  && patched.sessionCancelledAt === '2026-09-24T22:00:00.000Z'
  && patched.sessionCancelledBy === 'Narendra-tw'
  && patched.cancelComment === comment
  && patched.sessionCompletedAt == null
  && patched.sessionStartedAt == null
  && patched.stations && Object.keys(patched.stations).length === 0
  && patched.stationProgress && Object.keys(patched.stationProgress).length === 0
  && patched.scenarios && Object.keys(patched.scenarios).length === 0
  && patched.stationCompletedAt && Object.keys(patched.stationCompletedAt).length === 0
  && !patched.progressScore
  && patched.progressAt === ''
  && patched.approvalGate && Object.keys(patched.approvalGate).length === 0
  && patched.equipment && patched.equipment.tripod === false && patched.equipment.laptop === false
  && patched.participantName === 'Jodie'
  && patched.participantAddress === '1 Satya St'
  && patched.assignmentId === '115',
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

{
  const rich = {
    orbitLoginId: 'Jodie-tw',
    assignmentId: '115',
    lastActive: '2026-09-24T20:00:00.000Z',
    stateJson: JSON.stringify({
      sessionStatus: 'station_4_done',
      progressScore: 900,
      stations: { station4: { scenarios: { '01': { status: 'Uploaded' } } } },
    }),
  };
  const wipedRow = {
    orbitLoginId: 'Jodie-tw',
    assignmentId: '115',
    lastActive: '2026-09-24T22:00:00.000Z',
    stateJson: JSON.stringify({
      sessionStatus: 'Cancelled',
      checklistCleared: true,
      cancelComment: 'mod-cancel-session:Narendra-tw:t',
      stations: {},
      progressScore: 0,
    }),
  };
  const pickCtx = {
    console, JSON, String, Date, Object, Map,
    parseSessionStateJson(r) {
      try { return JSON.parse(r.stateJson || '{}'); } catch (e) { return {}; }
    },
    sessionStateProgressScore(p) {
      if (!p) return 0;
      if (p.progressScore) return Number(p.progressScore) || 0;
      return (p.stations && Object.keys(p.stations).length) ? 100 : 0;
    },
    sessionStateRowResolvedAssignmentId(r) { return String((r && r.assignmentId) || ''); },
    parseLastActiveMs(v) { const t = Date.parse(v); return isNaN(t) ? 0 : t; },
  };
  vm.createContext(pickCtx);
  vm.runInContext([
    'sessionStateBlobIsModCancelWipe',
    'newestSessionStatePerUser',
  ].map(extractFn).join('\n'), pickCtx);
  const picked = pickCtx.newestSessionStatePerUser([rich, wipedRow]);
  const pickedParsed = picked[0] && JSON.parse(picked[0].stateJson);
  assert('stale uploaded shell does not beat the cancel wipe',
    picked.length === 1 && pickedParsed && pickedParsed.sessionStatus === 'Cancelled',
    JSON.stringify(pickedParsed));

  const scrubCtx = { console, JSON, String, Object };
  vm.createContext(scrubCtx);
  vm.runInContext([
    'sessionStateBlobIsModCancelWipe',
    'clearedEquipmentTicksForModCancel',
    'wipeChecklistProgressForModCancel',
    'scrubSessionStateProgressToBooking',
  ].map(extractFn).join('\n'), scrubCtx);
  const scrubbed = scrubCtx.scrubSessionStateProgressToBooking({
    sessionStatus: 'Cancelled',
    sessionCompletedAt: '2026-09-24T04:00:00.000Z',
    stations: { station4: { scenarios: { '01': { status: 'Uploaded' } } } },
    cancelComment: 'mod-cancel-session:Narendra-tw:t',
    participantAddress: '1 Satya St',
  }, '2026-09-24');
  assert('scrub keeps Cancelled and drops checklist',
    scrubbed.sessionStatus === 'Cancelled'
    && scrubbed.sessionCompletedAt == null
    && scrubbed.stations && Object.keys(scrubbed.stations).length === 0
    && scrubbed.participantAddress === '1 Satya St',
    JSON.stringify(scrubbed));

  const mergeCtx = {
    console, JSON, String, Object,
    state: { stations: { station1: { scenarios: { '01': { status: 'Not Started' } } } }, equipment: { tripod: true } },
    saveState() {},
    flushSessionStateSync() {},
  };
  vm.createContext(mergeCtx);
  vm.runInContext(extractFn('sessionStateBlobIsModCancelWipe') + '\n' + extractFn('mergeTeammateState'), mergeCtx);
  mergeCtx.mergeTeammateState({
    sessionStatus: 'Cancelled',
    checklistCleared: true,
    stations: { station4: { scenarios: { '01': { status: 'Uploaded' } } } },
    equipment: { tripod: false },
  });
  assert('cancel wipe is not merged onto the open checklist',
    mergeCtx.state.stations.station1
    && mergeCtx.state.stations.station1.scenarios['01'].status === 'Not Started'
    && mergeCtx.state.equipment.tripod === true);
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
    sessionStartedAt: '2026-09-24T02:00:00.000Z',
    stationCompletedAt: { station2: '2026-09-24T03:00:00.000Z' },
    stationProgress: { station2: 'done' },
    progressScore: 400,
    stations: { station2: { ok: true, scenarios: { '01': { status: 'Uploaded' } } } },
    approvalGate: { '115|station1': { status: 'Pending' } },
    equipment: { tripod: true },
    arrivedAt: '2026-09-24T02:00:00.000Z',
    participantName: 'Jodie',
    participantAddress: '1 Satya St',
    assignmentId: '115',
  };
  const ssRow = {
    sessionStateId: 'ss_115_Narendra-tw',
    assignmentId: '115',
    orbitLoginId: 'Narendra-tw',
    teamId: 't-narendra',
    stateJson: JSON.stringify(audit),
    sessionStatus: 'station_2_done',
  };
  const jodieRow = {
    sessionStateId: 'ss_115_Jodie-tw',
    assignmentId: '115',
    orbitLoginId: 'Jodie-tw',
    teamId: 't-narendra',
    stateJson: JSON.stringify({
      sessionStatus: 'station_1_done',
      stations: { station1: { scenarios: { '04': { status: 'In Progress' } } } },
      stationCompletedAt: { station1: '2026-09-24T02:30:00.000Z' },
      approvalGate: { '115|station1': { status: 'Approved' } },
      sessionCompletedAt: '2026-09-24T03:30:00.000Z',
      participantName: 'Satya',
    }),
    sessionStatus: 'station_1_done',
  };
  const backupRow = {
    sessionStateId: 'ss_115_Backup-tw',
    assignmentId: '115',
    orbitLoginId: 'Backup-tw',
    teamId: 't-narendra',
    stateJson: '',
    sessionStatus: 'arrived',
  };
  const satya = row('2026-09-23', {
    id: '115', odScheduleId: 'OD-SATYA', teamId: 't-narendra',
    status: 'Booked', odStatus: 'Scheduled', teamName: 'Narendra x Satya', comment: '',
    address: '1 Satya St',
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
      stationCompletedAt: { station2: '2026-09-24T03:00:00.000Z' },
      stations: { station2: { ok: true, scenarios: { '01': { status: 'Uploaded' } } } },
      approvalGate: { '115|station1': { status: 'Pending' } },
      equipment: { tripod: true },
      sessionStartedAt: audit.sessionStartedAt,
      _progressScore: 400,
    },
    adminState: {
      assignments: [satya, jodie, amy, other, todayBooked],
      perfSessionStateRows: [ssRow, jodieRow, backupRow],
      modStrikeStore: JSON.parse(JSON.stringify(skipStore)),
      teams: [
        { id: 't-narendra', name: 'Narendra x Satya', primaryIds: ['Narendra-tw', 'Jodie-tw'], backupIds: ['Backup-tw'] },
        { id: 't-other', name: 'Other team', primaryIds: ['A-tw', 'B-tw'] },
      ],
    },
    ASSIGNMENT_PA_WRITE_URL: 'https://assignment.test/write',
    SESSIONSTATE_PA_WRITE_URL: 'https://ss.test/write',
    _sessionStateSyncState: { timer: null },
    _modCancelPersistBusy: false,
    _modCancelBlockedAsgnIds: {},
    pendingQueue: [
      { event: { worklogId: 'w-done', assignmentId: '115', status: 'session_done' } },
      { event: { worklogId: 'w-next', assignmentId: '218', status: 'arrived' } },
    ],
    loadSyncQueue() { return ctx.pendingQueue; },
    saveSyncQueue(q) { ctx.pendingQueue = q; },
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
        address: a.address,
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
    'sessionStateBlobIsModCancelWipe',
    'clearedEquipmentTicksForModCancel',
    'wipeChecklistProgressForModCancel',
    'blockModCancelAssignmentRehydrate',
    'sessionStateRehydrateBlockedForModCancel',
    'dropPendingQueueWritesForModCancel',
    'patchStateJsonModCancel',
    'modCancelSessionStateTargets',
    'postSessionStatePayloadDirect',
    'writeModCancelSessionState',
    'writeModCancelAssignmentListRow',
    'persistModeratorCancelSession',
    'assignmentCommentPlainForMarker',
    'assignmentCommentIsModCancel',
    'clearOperatorProgressForNewBooking',
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
  const list115 = listPosts.map(p => p.body).find(b => String(b.id) === '115');
  const list115b = listPosts.map(p => p.body).find(b => String(b.id) === '115b');
  assert('1 co-mod schedule is cancelled and other bookings stay Booked',
    byId('218').status === 'Booked' && byId('999').status === 'Booked'
    && listPosts.length === 2
    && listPosts.every(p => p.body.status === 'Cancelled' && p.body.odStatus === 'Scheduled')
    && list115 && list115.address === '1 Satya St'
    && list115b && list115b.address == null,
    JSON.stringify({ a115: list115 && list115.address, a115b: list115b && list115b.address }));
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
  function progressIsReset(parsed) {
    if (!parsed || parsed.sessionStatus !== 'Cancelled') return false;
    if (parsed.sessionStatus === 'session_done' || parsed.sessionStatus === 'Completed') return false;
    if (parsed.checklistCleared !== true) return false;
    if (parsed.sessionCompletedAt != null) return false;
    if (parsed.sessionStartedAt != null) return false;
    if (!parsed.sessionCancelledAt || !parsed.cancelComment) return false;
    if (String(parsed.cancelComment).indexOf('mod-cancel-session:') !== 0) return false;
    const stations = parsed.stations || {};
    const stamps = parsed.stationCompletedAt || {};
    const gate = parsed.approvalGate || {};
    const equip = parsed.equipment || {};
    if (Object.keys(stations).length !== 0) return false;
    if (Object.keys(stamps).length !== 0) return false;
    if (Object.keys(gate).length !== 0) return false;
    if (parsed.stationProgress && Object.keys(parsed.stationProgress).length !== 0) return false;
    if (parsed.progressScore) return false;
    if (Object.keys(equip).some(k => equip[k])) return false;
    return true;
  }
  const actorPosted = ssPosts.find(p => p.body.orbitLoginId === 'Narendra-tw');
  const jodiePosted = ssPosts.find(p => p.body.orbitLoginId === 'Jodie-tw');
  const backupPosted = ssPosts.find(p => p.body.orbitLoginId === 'Backup-tw');
  const actorParsed = actorPosted && JSON.parse(actorPosted.body.stateJson);
  const jodieParsed = jodiePosted && JSON.parse(jodiePosted.body.stateJson);
  const backupParsed = backupPosted && JSON.parse(backupPosted.body.stateJson);
  const orbits = ssPosts.map(p => p.body.orbitLoginId);
  assert('1 SessionState checklist is reset and cancel markers stay',
    reasons.length === 0
    && progressIsReset(actorParsed)
    && progressIsReset(jodieParsed)
    && progressIsReset(backupParsed)
    && actorPosted.body.assignmentId === '115'
    && jodiePosted.body.assignmentId === '115'
    && backupPosted.body.assignmentId === '115'
    && actorPosted.body.sessionStateId === 'ss_115_Narendra-tw'
    && jodiePosted.body.sessionStateId === 'ss_115_Jodie-tw'
    && actorPosted.body.overwrite === true
    && actorPosted.body.sessionStatus === 'Cancelled'
    && actorParsed.participantName === 'Jodie'
    && actorParsed.participantAddress === '1 Satya St'
    && jodieParsed.participantName === 'Satya'
    && orbits.indexOf('A-tw') < 0
    && ctx.sessionStateRehydrateBlockedForModCancel('115') === true
    && ctx.pendingQueue.length === 1
    && ctx.pendingQueue[0].event.assignmentId === '218'
    && ctx.state.sessionCompletedAt == null
    && ctx.state.sessionStartedAt == null
    && (!ctx.state.stations || !ctx.state.stations.station2)
    && (!ctx.state.equipment || ctx.state.equipment.tripod === false)
    && (!ctx.state.approvalGate || Object.keys(ctx.state.approvalGate).length === 0)
    && ctx.state.sessionStatus !== 'station_2_done'
    && !ctx.state._progressScore,
    JSON.stringify({
      orbits: orbits,
      actor: actorParsed,
      jodie: jodieParsed,
      backup: backupParsed,
      queue: ctx.pendingQueue,
      localEquip: ctx.state.equipment,
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
    'assignmentCommentPlainForMarker',
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
