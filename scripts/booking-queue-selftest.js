#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'twilight.js'), 'utf8');
const begin = src.indexOf('/* BOOKING_QUEUE_BEGIN */');
const end = src.indexOf('/* BOOKING_QUEUE_END */');
if (begin < 0 || end < 0 || end <= begin) {
  console.error('Could not locate BOOKING_QUEUE block in twilight.js');
  process.exit(1);
}

const block = src.slice(begin, end);

function runQueue(opts) {
  const gateOpen = opts.gateOpen !== false;
  const ctx = {
    state: opts.state || {},
    console,
    Date,
    Number,
    String,
    Array,
    isTerminalStatus: (s) => s === 'Cancelled' || s === 'Unassigned',
    isSessionWrapUpDone: opts.isSessionWrapUpDone || (() => false),
    getMyLatestStatusForAssignment: opts.getMyLatestStatusForAssignment || (() => null),
    getOperatorAssignments: () => opts.assignments || [],
    getPSTDateString: () => opts.today || '2026-09-16',
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
  return ctx.operatorCarouselCandidateAssignments().map(a => a.id);
}

function runCase(name, fn) {
  try {
    fn();
    console.log('OK', name);
  } catch (e) {
    console.error('FAIL', name, e.message);
    process.exitCode = 1;
  }
}

runCase('before 9 AM hides same-day next booking', () => {
  const ids = runQueue({
    today: '2026-09-16',
    gateOpen: false,
    assignments: [
      { id: 'overnight', date: '2026-09-15', startMin: 22 * 60, endMin: 6 * 60, status: 'Booked' },
      { id: 'morning', date: '2026-09-16', startMin: 10 * 60, endMin: 18 * 60, status: 'Booked' },
    ],
    state: { sessionDate: '2026-09-15', arrivedAt: '2026-09-16T05:00:00.000Z' },
  });
  if (ids.length !== 1 || ids[0] !== 'overnight') {
    throw new Error('expected only overnight, got ' + JSON.stringify(ids));
  }
});

runCase('after 9 AM with prior complete shows morning booking', () => {
  const ids = runQueue({
    today: '2026-09-16',
    gateOpen: true,
    assignments: [
      { id: 'overnight', date: '2026-09-15', startMin: 22 * 60, endMin: 6 * 60, status: 'Booked' },
      { id: 'morning', date: '2026-09-16', startMin: 10 * 60, endMin: 18 * 60, status: 'Booked' },
    ],
    isSessionWrapUpDone: (a) => a && a.id === 'overnight',
    state: { sessionDate: '2026-09-15', sessionCompletedAt: '2026-09-16T06:30:00.000Z' },
  });
  if (!ids.includes('morning')) throw new Error('expected morning booking visible, got ' + JSON.stringify(ids));
});

runCase('in-progress prior day blocks morning even after 9 AM', () => {
  const ids = runQueue({
    today: '2026-09-16',
    gateOpen: true,
    assignments: [
      { id: 'overnight', date: '2026-09-15', startMin: 22 * 60, endMin: 6 * 60, status: 'Booked' },
      { id: 'morning', date: '2026-09-16', startMin: 10 * 60, endMin: 18 * 60, status: 'Booked' },
    ],
    state: { sessionDate: '2026-09-15', arrivedAt: '2026-09-16T05:00:00.000Z' },
  });
  if (ids.includes('morning')) throw new Error('morning should stay hidden while overnight in progress');
});

runCase('same team hides later booking until wrap-up (Venkata x Jashit pattern)', () => {
  const teamId = 'team_vxj';
  const ids = runQueue({
    today: '2026-09-16',
    gateOpen: true,
    assignments: [
      { id: 'am', teamId, date: '2026-09-16', startMin: 8 * 60, endMin: 12 * 60, status: 'Booked' },
      { id: 'pm', teamId, date: '2026-09-16', startMin: 14 * 60, endMin: 22 * 60, status: 'Booked' },
    ],
    isSessionWrapUpDone: () => false,
    getLatestStatusForAssignment: (id) => (id === 'am' ? { status: 'station_3_done' } : null),
    state: { sessionDate: '2026-09-16' },
  });
  if (ids.length !== 1 || ids[0] !== 'am') {
    throw new Error('expected only first same-day team booking, got ' + JSON.stringify(ids));
  }
});

runCase('same team shows second booking after first wrap-up', () => {
  const teamId = 'team_vxj';
  const ids = runQueue({
    today: '2026-09-16',
    gateOpen: true,
    assignments: [
      { id: 'am', teamId, date: '2026-09-16', startMin: 8 * 60, endMin: 12 * 60, status: 'Booked' },
      { id: 'pm', teamId, date: '2026-09-16', startMin: 14 * 60, endMin: 22 * 60, status: 'Booked' },
    ],
    isSessionWrapUpDone: (a) => a && a.id === 'am',
    state: { sessionDate: '2026-09-16', sessionCompletedAt: '2026-09-16T12:30:00.000Z' },
  });
  if (!ids.includes('pm')) throw new Error('expected pm booking after am wrap-up, got ' + JSON.stringify(ids));
});


runCase('hard-drops bookings older than yesterday (2-day cap)', () => {
  const ids = runQueue({
    today: '2026-09-16',
    gateOpen: true,
    assignments: [
      { id: 'ancient', date: '2026-09-13', startMin: 10 * 60, endMin: 18 * 60, status: 'Booked' },
      { id: 'day-before-yest', date: '2026-09-14', startMin: 10 * 60, endMin: 18 * 60, status: 'Booked' },
      { id: 'yesterday', date: '2026-09-15', startMin: 10 * 60, endMin: 18 * 60, status: 'Booked' },
      { id: 'today', date: '2026-09-16', startMin: 10 * 60, endMin: 18 * 60, status: 'Booked' },
    ],
    isSessionWrapUpDone: (a) => a && (a.id === 'yesterday' || a.id === 'ancient' || a.id === 'day-before-yest'),
    state: { sessionDate: '2026-09-16', sessionCompletedAt: '2026-09-16T09:30:00.000Z' },
  });
  if (ids.includes('ancient') || ids.includes('day-before-yest')) {
    throw new Error('expected >2-day bookings dropped, got ' + JSON.stringify(ids));
  }
  if (!ids.includes('today')) throw new Error('expected today visible after prior wrap-up, got ' + JSON.stringify(ids));
});

runCase('unfinished yesterday stays before 9 AM; today hidden', () => {
  const ids = runQueue({
    today: '2026-09-16',
    gateOpen: false,
    assignments: [
      { id: 'yesterday', date: '2026-09-15', startMin: 10 * 60, endMin: 18 * 60, status: 'Booked' },
      { id: 'today', date: '2026-09-16', startMin: 10 * 60, endMin: 18 * 60, status: 'Booked' },
    ],
    state: {},
  });
  if (!ids.includes('yesterday')) throw new Error('expected unfinished yesterday visible before 9 AM');
  if (ids.includes('today')) throw new Error('today should stay hidden before 9 AM while yesterday unfinished');
});

runCase('after 9 AM unfinished yesterday still blocks today (admin gate parity)', () => {
  // Prefer Admin Booking Queue gate consistency over a literal reading of
  // "after 9 AM always advance": an incomplete yesterday remains the blocker
  // until checklist wrap-up (session_done), even after the 9 AM PT checkpoint.
  // 9 AM only opens the path once that prior session is cleared.
  const ids = runQueue({
    today: '2026-09-16',
    gateOpen: true,
    assignments: [
      { id: 'yesterday', date: '2026-09-15', startMin: 10 * 60, endMin: 18 * 60, status: 'Booked' },
      { id: 'today', date: '2026-09-16', startMin: 10 * 60, endMin: 18 * 60, status: 'Booked' },
    ],
    isSessionWrapUpDone: () => false,
    state: {},
  });
  if (!ids.includes('yesterday')) throw new Error('expected unfinished yesterday to remain visible after 9 AM');
  if (ids.includes('today')) throw new Error('today must stay hidden until yesterday wrap-up, got ' + JSON.stringify(ids));
});

if (process.exitCode) process.exit(process.exitCode);
console.log('booking-queue-selftest done');
