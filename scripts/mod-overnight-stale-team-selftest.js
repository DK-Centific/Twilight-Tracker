#!/usr/bin/env node
'use strict';

/**
 * Sep 24 2026 — last-night overnight must stay My session after 9 AM PT.
 * A future Booked row must not drop it. A Sep 22 Booked leftover whose
 * end day is yesterday must drop. Newer Rescheduled beats older Booked.
 * Assignment.team wins over a disagreeing TeamLog name.
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

const begin = src.indexOf('/* BOOKING_QUEUE_BEGIN */');
const end = src.indexOf('/* BOOKING_QUEUE_END */');
assert('BOOKING_QUEUE block present', begin >= 0 && end > begin);
const block = src.slice(begin, end);

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

console.log('Moderator overnight stale-team self-test (1.3.091825a)');

assert('APP_VERSION 1.3.091825a',
  /const APP_VERSION = '1\.3\.091825a'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091825a'));

const parseCtx = { console, String, parseInt };
vm.createContext(parseCtx);
vm.runInContext(extractFn('_parseClockTimeToMin') + '\n' + extractFn('parseAssignedDate'), parseCtx);

function rowFromAssignedDate(assignedDate, extra) {
  const parsed = parseCtx.parseAssignedDate(assignedDate);
  if (!parsed) throw new Error('unparsed assignedDate: ' + assignedDate);
  return Object.assign({ assignedDate: assignedDate }, parsed, extra);
}

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
      const order = ['arrived', 'station_0a_done', 'station_1_done', 'station_3_done', 'session_done'];
      return order.indexOf(status);
    },
    getLatestStatusForAssignment: opts.getLatestStatusForAssignment || (() => null),
  };
  vm.createContext(ctx);
  vm.runInNewContext(block, ctx);
  const carousel = ctx.operatorCarouselCandidateAssignments();
  return {
    ids: carousel.map(a => a.id),
    pin: ctx.operatorInProgressAssignment(carousel),
    rawPin: ctx.operatorInProgressAssignment(opts.assignments || []),
    ctx: ctx,
  };
}

const PM7 = 19 * 60;
const AM2 = 2 * 60;

function idStr(row) {
  return row ? String(row.id) : '';
}

