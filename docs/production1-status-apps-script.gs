/**
 * Twilight · Production status counts (live)
 *
 * Paste this into a new Google Apps Script project (script.google.com),
 * signed in with an account that can open the Production1 sheet. Deploy as
 * a Web app: Execute as "Me", Who has access "Anyone". Copy the /exec
 * address into PRODUCTION1_STATUS_LIVE_URL in twilight.js.
 *
 * It answers counts only: no names, addresses or phone numbers.
 * Rules match the Admin Overview ring: a row counts as one session when
 * column D (Session Kit) is a real kit (not blank, not "Select") and
 * column K (Status) is filled. "Not complete" / "Not Complete" are one slice.
 */
var SHEET_ID = '1zJWzg3b9qOC-weB0VZ_4MuNdd1GI557JUlsh-t5cogc';
var SHEET_GID = 0;          // the Production1 tab
var KIT_COL = 3;            // column D
var STATUS_COL = 10;        // column K
var CACHE_SECONDS = 30;     // the app asks about once a minute per open page

function doGet() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('production1-status');
  if (hit) return json_(hit);
  var body = JSON.stringify(countProduction1_());
  cache.put('production1-status', body, CACHE_SECONDS);
  return json_(body);
}

function countProduction1_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheets().filter(function (sh) { return sh.getSheetId() === SHEET_GID; })[0]
    || ss.getSheetByName('Production1');
  var values = sheet.getDataRange().getDisplayValues();
  var kitCol = KIT_COL;
  var statusCol = STATUS_COL;
  var start = 0;
  if (values.length) {
    var header = values[0].map(function (c) { return String(c).trim().toLowerCase(); });
    var k = header.indexOf('session kit');
    var st = header.indexOf('status');
    if (k >= 0 && st >= 0) { kitCol = k; statusCol = st; start = 1; }
  }
  var order = [];
  var counts = {};
  for (var r = start; r < values.length; r++) {
    var kit = String(values[r][kitCol] || '').trim();
    var status = String(values[r][statusCol] || '').trim().replace(/\s+/g, ' ');
    if (!kit || kit.toLowerCase() === 'select' || !status) continue;
    var key = status.toLowerCase();
    if (!counts[key]) { counts[key] = { status: status, count: 0 }; order.push(key); }
    counts[key].count += 1;
  }
  return {
    updatedAt: new Date().toISOString(),
    slices: order.map(function (key) { return counts[key]; }),
  };
}

function json_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}
