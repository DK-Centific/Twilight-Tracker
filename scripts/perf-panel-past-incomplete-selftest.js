#!/usr/bin/env node
'use strict';

/**
 * Admin Performance panel · past incomplete session (1.3.091825c).
 *
 * Amanda W Li · Venkata × Jashit · Sep 24 7 PM–2 AM PT.
 * One co-mod is station_2_done (S1 18/18, S2 14/14, S3 3/8, S4 0/4,
 * arrived, no sessionCompletedAt). The other co-mod is blank / Not Started
 * and newer. Booked end has passed, so classify stays scheduled, but the
 * panel must show the richer station list — not "hasn't started".
 * The mini pill can still say In session · St 2.
 * Does not stamp session_done or change Live / Next / Done buckets.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function extractFn(name) {
  const start = src.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let i = start, depth = 0, begun = false;
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

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

console.log('Performance panel past-incomplete self-test (1.3.091825c)');

assert('APP_VERSION 1.3.091825c',
  /const APP_VERSION = '1\.3\.091825c'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091825c'));

assert('panel gate is not cls === scheduled alone',
  /function perfPanelStationDetailHTML\(/.test(src)
  && /function perfPanelSessionHasStarted\(/.test(src)
  && /perfPanelStationDetailHTML\(a, cls\)/.test(src)
  && !/if \(cls === 'scheduled'\)/.test(src));

const AMANDA_ID = 'od_8d6bedbf-5b81-4779-b828-38d02d6840a4';

function scenarioMap(done, total) {
  const scenarios = {};
  for (let i = 1; i <= total; i++) {
    const id = String(i).padStart(2, '0');
    scenarios[id] = {
      status: i <= done ? 'Uploaded' : 'Not Started',
      notes: '',
      iterations: 0,
    };
  }
  return { cameras: {}, scenarios };
}

const richState = {
  sessionStatus: 'station_2_done',
  arrivedAt: '2026-09-25T03:10:00.000Z',
  score: 35,
  stations: {
    station1: scenarioMap(18, 18),
    station2: scenarioMap(14, 14),
    station3: scenarioMap(3, 8),
    station4: scenarioMap(0, 4),
  },
  stationCompletedAt: {
    station1: '2026-09-25T04:00:00.000Z',
    station2: '2026-09-25T05:30:00.000Z',
  },
};

const blankState = {
  sessionStatus: 'Not Started',
  stations: {
    station1: scenarioMap(0, 18),
    station2: scenarioMap(0, 14),
    station3: scenarioMap(0, 8),
    station4: scenarioMap(0, 4),
  },
};

const amanda = {
  id: AMANDA_ID,
  teamId: 'venkata-jashit',
  teamName: 'Venkata × Jashit',
  date: '2026-09-24',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Booked',
  odStatus: 'Scheduled',
  participantData: {
    firstName: 'Amanda',
    lastName: 'W Li',
    address: 'Sammamish',
  },
  modSnapshots: [
    { orbitLoginId: 'venkata-tw' },
    { orbitLoginId: 'jashit-tw' },
  ],
};

const neverStarted = {
  id: 'od_never_started',
  teamId: 'venkata-jashit',
  teamName: 'Venkata × Jashit',
  date: '2026-09-26',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Booked',
  odStatus: 'Scheduled',
  participantData: { firstName: 'Future', lastName: 'Guest' },
};

const arrivedOnly = {
  id: 'od_arrived_only',
  teamId: 'venkata-jashit',
  teamName: 'Venkata × Jashit',
  date: '2026-09-24',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Booked',
  participantData: { firstName: 'Checked', lastName: 'In' },
};

const geoOnly = {
  id: 'od_geo_only',
  teamId: 'venkata-jashit',
  teamName: 'Venkata × Jashit',
  date: '2026-09-24',
  startMin: 19 * 60,
  endMin: 2 * 60,
  status: 'Booked',
  participantData: { firstName: 'Geo', lastName: 'Only' },
};

const liveById = {};
function setLive(id, status) {
  if (!status) delete liveById[id];
  else liveById[id] = {
    assignmentId: id,
    status,
    lastActive: '2026-09-25T05:40:00.000Z',
    timestamp: '2026-09-25T05:40:00.000Z',
    moderatorName: 'Venkata',
    moderatorMatch: true,
  };
}
setLive(AMANDA_ID, 'station_2_done');
setLive(arrivedOnly.id, 'arrived');

const ctx = {
  console,
  Date,
  String,
  Object,
  Array,
  Set,
  adminState: {
    assignments: [amanda, neverStarted, arrivedOnly, geoOnly],
    teams: [{ id: 'venkata-jashit', name: 'Venkata × Jashit', primaryIds: ['venkata-tw', 'jashit-tw'] }],
    perfSessionStateRows: [
      {
        sessionStateId: 'ss_' + AMANDA_ID + '_jashit',
        assignmentId: AMANDA_ID,
        orbitLoginId: 'jashit-tw',
        sessionStatus: 'Not Started',
        lastActive: '2026-09-25T06:10:00.000Z',
        stateJson: JSON.stringify(blankState),
      },
      {
        sessionStateId: 'ss_' + AMANDA_ID + '_venkata',
        assignmentId: AMANDA_ID,
        orbitLoginId: 'venkata-tw',
        sessionStatus: 'station_2_done',
        lastActive: '2026-09-25T05:40:00.000Z',
        stateJson: JSON.stringify(richState),
      },
      {
        sessionStateId: 'ss_geo_presence_venkata',
        assignmentId: AMANDA_ID,
        orbitLoginId: 'venkata-tw',
        sessionStatus: '',
        lastActive: '2026-09-25T06:20:00.000Z',
        stateJson: JSON.stringify({ stations: { station3: scenarioMap(0, 8) }, lastGeo: { lat: 1, lng: 2 } }),
      },
      {
        sessionStateId: 'ss_geo_presence_only',
        assignmentId: geoOnly.id,
        orbitLoginId: 'venkata-tw',
        lastActive: '2026-09-25T06:00:00.000Z',
        stateJson: JSON.stringify({ stations: { station1: scenarioMap(18, 18) } }),
      },
      {
        sessionStateId: 'ss_' + arrivedOnly.id + '_venkata',
        assignmentId: arrivedOnly.id,
        orbitLoginId: 'venkata-tw',
        sessionStatus: 'arrived',
        lastActive: '2026-09-25T03:15:00.000Z',
        stateJson: JSON.stringify({ arrivedAt: '2026-09-25T03:15:00.000Z', sessionStatus: 'arrived' }),
      },
    ],
  },
  STATIONS: [
    { key: 'station1', label: 'Station 1' },
    { key: 'station2', label: 'Station 2' },
    { key: 'station3', label: 'Station 3' },
    { key: 'station4', label: 'Station 4' },
  ],
  statusOrderIdx: s => ({
    office_checkin: 0,
    arrived: 1,
    station_1_done: 5,
    station_2_done: 6,
    station_3_done: 7,
    station_4_done: 8,
    session_done: 9,
    office_checkout: 10,
  }[s] ?? -1),
  isScenarioDoneForStation(sc) {
    return !!(sc && sc.status === 'Uploaded');
  },
  isScenarioComplete(sc) {
    return ctx.isScenarioDoneForStation(sc);
  },
  getLatestStatusForAssignment(id) {
    return liveById[id] || null;
  },
  isPastAssignmentSessionEnd() { return true; },
  assignmentInPerfLiveWindow() { return false; },
  isAssignmentTeamHappypathComplete() { return false; },
  perfAssignmentHasRecentGeoActivity() { return false; },
  PERF_STATUS_STATION_SHORT: {
    station_1_done: 'St 1',
    station_2_done: 'St 2',
    station_3_done: 'St 3',
    station_4_done: 'St 4',
  },
};

vm.createContext(ctx);
vm.runInContext([
  'escapeHTML',
  'assignmentIdsMatch',
  'isGeoPresenceOrRemoteAssignmentId',
  'isGeoPresenceOrRemoteSessionStateRow',
  'parseSessionStateJson',
  'sessionStateRowMatchesAssignment',
  'sessionStateRowsForAssignment',
  'scenarioProgressRank',
  'pickBetterScenario',
  'stationMapProgressScore',
  'mergeStationMapsPreferRicher',
  'assignmentPerfSessionStarted',
  'classifyBookingForPerf',
  'perfLiveStatusDisplay',
  'perfLiveStatusIsPartialProgress',
  'perfNonGeoSessionRowHasStartedWork',
  'perfPanelSessionHasStarted',
  'renderPerfStationListHTML',
  'perfPanelStationDetailHTML',
].map(extractFn).join('\n'), ctx);

const EMPTY = "Session hasn't started yet";
const panel = ctx.perfPanelStationDetailHTML(amanda);
const pill = ctx.perfLiveStatusDisplay(amanda);

assert('Amanda classifies scheduled (past incomplete stays Next)',
  ctx.classifyBookingForPerf(amanda) === 'scheduled',
  ctx.classifyBookingForPerf(amanda));
assert('mini pill still In session · St 2',
  pill && pill.label === 'In session · St 2',
  pill && pill.label);
assert('panel gate says the session started',
  ctx.perfPanelSessionHasStarted(amanda) === true);
assert('panel HTML is not the empty hasn\'t-started copy',
  panel.indexOf(EMPTY) === -1);
assert('panel shows S1 18/18', panel.includes('Station 1') && panel.includes('18/18 complete'));
assert('panel shows S2 14/14', panel.includes('Station 2') && panel.includes('14/14 complete'));
assert('panel shows partial S3 3/8', panel.includes('Station 3') && panel.includes('3/8 complete'));
assert('panel still lists S4', panel.includes('Station 4'));
assert('richer co-mod wins over newer blank map',
  panel.includes('18/18 complete') && !panel.includes('0/18 complete'));

assert('never-started booking keeps the empty copy',
  ctx.classifyBookingForPerf(neverStarted) === 'scheduled'
  && ctx.perfPanelSessionHasStarted(neverStarted) === false
  && ctx.perfPanelStationDetailHTML(neverStarted).includes(EMPTY));

assert('past end + arrived is not "hasn\'t started"',
  ctx.classifyBookingForPerf(arrivedOnly) === 'scheduled'
  && ctx.perfPanelSessionHasStarted(arrivedOnly) === true
  && ctx.perfPanelStationDetailHTML(arrivedOnly).indexOf(EMPTY) === -1);

assert('geo-only row does not count as started',
  ctx.perfPanelSessionHasStarted(geoOnly) === false
  && ctx.perfPanelStationDetailHTML(geoOnly).includes(EMPTY));

setLive(AMANDA_ID, null);
assert('station maps open the panel even when live status is blank',
  ctx.assignmentPerfSessionStarted(amanda) === false
  && ctx.perfPanelSessionHasStarted(amanda) === true
  && ctx.perfPanelStationDetailHTML(amanda).includes('3/8 complete')
  && ctx.perfPanelStationDetailHTML(amanda).indexOf(EMPTY) === -1);

if (failed) {
  console.error(failed + ' perf panel past-incomplete checks failed');
  process.exit(1);
}
console.log('All perf panel past-incomplete checks passed');
