#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'twilight.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

let passed = 0;
let failed = 0;
function assert(name, cond) {
  if (cond) { passed++; console.log('ok  -', name); }
  else { failed++; console.error('FAIL -', name); }
}

const fnBegin = src.indexOf('function buildAssignmentExcelRow(a)');
const fnEnd = src.indexOf('\nfunction exportAssignments()', fnBegin);
assert('buildAssignmentExcelRow located', fnBegin >= 0 && fnEnd > fnBegin);
const block = fnBegin >= 0 ? src.slice(fnBegin, fnEnd) : '';

const odTriple = "odScheduleId:       a.odScheduleId   || ''";
assert('per-mod rows include odScheduleId', block.includes(odTriple));
assert('per-mod rows include bookingGroupId', block.includes("bookingGroupId:     a.bookingGroupId || ''"));
assert('per-mod rows include odStatus', block.includes("odStatus:           a.odStatus       || ''"));
assert('terminal marker row includes odScheduleId', (block.match(/odScheduleId:/g) || []).length >= 2);

assert('export headers include OD keys', html.includes('odScheduleId') || src.includes(
  "'odScheduleId','bookingGroupId','odStatus'"
));
assert('APP_VERSION 1.3.091820n', /const APP_VERSION = '1\.3\.091820n'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091820n'));

console.log(failed ? `\n${failed} failed, ${passed} passed` : `\n${passed} passed`);
process.exit(failed ? 1 : 0);
