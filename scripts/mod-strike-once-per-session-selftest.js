#!/usr/bin/env node
'use strict';

/**
 * One incomplete team session → one strike per moderator.
 * Two co-mod List rows (different assignment ids / team ids, one OD schedule)
 * and a second evaluate must not take a second star.
 */

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

console.log('One strike per moderator per incomplete session');

assert('version 1.3.091825e',
  /const APP_VERSION = '1\.3\.091825e'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091825e'));

const sliceStart = src.indexOf('function ymd(d)');
const sliceEnd = src.indexOf('function fmtTimeOfDay(min)', sliceStart);
const histStart = src.indexOf('function flaggedHistorySameSession(row, assignment)');
const histEnd = src.indexOf('function filterSortFlaggedHistoryRows(rows)', histStart);
assert('strike and history slices found', sliceStart > 0 && sliceEnd > sliceStart && histStart > 0 && histEnd > histStart);

const OD = 'od_venkata_jashit_seth';
const OTHER = 'od_other_session_same_day';
const block = src.slice(sliceStart, sliceEnd)
  + '\n'
  + src.slice(histStart, histEnd)
  + `
function classifyBookingForPerf(a) {
  if (!a) return null;
  if (a.status === 'Completed') return 'completed';
  return 'scheduled';
}
function assignmentCoerceClockMin(v, fb) {
  const n = Number(v);
  return Number.isFinite(n) ? n : (fb || 0);
}
function assignmentModalNormalizeEndMin(s, e) {
  e = assignmentCoerceClockMin(e, s);
  return e <= s ? e + 24 * 60 : e;
}
function escapeHTML(s) { return String(s); }
function getPSTDateString() { return '2026-09-25'; }
function toast() {}
function syncOverviewLiveStatusStrikeAttention() {}
function modStrikeRefreshUi() {}
function perfFlaggedStatusPillForOrbit(orbitId) {
  const max = (typeof MOD_STRIKE_MAX_STARS === 'number') ? MOD_STRIKE_MAX_STARS : 4;
  const stars = getModStrikeStars(orbitId);
  if (stars >= max) return { key: 'ok', label: 'Ok', filter: 'ok', stars: stars };
  if (stars === 3) return { key: 'warn', label: 'Warning received', filter: 'warn', stars: stars };
  if (stars === 2) return { key: 'warn2', label: 'Warning 2', filter: 'warn', stars: stars };
  return { key: 'locked', label: 'Account locked', filter: 'locked', stars: stars };
}
function perfFlaggedAssignmentsInDateRange() {
  return (adminState && adminState._flaggedAsgns) || [];
}
`;

const ctx = {
  setTimeout(fn) { if (typeof fn === 'function') fn(); return 0; },
  clearTimeout() {},
  localStorage: {
    _m: {},
    getItem(k) { return Object.prototype.hasOwnProperty.call(this._m, k) ? this._m[k] : null; },
    setItem(k, v) { this._m[k] = String(v); },
    removeItem(k) { delete this._m[k]; },
  },
  adminState: { teams: [], assignments: [], overview: { timeScope: 'all' }, perfDateRange: 'all' },
  state: { username: 'Admin-Twilight' },
  console: console,
  document: {
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
  },
};
vm.createContext(ctx);
vm.runInContext(block, ctx);

function sessionRow(id, orbit) {
  return {
    id: id,
    assignmentId: id,
    orbitLoginId: orbit,
    sessionStatus: 'station_2_done',
    sessionDate: '2026-09-24',
    stateJson: '{}',
  };
}

function venkataFixture() {
  ctx.adminState.teams = [
    { id: 't-venkata', name: 'Venkata x Jashit', primaryIds: ['Venkata-tw', 'Jashit-tw'] },
    { id: 't-jashit', name: 'Venkata x Jashit', primaryIds: ['Jashit-tw', 'Venkata-tw'] },
    { id: 't-other', name: 'Venkata x Jashit', primaryIds: ['Venkata-tw', 'Jashit-tw'] },
  ];
  ctx.adminState.assignments = [
    {
      id: 'list-169', teamId: 't-venkata', date: '2026-09-24', status: 'Booked',
      startMin: 19 * 60, endMin: 2 * 60, odScheduleId: OD,
      participantData: { firstName: 'Seth', lastName: 'Schnurman' },
      modSnapshots: [{ orbitLoginId: 'Venkata-tw' }, { orbitLoginId: 'Jashit-tw' }],
    },
    {
      id: 'list-170', teamId: 't-jashit', date: '2026-09-24', status: 'Booked',
      startMin: 19 * 60, endMin: 2 * 60, odScheduleId: OD,
      participantData: { firstName: 'Seth', lastName: 'Schnurman' },
      modSnapshots: [{ orbitLoginId: 'Jashit-tw' }, { orbitLoginId: 'Venkata-tw' }],
    },
    {
      id: 'list-other', teamId: 't-other', date: '2026-09-24', status: 'Booked',
      startMin: 8 * 60, endMin: 9 * 60, odScheduleId: OTHER,
      participantData: { firstName: 'Other', lastName: 'Night' },
      modSnapshots: [{ orbitLoginId: 'Venkata-tw' }, { orbitLoginId: 'Jashit-tw' }],
    },
  ];
  ctx.adminState._perfSSOk = true;
  ctx.adminState.perfSessionStateRows = [
    sessionRow('list-169', 'Venkata-tw'),
    sessionRow('list-170', 'Jashit-tw'),
    sessionRow('list-other', 'Venkata-tw'),
  ];
  ctx.adminState._flaggedAsgns = ctx.adminState.assignments.filter(a => a.id !== 'list-other');
  ctx.saveModStrikeStore({ mods: {}, checkpoints: {}, version: 1, lastWriter: 'test' });
}

function autoLogs(orbit) {
  const rec = ctx.loadModStrikeStore().mods[String(orbit).toLowerCase()] || {};
  return (rec.log || []).filter(e => e && e.kind === 'auto');
}

function logsForSession(orbit, od) {
  return autoLogs(orbit).filter(e => {
    if (!e) return false;
    if (String(e.odScheduleId || '') === od) return true;
    const aliases = Array.isArray(e.sessionAliases) ? e.sessionAliases : [];
    if (aliases.some(k => String(k).indexOf('od:' + od) === 0)) return true;
    if (od === OD && (String(e.assignmentId) === 'list-169' || String(e.assignmentId) === 'list-170')) return true;
    if (od === OTHER && String(e.assignmentId) === 'list-other') return true;
    return false;
  });
}

const now = ctx.pacificWallClockToMs('2026-09-25', 10 * 60);
venkataFixture();
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: now });
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: now + 5 * 60 * 1000 });

