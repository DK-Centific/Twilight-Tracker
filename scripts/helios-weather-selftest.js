#!/usr/bin/env node
/* Unit tests for Helios weather mapping + booking date targeting.
   Mirrors helpers in twilight.js (heliosWeatherKindFromCode, week→today). */

function heliosWeatherKindFromCode(code) {
  const n = Number(code);
  if (!Number.isFinite(n) || n < 0) return null;
  if (n <= 1) return 'clear';
  if (n === 2 || n === 3 || n === 45 || n === 48) return 'cloudy';
  if (n >= 51) return 'rain';
  return 'cloudy';
}

function heliosWeatherWord(kind) {
  if (kind === 'clear') return 'Clear';
  if (kind === 'cloudy') return 'Cloud';
  if (kind === 'rain') return 'Rain';
  return '';
}

function heliosReadWeatherCode(obj) {
  if (!obj || typeof obj !== 'object') return NaN;
  const n = Number(obj.weather_code != null ? obj.weather_code : obj.weathercode);
  return n;
}

function heliosParseForecast(data) {
  const current = data && data.current;
  const daily = data && data.daily;
  const hourly = data && data.hourly;
  const currentTempF = Number(current && current.temperature_2m);
  const currentCode = heliosReadWeatherCode(current);
  const days = {};
  const times = (daily && daily.time) || [];
  const codes = (daily && (daily.weather_code || daily.weathercode)) || [];
  const maxes = (daily && daily.temperature_2m_max) || [];
  const means = (daily && daily.temperature_2m_mean) || [];
  times.forEach((t, i) => {
    const key = String(t || '').slice(0, 10);
    if (!key) return;
    const mean = Number(means[i]);
    const max = Number(maxes[i]);
    days[key] = {
      code: Number(codes[i]),
      tempF: Number.isFinite(mean) ? mean : max,
    };
  });
  const hours = [];
  const hTimes = (hourly && hourly.time) || [];
  const hTemps = (hourly && hourly.temperature_2m) || [];
  const hCodes = (hourly && (hourly.weather_code || hourly.weathercode)) || [];
  hTimes.forEach((t, i) => {
    hours.push({
      time: String(t || ''),
      tempF: Number(hTemps[i]),
      code: Number(hCodes[i]),
    });
  });
  return {
    fetchedAt: Date.now(),
    currentTempF: Number.isFinite(currentTempF) ? currentTempF : null,
    currentCode: Number.isFinite(currentCode) ? currentCode : null,
    currentKind: heliosWeatherKindFromCode(currentCode),
    days,
    hours,
  };
}

function heliosSnapshotForDate(cache, dateStr, opts) {
  opts = opts || {};
  if (!cache || !dateStr) return null;
  const todayStr = opts.todayStr || '';
  const useCurrent = !!opts.preferCurrent || dateStr === todayStr;
  if (useCurrent && Number.isFinite(cache.currentTempF) && cache.currentKind) {
    return { tempF: cache.currentTempF, kind: cache.currentKind, dateStr, source: 'current' };
  }
  const day = cache.days && cache.days[dateStr];
  if (day && Number.isFinite(day.tempF)) {
    return {
      tempF: day.tempF,
      kind: heliosWeatherKindFromCode(day.code),
      dateStr,
      source: 'daily',
    };
  }
  const hours = (cache.hours || []).filter(h => String(h.time).slice(0, 10) === dateStr);
  if (hours.length) {
    const pref = hours.find(h => /T15:/.test(h.time))
      || hours[Math.floor(hours.length / 2)]
      || hours[0];
    if (pref && Number.isFinite(pref.tempF)) {
      return {
        tempF: pref.tempF,
        kind: heliosWeatherKindFromCode(pref.code),
        dateStr,
        source: 'hourly',
      };
    }
  }
  return null;
}

function bookingWeatherTargetDateStr(view, selectedStr, todayStr) {
  return view === 'week' ? todayStr : selectedStr;
}

let passed = 0;
let failed = 0;
function assert(name, cond) {
  if (cond) { passed++; console.log('ok  -', name); }
  else { failed++; console.error('FAIL -', name); }
}

assert('clear sky 0', heliosWeatherKindFromCode(0) === 'clear');
assert('mainly clear 1', heliosWeatherKindFromCode(1) === 'clear');
assert('partly cloudy 2', heliosWeatherKindFromCode(2) === 'cloudy');
assert('overcast 3', heliosWeatherKindFromCode(3) === 'cloudy');
assert('fog 45', heliosWeatherKindFromCode(45) === 'cloudy');
assert('rime fog 48', heliosWeatherKindFromCode(48) === 'cloudy');
assert('drizzle 51', heliosWeatherKindFromCode(51) === 'rain');
assert('rain 61', heliosWeatherKindFromCode(61) === 'rain');
assert('snow 71 maps to rain bucket', heliosWeatherKindFromCode(71) === 'rain');
assert('thunder 95', heliosWeatherKindFromCode(95) === 'rain');
assert('invalid code is null', heliosWeatherKindFromCode('x') == null);
assert('word for cloudy is Cloud', heliosWeatherWord('cloudy') === 'Cloud');
assert('reads weather_code', heliosReadWeatherCode({ weather_code: 3 }) === 3);
assert('reads weathercode alias', heliosReadWeatherCode({ weathercode: 61 }) === 61);

const parsed = heliosParseForecast({
  current: { temperature_2m: 64.2, weather_code: 1 },
  daily: {
    time: ['2026-09-11', '2026-09-12'],
    weather_code: [1, 61],
    temperature_2m_mean: [64, 58],
    temperature_2m_max: [70, 62],
  },
  hourly: {
    time: ['2026-09-13T15:00', '2026-09-13T16:00'],
    temperature_2m: [55, 54],
    weather_code: [3, 3],
  },
});
assert('current kind clear', parsed.currentKind === 'clear');
assert('daily rain day', heliosWeatherKindFromCode(parsed.days['2026-09-12'].code) === 'rain');

const todaySnap = heliosSnapshotForDate(parsed, '2026-09-12', {
  todayStr: '2026-09-11',
  preferCurrent: true,
});
assert('week view uses current not selected day', todaySnap && todaySnap.source === 'current' && todaySnap.tempF === 64.2);

const monthSnap = heliosSnapshotForDate(parsed, '2026-09-12', {
  todayStr: '2026-09-11',
  preferCurrent: false,
});
assert('month view uses selected daily', monthSnap && monthSnap.source === 'daily' && Math.round(monthSnap.tempF) === 58 && monthSnap.kind === 'rain');

const hourlySnap = heliosSnapshotForDate(parsed, '2026-09-13', {
  todayStr: '2026-09-11',
});
assert('hourly 15:00 fallback', hourlySnap && hourlySnap.source === 'hourly' && hourlySnap.tempF === 55 && hourlySnap.kind === 'cloudy');

assert('week target is today', bookingWeatherTargetDateStr('week', '2026-09-14', '2026-09-11') === '2026-09-11');
assert('month target is selected', bookingWeatherTargetDateStr('month', '2026-09-14', '2026-09-11') === '2026-09-14');

console.log(failed ? `\n${failed} failed, ${passed} passed` : `\n${passed} passed`);
process.exit(failed ? 1 : 0);
