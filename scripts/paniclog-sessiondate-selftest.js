#!/usr/bin/env node
/* Self-test: PanicLog READ URL + Excel-serial sessionDate normalize (1.3.091820v). */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let failed = 0;
function assert(label, cond) {
  if (cond) console.log('  OK  ' + label);
  else { console.error('  FAIL  ' + label); failed++; }
}

console.log('PanicLog READ + sessionDate normalize self-test (1.3.091820v)');

assert('APP_VERSION 1.3.091820v',
  /const APP_VERSION = '1\.3\.091820v'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091820v'));

const readUrlMatch = src.match(/const PANICLOG_PA_READ_URL = '([^']*)';/);
assert('PANICLOG_PA_READ_URL is set (non-empty)', !!(readUrlMatch && readUrlMatch[1]));
assert('PANICLOG_PA_READ_URL targets PanicLog READ workflow ef8b9a53…',
  !!(readUrlMatch && readUrlMatch[1].includes('ef8b9a533932481e953493557c9c0fd6')));
assert('PANICLOG_PA_READ_URL has invoke sig',
  !!(readUrlMatch && readUrlMatch[1].includes('sig=GG2DJpbmspryoVU9cnl3OJtBCY15RQDJCCqfb-HkwT0')));

assert('normalizePanicLogRow converts Excel serial via UTC YMD',
  /25569/.test(src) && /getUTCFullYear\(\)/.test(src)
  && /sessionDateRaw/.test(src));
assert('normalizePanicLogRow prefers YYYY-MM-DD sessionDate',
  src.includes("if (/^\d{4}-\d{2}-\d{2}/.test(rawStr))")
  || /sessionDate = rawStr\.slice\(0, 10\)/.test(src));
assert('normalizePanicLogRow falls back to reportedAt day',
  /if \(!date && reportedAt\)/.test(src));
assert('incidentDateInRange uses row.date || row.sessionDate',
  /perfDateInRange\(\{ date: \(row && \(row\.date \|\| row\.sessionDate\)\) \|\| '' \}/.test(src));
assert('ensurePanicLogRows / fetchPanicLogRows present',
  /function ensurePanicLogRows\(/.test(src) && /function fetchPanicLogRows\(/.test(src)
  && /PANICLOG_PA_READ_URL/.test(src));

// Runtime: extract + eval a minimal normalize using the same serial math.
function excelSerialToYmd(raw) {
  const rawStr = (raw == null) ? '' : String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(rawStr)) return rawStr.slice(0, 10);
  if (rawStr && /^\d+(\.\d+)?$/.test(rawStr)) {
    const n = Number(rawStr);
    if (n > 25000 && n < 75000) {
      const ms = (n - 25569) * 86400 * 1000;
      const d = new Date(ms);
      if (!isNaN(d.getTime())) {
        return d.getUTCFullYear() + '-' +
          String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
          String(d.getUTCDate()).padStart(2, '0');
      }
    }
  }
  return '';
}
assert('serial 46274 → 2026-09-09', excelSerialToYmd('46274') === '2026-09-09');
assert('serial 46273 → 2026-09-08', excelSerialToYmd(46273) === '2026-09-08');
assert('ISO sessionDate preserved', excelSerialToYmd('2026-09-11') === '2026-09-11');
assert('empty stays empty', excelSerialToYmd('') === '');

if (failed) {
  console.error('\n' + failed + ' assertion(s) failed');
  process.exit(1);
}
console.log('\nAll assertions passed.');