const vStars = ctx.getModStrikeStars('Venkata-tw');
const jStars = ctx.getModStrikeStars('Jashit-tw');
const vLogs = autoLogs('Venkata-tw');
const jLogs = autoLogs('Jashit-tw');
assert('two co-mod rows and two passes leave 2 stars (one for this session, one for the other night)',
  vStars === 2 && jStars === 2,
  'Venkata ' + vStars + ' Jashit ' + jStars + ' logs ' + vLogs.length + '/' + jLogs.length);
assert('Seth session is one auto strike per moderator, not one per co-mod row',
  logsForSession('Venkata-tw', OD).length === 1
  && logsForSession('Jashit-tw', OD).length === 1,
  'V ' + logsForSession('Venkata-tw', OD).length + ' J ' + logsForSession('Jashit-tw', OD).length);
assert('the other night is its own single strike',
  logsForSession('Venkata-tw', OTHER).length === 1
  && logsForSession('Jashit-tw', OTHER).length === 1
  && vLogs.length === 2 && jLogs.length === 2,
  'other V ' + logsForSession('Venkata-tw', OTHER).length + ' logs ' + vLogs.length);

const wiped = ctx.loadModStrikeStore();
wiped.checkpoints = {};
ctx.saveModStrikeStore(wiped);
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: now + 10 * 60 * 1000 });
assert('wiping the checkpoint marker does not strike again',
  ctx.getModStrikeStars('Venkata-tw') === 2
  && ctx.getModStrikeStars('Jashit-tw') === 2
  && autoLogs('Venkata-tw').length === 2
  && autoLogs('Jashit-tw').length === 2);

