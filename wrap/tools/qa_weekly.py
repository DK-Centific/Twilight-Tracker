#!/usr/bin/env python3
"""Add QA results by week and by month (qa.weekly, qa.monthly) to data/wrap-data.json from the Parakeet Nighttime Tracker.

Usage:
  python3 -I tools/qa_weekly.py <tracker.xlsx> data/wrap-data.json

Counts completed sessions per season week (Week 1 starts on the first perWeek date) by
QA Status: approved, rejected (sent back) or not reviewed. Counts only, no names.
"""
import datetime as dt
import json
import os
import sys
from collections import Counter

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
TRACKER, DATA = sys.argv[1:3]
src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build_scorecard.py')).read()
ns = {'sys': sys}
exec(src.split('def serial')[0].split('TRACKER, AVAIL')[0] + src.split('TRACKER, AVAIL')[1].split('\n', 1)[1].split('# ---- Sessions')[0], ns)

data = json.load(open(DATA))
start = dt.date.fromisoformat(data['sessions']['perWeek'][0]['week'])
prod = ns['read_xlsx'](TRACKER)['Production']
hdr = [h.strip() for h in prod[0]]
col = {k: hdr.index(k) for k in ('Date', 'Status', 'QA Status')}
weeks = [Counter() for _ in data['sessions']['perWeek']]
months = {}
for r in prod[1:]:
    if not any(r):
        continue
    r = r + [''] * (len(hdr) - len(r))
    if r[col['Status']].strip().lower() != 'completed':
        continue
    d = dt.date.fromisoformat(ns['serial'](r[col['Date']]))
    i = (d - start).days // 7
    if not 0 <= i < len(weeks):
        continue
    qa = r[col['QA Status']].strip().lower()
    k = 'approved' if qa == 'approved' else 'rejected' if qa == 'rejected' else 'notReviewed'
    weeks[i][k] += 1
    months.setdefault(d.isoformat()[:7], Counter())[k] += 1
data['qa']['weekly'] = [{'week': w['week'], 'approved': c['approved'], 'rejected': c['rejected'], 'notReviewed': c['notReviewed']}
                        for w, c in zip(data['sessions']['perWeek'], weeks)]
data['qa']['monthly'] = [{'month': m, 'approved': c['approved'], 'rejected': c['rejected'], 'notReviewed': c['notReviewed']}
                         for m, c in sorted(months.items())]
with open(DATA, 'w') as f:
    json.dump(data, f, indent=1)
    f.write('\n')
