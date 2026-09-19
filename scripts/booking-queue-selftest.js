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

runCase('after 9 AM today booking wins over in-progress yesterday', () => {
  // Authoritative: once today is booked and gate is open, My session drops
  // unfinished/in-progress yesterday and shows only today.
  const ids = runQueue({
    today: '2026-09-16',
    gateOpen: true,
    assignments: [
      { id: 'overnight', date: '2026-09-15', startMin: 22 * 60, endMin: 6 * 60, status: 'Booked' },
      { id: 'morning', date: '2026-09-16', startMin: 10 * 60, endMin: 18 * 60, status: 'Booked' },
    ],
    state: { sessionDate: '2026-09-15', arrivedAt: '2026-09-16T05:00:00.000Z' },
  });
  if (ids.includes('overnight')) throw new Error('overnight must drop after 9 AM when today booked, got ' + JSON.stringify(ids));
  if (!ids.includes('morning')) throw new Error('morning must show after 9 AM when today booked, got ' + JSON.stringify(ids));
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

runCase('after 9 AM unfinished yesterday yields to newer today booking', () => {
  // After 9 AM PT with a today booking: carousel shows ONLY today (yesterday
  // incompletes excluded — residual fix after 091818x still listed both).
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
  if (ids.includes('yesterday')) throw new Error('yesterday must not appear after 9 AM when today booked, got ' + JSON.stringify(ids));
  if (!ids.includes('today')) throw new Error('today must advance after 9 AM when booked, got ' + JSON.stringify(ids));
});

runCase('cross-day same team: Venkata x Jashit carousel only today after 9 AM', () => {
  const teamId = 'team_vxj';
  const ids = runQueue({
    today: '2026-09-18',
    gateOpen: true,
    assignments: [
      { id: 'patrick', teamId, date: '2026-09-17', startMin: 19 * 60, endMin: 26 * 60, status: 'Booked' },
      { id: 'rebecca', teamId, date: '2026-09-18', startMin: 20 * 60, endMin: 27 * 60, status: 'Booked' },
    ],
    isSessionWrapUpDone: () => false,
    state: { sessionDate: '2026-09-17' },
  });
  if (ids.includes('patrick')) {
    throw new Error('Patrick (yesterday) must drop when Rebecca today exists after 9 AM, got ' + JSON.stringify(ids));
  }
  if (!ids.includes('rebecca')) {
    throw new Error('expected Rebecca (today) visible for Venkata x Jashit, got ' + JSON.stringify(ids));
  }
});

runCase('mod has yesterday incomplete + today booked after 9 AM → carousel only today', () => {
  const ids = runQueue({
    today: '2026-09-18',
    gateOpen: true,
    assignments: [
      { id: 'yest-incomplete', date: '2026-09-17', startMin: 12 * 60, endMin: 20 * 60, status: 'Booked' },
      { id: 'today-booked', date: '2026-09-18', startMin: 18 * 60, endMin: 26 * 60, status: 'Booked' },
    ],
    isSessionWrapUpDone: () => false,
    state: {},
  });
  if (ids.length !== 1 || ids[0] !== 'today-booked') {
    throw new Error('expected only today-booked, got ' + JSON.stringify(ids));
  }
});

runCase('after 9 AM unfinished yesterday alone still shows (no today booking)', () => {
  const ids = runQueue({
    today: '2026-09-18',
    gateOpen: true,
    assignments: [
      { id: 'yest-only', date: '2026-09-17', startMin: 12 * 60, endMin: 20 * 60, status: 'Booked' },
    ],
    isSessionWrapUpDone: () => false,
    state: {},
  });
  if (!ids.includes('yest-only')) {
    throw new Error('yesterday wrap-up still allowed when no today booking, got ' + JSON.stringify(ids));
  }
});

if (process.exitCode) process.exit(process.exitCode);
console.log('booking-queue-selftest done');
