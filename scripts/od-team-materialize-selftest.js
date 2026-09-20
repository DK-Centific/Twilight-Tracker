#!/usr/bin/env node
/* Self-test for OD team materialize upsert rules.
 * Extracts the marked block from twilight.js and runs fixture cases.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcPath = path.join(__dirname, '..', 'twilight.js');
const src = fs.readFileSync(srcPath, 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const begin = src.indexOf('/* OD_TEAM_HYDRATE_BEGIN');
const end = src.indexOf('/* OD_TEAM_HYDRATE_END */');
if (begin < 0 || end < 0 || end <= begin) {
  console.error('Could not find OD_TEAM_HYDRATE markers in twilight.js');
  process.exit(1);
}
const block = src.slice(begin, end);

const context = {
  console,
  Date,
  Set,
  Map,
  assignmentIsOdOrigin(a) {
    if (!a) return false;
    if (a.odScheduleId || a.bookingGroupId || a.odStatus) return true;
    return a.comment === 'od-sync' || a.source === 'od-sync';
  },
  bookingOdMeaningfulToken(value) {
    const s = String(value == null ? '' : value).trim();
    if (!s) return '';
    const empty = new Set(['null', 'undefined', 'n/a', 'na', 'none', '0', 'false', '-']);
    return empty.has(s.toLowerCase()) ? '' : s;
  },
  getModeratorShortName(id) { return id; },
  nextTeamId() {
    context._nextId = (context._nextId || 100) + 1;
    return context._nextId;
  },
  adminState: { teams: [] },
  _nextId: 100,
};
vm.createContext(context);
vm.runInContext(block, context);

const {
  materializeOdTeamsFromAssignments,
  findReusableTeamForOdAssignment,
  teamNameFromOdAssignment,
  normalizedPrimaryModSetKey,
  teamIsOdOrigin,
  odTeamOriginConflicts,
} = context;

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

function odAsgn(partial) {
  return Object.assign({
    id: 'asgn_' + Math.random().toString(36).slice(2, 7),
    teamId: null,
    teamName: 'Alex x Blair',
    odScheduleId: 'sched-1',
    bookingGroupId: 'bg-1',
    odStatus: 'Scheduled',
    source: 'od-sync',
    modSnapshots: [
      { orbitLoginId: 'mod-a', firstName: 'Alex' },
      { orbitLoginId: 'mod-b', firstName: 'Blair' },
    ],
  }, partial);
}

console.log('OD team materialize self-test (1.3.091820i)');

