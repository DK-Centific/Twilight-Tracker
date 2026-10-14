#!/usr/bin/env node
'use strict';

/**
 * Admin booking Cancel: busy Power Automate answers (429 / 5xx) are
 * retried per row; other errors are reported at once, not retried.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');

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


console.log('Admin booking cancel retry self-test');

function run(responses) {
  const calls = [];
  const asgn = { id: 'asgn_1', status: 'Booked', modSnapshots: [{ orbitLoginId: 'a' }, { orbitLoginId: 'b' }] };
  const ctx = {
    console: { log() {}, warn() {} }, JSON, String, Promise, Date,
    setTimeout(fn) { fn(); return 0; },
    ASSIGNMENT_PA_WRITE_URL: 'https://assignment.test',
    adminState: { assignments: [asgn] },
    saveAssignmentData() {},
    terminalLockUntil() { return '2099-01-01T00:00:00.000Z'; },
    buildAssignmentExcelRow(a) { return a.modSnapshots.map(m => ({ assignmentId: a.id, orbitLoginId: m.orbitLoginId, status: a.status })); },
    fetch(url, o) {
      calls.push(JSON.parse(o.body));
      const st = responses.length ? responses.shift() : 202;
      return Promise.resolve({ ok: st >= 200 && st < 300, status: st, text: () => Promise.resolve('') });
    },
  };
  vm.createContext(ctx);
  vm.runInContext(['postAssignmentRowWithRetry', 'cancelAssignmentSilent'].map(extractFn).join('\n'), ctx);
  return ctx.cancelAssignmentSilent('asgn_1', 'participant sick').then(res => ({ res, calls, asgn: ctx.adminState.assignments[0] }));
}

(async () => {
  const ok = await run([202, 502, 429, 202]);
  assert('busy answers on the second row are retried until it lands',
    ok.res.ok === true && ok.calls.length === 4 && ok.calls.every(c => c.status === 'Cancelled'),
    JSON.stringify(ok.res) + ' calls=' + ok.calls.length);
  assert('the booking is Cancelled on this device', ok.asgn.status === 'Cancelled' && ok.asgn.comment === 'participant sick');

  const bad = await run([400]);
  assert('a 400 is reported and not retried',
    bad.res.ok === false && bad.res.error === 'HTTP 400' && bad.calls.length === 2,
    JSON.stringify(bad.res) + ' calls=' + bad.calls.length);

  const down = await run([503, 503, 503, 503, 202]);
  assert('a row that stays busy after 4 tries is reported',
    down.res.ok === false && down.res.error === 'HTTP 503' && down.calls.length === 5,
    JSON.stringify(down.res) + ' calls=' + down.calls.length);

  if (failed) { console.log('FAILED ' + failed); process.exit(1); }
  console.log('All checks passed');
})().catch(e => { console.log('FAIL threw ' + (e && e.stack)); process.exit(1); });
