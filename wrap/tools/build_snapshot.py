#!/usr/bin/env python3
"""Build the Twilight Wrap snapshot (numbers only) from raw Power Automate reads.

Usage:
  python3 -I tools/build_snapshot.py <raw-dir> <zcta-gazetteer.txt> > data/wrap-data.json

<raw-dir> holds one JSON file per read, named after the twilight.js constant
(ASSIGNMENT_PA_READ_URL.json, SESSIONSTATE_PA_READ_URL.json, ...).
The output carries counts, first names and distances only: no addresses,
participant names, emails or phone numbers.
"""
import json, math, sys, collections as C
from datetime import datetime, timezone, timedelta

RAW, GAZ = sys.argv[1], sys.argv[2]
TEST_LOGINS = {'David-tw'}
PT = timezone(timedelta(hours=-7))  # Sep-Oct is PDT; Nov 2 onwards is PST
TODAY = datetime.now(PT).strftime('%Y-%m-%d')


def rows(name):
    d = json.load(open(f'{RAW}/{name}.json'))
    if isinstance(d, list):
        return d
    return next((v for v in d.values() if isinstance(v, list)), [])


def iso(s):
    try:
        return datetime.fromisoformat(str(s).replace('Z', '+00:00'))
    except ValueError:
        return None


def miles(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 3958.8 * 2 * math.asin(math.sqrt(h))


zips = {}
for line in open(GAZ):
    p = line.split('\t')
    if p[0].isdigit():
        zips[p[0]] = (float(p[5]), float(p[6]))

A, S, P, M = rows('ASSIGNMENT_PA_READ_URL'), rows('SESSIONSTATE_PA_READ_URL'), rows('APPROVAL_PA_READ_URL'), rows('ADMIN_PA_MODERATORS_URL')

# Assignment is an append log: the newest row per assignment wins.
latest = {}
for a in sorted(A, key=lambda a: a.get('ID') or 0):
    if a.get('assignmentId') and a.get('orbitLoginId') not in TEST_LOGINS:
        latest[a['assignmentId']] = a

# Session progress: keep the richest saved checklist per assignment.
def progress(x):
    n = 0
    for st in (x.get('stations') or {}).values():
        n += sum(1 for sc in (st.get('scenarios') or {}).values() if sc.get('status') in ('Uploaded', 'Calibrated'))
    return n

ss = {}
for r in S:
    if not r.get('assignmentId') or not r.get('stateJson'):
        continue
    try:
        x = json.loads(r['stateJson'])
    except ValueError:
        continue
    cur = ss.get(r['assignmentId'])
    if cur is None or progress(x) >= progress(cur):
        ss[r['assignmentId']] = x

office = None
for x in ss.values():
    if x.get('officeLat') and x.get('officeLng'):
        office = (float(x['officeLat']), float(x['officeLng']))
        break

sessions = []
for aid, a in latest.items():
    x = ss.get(aid, {})
    date = (a.get('assignedDate') or '')[:10] or x.get('sessionDate') or ''
    done = a.get('status') == 'Completed' or bool(x.get('sessionCompletedAt')) or x.get('sessionStatus') == 'session_done'
    cancelled = a.get('status') == 'Cancelled' or bool(x.get('sessionCancelledAt')) or x.get('sessionStatus') == 'Cancelled'
    if done:
        status = 'completed'
    elif cancelled:
        status = 'cancelled'
    elif a.get('status') == 'Rescheduled':
        status = 'rescheduled'
    elif date and date < TODAY:
        status = 'incomplete'
    else:
        status = 'upcoming'
    team = [t.strip() for t in (a.get('team') or '').split(' x ') if t.strip() and not t.startswith('Team ')]
    z = (a.get('participantZipCode') or '').strip()[:5]
    dist = round(miles(office, zips[z]), 1) if office and z in zips else None
    on_site = None
    arr, fin = iso(x.get('arrivedAt')), iso(x.get('sessionCompletedAt'))
    if arr and fin and fin > arr:
        on_site = round((fin - arr).total_seconds() / 3600, 2)
    sessions.append({
        'date': date, 'status': status, 'team': team,
        'home': (a.get('address') or '').strip().lower() or None, 'zip': z,
        'miles': dist, 'scenarios': progress(x), 'hours': on_site,
        'finish': fin.astimezone(PT).strftime('%H:%M') if fin else None,
    })

done = [s for s in sessions if s['status'] == 'completed']
by_status = C.Counter(s['status'] for s in sessions)
dists = [s['miles'] for s in done if s['miles'] is not None]
nights = sorted({s['date'] for s in done})
homes = {s['home'] for s in done if s['home']}
mods_active = sorted({n for s in done for n in s['team']})

# The night shift ends after midnight, so "latest finish" counts hours past 6 PM.
def late_key(hhmm):
    h, m = map(int, hhmm.split(':'))
    return ((h - 18) % 24) * 60 + m

finishes = [s['finish'] for s in done if s['finish']]
weeks = C.Counter()
for s in done:
    d = datetime.strptime(s['date'], '%Y-%m-%d')
    weeks[(d - timedelta(days=d.weekday())).strftime('%Y-%m-%d')] += 1

# QA: reviewer decisions, by Pacific hour and by UTC+8 hour (China and Malaysia).
reviewers = sorted({p['decided_by'] for p in P if (p.get('decided_by') or '').startswith('Centific-Reviewer')})
decisions = [p for p in P if p.get('decided_by') in reviewers and iso(p.get('decided_at'))]
pt_hours, apac_hours = C.Counter(), C.Counter()
for p in decisions:
    t = iso(p['decided_at'])
    pt_hours[t.astimezone(PT).hour] += 1
    apac_hours[t.astimezone(timezone(timedelta(hours=8))).hour] += 1
approved = sum(1 for p in P if p.get('status') in ('Approved', 'AutoApproved'))
night_share = sum(v for h, v in pt_hours.items() if h >= 19 or h < 6) / max(1, len(decisions))

roles = C.Counter(m.get('LoginRole') for m in M if m.get('orbitLoginId') not in TEST_LOGINS)


def production():
    try:
        d = json.load(open(f'{RAW}/PRODUCTION1_STATUS.json'))
    except (OSError, ValueError):
        return None
    labels = {'completed': 'Completed', 'cancelled': 'Cancelled', 'canceled': 'Cancelled', 'not complete': 'Not complete', 'confirmed': 'Confirmed'}
    out = C.Counter()
    for sl in d.get('slices', []):
        k = ' '.join(str(sl.get('status', '')).split()).lower()
        if k:
            out[labels.get(k, str(sl['status']).strip())] += int(sl.get('count') or 0)
    return {'updatedAt': d.get('updatedAt'), 'source': 'Production1 log (Admin Overview chart)',
            'total': sum(out.values()), 'slices': [{'status': k, 'count': v} for k, v in out.most_common()]}


def mod_story(name):
    mine = [s for s in sessions if name in s['team']]
    md = [s for s in mine if s['status'] == 'completed']
    d = [s['miles'] for s in md if s['miles'] is not None]
    partners = C.Counter(n for s in md for n in s['team'] if n != name)
    longest = max((s for s in md if s['hours']), key=lambda s: s['hours'], default=None)
    return {
        'name': name,
        'sessions': len(md),
        'cancelled': sum(1 for s in mine if s['status'] == 'cancelled'),
        'nights': len({s['date'] for s in md}),
        'homes': len({s['home'] for s in md if s['home']}),
        'firstNight': min((s['date'] for s in md), default=None),
        'lastNight': max((s['date'] for s in md), default=None),
        'miles': {'total': round(sum(d) * 2), 'shortest': min(d, default=None), 'farthest': max(d, default=None)},
        'scenarios': sum(s['scenarios'] for s in md),
        'longestNightHours': longest['hours'] if longest else None,
        'partners': [{'name': n, 'nights': c} for n, c in partners.most_common()],
        'nightsList': sorted({s['date'] for s in md}),
        'homesList': [{'date': s['date'], 'miles': s['miles']} for s in sorted(md, key=lambda s: s['date'])],
    }


out = {
    'generatedAt': datetime.now(PT).isoformat(timespec='minutes'),
    'season': {'first': nights[0] if nights else None, 'last': nights[-1] if nights else None, 'nights': len(nights), 'nightsList': nights},
    'sessions': {
        'booked': len(sessions), 'completed': by_status['completed'], 'cancelled': by_status['cancelled'],
        'rescheduled': by_status['rescheduled'], 'incomplete': by_status['incomplete'], 'upcoming': by_status['upcoming'],
        'perWeek': [{'week': w, 'completed': n} for w, n in sorted(weeks.items())],
    },
    'homes': {
        'count': len(homes), 'zips': len({s['zip'] for s in done if s['zip']}), 'states': ['Washington'],
        # First visit per home, in order: night and distance only.
        'list': [{'date': s['date'], 'miles': s['miles']} for s in sorted(
            {s['home']: s for s in sorted(done, key=lambda s: s['date'], reverse=True) if s['home']}.values(),
            key=lambda s: s['date'])],
    },
    'nightCounts': dict(sorted(C.Counter(s['date'] for s in done).items())),
    'miles': {
        'from': 'Centific office, Redmond WA', 'method': 'straight line, office to the home ZIP centre',
        'shortest': min(dists, default=None), 'farthest': max(dists, default=None),
        'average': round(sum(dists) / len(dists), 1) if dists else None,
        'roundTripTotal': round(sum(dists) * 2),
        'histogram': [sum(1 for v in dists if lo <= v < lo + 5) for lo in range(0, 60, 5)],
    },
    'people': {
        'moderators': len(mods_active), 'participants': len(homes), 'reviewers': len(reviewers),
        'admins': roles['Master Admin'], 'pairings': len({tuple(sorted(s['team'])) for s in done if len(s['team']) == 2}),
        'moderatorNames': mods_active,
        'sessionsByModerator': {n: sum(1 for s in done if n in s['team']) for n in mods_active},
        'pairs': [{'a': a, 'b': b, 'nights': n} for (a, b), n in C.Counter(
            tuple(sorted(s['team'])) for s in done if len(s['team']) == 2).most_common()],
    },
    'qa': {
        'reviewers': len(reviewers), 'decisions': len(decisions), 'approved': approved,
        'nightShare': round(night_share, 3),
        'byPacificHour': [pt_hours[h] for h in range(24)], 'byApacHour': [apac_hours[h] for h in range(24)],
        'regions': ['China', 'Malaysia'], 'regionsConfirmed': False,
    },
    'kit': {
        'kits': 2, 'camerasPerKit': 4, 'cameras': 8, 'stations': 4,
        'stationNames': ['Front Yard · Lights On', 'Front Yard · Lights Off', 'Backyard · Lights On', 'Backyard · Lights Off'],
        'scenariosCaptured': sum(s['scenarios'] for s in done),
    },
    'nightShift': {
        'onSiteHours': round(sum(s['hours'] for s in done if s['hours'])),
        'latestFinish': max(finishes, key=late_key) if finishes else None,
    },
    # Session outcomes come from the Production1 log, the same counts as Admin -> Overview.
    'production': production(),
    'incidents': None,
    'moderators': {n: mod_story(n) for n in mods_active},
}
# ---------------------------------------------------------------------------
# Production1 log (the real record). <raw-dir>/p1-rows.txt holds one coded line per
# sheet row, made in the browser from the Production1 tab:
#   DDM(M),kit,zip,status(C/X/N),qa(A/R/-),billing(A/S),names(4-letter codes, '.'),home code
# Names and addresses never leave the browser; a home is a one-way code.
# When the file is there, nights, homes, miles, people and QA results come from it.
NAMES = {'Ayus': 'Ayush', 'Sand': 'Sander', 'Venk': 'Venkata', 'Saty': 'Satya', 'Prad': 'Pradeepreddy',
         'Srav': 'Sravya', 'Bria': 'Brian', 'Muha': 'Muhammad', 'Rohi': 'Rohith', 'Mano': 'Manoj',
         'Isai': 'Isaiah', 'Adid': 'Adidela', 'Jash': 'Jashit', 'Glen': 'Glen', 'Amy': 'Amy',
         'Nare': 'Narendra', 'Matt': 'Matthew'}
ADMINS_IN_FIELD = {'Brian', 'Sander'}  # Master Admins who joined early nights


def log_rows():
    try:
        lines = [l for l in open(f'{RAW}/p1-rows.txt').read().split('\n') if l.strip()]
    except OSError:
        return None
    rows = []
    for l in lines:
        d, kit, z, st, qa, bill, names, home = l.split(',')
        rows.append({
            'date': f'2026-{int(d[2:]):02d}-{d[:2]}', 'kit': kit, 'zip': z, 'status': st, 'qa': qa, 'bill': bill,
            'team': [NAMES[n] for n in names.split('.') if n], 'home': home or None,
            'miles': round(miles(office, zips[z]), 1) if office and z in zips else None,
        })
    return rows


L = log_rows()
try:
    META = json.load(open(f'{RAW}/p1-meta.json'))
except (OSError, ValueError):
    META = {}
if L:
    done = [r for r in L if r['status'] == 'C']
    mods = lambda r: [n for n in r['team'] if n not in ADMINS_IN_FIELD]
    nights = sorted({r['date'] for r in done})
    first = {}
    for r in sorted(done, key=lambda r: r['date']):
        if r['home'] and r['home'] not in first:
            first[r['home']] = r
    dists = [r['miles'] for r in done if r['miles'] is not None]
    weeks = C.Counter()
    for r in done:
        dd = datetime.strptime(r['date'], '%Y-%m-%d')
        weeks[(dd - timedelta(days=dd.weekday())).strftime('%Y-%m-%d')] += 1
    names = sorted({n for r in done for n in mods(r)})
    duos = [r for r in done if len(mods(r)) == 2]
    pairs = C.Counter(tuple(sorted(mods(r))) for r in duos)
    qa = C.Counter(r['qa'] for r in done)

    def log_story(name):
        mine = [r for r in L if name in r['team']]
        md = [r for r in mine if r['status'] == 'C']
        d = [r['miles'] for r in md if r['miles'] is not None]
        partners = C.Counter(n for r in md if len(mods(r)) == 2 for n in mods(r) if n != name)
        tw = out['moderators'].get(name, {})
        return {
            'name': name, 'sessions': len(md), 'cancelled': sum(1 for r in mine if r['status'] == 'X'),
            'nights': len({r['date'] for r in md}), 'homes': len(md) if META else len({r['home'] for r in md if r['home']}),
            'firstNight': min((r['date'] for r in md), default=None), 'lastNight': max((r['date'] for r in md), default=None),
            'miles': {'total': round(sum(d) * 2), 'shortest': min(d, default=None), 'farthest': max(d, default=None)},
            'scenarios': tw.get('scenarios', 0),  # captures are only in Twilight
            'approved': sum(1 for r in md if r['qa'] == 'A'),
            'partners': [{'name': n, 'nights': c} for n, c in partners.most_common()],
            'nightsList': sorted({r['date'] for r in md}),
            'homesList': [{'date': r['date'], 'miles': r['miles']} for r in sorted(md, key=lambda r: r['date'])],
        }

    out['log'] = {'source': 'Production1 tab, Mirror of Parakeet Nighttime Tracker', 'rows': len(L)}
    out['season'] = {'first': nights[0], 'last': nights[-1], 'nights': len(nights), 'nightsList': nights}
    out['nightCounts'] = dict(sorted(C.Counter(r['date'] for r in done).items()))
    out['sessions']['perWeek'] = [{'week': w, 'completed': n} for w, n in sorted(weeks.items())]
    # The address column is mostly town + ZIP, so the home code alone merges neighbours.
    # p1-meta.json carries the count by participant + address; each completed session is its own home.
    n_homes = META.get('distinctHomes', len(first))
    visits = sorted(done, key=lambda r: r['date'])
    out['homes'] = {'count': n_homes, 'zips': len({r['zip'] for r in done if r['zip']}), 'states': ['Washington'],
                    'list': [{'date': r['date'], 'miles': r['miles']} for r in visits][:n_homes]}
    out['miles'].update({'shortest': min(dists), 'farthest': max(dists), 'average': round(sum(dists) / len(dists), 1),
                         'roundTripTotal': round(sum(dists) * 2),
                         'histogram': [sum(1 for v in dists if lo <= v < lo + 5) for lo in range(0, 60, 5)]})
    out['people'].update({
        'moderators': len(names), 'participants': META.get('distinctParticipants', len(first)), 'pairings': len(pairs), 'moderatorNames': names,
        'sessionsByModerator': {n: sum(1 for r in done if n in r['team']) for n in names},
        'pairs': [{'a': a, 'b': b, 'nights': n} for (a, b), n in pairs.most_common()],
    })
    out['qa']['status'] = {'completed': len(done), 'approved': qa['A'], 'rejected': qa['R'], 'notReviewed': len(done) - qa['A'] - qa['R'],
                           'billingApproved': sum(1 for r in L if r['bill'] == 'A'), 'billingSplit': sum(1 for r in L if r['bill'] == 'S')}
    out['kit']['kitSets'] = len({r['kit'] for r in L})
    out['kit']['completedByKitSet'] = dict(sorted(C.Counter(r['kit'] for r in done).items()))
    out['moderators'] = {n: log_story(n) for n in names}

json.dump(out, sys.stdout, indent=1)
