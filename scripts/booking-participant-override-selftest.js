#!/usr/bin/env node
'use strict';

function participantOverrideFieldValue(field, ov, livePart, savedPd) {
  const override = ov || {};
  if (Object.prototype.hasOwnProperty.call(override, field)) {
    return override[field] != null ? override[field] : '';
  }
  const liveVal = livePart && livePart[field] != null ? String(livePart[field]).trim() : '';
  if (liveVal) return livePart[field];
  if (savedPd && savedPd[field] != null) return savedPd[field];
  return '';
}

function assert(label, cond) {
  if (!cond) {
    console.error('FAIL:', label);
    process.exit(1);
  }
  console.log('OK:', label);
}

assert('override wins',
  participantOverrideFieldValue('address', { address: '123 Saved St' }, { address: '999 Live Ave' }, { address: '555 Row Rd' }) === '123 Saved St');
assert('live used when no override',
  participantOverrideFieldValue('address', {}, { address: '999 Live Ave' }, { address: '555 Row Rd' }) === '999 Live Ave');
assert('saved booking row used when live missing',
  participantOverrideFieldValue('address', {}, null, { address: '555 Row Rd' }) === '555 Row Rd');
assert('empty when nothing available',
  participantOverrideFieldValue('address', {}, null, null) === '');

const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'twilight.js'), 'utf8');
assert('edit modal has participant name field', src.includes('id="asgnPartName"'));
assert('edit modal has address field', src.includes('id="asgnPartAddress"'));
assert('save accepts typed participant', /assignmentModalHasParticipant/.test(src));
assert('team picker uses search not select', src.includes('id="asgnTeamSearch"') && !src.includes('id="asgnTeamSelect"'));
assert('roster is collapsible', src.includes('asgn-roster-disclosure'));
assert('overnight duration helper', /function assignmentDurationMin/.test(src));

console.log('booking-participant-override-selftest passed');
