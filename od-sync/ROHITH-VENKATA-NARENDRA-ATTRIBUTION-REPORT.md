# Rohith × Venkata · Narendra attribution (client)

**Date:** 2026-09-21 · **Build:** 1.3.091821c  
**Assignment:** `od_d6b16c91-fe8a-4a5f-8ffe-cbaa153c8e27` · Danica · 2026-09-20 8PM–3AM

## PA field evidence

| Source | Finding |
|--------|---------|
| Assignment List | **169 Rohith-tw · 170 Venkata-tw only** (`teamId` null) |
| SessionState | **477** Rohith · **479** Venkata · **orphan 439** Narendra-tw on same aid |
| SS 439 | `assignmentId=od_d6b16c91…` · `lastActive=2026-09-21T00:00:00Z` (= Sep 20 **5:00 PM PT**) · Danica/address bleed |
| TeamLog | none |
| Approvals | Venkata only — no Narendra |
| PA heal | SS 439 quarantined (`assignmentId` cleared). 477/479 intact. |

## Screenshot vs truth

| UI | Showed | Truth |
|----|--------|-------|
| **LATEST UPDATE** | Sep 20 5:00 PM · Narendra Palanati · “not on team” | Orphan SS 439 `lastActive` winner. Should be Rohith-tw / Venkata-tw only (or empty). |
| **Arrival** | Sep 21 2:48 AM · Narendra | **Venkata** `lastGeo.at` / `sessionCompletedAt`. Mislabeled because Arrival reused the LATEST UPDATE actor. |

Impossible from Booking UX — Narendra was never on this team.

## Client cause

`sessionStateRowsForAssignment` matched **all** SS rows by `assignmentId`. `deriveLatestStatusFromSessionState` sorted by `lastActive` and used `matching[0]` (Narendra) as LATEST UPDATE. `perfGeoTrackDisplay` then labeled Arrival with `live.moderatorName` even when the timestamp came from Venkata’s geo/completion.

## Client contracts shipped (1.3.091821c)

See `docs/team-scope-contract.md`.

1. **WD-TEAM-SS-FILTER** — booked List orbits only
2. **WD-SS-WRITE-MEMBERSHIP** — reject foreign SS WRITE (Master Admin excepted)
3. **WD-SOFTMERGE-NO-FOREIGN** — merge/happypath ignore orphan
4. **WD-ARRIVAL-ATTRIBUTION** — Arrival actor = booked owner of arrivedAt/lastGeo
5. **WD-FLAG-TEAM-COMPLETE** — kept from 1.3.091821b

Selftest: `node scripts/perf-foreign-orbit-scope-selftest.js`