assert('APP_VERSION is 1.3.091820i',
  /const APP_VERSION = '1\.3\.091820i'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091820i'));

// 1. Create + stamp
{
  const a = odAsgn({ id: 'a1' });
  const mat = materializeOdTeamsFromAssignments([a], [], { deletedIds: new Set() });
  assert('creates a team when none exist', mat.created.length === 1, 'created=' + mat.created.length);
  assert('stamps assignment.teamId', a.teamId != null && String(a.teamId) === String(mat.created[0].id));
  assert('new team is OD origin', teamIsOdOrigin(mat.created[0]));
  assert('names from First x First snapshots', mat.created[0].name === 'Alex x Blair');
}

// 2. Reload does not duplicate (bookingGroupId)
{
  const existing = {
    id: 7, name: 'Alex x Blair', primaryIds: ['mod-a', 'mod-b'],
    origin: 'od', bookingGroupId: 'bg-1', odScheduleId: 'sched-1',
  };
  const a = odAsgn({ id: 'a2', teamId: null });
  const mat = materializeOdTeamsFromAssignments([a], [existing], { deletedIds: new Set() });
  assert('reuses bookingGroupId team', mat.created.length === 0 && a.teamId === 7);
}

// 3. Same odScheduleId when bookingGroupId missing
{
  const existing = {
    id: 8, name: 'Alex x Blair', primaryIds: ['mod-a', 'mod-b'],
    origin: 'od', odScheduleId: 'sched-9',
  };
  const a = odAsgn({ id: 'a3', bookingGroupId: '', odScheduleId: 'sched-9' });
  const mat = materializeOdTeamsFromAssignments([a], [existing], { deletedIds: new Set() });
  assert('reuses odScheduleId team', mat.created.length === 0 && a.teamId === 8);
}

// 4. Same primary mod-set (Twilight team, no OD origin conflict)
{
  const existing = { id: 9, name: 'Twilight Crew', primaryIds: ['mod-b', 'mod-a'] };
  const a = odAsgn({ id: 'a4', bookingGroupId: 'new-bg', odScheduleId: 'new-sched', teamName: 'Other' });
  const mat = materializeOdTeamsFromAssignments([a], [existing], { deletedIds: new Set() });
  assert('reuses same primary mod-set', mat.created.length === 0 && a.teamId === 9);
  assert('does not flip Twilight team to OD', !teamIsOdOrigin(existing));
}

// 5. Same name fallback (only when snapshots cannot build First x First)
{
  const existing = { id: 10, name: 'Casey x Drew', primaryIds: ['other-1'] };
  const a = odAsgn({
    id: 'a5', bookingGroupId: '', odScheduleId: '',
    teamName: 'Casey x Drew',
    modSnapshots: [],
  });
  const mat = materializeOdTeamsFromAssignments([a], [existing], { deletedIds: new Set() });
  assert('reuses same team name', mat.created.length === 0 && a.teamId === 10,
    'created=' + mat.created.length + ' teamId=' + a.teamId);
}

// 6. First x First when team column empty
{
  const name = teamNameFromOdAssignment({
    teamName: '',
    modSnapshots: [
      { orbitLoginId: 'm1', firstName: 'Riley' },
      { orbitLoginId: 'm2', firstName: 'Sam' },
    ],
  });
  assert('builds First x First name', name === 'Riley x Sam', name);
}

// 6b. Prefer snapshots over stale Assignment team column
{
  const name = teamNameFromOdAssignment({
    teamName: 'Manoj x Muhammad',
    modSnapshots: [
      { orbitLoginId: 'Pradeepreddy-tw', firstName: 'Pradeepreddy' },
      { orbitLoginId: 'Manoj-tw', firstName: 'Manoj' },
    ],
  });
  assert('prefers current mod snapshots over stale team column',
    name === 'Pradeepreddy x Manoj', name);
}

// 7. Two OD bookings same crew, different schedules → separate teams
{
  const a = odAsgn({ id: 'a6', bookingGroupId: 'bg-a', odScheduleId: 's-a' });
  const b = odAsgn({ id: 'a7', bookingGroupId: 'bg-b', odScheduleId: 's-b' });
  const mat = materializeOdTeamsFromAssignments([a, b], [], { deletedIds: new Set() });
  assert('one team per odScheduleId (no cross-schedule mod-set reuse)',
    mat.created.length === 2 && a.teamId !== b.teamId,
    'created=' + mat.created.length + ' a=' + a.teamId + ' b=' + b.teamId);
}

// 8. Honor TeamLog tombstone
{
  const a = odAsgn({ id: 'a8', teamId: 44 });
  const mat = materializeOdTeamsFromAssignments([a], [], { deletedIds: new Set([44]) });
  assert('does not resurrect deleted teamId', mat.created.length === 0 && a.teamId === 44);
}

// 9. Twilight-only assignment ignored
{
  const a = { id: 'tw1', teamId: null, teamName: 'Manual', source: undefined, modSnapshots: [] };
  const mat = materializeOdTeamsFromAssignments([a], [], { deletedIds: new Set() });
  assert('ignores Twilight assignment', mat.created.length === 0 && a.teamId == null);
}

// 10. Prefer bookingGroupId over mod-set
{
  const byMods = { id: 1, name: 'Mods', primaryIds: ['mod-a', 'mod-b'] };
  const byBg = { id: 2, name: 'BG', primaryIds: ['x'], bookingGroupId: 'bg-1', origin: 'od' };
  const team = findReusableTeamForOdAssignment(
    [byMods, byBg],
    { bookingGroupId: 'bg-1', odScheduleId: 'other', modSnapshots: [] },
    ['mod-a', 'mod-b'],
    'Mods'
  );
  assert('upsert key prefers bookingGroupId', team && team.id === 2);
}

// 11. Mod-set key is order-insensitive
assert(
  'mod-set key normalizes order',
  normalizedPrimaryModSetKey(['B', 'a']) === normalizedPrimaryModSetKey(['a', 'B'])
);

// 12. odScheduleId reuse refreshes stale name + primaryIds (David bug)
{
  const existing = {
    id: 55,
    name: 'Manoj x Muhammad',
    primaryIds: ['Manoj-tw', 'Muhammad-tw'],
    origin: 'od',
    odScheduleId: '27c50635-ed73-400a-8dad-69a4d350cf1d',
  };
  const a = odAsgn({
    id: 'a-pm',
    teamId: null,
    teamName: 'Manoj x Muhammad', // stale List column
    bookingGroupId: '',
    odScheduleId: '27c50635-ed73-400a-8dad-69a4d350cf1d',
    modSnapshots: [
      { orbitLoginId: 'Pradeepreddy-tw', firstName: 'Pradeepreddy' },
      { orbitLoginId: 'Manoj-tw', firstName: 'Manoj' },
    ],
  });
  const mat = materializeOdTeamsFromAssignments([a], [existing], { deletedIds: new Set() });
  assert('reuses same odScheduleId without creating duplicate',
    mat.created.length === 0 && a.teamId === 55);
  assert('refreshes stale team name from current mods',
    existing.name === 'Pradeepreddy x Manoj', existing.name);
  assert('refreshes primaryIds to current mods',
    normalizedPrimaryModSetKey(existing.primaryIds)
      === normalizedPrimaryModSetKey(['Pradeepreddy-tw', 'Manoj-tw']));
  assert('stamps assignment.teamName to refreshed label',
    a.teamName === 'Pradeepreddy x Manoj', a.teamName);
  assert('reports updated team for TeamLog',
    (mat.updated || []).some(t => t && t.id === 55));
}

// 13. Mod-set must not steal a team bound to another odScheduleId
{
  const mxm = {
    id: 66,
    name: 'Manoj x Muhammad',
    primaryIds: ['Manoj-tw', 'Muhammad-tw'],
    origin: 'od',
    odScheduleId: 'sched-mxm',
  };
  // Deliberately wrong: only Manoj+Muhammad snapshots would match — use same
  // mod-set as mxm but a different schedule (e.g. mis-grouped rows).
  const a = odAsgn({
    id: 'a-wrong',
    teamId: null,
    teamName: '',
    bookingGroupId: '',
    odScheduleId: 'sched-pm-other',
    modSnapshots: [
      { orbitLoginId: 'Manoj-tw', firstName: 'Manoj' },
      { orbitLoginId: 'Muhammad-tw', firstName: 'Muhammad' },
    ],
  });
  assert('origin conflict helper detects different odScheduleId',
    odTeamOriginConflicts(mxm, a));
  const mat = materializeOdTeamsFromAssignments([a], [mxm], { deletedIds: new Set() });
  assert('does not reuse other-schedule team via mod-set',
    a.teamId !== 66 && mat.created.length === 1,
    'teamId=' + a.teamId + ' created=' + mat.created.length);
  assert('new team keeps its own odScheduleId',
    mat.created[0].odScheduleId === 'sched-pm-other');
}

// 14. Stale teamId on assignment rematches when origin+mods diverge
{
  const wrong = {
    id: 77,
    name: 'Manoj x Muhammad',
    primaryIds: ['Manoj-tw', 'Muhammad-tw'],
    origin: 'od',
    odScheduleId: 'sched-mxm',
  };
  const a = odAsgn({
    id: 'a-stale-id',
    teamId: 77,
    teamName: 'Manoj x Muhammad',
    bookingGroupId: '',
    odScheduleId: 'sched-pm',
    modSnapshots: [
      { orbitLoginId: 'Pradeepreddy-tw', firstName: 'Pradeepreddy' },
      { orbitLoginId: 'Manoj-tw', firstName: 'Manoj' },
    ],
  });
  const mat = materializeOdTeamsFromAssignments([a], [wrong], { deletedIds: new Set() });
  assert('clears stale teamId and materializes correct team',
    a.teamId !== 77 && mat.created.length === 1
      && mat.created[0].name === 'Pradeepreddy x Manoj',
    'teamId=' + a.teamId + ' name=' + (mat.created[0] && mat.created[0].name));
}

// 15. Muhammad x Sravya naming from snapshots
{
  const name = teamNameFromOdAssignment({
    teamName: 'Wrong x Name',
    modSnapshots: [
      { orbitLoginId: 'Muhammad-tw', firstName: 'Muhammad' },
      { orbitLoginId: 'Sravya-tw', firstName: 'Sravya' },
    ],
  });
  assert('Muhammad x Sravya from snapshots', name === 'Muhammad x Sravya', name);
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
