#!/usr/bin/env node
'use strict';

/**
 * Moderator Cancel session: save order and feedback.
 * Confirm marks the booking Cancelled on this device before any Power
 * Automate call. The Assignment List (what Admin and Performance read)
 * is written before SessionState. A failed write stays pending and is
 * sent again. Same path for a Twilight booking and a OneData booking.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');

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

console.log('Moderator cancel save order self-test');

const FNS = [
  'modCancelSessionComment', 'modCancelActorOrbit', 'assignmentsSharingModCancel',
  'sessionStateBlobIsModCancelWipe', 'clearedEquipmentTicksForModCancel',
  'wipeChecklistProgressForModCancel', 'blockModCancelAssignmentRehydrate',
  'sessionStateRehydrateBlockedForModCancel', 'dropPendingQueueWritesForModCancel',
  'patchStateJsonModCancel', 'modCancelSessionStateTargets', 'postSessionStatePayloadDirect',
  'writeModCancelSessionState', 'markModCancelAssignmentRowLocal',
  'writeModCancelAssignmentListRow', 'postAssignmentRowWithRetry', 'loadPendingModCancels', 'savePendingModCancels',
  'rememberPendingModCancel', 'clearPendingModCancel', 'persistModeratorCancelSession',
  'resumePendingModCancels', 'assignmentCommentPlainForMarker', 'assignmentCommentIsModCancel',
];

function makeCtx(asgn, opts) {
  opts = opts || {};
  const store = {};
  const ctx = {
    console: { log() {}, warn() {} }, Date, JSON, String, Number, Array, Object, Promise,
    // Retry backoff runs at once; the 30 s resend timer does not.
    setTimeout(fn, ms) { if (typeof fn === 'function' && ms < 20000) fn(); return 0; },
    calls: [],
    rendered: [],
    fetchImpl: null,
    fetch(url, o) {
      const body = JSON.parse(o.body);
      ctx.calls.push({ url: String(url), body, statusAtCall: ctx.adminState.assignments[0].status });
      return ctx.fetchImpl ? ctx.fetchImpl(url, body) : Promise.resolve({ ok: true, status: 202 });
    },
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
    MOD_CANCEL_PENDING_KEY: 'twilight_pending_mod_cancel_v1',
    state: { username: 'Sravya-tw', modProfile: { orbitLoginId: 'Sravya-tw' }, sessionStatus: 'arrived', equipment: { tripod: true } },
    adminState: {
      assignments: [asgn],
      perfSessionStateRows: [],
      teams: [{ id: 7, name: 'Muhammad x Sravya', primaryIds: ['Sravya-tw', 'Muhammad-tw'], backupIds: [] }],
    },
    ASSIGNMENT_PA_WRITE_URL: 'https://assignment.test/write',
    SESSIONSTATE_PA_WRITE_URL: 'https://ss.test/write',
    _sessionStateSyncState: { timer: null },
    _modCancelPersistBusy: false,
    _modCancelResumeBusy: false,
    _modCancelBlockedAsgnIds: {},
    window: {},
    currentStationKey: null,
    saveAssignmentData() {},
    saveState() {},
    renderMySessionSection() { ctx.rendered.push(ctx.adminState.assignments[0].status); },
    renderWelcome() {},
    renderApp() {},
    toast() {},
    clearOperatorProgressForNewBooking() {},
    waitForSessionStateSyncIdle: async () => {},
    terminalLockUntil: () => '2099-01-01T00:00:30.000Z',
    buildAssignmentExcelRow(a) {
      return (a.modSnapshots || []).map(m => ({ assignmentId: a.id, orbitLoginId: m.orbitLoginId, status: a.status, comment: a.comment, odStatus: a.odStatus }));
    },
    sessionStateRowsForAssignment() { return []; },
    sessionStateStableId(a, orbit) { return 'ss_' + a.id + '_' + orbit; },
  };
  vm.createContext(ctx);
  vm.runInContext(FNS.map(extractFn).join('\n'), ctx);
  return ctx;
}

function booking(kind) {
  const a = {
    id: kind === 'od' ? 'od_abc' : 'asgn_1792000000000_abcdef',
    teamId: 7, teamName: 'Muhammad x Sravya', date: '2026-10-13', startMin: 17 * 60, endMin: 21 * 60,
    participantData: { firstName: 'Iesha', lastName: 'Gray' },
    modSnapshots: [{ orbitLoginId: 'Sravya-tw' }, { orbitLoginId: 'Muhammad-tw' }],
    status: 'Booked', comment: '',
  };
  if (kind === 'od') { a.odScheduleId = 'abc'; a.odStatus = 'Scheduled'; }
  return a;
}

async function main() {
  for (const kind of ['twilight', 'od']) {
    const ctx = makeCtx(booking(kind));
    const res = await ctx.persistModeratorCancelSession(ctx.adminState.assignments[0]);
    const firstSs = ctx.calls.findIndex(c => c.url.indexOf('ss.test') >= 0);
    const lastList = ctx.calls.map(c => c.url.indexOf('assignment.test') >= 0).lastIndexOf(true);
    assert(kind + ': screen shows Cancelled before any save',
      ctx.rendered[0] === 'Cancelled' && ctx.calls.length > 0 && ctx.calls.every(c => c.statusAtCall === 'Cancelled'));
    assert(kind + ': Assignment List rows are written before SessionState',
      lastList >= 0 && firstSs > lastList, JSON.stringify(ctx.calls.map(c => c.url)));
    assert(kind + ': every List row says Cancelled with the mod-cancel comment',
      ctx.calls.filter(c => c.url.indexOf('assignment.test') >= 0).length === 2
      && ctx.calls.filter(c => c.url.indexOf('assignment.test') >= 0)
        .every(c => c.body.status === 'Cancelled' && String(c.body.comment).indexOf('mod-cancel-session:Sravya-tw:') === 0));
    assert(kind + ': result ok and nothing left pending',
      res && res.ok === true && res.wrote === 1 && ctx.loadPendingModCancels().length === 0, JSON.stringify(res));
  }

  // Assignment write fails: result says so, the cancel stays pending,
  // and a resend writes the rows again even though they show Cancelled.
  const ctx = makeCtx(booking('twilight'));
  ctx.fetchImpl = (url) => Promise.resolve(url.indexOf('assignment.test') >= 0 ? { ok: false, status: 500 } : { ok: true, status: 202 });
  const bad = await ctx.persistModeratorCancelSession(ctx.adminState.assignments[0]);
  assert('failed List write is reported, not shown as saved',
    bad && bad.ok === false && bad.failed === 1, JSON.stringify(bad));
  assert('failed cancel stays pending in this browser',
    ctx.loadPendingModCancels().length === 1
    && ctx.loadPendingModCancels()[0].asgn.id === 'asgn_1792000000000_abcdef');
  const firstComment = ctx.loadPendingModCancels()[0].comment;
  ctx.fetchImpl = null;
  ctx.calls.length = 0;
  await ctx.resumePendingModCancels();
  const resent = ctx.calls.filter(c => c.url.indexOf('assignment.test') >= 0);
  assert('resend writes the already-cancelled rows with the original comment',
    resent.length === 2 && resent.every(c => c.body.status === 'Cancelled' && c.body.comment === firstComment));
  assert('resend clears the pending cancel', ctx.loadPendingModCancels().length === 0);

  const confirmFn = extractFn('openModCancelSessionConfirm');
  assert('Confirm reports the result instead of swallowing it',
    confirmFn.indexOf('persistModeratorCancelSession(asgn).catch') < 0 && confirmFn.indexOf('showModCancelResult') >= 0);
  const resultFn = extractFn('showModCancelResult');
  assert('success shows a Session cancelled confirmation',
    resultFn.indexOf("'Session cancelled'") >= 0 && resultFn.indexOf("'Cancel not saved yet'") >= 0);
  assert('startup resends a pending cancel',
    extractFn('startAppAfterLogin').indexOf('resumePendingModCancels') >= 0);

  if (failed) { console.log('FAILED ' + failed); process.exit(1); }
  console.log('All checks passed');
}
main().catch(e => { console.error(e); process.exit(1); });
