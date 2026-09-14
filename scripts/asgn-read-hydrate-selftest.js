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
  assignmentParticipantNameFromRecord,
  assignmentHydrateParticipantNames,
  assignmentParticipantDisplayName,
  assignmentRecordLooksOd,
  assignmentTeamNameFromRecord,
  mergeParticipantDataPreferFilled,
  sanitizeSharePointPlainText,
  formatParticipantAddressLine,
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
assert('Twilight hydrate uses assignedTo as participant name', mapped.firstName === 'Pat' && mapped.lastName === 'Mes', mapped.firstName + ' ' + mapped.lastName);

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

const dirtyHtml = '<div class="ExternalClassAABC6FCFB38B4C1CBA91962FD918F19B">(your own residence), Seattle, Washington</div>';
const dirtyMapped = assignmentParticipantFieldsFromRecord({
  address: dirtyHtml,
  participantState: 'Washington',
  participantZipCode: '98101',
});
assert(
  'strips ExternalClass HTML from address',
  dirtyMapped.address === '(your own residence), Seattle, Washington',
  dirtyMapped.address
);
assert(
  'no HTML tags remain on hydrated address',
  dirtyMapped.address.indexOf('<') < 0 && dirtyMapped.address.indexOf('ExternalClass') < 0,
  dirtyMapped.address
);
assert('state still hydrates separately', dirtyMapped.state === 'Washington', dirtyMapped.state);

const dirtyPlusState = assignmentParticipantFieldsFromRecord({
  address: dirtyHtml + ', Washington',
  participantState: 'Washington',
});
assert(
  'collapses Washington already present outside the wrapper',
  dirtyPlusState.address === '(your own residence), Seattle, Washington',
  dirtyPlusState.address
);

const formatted = formatParticipantAddressLine({
  address: dirtyHtml,
  state: 'Washington',
});
assert(
  'format does not duplicate Washington after HTML strip',
  formatted === '(your own residence), Seattle, Washington',
  formatted
);

const formattedDup = formatParticipantAddressLine({
  address: dirtyHtml + ', Washington',
  state: 'Washington',
  zipCode: '98101',
});
assert(
  'format collapses duplicated state and skips zip already absent only',
  formattedDup === '(your own residence), Seattle, Washington, 98101',
  formattedDup
);

const ents = sanitizeSharePointPlainText('<div class="ExternalClassX">221B&nbsp;Baker &amp; Son</div>');
assert('decodes entities and collapses space', ents === '221B Baker & Son', ents);

const nestedFields = assignmentParticipantFieldsFromRecord({
  fields: { address: dirtyHtml },
});
assert(
  'flattens nested Graph HTML address',
  nestedFields.address === '(your own residence), Seattle, Washington',
  nestedFields.address
);

const odRow = {
  comment: 'od-sync',
  odScheduleId: 'sched-od-1',
  orbitLoginId: 'alex.mod',
  firstName: 'Alex',
  lastName: 'Moderator',
  team: 'Alex x Blair',
  assignedTo: 'Alex Moderator',
  participantEmail: 'pat@example.com',
  phonenumber0: '206-555-0199',
  address: '322 Pasco Mes NE 98059, Seattle, Washington',
  participantFirstName: 'Pat',
  participantLastName: 'Mes',
};
assert('OD row is detected as OD', assignmentRecordLooksOd(odRow) === true);
const odMapped = assignmentParticipantFieldsFromRecord(odRow);
assert('OD uses participantFirstName not moderator firstName', odMapped.firstName === 'Pat', odMapped.firstName);
assert('OD uses participantLastName not moderator lastName', odMapped.lastName === 'Mes', odMapped.lastName);
assert('OD name helper ignores assignedTo when participant cols exist',
  assignmentParticipantNameFromRecord(odRow).firstName === 'Pat');

const odNoNewCols = {
  comment: 'od-sync',
  odScheduleId: 'sched-od-2',
  firstName: 'Alex',
  lastName: 'Moderator',
  team: 'Alex x Blair',
  assignedTo: 'Should Not Win',
  participantEmail: 'pat@example.com',
};
const odEmptyNames = assignmentHydrateParticipantNames(odNoNewCols);
assert('OD without participant name cols does not use assignedTo', odEmptyNames.firstName === '' && odEmptyNames.lastName === '', JSON.stringify(odEmptyNames));
assert('OD without participant name cols does not use moderator firstName', assignmentParticipantNameFromRecord(odNoNewCols).firstName === '');