// Narendra-tw — calendar today 2026-09-24 after 9 AM PT.
// Id116 Booked leftover ends Sep 23 → DROP.
// Id115 Rescheduled last night stays bindable (incomplete).
// Id218 Sep 25 is date>=today and must not arm the today-start scope.
// SS481 Modified is newer than SS498. SS494 (Isaiah orbit on the Satya
// schedule) is not a pin.
{
  const row116 = rowFromAssignedDate('2026-09-22 8 PM – 3 AM', {
    id: 116, status: 'Booked', odStatus: 'Scheduled', teamName: 'Narendra x Isaiah',
    odScheduleId: 'acc02679-15c3-421e-a062-e08a0ed369bc',
    savedAt: '2026-09-24T19:36:09.092Z',
  });
  const row115 = rowFromAssignedDate('2026-09-23 7 PM – 2 AM', {
    id: 115, status: 'Rescheduled', odStatus: 'Rescheduled', teamName: 'Narendra x Satya',
    odScheduleId: '3f751074-8c2a-4e11-9b10-000000000115',
    savedAt: '2026-09-24T19:36:09.092Z',
  });
  const row218 = rowFromAssignedDate('2026-09-25 7 PM – 2 AM', {
    id: 218, status: 'Booked', odStatus: 'Scheduled', teamName: 'Narendra x Amy',
    odScheduleId: '6a8daffa-1111-4222-8333-000000000218',
    savedAt: '2026-09-24T19:36:09.092Z',
  });
  const ss481 = {
    id: 481, status: 'arrived', lastActive: '2026-09-24T15:58:54Z',
    sessionDate: '2026-09-22', orbitLoginId: 'Amanda',
  };
  const ss498 = {
    id: 498, status: 'cal_guide_ack', lastActive: '2026-09-24T06:15:27Z',
    sessionDate: '2026-09-23', orbitLoginId: 'Jodie',
  };
  // Isaiah-tw orbit on the Satya schedule. Newer than both. Must not pin Id116.
  const ss494 = {
    id: 494, status: 'arrived', lastActive: '2026-09-24T19:40:00Z',
    sessionDate: '2026-09-23', orbitLoginId: 'Isaiah-tw',
    odScheduleId: row115.odScheduleId,
  };
  const assignments = [row116, row115, row218];
  const q = runQueue({
    today: '2026-09-24',
    gateOpen: true,
    assignments: assignments,
    state: { sessionDate: '2026-09-22', arrivedAt: '2026-09-23T04:00:00.000Z' },
    getMyLatestStatusForAssignment: (id) => {
      const k = String(id);
      if (k === '116') return ss481;
      if (k === '115') return ss498;
      if (k === '494') return ss494;
      return null;
    },
    getLatestStatusForAssignment: (id) => {
      const k = String(id);
      if (k === '116') return ss481;
      if (k === '115') return ss498;
      if (k === '494') return ss494;
      return null;
    },
  });
  assert('assignedDate 8 PM – 3 AM on Sep 22 ends Sep 23',
    q.ctx.assignmentQueueEndCalendarYmd(row116) === '2026-09-23'
    && row116.date === '2026-09-22' && row116.startMin === 20 * 60 && row116.endMin === 3 * 60);
  assert('assignedDate 7 PM – 2 AM on Sep 23 ends Sep 24 (last night)',
    q.ctx.assignmentQueueEndCalendarYmd(row115) === '2026-09-24'
    && q.ctx.assignmentIsLastNightOvernight(row115, '2026-09-24')
    && !q.ctx.assignmentIsLastNightOvernight(row116, '2026-09-24'));
  assert('Id218 date>=today does not arm today-start',
    !q.ctx.bookingQueueHasTodayStart(assignments, '2026-09-24'));
  assert('Narendra: Id115 Satya is selected and bindable',
    q.ids.map(String).indexOf('115') >= 0
    && idStr(q.pin) === '115'
    && q.pin.teamName === 'Narendra x Satya'
    && String(q.pin.odScheduleId).indexOf('3f751074') === 0,
    JSON.stringify(q.ids));
  assert('Narendra: Id116 Isaiah leftover is dropped',
    q.ids.map(String).indexOf('116') < 0, JSON.stringify(q.ids));
  assert('Narendra: Id218 Amy does not steal the pin',
    idStr(q.pin) !== '218' && q.ids.map(String)[0] !== '218', JSON.stringify(q.ids));
  assert('Narendra: SS481 newer Modified does not pin Id116',
    idStr(q.rawPin) === '115' && idStr(q.rawPin) !== '116',
    idStr(q.rawPin));
  assert('Narendra: SS494 Isaiah orbit is not the pin',
    idStr(q.pin) !== '494' && idStr(q.rawPin) !== '116');
  const idx116 = assignments.findIndex(a => String(a.id) === '116');
  const idx218 = assignments.findIndex(a => String(a.id) === '218');
  const snapFromIsaiah = q.ctx.reconcileOperatorCarouselIdx(assignments, idx116);
  const snapFromAmy = q.ctx.reconcileOperatorCarouselIdx(assignments, idx218);
  assert('sticky index on Id116 snaps to Id115',
    String(assignments[snapFromIsaiah].id) === '115', String(snapFromIsaiah));
  assert('sticky index on Id218 snaps to Id115',
    String(assignments[snapFromAmy].id) === '115', String(snapFromAmy));
}