// Policies that must stay: before 9 AM, completed, cancelled, Skip.
function onlySeth() {
  ctx.adminState.teams = [
    { id: 't-venkata', name: 'Venkata x Jashit', primaryIds: ['Venkata-tw', 'Jashit-tw'] },
    { id: 't-jashit', name: 'Venkata x Jashit', primaryIds: ['Venkata-tw', 'Jashit-tw'] },
  ];
  ctx.adminState.assignments = [
    {
      id: 'list-169', teamId: 't-venkata', date: '2026-09-24', status: 'Booked',
      startMin: 19 * 60, endMin: 2 * 60, odScheduleId: OD,
      participantData: { firstName: 'Seth' },
      modSnapshots: [{ orbitLoginId: 'Venkata-tw' }, { orbitLoginId: 'Jashit-tw' }],
    },
    {
      id: 'list-170', teamId: 't-jashit', date: '2026-09-24', status: 'Booked',
      startMin: 19 * 60, endMin: 2 * 60, odScheduleId: OD,
      participantData: { firstName: 'Seth' },
      modSnapshots: [{ orbitLoginId: 'Jashit-tw' }, { orbitLoginId: 'Venkata-tw' }],
    },
  ];
  ctx.adminState._perfSSOk = true;
  ctx.adminState.perfSessionStateRows = [
    sessionRow('list-169', 'Venkata-tw'),
    sessionRow('list-170', 'Jashit-tw'),
  ];
  ctx.adminState._flaggedAsgns = [];
  ctx.saveModStrikeStore({ mods: {}, checkpoints: {}, version: 1, lastWriter: 'test' });
}

onlySeth();
const deadline = ctx.assignmentAutoStrikeDeadlineMs(ctx.adminState.assignments[0]);
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: deadline - 60 * 1000 });
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: deadline - 1000 });
assert('before 9:00 AM PT neither co-mod row strikes',
  ctx.getModStrikeStars('Venkata-tw') === 4 && ctx.getModStrikeStars('Jashit-tw') === 4);

onlySeth();
ctx.adminState.assignments.forEach(a => { a.status = 'Completed'; });
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: now });
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: now });
assert('completed session does not strike',
  ctx.getModStrikeStars('Venkata-tw') === 4 && ctx.getModStrikeStars('Jashit-tw') === 4);

onlySeth();
ctx.adminState.assignments.forEach(a => { a.status = 'Cancelled'; a.comment = 'mod-cancel-session:Venkata-tw:2026-09-24T20:00:00Z'; });
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: now });
assert('cancelled session does not strike',
  ctx.getModStrikeStars('Venkata-tw') === 4 && ctx.getModStrikeStars('Jashit-tw') === 4);

onlySeth();
ctx.skipModStrikeCheckpointTeam('t-venkata');
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: now });
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: now });
assert('Skip on one co-mod row blocks the strike for both',
  ctx.getModStrikeStars('Venkata-tw') === 4 && ctx.getModStrikeStars('Jashit-tw') === 4);

onlySeth();
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: now });
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: now + 5 * 60 * 1000 });
assert('one incomplete session, one strike each',
  ctx.getModStrikeStars('Venkata-tw') === 3 && ctx.getModStrikeStars('Jashit-tw') === 3
  && autoLogs('Venkata-tw').length === 1 && autoLogs('Jashit-tw').length === 1,
  'stars ' + ctx.getModStrikeStars('Venkata-tw') + '/' + ctx.getModStrikeStars('Jashit-tw')
  + ' logs ' + autoLogs('Venkata-tw').length + '/' + autoLogs('Jashit-tw').length);
ctx.adminState._flaggedAsgns = ctx.adminState.assignments.slice();
const hist = ctx.buildFlaggedHistoryRows();
const histV = hist.filter(r => String(r.orbitId).toLowerCase() === 'venkata-tw');
const histJ = hist.filter(r => String(r.orbitId).toLowerCase() === 'jashit-tw');
assert('flag history lists each moderator once for the co-mod rows',
  histV.length === 1 && histJ.length === 1,
  'rows ' + hist.length + ' V ' + histV.length + ' J ' + histJ.length);
assert('flag history stars are that moderator’s count',
  histV[0] && histV[0].stars === 3 && histJ[0] && histJ[0].stars === 3);

