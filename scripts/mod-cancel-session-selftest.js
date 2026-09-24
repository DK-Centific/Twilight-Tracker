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

console.log('Moderator cancel-session self-test (1.3.091824d)');

assert('APP_VERSION 1.3.091824d',
  /const APP_VERSION = '1\.3\.091824d'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091824d'));

assert('hold is 2 seconds',
  /const MOD_CANCEL_HOLD_MS = 2000/.test(src)
  && html.includes('transition: width 2s linear'));
assert('dialog title',
  src.includes('Are you sure you want to cancel the current session?'));
assert('dialog asks them to reach the Twilight team',
  /reach out to the Twilight team/i.test(src));
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
assert('cancel writer does not complete the session',
  persist.indexOf('completeAssignment') < 0
  && /sessionCompletedAt = null/.test(patch)
  && !/sessionCompletedAt = [^n]/.test(patch));
assert('cancel writer clears sessionCompletedAt',
  /sessionCompletedAt = null/.test(patch));
assert('cancel writer sets sessionStatus Cancelled',
  /sessionStatus = 'Cancelled'/.test(patch));
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
assert('SS marker is Cancelled and not Done',
  patched.sessionStatus === 'Cancelled'
  && patched.sessionCompletedAt == null
  && patched.stations && patched.stations.station4,
  JSON.stringify(patched));

console.log(failed ? ('FAILED ' + failed) : 'All checks passed');
process.exit(failed ? 1 : 0);
