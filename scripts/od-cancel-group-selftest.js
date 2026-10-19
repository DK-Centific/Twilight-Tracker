#!/usr/bin/env node
'use strict';

/**
 * Booking app Cancel on a OneData booking stays Cancelled after a reload.
 * The OneData rows have no assignmentId, so the card's id is the made-up
 * asgn_remote_<hash of od|odScheduleId>. The Cancel rows carry that id.
 * Both kinds of row must land in one group (od|odScheduleId), or the
 * Booked OneData group wins and the session snaps back to Booked.
 * A real Twilight id (asgn_...) keeps its own group.
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

console.log('OneData booking Cancel joins the OneData group (1.3.101926a)');

assert('APP_VERSION 1.3.101926a',
  /const APP_VERSION = '1\.3\.101926a'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.101926a'));

const from = src.indexOf('const remoteOdId = ');
const to = src.indexOf('`);', from);
assert('grouping rule found', from > 0 && to > from);
const block = src.slice(from, to + 3);
const groupKeyOf = new vm.Script('(function(r, odKeys, dateInfo){ '
  + block + ' return groupKey; })').runInNewContext({});

const dateInfo = { date: '2026-10-14', startMin: 19 * 60 };
const od = { odScheduleId: 'sch-dillon', bookingGroupId: '', odStatus: 'Scheduled' };
const none = { odScheduleId: '', bookingGroupId: '', odStatus: '' };

const odRow = groupKeyOf({ assignmentId: '', status: 'Booked', comment: 'od-sync' }, od, dateInfo);
const cancelRow = groupKeyOf({ assignmentId: 'asgn_remote_htp9tr', status: 'Cancelled' }, od, dateInfo);
assert('OneData row groups by schedule', odRow === 'od|sch-dillon', odRow);
assert('Cancel row with made-up id joins the OneData group', cancelRow === odRow, cancelRow);

const twilight = groupKeyOf({ assignmentId: 'asgn_1760000000_ab', status: 'Cancelled' }, od, dateInfo);
assert('real Twilight id keeps its own group', twilight === 'asgn_1760000000_ab', twilight);

const remoteNoOd = groupKeyOf({ assignmentId: 'asgn_remote_xyz', status: 'Booked' }, none, dateInfo);
assert('made-up id without a schedule keeps its id', remoteNoOd === 'asgn_remote_xyz', remoteNoOd);

const legacy = groupKeyOf({ assignmentId: '', teamId: 't1', assignedTo: 'p' }, none, dateInfo);
assert('legacy row unchanged', legacy === 'legacy|2026-10-14|1140|t1|p', legacy);

if (failed) { console.log(failed + ' failed'); process.exit(1); }
console.log('all passed');
