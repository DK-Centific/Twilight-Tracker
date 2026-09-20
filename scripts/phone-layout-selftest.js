#!/usr/bin/env node
'use strict';
/**
 * 1.3.091820y — Pixel 7 / phone-class layout
 * Portrait ~360–430 CSS px + landscape short-side phones keep mobile chrome.
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'twilight.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const panic = fs.readFileSync(path.join(root, 'twilight-panic.js'), 'utf8');

let failed = 0;
function assert(name, cond, detail) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name + (detail ? ' · ' + detail : ''));
  }
}

const start = src.indexOf('function isPhoneLayoutSize');
const end = src.indexOf('\nfunction isPhoneLayoutMq', start);
assert('isPhoneLayoutSize extractable', start >= 0 && end > start);
const fnSrc = src.slice(start, end);
const constBlock = src.slice(
  src.indexOf('const PHONE_LAYOUT_MAX_PX'),
  src.indexOf('function viewportCssSize')
);
let isPhoneLayoutSize;
try {
  isPhoneLayoutSize = new Function(
    constBlock + fnSrc + '\nreturn isPhoneLayoutSize;'
  )();
} catch (err) {
  isPhoneLayoutSize = () => false;
  assert('isPhoneLayoutSize eval', false, String(err));
}

console.log('phone-layout-selftest (1.3.091820y)');

assert('APP_VERSION 1.3.091820y', /const APP_VERSION = '1\.3\.091820y'/.test(src));
assert('index cache-bust 820y', /twilight\.js\?v=twilight-1\.3\.091820y/.test(html));

assert('Pixel 7 portrait 412×915 is phone', isPhoneLayoutSize(412, 915) === true);
assert('Pixel 7 landscape 915×412 is phone', isPhoneLayoutSize(915, 412) === true);
assert('Pixel 8 portrait 412×915 is phone', isPhoneLayoutSize(412, 915) === true);
assert('Pixel 8 landscape 915×412 is phone', isPhoneLayoutSize(915, 412) === true);
assert('Pixel 8 Pro portrait 448×998 is phone', isPhoneLayoutSize(448, 998) === true);
assert('Pixel 8 Pro landscape 998×448 is phone', isPhoneLayoutSize(998, 448) === true);
assert('iPhone 13 portrait 390×844 is phone', isPhoneLayoutSize(390, 844) === true);
assert('iPhone 13 landscape 844×390 is phone', isPhoneLayoutSize(844, 390) === true);
assert('Galaxy S20 portrait 360×800 is phone', isPhoneLayoutSize(360, 800) === true);
assert('Galaxy S20 landscape 800×360 is phone', isPhoneLayoutSize(800, 360) === true);
assert('desktop 1280×800 is not phone', isPhoneLayoutSize(1280, 800) === false);
assert('iPad portrait 768×1024 is not phone', isPhoneLayoutSize(768, 1024) === false);
assert('iPad landscape 1024×768 is not phone', isPhoneLayoutSize(1024, 768) === false);
assert('empty size is not phone', isPhoneLayoutSize(0, 0) === false);

assert(
  'CSS phone MQ includes landscape max-height 500',
  html.includes('(orientation: landscape) and (max-height: 500px)')
    && (html.match(/\(orientation: landscape\) and \(max-height: 500px\)/g) || []).length >= 8
);
assert(
  'desktop MQ requires min-height 501 so landscape phones stay mobile',
  html.includes('(min-width: 761px) and (min-height: 501px)')
    || html.includes('(min-width:761px) and (min-height: 501px)')
);
assert(
  'arrival / My session compact at 430px (Pixel 7 = 412)',
  /@media \(max-width: 430px\) \{[\s\S]{0,240}entry-arrived-btn/.test(html)
    && !html.includes('@media (max-width: 400px)')
);
assert('body/layout/login use 100dvh',
  /min-height:\s*100dvh/.test(html)
    && /min-height:\s*calc\(100dvh - 52px/.test(html)
);
assert('no Pixel/iPhone UA sniff in twilight.js',
  !/userAgent[\s\S]{0,80}Pixel/.test(src)
    && !/navigator\.userAgent/.test(src)
);
assert('accordion + scenario flow use isPhoneLayout',
  /function isStationAccordionMode\(\) \{[\s\S]{0,180}isPhoneLayout\(/.test(src)
    && /function isScenarioFlowMobile\(\) \{[\s\S]{0,80}isPhoneLayout\(/.test(src)
);
assert('nav rails use isDesktopLayout + visualViewport',
  /const desktop = typeof isDesktopLayout === 'function' \? isDesktopLayout\(\)/.test(src)
    && /visualViewport\.addEventListener\('resize', onViewportChange/.test(src)
);
assert('scenario flow layout uses viewportCssSize',
  /const vh = viewportCssSize\(\)\.h/.test(src)
);
assert('panic mobile includes landscape short-phone',
  /max-height: 500px/.test(panic)
    && /is-phone-layout/.test(panic)
);
assert('html.is-phone-layout chrome backup',
  html.includes('html.is-phone-layout .helios-rail')
    && html.includes('html.is-phone-layout .sc-flow')
);
assert('phone-class comment names Pixel 7',
  html.includes('Pixel 7') && src.includes('Pixel 7')
);
assert('login card compact in phone landscape',
  /@media \(orientation: landscape\) and \(max-height: 520px\) \{[\s\S]*?\.login-card \{/.test(html)
    && /Sign-in card is taller than a Pixel 7 landscape/.test(html)
);

if (failed) {
  console.log('\n' + failed + ' failed');
  process.exit(1);
}
console.log('\nAll phone-layout checks passed.');