// PA 2026-09-25: same assignment od_8d6bedbf, sessionDate 2026-09-24,
// two List rows / team ids (200027 then 200040). Key is assignment + date.
const PA_OD = 'od_8d6bedbf';
function paRows() {
  ctx.adminState.teams = [
    { id: 200027, name: 'Venkata x Jashit', primaryIds: ['Venkata-tw', 'Jashit-tw'] },
    { id: 200040, name: 'Venkata x Jashit', primaryIds: ['Venkata-tw', 'Jashit-tw'] },
  ];
  ctx.adminState.assignments = [
    {
      id: 'list-230', assignmentId: PA_OD, teamId: 200027, date: '2026-09-24', status: 'Booked',
      startMin: 19 * 60, endMin: 2 * 60, odScheduleId: PA_OD,
      modSnapshots: [{ orbitLoginId: 'Venkata-tw' }, { orbitLoginId: 'Jashit-tw' }],
    },
    {
      id: 'list-231', assignmentId: PA_OD, teamId: 200040, date: '2026-09-24', status: 'Booked',
      startMin: 19 * 60, endMin: 2 * 60, odScheduleId: PA_OD,
      modSnapshots: [{ orbitLoginId: 'Venkata-tw' }, { orbitLoginId: 'Jashit-tw' }],
    },
  ];
  ctx.adminState._perfSSOk = true;
  ctx.adminState.perfSessionStateRows = [
    sessionRow('list-230', 'Venkata-tw'),
    sessionRow('list-231', 'Jashit-tw'),
  ];
  ctx.adminState._flaggedAsgns = [];
}

function healedAuto(teamId, at) {
  return {
    at: at,
    kind: 'auto',
    reason: '9 AM checkpoint',
    teamId: teamId,
    assignmentId: PA_OD,
    sessionDate: '2026-09-24',
  };
}
function healedRec() {
  return {
    stars: 3,
    starScale: 4,
    log: [
      healedAuto(200040, '2026-09-25T16:20:11.000Z'),
      healedAuto(200027, '2026-09-25T16:20:01.000Z'),
    ],
    updatedAt: '2026-09-25T17:00:00.000Z',
  };
}

paRows();
ctx.saveModStrikeStore({
  mods: { 'venkata-tw': healedRec(), 'jashit-tw': healedRec() },
  checkpoints: {},
  version: 1,
  lastWriter: 'test',
});
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: now });
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: now + 11 * 1000 });
assert('healed stars stay at 3 when the same assignment was already logged twice',
  ctx.getModStrikeStars('Venkata-tw') === 3 && ctx.getModStrikeStars('Jashit-tw') === 3
  && autoLogs('Venkata-tw').length === 2 && autoLogs('Jashit-tw').length === 2,
  'stars ' + ctx.getModStrikeStars('Venkata-tw') + '/' + ctx.getModStrikeStars('Jashit-tw')
  + ' logs ' + autoLogs('Venkata-tw').length + '/' + autoLogs('Jashit-tw').length);

paRows();
ctx.saveModStrikeStore({ mods: {}, checkpoints: {}, version: 1, lastWriter: 'test' });
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: now });
ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: now + 11 * 1000 });
const paV = autoLogs('Venkata-tw');
const paJ = autoLogs('Jashit-tw');
const paStore = ctx.loadModStrikeStore();
const paMark = (paStore.checkpoints['2026-09-25'] || {}).teamAutoStrike || {};
const paKey = 'asgn:' + PA_OD + '|2026-09-24';
assert('two team ids for one assignment take one star each',
  ctx.getModStrikeStars('Venkata-tw') === 3 && ctx.getModStrikeStars('Jashit-tw') === 3
  && paV.length === 1 && paJ.length === 1,
  'stars ' + ctx.getModStrikeStars('Venkata-tw') + '/' + ctx.getModStrikeStars('Jashit-tw')
  + ' logs ' + paV.length + '/' + paJ.length);
assert('strike key is assignment plus date, not team id',
  paV[0] && paV[0].sessionKey === paKey && paJ[0] && paJ[0].sessionKey === paKey
  && !!paMark[paKey]
  && !paMark['200027'] && !paMark['200040'] && !paMark[200027] && !paMark[200040],
  'key ' + (paV[0] && paV[0].sessionKey) + ' mark ' + Object.keys(paMark).join(','));

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
