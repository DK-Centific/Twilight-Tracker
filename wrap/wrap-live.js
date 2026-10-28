/* Twilight Wrap · live read.
   Reads the same Power Automate flows as twilight.js and reduces them, in the browser,
   to the numbers-only shape of data/wrap-data.json (tools/build_snapshot.py is the
   offline twin of this file: keep the two in step). Nothing but counts, first names
   and distances leaves this function. */
window.TwilightWrapLive = (() => {
  'use strict';

  // Read URLs: copied from twilight.js (ASSIGNMENT_PA_READ_URL, SESSIONSTATE_PA_READ_URL,
  // APPROVAL_PA_READ_URL, ADMIN_PA_MODERATORS_URL).
  const READS = {
    assignment: { url: 'https://default9b415834803a4da0afdcfe6b1d52d6.49.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/007ccc87394e486893f6ea13a9f5769a/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=L-IYHBxexwpSm67AoNE7fecJUlD0t1P4ZfW8D2byLD4', method: 'POST' },
    sessionState: { url: 'https://default9b415834803a4da0afdcfe6b1d52d6.49.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/0c5d3ab19b7443c598a18136830a32bc/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=eDKkJNTraDxG47g0RnzLCW7ineUS4YuwpZsCnC0Cmmw', method: 'GET' },
    approval: { url: 'https://default9b415834803a4da0afdcfe6b1d52d6.49.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/41d9757babff4eb7ac2d3881804af96c/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=FMNIOJoSnhglArGlE5DuEZqEERwyQSV7fzp1cQqCO1g', method: 'POST' },
    // PRODUCTION1_STATUS_LIVE_URL: counts-only Production1 log behind Admin -> Overview.
    production: { url: 'https://script.google.com/macros/s/AKfycbyZTV6g3DJ_5cIAOYxCy5705fBnuFCOnd3uoLZa-YBiPTS4LAJ0k5t9knNMgjPUpBk/exec?view=wrap', method: 'GET', raw: true },
    moderators: { url: 'https://default9b415834803a4da0afdcfe6b1d52d6.49.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/12/workflows/b1c2ebab26ca46b48157a9b3eb1fe8ea/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=30zTIugKOWleHUNplcvGBs6d6u_2VZxmBipvvs9O0P0', method: 'GET' },
  };
  // Centific office, 14980 NE 31st St Ste 100, Redmond, WA 98052 (the app's office fence).
  const OFFICE = [47.6446, -122.137];
  const TEST_LOGINS = new Set(['David-tw']);
  const TZ = 'America/Los_Angeles';

  const rows = d => Array.isArray(d) ? d : (d && Object.values(d).find(Array.isArray)) || [];
  const read = async ({ url, method, raw }, signal) => {
    const res = await fetch(url, method === 'POST'
      ? { method, headers: { 'Content-Type': 'application/json' }, body: '{}', signal }
      : { method, signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    return raw ? body : rows(body);
  };

  // Same status folding as the Overview ring (production1StatusDisplayLabel in twilight.js).
  const P1_LABELS = { completed: 'Completed', cancelled: 'Cancelled', canceled: 'Cancelled', 'not complete': 'Not complete', confirmed: 'Confirmed' };
  function production(body) {
    const m = new Map();
    (body && body.slices || []).forEach(sl => {
      const k = String(sl.status == null ? '' : sl.status).trim().replace(/\s+/g, ' ').toLowerCase();
      if (!k) return;
      const label = P1_LABELS[k] || String(sl.status).trim();
      m.set(label, (m.get(label) || 0) + (Number(sl.count) || 0));
    });
    const slices = [...m].sort((a, b) => b[1] - a[1]).map(([status, count]) => ({ status, count }));
    return { updatedAt: body && body.updatedAt || null, source: 'Production1 log (Admin Overview chart)', total: slices.reduce((a, b) => a + b.count, 0), slices, wrap: body && body.wrap || null };
  }
  const iso = s => { const d = s ? new Date(s) : null; return d && !isNaN(d) ? d : null; };
  const ptParts = d => Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).map(p => [p.type, p.value]));
  const ptDate = d => { const p = ptParts(d); return `${p.year}-${p.month}-${p.day}`; };
  const ptHour = d => Number(ptParts(d).hour) % 24;
  const ptClock = d => { const p = ptParts(d); return `${String(Number(p.hour) % 24).padStart(2, '0')}:${p.minute}`; };
  const miles = (a, b) => {
    const r = Math.PI / 180;
    const h = Math.sin((b[0] - a[0]) * r / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin((b[1] - a[1]) * r / 2) ** 2;
    return 3958.8 * 2 * Math.asin(Math.sqrt(h));
  };
  const round1 = n => Math.round(n * 10) / 10;
  const count = (list, key) => list.reduce((m, x) => { const k = key(x); m.set(k, (m.get(k) || 0) + 1); return m; }, new Map());

  function progress(x) {
    let n = 0;
    for (const st of Object.values(x.stations || {})) {
      for (const sc of Object.values(st.scenarios || {})) if (sc && (sc.status === 'Uploaded' || sc.status === 'Calibrated')) n++;
    }
    return n;
  }

  function reduce({ assignment, sessionState, approval, moderators }, zips, now = new Date()) {
    const today = ptDate(now);

    // Assignment is an append log: the newest row per assignment wins.
    const latest = new Map();
    assignment.slice().sort((a, b) => (a.ID || 0) - (b.ID || 0)).forEach(a => {
      if (a.assignmentId && !TEST_LOGINS.has(a.orbitLoginId)) latest.set(a.assignmentId, a);
    });

    // Session progress: keep the richest saved checklist per assignment.
    const ss = new Map();
    sessionState.forEach(r => {
      if (!r.assignmentId || !r.stateJson) return;
      let x; try { x = JSON.parse(r.stateJson); } catch { return; }
      const cur = ss.get(r.assignmentId);
      if (!cur || progress(x) >= progress(cur)) ss.set(r.assignmentId, x);
    });

    const sessions = [];
    latest.forEach((a, aid) => {
      const x = ss.get(aid) || {};
      const date = (a.assignedDate || '').slice(0, 10) || x.sessionDate || '';
      const done = a.status === 'Completed' || !!x.sessionCompletedAt || x.sessionStatus === 'session_done';
      const cancelled = a.status === 'Cancelled' || !!x.sessionCancelledAt || x.sessionStatus === 'Cancelled';
      const status = done ? 'completed' : cancelled ? 'cancelled' : a.status === 'Rescheduled' ? 'rescheduled'
        : date && date < today ? 'incomplete' : 'upcoming';
      const team = (a.team || '').split(' x ').map(t => t.trim()).filter(t => t && !t.startsWith('Team '));
      const zip = String(a.participantZipCode || '').trim().slice(0, 5);
      const fin = iso(x.sessionCompletedAt);
      sessions.push({
        date, status, team, zip,
        home: (a.address || '').trim().toLowerCase() || null,
        miles: zips[zip] ? round1(miles(OFFICE, zips[zip])) : null,
        scenarios: progress(x),
        finish: fin ? ptClock(fin) : null,
      });
    });

    const done = sessions.filter(s => s.status === 'completed');
    const by = count(sessions, s => s.status);
    const dists = done.map(s => s.miles).filter(m => m != null);
    const nights = [...new Set(done.map(s => s.date))].sort();
    const homes = new Set(done.map(s => s.home).filter(Boolean));
    const mods = [...new Set(done.flatMap(s => s.team))].sort();
    const sum = a => a.reduce((x, y) => x + y, 0);

    const weekOf = d => { const t = new Date(`${d}T00:00:00Z`); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7)); return t.toISOString().slice(0, 10); };
    const weeks = count(done, s => weekOf(s.date));

    // First visit per home, in order: night and distance only.
    const firstVisit = new Map();
    done.slice().sort((a, b) => a.date.localeCompare(b.date)).forEach(s => { if (s.home && !firstVisit.has(s.home)) firstVisit.set(s.home, s); });

    const reviewers = [...new Set(approval.map(p => p.decided_by).filter(n => /^Centific-Reviewer/.test(n || '')))].sort();
    const decisions = approval.filter(p => reviewers.includes(p.decided_by) && iso(p.decided_at));
    const ptHours = Array(24).fill(0);
    decisions.forEach(p => { ptHours[ptHour(iso(p.decided_at))]++; });
    const nightShare = decisions.length ? sum(ptHours.filter((_, h) => h >= 19 || h < 6)) / decisions.length : 0;

    const pairKey = t => t.slice().sort().join('|');
    const pairs = [...count(done.filter(s => s.team.length === 2), s => pairKey(s.team))]
      .sort((a, b) => b[1] - a[1]).map(([k, n]) => { const [a, b] = k.split('|'); return { a, b, nights: n }; });

    const modStory = name => {
      const mine = sessions.filter(s => s.team.includes(name));
      const md = mine.filter(s => s.status === 'completed');
      const d = md.map(s => s.miles).filter(m => m != null);
      const partners = [...count(md.flatMap(s => s.team.filter(n => n !== name)), n => n)]
        .sort((a, b) => b[1] - a[1]).map(([n, c]) => ({ name: n, nights: c }));
      const ds = md.map(s => s.date).sort();
      return {
        name, sessions: md.length, cancelled: mine.filter(s => s.status === 'cancelled').length,
        nights: new Set(ds).size, homes: new Set(md.map(s => s.home).filter(Boolean)).size,
        firstNight: ds[0] || null, lastNight: ds[ds.length - 1] || null,
        miles: { total: Math.round(sum(d) * 2), shortest: d.length ? Math.min(...d) : null, farthest: d.length ? Math.max(...d) : null },
        scenarios: sum(md.map(s => s.scenarios)), partners,
        nightsList: [...new Set(ds)],
        homesList: md.slice().sort((a, b) => a.date.localeCompare(b.date)).map(s => ({ date: s.date, miles: s.miles })),
      };
    };

    const roles = count(moderators.filter(m => !TEST_LOGINS.has(m.orbitLoginId)), m => m.LoginRole);
    const late = hhmm => { const [h, m] = hhmm.split(':').map(Number); return ((h - 18 + 24) % 24) * 60 + m; };
    const finishes = done.map(s => s.finish).filter(Boolean);

    return {
      generatedAt: now.toISOString(),
      source: 'live',
      season: { first: nights[0] || null, last: nights[nights.length - 1] || null, nights: nights.length, nightsList: nights },
      sessions: {
        booked: sessions.length, completed: by.get('completed') || 0, cancelled: by.get('cancelled') || 0,
        rescheduled: by.get('rescheduled') || 0, incomplete: by.get('incomplete') || 0, upcoming: by.get('upcoming') || 0,
        perWeek: [...weeks].sort((a, b) => a[0].localeCompare(b[0])).map(([week, n]) => ({ week, completed: n })),
      },
      homes: {
        count: homes.size, zips: new Set(done.map(s => s.zip).filter(Boolean)).size, states: ['Washington'],
        list: [...firstVisit.values()].map(s => ({ date: s.date, miles: s.miles })),
      },
      nightCounts: Object.fromEntries([...count(done, s => s.date)].sort((a, b) => a[0].localeCompare(b[0]))),
      miles: {
        from: 'Centific office, Redmond WA', method: 'straight line, office to the home ZIP centre',
        shortest: dists.length ? Math.min(...dists) : null, farthest: dists.length ? Math.max(...dists) : null,
        average: dists.length ? round1(sum(dists) / dists.length) : null, roundTripTotal: Math.round(sum(dists) * 2),
      },
      people: {
        moderators: mods.length, participants: homes.size, reviewers: reviewers.length, admins: roles.get('Master Admin') || 0,
        pairings: pairs.length, moderatorNames: mods,
        sessionsByModerator: Object.fromEntries(mods.map(n => [n, done.filter(s => s.team.includes(n)).length])),
        pairs,
      },
      qa: {
        reviewers: reviewers.length, decisions: decisions.length,
        approved: approval.filter(p => p.status === 'Approved' || p.status === 'AutoApproved').length,
        nightShare: Math.round(nightShare * 1000) / 1000, byPacificHour: ptHours,
      },
      kit: {
        kits: 2, camerasPerKit: 4, cameras: 8, stations: 4,
        stationNames: ['Front Yard · Lights On', 'Front Yard · Lights Off', 'Backyard · Lights On', 'Backyard · Lights Off'],
        scenariosCaptured: sum(done.map(s => s.scenarios)),
      },
      nightShift: { latestFinish: finishes.sort((a, b) => late(b) - late(a))[0] || null },
      production: null,
      incidents: null,
      moderators: Object.fromEntries(mods.map(n => [n, modStory(n)])),
    };
  }

  /* Resolves with the live numbers, or rejects; the caller keeps the snapshot on screen either way. */
  async function load({ timeoutMs = 45000 } = {}) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const [zipFile, assignment, sessionState, approval, moderators, p1] = await Promise.all([
        fetch('data/wa-zips.json').then(r => r.json()),
        read(READS.assignment, ctl.signal), read(READS.sessionState, ctl.signal),
        read(READS.approval, ctl.signal), read(READS.moderators, ctl.signal),
        read(READS.production, ctl.signal).catch(() => null),
      ]);
      if (!assignment.length) throw new Error('Assignment read came back empty');
      const out = reduce({ assignment, sessionState, approval, moderators }, zipFile.zips);
      out.production = p1 && p1.slices ? production(p1) : null;
      return out;
    } finally {
      clearTimeout(timer);
    }
  }

  return { load, reduce };
})();
