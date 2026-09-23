#!/usr/bin/env node
/* Week Booking · Sessions this day scrolls after three cards.
 * The week page locks overflow while Assign a team is open. The session
 * list must cap near three rows and keep overflow-y: auto so a fourth
 * card scrolls inside the section. Month keeps the taller 52vh cap.
 */
'use strict';

const fs = require('fs');
const path = require('path');

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

console.log('Booking week Sessions scroll self-test');

const weekStart = html.indexOf('.bk-dash-grid.is-week .bk-session-list {');
const weekEnd = html.indexOf('.bk-session-card {', weekStart);
const weekRule = weekStart >= 0 && weekEnd > weekStart
  ? html.slice(weekStart, weekEnd)
  : '';

assert('week session list rule exists', weekRule.length > 0);
assert(
  'week list caps at about three session rows',
  /max-height:\s*calc\(\s*\(3 \* var\(--bk-session-row\)\)\s*\+\s*\(2 \* var\(--bk-session-gap\)\)\s*\)/.test(weekRule)
);
assert('week list scrolls on the y axis', /overflow-y:\s*auto/.test(weekRule));
assert(
  'week list is not allowed to squash to zero height',
  /flex-shrink:\s*0/.test(weekRule)
);
assert(
  'week session scrollbar stays visible',
  /scrollbar-width:\s*thin/.test(weekRule) && !/scrollbar-width:\s*none/.test(weekRule)
);
assert(
  'session cards do not squash inside the week list',
  /\.bk-dash-grid\.is-week \.bk-session-list > \.bk-session-card \{\s*flex-shrink:\s*0;/.test(html)
);
assert(
  'short landscape phones cap the same week list to the visible area',
  /@media \(max-height:\s*500px\) \{\s*\.bk-dash-grid\.is-week \.bk-session-list \{\s*max-height:\s*min\(34vh,/.test(html)
);

const sharedStart = html.indexOf('.bk-session-list {');
const sharedEnd = html.indexOf('.bk-dash-grid.is-week .bk-session-list {');
const sharedRule = sharedStart >= 0 && sharedEnd > sharedStart
  ? html.slice(sharedStart, sharedEnd)
  : '';
assert(
  'month and other views keep the taller session list cap',
  /max-height:\s*min\(52vh,\s*540px\)/.test(sharedRule)
);
assert(
  'three-row cap is not on the shared session list',
  !/3 \* var\(--bk-session-row\)/.test(sharedRule)
);
assert(
  'month team list is not given the session three-row cap',
  !/\.bk-dash-grid\.is-month \.bk-session-list \{[^}]*3 \* var\(--bk-session-row\)/.test(html)
);

const lockStart = html.indexOf('body.booking-week-assign-open');
const lockSlice = lockStart >= 0 ? html.slice(lockStart, lockStart + 1800) : '';
assert(
  'week assign open keeps the app behind the sheet from scrolling',
  /body\.booking-week-assign-open \{\s*overflow:\s*hidden/.test(lockSlice)
);
assert(
  'week booking sheet still scrolls so the session list is reachable',
  /#bookingPage\.is-week-assign-open \.booking-page-body[\s\S]{0,280}overflow-y:\s*auto/.test(lockSlice)
);

assert(
  'sessions markup is the week list under the day title',
  /id="bookingSessionsTitle"/.test(src)
    && /<div class="bk-session-list">/.test(src)
    && /function bookingSessionsTitle\(/.test(src)
);

assert(
  'APP_VERSION is 1.3.091822c',
  /const APP_VERSION = '1\.3\.091822c'/.test(src)
    && html.includes('twilight.js?v=twilight-1.3.091822c')
);

console.log(passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
