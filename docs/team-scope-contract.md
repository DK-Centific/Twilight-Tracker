# Team-scope write + display contract (1.3.091821c)

**Audience:** PA / client ship notes  
**Date:** 2026-09-21  
**Assignment fixture:** `od_d6b16c91-fe8a-4a5f-8ffe-cbaa153c8e27` · Rohith-tw × Venkata-tw · Danica

## Why

Orphan SessionState **SS 439** (Narendra-tw) sat on the same `assignmentId` as List 169/170. `lastActive=2026-09-21T00:00:00Z` (Sep 20 **5:00 PM PT**). Done detail labeled **LATEST UPDATE** and **Arrival** as Narendra + “not on team”. Arrival timestamp was Venkata’s `lastGeo.at` / `sessionCompletedAt` (~Sep 21 2:48 AM PT) — mislabeled because the client used the newest `lastActive` actor.

PA quarantined SS 439 (`assignmentId` cleared). Client must still fail closed so a foreign orbit cannot display or recreate `ss_od_d6b16c91…_narendratw`.

## Contracts

| ID | Rule |
|----|------|
| **WD-TEAM-SS-FILTER** | Arrival / LATEST UPDATE / merge / Flagged / 9 AM strike read only **booked** `orbitLoginId`s from Assignment List (`modSnapshots`, plus team primaries+backups when `teamId` is set). Unknown roster → keep rows (cannot identify foreign). `{ bookedOnly: false }` is Admin audit only. |
| **WD-SS-WRITE-MEMBERSHIP** | SessionState / Worklog / moderator Approval WRITE onto an assignmentId is rejected unless the writer’s `orbitLoginId` is booked on that aid. **Master Admin excepted.** Foreign mods may still write `geo_presence_*` (location-only). Blocks recreating `ss_{aid}_narendratw`. |
| **WD-SOFTMERGE-NO-FOREIGN** | Soft-merge (`pickLatestTeamProgress`, station panel, happypath) ignores non-booked SS on the aid. |
| **WD-ARRIVAL-ATTRIBUTION** | Arrival actor = booked team member who owns `arrivedAt` or `lastGeo.at`. Never the foreign (or even booked) `lastActive` winner used for LATEST UPDATE. |
| **WD-FLAG-TEAM-COMPLETE** | Unchanged from **1.3.091821b**: either booked co-mod’s happypath (`session_done` / wrap-up / `station_4_done` / all-stations) completes the assignment. Stars stay individual. |

## Display

- **LATEST UPDATE** = newest booked SS `lastActive` + that row’s orbit name. Empty if no booked SS.
- **Arrival** = `resolveAssignmentArrivalAttribution` (arrivedAt owner, else lastGeo owner). Hidden foreign. No “not on team” badge.
- Done / in-progress pills do not attribute foreign orbits.

## Writes (client)

1. `getSessionStateWriteContext` — if operator is not booked, do **not** target that aid; fall back to `geo_presence_{orbit}_{day}` or skip.
2. `flushSessionStateSync` — `{ ok:false, reason:'foreign_assignment' }` if payload orbit is not booked.
3. `pushWorklogStatus` — no-op when orbit is not booked.
4. `createApprovalRequest` / `writeApprovalEvent` (submitted/resubmitted) — skip when orbit is not booked.

`sessionStateId` stays `ss_{assignmentId}_{orbitSafe}`. Membership gate is what prevents the foreign suffix.

## PA

No URL changes. Quarantine leftover foreign SS (`assignmentId` clear) remains a data heal. Client must not re-stamp them.