const odAliased = assignmentParticipantNameFromRecord({
  fields: {
    participant_first_name: 'Jordan',
    participant_last_name: 'Lee',
    firstName: 'Alex',
    lastName: 'Moderator',
  },
  odStatus: 'Scheduled',
});
assert('reads nested participant_first_name alias', odAliased.firstName === 'Jordan' && odAliased.lastName === 'Lee', JSON.stringify(odAliased));

const odFull = assignmentParticipantNameFromRecord({
  odScheduleId: 's3',
  participantName: 'Sam Rivera',
  firstName: 'Alex',
});
assert('splits participantName when first/last cols missing', odFull.firstName === 'Sam' && odFull.lastName === 'Rivera', JSON.stringify(odFull));

const odCard = assignmentParticipantDisplayName({
  source: 'od-sync',
  odScheduleId: 'sched-od-1',
  teamName: 'Alex x Blair',
  participantData: { firstName: 'Pat', lastName: 'Mes', email: 'pat@example.com' },
  modSnapshots: [{ firstName: 'Alex', lastName: 'Moderator' }],
});
assert('Booking title uses OD participant name', odCard === 'Pat Mes', odCard);

const odFallbackEmail = assignmentParticipantDisplayName({
  source: 'od-sync',
  odScheduleId: 'sched-od-2',
  teamName: 'Alex x Blair',
  participantData: { email: 'pat@example.com' },
  modSnapshots: [{ firstName: 'Alex', lastName: 'Moderator' }],
});
assert('OD missing name uses email not team string', odFallbackEmail === 'pat@example.com', odFallbackEmail);

const odFallbackNeutral = assignmentParticipantDisplayName({
  source: 'od-sync',
  odScheduleId: 'sched-od-3',
  teamName: 'Alex x Blair',
  participantData: { firstName: 'Alex', lastName: 'Moderator' },
  modSnapshots: [{ firstName: 'Alex', lastName: 'Moderator' }],
});
assert('OD moderator-shaped name is rejected for title', odFallbackNeutral === 'Participant', odFallbackNeutral);

const odTeamAsTitle = assignmentParticipantDisplayName({
  source: 'od-sync',
  teamName: 'Alex x Blair',
  participantData: { firstName: 'Alex', lastName: 'x Blair' },
});
assert('OD "A x B" team string is never the bold title', odTeamAsTitle === 'Participant', odTeamAsTitle);

const twilightCard = assignmentParticipantDisplayName({
  participantData: { firstName: 'Pat', lastName: 'Mes' },
  teamName: 'Alex x Blair',
});
assert('Twilight title keeps participantData name', twilightCard === 'Pat Mes', twilightCard);

context.getLiveParticipantByAssignmentId = function (id) {
  if (id === 'orbit-pat') return { firstName: 'Directory', lastName: 'Pat' };
  return null;
};
const fromDir = assignmentParticipantDisplayName({
  source: 'od-sync',
  participantOrbitId: 'orbit-pat',
  teamName: 'Alex x Blair',
  participantData: { firstName: 'Alex', lastName: 'Moderator', email: 'pat@example.com' },
  modSnapshots: [{ firstName: 'Alex', lastName: 'Moderator' }],
});
assert('participantOrbitId directory name wins for OD title', fromDir === 'Directory Pat', fromDir);

assert(
  'Booking session list uses shared participant display helper',
  /assignmentParticipantDisplayName\(a\)/.test(src)
);
assert(
  'OneData Booked Sessions URL constant exists',
  /const ONEDATA_BOOKED_SESSIONS_URL =/.test(src)
    && /onedata\.centific\.com/.test(src)
    && /8f948ab0-4d52-4677-bb7d-9543dfe82e65/.test(src)
    && /tab=booked-sessions/.test(src)
);
assert(
  'Booking header opener uses shared popup helper',
  /function onBookingOnedataOpenClick/.test(src)
    && /openExternalAppWindow\(href/.test(src)
);

console.log('');
console.log(failed ? `FAILED ${failed} · passed ${passed}` : `All ${passed} checks passed`);
process.exit(failed ? 1 : 0);
