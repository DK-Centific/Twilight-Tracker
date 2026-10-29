#!/usr/bin/env python3
"""Build the Twilight Wrap moderator scorecard (data/scorecard.json) from the season's workbooks.

Usage:
  python3 -I tools/build_scorecard.py <tracker.xlsx> <availability.xlsx> <timesheet.xlsx> > data/scorecard.json

  tracker      Parakeet Nighttime Tracker (Production tab)
  availability Moderator Availability (Availability tab)
  timesheet    Twilight Moderator Timesheet (September / October tabs)

Method follows the Moderator Quality Scorecard (Orbit) and its Twilight copy:
  Quality = 100 x (Approval x 40 + Availability x 25 + Reliability x 10) / 75
Car (15) and Incidents (10) are not tracked for Twilight, so they drop out of both
numerator and denominator, as that method specifies. Efficiency (timesheet hours
per completed session) is reported beside the score, not inside it.
Sessions the client asked to cancel (the Oct 19-22 Ring login outage, tracker
rows 105-119) are left out of every moderator's counts: they were never the
moderators' to run.
Output holds first names and numbers only.
"""
import datetime as dt
import json
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter, defaultdict

TRACKER, AVAIL, TIMESHEET = sys.argv[1:4]
SEASON = ('2026-09-08', '2026-10-27')
W = {'approval': 40, 'availability': 25, 'reliability': 10}

# Rostered moderators (timesheet + availability). Wrap first names.
ROSTER = {
    'Jashit Dahiya': 'Jashit', 'Pradeepreddy Annapareddy': 'Pradeepreddy', 'Venkata Rohit Krishna Borra': 'Venkata',
    'Kommu Sravya': 'Sravya', 'Narendra Palanati': 'Narendra', 'Muhammad Bimo Saksono': 'Muhammad',
    'Satya Pranav Somayajula': 'Satya', 'Manoj Kumar Godishala': 'Manoj', 'Rohith Raja Doddi': 'Rohith',
    'Amy Badamjunai': 'Amy', 'Adidela Shanti Fleming': 'Adidela', 'Shanti Fleming Adidela': 'Adidela',
    'Isaiah Bell': 'Isaiah', 'Matthew Mai': 'Matthew',
}
ALIAS = {'Pradeep': 'Pradeepreddy', 'Mathew': 'Matthew', 'Fleming': 'Adidela', 'Rohith Raja': 'Rohith', 'Jashit?': 'Jashit'}
NAMES = sorted(set(ROSTER.values()))

# Why a session was cancelled, from Centific Notes. None of these are down to the moderators.
CANCEL_REASONS = [
    (r'client requested', 'Client request'),
    (r'ring access|ring account', 'Ring access'),
    (r'wi-?fi', 'Participant Wi-Fi'),
    (r'kit|rig|camera|mac id', 'Equipment'),
    (r'repeat home', 'Repeat home'),
    (r'target met', 'Target met'),
]

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}


