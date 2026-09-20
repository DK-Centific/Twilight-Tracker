#!/usr/bin/env node
'use strict';
/**
 * 1.3.091820w — session_done lands on assignment SS; flag treats
 * session_done / station_4_done as complete; Admin scrub preserves
 * sessionCompletedAt on prior bookings.
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

console.log('Session-done flag clear self-test (1.3.091820w)');

assert('APP_VERSION 1.3.091820w',
  /const APP_VERSION = '1\.3\.091820w'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091820w'));

assert('completion write pin + resolveCompletionWriteAssignment',
  /_completionWriteAsgnId/.test(src)
  && /function resolveCompletionWriteAssignment/.test(src)
  && /function lookupAssignmentByIdForSessionWrite/.test(src)
  && /geo_presence_\* and Admin never sees Completed/.test(src));

assert('wrap-up pins assignment before flush',
  /state\._completionWriteAsgnId = String\(asgn\.id\)/.test(src)
  && /completionAssignment: asgn/.test(src)
  && /state\.sessionStatus = 'session_done'/.test(src));

assert('flag gate: session_done OR station_4_done',
  /function isAssignmentCompleteForStrike/.test(src)
  && /liveStatus === 'session_done'/.test(src)
  && /liveStatus === 'station_4_done'/.test(src)
  && /function assignmentLiveStatusForStrike/.test(src));

assert('classifyBookingForPerf past-end station_4_done',
  /pastEnd && live && \(live\.status === 'station_4_done'/.test(src));

assert('Admin scrub preserveSessionCompletion',
  /preserveSessionCompletion:\s*true/.test(src)
  && /function sessionCompletionStampBelongsToBooking/.test(src)
  && /preserveSessionCompletion is set/.test(src));

// Runtime: extract helpers into a sandbox
const extract = (names) => {
  const start = src.indexOf('function sessionStateStampOnOrAfterBooking');
  const end = src.indexOf('function resolveOpenBookingYmdForScrub');
  const block = src.slice(
    src.indexOf('function pstYmdFromTimestamp'),
    end
  );
  // Also need addDaysToYmd + helpers used by scrub — stub minimal sandbox
  const sandbox = {
    console,
    Date,
    Intl,
    Object,
    String,
    Array,
    Number,
    parseLastActiveMs: (v) => {
      const t = Date.parse(v);
      return Number.isFinite(t) ? t : 0;
    },
    addDaysToYmd: (ymd, n) => {
      const [y, m, d] = String(ymd).split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d + n));
      return dt.toISOString().slice(0, 10);
    },
  };
  // Pull specific functions by eval of their source ranges
  const fnNames = [
    'pstYmdFromTimestamp',
    'sessionStateStampOnOrAfterBooking',
    'sessionStateProgressForeignToBooking',
    'sessionCompletionStampBelongsToBooking',
    'scrubSessionStateProgressToBooking',
  ];
  for (const name of fnNames) {
    const re = new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}\\n');
    // Prefer from sessionCompletion for new fn; fall back broader
  }
  // Simpler: eval a curated slice
  const sliceStart = src.indexOf('function pstYmdFromTimestamp');
  const sliceEnd = src.indexOf('// Moderator Booking/Session policy:');
  const code = src.slice(sliceStart, sliceEnd);
  vm.runInNewContext(code, sandbox, { timeout: 5000 });
  return sandbox;
};

let sb;
try {
  sb = extract();
} catch (e) {
  assert('sandbox extract scrub helpers', false, String(e && e.message || e));
  sb = null;
}

if (sb && typeof sb.scrubSessionStateProgressToBooking === 'function') {
  const booked = '2026-09-18';
  const done = {
    sessionDate: '2026-09-18',
    sessionStatus: 'session_done',
    sessionCompletedAt: '2026-09-19T08:19:20.623Z',
    stationCompletedAt: {
      station1: '2026-09-19T05:55:33.908Z',
      station2: '2026-09-19T05:56:30.065Z',
    },
    stations: { station1: { scenarios: {} } },
  };
  const preserved = sb.scrubSessionStateProgressToBooking(done, booked, {
    preserveSessionCompletion: true,
  });
  assert('preserve overnight sessionCompletedAt for Admin',
    preserved && preserved.sessionCompletedAt === done.sessionCompletedAt
    && preserved.sessionStatus === 'session_done',
    JSON.stringify(preserved && {
      sessionCompletedAt: preserved.sessionCompletedAt,
      sessionStatus: preserved.sessionStatus,
    }));

  const wiped = sb.scrubSessionStateProgressToBooking(done, '2026-09-19', {
    preserveSessionCompletion: false,
  });
  // Foreign to Sep 19 open booking (stations/completion from Sep 18 session
  // ending morning Sep 19 may still be on-or-after 09-19). Use clearly prior:
  const prior = {
    sessionDate: '2026-09-17',
    sessionStatus: 'session_done',
    sessionCompletedAt: '2026-09-17T11:00:00.000Z',
    stationCompletedAt: { station1: '2026-09-17T08:00:00.000Z' },
    stations: {},
  };
  const openScrub = sb.scrubSessionStateProgressToBooking(prior, '2026-09-19', {});
  assert('open-booking scrub still clears foreign prior completion',
    openScrub && !openScrub.sessionCompletedAt,
    JSON.stringify(openScrub && {
      sessionCompletedAt: openScrub.sessionCompletedAt,
      sessionStatus: openScrub.sessionStatus,
    }));

  const priorKept = sb.scrubSessionStateProgressToBooking(prior, '2026-09-17', {
    preserveSessionCompletion: true,
  });
  assert('preserve keeps same-booking completion',
    priorKept && priorKept.sessionCompletedAt === prior.sessionCompletedAt);
} else {
  assert('sandbox extract scrub helpers', false, 'missing scrubSessionStateProgressToBooking');
}

// resolveSessionStateWriteTarget still honors persistCompletion
{
  const re = /function resolveSessionStateWriteTarget\([\s\S]*?\n\}\n/;
  const m = src.match(re);
  assert('resolveSessionStateWriteTarget present', !!m);
  if (m) {
    const sandbox = {};
    vm.runInNewContext(m[0], sandbox);
    const fn = sandbox.resolveSessionStateWriteTarget;
    const wrap = fn({
      orbitLoginId: 'Narendra-tw',
      sessionCompletedAt: '2026-09-19T08:19:20.623Z',
      openAssignmentId: 'od_e3dc4442',
      teamId: '100098',
      hasLastGeo: true,
      persistCompletion: true,
      day: '2026-09-19',
    });
    assert('persistCompletion writes assignment not geo_presence',
      wrap && wrap.kind === 'assignment' && wrap.id === 'od_e3dc4442');
    const after = fn({
      orbitLoginId: 'Narendra-tw',
      sessionCompletedAt: '2026-09-19T08:19:20.623Z',
      openAssignmentId: 'od_e3dc4442',
      teamId: '100098',
      hasLastGeo: true,
      persistCompletion: false,
      day: '2026-09-19',
    });
    assert('without persistCompletion completed → presence',
      after && after.kind === 'presence');
  }
}

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
