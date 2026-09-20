# Team sync · PA / client contract (1.3.091820x)

**Audience:** PA (Power Automate / SessionState) + client ship notes  
**Date:** 2026-09-20 PT

## Purpose

Co-moderators on the **same OD booking** (`assignmentId`) share station / scenario / arrival progress via SessionState. Team sync is **soft-merge** (`pickBetterScenario`) — never wipe richer local work.

## URLs

| Role | Const | Flow |
|------|-------|------|
| READ all SessionState rows | `SESSIONSTATE_PA_READ_URL` | GET/POST PA Read → array of `{ sessionStateId, assignmentId, teamId, orbitLoginId, stateJson, lastActive, … }` |
| WRITE upsert | `SESSIONSTATE_PA_WRITE_URL` | POST `{ sessionStateId, assignmentId, orbitLoginId, teamId, overwrite, lastActive, appVersion, stateJson }` |

Canonical session row id: `ss_{assignmentId}_{orbitSafe}` (e.g. `ss_od_27c50635…_pradeepreddytw`).  
App-setting rows (`ss_app_setting_*`, geo_presence, asgn_remote) are **excluded** from teammate pick.

## What Team sync reads

From each teammate SessionState `stateJson` (via `extractSyncableState` / parse):

- Identity of work: `participantId`, `participantName`, `participantAddress` (booking fence wins if conflict)
- Day: `sessionDate` (must match open booking date when set)
- Progress: `stations{}`, `stationCompletedAt{}`, `equipment{}`, `calGuideAck`, `recordLakituUrl`
- Lifecycle: `arrivedAt` (earliest wins), `sessionCompletedAt` (newest wins), office check-in/out
- Scores: `progressScore` / computed `sessionStateProgressScore`

## What Team sync writes

After merge / accept / auto-sync:

1. Local `state` updated → `saveState()`
2. Immediate `flushSessionStateSync()` → WRITE to **this mod’s** `ss_{asgn}_{me}` (not the teammate’s row)
3. Markers: `state._lastSyncMergeAt` = freshness ISO (`lastActive` || `progressAt` || …); `state._lastSyncMergeScore` = teammate progressScore (Decline only blocks equal-or-lower richness)

Self-sync (same mod, other browser) uses `applySelfSyncReplace` (wholesale replace of syncable fields) + same WRITE.

## Discovery algorithm (`findTeammateSessionState`)

1. **PRIMARY** — same `assignmentId` as `getAssignedOpenSession()`, exclude self `orbitLoginId`, pick highest `sessionStateProgressScore` (then `progressAt`, then `lastActive`).  
   - **1.3.091820x:** matching `assignmentId` is authoritative even if SS `teamId` column diverges from TeamLog.
2. **FALLBACK** — only when **no** active assignment. Scan teams where I am primary/backup; pick best progress.  
   - **820f+:** FALLBACK is **skipped** when an active assignment is set (blocks Team A bleed onto Team B).
3. Staleness: `isStaleSessionStateWrite` (6h unless `sessionDate===today` and not foreign to booking).
4. Scrub on apply: `scrubSyncableStateForOpenBooking` drops prior-day / foreign station stamps before merge.

## Success toast (1.3.091820x)

On **every successful merge** (soft-auto-merge, banner Sync, welcome Sync, modal Accept):

`Team sync complete · Pulled Station N–M from {FirstName}`

(via `formatTeamSyncCompleteToast`)

## UI surfaces

| UI | Action |
|----|--------|
| Welcome **Sync from teammate** | `window.forceTeammateSync()` → find + `mergeTeammateState` |
| Live banner **Sync now** | Re-fetch then merge (820x) |
| Modal Continue / Start fresh | Merge or dismiss; both stamp `_lastSyncMergeAt` |
| Auto soft-merge on poll | When teammate score ahead (incl. after teammate `sessionCompletedAt` as of 820x) |
| Self-sync banner **Sync** | `applySelfSyncReplace` from my other browser’s row |

## Expected co-mod merge behavior

- Gaps fill; Uploaded/Calibrated never downgrade to Not Started (`pickBetterScenario`).
- Arrival: earliest `arrivedAt` wins; completion: newest `sessionCompletedAt` wins.
- Address: today’s booking fence wins over stale cloud address.
- Each mod keeps their own SS row; merge copies progress into local then writes self row.
- After 9 AM PT with a today+ booking, open session bind prefers today (Team B) — yesterday Team A incomplete must not drive Sync target.

## Known gaps (remaining)

1. Append-only Approvals log can still contain historical Pending rows; UI dedupe (820w) prefers Approved — soft-delete Pendings is PA hygiene, not required for display.
2. If co-mod never wrote an SS row for the shared `assignmentId` (wrong id / geo_presence only), Sync correctly finds nothing — toast (820x) says so.
3. `scrubSyncableStateForOpenBooking` can still demote stamps that fail `sessionStateStampBelongsToAssignment` (before start−2h); overnight after start is kept.
4. FALLBACK deliberately disabled with active assignment — Sync will not pull a different OD team’s progress by team membership alone.
5. Assignment List `status` remains OD-owned; Team sync does not set Completed on the List.

## PA checklist

- Ensure WRITE sets SharePoint **assignmentId** column (JSON may omit it).
- Prefer stable `sessionStateId = ss_{od}_{login}`.
- Do not rely on `teamId` column for sync correctness after 820x (still nice for Admin filters).
- Strikes / Flagged incomplete are separate (`ss_app_setting_moderator_strikes` checkpoints).
