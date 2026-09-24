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

console.log('Moderator overnight stale-team self-test (1.3.091824a)');

assert('APP_VERSION 1.3.091824a',
  /const APP_VERSION = '1\.3\.091824a'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091824a'));

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
  return {
    ids: ctx.operatorCarouselCandidateAssignments().map(a => a.id),
    pin: ctx.operatorInProgressAssignment(ctx.operatorCarouselCandidateAssignments()),
  };
}

const PM7 = 19 * 60;
const AM2 = 2 * 60;
const PM8 = 20 * 60;
const AM3 = 3 * 60;

// Narendra — Sep 24 afternoon. Jodie (Rescheduled, last night) must pin.
// Isaiah (Booked, ended yesterday) drops. Amy Sep 25 must not steal the pin.
{
  const isaiah = {
    id: 'isaiah', date: '2026-09-22', startMin: PM8, endMin: AM3,
    status: 'Booked', odStatus: 'Scheduled', teamName: 'Narendra x Isaiah',
    odScheduleId: 'acc02679-15c3-421e-a062-e08a0ed369bc',
    savedAt: '2026-09-24T19:36:09.092Z',
  };
  const jodie = {
    id: 'jodie', date: '2026-09-23', startMin: PM7, endMin: AM2,
    status: 'Rescheduled', odStatus: 'Rescheduled', teamName: 'Narendra x Satya',
    odScheduleId: '3f751074-0000-4000-8000-000000000001',
    savedAt: '2026-09-24T19:36:09.092Z',
  };
  const amy = {
    id: 'amy', date: '2026-09-25', startMin: PM7, endMin: AM2,
    status: 'Booked', odStatus: 'Scheduled', teamName: 'Narendra x Amy',
    odScheduleId: '6a8daffa-0000-4000-8000-000000000002',
    savedAt: '2026-09-24T19:36:09.092Z',
  };
  const q = runQueue({
    today: '2026-09-24',
    gateOpen: true,
    assignments: [isaiah, jodie, amy],
    state: { sessionDate: '2026-09-22', arrivedAt: '2026-09-23T04:00:00.000Z' },
    getMyLatestStatusForAssignment: (id) => (id === 'isaiah' ? { status: 'arrived' } : null),
    getLatestStatusForAssignment: (id) => (id === 'isaiah' ? { status: 'arrived' } : null),
  });
  assert('Narendra: last-night Jodie Rescheduled is the pin',
    q.ids[0] === 'jodie' && q.pin && q.pin.id === 'jodie', JSON.stringify(q.ids));
  assert('Narendra: Isaiah Booked leftover is dropped',
    !q.ids.includes('isaiah'), JSON.stringify(q.ids));
  assert('Narendra: future Amy does not steal the pin',
    q.ids[0] !== 'amy' && !(q.pin && q.pin.id === 'amy'), JSON.stringify(q.ids));
}

// Pradeepreddy — Michael Luo last night stays; older leftover drops; Sep 26 does not pin.
{
  const zekelia = {
    id: 'zekelia', date: '2026-09-22', startMin: PM8, endMin: AM3,
    status: 'Booked', teamName: 'Pradeepreddy x Manoj',
    odScheduleId: '0706c044-old',
  };
  const michael = {
    id: 'michael', date: '2026-09-23', startMin: PM7, endMin: AM2,
    status: 'Booked', teamName: 'Adidela x Pradeepreddy',
    odScheduleId: 'bcc6893f-michael',
  };
  const manpreet = {
    id: 'manpreet', date: '2026-09-26', startMin: PM7, endMin: AM2,
    status: 'Booked', teamName: 'Matthew x Pradeepreddy',
    odScheduleId: 'cbfe6709-future',
  };
  const q = runQueue({
    today: '2026-09-24',
    gateOpen: true,
    assignments: [zekelia, michael, manpreet],
    state: { sessionDate: '2026-09-22', arrivedAt: '2026-09-23T06:00:00.000Z' },
    getLatestStatusForAssignment: (id) => (id === 'zekelia' ? { status: 'station_4_done' } : null),
  });
  assert('Pradeepreddy: Michael overnight is the pin',
    q.ids[0] === 'michael' && q.pin && q.pin.id === 'michael', JSON.stringify(q.ids));
  assert('Pradeepreddy: older Booked leftover dropped',
    !q.ids.includes('zekelia'), JSON.stringify(q.ids));
  assert('Pradeepreddy: future Manpreet does not steal the pin',
    q.ids[0] !== 'manpreet', JSON.stringify(q.ids));
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
