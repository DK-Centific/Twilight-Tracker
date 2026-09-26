#!/usr/bin/env node
'use strict';

/**
 * Performance Past = rolling last 24 hours on the booked session end.
 * Moderator Cancel session shows Cancelled and is not Done, Flagged, or a strike.
 * Clock: assignmentBookingSessionEndMs (America/Los_Angeles wall clock).
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

console.log('Performance past-24h + cancel status self-test (1.3.091825d)');

assert('APP_VERSION 1.3.091825m',
  /const APP_VERSION = '1\.3\.091825m'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091825m'));
assert('Past window is 24 hours on booked session end',
  /const PERF_PAST_WINDOW_MS = 24 \* 60 \* 60 \* 1000/.test(src)
  && /assignmentBookingSessionEndMs/.test(extractFn('perfDateInRange')));

const ssCancelJson = JSON.stringify({
  sessionStatus: 'Cancelled',
  sessionCancelledAt: '2026-09-24T22:00:00.000Z',
  cancelComment: 'mod-cancel-session:Narendra-tw:2026-09-24T22:00:00.000Z',
  sessionCompletedAt: '2026-09-24T21:00:00.000Z',
  sessionDate: '2026-09-20',
  stationCompletedAt: { Station4: '2026-09-20T06:00:00.000Z' },
});

const listCancel = {
  id: '115',
  teamId: 't-narendra',
  date: '2026-09-24',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Cancelled',
  comment: 'mod-cancel-session:Narendra-tw:2026-09-24T22:00:00.000Z',
};

const ssOnly = {
  id: '116',
  teamId: 't-narendra',
  date: '2026-09-24',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Booked',
  comment: '',
};

const adminCancel = {
  id: '117',
  teamId: 't-narendra',
  date: '2026-09-24',
  startMin: 10 * 60,
  endMin: 12 * 60,
  status: 'Cancelled',
  comment: 'admin removed',
};

const stillOpen = {
  id: '118',
  teamId: 't-other',
  date: '2026-09-24',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Booked',
  comment: '',
};

const ctx = {
  console,
  Date,
  JSON,
  String,
  Number,
  Array,
  Object,
  adminState: {
    perfDateRange: 'all',
    perfStatusScope: 'all',
    assignments: [listCancel, ssOnly, adminCancel, stillOpen],
    perfSessionStateRows: [
      {
        assignmentId: '116',
        orbitLoginId: 'Narendra-tw',
        sessionStatus: 'session_done',
        stateJson: ssCancelJson,
        lastActive: '2026-09-24T22:05:00.000Z',
      },
      {
        assignmentId: '115',
        orbitLoginId: 'Satya-tw',
        sessionStatus: 'Cancelled',
        stateJson: ssCancelJson,
        lastActive: '2026-09-24T22:05:00.000Z',
      },
    ],
  },
  // Leftover wrap-up must not win over Cancelled.
  getLatestStatusForAssignment: () => ({ status: 'session_done', sessionCompletedAt: '2026-09-24T21:00:00.000Z' }),
  isPastAssignmentSessionEnd: () => true,
  isAssignmentCompleteForFlagged: () => false,
  isAssignmentSkipOrResolvedForFlagged: () => false,
  isAssignmentCompleteForStrike: () => true,
  modStrikeSessionStateReady: () => true,
};
vm.createContext(ctx);
vm.runInContext([
  'assignmentCommentPlainForMarker',
  'assignmentCommentIsModCancel',
  'sessionStateRowSaysCancelled',
  'assignmentSessionStateSaysCancelled',
  'perfAssignmentIsTeamCancelled',
  'classifyBookingForPerf',
  'perfLiveStatusDisplay',
  'isAssignmentFlaggedForPerf',
  'isAssignmentTeamHappypathComplete',
  'modStrikeAssignmentEvidence',
  'teamBookingOnDateForStrike',
  'perfHistoryAssignments',
  'perfTeamHistoryBookings',
  'perfTeamAssignmentsForSource',
  'perfMergeTeamCancelledBookings',
  'scrubSessionStateProgressToBooking',
].map(extractFn).join('\n'), ctx);

assert('list mod-cancel is not Live, Next, or Done',
  ctx.classifyBookingForPerf(listCancel) == null);
assert('SessionState Cancelled is not Live, Next, or Done',
  ctx.classifyBookingForPerf(ssOnly) == null);
assert('list mod-cancel pill is Cancelled',
  ctx.perfLiveStatusDisplay(listCancel).label === 'Cancelled');
assert('SessionState Cancelled pill is Cancelled even if live says session_done',
  ctx.perfLiveStatusDisplay(ssOnly).label === 'Cancelled');
assert('list mod-cancel is not Flagged',
  ctx.isAssignmentFlaggedForPerf(listCancel) === false);
assert('SessionState Cancelled is not Flagged',
  ctx.isAssignmentFlaggedForPerf(ssOnly) === false);
assert('list mod-cancel is not a strike incomplete',
  ctx.modStrikeAssignmentEvidence(listCancel) === 'cancelled');
assert('SessionState Cancelled is not a strike incomplete',
  ctx.modStrikeAssignmentEvidence(ssOnly) === 'cancelled');
assert('happypath does not treat SessionState Cancelled as Done',
  ctx.isAssignmentTeamHappypathComplete(ssOnly) === false
  && ctx.isAssignmentTeamHappypathComplete(listCancel) === false);
assert('strike subject skips the cancelled booking',
  ctx.teamBookingOnDateForStrike('t-narendra', '2026-09-24') == null);
assert('an open booking on another team can still be a strike subject',
  ctx.teamBookingOnDateForStrike('t-other', '2026-09-24')
  && ctx.teamBookingOnDateForStrike('t-other', '2026-09-24').id === '118');

const shown = ctx.perfTeamAssignmentsForSource('t-narendra', 'history');
const shownIds = shown.map(a => String(a.id));
assert('Performance list shows list-cancelled and SessionState-cancelled',
  shownIds.indexOf('115') >= 0 && shownIds.indexOf('116') >= 0, shownIds.join(','));
assert('admin cancel without mod-cancel-session stays off the Performance list',
  shownIds.indexOf('117') < 0, shownIds.join(','));
assert('Done tile does not count a team cancel',
  shown.every(a => ctx.classifyBookingForPerf(a) !== 'completed'));

const scrubbed = ctx.scrubSessionStateProgressToBooking(JSON.parse(ssCancelJson), '2026-09-24', {
  preserveSessionCompletion: true,
});
assert('day-gate scrub keeps sessionStatus Cancelled',
  scrubbed && scrubbed.sessionStatus === 'Cancelled');

const commentOnly = ctx.scrubSessionStateProgressToBooking({
  sessionStatus: 'session_done',
  sessionCompletedAt: '2026-09-24T21:00:00.000Z',
  cancelComment: 'mod-cancel-session:Narendra-tw:2026-09-24T22:00:00.000Z',
  sessionDate: '2026-09-20',
}, '2026-09-24', { preserveSessionCompletion: true });
assert('scrub does not revive session_done when cancel comment is set',
  commentOnly && commentOnly.sessionStatus === 'Cancelled');

// Incomplete rows that were not cancelled can still be flagged.
assert('a non-cancelled past booking can still be Flagged',
  ctx.isAssignmentFlaggedForPerf(stillOpen) === true);

if (failed) {
  console.error('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll passed');
