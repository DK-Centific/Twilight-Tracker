#!/usr/bin/env node
/* Live probe: SessionState Write → Read for moderator location.
 * Prints the exact HTTP results so we can see whether lastGeo can
 * round-trip. Does not fail the helper suite if Read is down — that
 * is a Power Automate repair, documented in
 * docs/power-automate-sessionstate-read.md.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { URL } = require('url');

const src = fs.readFileSync(path.join(__dirname, '..', 'twilight.js'), 'utf8');
function grabConst(name) {
  const m = src.match(new RegExp('const ' + name + "\\s*=\\s*'([^']+)'"));
  if (!m) throw new Error('Could not find ' + name + ' in twilight.js');
  return m[1];
}
const WRITE_URL = grabConst('SESSIONSTATE_PA_WRITE_URL');
const READ_URL = grabConst('SESSIONSTATE_PA_READ_URL');

function request(url, method, body) {
  return new Promise((resolve) => {
    const u = new URL(url);
    const payload = body == null ? null : Buffer.from(JSON.stringify(body));
    const req = https.request({
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method,
      headers: payload
        ? { 'Content-Type': 'application/json', 'Content-Length': payload.length }
        : {},
      timeout: 45000,
    }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, text, ms: Date.now() - started });
      });
    });
    const started = Date.now();
    req.on('error', (err) => resolve({ status: 0, text: String(err && err.message), ms: Date.now() - started }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ status: 0, text: 'timeout', ms: Date.now() - started });
    });
    if (payload) req.write(payload);
    req.end();
  });
}

function summarizeRead(text) {
  try {
    const parsed = JSON.parse(text);
    const rows = Array.isArray(parsed) ? parsed : (parsed && parsed.value);
    if (!Array.isArray(rows)) {
      return { shape: typeof parsed, keys: parsed && typeof parsed === 'object' ? Object.keys(parsed).slice(0, 8) : [], rows: null };
    }
    const david = rows.filter((r) => String((r && (r.orbitLoginId || r.OrbitLoginId)) || '').toLowerCase().indexOf('david') >= 0);
    const probe = rows.filter((r) => String((r && (r.sessionStateId || r.assignmentId)) || '').indexOf('geo_probe_cursor_75b9') >= 0);
    return { shape: 'array', count: rows.length, david: david.length, probe: probe.length };
  } catch (e) {
    return { shape: 'unparsed', error: e.message };
  }
}

(async () => {
  const now = new Date().toISOString();
  const at = Date.now();
  const payload = {
    sessionStateId: 'ss_geo_probe_cursor_75b9',
    assignmentId: 'geo_probe_cursor_75b9',
    teamId: '',
    orbitLoginId: 'cursor-probe',
    assignmentAddress: '',
    milesFromHq: '',
    lastGeoLat: 47.6446,
    lastGeoLng: -122.137,
    lastGeoAt: at,
    lastGeoName: 'Cursor probe',
    lastGeoRole: 'moderator',
    stateJson: JSON.stringify({
      type: 'geoProbe',
      lastGeo: { lat: 47.6446, lng: -122.137, at, name: 'Cursor probe', role: 'moderator', syncReason: 'roundtrip' },
      updatedAt: now,
    }),
    lastActive: now,
    appVersion: '1.3.091226g',
    overwrite: true,
  };

  console.log('SessionState location round-trip probe');
  const write = await request(WRITE_URL, 'POST', payload);
  console.log('WRITE', write.status, write.ms + 'ms', write.text.slice(0, 180));
  const read = await request(READ_URL, 'GET');
  console.log('READ ', read.status, read.ms + 'ms', read.text.slice(0, 220));
  console.log('READ summary', JSON.stringify(summarizeRead(read.text)));

  const writeOk = write.status === 200 && /ok/i.test(write.text);
  const readOk = read.status === 200;
  if (!writeOk) {
    console.error('WRITE failed — Twilight cannot save lastGeo.');
    process.exit(1);
  }
  if (!readOk) {
    console.log('WRITE ok. READ is down (' + read.status + '). Admin Activities cannot show a new pin until SessionState Read is repaired.');
    process.exit(0);
  }
  const summary = summarizeRead(read.text);
  if (summary.probe > 0) {
    console.log('Round-trip ok — probe row is visible on Read.');
    process.exit(0);
  }
  console.log('WRITE ok and READ answered, but the probe row was not in the list. Check overwrite / filter / pagination on the Read flow.');
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
