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

console.log('OD team materialize self-test');

// 1. Create + stamp
{
  const a = odAsgn({ id: 'a1' });
  const mat = materializeOdTeamsFromAssignments([a], [], { deletedIds: new Set() });
  assert('creates a team when none exist', mat.created.length === 1, 'created=' + mat.created.length);
  assert('stamps assignment.teamId', a.teamId != null && String(a.teamId) === String(mat.created[0].id));
  assert('new team is OD origin', teamIsOdOrigin(mat.created[0]));
  assert('keeps Assignment team column name', mat.created[0].name === 'Alex x Blair');
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

// 4. Same primary mod-set
{
  const existing = { id: 9, name: 'Twilight Crew', primaryIds: ['mod-b', 'mod-a'] };
  const a = odAsgn({ id: 'a4', bookingGroupId: 'new-bg', odScheduleId: 'new-sched', teamName: 'Other' });
  const mat = materializeOdTeamsFromAssignments([a], [existing], { deletedIds: new Set() });
  assert('reuses same primary mod-set', mat.created.length === 0 && a.teamId === 9);
  assert('does not flip Twilight team to OD', !teamIsOdOrigin(existing));
}

// 5. Same name fallback
{
  const existing = { id: 10, name: 'Casey x Drew', primaryIds: ['other-1'] };
  const a = odAsgn({
    id: 'a5', bookingGroupId: '', odScheduleId: '',
    teamName: 'Casey x Drew',
    modSnapshots: [{ orbitLoginId: 'mod-z', firstName: 'Zed' }],
  });
  const mat = materializeOdTeamsFromAssignments([a], [existing], { deletedIds: new Set() });
  assert('reuses same team name', mat.created.length === 0 && a.teamId === 10);
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

// 7. Two OD bookings same crew → one team
{
  const a = odAsgn({ id: 'a6', bookingGroupId: 'bg-a', odScheduleId: 's-a' });
  const b = odAsgn({ id: 'a7', bookingGroupId: 'bg-b', odScheduleId: 's-b' });
  const mat = materializeOdTeamsFromAssignments([a, b], [], { deletedIds: new Set() });
  assert('one team for two OD sessions with same mods', mat.created.length === 1 && a.teamId === b.teamId);
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

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