// Pradeepreddy-tw smoking gun — Id217 Sep 26 must not drop Id227.
{
  const row149 = rowFromAssignedDate('2026-09-22 8 PM – 3 AM', {
    id: 149, status: 'Booked', odStatus: 'Scheduled', teamName: 'Pradeepreddy x Manoj',
    odScheduleId: '0706c044-zekelia',
  });
  const row227 = rowFromAssignedDate('2026-09-23 7 PM – 2 AM', {
    id: 227, status: 'Booked', odStatus: 'Scheduled', teamName: 'Adidela x Pradeepreddy',
    odScheduleId: 'bcc6893f-michael-luo',
  });
  const row217 = rowFromAssignedDate('2026-09-26 7 PM – 2 AM', {
    id: 217, status: 'Booked', odStatus: 'Scheduled', teamName: 'Matthew x Pradeepreddy',
    odScheduleId: 'cbfe6709-manpreet',
  });
  const assignments = [row149, row227, row217];
  const q = runQueue({
    today: '2026-09-24',
    gateOpen: true,
    assignments: assignments,
    state: { sessionDate: '2026-09-22', arrivedAt: '2026-09-23T06:00:00.000Z' },
    getLatestStatusForAssignment: (id) => {
      const k = String(id);
      if (k === '149') return { status: 'station_4_done', lastActive: '2026-09-23T12:00:00Z' };
      // SS 511 Manpreet is newer and unrelated. It must not win the pin.
      if (k === '217') return { id: 511, status: 'arrived', lastActive: '2026-09-24T19:26:00Z' };
      if (k === '227') return { id: 506, status: 'arrived', lastActive: '2026-09-24T15:54:10Z' };
      return null;
    },
  });
  assert('Pradeepreddy: Id217 present and Id227 still selected',
    assignments.some(a => String(a.id) === '217')
    && idStr(q.pin) === '227'
    && q.ids.map(String).indexOf('227') >= 0,
    JSON.stringify(q.ids));
  assert('Pradeepreddy: Id149 never wins',
    q.ids.map(String).indexOf('149') < 0 && idStr(q.pin) !== '149' && idStr(q.rawPin) !== '149',
    JSON.stringify(q.ids) + ' pin=' + idStr(q.pin));
  assert('Pradeepreddy: SS511 does not pin Id217',
    idStr(q.rawPin) === '227' && idStr(q.pin) !== '217', idStr(q.rawPin));
  assert('Id217 date>=today does not arm today-start',
    !q.ctx.bookingQueueHasTodayStart(assignments, '2026-09-24'));
  const idx149 = assignments.findIndex(a => String(a.id) === '149');
  const idx217 = assignments.findIndex(a => String(a.id) === '217');
  assert('sticky index on Id149 snaps to Id227',
    String(assignments[q.ctx.reconcileOperatorCarouselIdx(assignments, idx149)].id) === '227');
  assert('sticky index on Id217 snaps to Id227',
    String(assignments[q.ctx.reconcileOperatorCarouselIdx(assignments, idx217)].id) === '227');

  const teamCtx = {
    console, String, Object,
    adminState: {
      teams: [{ id: 100227, name: 'Pradeepreddy x Manoj', primaryIds: ['Pradeepreddy-tw'], backupIds: [] }],
    },
    getTeamById(id) {
      return (teamCtx.adminState.teams || []).find(t => String(t.id) === String(id)) || null;
    },
    getOperatorTeam() { return teamCtx.adminState.teams[0]; },
  };
  vm.createContext(teamCtx);
  vm.runInContext(extractFn('teamForAssignment'), teamCtx);
  const labeled = teamCtx.teamForAssignment(Object.assign({}, q.pin, { teamId: 100227 }));
  assert('team label matches Id227 Assignment team',
    labeled && labeled.name === 'Adidela x Pradeepreddy', labeled && labeled.name);

  const wrapped = runQueue({
    today: '2026-09-24',
    gateOpen: true,
    assignments: assignments,
    isSessionWrapUpDone: (a) => a && String(a.id) === '227',
  });
  assert('Id227 drops after wrap-up; Id149 still never wins',
    wrapped.ids.map(String).indexOf('227') < 0
    && wrapped.ids.map(String).indexOf('149') < 0
    && idStr(wrapped.pin) !== '227',
    JSON.stringify(wrapped.ids));
}

