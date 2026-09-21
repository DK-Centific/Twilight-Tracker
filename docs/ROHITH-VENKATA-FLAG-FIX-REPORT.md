# Rohith × Venkata · Flag / strike client report

**Date:** 2026-09-21 · **Build:** 1.3.091821b  
**Assignment:** `od_d6b16c91-fe8a-4a5f-8ffe-cbaa153c8e27` · Danica · sessionDate **2026-09-20**  
**List:** 169 Rohith-tw / 170 Venkata-tw · teamId **null** on List  
**SessionState:** 477 Rohith · 479 Venkata  
**Checkpoint:** 2026-09-21 · Skip/resolved keyed by **assignmentId** · `teamAutoStrike` empty

## PA clear (applied)

| Row | Before | After |
|-----|--------|--------|
| SS 477 Rohith | empty / thin | `session_done` (merged stations) |
| SS 479 Venkata | `station_4_done` | `session_done` |
| Strikes 2026-09-21 | — | `skippedTeams[aid]=true` · `resolvedTeams[aid]=true` · `teamAutoStrike` empty |

## Client contract (must not re-queue)

1. **Team = Session.** Either co-mod `session_done` **or** richer `station_4_done` / all-stations happypath completes the **assignment**. Soft-merge richer → thinner before Flagged / 9 AM / `teamAutoStrike`.
2. After this PA clear, poll must **not** write `teamAutoStrike` for this aid and must **not** put the team on Flagged.
3. Skip/resolved by assignmentId still works when List `teamId` is null.
4. Completeness is team-level. **Stars stay individual** (Rohith 3★ can pair with Venkata 4★). History must not show Team (4/4).

Selftest: `node scripts/team-happypath-flag-selftest.js`
