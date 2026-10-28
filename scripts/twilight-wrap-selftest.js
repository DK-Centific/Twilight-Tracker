#!/usr/bin/env node
/* Self-test: Twilight Wrap (1.3.102826a, logo 1.3.102826b).
 * The Wrap opens once per login ID after sign-in (moderator → own Wrap,
 * admin → deck, reviewer → never), the glowing header logo replays it, and
 * its published data holds counts only.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');

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

console.log('Twilight Wrap self-test');

const fnSrc = (src.match(/const TWILIGHT_WRAP_SEEN_PREFIX[\s\S]*?\nfunction maybeOpenTwilightWrap\(\) \{[\s\S]*?\n\}\n/) || [''])[0];
assert('maybeOpenTwilightWrap exists', !!fnSrc);
assert('called after every sign-in path (4)', (src.match(/\n\s*maybeOpenTwilightWrap\(\);/g) || []).length === 4);

function run(st, store) {
  const ctx = {
    state: st,
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = v; } },
    location: { went: null, assign(u) { this.went = u; } },
  };
  vm.runInNewContext(fnSrc + '\nmaybeOpenTwilightWrap();', ctx);
  return ctx.location.went;
}

const store = {};
assert('moderator opens own Wrap', run({ username: 'Venkata-tw' }, store) === 'wrap/?mod=Venkata');
assert('moderator sees it only once', run({ username: 'Venkata-tw' }, store) === null);
assert('admin opens the deck', run({ username: 'Admin-Twilight', isAdmin: true }, store) === 'wrap/');
assert('reviewer never opens it', run({ username: 'Centific-Reviewer1', isReviewer: true }, store) === null);

const logoSrc = (src.match(/function wireTwilightWrapLogo\(\) \{[\s\S]*?\n\}\n/) || [''])[0];
assert('wireTwilightWrapLogo exists', !!logoSrc);
{
  const listeners = [];
  const mark = { classList: { contains: c => c === 'brand-mark', add() { this.added = true; } }, setAttribute() {} };
  const ctx = {
    state: { username: 'Amy-tw' },
    location: { went: null, assign(u) { this.went = u; } },
    document: {
      querySelectorAll: () => [mark],
      addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture }),
    },
  };
  vm.runInNewContext(fnSrc + logoSrc + '\nwireTwilightWrapLogo(); wireTwilightWrapLogo();', ctx);
  assert('logo click listener wired once, in capture', listeners.length === 1 && listeners[0].capture === true);
  assert('logo mark gets the glow', mark.classList.added === true);
  let stopped = false;
  const ev = { target: { closest: () => mark }, preventDefault() {}, stopImmediatePropagation() { stopped = true; } };
  listeners[0].fn(ev);
  assert('logo click plays the moderator Wrap', ctx.location.went === 'wrap/?mod=Amy');
  assert('logo click stops the Home handler', stopped);
  ctx.state = { username: 'Admin-Twilight', isAdmin: true };
  listeners[0].fn(ev);
  assert('admin logo click plays the deck', ctx.location.went === 'wrap/');
}

const data = fs.readFileSync(path.join(root, 'wrap', 'data', 'wrap-data.json'), 'utf8');
assert('wrap data has no email addresses', !/[\w.+-]+@[\w-]+\.[\w.]+/.test(data));
assert('wrap data has no phone numbers', !/\+?1?\d{10}\b/.test(data));
assert('wrap data has no street addresses', !/\b\d{2,6}\s+(?:[NSEW]{1,2}\s+)?\w+\s+(?:St|Ave|Pl|Way|Dr|Ct|Rd|Blvd|Ln)\b/i.test(data));
const parsed = JSON.parse(data);
assert('homes count matches its list', parsed.homes.count === parsed.homes.list.length);
assert('weekly sessions add up to completed', parsed.sessions.perWeek.reduce((a, w) => a + w.completed, 0) === parsed.qa.status.completed);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