// Same mod, two open rows that both spill into today: later Rescheduled wins over earlier Booked.
{
  const older = {
    id: 'older-booked', date: '2026-09-23', startMin: 17 * 60, endMin: 60,
    status: 'Booked', teamName: 'Narendra x Isaiah', odScheduleId: 'acc02679',
  };
  const newer = {
    id: 'newer-resched', date: '2026-09-23', startMin: PM7, endMin: AM2,
    status: 'Rescheduled', teamName: 'Narendra x Satya', odScheduleId: '3f751074',
  };
  const q = runQueue({
    today: '2026-09-24',
    gateOpen: true,
    assignments: [older, newer],
    state: { sessionDate: '2026-09-23', arrivedAt: '2026-09-24T01:00:00.000Z' },
    getMyLatestStatusForAssignment: (id) => (id === 'older-booked' ? { status: 'arrived' } : null),
  });
  assert('newer Rescheduled beats older Booked on the same night',
    q.ids[0] === 'newer-resched' && !q.ids.includes('older-booked'), JSON.stringify(q.ids));
}

// Same start clock. Booked row carries the newer timestamp. Rescheduled still wins.
{
  const booked = {
    id: 'tie-booked', date: '2026-09-23', startMin: PM7, endMin: AM2,
    status: 'Booked', odStatus: 'Scheduled', teamName: 'Narendra x Isaiah',
    odScheduleId: 'acc02679', savedAt: '2026-09-24T15:58:54Z',
  };
  const resched = {
    id: 'tie-resched', date: '2026-09-23', startMin: PM7, endMin: AM2,
    status: 'Rescheduled', odStatus: 'Rescheduled', teamName: 'Narendra x Satya',
    odScheduleId: '3f751074', savedAt: '2026-09-24T06:15:27Z',
  };
  const q = runQueue({
    today: '2026-09-24',
    gateOpen: true,
    assignments: [booked, resched],
    getLatestStatusForAssignment: (id) => (id === 'tie-booked'
      ? { status: 'arrived', lastActive: '2026-09-24T15:58:54Z' }
      : { status: 'arrived', lastActive: '2026-09-24T06:15:27Z' }),
  });
  assert('same slot: Rescheduled successor beats Booked with newer SessionState time',
    q.pin && q.pin.id === 'tie-resched' && q.pin.odScheduleId === '3f751074',
    q.ids.join(','));
}

// Before 9 AM the last-night overnight still hides a later same-calendar booking.
{
  const q = runQueue({
    today: '2026-09-24',
    gateOpen: false,
    assignments: [
      { id: 'night', date: '2026-09-23', startMin: PM7, endMin: AM2, status: 'Booked' },
      { id: 'later', date: '2026-09-24', startMin: 10 * 60, endMin: 18 * 60, status: 'Booked' },
    ],
    state: { sessionDate: '2026-09-23', arrivedAt: '2026-09-24T05:00:00.000Z' },
  });
  assert('before 9 AM overnight still binds',
    q.ids.includes('night') && !q.ids.includes('later'), JSON.stringify(q.ids));
}

// Team label: Assignment.team disagrees with TeamLog.
{
  const ctx = {
    console, String, Object,
    adminState: {
      teams: [{ id: 100019, name: 'Narendra x Isaiah', primaryIds: ['Narendra-tw', 'Isaiah-tw'], backupIds: [] }],
    },
    getTeamById(id) {
      return (ctx.adminState.teams || []).find(t => String(t.id) === String(id)) || null;
    },
    getOperatorTeam() {
      return ctx.adminState.teams[0];
    },
  };
  vm.createContext(ctx);
  vm.runInContext(extractFn('teamForAssignment'), ctx);
  const shown = ctx.teamForAssignment({
    id: 'jodie',
    teamId: 100019,
    teamName: 'Narendra x Satya',
    team: 'Narendra x Satya',
    odScheduleId: '3f751074',
  });
  assert('team label uses Assignment.team when TeamLog disagrees',
    shown && shown.name === 'Narendra x Satya', shown && shown.name);
  const agree = ctx.teamForAssignment({
    id: 'jodie',
    teamId: 100019,
    teamName: 'Narendra x Isaiah',
  });
  assert('matching TeamLog name is kept',
    agree && agree.name === 'Narendra x Isaiah' && agree.primaryIds && agree.primaryIds.length === 2,
    agree && agree.name);
}

console.log(failed ? ('FAILED ' + failed) : 'All checks passed');
process.exit(failed ? 1 : 0);
