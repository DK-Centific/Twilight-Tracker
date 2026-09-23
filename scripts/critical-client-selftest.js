#!/usr/bin/env node
'use strict';

/**
 * AHP critical client fixes (1.3.091823c)
 * APPROVAL-ORPHAN-PENDING, APPROVAL-SCRUB-EMPTY-ASGN, APPROVAL-TTL-RELOCK,
 * ARRIVAL-NO-ADDRESS-INSIDE, SS-MERGE-001, SS-MERGE-002, SS-MERGE-003.
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
  let i = start;
  let depth = 0;
  let begun = false;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') { depth++; begun = true; }
    else if (ch === '}') {
      depth--;
      if (begun && depth === 0) { i++; break; }
    }
  }
  return src.slice(start, i);
}

console.log('Critical client fixes self-test (1.3.091823c)');

assert('version 1.3.091823c',
  /const APP_VERSION = '1\.3\.091823c'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091823c'));

assert('submit keeps Pending only after a real id',
  /if \(!writtenId\)/.test(src)
  && /setGateStatus\(stationKey, prior\.status \|\| 'none', prior\)/.test(src)
  && /pendingLocalAt: Date\.now\(\)/.test(src));
assert('poll clears orphan Pending when the read has no row',
  /clearStaleLocalGateIfNoCloudRow\(k, g\)/.test(src));
assert('scrub no-ops when assignment id is blank',
  /if \(!want\) return;/.test(extractFn('scrubApprovalGateToActiveAssignment')));
assert('verified Approved is not TTL-relocked',
  /if \(g\.verifiedAt\) return true;/.test(extractFn('gateApproved')));
assert('confirm arrival requires inside, not skipped, and a fresh position',
  /result\.ok && !result\.skipped && result\.inside && fresh/.test(extractFn('confirmOperatorArrival')));
assert('missing address is not inside the fence',
  /reason: 'no-address'/.test(extractFn('liveLocationInsideAssignmentFence'))
  && /inside: false/.test(extractFn('checkParticipantGeofence')));
assert('silent poll does not clear when the booking id disappears',
  /if \(!nextKey && !explicit\) return;/.test(extractFn('syncBookedParticipantName')));
assert('teammate auto-merge scores after scrub',
  /scoreAfterScrub\(cloud\)/.test(src)
  && /if \(afterScore > myScore\) state\._lastSyncMergeScore = teammateScore/.test(src));
assert('decline stamps the scrubbed score',
  /state\._lastSyncMergeScore = scoredDecline\.score/.test(src));
assert('self sync refetches and does not wholesale-replace Done',
  /function showOrUpdateSelfSyncBanner\(/.test(src)
  && /findSelfSessionStateUpdate\(\)/.test(src.slice(
    src.indexOf('function showOrUpdateSelfSyncBanner('),
    src.indexOf('function hideSelfSyncBanner(')
  ))
  && /mergeTeammateState\(s\)/.test(extractFn('applySelfSyncReplace'))
  && !/state\.sessionCompletedAt = s\.sessionCompletedAt \|\| null/.test(src));

const gateCtx = {
  APPROVAL_PA_READ_URL: 'https://example.test/approval-read',
  APPROVAL_VERIFY_TTL_MS: 10 * 60 * 1000,
  APPROVAL_AUTO_GRACE_MS: 5 * 60 * 1000,
  Date,
  gates: {},
  getGate(k) { return gateCtx.gates[k] || { status: 'none' }; },
};
vm.createContext(gateCtx);
vm.runInContext(extractFn('gateApproved'), gateCtx);
const past = Date.now() - (11 * 60 * 1000);
gateCtx.gates.station1 = { status: 'Approved', verifiedAt: past };
assert('Approved past 10 minutes stays unlocked', gateCtx.gateApproved('station1') === true);
gateCtx.gates.station1 = { status: 'Approved' };
assert('Approved with no cloud verify stays locked', gateCtx.gateApproved('station1') === false);
gateCtx.gates.station1 = { status: 'AutoApproved', verifiedAt: past };
assert('cloud-verified AutoApproved past 10 minutes stays unlocked', gateCtx.gateApproved('station1') === true);
gateCtx.gates.station1 = { status: 'AutoApproved', autoLocalAt: past };
assert('unverified AutoApproved past the grace window locks', gateCtx.gateApproved('station1') === false);
gateCtx.gates.station1 = { status: 'Rejected', verifiedAt: Date.now() };
assert('Rejected stays locked', gateCtx.gateApproved('station1') === false);

const scrubCtx = {
  state: {
    approvalGate: {
      'asgnA|station1': { status: 'Approved', verifiedAt: 1 },
      'asgnB|station1': { status: 'Pending' },
    },
  },
  saveState() { scrubCtx.saved = true; },
  addDaysToYmd(ymd) { return ymd; },
};
vm.createContext(scrubCtx);
vm.runInContext(extractFn('scrubApprovalGateToActiveAssignment'), scrubCtx);
scrubCtx.scrubApprovalGateToActiveAssignment('', '2026-09-23');
assert('blank assignment id keeps Approved and Pending',
  !!(scrubCtx.state.approvalGate['asgnA|station1'] && scrubCtx.state.approvalGate['asgnB|station1'])
  && !scrubCtx.saved);
scrubCtx.scrubApprovalGateToActiveAssignment('asgnA', '2026-09-23');
assert('a real assignment id drops the other booking gate',
  !!scrubCtx.state.approvalGate['asgnA|station1']
  && !scrubCtx.state.approvalGate['asgnB|station1']);

const clearCtx = {
  APPROVAL_AUTO_GRACE_MS: 5 * 60 * 1000,
  Date,
  gate: { status: 'Pending', pendingLocalAt: Date.now(), approvalId: 'appr_asgn_Station1' },
  getGate() { return clearCtx.gate; },
  setGateStatus(k, status) {
    clearCtx.cleared = status;
    clearCtx.gate = { status: status };
    return clearCtx.gate;
  },
};
vm.createContext(clearCtx);
vm.runInContext(extractFn('clearStaleLocalGateIfNoCloudRow'), clearCtx);
assert('fresh Pending write is kept during grace',
  clearCtx.clearStaleLocalGateIfNoCloudRow('station1', clearCtx.gate) === false);
clearCtx.gate = { status: 'Pending', pendingLocalAt: Date.now() - (6 * 60 * 1000), approvalId: 'appr_asgn_Station1' };
assert('orphan Pending with no cloud row is cleared',
  clearCtx.clearStaleLocalGateIfNoCloudRow('station1', clearCtx.gate) === true
  && clearCtx.cleared === 'none');
clearCtx.gate = { status: 'InReview', approvalId: 'appr_asgn_Station1' };
assert('InReview with no cloud row is cleared',
  clearCtx.clearStaleLocalGateIfNoCloudRow('station1', clearCtx.gate) === true);
clearCtx.gate = { status: 'Approved', verifiedAt: Date.now() };
assert('orphan helper does not clear Approved',
  clearCtx.clearStaleLocalGateIfNoCloudRow('station1', clearCtx.gate) === false);

const ssCtx = { state: {}, _operatorBookingNavExplicit: false };
vm.createContext(ssCtx);
vm.runInContext(
  extractFn('bookingKey') + '\n'
  + extractFn('completionPinsPreviousBooking') + '\n'
  + extractFn('shouldClearOperatorProgress'),
  ssCtx
);
ssCtx.state = {
  sessionCompletedAt: '2026-09-23T18:00:00.000Z',
  _completionWriteAsgnId: 'asgnDone',
  _lastSeenActiveAsgnId: 'asgnDone',
};
assert('poll does not clear while wrap-up still pins the last booking',
  ssCtx.shouldClearOperatorProgress('asgnDone|2026-09-23', 'asgnNext|2026-09-23', { explicitUserNav: false }) === false);
assert('a disappeared booking id does not clear',
  ssCtx.shouldClearOperatorProgress('asgnDone|2026-09-23', '', { explicitUserNav: false }) === false);
assert('a swipe does not clear while wrap-up still pins the last booking',
  ssCtx.shouldClearOperatorProgress('asgnDone|2026-09-23', 'asgnNext|2026-09-23', { explicitUserNav: true }) === false);
ssCtx.state = { sessionCompletedAt: null, _completionWriteAsgnId: null, _lastSeenActiveAsgnId: 'asgnA' };
assert('a swipe to a different booking still clears when nothing is pinned',
  ssCtx.shouldClearOperatorProgress('asgnA|2026-09-23', 'asgnB|2026-09-23', { explicitUserNav: true }) === true);
ssCtx.state = { sessionCompletedAt: null, _completionWriteAsgnId: null, _lastSeenActiveAsgnId: 'yest' };
assert('a real booking change with no completion pin still clears',
  ssCtx.shouldClearOperatorProgress('yest|2026-09-22', 'today|2026-09-23', { explicitUserNav: false }) === true);

const scoreCtx = {
  scrubSyncableStateForOpenBooking(s) {
    return { sessionCompletedAt: null, stations: {}, arrivedAt: s && s.arrivedAt };
  },
  sessionStateProgressScore(s) {
    if (s && s.sessionCompletedAt) return 100000;
    if (s && s.stations && Object.keys(s.stations).length) return 80;
    return 0;
  },
};
vm.createContext(scoreCtx);
vm.runInContext(extractFn('scoreAfterScrub'), scoreCtx);
const preScrub = { sessionCompletedAt: '2026-09-23T18:00:00.000Z', stations: { station4: { scenarios: {} } } };
const scored = scoreCtx.scoreAfterScrub(preScrub);
assert('post-scrub score is not the raw completion score', scored.score === 0 && !scored.scrubbed.sessionCompletedAt);

const selfCtx = {
  state: {
    sessionCompletedAt: '2026-09-23T20:00:00.000Z',
    arrivedAt: '2026-09-23T17:00:00.000Z',
    stations: { station1: { scenarios: { '03': { notes: 'on site note', status: 'Uploaded' } } } },
  },
  merged: false,
  scrubSyncableStateForOpenBooking(s) { return Object.assign({}, s || {}); },
  extractSyncableState(st) {
    return {
      sessionCompletedAt: st.sessionCompletedAt,
      stations: st.stations,
      arrivedAt: st.arrivedAt,
    };
  },
  sessionStateProgressScore(s) {
    let n = (s && s.sessionCompletedAt) ? 100000 : 0;
    if (s && s.stations && Object.keys(s.stations).length) n += 40;
    return n;
  },
  mergeTeammateState() { selfCtx.merged = true; selfCtx.state.sessionCompletedAt = null; },
  saveState() {},
};
vm.createContext(selfCtx);
vm.runInContext(extractFn('applySelfSyncReplace'), selfCtx);
const refused = selfCtx.applySelfSyncReplace({ stations: {}, sessionCompletedAt: null, arrivedAt: '' });
assert('empty other-browser row does not wipe local Done',
  refused === false
  && selfCtx.merged === false
  && selfCtx.state.sessionCompletedAt === '2026-09-23T20:00:00.000Z');

if (failed) {
  console.error(failed + ' critical client checks failed');
  process.exit(1);
}
console.log('All critical client checks passed');
