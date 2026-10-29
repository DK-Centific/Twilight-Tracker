/* Twilight Wrap · story player.
   ?mod=<first name or login> plays one moderator's Wrap; no parameter plays the project deck.
   ?autoplay=0|1 overrides the default (moderators autoplay, the deck waits for the presenter). */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parseD = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const isoD = dt => dt.toISOString().slice(0, 10);
  const fmtD = iso => { const d = parseD(iso); return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };
  const fmtN = (n, dec = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const plural = (n, one, many) => `${fmtN(n)} ${n === 1 ? one : many}`;
  const hour12 = h => `${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Count-up (spec §2): 900ms cubic ease-out, tabular, final value for screen readers. */
  function countUp(node, { delay = 0, dur = 900 } = {}) {
    const to = Number(node.dataset.to);
    const dec = Number(node.dataset.dec || 0);
    const label = fmtN(to, dec);
    node.innerHTML = `<span aria-hidden="true">${reduced.matches ? label : fmtN(0, dec)}</span><span class="sr-only">${label}</span>`;
    if (reduced.matches) return () => {};
    const shown = node.firstChild;
    let raf, t0;
    const start = performance.now() + delay;
    const step = now => {
      if (now < start) { raf = requestAnimationFrame(step); return; }
      t0 = t0 || now;
      const p = Math.min(1, (now - t0) / dur);
      shown.textContent = fmtN(to * (1 - (1 - p) ** 3), dec);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }
  const cu = (to, dec = 0, delay = 0) => `<span class="cu big-num" data-to="${to}" data-dec="${dec}" data-delay="${delay}">${fmtN(to, dec)}</span>`;

  /* The Centific mark as eight strokes: eight chevrons, like eight cameras pointed at one place. */
  const CHEVRONS = [
    ['M150 30 L256 82 L362 30', 0, -110], ['M108 72 L256 182 L404 72', 0, -70],
    ['M482 150 L430 256 L482 362', 110, 0], ['M442 108 L330 256 L442 404', 70, 0],
    ['M150 482 L256 430 L362 482', 0, 110], ['M108 440 L256 330 L404 440', 0, 70],
    ['M30 150 L82 256 L30 362', -110, 0], ['M70 108 L182 256 L70 404', -70, 0],
  ];
  const markSvg = () => `<svg class="mark-svg" viewBox="0 0 512 512" aria-hidden="true">${CHEVRONS.map(([d, x, y], i) =>
    `<path d="${d}" style="--i:${i};--tx:${x}px;--ty:${y}px"/>`).join('')}</svg>`;

  /* ---------------- Data ---------------- */
  async function load() {
    const get = url => fetch(url, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`); return r.json(); });
    const [data, manual, scorecard] = await Promise.all([
      get('data/wrap-data.json'), get('data/wrap-manual.json').catch(() => ({})), get('data/scorecard.json').catch(() => null),
    ]);
    return { data, manual, scorecard };
  }

  /* The Production1 log is the real record. When its Wrap view answers (?view=wrap on the
     status script), nights, weeks and homes come from it; Twilight bookings fill in the rest. */
  function applyLog(data) {
    const W = data.production && data.production.wrap;
    data.logBacked = { nights: !!data.log, homes: !!data.log };
    if (!W || data.log) return data;
    if (W.nights && Array.isArray(W.nightCounts) && W.nightCounts.length) {
      const counts = Object.fromEntries(W.nightCounts.map(n => [n.date, n.homes]));
      const dates = Object.keys(counts).sort();
      data.nightCounts = counts;
      data.season = { first: dates[0], last: dates[dates.length - 1], nights: dates.length, nightsList: dates };
      const weeks = {};
      dates.forEach(d => {
        const t = parseD(d); t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
        const k = isoD(t); weeks[k] = (weeks[k] || 0) + counts[d];
      });
      data.sessions = { ...data.sessions, perWeek: Object.keys(weeks).sort().map(w => ({ week: w, completed: weeks[w] })) };
      data.logBacked.nights = true;
    }
    if (W.completedHomes) {
      const n = W.completedHomes;
      // Window details (first night, miles) exist only for homes Twilight booked; the rest show their place in the count.
      const list = data.homes.list.slice(0, n);
      while (list.length < n) list.push({ date: null, miles: null });
      data.homes = { ...data.homes, count: n, list };
      data.people = { ...data.people, participants: n };
      data.logBacked.homes = true;
    }
    return data;
  }

  function findModerator(data, raw) {
    if (!raw) return null;
    const key = raw.replace(/-tw$/i, '').trim().toLowerCase();
    return Object.values(data.moderators).find(m => m.name.toLowerCase() === key) || null;
  }

  /* ---------------- Scenes ---------------- */
  function seasonWeeks(first, last) {
    const start = parseD(first); start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
    const end = parseD(last); end.setUTCDate(end.getUTCDate() + (6 - ((end.getUTCDay() + 6) % 7)));
    const weeks = [];
    for (let d = new Date(start); d <= end;) {
      const wk = [];
      for (let i = 0; i < 7; i++) { wk.push(isoD(d)); d.setUTCDate(d.getUTCDate() + 1); }
      weeks.push(wk);
    }
    return weeks;
  }

  function buildScenes({ data, manual, scorecard }, mod) {
    const D = data;
    const S = D.sessions;
    const peopleTotal = D.people.moderators + D.people.participants + D.people.reviewers + D.people.admins;
    const qaLabel = (manual.qa && manual.qa.zoneLabel) || 'China & Malaysia';
    const qaCities = (manual.qa && manual.qa.cityLabel) || 'Shanghai & Kuala Lumpur';
    const qaOffset = (manual.qa && manual.qa.utcOffset) || 8;
    const ptOffset = -7;
    const scenes = [];

    /* Opening */
    scenes.push({
      id: 'open', label: 'Opening', dur: 6500, light: ['50%', '34%'],
      html: () => `
        <div class="open">
          <div class="mark-wrap">${markSvg()}<img class="mark-img" src="assets/centific-mark-cyan.png" alt="Centific"></div>
          <h1 class="h-xl rise" style="--d:1500">${mod ? `${esc(mod.name)}, your Twilight.` : 'Twilight Wrap'}</h1>
          <p class="lede rise" style="--d:1750">${mod
            ? `${plural(mod.sessions, 'night', 'nights')} out with the cameras, ${fmtD(mod.firstNight)} to ${fmtD(mod.lastNight)}.`
            : `${fmtN(D.season.nights)} nights, ${fmtN(D.homes.count)} homes, one season after dark. ${fmtD(D.season.first)} to ${fmtD(D.season.last)}, 2026.`}</p>
          <p class="cue rise" style="--d:2200">Tap to turn the lights on</p>
        </div>`,
    });

    /* Nights strip */
    scenes.push({
      id: 'nights', label: 'Nights', dur: 9000, light: ['78%', '8%'],
      html: () => {
        const weeks = seasonWeeks(D.season.first, D.season.last);
        const mine = new Set(mod ? mod.nightsList : []);
        const counts = D.nightCounts;
        const busiest = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
        const busiestCount = Object.values(counts).filter(n => n === busiest[1]).length;
        const seasonDays = Math.round((parseD(D.season.last) - parseD(D.season.first)) / 864e5) + 1;
        let k = 0;
        const rows = weeks.map(wk => `<div class="cal-week"><span class="wk">${fmtD(wk[0])}</span>${wk.map(day => {
          const inSeason = day >= D.season.first && day <= D.season.last;
          const n = counts[day] || 0;
          if (!inSeason) return '<span class="day off" aria-hidden="true"></span>';
          const on = mod ? mine.has(day) : n > 0;
          const cls = on ? 'on' : (mod && n > 0 ? 'dim' : '');
          return `<button type="button" class="day ${cls}" data-i data-date="${day}" data-n="${Math.min(3, n)}" style="--i:${on ? k++ : 0}" aria-label="${fmtD(day)}, ${n ? plural(n, 'session', 'sessions') : 'no sessions'}">${parseD(day).getUTCDate()}</button>`;
        }).join('')}</div>`).join('');
        return `
          <div class="split">
            <div class="words">
              <h2 class="h-l rise" style="--d:500">${mod
                ? `You worked ${cu(mod.nights, 0, 700)} of our ${D.season.nights} nights.`
                : `${cu(D.season.nights, 0, 700)} nights under the porch light.`}</h2>
              <p class="lede rise" style="--d:700">${mod
                ? `Your first night was ${fmtD(mod.firstNight)}. Each lit square is a night you were out.`
                : `On ${D.season.nights} of the ${seasonDays} nights between ${fmtD(D.season.first)} and ${fmtD(D.season.last)}, a team was out with the cameras. The brighter the square, the more teams were out.`}</p>
              <p class="small rise" style="--d:900" data-read>${mod
                ? 'Tap a night to see how many teams were out with you.'
                : `${busiestCount > 1 ? `${busiestCount} nights` : fmtD(busiest[0])} had ${busiest[1]} teams out at once. Tap any night.`}</p>
            </div>
            <div class="cal" role="group" aria-label="Season calendar">
              <div class="cal-head" aria-hidden="true"><span></span>${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<span>${d}</span>`).join('')}</div>
              ${rows}
            </div>
          </div>`;
      },
      mount(root, api) {
        const read = $('[data-read]', root);
        const mine = new Set(mod ? mod.nightsList : []);
        api.on(root, '.day:not(.off)', el => {
          const day = el.dataset.date; const n = D.nightCounts[day] || 0;
          $$('.day.sel', root).forEach(x => x.classList.remove('sel'));
          api.say(read, mod
            ? `${fmtD(day)}: ${mine.has(day) ? `you were out, one of ${plural(n, 'team', 'teams')} that night.` : n ? `${plural(n, 'team', 'teams')} out, not you.` : 'a night off.'}`
            : `${fmtD(day)}: ${n ? `${plural(n, 'team', 'teams')} out` : 'a night off'}.`, true);
        });
      },
    });

    /* Weekly momentum (deck). Week 1 is the week of the first night. */
    const weekNo = w => Math.round((parseD(w) - parseD(D.sessions.perWeek[0].week)) / (7 * 864e5)) + 1;
    if (!mod) scenes.push({
      id: 'momentum', label: 'Momentum', dur: 9000, light: ['20%', '4%'],
      html: () => {
        const weeks = S.perWeek;
        const max = Math.max(...weeks.map(w => w.completed));
        const peak = weeks.find(w => w.completed === max);
        const peakEnd = parseD(peak.week); peakEnd.setUTCDate(peakEnd.getUTCDate() + 6);
        return `
          <div class="stack">
            <h2 class="h-l rise" style="--d:500">From ${weeks[0].completed} a week to ${cu(max, 0, 700)}.</h2>
            <p class="lede rise" style="--d:700" data-read>The team found its stride fast. Week ${weekNo(peak.week)} (${fmtD(peak.week)} to ${fmtD(isoD(peakEnd))}) was the high-water mark. Tap a week.</p>
            <div class="weeks" role="group" aria-label="Completed sessions per week">
              ${weeks.map((w, i) => `<button type="button" class="wcol${w.completed === max ? ' peak' : ''}" data-i data-week="${w.week}" data-n="${w.completed}" style="--i:${i}" aria-label="Week ${weekNo(w.week)}, ${plural(w.completed, 'session', 'sessions')}">
                <span class="wv">${w.completed}</span>
                <span class="wtrack"><span class="wbar" style="--h:${Math.max(2, (w.completed / max) * 100)}%"></span></span>
                <span class="wl">Week ${weekNo(w.week)}</span></button>`).join('')}
            </div>
          </div>`;
      },
      mount(root, api) {
        const read = $('[data-read]', root);
        api.on(root, '.wcol', el => {
          const end = parseD(el.dataset.week); end.setUTCDate(end.getUTCDate() + 6);
          api.say(read, `Week ${weekNo(el.dataset.week)}, ${fmtD(el.dataset.week)} to ${fmtD(isoD(end))}: ${plural(Number(el.dataset.n), 'session', 'sessions')} completed.`);
        });
      },
    });

    /* Homes */
    scenes.push({
      id: 'homes', label: 'Homes', dur: 9000, light: ['86%', '12%'],
      html: () => {
        const list = mod ? mod.homesList : D.homes.list;
        const n = list.length;
        const cols = n > 40 ? 13 : n > 16 ? 8 : Math.max(4, Math.ceil(Math.sqrt(n * 1.6)));
        const step = reduced.matches ? 0 : Math.min(60, 2400 / Math.max(1, n));
        return `
          <div class="split">
            <div class="words">
              <h2 class="h-l rise" style="--d:500">${mod
                ? `<span data-live>0</span> homes, and you were there for every one.`
                : `<span data-live>0</span> homes opened their doors.`}</h2>
              <p class="lede rise" style="--d:700">${mod
                ? `Out of ${D.homes.count} Twilight homes in all. Each window is a family you visited, lit in the order you got there.`
                : `Each window is a family who let us set up in their yard after dark, lit in the order we visited. All across ${D.homes.states.join(', ')}.`}</p>
              <p class="small rise" style="--d:900" data-read>Tap a window.</p>
            </div>
            <div class="homes" style="--cols:${cols}" role="group" aria-label="Homes">
              ${list.map((h, i) => `<button type="button" class="win lit" data-i data-k="${i}" style="--t:${Math.round(900 + i * step)}" aria-label="Home ${i + 1}${h.date ? `, first night ${fmtD(h.date)}` : ''}"></button>`).join('')}
            </div>
          </div>`;
      },
      mount(root, api) {
        const list = mod ? mod.homesList : D.homes.list;
        const n = list.length;
        const live = $('[data-live]', root);
        live.setAttribute('aria-label', String(n));
        const step = Math.min(60, 2400 / Math.max(1, n));
        if (reduced.matches) live.textContent = fmtN(n);
        else {
          const t0 = performance.now();
          const tick = now => {
            const lit = Math.max(0, Math.min(n, Math.floor((now - t0 - 900) / step) + 1));
            live.textContent = fmtN(lit);
            if (lit < n) api.raf(tick);
          };
          api.raf(tick);
        }
        const read = $('[data-read]', root);
        api.on(root, '.win', el => {
          const h = list[Number(el.dataset.k)];
          $$('.win.sel', root).forEach(x => x.classList.remove('sel'));
          el.classList.add('sel');
          api.say(read, h.date
            ? `Home ${Number(el.dataset.k) + 1}: first night ${fmtD(h.date)}${h.miles != null ? `, ${fmtN(h.miles, 1)} miles from the office` : ''}.`
            : `Home ${Number(el.dataset.k) + 1} of ${list.length}.`);
        });
      },
    });

    /* Miles */
    scenes.push({
      id: 'miles', label: 'Miles', dur: 10000, light: ['4%', '30%'],
      html: () => {
        const M = mod ? mod.miles : D.miles;
        const total = mod ? mod.miles.total : D.miles.roundTripTotal;
        // Road miles: Seattle to Los Angeles is about 1,135; Seattle to Portland about 175.
        const longDrive = total > 2270 ? ' Farther than driving from Seattle to Los Angeles and back.' : total > 1135 ? ' Farther than driving from Seattle to Los Angeles.' : total > 350 ? ' Farther than driving from Seattle to Portland and back.' : '';
        return `
          <div class="stack">
            <h2 class="h-l rise" style="--d:500">${fmtN(M.shortest, 1)} to ${cu(M.farthest, 1, 700)} miles${mod ? ' out.' : ' from home base.'}</h2>
            <p class="lede rise" style="--d:700">${cu(total, 0, 900)} miles there and back from the Centific office in Redmond, as the crow flies.${longDrive}</p>
            <div class="road" data-road>
              <div class="road-line"></div>
              <span class="road-office" title="Centific office, Redmond"><img src="assets/centific-mark-cyan.png" alt="Centific office"></span>
              <div class="radius" data-radius></div>
              <div data-dots></div>
              <button type="button" class="radius-handle" data-i data-handle role="slider" aria-label="Distance from the office" aria-valuemin="0" aria-valuemax="45" aria-valuenow="10"></button>
              <div class="road-axis" aria-hidden="true" data-axis></div>
            </div>
            <p class="radius-read" data-read aria-live="polite"></p>
          </div>`;
      },
      mount(root, api) {
        const all = D.homes.list.filter(h => h.miles != null);
        const mine = mod ? mod.homesList.filter(h => h.miles != null) : all;
        const scale = Math.ceil(Math.max(...all.map(h => h.miles)) / 5) * 5;
        const x = m => (m / scale) * 100;
        const dots = $('[data-dots]', root);
        const lanes = [];
        const place = (list, cls) => list.slice().sort((a, b) => a.miles - b.miles).map((h, i) => {
          let lane = 0;
          while (lanes[lane] != null && x(h.miles) - lanes[lane] < 1.5) lane++;
          lanes[lane] = x(h.miles);
          const off = lane === 0 ? 0 : (lane % 2 ? -1 : 1) * Math.ceil(lane / 2);
          return `<button type="button" class="dot ${cls}" data-i data-m="${h.miles}" data-date="${h.date}" style="left:${x(h.miles)}%;top:${Math.max(4, Math.min(92, 50 + off * 6))}%;--i:${i}" aria-label="${fmtN(h.miles, 1)} miles, ${fmtD(h.date)}"></button>`;
        }).join('');
        // A moderator's own homes take the centre lanes, lit; every Twilight home sits around them, unlit.
        if (mod) { const own = place(mine, 'mine'); dots.innerHTML = own + place(all, 'faint'); }
        else dots.innerHTML = place(all, '');
        const tickStep = scale > 30 ? 10 : 5;
        $('[data-axis]', root).innerHTML = Array.from({ length: Math.floor(scale / tickStep) + 1 }, (_, k) => `<span style="position:absolute;left:${x(k * tickStep)}%;transform:translateX(-50%)">${k * tickStep} mi</span>`).join('');

        const road = $('[data-road]', root);
        const handle = $('[data-handle]', root);
        const radiusEl = $('[data-radius]', root);
        const read = $('[data-read]', root);
        let radius = 10;
        const set = r => {
          radius = Math.max(1, Math.min(scale, Math.round(r)));
          radiusEl.style.width = `${x(radius)}%`; handle.style.left = `${x(radius)}%`;
          handle.setAttribute('aria-valuenow', radius);
          handle.setAttribute('aria-valuetext', `${radius} miles`);
          const inside = mine.filter(h => h.miles <= radius).length;
          $$('.dot', root).forEach(d => d.classList.toggle('out', Number(d.dataset.m) > radius && !d.classList.contains('faint')));
          api.say(read, `<b>${plural(inside, mod ? 'of your homes' : 'home', mod ? 'of your homes' : 'homes')}</b> within <b>${radius} miles</b> of the office.${mod ? ' Grey dots are every Twilight home.' : ''} Drag to explore.`, true);
        };
        set(10);
        let dragging = false;
        const fromEvent = e => { const r = road.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * scale); };
        handle.addEventListener('pointerdown', e => { dragging = true; handle.classList.add('drag'); handle.setPointerCapture(e.pointerId); api.pause(); e.stopPropagation(); });
        handle.addEventListener('pointermove', e => { if (dragging) fromEvent(e); });
        const end = () => { dragging = false; handle.classList.remove('drag'); };
        handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
        handle.addEventListener('keydown', e => {
          const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 5, PageDown: -5 }[e.key];
          if (d) { e.preventDefault(); e.stopPropagation(); api.pause(); set(radius + d); }
        });
        api.on(root, '.dot', el => {
          $$('.dot.sel', root).forEach(d => d.classList.remove('sel'));
          el.classList.add('sel');
          api.tip(el, `${fmtN(Number(el.dataset.m), 1)} miles`, `First night ${fmtD(el.dataset.date)}`);
        });
      },
    });

    /* People / partners */
    scenes.push({
      id: 'people', label: mod ? 'Partners' : 'People', dur: 10000, light: ['50%', '2%'],
      html: () => mod ? `
          <div class="split">
            <div class="words">
              <h2 class="h-l rise" style="--d:500">You teamed up with ${cu(mod.partners.length, 0, 700)} moderators.</h2>
              <p class="lede rise" style="--d:700">${mod.partners.length ? `Most nights with ${esc(mod.partners[0].name)}: ${mod.partners[0].nights}.` : ''} Thicker lines are more nights together.</p>
              <p class="pick-read rise" style="--d:900" data-read>Tap a partner.</p>
            </div>
            <div class="sky" data-sky><svg viewBox="0 0 100 80" preserveAspectRatio="none" aria-hidden="true" data-lines></svg></div>
          </div>` : `
          <div class="split">
            <div class="words">
              <h2 class="h-l rise" style="--d:500">${cu(peopleTotal, 0, 700)} people made it happen.</h2>
              <div class="legend rise" style="--d:800">
                <div><b>${D.people.moderators}</b><span>moderators in the field</span></div>
                <div><b>${D.people.participants}</b><span>hosts who opened their homes</span></div>
                <div><b>${D.people.reviewers}</b><span>QA reviewers</span></div>
                <div><b>${D.people.admins}</b><span>admins behind the scenes</span></div>
              </div>
              <p class="pick-read rise" style="--d:1000" data-read>${D.people.pairings} different partnerships in the field. Tap a star to see who teamed up.</p>
            </div>
            <div class="sky" data-sky><svg viewBox="0 0 100 80" preserveAspectRatio="none" aria-hidden="true" data-lines></svg></div>
          </div>`,
      mount(root, api) {
        const sky = $('[data-sky]', root);
        const svg = $('[data-lines]', root);
        const read = $('[data-read]', root);
        const bySessions = D.people.sessionsByModerator;
        const pos = {};
        let names, pairs;
        if (mod) {
          names = [mod.name, ...mod.partners.map(p => p.name)];
          pos[mod.name] = [50, 50];
          mod.partners.forEach((p, i) => {
            const a = (i / mod.partners.length) * Math.PI * 2 - Math.PI / 2;
            pos[p.name] = [50 + Math.cos(a) * 36, 50 + Math.sin(a) * 38];
          });
          pairs = mod.partners.map(p => ({ a: mod.name, b: p.name, nights: p.nights }));
        } else {
          names = D.people.moderatorNames.slice().sort((a, b) => bySessions[b] - bySessions[a]);
          // Busiest moderators sit nearer the middle of the sky.
          names.forEach((n, i) => {
            const ring = i < 4 ? 0.42 : 1;
            const count = i < 4 ? 4 : names.length - 4;
            const j = i < 4 ? i : i - 4;
            const a = (j / count) * Math.PI * 2 + (i < 4 ? 0.6 : 0.2);
            pos[n] = [50 + Math.cos(a) * 40 * ring, 50 + Math.sin(a) * 40 * ring];
          });
          pairs = D.people.pairs;
        }
        const ar = 0.8; // svg viewBox is 100 x 80
        const dust = mod ? '' : Array.from({ length: D.people.participants + D.people.reviewers + D.people.admins }, (_, i) => {
          const a = i * 2.39996; const r = 46 + (i % 7) * 1.2;
          return `<circle class="dust" cx="${50 + Math.cos(a) * r}" cy="${(50 + Math.sin(a) * r * 0.92) * ar}" r="0.35"/>`;
        }).join('');
        svg.innerHTML = dust + pairs.map((p, i) => {
          const [x1, y1] = pos[p.a]; const [x2, y2] = pos[p.b];
          return `<line class="edge" data-a="${esc(p.a)}" data-b="${esc(p.b)}" x1="${x1}" y1="${y1 * ar}" x2="${x2}" y2="${y2 * ar}" stroke-width="${0.6 + p.nights * 0.55}" vector-effect="non-scaling-stroke" style="--i:${i}"/>`;
        }).join('');
        const max = Math.max(...names.map(n => bySessions[n] || 1));
        sky.insertAdjacentHTML('beforeend', names.map((n, i) => {
          const s = 10 + ((bySessions[n] || 1) / max) * 14;
          const me = mod && n === mod.name;
          return `<button type="button" class="star${me ? ' me' : ''}" data-i data-name="${esc(n)}" style="left:${pos[n][0]}%;top:${pos[n][1]}%;--s:${s.toFixed(1)}px;--i:${i}" aria-label="${esc(n)}, ${plural(bySessions[n] || 0, 'session', 'sessions')}"><i></i><span>${me ? 'You' : esc(n)}</span></button>`;
        }).join(''));
        let focused = null;
        const clear = () => { focused = null; sky.classList.remove('focus'); $$('.on,.near', sky).forEach(x => x.classList.remove('on', 'near')); };
        api.on(root, '.star', el => {
          const n = el.dataset.name;
          if (focused === n) { clear(); api.say(read, mod ? 'Tap a partner.' : 'Tap a star to see who teamed up.'); return; }
          clear(); focused = n; sky.classList.add('focus'); el.classList.add('on');
          const mine = pairs.filter(p => p.a === n || p.b === n).sort((a, b) => b.nights - a.nights);
          mine.forEach(p => {
            $$(`.edge[data-a="${CSS.escape(p.a)}"][data-b="${CSS.escape(p.b)}"]`, svg).forEach(e => e.classList.add('on'));
            const other = p.a === n ? p.b : p.a;
            const st = $(`.star[data-name="${CSS.escape(other)}"]`, sky); if (st) st.classList.add('near');
          });
          if (mod && n !== mod.name) {
            const p = mod.partners.find(x => x.name === n);
            api.say(read, `<b>${esc(n)}</b> and you: ${plural(p.nights, 'night', 'nights')} together.`, true);
          } else {
            const top = mine[0];
            api.say(read, `<b>${esc(n)}</b>: ${plural(bySessions[n] || 0, 'session', 'sessions')}, with ${plural(mine.length, 'partner', 'partners')}.${top ? ` Most often with ${esc(top.a === n ? top.b : top.a)} (${plural(top.nights, 'night', 'nights')}).` : ''}`, true);
          }
        });
      },
    });

    /* QA: results first (Production1 QA Status), then when the reviews happened */
    const qaPartsOf = q => [
      { k: 'approved', label: 'Approved', n: q.approved, c: 'var(--lamp-hi)', note: `Approved: ${q.approved} sessions met the bar.` },
      { k: 'rejected', label: 'Sent back', n: q.rejected, c: 'var(--miss)', note: `Sent back: ${q.rejected} sessions did not meet the bar.` },
      { k: 'none', label: 'Not reviewed', n: q.notReviewed, c: 'var(--ink-3)', note: `Not reviewed: ${q.notReviewed} completed sessions were not put through review.` },
    ].filter(p => p.n > 0);
    if (D.qa && D.qa.decisions) scenes.push({
      id: 'qa', label: 'QA', dur: 11000, light: ['92%', '50%'],
      html: () => {
        const hrs = D.qa.byPacificHour;
        const peakPt = hrs.indexOf(Math.max(...hrs));
        const peakQa = (peakPt - ptOffset + qaOffset + 24) % 24;
        const qaStatus = D.qa.status;
        const qaParts = qaStatus ? qaPartsOf(qaStatus) : [];
        return `
          <div class="split">
            <div class="words">
              ${qaStatus ? `
              <h2 class="h-l rise" style="--d:500">${cu(qaStatus.approved, 0, 700)} of ${qaStatus.completed} sessions passed QA.</h2>
              <div class="qa-bar rise" style="--d:800" data-qabar>${qaParts.map(p => `<button type="button" class="seg-s" data-i data-q="${p.k}" style="--n:${p.n};--c:${p.c}" aria-label="${p.label}: ${p.n}">${p.n}</button>`).join('')}</div>
              <div class="qa-keys rise" style="--d:900">${qaParts.map(p => `<button type="button" class="key" data-i data-q="${p.k}" style="--c:${p.c}"><span>${p.label}</span></button>`).join('')}</div>
              <p class="lede rise" style="--d:1000" data-read>And they were checked live. While Seattle slept, our QA team in ${esc(qaLabel.replace('&', 'and'))} was mid-afternoon, reviewing uploads as they landed. Peak hour: ${hour12(peakPt)} here, ${hour12(peakQa)} there.</p>`
              : `
              <h2 class="h-l rise" style="--d:500">While Seattle slept, QA was wide awake.</h2>
              <p class="lede rise" style="--d:700">Our QA reviewers in ${esc(qaLabel.replace('&', 'and'))} checked uploads live, in their afternoon. Busiest hour: ${hour12(peakPt)} in Seattle, ${hour12(peakQa)} in ${esc(qaCities)}.</p>`}
              <div class="seg rise" style="--d:1100" role="group" aria-label="Show the clock in" data-seg>
                <span class="seg-pill no-anim" aria-hidden="true"></span>
                <button type="button" data-i data-zone="pt" aria-pressed="true">Seattle time</button>
                <button type="button" data-i data-zone="qa" aria-pressed="false">${esc(qaLabel)} time</button>
              </div>
            </div>
            <div class="dial">
              <svg viewBox="0 0 400 400" role="img" aria-label="Review decisions by hour of day">
                <g class="dial-rot" data-rot>
                  ${(() => {
                    // Shade Seattle's night (7 PM to 6 AM) so the rotation shows where it falls elsewhere.
                    const arc = (h0, h1, r0, r1) => {
                      const a0 = (h0 / 24) * 2 * Math.PI - Math.PI / 2; const a1 = (h1 / 24) * 2 * Math.PI - Math.PI / 2;
                      const p = (r, a) => `${200 + r * Math.cos(a)} ${200 + r * Math.sin(a)}`;
                      const large = ((h1 - h0 + 24) % 24) > 12 ? 1 : 0;
                      return `M${p(r1, a0)} A${r1} ${r1} 0 ${large} 1 ${p(r1, a1)} L${p(r0, a1)} A${r0} ${r0} 0 ${large} 0 ${p(r0, a0)}Z`;
                    };
                    const max = Math.max(...hrs);
                    const bars = hrs.map((v, h) => {
                      const a = ((h + 0.5) / 24) * 360 - 90;
                      const len = v ? 10 + (v / max) * 78 : 3;
                      return `<rect class="hr${v ? '' : ' zero'}" x="${200 + 96}" y="${200 - 5}" width="${len}" height="10" rx="5" transform="rotate(${a} 200 200)" style="--i:${h}" data-hour="${h}" data-v="${v}"><title>${hour12(h)} Seattle: ${v} decisions</title></rect>`;
                    }).join('');
                    return `<path class="night-arc" d="${arc(19, 30, 92, 190)}"/>${bars}`;
                  })()}
                </g>
                ${[0, 6, 12, 18].map(h => {
                  const a = (h / 24) * 2 * Math.PI - Math.PI / 2;
                  return `<text class="tick" x="${200 + 80 * Math.cos(a)}" y="${200 + 80 * Math.sin(a) + 4}" text-anchor="middle">${h === 0 ? 'midnight' : h === 12 ? 'noon' : hour12(h)}</text>`;
                }).join('')}
              </svg>
              <div class="dial-center"><b>${cu(D.qa.decisions, 0, 900)}</b><span>review decisions</span><span>${Math.round(D.qa.nightShare * 100)}% overnight in Seattle</span></div>
            </div>
          </div>`;
      },
      mount(root, api) {
        const seg = $('[data-seg]', root);
        const pill = $('.seg-pill', seg);
        const rot = $('[data-rot]', root);
        const turn = ((qaOffset - ptOffset) / 24) * 360;
        const place = () => {
          const b = $('[aria-pressed="true"]', seg);
          pill.style.width = `${b.offsetWidth}px`; pill.style.height = `${b.offsetHeight}px`;
          pill.style.transform = `translate(${b.offsetLeft}px, ${b.offsetTop}px)`;
        };
        const choose = (zone, user) => {
          $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.zone === zone)));
          pill.classList.remove('no-anim'); place();
          rot.style.transform = zone === 'qa' ? `rotate(${turn}deg)` : '';
          if (user) auto && clearTimeout(auto);
        };
        requestAnimationFrame(place);
        const ro = new ResizeObserver(() => { pill.classList.add('no-anim'); place(); });
        ro.observe(seg);
        api.cleanup(() => ro.disconnect());
        // Show the turn once on its own, so the story makes the point even if nobody taps.
        let auto = setTimeout(() => choose('qa', false), reduced.matches ? 2500 : 4200);
        api.cleanup(() => clearTimeout(auto));
        api.on(root, '[data-zone]', el => choose(el.dataset.zone, true));
        if (D.qa.status) {
          const parts = qaPartsOf(D.qa.status); const read = $('[data-read]', root); const lede = read.innerHTML; const bar = $('[data-qabar]', root);
          let cur = null;
          api.on(root, '[data-q]', el => {
            cur = cur === el.dataset.q ? null : el.dataset.q;
            bar.classList.toggle('focus', !!cur);
            $$('[data-q]', root).forEach(x => x.classList.toggle('on', x.dataset.q === cur));
            api.say(read, cur ? esc(parts.find(p => p.k === cur).note) : lede, true);
          });
        }
        api.on(root, '.hr', el => api.tip(el, `${hour12(Number(el.dataset.hour))} Seattle · ${hour12((Number(el.dataset.hour) - ptOffset + qaOffset + 24) % 24)} ${qaLabel.split(' ')[0]}`, `${el.dataset.v} decisions`));
      },
    });

    /* Kit */
    scenes.push({
      id: 'kit', label: 'Kit', dur: 10000, light: ['30%', '0%'],
      html: () => {
        const share = mod ? Math.round((mod.scenarios / D.kit.scenariosCaptured) * 100) : null;
        const yard = (name, k0) => `
          <div class="yard"><span class="glow"></span>
            <h3>${name} · <span data-state>Lights on</span></h3>
            ${['Kit 1', 'Kit 2'].map((kit, r) => `<div class="rig"><p>${kit}</p>${Array.from({ length: D.kit.camerasPerKit }, (_, c) => `<span class="cam" style="--i:${k0 + r * 4 + c}"></span>`).join('')}</div>`).join('')}
          </div>`;
        return `
          <div class="split even">
            <div class="words">
              <h2 class="h-l rise" style="--d:500">${mod ? `You captured ${cu(mod.scenarios, 0, 700)} scenarios.` : `${D.kit.kits} kits. ${D.kit.cameras} cameras. Every scene, twice.`}</h2>
              <p class="lede rise" style="--d:700">${mod
                ? `That's ${share}% of every capture in Twilight. Lights on, then lights off, every single time.`
                : `Lights on, then lights off. Front yard, then backyard. ${cu(D.kit.scenariosCaptured, 0, 900)} scenario captures uploaded, one porch light at a time.`}</p>
              <button type="button" class="switch rise" style="--d:900" role="switch" aria-checked="true" data-i data-switch><span class="track"><span class="knob"></span></span><span data-switch-label>Lights on</span></button>
            </div>
            <div class="kit" data-kit>
              <div class="yards">${yard('Front Yard', 0)}${yard('Backyard', 8)}</div>
              <p class="small">${D.kit.stations} stations: ${D.kit.stationNames.join(', ')}.${D.kit.kitSets ? ` ${D.kit.kitSets} kit sets kept in rotation all season.` : ''}</p>
            </div>
          </div>`;
      },
      mount(root, api) {
        const sw = $('[data-switch]', root);
        const kit = $('[data-kit]', root);
        const set = on => {
          sw.setAttribute('aria-checked', String(on));
          kit.classList.toggle('dark', !on);
          $('[data-switch-label]', root).textContent = on ? 'Lights on' : 'Lights off';
          $$('[data-state]', root).forEach(s => { s.textContent = on ? 'Lights on' : 'Lights off'; });
        };
        let auto = setTimeout(() => set(false), 4600);
        api.cleanup(() => clearTimeout(auto));
        api.on(root, '[data-switch]', () => { clearTimeout(auto); set(sw.getAttribute('aria-checked') !== 'true'); });
      },
    });

    /* Sessions (deck): outcomes from the Production1 log, the same source as Admin -> Overview.
       Falls back to Twilight bookings only when that log could not be read. */
    const sessionParts = () => {
      const P = D.production;
      if (P && P.total) {
        const look = {
          Completed: ['var(--lamp-hi)', 'Completed: captured start to finish.'],
          Cancelled: ['var(--miss)', 'Cancelled: nights that did not go ahead.'],
          'Not complete': ['var(--ink-3)', 'Not complete: started, but could not be finished.'],
          Confirmed: ['var(--ink-2)', 'Confirmed: booked and ready to go.'],
        };
        return {
          total: P.total, completed: (P.slices.find(x => x.status === 'Completed') || { count: 0 }).count,
          lede: 'Not every night goes to plan. Here is how every one played out. Tap a part.',
          parts: P.slices.filter(x => x.count > 0).map((x, i) => ({
            k: `p${i}`, label: x.status, n: x.count,
            c: (look[x.status] || ['var(--ink-2)'])[0], note: (look[x.status] || [null, `${x.status}.`])[1],
          })),
        };
      }
      const S = D.sessions;
      return {
        total: S.booked, completed: S.completed,
        lede: 'Not every night goes to plan. Here is how every one played out. Tap a part.',
        parts: [
          { k: 'b0', label: 'Completed', n: S.completed, c: 'var(--lamp-hi)', note: 'Completed: reached the end of the checklist.' },
          { k: 'b1', label: 'Cancelled', n: S.cancelled, c: 'var(--miss)', note: 'Cancelled: called off before or during the night.' },
          { k: 'b2', label: 'Rescheduled', n: S.rescheduled, c: 'var(--ink-2)', note: 'Rescheduled: moved to another night.' },
          { k: 'b3', label: 'No finish recorded', n: S.incomplete, c: 'var(--ink-3)', note: 'No finish recorded: nights that never reached the end.' },
        ].filter(p => p.n > 0),
      };
    };
    if (!mod) scenes.push({
      id: 'sessions', label: 'Sessions', dur: 10000, light: ['50%', '100%'],
      html: () => {
        const { total, completed, lede, parts } = sessionParts();
        return `
          <div class="stack">
            <h2 class="h-l rise" style="--d:500">${cu(total, 0, 700)} sessions scheduled. ${cu(completed, 0, 900)} in the books.</h2>
            <p class="lede rise" style="--d:700" data-read>${lede}</p>
            <div class="stackbar" data-bar>${parts.map(p => `<button type="button" class="seg-s" data-i data-k="${p.k}" style="--n:${p.n};--c:${p.c}" aria-label="${esc(p.label)}: ${p.n}">${Math.round((p.n / total) * 100)}%</button>`).join('')}</div>
            <div class="keys">${parts.map((p, i) => `<button type="button" class="key rise" data-i data-k="${p.k}" style="--c:${p.c};--d:${1100 + i * 80}"><b>${fmtN(p.n)}</b><span>${esc(p.label)}</span></button>`).join('')}</div>
          </div>`;
      },
      mount(root, api) {
        const { lede, parts } = sessionParts();
        const read = $('[data-read]', root); const bar = $('[data-bar]', root);
        let cur = null;
        api.on(root, '[data-k]', el => {
          const k = el.dataset.k;
          cur = cur === k ? null : k;
          bar.classList.toggle('focus', !!cur);
          $$('[data-k]', root).forEach(x => x.classList.toggle('on', x.dataset.k === cur));
          api.say(read, cur ? parts.find(p => p.k === cur).note : lede);
        });
      },
    });

    /* Moderator Quality Scorecard (deck only): a ranked board, then a spotlight card.
       Quality = approval (40) + availability (25) + reliability (10), out of 100. */
    const SC = !mod && scorecard && scorecard.moderators && scorecard.moderators.length ? scorecard : null;
    const pct = v => (v == null ? '–' : `${Math.round(v * 100)}%`);
    const SORTS = {
      score: { label: 'Quality', val: c => c.score, show: c => fmtN(c.score, 1), max: () => 100, asc: false },
      approval: { label: 'Approval', val: c => c.approvalRate, show: c => pct(c.approvalRate), max: () => 1, asc: false },
      availability: { label: 'Availability', val: c => c.availability, show: c => pct(c.availability), max: () => 1, asc: false },
      hours: { label: 'Hrs / session', val: c => c.hoursPerSession, show: c => `${fmtN(c.hoursPerSession, 1)} h`, max: () => Math.max(...SC.moderators.map(m => m.hoursPerSession || 0)), asc: true },
    };
    // Bars start just below the lowest value (stated on screen), so a 83-to-100 spread is visible.
    const domain = k => {
      const S = SORTS[k];
      const vals = SC.moderators.map(S.val).filter(v => v != null);
      const top = S.max();
      const step = top > 1.5 ? (top > 50 ? 5 : 1) : 0.05;
      const lo = Math.max(0, Math.floor((Math.min(...vals) - step) / step) * step);
      return { lo, hi: top, width: v => `${Math.max(3, ((v - lo) / (top - lo)) * 100)}%`,
        label: top > 1.5 ? (top > 50 ? `Scale ${lo} to ${top}` : `Scale ${fmtN(lo, 0)} to ${fmtN(top, 0)} h`) : `Scale ${Math.round(lo * 100)}% to 100%` };
    };
    const cardLine = c => `<b>${esc(c.name)}</b>: ${c.assigned} assigned, ${c.completed} completed, ${c.approved} approved, ${c.rejected} sent back, ${c.cancelled} cancelled. Available ${c.nightsTracked - c.nightsUnavailable} of ${c.nightsTracked} nights. ${fmtN(c.hours, 0)} hours logged, ${fmtN(c.hoursPerSession, 1)} per session.${c.lowVolume ? ' Small sample, read with care.' : ''}`;
    if (SC) scenes.push({
      id: 'scorecard', label: 'Scorecard', dur: 14000, light: ['70%', '0%'],
      html: () => {
        const top = SC.moderators[0];
        return `
          <div class="split sc-split">
            <div class="words">
              <h2 class="h-l rise" style="--d:500">${SC.team.moderators} moderators. A ${cu(SC.team.averageScore, 1, 700)} quality average.</h2>
              <p class="lede rise" style="--d:700">${pct(SC.team.approvalRate)} of reviewed sessions passed QA, and the team was on call ${pct(SC.team.availability)} of nights. Not one of the season's cancellations came down to a moderator${SC.excluded && SC.excluded.clientRequested ? `, and the ${SC.excluded.clientRequested} sessions the client called off during the Ring login outage are not counted at all` : ''}.</p>
              <div class="seg rise" style="--d:900" role="group" aria-label="Rank by" data-sort>
                <span class="seg-pill no-anim" aria-hidden="true"></span>
                ${Object.entries(SORTS).map(([k, v], i) => `<button type="button" data-i data-k="${k}" aria-pressed="${i === 0}">${v.label}</button>`).join('')}
              </div>
              <p class="small rise" style="--d:1000" data-read>Top of the board: ${esc(top.name)}, ${fmtN(top.score, 1)}. Tap anyone for their numbers.</p>
            </div>
            <div class="board-wrap">
            <p class="board-scale mono" data-scale aria-hidden="true">${domain('score').label}</p>
            <ol class="board" data-board aria-label="Moderator ranking">
              ${SC.moderators.map((c, i) => `<li class="brow" data-name="${esc(c.name)}" style="--i:${i}">
                <button type="button" class="bbtn" data-i data-pick="${esc(c.name)}">
                  <span class="rk mono">${i + 1}</span><span class="nm">${esc(c.name)}${c.lowVolume ? '<em>low volume</em>' : ''}</span>
                  <span class="bt"><i style="--w:${domain('score').width(c.score)}"></i></span><b class="sv">${fmtN(c.score, 1)}</b>
                </button></li>`).join('')}
            </ol>
            </div>
          </div>`;
      },
      mount(root, api) {
        const board = $('[data-board]', root);
        const seg = $('[data-sort]', root);
        const pill = $('.seg-pill', seg);
        const read = $('[data-read]', root);
        const byName = Object.fromEntries(SC.moderators.map(c => [c.name, c]));
        const place = () => {
          const b = $('[aria-pressed="true"]', seg);
          pill.style.width = `${b.offsetWidth}px`; pill.style.height = `${b.offsetHeight}px`;
          pill.style.transform = `translate(${b.offsetLeft}px, ${b.offsetTop}px)`;
        };
        requestAnimationFrame(place);
        const ro = new ResizeObserver(() => { pill.classList.add('no-anim'); place(); });
        ro.observe(seg); api.cleanup(() => ro.disconnect());
        // Re-rank with FLIP: rows slide from where they were to where they now belong.
        const sortBy = k => {
          const S = SORTS[k];
          $$('button', seg).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === k)));
          pill.classList.remove('no-anim'); place();
          const rows = $$('.brow', board);
          const before = new Map(rows.map(r => [r, r.getBoundingClientRect().top]));
          const dm = domain(k);
          $('[data-scale]', root).textContent = dm.label;
          rows.sort((a, b) => {
            const va = S.val(byName[a.dataset.name]), vb = S.val(byName[b.dataset.name]);
            return (S.asc ? va - vb : vb - va) || byName[b.dataset.name].completed - byName[a.dataset.name].completed;
          });
          rows.forEach((r, i) => {
            const c = byName[r.dataset.name];
            board.appendChild(r);
            $('.rk', r).textContent = i + 1;
            $('.sv', r).textContent = S.show(c);
            $('.bt i', r).style.setProperty('--w', dm.width(S.val(c)));
          });
          if (reduced.matches) return;
          rows.forEach(r => {
            const dy = before.get(r) - r.getBoundingClientRect().top;
            if (!dy) return;
            r.animate([{ transform: `translateY(${dy}px)` }, { transform: 'none' }], { duration: 450, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
          });
        };
        api.on(root, '[data-k]', el => sortBy(el.dataset.k));
        api.on(root, '[data-pick]', el => {
          $$('.brow.on', board).forEach(r => r.classList.remove('on'));
          el.parentElement.classList.add('on');
          api.say(read, cardLine(byName[el.dataset.pick]), true);
        });
      },
    });

    if (SC) scenes.push({
      id: 'spotlight', label: 'Spotlight', dur: 16000, light: ['18%', '10%'],
      html: () => `
        <div class="split even sc-split spot-scene" data-ss>
          <div class="words">
            <h2 class="h-l rise" style="--d:500">Every moderator, under the porch light.</h2>
            <p class="lede rise" style="--d:700">Scored on approval rate (40), availability (25) and reliability (10). Car and incident checks were not tracked for Twilight, so they sit out of the score. Hours are everything logged, field nights and team syncs alike.</p>
            <div class="chips rise" style="--d:900" role="group" aria-label="Choose a moderator" data-chips>
              <button type="button" class="chip chip-all" data-i data-all aria-pressed="false">All</button>
              ${SC.moderators.map(c => `<button type="button" class="chip" data-i data-who="${esc(c.name)}" aria-pressed="false">${esc(c.name)}</button>`).join('')}
            </div>
            <div class="allview" data-allview hidden></div>
          </div>
          <article class="spot rise" style="--d:800" data-spot aria-live="polite"></article>
        </div>`,
      mount(root, api) {
        const spot = $('[data-spot]', root);
        const meter = v => `<span class="meter" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i class="${i < Math.round((v || 0) * 10) ? 'on' : ''}" style="--j:${i}"></i>`).join('')}</span>`;
        const ss = $('[data-ss]', root);
        const allview = $('[data-allview]', root);
        const allBtn = $('[data-all]', root);
        // "All" swaps the scene for one table of every moderator; a name brings the card back.
        const showAll = () => {
          clearInterval(timer);
          // The entrance has played; switching views from here on is instant (the card fades via .swap-in).
          $$('.rise', ss).forEach(el => el.classList.remove('rise'));
          ss.classList.add('all');
          allBtn.setAttribute('aria-pressed', 'true');
          $$('.chip[data-who]', root).forEach(b => b.setAttribute('aria-pressed', 'false'));
          const cols = [
            ['Score', c => fmtN(c.score, 1), 'score'], ['Assigned', c => c.assigned], ['Completed', c => c.completed],
            ['Approved', c => c.approved], ['Sent back', c => c.rejected], ['Cancelled', c => c.cancelled],
            ['Approval', c => pct(c.approvalRate)], ['Availability', c => pct(c.availability)], ['Hrs / session', c => fmtN(c.hoursPerSession, 1)],
          ];
          allview.innerHTML = `
            <div class="all-scroll view-enter">
              <table class="all-table">
                <thead><tr><th scope="col">#</th><th scope="col">Moderator</th>${cols.map(([h]) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
                <tbody>${SC.moderators.map((c, i) => `<tr class="row-in${i < 3 ? ' lit-row' : ''}" style="--i:${i}" data-i data-who="${esc(c.name)}">
                  <td class="mono">${c.rank}</td>
                  <th scope="row"><button type="button" data-i data-who="${esc(c.name)}">${esc(c.name)}</button>${c.lowVolume ? '<em>low volume</em>' : ''}</th>
                  ${cols.map(([, f, k]) => `<td class="${k === 'score' ? 'sc' : ''}">${f(c)}</td>`).join('')}</tr>`).join('')}
                </tbody>
              </table>
            </div>
            <p class="small">Team: ${fmtN(SC.team.averageScore, 1)} average score, ${pct(SC.team.approvalRate)} approval, ${pct(SC.team.availability)} availability, ${fmtN(SC.team.hours, 0)} hours logged.${SC.excluded && SC.excluded.clientRequested ? ` Leaves out the ${SC.excluded.clientRequested} sessions the client cancelled.` : ''} Tap a name for their card.</p>`;
          allview.hidden = false;
        };
        // Score counts from the last card's value to this one (spec: count from the last shown value).
        let shownScore = 0;
        const countScore = (el, to) => {
          const from = shownScore; shownScore = to;
          if (reduced.matches || from === to) { el.textContent = fmtN(to, 1); return; }
          const t0 = performance.now();
          const step = now => {
            const p = Math.min(1, (now - t0) / 900);
            el.textContent = fmtN(from + (to - from) * (1 - (1 - p) ** 3), 1);
            if (p < 1) api.raf(step);
          };
          api.raf(step);
        };
        let swapT = null;
        const show = c => {
          // Fade the current card out (exit is faster than enter), then bring the next one in.
          if (spot.childElementCount && !reduced.matches && !ss.classList.contains('all')) {
            spot.classList.add('leaving');
            clearTimeout(swapT);
            swapT = setTimeout(() => { spot.classList.remove('leaving'); paint(c); }, 160);
            $$('.chip[data-who]', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.who === c.name)));
            return;
          }
          paint(c);
        };
        api.cleanup(() => clearTimeout(swapT));
        const paint = c => {
          ss.classList.remove('all');
          allview.hidden = true;
          allBtn.setAttribute('aria-pressed', 'false');
          $$('.chip[data-who]', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.who === c.name)));
          spot.innerHTML = `
            <header class="spot-head swap-in"><span class="spot-rank mono">No. ${c.rank}</span><h3>${esc(c.name)}</h3>
              <b class="spot-score big-num"><span data-score>${fmtN(shownScore, 1)}</span><small>/100</small></b></header>
            <div class="funnel swap-in">
              ${[['Assigned', c.assigned], ['Completed', c.completed], ['Approved', c.approved]].map(([k, v]) => `<div><b class="big-num">${v}</b><span>${k}</span></div>`).join('<span class="arrow" aria-hidden="true"></span>')}
            </div>
            <dl class="spot-rows swap-in">
              <div><dt>Approval rate</dt><dd>${meter(c.approvalRate)}<b>${pct(c.approvalRate)}</b></dd></div>
              <div><dt>Availability</dt><dd>${meter(c.availability)}<b>${pct(c.availability)}</b></dd></div>
              <div><dt>Hours per session</dt><dd><span class="hrs">${fmtN(c.hours, 0)} h logged</span><b>${fmtN(c.hoursPerSession, 1)} h</b></dd></div>
              <div><dt>Sent back by QA</dt><dd><span class="hrs">${c.cancelled ? `${c.cancelled} cancelled, none down to them` : 'no cancellations'}</span><b>${c.rejected}</b></dd></div>
            </dl>
            <p class="small spot-note${c.lowVolume ? '' : ' is-quiet'}">Small sample, read with care.</p>`;
          countScore($('[data-score]', spot), c.score);
        };
        // While it plays, the card walks down the board; a tap takes over.
        let k = 0;
        let timer = null;
        show(SC.moderators[0]);
        timer = setInterval(() => { k = (k + 1) % SC.moderators.length; show(SC.moderators[k]); }, reduced.matches ? 4000 : 2600);
        api.cleanup(() => clearInterval(timer));
        api.on(root, '[data-who]', el => { clearInterval(timer); show(SC.moderators.find(c => c.name === el.dataset.who)); });
        api.on(root, '[data-all]', () => showAll());
      },
    });

    /* Incidents, once the numbers are in data/wrap-manual.json */
    if (!mod && Array.isArray(manual.incidents) && manual.incidents.length) scenes.push({
      id: 'incidents', label: 'Incidents', dur: 11000, light: ['10%', '10%'],
      html: () => {
        const total = manual.incidents.reduce((a, b) => a + (Number(b.count) || 0), 0);
        return `
          <div class="stack">
            <h2 class="h-l rise" style="--d:500">${cu(total, 0, 700)} incidents. Every one handled.</h2>
            <div class="inc">${manual.incidents.map((x, i) => `<div class="inc-row rise" style="--d:${900 + i * 90}"><b>${fmtN(x.count)}</b><span>${esc(x.type)}</span><p>${esc(x.outcome)}</p></div>`).join('')}</div>
          </div>`;
      },
    });

    /* Close */
    scenes.push({
      id: 'close', label: 'Thank you', dur: 14000, light: ['50%', '40%'],
      html: () => {
        const rows = mod ? [
          ['Nights in the field', mod.nights], ['Homes visited', mod.homes], ['Miles of round trips', mod.miles.total],
          ['Scenarios captured', mod.scenarios], ...(mod.approved != null ? [['Approved by QA', mod.approved]] : []), ['Partners', mod.partners.length],
          ['Twilight, all together', `${fmtN(D.homes.count)} homes · ${fmtN(peopleTotal)} people`],
        ] : [
          ['Nights in the field', D.season.nights], ['Homes', D.homes.count], ['Miles of round trips', D.miles.roundTripTotal],
          ['People', peopleTotal], [D.qa.status ? 'Sessions approved by QA' : 'QA review decisions', D.qa.status ? D.qa.status.approved : D.qa.decisions], ['Scenario captures', D.kit.scenariosCaptured],
          ['Sessions completed', sessionParts().completed],
          ...(scorecard && !mod ? [['Team quality score', `${fmtN(scorecard.team.averageScore, 1)} / 100`]] : []),
        ];
        const asOf = new Date(D.generatedAt);
        return `
          <div class="close">
            <div class="stack">
              <img class="mark-small rise" style="--d:500" src="assets/centific-mark-cyan.png" alt="Centific">
              <h2 class="h-l rise" style="--d:600">${mod ? `Thank you, ${esc(mod.name)}.` : 'Together, after dark.'}</h2>
              <p class="lede rise" style="--d:800">${mod
                ? 'Every one of those nights became data that helps cameras see better in the dark.'
                : 'Thank you to every moderator, host family, reviewer and admin who made Project Twilight happen.'}</p>
              <div class="actions rise" style="--d:1000">
                <button type="button" class="btn primary" data-i data-replay>Watch again</button>
                <a class="btn" href="../" data-i>Open Twilight</a>
              </div>
              <p class="asof">Centific Data Collection · Project Twilight · ${MONTHS[asOf.getMonth()]} ${asOf.getDate()}, ${asOf.getFullYear()}</p>
            </div>
            <div class="ledger">${rows.map(([k, v], i) => `<div style="--i:${i}"><span>${k}</span><b>${typeof v === 'number' ? fmtN(v) : esc(v)}</b></div>`).join('')}</div>
          </div>`;
      },
      mount(root, api) { api.on(root, '[data-replay]', () => api.go(0, true)); },
    });

    return scenes;
  }

  /* ---------------- Player ---------------- */
  function player(scenes, { autoplay }) {
    const wrap = $('#wrap'); const stage = $('#stage'); const bars = $('#bars');
    const counter = $('#counter'); const pausedChip = $('#paused'); const playBtn = $('#btn-play');
    let index = -1, elapsed = 0, last = 0, playing = autoplay, held = false, current = null, tip = null;

    bars.innerHTML = scenes.map((s, i) => `<button type="button" class="bar" data-bar="${i}" aria-label="${s.label}, ${i + 1} of ${scenes.length}"><i><b></b></i></button>`).join('');
    const fills = $$('.bar b', bars);

    const setPlaying = (on, showChip) => {
      playing = on;
      wrap.classList.toggle('is-paused', !on);
      playBtn.setAttribute('aria-label', on ? 'Pause' : 'Play');
      pausedChip.hidden = on || !showChip;
      if (!pausedChip.hidden) { pausedChip.style.animation = 'none'; void pausedChip.offsetWidth; pausedChip.style.animation = ''; }
    };

    const hideTip = () => { if (tip) { tip.remove(); tip = null; } };

    function go(i, fromStart) {
      if (i < 0 || i >= scenes.length || (i === index && !fromStart)) return;
      hideTip();
      if (current) {
        const old = current;
        old.cleanups.forEach(f => f());
        old.el.classList.remove('is-in'); old.el.classList.add('is-out'); old.el.setAttribute('inert', '');
        setTimeout(() => old.el.remove(), reduced.matches ? 0 : 200);
      }
      index = i; elapsed = 0;
      fills.forEach((f, k) => { f.parentElement.parentElement.classList.toggle('done', k < i); f.style.transform = k < i ? 'scaleX(1)' : 'scaleX(0)'; });
      bars.querySelectorAll('.bar').forEach((b, k) => b.toggleAttribute('aria-current', k === i));
      const s = scenes[i];
      const el = document.createElement('section');
      el.className = 'scene';
      el.setAttribute('aria-label', `${s.label}, ${i + 1} of ${scenes.length}`);
      el.style.setProperty('--lx', s.light[0]); el.style.setProperty('--ly', s.light[1]);
      el.innerHTML = `<div class="spill"></div><div class="bulb"></div><div class="lit">${s.html()}</div>`;
      stage.appendChild(el);
      const cleanups = [];
      const api = {
        pause: () => { if (playing) setPlaying(false, true); },
        go,
        cleanup: f => cleanups.push(f),
        // A read-out that changed settles in (spec section 2, .status-line), keyed on its text.
        say: (el, text, html) => {
          if (html) el.innerHTML = text; else el.textContent = text;
          el.classList.remove('rise', 'status-line'); void el.offsetWidth; el.classList.add('status-line');
        },
        raf: f => { const id = requestAnimationFrame(f); cleanups.push(() => cancelAnimationFrame(id)); },
        on: (root, sel, fn) => {
          root.addEventListener('click', e => {
            const t = e.target.closest(sel);
            if (t && root.contains(t)) { e.stopPropagation(); api.pause(); fn(t, e); }
          });
        },
        tip: (anchor, text, sub) => {
          hideTip();
          const r = anchor.getBoundingClientRect(); const sr = stage.getBoundingClientRect();
          tip = document.createElement('div'); tip.className = 'tip';
          tip.innerHTML = `${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
          tip.style.left = `${Math.max(70, Math.min(sr.width - 70, r.left + r.width / 2 - sr.left))}px`;
          tip.style.top = `${r.top - sr.top}px`;
          stage.appendChild(tip);
        },
      };
      void el.offsetWidth;
      el.classList.add('is-in');
      $$('.cu', el).forEach(n => cleanups.push(countUp(n, { delay: Number(n.dataset.delay || 0) })));
      if (s.mount) s.mount(el, api);
      current = { el, cleanups };
      counter.textContent = `${i + 1} / ${scenes.length}`;
    }

    const next = () => { if (index < scenes.length - 1) go(index + 1); else setPlaying(false, false); };
    const prev = () => go(Math.max(0, index - 1));

    const loop = now => {
      const dt = last ? Math.min(100, now - last) : 0; last = now;
      if (playing && !held && !document.hidden && index >= 0) {
        elapsed += dt;
        const s = scenes[index];
        const p = Math.min(1, elapsed / s.dur);
        fills[index].style.transform = `scaleX(${p})`;
        if (p >= 1) next();
      }
      requestAnimationFrame(loop);
    };

    /* Tap left to go back, right to go on; hold to pause; anything that glows is interactive. */
    let downAt = 0, holdTimer = null, downX = 0;
    stage.addEventListener('pointerdown', e => {
      if (e.target.closest('[data-i], button, a')) return;
      downAt = performance.now(); downX = e.clientX;
      holdTimer = setTimeout(() => { held = true; wrap.classList.add('is-held'); }, 320);
    });
    stage.addEventListener('pointerup', e => {
      clearTimeout(holdTimer);
      if (e.target.closest('[data-i], button, a')) return;
      if (held) { held = false; wrap.classList.remove('is-held'); return; }
      if (!downAt) return;
      downAt = 0;
      hideTip();
      const r = stage.getBoundingClientRect();
      if (downX - r.left < r.width * 0.3) prev(); else next();
    });
    stage.addEventListener('pointercancel', () => { clearTimeout(holdTimer); held = false; downAt = 0; });
    stage.addEventListener('pointerleave', () => { clearTimeout(holdTimer); if (held) held = false; });

    bars.addEventListener('click', e => { const b = e.target.closest('[data-bar]'); if (b) go(Number(b.dataset.bar)); });
    playBtn.addEventListener('click', () => { if (!playing && index === scenes.length - 1 && elapsed >= scenes[index].dur) go(0, true); setPlaying(!playing, false); });
    $('#btn-full').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {});
    });
    document.addEventListener('keydown', e => {
      if (e.target.closest('[role="slider"]')) return;
      if (['ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); next(); }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
      else if (e.key === ' ' && !e.target.closest('button, a')) { e.preventDefault(); setPlaying(!playing, false); }
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(scenes.length - 1);
      else if (e.key.toLowerCase() === 'f' && !e.metaKey && !e.ctrlKey) $('#btn-full').click();
    });

    setPlaying(playing, false);
    go(0);
    requestAnimationFrame(loop);

    // Fresh data swaps in for every scene not yet on screen; the one playing keeps what it shows.
    return {
      setScenes(next) {
        if (next.length !== scenes.length || next.some((s, i) => s.id !== scenes[i].id)) return false;
        scenes.splice(0, scenes.length, ...next);
        return true;
      },
    };
  }

  /* Status line (spec §7): say which copy is on screen, and when. */
  function syncStatus(state, detail) {
    const el = $('#sync');
    const t = d => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const text = {
      refreshing: 'Showing the saved copy · reading live data',
      live: `Live data · ${t(new Date())}`,
      failed: 'Live read failed · showing the saved copy',
    }[state];
    el.dataset.state = state;
    el.title = detail || '';
    if (el.textContent !== text) { el.textContent = text; el.classList.remove('status-line'); void el.offsetWidth; el.classList.add('status-line'); }
  }

  /* ---------------- Boot ---------------- */
  load().then(({ data, manual, scorecard }) => {
    applyLog(data);
    const raw = params.get('mod');
    const mod = findModerator(data, raw);
    const scenes = buildScenes({ data, manual, scorecard }, mod);
    if (raw && !mod) console.warn(`[Twilight Wrap] No moderator named "${raw}" in the snapshot; showing the project Wrap.`);
    const ap = params.get('autoplay');
    document.title = mod ? `Twilight Wrap · ${mod.name}` : 'Twilight Wrap';
    const p = player(scenes, { autoplay: ap != null ? ap !== '0' : !!mod });

    // ?live=0 skips the live read (presenting offline, or a slow venue network).
    if (params.get('live') === '0' || !window.TwilightWrapLive) return;
    syncStatus('refreshing');
    const t0 = performance.now();
    window.TwilightWrapLive.load().then(live => {
      if (!live.production) live.production = data.production;
      // The Production1 rows in the snapshot are the real record; live reads only add what they lack.
      if (data.log) {
        ['log', 'season', 'nightCounts', 'homes', 'miles', 'people', 'kit', 'moderators'].forEach(k => { live[k] = data[k]; });
        live.sessions = { ...live.sessions, perWeek: data.sessions.perWeek };
        live.qa = { ...live.qa, status: data.qa.status };
      }
      applyLog(live);
      const liveMod = mod ? findModerator(live, mod.name) : null;
      const ok = p.setScenes(buildScenes({ data: live, manual, scorecard }, mod ? liveMod || mod : null));
      syncStatus(ok ? 'live' : 'failed', ok ? `Updated in ${((performance.now() - t0) / 1000).toFixed(1)}s.` : 'Live data changed the chapter list; keeping the saved copy.');
    }).catch(err => {
      console.warn('[Twilight Wrap] live read failed', err);
      syncStatus('failed', err && err.name === 'AbortError' ? 'Timed out after 45 seconds.' : String(err && err.message || err));
    });
  }).catch(err => {
    $('#stage').innerHTML = `<section class="scene"><div class="stack"><h2 class="h-m">The Wrap could not load.</h2><p class="lede">${esc(err.message)}. Open this page from a web server, not as a file, and try again.</p></div></section>`;
  });
})();
