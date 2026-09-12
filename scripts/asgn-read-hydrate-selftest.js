#!/usr/bin/env node
/* Self-test: Assignment READ → participantData hydrate.
 * PA stores address / participantEmail / phonenumber (aliased from
 * phonenumber0). Twilight must map those into participantData.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcPath = path.join(__dirname, '..', 'twilight.js');
const src = fs.readFileSync(srcPath, 'utf8');
const begin = src.indexOf('/* ASGN_READ_HYDRATE_BEGIN');
const end = src.indexOf('/* ASGN_READ_HYDRATE_END */');
if (begin < 0 || end < 0 || end <= begin) {
  console.error('Could not find ASGN_READ_HYDRATE markers in twilight.js');
  process.exit(1);
}

const pickBegin = src.indexOf('function pickField(obj, ...candidates)');
const pickEnd = src.indexOf('/* ASGN_READ_HYDRATE_BEGIN');
if (pickBegin < 0 || pickEnd <= pickBegin) {
  console.error('Could not find pickField for hydrate test');
  process.exit(1);
}

const context = { console };
vm.createContext(context);
vm.runInContext(src.slice(pickBegin, pickEnd), context);
vm.runInContext(src.slice(begin, end), context);

const {
  flattenAssignmentReadRow,
  assignmentParticipantFieldsFromRecord,
  assignmentParticipantPhoneFromRecord,
  assignmentTeamNameFromRecord,
  mergeParticipantDataPreferFilled,
} = context;

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

console.log('Assignment READ hydrate self-test');

const c408 = {
  assignmentId: 'c408fa07',
  team: 'Alex x Blair',
  teamId: 12,
  assignedTo: 'Pat Mes',
  address: '322 Pasco Mes NE 98059, Seattle, Washington',
  participantEmail: 'pat@example.com',
  phonenumber: '206-555-0199',
  participantState: 'Washington',
  participantZipCode: '98059',
};
const mapped = assignmentParticipantFieldsFromRecord(c408);
assert('maps address from address', mapped.address === c408.address, mapped.address);
assert('maps participantEmail', mapped.email === 'pat@example.com', mapped.email);
assert('maps phonenumber', mapped.phone === '206-555-0199', mapped.phone);
assert('maps participantState', mapped.state === 'Washington', mapped.state);
assert('maps participantZipCode', mapped.zipCode === '98059', mapped.zipCode);
assert('maps team from team', assignmentTeamNameFromRecord(c408) === 'Alex x Blair');

const aliased = assignmentParticipantFieldsFromRecord({
  assignmentId: 'c408fa07',
  phonenumber0: '425-555-0100',
  phoneNumber: '999-000-1111',
});
assert(
  'phonenumber0 wins over moderator phoneNumber',
  aliased.phone === '425-555-0100',
  aliased.phone
);

const nested = assignmentParticipantFieldsFromRecord({
  fields: {
    address: '322 Pasco Mes NE 98059, Seattle, Washington',
    participantEmail: 'nested@example.com',
    phonenumber0: '253-555-0144',
    team: 'Nested Team',
  },
  assignmentId: 'c408fa07',
});
assert('flattens Graph fields.address', nested.address.indexOf('322 Pasco Mes') === 0, nested.address);
assert('flattens fields.participantEmail', nested.email === 'nested@example.com');
assert('flattens fields.phonenumber0', nested.phone === '253-555-0144');
assert('flattens fields.team', assignmentTeamNameFromRecord({ fields: { team: 'Nested Team' } }) === 'Nested Team');

const merged = mergeParticipantDataPreferFilled(
  { firstName: 'Pat', lastName: 'Mes', address: '322 Pasco Mes NE 98059, Seattle, Washington' },
  { firstName: 'Pat', lastName: 'Mes', email: 'old@local', phone: '111', address: '' }
);
assert('remote address survives richer-key local cache', merged.address.indexOf('322 Pasco Mes') === 0, merged.address);
assert('local email fills remote gap', merged.email === 'old@local');

const noSteal = assignmentParticipantPhoneFromRecord({
  phoneNumber: '999-000-1111',
});
assert('does not steal moderator phoneNumber as participant phone', noSteal === '', noSteal);

const flat = flattenAssignmentReadRow({ fields: { address: 'A' }, assignmentId: 'x', address: '' });
assert('wrapper empty address does not clobber nested', flat.address === 'A', flat.address);

console.log('');
console.log(failed ? `FAILED ${failed} · passed ${passed}` : `All ${passed} checks passed`);
process.exit(failed ? 1 : 0);
