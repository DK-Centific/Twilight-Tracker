/**
 * Twilight · Production status counts (live)
 *
 * Paste this into the existing Apps Script project "Twilight Production1 status counts"
 * (script.google.com), replacing what is there. Then Deploy → Manage deployments →
 * pencil (Edit) → Version: New version → Deploy. That keeps the same /exec address,
 * so PRODUCTION1_STATUS_LIVE_URL in twilight.js does not change.
 *
 * It answers counts only: no names, addresses or phone numbers.
 *
 *   /exec               → status slices, exactly as before (Admin Overview ring).
 *   /exec?view=wrap     → status slices plus per-night and distinct-home counts (Twilight Wrap).
 *   /exec?view=headers  → the sheet's column titles only, to check which columns the Wrap reads.
 *
 * Rules match the Admin Overview ring: a row counts as one session when
 * column D (Session Kit) is a real kit (not blank, not "Select") and
 * column K (Status) is filled. "Not complete" / "Not Complete" are one slice.
 */
var SHEET_ID = '1zJWzg3b9qOC-weB0VZ_4MuNdd1GI557JUlsh-t5cogc';
var SHEET_GID = 0;          // the Production1 tab
var KIT_COL = 3;            // column D
var STATUS_COL = 10;        // column K
var CACHE_SECONDS = 30;     // the app asks about once a minute per open page
var TZ = 'America/Los_Angeles';
// Column titles the Wrap view looks for (first match wins, case-insensitive).
var DATE_TITLES = ['session date', 'date', 'scheduled date', 'booking date'];
var ADDRESS_TITLES = ['address', 'participant address', 'home address', 'location'];

function doGet(e) {
  var view = (e && e.parameter && e.parameter.view) || '';
  if (view !== 'wrap' && view !== 'headers') view = '';
  var key = 'production1-status' + (view ? '-' + view : '');
  var cache = CacheService.getScriptCache();
  var hit = cache.get(key);
  if (hit) return json_(hit);
  var body = JSON.stringify(view === 'headers' ? headers_() : countProduction1_(view === 'wrap'));
  cache.put(key, body, CACHE_SECONDS);
  return json_(body);
}

function sheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  return ss.getSheets().filter(function (sh) { return sh.getSheetId() === SHEET_GID; })[0]
    || ss.getSheetByName('Production1');
}

function headers_() {
  var sheet = sheet_();
  var row = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  return { updatedAt: new Date().toISOString(), headers: row.map(function (c) { return String(c).trim(); }) };
}

function findCol_(header, titles) {
  for (var i = 0; i < titles.length; i++) {
    var k = header.indexOf(titles[i]);
    if (k >= 0) return k;
  }
  return -1;
}

function isoDate_(raw, shown) {
  if (raw instanceof Date && !isNaN(raw)) return Utilities.formatDate(raw, TZ, 'yyyy-MM-dd');
  var d = new Date(shown);
  return isNaN(d) ? '' : Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

function countProduction1_(withWrap) {
  var sheet = sheet_();
  var range = sheet.getDataRange();
  var values = range.getDisplayValues();
  var raw = withWrap ? range.getValues() : null;
  var kitCol = KIT_COL;
  var statusCol = STATUS_COL;
  var dateCol = -1;
  var addrCol = -1;
  var start = 0;
  if (values.length) {
    var header = values[0].map(function (c) { return String(c).trim().toLowerCase(); });
    var k = header.indexOf('session kit');
    var st = header.indexOf('status');
    if (k >= 0 && st >= 0) { kitCol = k; statusCol = st; start = 1; }
    dateCol = findCol_(header, DATE_TITLES);
    addrCol = findCol_(header, ADDRESS_TITLES);
  }
  var order = [];
  var counts = {};
  var nights = {};      // date -> distinct completed homes that night
  var homes = {};       // normalized address -> true (completed only); never returned
  var visits = {};      // date|address -> true (completed only); never returned
  var kits = {};        // kit -> completed rows
  for (var r = start; r < values.length; r++) {
    var kit = String(values[r][kitCol] || '').trim();
    var status = String(values[r][statusCol] || '').trim().replace(/\s+/g, ' ');
    if (!kit || kit.toLowerCase() === 'select' || !status) continue;
    var key = status.toLowerCase();
    if (!counts[key]) { counts[key] = { status: status, count: 0 }; order.push(key); }
    counts[key].count += 1;
    if (!withWrap || key !== 'completed') continue;
    kits[kit] = (kits[kit] || 0) + 1;
    var date = dateCol >= 0 ? isoDate_(raw[r][dateCol], values[r][dateCol]) : '';
    var addr = addrCol >= 0 ? String(values[r][addrCol] || '').trim().toLowerCase().replace(/\s+/g, ' ') : '';
    if (addr) homes[addr] = true;
    if (date) {
      var v = date + '|' + (addr || ('row' + r));
      if (!visits[v]) { visits[v] = true; nights[date] = (nights[date] || 0) + 1; }
    }
  }
  var out = {
    updatedAt: new Date().toISOString(),
    slices: order.map(function (key) { return counts[key]; }),
  };
  if (withWrap) {
    var dates = Object.keys(nights).sort();
    out.wrap = {
      dateColumn: dateCol >= 0 ? values[0][dateCol] : null,
      addressColumn: addrCol >= 0 ? values[0][addrCol] : null,
      completedHomes: addrCol >= 0 ? Object.keys(homes).length : null,
      completedVisits: Object.keys(visits).length,
      completedByKit: kits,
      nights: dates.length,
      firstNight: dates[0] || null,
      lastNight: dates[dates.length - 1] || null,
      nightCounts: dates.map(function (d) { return { date: d, homes: nights[d] }; }),
    };
  }
  return out;
}

function json_(text) {
  return ContentService.createTextOutput(text).setMimeType(ContentService.MimeType.JSON);
}
