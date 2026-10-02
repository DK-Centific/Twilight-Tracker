#!/usr/bin/env node
'use strict';

// Yesterday checkpoint banner lists the booked two-mod crews for that
// night. Older team records that share those people, and a stale extra
// moderator still stored on the booking, must not add rows.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let passed = 0;
let failed = 0;
function assert(name, cond, detail) {
  if (cond) {
    passed++;
    console.log('  ok  ' + name);
  } else {
    failed++;
    console.error('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

console.log('Yesterday checkpoint roster (1.3.100226j)');

assert('version 1.3.100226j',
  /const APP_VERSION = '1\.3\.100226j'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.100226j'));
assert('checkpoint walks bookings, not every saved team',
  /One row per booked two-mod crew on the checkpoint night/.test(src)
  && /snaps\.length === primarySet\.size/.test(src));

const sliceStart = src.indexOf('function ymd(d)');
const sliceEnd = src.indexOf('function fmtTimeOfDay(min)', sliceStart);
assert('strike slice found', sliceStart > 0 && sliceEnd > sliceStart);

const block = src.slice(sliceStart, sliceEnd) + `
function escapeHTML(s) { return String(s == null ? '' : s); }
function assignmentCoerceClockMin(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) ? n : (fb || 0);
}
function assignmentModalNormalizeEndMin(s, e) {
  e = assignmentCoerceClockMin(e, s);
  return e <= s ? e + 24 * 60 : e;
}
function classifyBookingForPerf(a) {
  if (!a) return null;
  if (a.status === 'Completed') return 'completed';
  if (a.status === 'Cancelled') return 'cancelled';
  return 'scheduled';
}
`;

function pair(id, name) {
  return { id: id, name: name, primaryIds: id.split('|') };
}

const roster = [
  pair('Venkata-tw|Manoj-tw', 'Venkata x Manoj'),
  pair('Venkata-tw|Manoj-tw', 'Venkata x Manoj'),
  pair('Narendra-tw|Rohith-tw', 'Narendra x Rohith'),
  pair('Narendra-tw|Rohith-tw', 'Narendra x Rohith'),
  pair('Matthew-tw|Pradeepreddy-tw', 'Matthew x Pradeepreddy'),
  pair('Matthew-tw|Pradeepreddy-tw', 'Matthew x Pradeepreddy'),
  pair('Muhammad-tw|Sravya-tw', 'Muhammad x Sravya'),
  pair('Adidela-tw|Jashit-tw', 'Adidela x Jashit'),
];
roster.forEach((t, i) => { t.id = 't' + i; });

function snaps(ids) {
  return ids.map(id => ({ orbitLoginId: id }));
}

function booking(opts) {
  return {
    id: opts.id,
    odScheduleId: opts.od || opts.id,
    teamId: opts.teamId,
    teamName: opts.teamName || '',
    date: opts.date,
    startMin: 19 * 60,
    endMin: 2 * 60,
    status: opts.status || 'Booked',
    modSnapshots: snaps(opts.mods),
  };
}

const live = [
  booking({
    id: 'od_vm', teamId: 't0', teamName: 'Venkata x Manoj', date: '2026-10-01',
    mods: ['Venkata-tw', 'Manoj-tw'],
  }),
  booking({
    id: 'od_nr', teamId: 't2', teamName: 'Narendra x Rohith', date: '2026-10-01',
    mods: ['Narendra-tw', 'Rohith-tw'],
  }),
  booking({
    id: 'od_mp', teamId: 't4', teamName: 'Matthew x Pradeepreddy', date: '2026-10-01',
    status: 'Rescheduled', mods: ['Matthew-tw', 'Pradeepreddy-tw'],
  }),
  booking({
    id: 'od_ms', teamId: 't6', teamName: 'Muhammad x Sravya', date: '2026-10-01',
    status: 'Completed', mods: ['Muhammad-tw', 'Sravya-tw'],
  }),
  booking({
    id: 'od_mp_dup', od: 'od_mp_dup', teamId: 't5', teamName: 'Matthew x Pradeepreddy',
    date: '2026-10-01', status: 'Booked', mods: ['Matthew-tw', 'Pradeepreddy-tw'],
  }),
  booking({
    id: 'od_old_vm', teamId: 't1', date: '2026-09-17', status: 'Completed',
    mods: ['Venkata-tw', 'Manoj-tw'],
  }),
  booking({
    id: 'od_old_aj', teamId: 't7', date: '2026-09-25', status: 'Booked',
    mods: ['Adidela-tw', 'Jashit-tw'],
  }),
  booking({
    id: 'od_cancel', teamId: 't7', teamName: 'Adidela x Jashit', date: '2026-10-01',
    status: 'Cancelled', mods: ['Adidela-tw', 'Jashit-tw'],
  }),
  booking({
    id: 'od_stale3', teamId: null, teamName: 'Venkata x Adidela', date: '2026-10-01',
    mods: ['Venkata-tw', 'Adidela-tw', 'Manoj-tw'],
  }),
];

const ctx = {
  setTimeout(fn) { if (typeof fn === 'function') fn(); return 0; },
  clearTimeout() {},
  localStorage: {
    _m: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
    setItem(k, v) { this._m[k] = String(v); },
    removeItem(k) { delete this._m[k]; },
  },
  adminState: {
    teams: roster,
    assignments: live,
    overview: { timeScope: 'all' },
    perfDateRange: 'all',
    perfSessionStateRows: [],
    _perfSSOk: true,
  },
  console,
  Date,
  Math,
  JSON,
  Number,
  String,
  Array,
  Object,
  Set,
  Map,
  Intl,
  isFinite,
  parseInt,
  parseFloat,
  getPSTDateString: () => '2026-10-02',
};

vm.createContext(ctx);
vm.runInContext(block, ctx);

function names(rep) {
  return (rep.teams || []).map(t => t.teamName).slice().sort();
}

const rep = ctx.buildModStrikeCheckpointReport(Date.parse('2026-10-02T15:30:00.000Z'));
const got = names(rep);
assert('four booked crews for 2026-10-01',
  got.length === 4 && got.join(' | ') === [
    'Matthew x Pradeepreddy',
    'Muhammad x Sravya',
    'Narendra x Rohith',
    'Venkata x Manoj',
  ].join(' | '),
  got.join(' | '));
assert('no duplicate Matthew row',
  (rep.teams || []).filter(t => t.teamName === 'Matthew x Pradeepreddy').length === 1);
assert('older Adidela night and the cancelled row stay off the list',
  !(rep.teams || []).some(t => String(t.teamName).indexOf('Adidela') >= 0));
assert('stale third moderator does not invent Venkata x Adidela',
  !(rep.teams || []).some(t => t.teamName === 'Venkata x Adidela'));
const muhammad = (rep.teams || []).find(t => t.teamName === 'Muhammad x Sravya');
assert('completed booking stays Completed',
  muhammad && muhammad.completed === true && muhammad.flagIncomplete !== true);
const venkata = (rep.teams || []).find(t => t.teamName === 'Venkata x Manoj');
assert('unfinished booking stays incomplete',
  venkata && venkata.completed !== true && venkata.flagIncomplete === true,
  JSON.stringify(venkata || {}));

ctx.adminState.assignments = live.map(a => {
  if (String(a.date) !== '2026-10-01') return a;
  if (a.status === 'Cancelled') return a;
  if (a.id === 'od_stale3') return a;
  return Object.assign({}, a, { teamId: null });
});
const bare = ctx.buildModStrikeCheckpointReport(Date.parse('2026-10-02T15:30:00.000Z'));
const bareNames = names(bare);
assert('null teamId still lists those four crews once',
  bareNames.length === 4 && bareNames.join(' | ') === got.join(' | '),
  bareNames.join(' | '));

ctx.adminState.perfDateRange = 'today';
const banner = ctx.renderPerfStrikeCheckpointBannerHTML();
assert('banner names each booked crew once',
  banner.indexOf('Yesterday (2026-10-01)') >= 0
  && banner.split('Venkata x Manoj').length === 2
  && banner.split('Matthew x Pradeepreddy').length === 2
  && banner.split('Narendra x Rohith').length === 2
  && banner.split('Muhammad x Sravya').length === 2
  && banner.indexOf('Adidela') < 0,
  banner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 500));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