def read_xlsx(path):
    z = zipfile.ZipFile(path)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
            shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
    rels = {r.get('Id'): r.get('Target') for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
    out = {}
    for sh in ET.fromstring(z.read('xl/workbook.xml')).find('m:sheets', NS):
        t = rels[sh.get('{%s}id' % NS['r'])].lstrip('/')
        rows = []
        for row in ET.fromstring(z.read(t if t.startswith('xl/') else 'xl/' + t)).iter('{%s}row' % NS['m']):
            cells = {}
            for c in row.findall('m:c', NS):
                col = 0
                for ch in re.match(r'[A-Z]+', c.get('r')).group(0):
                    col = col * 26 + ord(ch) - 64
                v = c.find('m:v', NS)
                if c.get('t') == 'inlineStr':
                    val = ''.join(x.text or '' for x in c.iter('{%s}t' % NS['m']))
                elif v is None:
                    val = ''
                elif c.get('t') == 's':
                    val = shared[int(v.text)]
                else:
                    val = v.text or ''
                cells[col - 1] = val
            rows.append([cells.get(i, '') for i in range(max(cells) + 1)] if cells else [])
        out[sh.get('name')] = rows
    return out


def serial(s):
    return (dt.date(1899, 12, 30) + dt.timedelta(days=float(s))).isoformat()


def num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return 0.0


# ---- Sessions (Production tab): every rostered moderator named is credited ----
prod = read_xlsx(TRACKER)['Production']
hdr = [h.strip() for h in prod[0]]
col = {k: hdr.index(k) for k in ('Date', 'Moderator 1', 'Moderator 2', 'Status', 'QA Status', 'Centific Notes')}
S = defaultdict(Counter)
reasons = Counter()
excluded = []  # client-requested cancellations, by tracker row
for row_no, r in enumerate(prod[1:], start=2):
    if not any(r):
        continue
    r = r + [''] * (len(hdr) - len(r))
    date = serial(r[col['Date']])
    if not (SEASON[0] <= date <= SEASON[1]):
        continue
    status = r[col['Status']].strip().lower()
    qa = r[col['QA Status']].strip().lower()
    names = {ALIAS.get(n.strip(), n.strip().split(' ')[0]) for c in (r[col['Moderator 1']], r[col['Moderator 2']]) for n in c.split(',') if n.strip()}
    if status == 'canceled' or status == 'cancelled':
        note = r[col['Centific Notes']].lower()
        reasons[next((label for pat, label in CANCEL_REASONS if re.search(pat, note)), 'Other')] += 1
        if 'client requested' in note:
            excluded.append(row_no)
            continue
    for n in names & set(NAMES):
        s = S[n]
        s['assigned'] += 1
        if status == 'completed':
            s['completed'] += 1
            if qa == 'approved':
                s['approved'] += 1
            elif qa == 'rejected':
                s['rejected'] += 1
            else:
                s['pending'] += 1
        elif status == 'not complete':
            s['notComplete'] += 1
        else:
            s['cancelled'] += 1

# ---- Availability: N/A on a tracked night = unavailable; blank = not tracked ----
av = read_xlsx(AVAIL)['Availability']
ahdr = av[0]
avail = defaultdict(Counter)
for r in av[1:]:
    if len(r) < 2 or not r[1]:
        continue
    date = serial(r[1])
    if not (SEASON[0] <= date <= SEASON[1]):
        continue
    for i, full in enumerate(ahdr[2:], start=2):
        n = ROSTER.get(full.strip())
        v = (r[i] if i < len(r) else '').strip()
        if not n or not v:
            continue
        avail[n]['tracked'] += 1
        if v.upper().replace('/', '') == 'NA':
            avail[n]['unavailable'] += 1

# ---- Timesheet hours (all logged hours: field nights, training, syncs) ----
hours = Counter()
for name, rows in read_xlsx(TIMESHEET).items():
    if 'Timesheet' not in name:
        continue
    head = next((r for r in rows if r and r[0].strip() == 'Moderator Name'), None)
    if not head:
        continue
    hcols = [i for i, h in enumerate(head) if '(hrs)' in h]
    for r in rows[rows.index(head) + 1:]:
        n = ROSTER.get((r[0] if r else '').strip())
        if n:
            hours[n] += sum(num(r[i]) for i in hcols if i < len(r))

# ---- Score ----
cards = []
for n in NAMES:
    s, a = S[n], avail[n]
    approval = s['approved'] / (s['approved'] + s['rejected']) if s['approved'] + s['rejected'] else None
    availability = 1 - a['unavailable'] / a['tracked'] if a['tracked'] else None
    # No cancellation this season was moderator-attributable (see reasons), so none count against Reliability.
    reliability = 1.0 if s['assigned'] else None
    parts = [(W['approval'], approval), (W['availability'], availability), (W['reliability'], reliability)]
    used = [(w, v) for w, v in parts if v is not None]
    score = round(100 * sum(w * v for w, v in used) / sum(w for w, _ in used), 1) if s['completed'] and used else None
    cards.append({
        'name': n, 'assigned': s['assigned'], 'completed': s['completed'], 'approved': s['approved'],
        'rejected': s['rejected'], 'pending': s['pending'], 'notComplete': s['notComplete'], 'cancelled': s['cancelled'],
        'approvalRate': round(approval, 4) if approval is not None else None,
        'availability': round(availability, 4) if availability is not None else None,
        'nightsTracked': a['tracked'], 'nightsUnavailable': a['unavailable'],
        'hours': round(hours[n], 1),
        'hoursPerSession': round(hours[n] / s['completed'], 1) if s['completed'] else None,
        'score': score,
        'lowVolume': s['completed'] < 8,
    })
cards.sort(key=lambda c: (-(c['score'] or 0), -c['completed']))
for i, c in enumerate(cards):
    c['rank'] = i + 1

json.dump({
    'season': {'from': SEASON[0], 'to': SEASON[1]},
    'weights': W,
    'dropped': ['Car availability (15)', 'Incidents (10)'],
    'cancelReasons': dict(reasons.most_common()),
    'excluded': {'clientRequested': len(excluded), 'rows': excluded},
    'team': {
        'moderators': len(cards),
        'approvalRate': round(sum(c['approved'] for c in cards) / max(1, sum(c['approved'] + c['rejected'] for c in cards)), 4),
        'availability': round(1 - sum(avail[n]['unavailable'] for n in NAMES) / max(1, sum(avail[n]['tracked'] for n in NAMES)), 4),
        'hours': round(sum(hours.values()), 1),
        'averageScore': round(sum(c['score'] for c in cards if c['score'] is not None) / max(1, sum(1 for c in cards if c['score'] is not None)), 1),
    },
    'moderators': cards,
}, sys.stdout, indent=1)
