#!/usr/bin/env node
'use strict';

/**
 * Checklist Confirm Cancel stays Cancelled on Admin Performance.
 * A later OneData echo (comment od-sync, status Booked) must not show
 * that team night as Live or Incomplete, and must not add a strike.
 * Soft-close plus a real finish stays Completed. A different schedule
 * the same evening is not cancelled.
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

function extractFn(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  const asyncAt = start - 'async '.length;
  const from = (asyncAt >= 0 && src.slice(asyncAt, start) === 'async ') ? asyncAt : start;
  let i = from, depth = 0, begun = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') { depth++; begun = true; }
    else if (ch === '}') {
      depth--;
      if (begun && depth === 0) { i++; break; }
    }
  }
  return src.slice(from, i);
}

console.log('Performance checklist cancel vs OneData echo (1.3.100726c)');

assert('APP_VERSION 1.3.100726c',
  /const APP_VERSION = '1\.3\.100726c'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.100726c'));

const CANCEL_COMMENT = 'mod-cancel-session:narendra.tw:2026-10-07T04:00:00.000Z';
const echo = {
  id: 'od_narendra_today',
  teamId: 't-narendra',
  date: '2026-10-07',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Booked',
  odStatus: 'Scheduled',
  comment: '<div class="ExternalClassOD">od-sync</div>',
  odScheduleId: 'OD-NARENDRA-TODAY',
};
const cancelled = {
  id: 'asgn_narendra_cancel',
  teamId: 't-narendra',
  date: '2026-10-07',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Cancelled',
  comment: CANCEL_COMMENT,
  odScheduleId: 'OD-NARENDRA-TODAY',
};
const otherNight = {
  id: 'od_narendra_other',
  teamId: 't-narendra',
  date: '2026-10-07',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Booked',
  comment: 'od-sync',
  odScheduleId: 'OD-NARENDRA-OTHER',
  _past: true,
};
const softClose = {
  id: 'od_soft',
  teamId: 't-soft',
  date: '2026-10-06',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Cancelled',
  comment: 'od-sync-soft-close',
  odScheduleId: 'OD-SOFT',
  _happypath: true,
  _past: true,
};
const resched = {
  id: 'od_resched',
  teamId: 't-resched',
  date: '2026-09-23',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Rescheduled',
  odStatus: 'Rescheduled',
  comment: '',
  odScheduleId: 'OD-RESCHED',
  _past: true,
};
const clearedOnly = {
  id: 'od_cleared',
  teamId: 't-cleared',
  date: '2026-10-07',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Booked',
  comment: 'od-sync',
  odScheduleId: 'OD-CLEARED',
};

const ctx = {
  console,
  Date,
  JSON,
  String,
  Number,
  Array,
  Object,
  Map,
  Set,
  adminState: {
    assignments: [echo, cancelled, otherNight, softClose, resched, clearedOnly],
    teams: [
      { id: 't-narendra' },
      { id: 't-soft' },
      { id: 't-resched' },
      { id: 't-cleared' },
    ],
    perfSessionStateRows: [
      {
        assignmentId: 'od_narendra_today',
        orbitLoginId: 'pradeepreddy.tw',
        sessionStatus: 'arrived',
        stateJson: JSON.stringify({
          sessionStatus: 'arrived',
          arrivedAt: '2026-10-07T03:00:00.000Z',
          sessionDate: '2026-10-07',
        }),
        lastActive: '2026-10-07T05:00:00.000Z',
      },
      {
        assignmentId: 'od_cleared',
        orbitLoginId: 'narendra.tw',
        sessionStatus: '',
        stateJson: JSON.stringify({
          checklistCleared: true,
          sessionCancelledAt: '2026-10-07T04:10:00.000Z',
          sessionDate: '2026-10-07',
          stations: {},
        }),
        lastActive: '2026-10-07T04:10:00.000Z',
      },
    ],
  },
  isPastAssignmentSessionEnd: a => !!(a && a._past),
  isAssignmentTeamHappypathComplete: a => !!(a && a._happypath),
  assignmentPerfSessionStarted: () => true,
  assignmentInPerfLiveWindow: () => true,
  getLatestStatusForAssignment: (id) => {
    if (String(id) === 'od_narendra_today') return { status: 'arrived' };
    if (String(id) === 'od_cleared') return { status: 'arrived' };
    return null;
  },
  isAssignmentCompleteForFlagged: () => false,
  isAssignmentSkipOrResolvedForFlagged: () => false,
  isAssignmentCompleteForStrike: () => false,
  modStrikeSessionStateReady: () => true,
  modStrikeCoModStatusBlocksStrike: () => false,
};
vm.createContext(ctx);

[
  'stripHtmlTagsToPlainText',
  'assignmentCommentPlainForMarker',
  'assignmentCommentIsModCancel',
  'assignmentCommentIsOdSoftClose',
  'assignmentIsOdSoftClose',
  'assignmentOdEchoShouldYieldToModCancel',
  'applyAssignmentGroupModCancelStick',
  'sessionStateRowSaysCancelled',
  'assignmentSessionStateSaysCancelled',
  'assignmentSameModCancelSlot',
  'assignmentRowHasDirectModCancel',
  'assignmentListsForModCancelSlot',
  'assignmentSlotHasModCancel',
  'assignmentLiveSiblingHasModCancel',
  'assignmentIsModCancelEchoDuplicate',
  'perfBookingFactKey',
  'perfAssignmentIsTeamCancelled',
  'classifyBookingForPerf',
  'perfLiveStatusDisplay',
  'isAssignmentFlaggedForPerf',
  'modStrikeAssignmentEvidence',
  'assignmentIsModCancelForQueue',
  'overviewAssignmentIsCancelledForDonut',
  'overviewAssignmentIsCompletedForDonut',
  'overviewAssignmentIsIncompleteForDonut',
  'overviewAssignmentTeamIsLive',
  'overviewAssignmentInDonutBookedScope',
  'extractSyncableState',
].forEach(name => vm.runInContext(extractFn(name), ctx));

assert('OneData echo of a checklist cancel is not Live or Incomplete',
  ctx.classifyBookingForPerf(echo) == null);
assert('OneData echo pill says Cancelled',
  ctx.perfLiveStatusDisplay(echo).label === 'Cancelled');
assert('checklist cancel is not Flagged',
  ctx.isAssignmentFlaggedForPerf(echo) === false
  && ctx.isAssignmentFlaggedForPerf(cancelled) === false);
assert('checklist cancel is not a strike incomplete',
  ctx.modStrikeAssignmentEvidence(echo) === 'cancelled'
  && ctx.modStrikeAssignmentEvidence(cancelled) === 'cancelled');
assert('the Booked echo is not a second Performance row',
  ctx.assignmentIsModCancelEchoDuplicate(echo) === true
  && ctx.assignmentIsModCancelEchoDuplicate(cancelled) === false);
assert('the Booked echo is left out of the Overview count',
  ctx.overviewAssignmentInDonutBookedScope(echo) === false);
assert('the checklist cancel row counts as Cancelled',
  ctx.overviewAssignmentInDonutBookedScope(cancelled) === true
  && ctx.overviewAssignmentIsCancelledForDonut(cancelled) === true
  && ctx.overviewAssignmentIsIncompleteForDonut(cancelled) === false);

assert('a different schedule the same night is not Cancelled',
  ctx.perfAssignmentIsTeamCancelled(otherNight) === false
  && ctx.classifyBookingForPerf(otherNight) === 'incomplete'
  && ctx.perfLiveStatusDisplay(otherNight).label === 'Incomplete');

assert('finished soft-close stays Completed',
  ctx.classifyBookingForPerf(softClose) === 'completed'
  && ctx.perfLiveStatusDisplay(softClose).label === 'Completed'
  && ctx.overviewAssignmentIsCompletedForDonut(softClose) === true
  && ctx.overviewAssignmentIsCancelledForDonut(softClose) === false);

assert('a past Rescheduled night with no finish is not Incomplete',
  ctx.classifyBookingForPerf(resched) == null
  && ctx.overviewAssignmentIsIncompleteForDonut(resched) === false
  && ctx.overviewAssignmentIsCancelledForDonut(resched) === true);

assert('checklistCleared without sessionStatus is still Cancelled',
  ctx.sessionStateRowSaysCancelled(ctx.adminState.perfSessionStateRows[1]) === true
  && ctx.classifyBookingForPerf(clearedOnly) == null
  && ctx.perfLiveStatusDisplay(clearedOnly).label === 'Cancelled'
  && ctx.modStrikeAssignmentEvidence(clearedOnly) === 'cancelled');

const grouped = { status: 'Booked', comment: '<p>od-sync</p>' };
ctx.applyAssignmentGroupModCancelStick(grouped, {
  status: 'Cancelled',
  comment: CANCEL_COMMENT,
  lastActive: '2026-10-07T04:00:00.000Z',
});
assert('older checklist cancel wins over a newer OneData echo on the same assignment',
  grouped.status === 'Cancelled' && grouped.comment === CANCEL_COMMENT);

const revived = { status: 'Booked', comment: '' };
ctx.applyAssignmentGroupModCancelStick(revived, {
  status: 'Cancelled',
  comment: CANCEL_COMMENT,
});
assert('an admin revive is not put back to Cancelled',
  revived.status === 'Booked' && revived.comment === '');

const synced = ctx.extractSyncableState({
  sessionStatus: 'Cancelled',
  cancelComment: CANCEL_COMMENT,
  checklistCleared: true,
  sessionCancelledAt: '2026-10-07T04:00:00.000Z',
  sessionCancelledBy: 'narendra.tw',
  stations: {},
  stationCompletedAt: {},
});
assert('the next checklist save still carries the cancel markers',
  synced.sessionStatus === 'Cancelled'
  && synced.checklistCleared === true
  && String(synced.cancelComment).indexOf('mod-cancel-session') === 0);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll passed');
