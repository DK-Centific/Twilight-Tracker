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

if (process.exitCode) process.exit(process.exitCode);
console.log('booking-queue-selftest done');
