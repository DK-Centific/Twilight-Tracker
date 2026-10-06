#!/usr/bin/env node
'use strict';

/**
 * 9 AM auto-strike identity (Oct 3, 2026).
 * A strike may name only moderator logins stored on that assignment.
 * A linked team roster, an empty SessionState row, or a stale extra
 * snapshot must not move the strike onto someone else.
 * Finished teams, cancelled sessions, the 9 AM gate, and a manual
 * admin strike stay as they are.
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

console.log('9 AM strike stays on the booked moderators');

assert('version 1.3.100626b',
  /const APP_VERSION = '1\.3\.100626b'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.100626b'));
assert('auto-strike checks the assignment moderator logins',
  /function modStrikeOrbitIsBookedModerator/.test(src)
  && /modStrikeOrbitIsBookedModerator\(orbitId, booking\)/.test(src));

const sliceStart = src.indexOf('function ymd(d)');
const sliceEnd = src.indexOf('function fmtTimeOfDay(min)', sliceStart);
assert('strike slice found', sliceStart > 0 && sliceEnd > sliceStart);

const block = src.slice(sliceStart, sliceEnd) + `
function classifyBookingForPerf(a) {
  if (!a) return null;
  if (a.status === 'Completed') return 'completed';
  if (a.status === 'Cancelled') return 'cancelled';
  return 'scheduled';
}
function assignmentCommentPlainForMarker(comment) {
  return String(comment == null ? '' : comment).replace(/<[^>]+>/g, ' ').trim();
}
function assignmentCommentIsModCancel(comment) {
  return assignmentCommentPlainForMarker(comment).indexOf('mod-cancel-session') >= 0;
}
function assignmentIsModCancelForQueue(a) {
  return assignmentCommentIsModCancel(a && a.comment);
}
function assignmentCommentIsOdSoftClose(comment) {
  return assignmentCommentPlainForMarker(comment).indexOf('od-sync-soft-close') >= 0;
}
function assignmentIsOdSoftClose(a) {
  if (!a) return false;
  if (String(a.status || '') !== 'Cancelled') return false;
  return assignmentCommentIsOdSoftClose(a.comment);
}
function perfAssignmentIsTeamCancelled(a) {
  return assignmentIsModCancelForQueue(a);
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
function getPSTDateString() { return '2026-10-03'; }
function toast() {}
function syncOverviewLiveStatusStrikeAttention() {}
function modStrikeRefreshUi() {}
function flushPersistModeratorStrikesSetting() {}
function adminProgressMirrorBlocksWrites() { return false; }
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
  adminState: {
    teams: [],
    assignments: [],
    overview: { timeScope: 'all' },
    perfDateRange: 'all',
    _perfSSOk: true,
    perfSessionStateRows: [],
  },
  state: { username: 'Admin-Twilight' },
  console,
  document: {
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
  },
};
vm.createContext(ctx);
vm.runInContext(block, ctx);

const TODAY = '2026-10-03';
const YESTERDAY = '2026-10-02';
const OLDER = '2026-09-30';
const BRANDON = 'od_85fe50dc-49e0-4dfb-9fcd-2ec130823669';
const EMMANUEL = 'od_cda4f783-8c61-447f-ae52-1ccf21767b3f';
const MANISH = 'od_466726cb-c00b-4d39-b932-8ca0df84ea6c';
const afterGate = ctx.pacificWallClockToMs(TODAY, 20 * 60 + 56);
const beforeGate = ctx.pacificWallClockToMs(TODAY, 8 * 60 + 59);

function snaps(ids) {
  return ids.map(id => ({
    orbitLoginId: id,
    firstName: String(id).replace(/-tw$/i, ''),
  }));
}

function star(id) {
  return ctx.getModStrikeStars(id);
}

function autoLogs(id) {
  const store = ctx.loadModStrikeStore();
  const rec = store.mods && store.mods[String(id).toLowerCase()];
  return ((rec && rec.log) || []).filter(e => e && e.kind === 'auto');
}

function manualLogs(id) {
  const store = ctx.loadModStrikeStore();
  const rec = store.mods && store.mods[String(id).toLowerCase()];
  return ((rec && rec.log) || []).filter(e => e && e.kind === 'manual');
}

function carries(id, aid) {
  return autoLogs(id).some(e => String(e.assignmentId || '') === String(aid)
    || JSON.stringify(e.sessionAliases || []).indexOf(String(aid)) >= 0);
}

function reset(teams, assignments, rows, mods) {
  ctx.adminState.teams = teams || [];
  ctx.adminState.assignments = assignments || [];
  ctx.adminState._perfSSOk = true;
  ctx.adminState.perfSessionStateRows = rows || [];
  ctx.saveModStrikeStore({
    mods: mods || {},
    checkpoints: {},
    version: 1,
    lastWriter: 'test',
  });
}

function run(nowMs) {
  ctx.maybeRunModStrikeNineAmCheckpoint({ silent: true, nowMs: nowMs });
}

function booking(opts) {
  return Object.assign({
    date: YESTERDAY,
    status: 'Booked',
    startMin: 19 * 60,
    endMin: 2 * 60,
    source: 'od-sync',
    comment: 'od-sync',
  }, opts || {});
}

function ssRow(aid, orbit, status, date) {
  return {
    assignmentId: aid,
    orbitLoginId: orbit,
    sessionStatus: status || '',
    sessionDate: date || YESTERDAY,
    stateJson: JSON.stringify({
      sessionDate: date || YESTERDAY,
      sessionStatus: status || '',
      orbitLoginId: orbit,
    }),
  };
}

const pmTeam = {
  id: 't-pm',
  name: 'Pradeepreddy x Manoj',
  primaryIds: ['pradeepreddy-tw', 'manoj-tw'],
  origin: 'od',
  odScheduleId: 'old-pm',
};
const jmTeam = {
  id: 't-jm',
  name: 'Jashit x Matthew',
  primaryIds: ['jashit-tw', 'matthew-tw'],
  origin: 'od',
  odScheduleId: 'old-jm',
};
const nsTeam = {
  id: 't-ns',
  name: 'Narendra x Sravya',
  primaryIds: ['narendra-tw', 'sravya-tw'],
};

// Oct 3 · Brandon Soltero was booked as Narendra and Sravya.
// A stale extra snapshot made the count not two, so the checkpoint
// used the Pradeepreddy x Manoj team roster on this assignment id.
reset(
  [pmTeam],
  [booking({
    id: BRANDON,
    odScheduleId: '85fe50dc-49e0-4dfb-9fcd-2ec130823669',
    teamId: 't-pm',
    teamName: 'Pradeepreddy x Manoj',
    participantName: 'Brandon Soltero',
    modSnapshots: snaps(['narendra-tw', 'sravya-tw', 'stale-tw']),
  })],
  [
    ssRow(BRANDON, 'manoj-tw', ''),
    ssRow(BRANDON, 'pradeepreddy-tw', ''),
  ]
);
run(afterGate);
assert('Oct 3 Brandon id does not strike Manoj',
  star('manoj-tw') === 4 && !carries('manoj-tw', BRANDON),
  'stars=' + star('manoj-tw'));
assert('Oct 3 Brandon id does not strike Pradeepreddy',
  star('pradeepreddy-tw') === 4 && !carries('pradeepreddy-tw', BRANDON),
  'stars=' + star('pradeepreddy-tw'));
assert('Narendra is on Brandon and still loses one star',
  star('narendra-tw') === 3 && carries('narendra-tw', BRANDON),
  'stars=' + star('narendra-tw'));
assert('Sravya is on Brandon and still loses one star',
  star('sravya-tw') === 3 && carries('sravya-tw', BRANDON),
  'stars=' + star('sravya-tw'));

// Oct 3 · Emmanuel Akoto was booked as Matthew and Pradeepreddy.
// The checkpoint stamped Jashit x Matthew on that assignment id.
reset(
  [jmTeam],
  [booking({
    id: EMMANUEL,
    odScheduleId: 'cda4f783-8c61-447f-ae52-1ccf21767b3f',
    teamId: 't-jm',
    teamName: 'Jashit x Matthew',
    participantName: 'Emmanuel Akoto',
    modSnapshots: snaps(['matthew-tw', 'pradeepreddy-tw', 'stale-tw']),
  })]
);
run(afterGate);
assert('Oct 3 Emmanuel id does not strike Jashit',
  star('jashit-tw') === 4 && !carries('jashit-tw', EMMANUEL),
  'stars=' + star('jashit-tw'));
assert('Matthew is on Emmanuel and can still be struck',
  star('matthew-tw') === 3 && carries('matthew-tw', EMMANUEL),
  'stars=' + star('matthew-tw'));
assert('Pradeepreddy is on Emmanuel and can still be struck',
  star('pradeepreddy-tw') === 3 && carries('pradeepreddy-tw', EMMANUEL),
  'stars=' + star('pradeepreddy-tw'));

// Sep 28 · Matthew's auto strike carried Manish's booking id.
reset(
  [jmTeam],
  [booking({
    id: MANISH,
    odScheduleId: '466726cb-c00b-4d39-b932-8ca0df84ea6c',
    teamId: 't-jm',
    teamName: 'Jashit x Matthew',
    participantName: 'Manish Sharma',
    date: YESTERDAY,
    modSnapshots: snaps(['venkata-tw', 'rohith-tw', 'stale-tw']),
  })],
  [],
  {
    'matthew-tw': {
      stars: 3,
      starScale: 4,
      log: [{
        kind: 'manual',
        reason: 'Admin strike Sep 28',
        at: '2026-09-28T18:00:00.000Z',
        assignmentId: 'admin-manual-sep28',
        by: 'Admin-Twilight',
      }],
    },
  }
);
run(afterGate);
assert('Manish id does not auto-strike Matthew',
  star('matthew-tw') === 3 && !carries('matthew-tw', MANISH),
  'stars=' + star('matthew-tw'));
assert('Matthew manual strike is still on the log',
  manualLogs('matthew-tw').length === 1
  && manualLogs('matthew-tw')[0].reason === 'Admin strike Sep 28');
assert('Manish id does not strike Jashit',
  star('jashit-tw') === 4 && !carries('jashit-tw', MANISH));
assert('Venkata is on Manish and can still be struck',
  star('venkata-tw') === 3 && carries('venkata-tw', MANISH),
  'stars=' + star('venkata-tw'));

// No snapshots: the linked team is the crew. SessionState naming
// someone else does not add them, and does not remove the team.
reset(
  [nsTeam],
  [booking({
    id: BRANDON,
    odScheduleId: '85fe50dc-49e0-4dfb-9fcd-2ec130823669',
    teamId: 't-ns',
    teamName: 'Narendra x Sravya',
    participantName: 'Brandon Soltero',
    modSnapshots: [],
  })],
  [ssRow(BRANDON, 'manoj-tw', ''), ssRow(BRANDON, 'pradeepreddy-tw', '')]
);
run(afterGate);
assert('empty SessionState does not strike a login off the booking',
  star('manoj-tw') === 4 && star('pradeepreddy-tw') === 4
  && !carries('manoj-tw', BRANDON) && !carries('pradeepreddy-tw', BRANDON),
  JSON.stringify({ m: star('manoj-tw'), p: star('pradeepreddy-tw') }));
assert('a booking with no snapshots still strikes its team',
  star('narendra-tw') === 3 && star('sravya-tw') === 3
  && carries('narendra-tw', BRANDON) && carries('sravya-tw', BRANDON),
  JSON.stringify({ n: star('narendra-tw'), s: star('sravya-tw') }));

// A direct pass of the wrong logins still cannot write the strike.
reset(
  [nsTeam],
  [booking({
    id: BRANDON,
    odScheduleId: '85fe50dc-49e0-4dfb-9fcd-2ec130823669',
    teamId: 't-ns',
    teamName: 'Narendra x Sravya',
    participantName: 'Brandon Soltero',
    modSnapshots: snaps(['narendra-tw', 'sravya-tw']),
  })]
);
const forced = ctx.modStrikeAttemptAutoStrike(
  ctx.adminState.assignments[0],
  ['manoj-tw', 'pradeepreddy-tw'],
  afterGate,
  { teamAutoStrike: {} },
  '9 AM checkpoint · Pradeepreddy x Manoj session 2026-10-02 not completed'
);
assert('forced foreign logins are refused',
  forced === 0 && star('manoj-tw') === 4 && star('pradeepreddy-tw') === 4,
  'struck=' + forced);

// Same two logins, clean pair, unfinished: they can still be struck.
reset(
  [nsTeam],
  [booking({
    id: BRANDON,
    odScheduleId: '85fe50dc-49e0-4dfb-9fcd-2ec130823669',
    teamId: 't-ns',
    teamName: 'Narendra x Sravya',
    participantName: 'Brandon Soltero',
    modSnapshots: snaps(['narendra-tw', 'sravya-tw']),
  })],
  []
);
run(afterGate);
assert('booked pair with an incomplete session still loses one star',
  star('narendra-tw') === 3 && star('sravya-tw') === 3,
  JSON.stringify({ n: star('narendra-tw'), s: star('sravya-tw') }));

// Stale SessionState naming another crew does not replace the booked pair.
reset(
  [nsTeam, pmTeam],
  [booking({
    id: BRANDON,
    odScheduleId: '85fe50dc-49e0-4dfb-9fcd-2ec130823669',
    teamId: 't-ns',
    teamName: 'Narendra x Sravya',
    participantName: 'Brandon Soltero',
    modSnapshots: snaps(['narendra-tw', 'sravya-tw']),
  })],
  [ssRow(BRANDON, 'manoj-tw', ''), ssRow(BRANDON, 'pradeepreddy-tw', '')]
);
run(afterGate);
assert('stale SessionState crew is not struck for this assignment',
  star('manoj-tw') === 4 && star('pradeepreddy-tw') === 4
  && star('narendra-tw') === 3 && star('sravya-tw') === 3);

// Partner finished: neither booked moderator is struck.
reset(
  [nsTeam],
  [booking({
    id: BRANDON,
    odScheduleId: '85fe50dc-49e0-4dfb-9fcd-2ec130823669',
    teamId: 't-ns',
    teamName: 'Narendra x Sravya',
    modSnapshots: snaps(['narendra-tw', 'sravya-tw']),
  })],
  [ssRow(BRANDON, 'sravya-tw', 'station_4_done')]
);
run(afterGate);
assert('station 4 on one co-mod blocks both',
  star('narendra-tw') === 4 && star('sravya-tw') === 4,
  JSON.stringify({ n: star('narendra-tw'), s: star('sravya-tw') }));

reset(
  [nsTeam],
  [booking({
    id: BRANDON,
    odScheduleId: '85fe50dc-49e0-4dfb-9fcd-2ec130823669',
    teamId: 't-ns',
    teamName: 'Narendra x Sravya',
    status: 'Cancelled',
    modSnapshots: snaps(['narendra-tw', 'sravya-tw']),
  })]
);
run(afterGate);
assert('cancelled booking does not strike',
  star('narendra-tw') === 4 && star('sravya-tw') === 4);

reset(
  [nsTeam],
  [booking({
    id: BRANDON,
    odScheduleId: '85fe50dc-49e0-4dfb-9fcd-2ec130823669',
    teamId: 't-ns',
    teamName: 'Narendra x Sravya',
    status: 'Booked',
    comment: 'mod-cancel-session',
    modSnapshots: snaps(['narendra-tw', 'sravya-tw']),
  })]
);
run(afterGate);
assert('mod-cancel does not strike',
  star('narendra-tw') === 4 && star('sravya-tw') === 4);

reset(
  [nsTeam],
  [booking({
    id: BRANDON,
    odScheduleId: '85fe50dc-49e0-4dfb-9fcd-2ec130823669',
    teamId: 't-ns',
    teamName: 'Narendra x Sravya',
    status: 'Cancelled',
    comment: 'od-sync-soft-close',
    modSnapshots: snaps(['narendra-tw', 'sravya-tw']),
  })]
);
run(afterGate);
assert('soft-close without a finish does not strike',
  star('narendra-tw') === 4 && star('sravya-tw') === 4);

reset(
  [nsTeam],
  [booking({
    id: BRANDON,
    odScheduleId: '85fe50dc-49e0-4dfb-9fcd-2ec130823669',
    teamId: 't-ns',
    teamName: 'Narendra x Sravya',
    modSnapshots: snaps(['narendra-tw', 'sravya-tw']),
  })]
);
run(beforeGate);
assert('before 9:00 AM PT does not strike',
  star('narendra-tw') === 4 && star('sravya-tw') === 4);

reset(
  [nsTeam],
  [booking({
    id: 'od_older',
    odScheduleId: 'older-night',
    teamId: 't-ns',
    teamName: 'Narendra x Sravya',
    date: OLDER,
    modSnapshots: snaps(['narendra-tw', 'sravya-tw']),
  })]
);
run(afterGate);
assert('a night older than yesterday does not strike',
  star('narendra-tw') === 4 && star('sravya-tw') === 4);

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
