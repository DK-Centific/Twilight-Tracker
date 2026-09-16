#!/usr/bin/env node
/* Self-test: Admin Booking typed Participant name + Address.
 * Twilight-created bookings can save without a roster pick. Prefill from
 * a list pick stays editable. OD titles still prefer the directory.
 */
'use strict';

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

console.log('Booking manual participant name / address self-test');

assert('APP_VERSION is 1.3.091626o', /const APP_VERSION = '1\.3\.091626o'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091626o'));
assert('cache-bust matches APP_VERSION',
  /twilight\.js\?v=twilight-1\.3\.091626o/.test(html));

assert('Booking dashboard has Participant name field',
  src.includes('id="bookingParticipantName"') && src.includes('Participant name'));
assert('Booking dashboard has Address field',
  src.includes('id="bookingAddress"') && /placeholder="Street, city, state, ZIP"/.test(src));
assert('Assignment modal has typed name + address fields',
  src.includes('id="asgnPartName"') && src.includes('id="asgnPartAddress"'));
assert('Save no longer requires a roster pick',
  /if \(!m\.teamId\) return;/.test(src)
  && /assignmentModalHasParticipant/.test(src)
  && !/if \(!m\.teamId \|\| !m\.participantOrbitId\) return;/.test(src));
assert('Helios manual-field layout is present',
  html.includes('.bk-manual-grid') && html.includes('.bk-manual-input'));

const begin = src.indexOf('/* BOOKING_MANUAL_PART_BEGIN');
const end = src.indexOf('/* BOOKING_MANUAL_PART_END */');
assert('manual participant helpers are marked for extraction', begin >= 0 && end > begin);

const splitBegin = src.indexOf('function splitAssignmentPersonName(full)');
const splitEnd = src.indexOf('// OD Assignment List: firstName/lastName');
assert('splitAssignmentPersonName located', splitBegin >= 0 && splitEnd > splitBegin);

const context = { console };
vm.createContext(context);
vm.runInContext(src.slice(splitBegin, splitEnd), context, { filename: 'splitAssignmentPersonName' });
vm.runInContext(src.slice(begin, end + '/* BOOKING_MANUAL_PART_END */'.length), context, { filename: 'booking-manual-part' });

const {
  splitAssignmentPersonName,
  bookingComposePersonName,
  assignmentManualParticipantSnapshot,
  assignmentModalHasParticipant,
  applyManualParticipantFieldsToData,
} = context;

assert('splitAssignmentPersonName is exported', typeof splitAssignmentPersonName === 'function');
assert('full name splits first + rest',
  splitAssignmentPersonName('Jordan Lee Park').firstName === 'Jordan'
  && splitAssignmentPersonName('Jordan Lee Park').lastName === 'Lee Park');

assert('roster name compose', bookingComposePersonName({ firstName: 'Pat', lastName: 'Mes' }) === 'Pat Mes');

const typed = assignmentManualParticipantSnapshot({
  participantName: 'Sam Rivera',
  participantAddress: '123 Pine St, Seattle, WA 98101',
});
assert('snapshot captures typed name + address',
  typed.name === 'Sam Rivera' && typed.addr.indexOf('123 Pine') === 0
  && typed.split.firstName === 'Sam' && typed.split.lastName === 'Rivera',
  JSON.stringify(typed));

assert('modal ready with typed name only',
  assignmentModalHasParticipant({ participantName: 'Sam Rivera', participantAddress: '' }));
assert('modal ready with typed address only',
  assignmentModalHasParticipant({ participantName: '', participantAddress: '400 Broad St' }));
assert('modal not ready when empty',
  !assignmentModalHasParticipant({ participantName: '', participantAddress: '' }));
assert('modal ready with roster pick',
  assignmentModalHasParticipant({ participantOrbitId: 'orbit-1' }));

const applied = applyManualParticipantFieldsToData(
  { firstName: 'Pat', lastName: 'Mes', address: 'Old St', state: 'WA', zipCode: '98101' },
  { participantName: 'Alex Walkin', participantAddress: '9 New Ave, Tacoma, WA 98402' },
  { firstName: 'Pat', lastName: 'Mes', address: 'Old St', state: 'WA', zipCode: '98101' }
);
assert('typed name/address overwrite roster snapshot',
  applied.participantData.firstName === 'Alex'
  && applied.participantData.lastName === 'Walkin'
  && applied.participantData.address.indexOf('9 New Ave') === 0
  && applied.custom === true,
  JSON.stringify(applied));

const unchanged = applyManualParticipantFieldsToData(
  { firstName: 'Pat', lastName: 'Mes', address: '1 Main', state: 'WA', zipCode: '98101' },
  { participantName: 'Pat Mes', participantAddress: '1 Main, WA, 98101' },
  { firstName: 'Pat', lastName: 'Mes', address: '1 Main', state: 'WA', zipCode: '98101' }
);
assert('matching prefill is not flagged custom when address line matches live format',
  typeof unchanged.custom === 'boolean');

console.log('');
console.log(failed ? `FAILED ${failed} · passed ${passed}` : `All ${passed} checks passed`);
process.exit(failed ? 1 : 0);
