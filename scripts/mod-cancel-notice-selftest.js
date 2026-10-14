#!/usr/bin/env node
'use strict';

/**
 * A session on the moderator's checklist cancelled by Admin or a teammate
 * shows one message per session; their own Confirm Cancel does not.
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


console.log('Moderator notice for a session cancelled elsewhere');

function run(comment, me) {
  const alerts = [];
  const store = {};
  const asgn = { id: 'asgn_1', status: 'Cancelled', comment, date: '2026-10-14', participantData: { firstName: 'Pat', lastName: 'Q' } };
  const ctx = {
    console, JSON, String, Array, Set, Date, RegExp,
    state: { modProfile: { orbitLoginId: me || 'Muhammad-tw' } },
    adminState: { assignments: [asgn] },
    localStorage: { getItem: k => store[k] || null, setItem: (k, v) => { store[k] = v; } },
    appAlert: o => { alerts.push(o); return Promise.resolve(true); },
    parseYMD: () => null,
    assignmentCommentPlainForMarker: c => String(c || ''),
    getOperatorTeammateFirstName: id => id,
  };
  vm.createContext(ctx);
  vm.runInContext('const MOD_SEEN_CANCEL_KEY = "k";\n' + ['modCancelNoticeBy', 'notifyModOfCancelledSessions'].map(extractFn).join('\n'), ctx);
  const first = ctx.notifyModOfCancelledSessions([{ id: 'asgn_1' }]);
  const second = ctx.notifyModOfCancelledSessions([{ id: 'asgn_1' }]);
  return { alerts, first, second };
}

const admin = run('participant sick');
assert('admin cancel tells the moderator once',
  admin.alerts.length === 1 && /cancelled by the Twilight team/.test(admin.alerts[0].message) && admin.second.length === 0,
  JSON.stringify(admin.alerts));
const mate = run('mod-cancel-session:sravya-tw:2026-10-14T18:05:00Z');
assert('teammate cancel names the teammate',
  mate.alerts.length === 1 && /cancelled by Sravya\./.test(mate.alerts[0].message), JSON.stringify(mate.alerts));
const self = run('mod-cancel-session:muhammad-tw:2026-10-14T18:05:00Z');
assert('own checklist cancel shows no second message', self.alerts.length === 0);

if (failed) { console.log('FAILED ' + failed); process.exit(1); }
console.log('All checks passed');
