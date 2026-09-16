#!/usr/bin/env node
/* Self-test: Soft Sage Parchment light tokens (v1.3.091626k). */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');

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

function heliosLightBlock() {
  const start = html.indexOf('/* Helios LIGHT · Soft Sage Parchment');
  const end = html.indexOf('body { background:var(--bg); color:var(--text); font-family:var(--font); }', start);
  return start >= 0 && end > start ? html.slice(start, end) : '';
}

function heliosDarkBlock() {
  const start = html.indexOf('/* Helios DARK · charcoal + gold */');
  const end = html.indexOf('/* Helios LIGHT · Soft Sage Parchment', start);
  return start >= 0 && end > start ? html.slice(start, end) : '';
}

console.log('Soft Sage Parchment light-theme self-test');

const light = heliosLightBlock();
const dark = heliosDarkBlock();

assert('Helios light block present', light.length > 80);
assert('Helios dark block present', dark.length > 80);

assert('--bg is #E4EBE3', /--bg:#E4EBE3/.test(light));
assert('--bg2 is #F3F0E9', /--bg2:#F3F0E9/.test(light));
assert('--bg3 is #DDE5DB', /--bg3:#DDE5DB/.test(light));
assert('--bg4 is #D0D8CD', /--bg4:#D0D8CD/.test(light));
assert('--card-bg is #F3F0E9', /--card-bg:#F3F0E9/.test(light));
assert('--input-bg is #EEEBE4', /--input-bg:#EEEBE4/.test(light));
assert('--tile-bg is parchment wash', /--tile-bg:rgba\(243,240,233,0\.85\)/.test(light));
assert('--text is #242420', /--text:#242420/.test(light));
assert('--text2 is #6A7066', /--text2:#6A7066/.test(light));
assert('--accent is #E07A2B', /--accent:#E07A2B/.test(light));
assert('--accent-ink is #1A1714', /--accent-ink:#1A1714/.test(light));
assert('--accent-dim is #C46822', /--accent-dim:#C46822/.test(light));
assert('--accent-soft is coral wash', /--accent-soft:rgba\(224,122,43,0\.12\)/.test(light));
assert('--border is #C5CEC1', /--border:#C5CEC1/.test(light));
assert('--brand is #0E7C96', /--brand:#0E7C96/.test(light));
assert('no pure white in Helios light tokens', !/#fff(?:fff)?/i.test(light));
assert('accent is not near-black', !/--accent:#1A1815/.test(light) && !/--accent:#000/.test(light));

assert('dark Helios bg unchanged', /--bg:#1A1C1E/.test(dark));
assert('dark Helios accent unchanged', /--accent:#E8C24A/.test(dark));
assert('dark Helios brand unchanged', /--brand:#E8C24A/.test(dark));

assert('light cards use card-bg + top highlight',
  html.includes('[data-theme="light"] .card,')
    && html.includes('inset 0 1px 0 var(--card-highlight)'));
assert('light inputs use inward --bg3 shadow',
  html.includes('box-shadow: inset 3px 4px 10px var(--bg3) !important;'));
assert('selected pills use raised bg2 + coral ring',
  html.includes('0 0 0 2px var(--accent)')
    && html.includes('[data-theme="light"] .admin-tab.active'));
assert('booking light neu-light is not white',
  html.includes('--bk-neu-light: #F8F6F0') && !html.includes('--bk-neu-light: #FFFFFF'));
assert('APP_VERSION is 1.3.091626k', /const APP_VERSION = '1\.3\.091626k'/.test(src)
  && html.includes('twilight.js?v=twilight-1.3.091626k'));

console.log(failed ? `\n${failed} failed, ${passed} passed` : `\n${passed} passed`);
process.exit(failed ? 1 : 0);
