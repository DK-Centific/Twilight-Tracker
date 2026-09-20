# Twilight Tracker · Agent Handoff

**Last updated:** 2026-09-19 · Grok · approval assignment harden (1.3.091820i)

## 2026-09-19 · Approval assignment harden (1.3.091820i)

**Symptom:** A David-tw Approved row was written with `assignment_id: ""` and an `_unbound_` approval id; polling correctly dropped the orphan row, but the write path should never create it.

**Fix:** Calibration submit/resubmit now fails closed with a clear **Booked session required** alert unless `ctx.asgn.id` is real. Client auto-approve skips the local transition without an active assignment, and all approval writers reject blank or legacy `unbound` assignment ids before PA receives a payload. Version/cache-busting is **1.3.091820i**.

**Selftest:** `scripts/approval-submit-selftest.js` now covers submit, create, auto-approve, and generic approval-write guards; full `scripts/*selftest.js` suite passed.

**PR:** [#142](https://github.com/DK-Centific/Twilight-Tracker/pull/142) · merged to `main`.

---

**Last updated:** 2026-09-19 · Grok · OD team name materialize harden (1.3.091820h)

## 2026-09-19 · OD team name / materialize harden (1.3.091820h)

**Symptom:** Today **Pradeepreddy × Manoj** displayed as **Manoj × Muhammad** (and Muhammad × Sravya similarly wrong). PA correcting Assignment List + TeamLog; UI still reused a stale team row.

**Root cause (app):** `materializeOdTeamsFromAssignments` reused teams by `odScheduleId` / mod-set / name but **never refreshed** `team.name` or `primaryIds` from the live assignment’s mod snapshots. Preferring the Assignment `team` column over First×First let a stale label stick. Mod-set / name reuse could also bind a booking onto a team already stamped with a **different** `odScheduleId`.

**Fix:**
- Name always from current mod snapshots (First × First); Assignment column is fallback only.
- On OD reuse / existing `teamId`: sync name + primaryIds; TeamLog WRITE includes renamed teams.
- Mod-set / name reuse refused when the team is already bound to another OD schedule/group.
- Stale `assignment.teamId` pointing at a conflicting OD team rematches.

**Selftest:** `scripts/od-team-materialize-selftest.js` (27). Version **1.3.091820h**.

**Verify (David):** Hard refresh → **1.3.091820h**. Today’s Pradeepreddy×Manoj and Muhammad×Sravya show correct First×First labels after PA List/TeamLog fix (or immediately if snapshots are already correct).

---

## 2026-09-19 · Approval team unlock + Team A→B day bind (1.3.091820f)

**Symptoms (Yuan He / Narendra × Pradeepreddy):**
1. Reviewer shows **Approved** but both mods stay locked at approval checkpoint; session incomplete.
2. Pradeep submitted all stations; Narendra only 1/2/4 — teammate SessionState did not sync.
3. Duplicate SS **444/445** (Narendra) could hide richer progress behind a newer empty heartbeat.

**Additional policy (David):** Mod A on incomplete Team A yesterday, Team B today with Mod C — after 9 AM PT, Mod A must **never** still show Team A (name / address / stations / approval lock). Reset Session on Team A is insufficient; wrong open-session/team bind was the root.

**Root causes:**
1. `pollMyApprovals` matched only the submitting mod’s `orbit_login_id` — teammate Approved never unlocked the other primary.
2. `teammateAtMs` was **undefined** (ReferenceError) → `checkAndOfferTeammateSync` aborted; station maps never merged.
3. Auto-merge required `!bHasOwnWork` so a partial Narendra never received Pradeep’s remaining stations without Sync.
4. `getAssignedOpenSession` / `getSessionDisplayTeam` could stick on yesterday Team A (`getOperatorTeam()` = teams[0], sticky carousel active).
5. Teammate FALLBACK scanned all team memberships → Team A SS rehydrated onto today’s Team B booking.
6. `newestSessionStatePerUser` preferred newest `lastActive` over richer progress (dup SS 444/445).

**Fixes:**
- `findApprovalRowForGate` — assignmentId+sessionDate scoped; any Approved/AutoApproved unlocks both primaries (prefer Approved over own Pending).
- Define `teammateAtMs`; soft-merge whenever teammate score is ahead (`pickBetterScenario`).
- `getAssignedOpenSession` preferToday after 9 AM; `getSessionDisplayTeam` never falls back to teams[0] when today asgn exists.
- Teammate FALLBACK skipped when an active assignment is set.
- Duplicate SS pick by progress score; stamp-vs-assignment scrub for same-day Team A overnight bleed.
- Selftest: `scripts/approval-team-unlock-day-bind-selftest.js`. Version **1.3.091820f**.

**PA data (coordinate with Watchdog):**
- Approval rows for `od_e3dc4442…` / Yuan He day: confirm Station1 (and Station3 if used) status **Approved** with `assignment_id` + `session_date` + `team_id` set.
- SessionState: prefer single live `ss_od_e3dc4442…_{narendra|pradeep}` row each; collapse/ignore orphan SS **444/445** dupes; do not clobber Team B rows with Team A progress.
- If Mod A still shows Team A after hard refresh: confirm today’s Team B Assignment List row exists for Mod A and TeamLog membership includes Team B.

**Verify (David):** Hard refresh → **1.3.091820f**. As Narendra-tw / Pradeepreddy-tw on Yuan He: after Reviewer Approve, **both** unlock without re-lock; station maps converge without manual Sync. As Mod A after 9 AM with Team B today: My session team label / address / stations are **Team B only** (not yesterday Team A), even if Team A was Reset.

---

## 2026-09-18 · PA cutover harden (1.3.091820b)

**Source:** Policy cutover Watchdog app notes (Yuan He / Rebecca / Romo Skip / orphan geo).

**Covered already in 1.3.091820a:**
1. Legacy bare-team Skip mute never covers a **today+** booking (`modStrikeCheckpointMapHas`).
2. SessionState progress scrub + merge scrub for open booking day.

**New gaps closed:**
1. **Skip:** Prior-day checkpoint bare `100019` (Romo, checkpoint 2026-09-17) must not mute Yuan today — tightened so unknown assignmentIds fail open (no bare hitch); selftest covers Romo≠Yuan + unknown id.
2. **Picker / bind:** `pickLatestTeamProgress` / `newestSessionStatePerUser` / `findSelfSessionStateUpdate` never bind Booking/Session from `geo_presence` / `asgn_remote` when targeting a live assignment; resolve `ss_od_*` via `sessionStateId` even when assignmentId column is null.
3. **PA WRITE caveat:** Short code comment near SessionState `stateJson` write — never post `{state: object}` (wipes SharePoint); no PA flow changes.

**Version:** **1.3.091820b**. Selftests: `mod-session-day-gate-policy-selftest.js`, `sessionstate-ss-od-prefer-selftest.js`, `mod-strike-selftest.js`.

**Verify (David):** Hard refresh → **1.3.091820b**. Narendra×Pradeepreddy Yuan He My session / Live bind `ss_od_e3dc4442…` only (not geo_presence 447). Admin Skip on Romo checkpoint 2026-09-17 does not blank Yuan today.

---

## 2026-09-18 · Moderator day-gate policy harden (1.3.091820a)

**Policy (David, authoritative):**
1. Same team’s prior incomplete **or** Admin Skip on flag gate must **never** interfere with **current/today** moderator Booking/Session flow (status, address, geo fence, station progress, checklist hydrate, My session).
2. Anything Sep 17 → Sep 18 **before 9:00 AM PT** is discarded from moderator Booking/Session flow (Admin may still process that data).
3. After the **9 AM PT** day gate, moderator flow binds only to the current/today session (`assignmentId` + `sessionDate`).

**Gaps found on top of 1.3.091819a–c:**
1. **`mergeTeammateState` / `applySelfSyncReplace`** rehydrated foreign `stationCompletedAt` / `stations` from cloud/teammate SessionState onto today’s open booking (address already preferred booking fence; progress did not).
2. **Legacy Admin Skip** `teamId → true` still returned mute for **any** assignmentId of that team, contradicting the occurrence-scope comment and allowing Skip to theoretically mute a today booking if consulted with today’s id.

**Fixes:**
- `scrubSyncableStateForOpenBooking` — scrub syncable payloads to the open booking date before teammate merge and self-browser adopt.
- `modStrikeCheckpointMapHas` — legacy bare-team mute no longer covers a today+ booking; occurrence keys stay authoritative; yesterday checkpoint subject still covered.
- Selftest: `scripts/mod-session-day-gate-policy-selftest.js` (+ legacy today unmute in mod-strike selftest).
- Version **1.3.091820a**.

**Verify (David):** Hard refresh → **1.3.091820a**. After 9 AM PT with today booked: My session / status / address / fence / checklist show **today only**. Admin Skip on yesterday’s incomplete must not blank today’s Live or My session. Pre-9 AM overnight still binds until the gate.

---

## 2026-09-18 · Live status flicker · Venkata×Jashit (1.3.091819c)

**Symptom:** Team **Venkata x Jashit** (Jashit-tw / Venkata-tw) **appeared then quickly disappeared** from Overview Live / Performance Live while checked in on today’s Rebecca Young (`od_917b4f60…`).

**Root cause:**
1. **Admin queue pin (primary):** After 9 AM PT, moderator My session already scoped to today+, but `applyAdminBookingQueueGate` / `adminOpenBookingAssignment` still pinned the **unfinished yesterday** Patrick booking once SessionState loaded (`arrived`). That hid today’s Rebecca from `perfAssignmentVisibleInAdminQueue` → Overview Live dropped the team (poll flicker).
2. **SessionState scrub over-scrub:** `1.3.091819a` treated payloads with only foreign station stamps as fully foreign and cleared `sessionStatus` / could drop Check-in when `arrivedAt` was booking-day — Live briefly null then restored.

**Fix:**
- Admin queue parity with mod carousel: after 9 AM + today+ booking → scope to today+; prefer today’s in-progress over yesterday.
- `perfAssignmentVisibleInAdminQueue`: today (or overnight-overlapping) checked-in stays visible across polls; future queued still gated.
- Scrub: booking-day `arrived` / `arrivedAt` is mixed not fully foreign; full scrub preserves Check-in.
- Version **1.3.091819c**. Selftest: `scripts/live-status-flicker-selftest.js` (arrived stays Live across poll).

**Verify (David):** Hard refresh → **1.3.091819c**. Overview Live + Performance Live: Venkata×Jashit stays while checked in on Rebecca until wrap-up / past session end. Watch 2–3 poll cycles (~30s) — no flash off.

---

## 2026-09-18 · My session address / geofence rebind (1.3.091819b)

**Symptom:** Narendra × Pradeepreddy showed **old session address** in My session and Admin **Outside assignment area** while on site for today’s Yuan He (`od_e3dc4442…`). Same class as Jashit sticky-address after booking switch.

**Root cause (code):**
1. `applyAssignmentToEntryFields` only filled `state.participantAddress` **if empty** — after Romo / prior day, local + SessionState address never rebound when the open booking became Yuan He (same OD `assignmentId` reused after reschedule).
2. `clearOperatorProgressForNewBooking` cleared stations but **not** address.
3. Teammate/self SessionState merge + `assignmentLocationSnapshot` could re-stamp the old address / coords onto today’s row.
4. Perf geo track seeded fence lat/lng from SS row even when row address ≠ live booking fence.

**Code fix:** `syncBookedParticipantAddress` rebinds on `assignmentId|sessionDate|fenceAddress` change; progress clear drops address; cloud merge / location snapshot / perf fence prefer **TODAY’s booking** `assignmentFenceAddress`. My session team-address row prefers booking fence over sticky TeamLog preferred address. Version **1.3.091819b**. Selftest: `scripts/session-address-rebind-selftest.js`.

**Data (PA — if still wrong after hard refresh):** On Assignment List for `od_e3dc4442-1e61-43bd-80ba-8c88d366d399` confirm Address = today’s **Yuan He** site (not Romo). On SessionState **SS 444 / 445** (Narendra) and **SS 446** (Pradeepreddy): set `assignmentAddress` (+ `assignmentLat`/`assignmentLng` if present) and `stateJson.participantAddress` / `assignmentAddress` to that same Yuan He line; clear foreign lat/lng if they still geocode Romo. Do **not** clobber other teams’ preferred-addresses.

**Verify (David):** Hard refresh → version **1.3.091819b**. As Narendra-tw / Pradeepreddy-tw → My session shows **Yuan He** + **today’s Yuan He address** (not Romo). Console: `getAssignedOpenSession()` id `od_e3dc4442…`, `assignmentFenceAddress(getAssignedOpenSession())` is Yuan He. Admin Performance should not show Outside solely from Romo coords.

---

## 2026-09-18 · SessionState booking-scope (1.3.091819a)

**Symptom:** Narendra × Pradeepreddy (team ~100019) showed **Station 4** in Admin/Performance Live for today’s Yuan He booking (`od_e3dc4442…`) right after arrival — impossible.

**Root cause:** Same OD assignment id reused after reschedule. Narendra SessionState rows **SS 444+445** still carried Sep 17 `station_4_done` / full station maps / score 8601 while `sessionDate` had been rewritten to 2026-09-18. Admin `deriveLatestStatusFromSessionState` trusted those stamps (and Uploaded scenario inference) keyed only by assignmentId. Pradeepreddy **SS 446** was clean. Prior Romo booking untouched.

**Data (PA, done):** Reset SS 444+445 to Not Started / score 0 / assignmentId set. Ask Watchdog only if Live still shows St 4 after hard refresh (append-only duplicates).

**Code:** Live status scrubs SessionState progress to the assignment **booking date** (PST). Foreign `stationCompletedAt` / `sessionStatus` / scenario maps cannot inflate St N. Assignment / sessionDate changes clear local station progress. `getOpenTeamSession` prefers today’s booking. Cloud write strips foreign progress. Selftest: `scripts/sessionstate-booking-scope-selftest.js`.

**Verify:** Hard refresh → version **1.3.091819a**. Admin → Performance / Live for Narendra×Pradeepreddy today (Yuan He) → not Station 4 (Booked / Check-in / Live tracking only until real station work). Console: `getLatestStatusForAssignment('od_e3dc4442-1e61-43bd-80ba-8c88d366d399')` should not return `station_4_done`.

---

## 2026-09-18 · Sanity pass (1.3.091818z)

Full static + selftest pass after My session today-priority (**#130 / 091818y**). Product logic for queue, strike ladder, Skip persistence, arrival day-snooze + Today/9AM, Night Time catalog / Save links, approval ack, Reviewer lockdown, Mod Hub role filter + List columns, and password `adminGetPassword`/`adminSetPassword` wiring all check out.

**Fixes shipped:**
- `perf-geo-track-selftest` extract now includes `assignmentPerfSessionStarted` (was crashing mid-run; Live-via-geo path untested).
- Same selftest now stamps booking `date` in **America/Los_Angeles** (was box-UTC YMD → false “not today” after 17:00 PT).
- Stale `APP_VERSION` pins in selftests refreshed to **1.3.091818z**.
- Reviewer lockdown CSS fail-closed backup for Master List / Mod Tracking / Reset Session (JS `openMenu` already hid them).

**Verify:** hard refresh → version **1.3.091818z**; Reviewer menu has no Booking / Panic / Master List / Reset / Mod Tracking / Menu Ring; after 9 AM PT with today booked, My session is today-only.

---
## 2026-09-18 · My session today priority (1.3.091818y)

**Symptom residual after #129 / 091818x:** Live mods still saw unfinished **yesterday** in My session alongside (or instead of) today’s booking.

**Root cause:** `091818x` stopped yesterday from *blocking* today after 9 AM PT but still left yesterday in the carousel for wrap-up; `operatorInProgressAssignment` could also pin prior-day progress and hide today.

**Fix:** After 9 AM PT, if the mod has any today+ eligible booking, `applyBookingQueueGate` scopes My session to **today+ only** (yesterday/older incompletes excluded). Prior-day in-progress is skipped when today+ exists after the gate. Before 9 AM overnight carry unchanged. Same-day AM→PM still `teamId|date`. Hard-drop >2 days unchanged. Version **1.3.091818y**.

**Verify:** hard refresh → My session shows **today only** when today is booked after 9 AM PT (e.g. Rebecca for Jashit / Venkata x Jashit); yesterday alone still shows if no today booking.

---

## 2026-09-18 · Jashit-tw My session queue + address (1.3.091818x)

**Symptom:** Jashit-tw only saw yesterday (Patrick Steffens / Venkata x Jashit) and not today’s Rebecca Young address.

**Root cause (code):** `1.3.091818s` 2-day floor + unfinished-yesterday blocker + same-team sequential gate (teamId only) kept Patrick after 9 AM PT and hid Rebecca even though OD/List had today’s booking with Stanwood address.

**Fix:** After 9 AM PT, unfinished yesterday no longer hides a newer today+ booking (yesterday stays visible for wrap-up). Same-team sequential is per `teamId|date` (same-day AM→PM still gated). Stale `sessionDate` without progress no longer pins yesterday when a newer booking exists after 9 AM.

**Data:** List rows for `od_917b4f60…` / Jashit-tw + Venkata-tw already carry preferred Rebecca address. Jashit has **no** SessionState row for Rebecca yet (Venkata does). Ask Watchdog to ping PA to create/patch Jashit SessionState for Rebecca if checklist hydrate still misses address after refresh. Do **not** clobber preferred-addresses on next OD sync.

**Verify (Jashit):** hard refresh → My session should land on **today Rebecca Young** · address **15022 W. Lake Goodwin Rd., Stanwood, WA 98292**. Yesterday Patrick may still appear for wrap-up.

## Current live state

| Item | Value |
| --- | --- |
| **`main` version** | **`1.3.091820i`** (approval assignment harden) on `main` |
| **Live site** | https://dk-centific.github.io/Twilight-Tracker/ |
| **Last merged** | PR #142 · approval submit/auto-approve assignment binding harden |
| **Local branch** | `main` · clean after PR #142 merge |

### This session (2026-09-18 PT)

- **v1.3.091818w** — Moderator Hub **Role** filter (LoginRole: All / Moderator / Reviewer / Admin / Master Admin). Default **Moderator**. Persisted in `adminState.modRoleFilter` + `localStorage` (`orbit_mod_role_filter`). Applies to Grid cards + List table + `#modCount` on All view. **Overview → Moderators tile** deep-links with `modRoleFilter: 'Mod'` (forces Moderator even if prior choice differed). Add User / Edit / Strike unchanged on visible rows.

- **v1.3.091818u** — Moderator Hub **List** view: real **Columns** visibility menu (Participants pattern). Grid keeps cards-per-row select; List shows show/hide for table fields. Always-on: Name, Twilight Login ID, Actions. Optional: Role, Status, Phone, Centific Email (default on) + Personal Email, Vehicle Type, Strikes (default off). Prefs: `twilight_mod_list_columns_v1`.

- **v1.3.091818t** — Admin Performance **Skip** on flagged teams now persists: checkpoint `skippedTeams`/`resolvedTeams` are **merged** on SessionState ingest (stale poll no longer wipes Skip), Skip/Strike **flush** persist immediately (no 450ms debounce race), and Skip also stamps `resolvedTeams` so Overview glow matches Performance.


- **v1.3.091818s** — Moderator **My session queue**: hard-drop bookings whose session end calendar day is older than yesterday (PST); unfinished yesterday stays until wrap-up (Admin Booking Queue gate parity — still blocks after 9 AM PT until checklist `session_done`); overnight live before 9 AM preserved. **Approval gate**: popup uses prior local status (not TTL `gateApproved`) + token-keyed `approvalAckedTokens` so Confirm survives reload/poll/carousel churn.

### Recently shipped on `main` (Sep 16)

- **v1.3.091626n** — Soft Sage parchment canvas, muted gold CTAs, moon face fix, booking week+assign scroll lock, scenario changelog ~5.5 rows, edited-by from login id
- **v1.3.091626j** — Scenario description rich text + color swatch fix (span not font)
- **v1.3.091626h** — Approval copy fix, arrival undo, session date from booking, Reviewer Lakitu side panel
- **v1.3.091626e/d** — CAL rig card saves with publish; booking default end = start + 8h
- **Booking page** — Admin slide-out booking drawer (Helios motion), month/week views, team caps

---

## In flight — open draft PRs

These exist but are **not merged**. David reviews on localhost; merge only when he says **push**.

| PR | Branch | Summary | Status |
| --- | --- | --- | --- |
| [#112](https://github.com/DK-Centific/Twilight-Tracker/pull/112) | `cursor/activities-map-perf-today-6662` | Activities Map Today = Performance overnight overlap + 9 AM queue gate | Draft · newest |
| [#110](https://github.com/DK-Centific/Twilight-Tracker/pull/110) | `cursor/perf-overnight-live-9am-gate-ff76` | Admin Performance/Overview: overnight Live + 9 AM next-session gate | Draft |
| [#108](https://github.com/DK-Centific/Twilight-Tracker/pull/108) | `cursor/booking-manual-name-address-81f9` | Booking: type Participant name + Address (editable even after roster pick) | Draft |
| [#74](https://github.com/DK-Centific/Twilight-Tracker/pull/74) | `cursor/assignment-od-excel-roundtrip-8e44` | Round-trip OneData keys on Assignment Excel save | Draft |
| [#68](https://github.com/DK-Centific/Twilight-Tracker/pull/68) | `cursor/card-controls-gap-9563` | Space out scenario card video pills | Draft |
| [#61](https://github.com/DK-Centific/Twilight-Tracker/pull/61) | `cursor/horizontal-no-clip-9563` | Stop clipping Horizontal view cards | Open (not draft) |
| [#46](https://github.com/DK-Centific/Twilight-Tracker/pull/46) | `cursor/approval-tab-flash-9563` | Stop Approval tab flash on open | Draft |
| [#44](https://github.com/DK-Centific/Twilight-Tracker/pull/44) | `cursor/paniclog-read-url-9563` | PanicLog read URL + incident email layout | Draft |
| [#40](https://github.com/DK-Centific/Twilight-Tracker/pull/40) | `cursor/team-create-duplicate-9563` | Fix duplicate team on create | Draft |
| [#18](https://github.com/DK-Centific/Twilight-Tracker/pull/18) | `cursor/mod-start-station-bar-9563` | Move Start with first station into entry bar | Draft |
| [#1](https://github.com/DK-Centific/Twilight-Tracker/pull/1) | `cursor/global-yellow-emails-avatars-9563` | Helios yellow emails + solid avatars everywhere | Draft |

**Most likely next work:** PR #108 (manual name/address on Booking) — David has not OK'd merge yet.

---

## Waiting on David

- Review PR #108 on localhost (typed name/address on Booking)
- Type **push** when a draft PR is ready to merge to `main` and go live
- Power Automate flow updates (see `docs/power-automate-*.md`) when Excel write behavior changes

---

## What this session did (2026-09-18)

- **PR [#112](https://github.com/DK-Centific/Twilight-Tracker/pull/112)** · `cursor/activities-map-perf-today-6662` · **v1.3.091818a**
  - Activities Map **Today** uses `perfDateInRange` (overnight Sep17→Sep18) instead of calendar `assignment.date`
  - Map assignments + team list respect `perfAssignmentVisibleInAdminQueue` (9 AM next-session gate)
  - Self-test: `scripts/activities-map-today-selftest.js`
- **Next:** David localhost on PR #112; type **push** to merge. Consider merging with #110/#111 if overnight perf not yet on `main`.

---

## What this session did (2026-09-16)

- Installed agent tooling on David's Mac: RTK, CodeGraph, Caveman, Ponytail (Cursor global)
- Created **`AGENTS.md`** + **`docs/HANDOFF.md`** for Grok/agent handoff
- **`v1.3.091626p`** — geofence arrival unlock + Performance location tracks:
  - Confirm Arrival button now unlocks when cloud/local GPS is inside the assignment fence (fixes cloud geo not updating `state.lastGeo`)
  - Assignment lat/lng from SessionState seeds geocode when address cache is empty
  - Admin **Performance** tab shows **At assigned address** / **Arrival confirmed from app** pills per booking
- **`v1.3.091626q`** — Twilight landing fix:
  - Moderator email **Open Twilight App** CTA now points at `Twilight-Tracker` (was `Orbit-Tracker`)
  - `orbit.html` redirects to the canonical Twilight URL
  - README note for replacing old Kilo/Orbit home-screen icons
- **`v1.3.091626s`** — Moderator home session setup restored:
  - Main page shows arrival banner + **Field Collection Equipment** checklist again
  - **Confirm equipment packed** button wired (was never bound) · gold/accent styling
  - Packing equipment refreshes Confirm Arrival in sidebar + banner
- **`v1.3.091626r`** — Confirm Arrival unlock hardening:
  - GPS coords without a timestamp no longer block the fence check
  - Welcome banner, worklog button, and **I've arrived** all share one unlock path and live-refresh when location updates
  - Welcome **waiting** banner updates in place (no stuck disabled button) when you enter the geofence
  - Tracking on uses a 60-minute location window for unlock preview; tap still verifies live GPS
- **`v1.3.091626t`** — Moderator home empty-page fix (`arrivedAsgn` ReferenceError)
- **`v1.3.091626w`** — Edit assignment UX: team **search** picker (compact, matches New team button), start/end times mirror saved booking (overnight-safe), **Roster** collapsed by default
- **`v1.3.091626v`** — Booking Edit modal: **Assigned team** dropdown + **Participant name** / **Address** text fields (editable on Edit; roster pick optional; OD sessions read-only)
- **`v1.3.091626u`** — Booking edit + OneData refresh:
  - **Edit participant info** popup now pre-fills name, email, phone, address, state, ZIP from the saved booking row when live roster lookup is missing or stale
  - **Refresh** button added next to **OneData** on the Booking page header · pulls latest assignments from PA and updates the session list
  - Screenshots: `docs/screenshots/booking-refresh-onedata-button.png`, `docs/screenshots/booking-edit-participant-prefilled.png`

**Not done yet:** David has not typed **push** — nothing live on GitHub Pages yet. Legacy **Kilo-Checklist** / **Orbit-Tracker** GitHub Pages still need redirect pages if old bookmarks should auto-forward (separate repos).

---

## WIP — moderator strikes (`1.3.091726r`, local)

- **3 stars max · 0 stars = wasted / in-app lock** (separate from Excel **Deactivated**); sign-in allowed so mod sees lock message
- **Moderator Hub**, **Performance**, **Teams** chips — Strike / Reset for field mods (`modStrikeEligible`)
- **9 AM PT auto-strike:** two-primary teams, yesterday booking incomplete → −1 star per primary (once per PST day per project when cloud sync works)
- **Cloud sync (Option A):** `ss_app_setting_moderator_strikes` in **SessionState** — same pattern as deactivated users · read on `fetchSessionStateRows` · debounced write on strike/reset/checkpoint · **no new PA URL** if SessionState overwrite already works
- Local cache: `centific_moderator_strikes_v1`
- Test: `node scripts/mod-strike-selftest.js`

---

## Recommended next steps (for Grok / next agent)

1. Pull `main` and confirm `APP_VERSION === '1.3.091626n'`.
2. If David asks to continue Booking work → start from PR #108 branch or rebase that work onto current `main`.
3. Before any UI change → preview mockup; wait for OK.
4. After changes → run relevant `scripts/*-selftest.js`, bump `APP_VERSION`, update this file.
5. Do not merge to `main` until David types **push**.

---

## Key file map (quick reference)

| Area | Where to look in `twilight.js` |
| --- | --- |
| Booking page | `openBookingPage`, `adminState.bookingOpen`, `#bookingPage` |
| Assignment / calendar | `adminState.tab === 'assignment'`, assignment modal |
| Scenario catalog | Checklist tab, `scenCatalogModal`, cal-rig-card |
| Approval | `APPROVAL_PA_READ_URL`, Reviewer Lakitu side panel |
| SessionState | `SESSIONSTATE_PA_WRITE_URL`, overwrite by `sessionStateId` |
| Worklog | `WORKLOG_PA_WRITE_URL`, overwrite by `worklogId` |
| Moderator flow | station cards, arrival, Lakitu URL validation |
| Panic | `twilight-panic.js` |

Power Automate setup guides: `docs/power-automate-worklog-overwrite.md`, `docs/power-automate-sessionstate-overwrite.md`, etc.

---

## Handoff update template

Copy this block and fill it in at session end:

```
**Last updated:** 2026-09-18 · Cursor · Live status flicker (1.3.091819c)
**Version after work:** x.x.xxxxxxx
**Completed:** …
**Blocked / waiting:** …
**PR / branch:** …
**Next agent should:** …
```