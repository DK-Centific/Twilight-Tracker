# Twilight Tracker · Agent Handoff

**Last updated:** 2026-09-26 · Grok · Admin checklist mirror shows co-mod progress (1.3.091825o)

## 2026-09-26 · Grok · Admin checklist mirror shows co-mod progress (1.3.091825o)

**Ask:** Live tip **1.3.091825n** (merged PR #180) opened Tonight's teams, but picking a team did not show that team's latest checklist. David saw an empty, stale, or his own Admin checklist instead of the co-moderator's SessionState progress.

**Cause:** Picking a team opened the checklist, then filled it from the admin's own saved session. The merge kept the admin's richer rows. A scrub looked at the admin's booking and could wipe stations. Painting the checklist could then clear the fill because it looked like a new booking. Sync itself also kept going while the mirror was open, so the write gate blocked the merge and a save still ran.

**Fix:** Choosing a team replaces the checklist with that team's latest SessionState, scrubbed only to that booking's Pacific date. The entry bar does not clear progress while the mirror is open. Sync returns immediately while the mirror is open. Saves stay blocked. Close still restores Admin.

**Version:** **1.3.091825o**. Selftest: `scripts/admin-progress-mirror-selftest.js`.

**PR:** draft [#181](https://github.com/DK-Centific/Twilight-Tracker/pull/181) on `cursor/admin-progress-mirror-hydrate-a363`. Do **not** merge until David says push. Not on the live site until then.

**Verify (David):** This build is on the pull request, not the live site. On your computer, start a local server in the project folder (`python3 -m http.server 8080`) and open http://localhost:8080/. Hard refresh until the corner says **1.3.091825o**. Sign in as Admin. Click the logo on the right. Click a Tonight's team. You should see a line starting **You are now seeing** and that team's stations. Click **Close**. You should be back on Admin. Refresh the page. Your own Admin session should still be yours, not the team's.

## 2026-09-26 · Tonight's teams opens beside the Helios logo (1.3.091825n)

**Ask:** The team list felt disconnected from the logo. David wants it to pop out next to the Helios logo in Admin and again while the checklist is open.

**What changed on PR #180:**
- Clicking the Helios logo in Admin (right-rail logo, or the top logo on a phone) opens **Tonight's teams** beside that logo. Click the same logo again to close it.
- While the checklist mirror is open, the checklist Helios logo does the same. A real moderator’s logo still opens the welcome screen.
- Choosing a team still fills the checklist. **Close** still returns to Admin. Saves stay blocked.

**Version:** **1.3.091825n**. Selftest: `scripts/admin-progress-mirror-selftest.js`.

**PR:** draft [#180](https://github.com/DK-Centific/Twilight-Tracker/pull/180) on `cursor/admin-progress-mirror-09c3`. Do **not** merge until David says push.

**Verify (David):** Hard refresh until the corner says **1.3.091825n**. Sign in as Admin. Click the logo on the right. **Tonight's teams** should sit right next to that logo. Click a team. On the checklist, click the logo on the right again. The same list should sit next to that logo. Click **Close** to return to Admin.

## 2026-09-26 · Home lists Live teams and opens the checklist (1.3.091825m)

**Ask:** The Helios logo list was dropping teams after check-in, because it only kept Assignment status Booked or Rescheduled. David also asked to open the real checklist the way Sync from teammate does, still with no cloud save.

**What changed on PR #180:**
- **Tonight's teams** includes Booked, Rescheduled, and Performance Live (checked in / in session) for the Pacific session day. Cancelled, soft-close, moderator cancel, Demo, Unassigned, and Admin Skip stay off the list. If the booking list is empty when Home opens, it loads assignments first.
- Choosing a team (Home or **View progress**) opens the moderator checklist with that team’s latest checklist filled in, and a banner: `You are now seeing {team} progress made at {time} PT`. Close puts Admin back and does not save that checklist as the admin’s session.
- Saves stay blocked the whole time. This does not use Master Switch.

**Version:** **1.3.091825m**. Selftest: `scripts/admin-progress-mirror-selftest.js`.

**PR:** draft [#180](https://github.com/DK-Centific/Twilight-Tracker/pull/180) on `cursor/admin-progress-mirror-09c3`. Do **not** merge until David says push.

**Verify (David):** Hard refresh until the corner says **1.3.091825m**. Sign in as Admin. Click the logo on the right. Tonight’s booked teams and Live teams should both be listed (a Live team says **Live**). Click a team. You should see the checklist and a line starting **You are now seeing**. Click **Close**. You should be back on Admin.

## 2026-09-26 · Admin Home and Performance Live open a read-only progress mirror (1.3.091825l)

**Ask:** Admins (including Master Admin) need a Panic-style panel to see a live or tonight team’s checklist without using Master Switch. Switch puts the admin into the moderator app and can write that team’s SessionState. This must not do that.

**What shipped (branch only, not on main):**
- Admin Home (right-rail logo, and the top logo on a phone) opens **Tonight's teams** for the current Pacific session day, using the same 9 AM gate as Performance. Booked and Rescheduled stay. Cancelled, soft-close, moderator cancel, Demo, Unassigned, Admin Skip, and remote/geo shells stay out.
- Performance → **Live** shows **View progress** on that booking. If it is no longer Live, the button does not open an empty Live view: a finished session opens the read-only Done view; anything else shows “This session is closed.”
- The overlay banner is `You are now seeing {team} progress made at {time} PT`, plus the moderator whose checklist won when one exists. Station list reuses the Performance read-only station view. No pencils, sync, cancel, approve, or merge.
- While the overlay is open, cloud writes are refused (SessionState, Assignment, strikes, approval, panic, TeamLog, Worklog, and the other save paths). Closing it returns to Admin and does not save the mirrored checklist as the admin’s own session.
- Reviewer and Moderator cannot open it. Moderator Home still goes to the welcome screen.

**Version:** **1.3.091825l**. Selftest: `scripts/admin-progress-mirror-selftest.js`. Related day-summary, soft-close, paint-memo, strike, and cancel selftests were re-pinned to this tip and passed.

**PR:** draft [#180](https://github.com/DK-Centific/Twilight-Tracker/pull/180) on `cursor/admin-progress-mirror-09c3`. Do **not** merge until David says push. No Power Automate flow changes. No List, SessionState, or OneData heals.

**Verify (David):** Hard refresh until the corner says **1.3.091825l** (this build is on the pull request, not the live site, until it is merged). On your computer, open the PR branch with a local server. Sign in as Admin. Click the logo on the right. You should see **Tonight's teams**. Click a team. You should see the sentence starting **You are now seeing** and a station list, or **No progress yet**. Close it. You should still be on Admin. Then open **Performance**, click **Live**, and click **View progress**.

## 2026-09-26 · Day Summary first tile is In progress kits only (1.3.091825k)

**Ask:** On Admin Calendar **Day** view, the first summary tile said **Booked today** and counted every Booked or Notified kit. David asked for that tile to say **In progress** and to show only kits that are actually in progress. There was no user-facing label **Claimed** in the app.

**Predicate:** A kit counts on that tile only when all of these are true:
1. One assignment id (duplicate rows for the same id count once).
2. Not a demo booking.
3. Performance already classifies it as Live (`classifyBookingForPerf === 'inprogress'`): checked in, still in the live window, and not Completed, Cancelled, Unassigned, moderator-cancel, soft-close, or Done.
4. The start date is that day, or the booked window overlaps that Pacific day (an overnight kit dated yesterday still counts this morning).
5. The calendar team filter, when one is on.

Booked-but-not-started and Notified do not count. Clicking the tile lists the same kits. Week and month still say **Booked** (Booked + Notified). The other day tiles (Notified, Completed, Teams fully available) are unchanged. No List, SessionState, or OneData writes. Overview donut, soft-close Done, paint memos, and strike/cancel are untouched.

**Version:** **1.3.091825k**. Selftest: `scripts/day-summary-inprogress-selftest.js`.

**PR:** draft [#179](https://github.com/DK-Centific/Twilight-Tracker/pull/179) on `cursor/day-summary-in-progress-c5f7`. Do **not** merge until Watchdog finishes AHP. David already said once fixed, push — Watchdog pushes live after that review.

**Verify (David):** Hard refresh until the corner says **1.3.091825k**. Admin → Calendar → Day. The first tile should say **In progress** and the number should be only kits currently in session. A booked kit that has not started, a finished kit, and a cancelled kit should not add to that number. Week view should still say **Booked this week**.

---

## 2026-09-26 · Overview Team Check-in donut matches Performance Done (1.3.091825j)

**Ask:** The Overview ring (Total booked) was still wrong after soft-close. Finished soft-close sessions should count as Completed, the same way Performance Done already does. A real Cancel session should stay Cancelled.

**Cause:** The ring decided Cancelled from raw List status `Cancelled` before it asked Performance. Overnight soft-close writes that status plus `od-sync-soft-close` (SharePoint may wrap it in HTML). Performance already treats soft-close plus a finished happypath as Done. The ring never got that far, so those teams inflated Cancelled and were missing from Completed. Checked-in versus not-checked-in was already gone in 1.3.091825f.

**Fix:** If Performance already classifies the booking as Done, the ring counts Completed. That includes soft-close plus happypath. A true Cancel session, a hard cancel, and a soft-close that never finished stay Cancelled. Open is total booked minus Completed minus Cancelled. Demo and Unassigned stay out. No List, SessionState, or OneData writes.

**Version:** **1.3.091825j**. Selftests: `scripts/overview-donut-demo-selftest.js` and the donut checks in `scripts/perf-soft-close-done-selftest.js` (real Performance Done rule, including the HTML-wrapped comment).

**PR:** draft [#178](https://github.com/DK-Centific/Twilight-Tracker/pull/178) on `cursor/overview-donut-soft-close-f94a`. Do **not** merge until David says push.

**Verify (David):** Hard refresh → **1.3.091825j**. Admin → Overview. The ring on the right should still say **Total booked**, with Completed, Cancelled, and Open. A finished soft-close team (for example REBECCA Young) should add to **Completed**, not Cancelled. A team that used **Cancel session** should add to **Cancelled**. A booking that is still open should add to **Open**.

---

## 2026-09-25 · Admin Performance opens and filters without a long freeze (1.3.091825i)

**Ask:** Performance was very slow to open and to click tiles/filters, especially Done + All time on a long history.

**Cause (measured on 1,600 assignments and 3,200 SessionState rows):**
- Each classify walked every SessionState row and JSON-parsed the ones whose assignment column did not match. One Today paint did that about 12,240 times (about 39 million parses) and took about 131 seconds. `stripHtmlTags` was only about 69 ms of that.
- The same paint classified each booking several times (toolbar, tiles, chips).
- With auto-strike logs on file, Flagged scanned the whole assignment list once per incomplete team (about 3 seconds).
- SharePoint comment strip ran about 200,000 times per Done + All time click (about half a second). Cached now.

**Fix:** Index SessionState rows once per fetched array. Remember classify / happypath / flagged / cancel / history for one paint only, then clear. Reuse date formatters. Cache stripped comments. During a Performance paint, build one strike-alias index; the 9 AM strike job still uses the old scan. Empty strike store skips the scan. First-open Helios animation stays. Tile clicks stay on the soft fade.

**Version:** **1.3.091825i**. Selftest: `scripts/perf-paint-memo-selftest.js` plus the existing soft-close, past, strike, and panel tests.

**PR:** draft on `cursor/perf-tab-speed-65e7`. Do **not** merge until David says push. No List, SessionState, or OneData writes.

**Verify (David):** Hard refresh → **1.3.091825i**. Admin → Performance. Click **Done**, then **All time**. The list should show without a long freeze. A finished soft-close session should still say Completed. A team that used **Cancel session** should still say Cancelled.

---

## 2026-09-25 · Soft-close Done works when SharePoint wraps the comment (1.3.091825h)

**Ask:** Tip **1.3.091825g** (PR #175) is live, but finished soft-close sessions still stay off Done. SharePoint stores the comment as `<div class="ExternalClass…">od-sync-soft-close</div>`. No List, SessionState, or OneData writes.

**Cause:** `assignmentCommentIsOdSoftClose` only matched when the raw comment started with `od-sync-soft-close`. The HTML wrapper means it never did, so soft-close stayed false and Cancelled rows stayed hidden from Done.

**Fix:**
- Plain-text the comment with `stripHtmlTagsToPlainText`, then match `od-sync-soft-close`.
- The same strip applies to `mod-cancel-session`, so a real Cancel session still counts when SharePoint wraps that comment.
- Soft-close plus happypath still shows under Done. Soft-close without happypath stays off Done. Unassigned and other Cancelled stay hidden from Done. The booking carousel still drops every Cancelled row.
- Version **1.3.091825h**. Selftest: `scripts/perf-soft-close-done-selftest.js`.

**PR:** draft [#176](https://github.com/DK-Centific/Twilight-Tracker/pull/176) on `cursor/soft-close-html-strip-54c5`. Do **not** merge until David says push.

**Verify (David):** Hard refresh → **1.3.091825h**. Admin → Performance. Click **All time**. Click **Done**. These finished sessions should show **Completed**: REBECCA Young, lisa payne, Danica Kjorsvik, Seth Schnurman, Shelly Bowman, Zekelia Sanders, Wendy Clough, Michael Luo. A soft-close night that never finished should not be under Done. A team that used **Cancel session** should still say Cancelled, not Done.

---

## 2026-09-25 · Soft-close finished sessions show under Performance Done (1.3.091825g)

**Ask:** Admin Performance **Done** missed past sessions that overnight soft-close marked List `status=Cancelled` with comment `od-sync-soft-close`, even when SessionState already had a real wrap-up (`session_done` / `station_4_done` / `sessionCompletedAt` / full scenarios). Client only. Do not write List, SessionState, or OneData. Do not undo the soft-close comment.

**Cause:** History dropped every Cancelled row, and Done treated Cancelled as a hard stop before it read SessionState. Soft-close uses a different comment than moderator **Cancel session** (`mod-cancel-session`).

**Fix:**
- A Cancelled row whose comment starts with `od-sync-soft-close` can enter Performance history.
- It shows under **Done** only when the team happypath would already pass, and the existing Done rule is met (session done / office check-out, or the booked end has passed).
- Soft-close without that wrap-up stays off Done, Live, and Next. It is not marked Completed.
- Moderator cancel, Unassigned, and Cancelled without the soft-close comment stay hidden from Done / Live / Next. Moderator cancel can still show as Cancelled.
- The booking carousel still drops every Cancelled row, including soft-close, so the next booking can bind.
- Soft-close plus happypath is not a 9 AM strike. Soft-close without happypath stays out of Flagged the same way other Cancelled rows already do.
- Version **1.3.091825g**. Selftest: `scripts/perf-soft-close-done-selftest.js`. Also past-24h cancel, history, team happypath, mod-cancel, strike, and donut tests.

**PR:** draft [#175](https://github.com/DK-Centific/Twilight-Tracker/pull/175) on `cursor/perf-soft-close-done-b781`. Do **not** merge until David says push. No data heals.

**Verify (David):** Hard refresh → **1.3.091825g**. Admin → Performance. Click **All time** (or **Custom** from Sep 15). Click **Done**. These finished sessions should show **Completed**: REBECCA Young, lisa payne, Danica Kjorsvik, Seth Schnurman, Shelly Bowman, Zekelia Sanders, Wendy Clough, Michael Luo. A soft-close night that never finished (for example Patrick Steffens) should not be under Done. A team that used **Cancel session** should still say Cancelled, not Done.

---

## 2026-09-25 · Incomplete alert clears after auto-strike; Overview donut is Total booked (1.3.091825f)

**Ask:** After 9:00 AM PT, Overview and Performance still listed teams that already got the automatic strike (Venkata × Jashit / Amanda, assignment `od_8d6bedbf…`, session 2026-09-24). Stars were already healed to 3. Do not strike them again. On Overview, the Team check-in ring should show total booked split into Completed and Cancelled, not checked-in versus not checked-in.

**Cause (alert):** The incomplete list only went away after Skip or a manual Strike. The 9 AM automatic strike writes a `kind=auto` log and a checkpoint stamp, but it does not mark the team resolved. The session is still unfinished, so Overview Live status, the Performance banner, and the Flagged count kept showing “Not completed.”

**Fix (alert):** Past 9:00 AM PT, that team drops off those incomplete alerts when every moderator on the team already has an automatic strike log for that assignment and date, or the checkpoint already stamped that assignment and date. A team that has not been struck still shows. Skip and Cancelled stay off the open Strike list. This does not remove stars, write OneData, or strike again.

**Fix (donut):** The ring is **Total booked**. Slices are **Completed**, **Cancelled**, and **Open** (still booked: live, not started, or unfinished). Open is there so the slices add up to the total. Demo and Unassigned bookings are left out. Cancelled uses the same cancel marks as Performance. Completed uses the same Done rule as Performance. The Bookings number on the left still does not count Cancelled.

**Version:** **1.3.091825f**. Selftests: `scripts/incomplete-alert-after-strike-selftest.js` (22 passed), `scripts/overview-donut-demo-selftest.js` (all passed). Also strike, cancel, and Performance panel tests.

**PR:** draft on `cursor/incomplete-alert-donut-a2f7`. Do **not** merge until David says push.

**Verify (David):** Hard refresh → **1.3.091825f**. Admin → Overview. The ring on the right should say **Total booked**, with Completed, Cancelled, and Open. It should not say Not checked in. Admin → Performance. After 9:00 AM PT, Venkata × Jashit should not sit in the “not completed” list for the Amanda session they were already struck for. A team that is still unfinished and has not been struck should still show.

---

**Last updated:** 2026-09-25 · Grok · One strike per assignment and date (1.3.091825e)

## 2026-09-25 · One strike per assignment and date, not per team row (1.3.091825e)

**Ask:** Venkata × Jashit lost two stars each for one incomplete session. PA confirmed the logs: each person has two `kind=auto` lines for assignment `od_8d6bedbf` on 2026-09-24 — team 200027 at 9:20:01 AM PT, then team 200040 at 9:20:11 AM PT (List 230/231). The strike was once per team row. It must be once per assignment + date per person. Stars are already healed 2→3 on SessionState 450. Do not write live stars in this change.

**Cause:** The 9 AM job walked each team row. Two List rows for the same assignment used two team ids, so each person was struck twice about 10 seconds apart.

**Fix:**
- The strike key is assignment + session date + person. Team id and List row are not part of the key.
- A second team row for that same assignment and date does nothing. A later refresh does nothing if that person’s log already has that assignment and date (including the two lines already on file).
- A different assignment the same day can still take its own one star.
- Skip, finished, cancelled, and before 9:00 AM PT are unchanged.
- Version **1.3.091825e**, rebased on main after #172 merged as **1.3.091825d**. Selftest: `scripts/mod-strike-once-per-session-selftest.js` (16 passed). Also `scripts/mod-strike-selftest.js` (118 passed).

**PR:** draft https://github.com/DK-Centific/Twilight-Tracker/pull/173 on `cursor/strike-once-per-mod-8dd7`. David said push when ready; Watchdog merges after AHP LGTM. Do **not** merge from this branch. Do not write List/OD/SessionState to change stars.

**Verify (David):** Hard refresh → **1.3.091825e**. Venkata and Jashit should already show 3 stars. Refresh again. They should stay at 3. A new unfinished team after 9:00 AM PT should lose one star each, not two.

---

**Last updated:** 2026-09-25 · Grok · Performance panel past incomplete, every booking (1.3.091825d)

## 2026-09-25 · Performance panel shows past incomplete stations for every booking (1.3.091825d)

**Ask:** The panel rule is every Performance booking, not one team. If the session actually started, show station progress. The empty “hasn't started” line is only when there is no progress. Amanda / Venkata × Jashit is the example, not a special case. Do not heal SessionState, stamp session_done, change List/OD, or touch strikes.

**Cause:** The panel showed the empty copy whenever `classifyBookingForPerf` was `scheduled`, and never called the station list. A past incomplete session stays scheduled (booked end has passed, not Live, not Done). The pill still reads the latest SessionState status, so the pill and the panel disagreed.

**Fix:**
- One gate for every booking. It does not look at team, assignment id, or participant.
- The empty “hasn't started” copy is only when no co-mod has checked in or recorded station work.
- If the session started, or any non-geo SessionState row has arrived / `station_*_done` / scenario progress, the panel shows the merged station list even when the booking is still scheduled.
- The richer co-mod still wins the merge. Live / Next / Done filters are unchanged.
- Version **1.3.091825d**. Selftest: `scripts/perf-panel-past-incomplete-selftest.js` (generic past partial team, plus the Amanda example).

**PR:** [#172](https://github.com/DK-Centific/Twilight-Tracker/pull/172) merged to main as **1.3.091825d**.

**Verify (David):** Hard refresh → **1.3.091825d**. Admin → Performance. Open any team whose session already started, including one from yesterday that is not finished. The panel should list the stations they completed. It should not say the session hasn't started. Venkata × Jashit / Amanda W Li is one example: the small status should still say **In session · St 2**, with Station 1 and Station 2 complete, Station 3 partly done, and Station 4 not started. A booking that was never checked in should still say the session hasn't started.

---

**Last updated:** 2026-09-25 · Grok · Cancel session wipes checklist (1.3.091825b)

## 2026-09-25 · Cancel session wipes checklist progress (1.3.091825b)

**Ask:** PA + AHP confirmed the wipe. On Confirm Cancel, clear that team session’s SessionState checklist. Do not keep progress for the record. Assignment stays Cancelled with `mod-cancel-session`. No OneData, Flagged, strike, Completed, or Admin Skip change.

**Fix:**
- One confirm upserts every co-mod SessionState shell for that assignmentId (existing rows, team primaries, backups). `sessionStateId` stays stable. `assignmentId` stays bound. `sessionStatus` is **Cancelled**, never Completed or `session_done`.
- The blob is an intentional clear, not a sparse empty write: stations, stationProgress, scenarios, equipment ticks, approval gate, `sessionStartedAt`, `sessionCompletedAt`, and progress score are cleared. Name and address stay. `checklistCleared` is set.
- A richer stale teammate shell for that same assignment does not win back the checklist. Pending offline worklog rows for that assignment are dropped. A later sync will not write checklist progress back onto the cancelled assignment.
- Assignment list is unchanged from the prior contract: status Cancelled, comment starts with `mod-cancel-session`, terminal lock, OneData status untouched, address untouched.
- The person who confirmed also gets a local checklist clear, then welcome re-renders onto the next Booked row.
- Version **1.3.091825b**. Performance **1.3.091825a** is already on main (#171 merged). This branch is rebased onto that main. Selftests: `scripts/mod-cancel-session-selftest.js`, `scripts/perf-past-24h-cancel-selftest.js`.

**PR:** [#170](https://github.com/DK-Centific/Twilight-Tracker/pull/170) draft on `cursor/mod-cancel-wipe-progress-4db0`. Watchdog merges only after AHP CR + push. Do **not** merge from this agent.

**Verify (David):** Hard refresh → **1.3.091825b**. Sign in as a moderator who is already checked in. Press and hold **Cancel session** until the button fills, then tap **Confirm**. My session should move to the next booking with stations not started and equipment unchecked. The cancelled session should say Cancelled, not Completed. The other moderator on that same session should also see a clean checklist. The booking address should stay the same.

---

**Last updated:** 2026-09-25 · Grok · Performance Past = last 24 hours, cancelled stays Cancelled (1.3.091825a)

## 2026-09-25 · Performance Past is the last 24 hours; team cancel stays Cancelled (1.3.091825a)

**Ask:** On Admin → Performance, **Past** should show only the last 24 hours, not every older session. A team that used **Cancel session** should show **Cancelled**. It must not show Done, Incomplete, or Flagged, and it must not get a strike.

**Fix:**
- **Past** uses the booked session end (Pacific time). The session is listed only when that end time is already in the past and still inside the last 24 hours. Sessions that have not ended yet stay on Today. Older sessions stay on All time, This week, and Custom. The Past button now says **last 24 hours**.
- A moderator cancel (Assignment comment starts with `mod-cancel-session`, and/or SessionState says Cancelled) shows **Cancelled** on Performance. It is not Live, Next, or Done. It is not Flagged and it is not a strike. Saved station progress is not turned back into Done. Admin Skip is unchanged. OneData is not written.
- Version **1.3.091825a**. Selftests: `scripts/perf-past-24h-cancel-selftest.js`, `scripts/perf-past-history-selftest.js`.

**PR:** [#171](https://github.com/DK-Centific/Twilight-Tracker/pull/171) merged to main (`0ccfc3c`).

**Verify (David):** Hard refresh → **1.3.091825a**. Admin → Performance. Click **Past**. The small line under Past should say **last 24 hours**. You should see sessions that ended in the last day, not the whole history. Click **All time** to see older ones. Open a team that cancelled a session. The status should say **Cancelled**, not Done or Flagged.

---

**Last updated:** 2026-09-24 · Grok · Moderator Cancel session AHP fold (1.3.091824e)

## 2026-09-24 · Moderator Cancel session, AHP folded in (1.3.091824e)

**Ask:** Same Cancel session button, now matching the AHP client contract on the same draft. Cancelled stays Cancelled. It does not turn back into Booked at 9 AM. Session progress is kept for the record. Admin Skip is not part of this change.

**Fix:**
- Before check-in, Confirm Arrival is unchanged. After check-in (worklog arrived, or arrival time on this booking), the same spot is **Cancel session**. Hold 2 seconds, then confirm.
- Confirm says the **team session** is cancelled. Buttons are **Cancel** and **Confirm**.
- Confirm writes every co-mod Assignment row for that schedule: status **Cancelled** (permanent on that row), comment `mod-cancel-session:<login>:<time>`, same terminal lock as admin cancel. OneData status stays as it was. No Flagged, no strike, no Completed, no session done.
- Station progress is not cleared. Assignment Cancelled is what My session, the carousel, and Performance use. The next Booked row can show (today, or the next future booking). An incomplete night that was not cancelled still stays pinned. 9 AM only chooses which booking My session shows. It does not undo Cancelled.
- Admin Skip is unchanged.
- Version **1.3.091824e**. Selftest: `scripts/mod-cancel-session-selftest.js`.

**PR:** [#169](https://github.com/DK-Centific/Twilight-Tracker/pull/169) draft on `cursor/mod-cancel-session-58d5`. Do **not** merge until Watchdog says push.

**PA:** Sync must keep rows whose comment starts with `mod-cancel-session` (hyphens, not underscores). Do not set them back to Booked, and do not purge them. That keep is permanent on the row, not only until 9 AM. Do not reuse `od-sync-soft-close`.

**Verify (David):** Hard refresh → **1.3.091824e**. Sign in as a moderator who is already checked in. Press and hold **Cancel session** until the button fills, then tap **Confirm**. My session should leave that booking. The session should say Cancelled, not Completed. The next morning it should still say Cancelled.

---

**Last updated:** 2026-09-24 · Grok · Moderator Cancel session (1.3.091824d)

## 2026-09-24 · Moderator Cancel session (1.3.091824d)

**Ask:** After check-in, Confirm Arrival becomes **Cancel session**. Press and hold 2 seconds, then confirm. The whole team’s Assignment rows for that schedule become Cancelled. My session can move to the next booking (Amy after Satya). No strike, no Flagged, no Completed, no OneData write.

**Fix:** Shipped on the same draft, then tightened in **1.3.091824e** (do not clear session progress; Cancelled stays Cancelled).

**PR:** [#169](https://github.com/DK-Centific/Twilight-Tracker/pull/169) draft on `cursor/mod-cancel-session-58d5`. Do **not** merge until Watchdog says push.

---

**Last updated:** 2026-09-24 · Grok · Exact List fixtures + sticky snap (1.3.091824c)

## 2026-09-24 · Exact List rows stay bindable; sticky index cannot resurrect Isaiah (1.3.091824c)

**Ask:** Self-test must use the live rows. On Sep 24 after 9 AM, Narendra Id115 (Satya / Jodie) stays even though Id218 (Amy, Sep 25) is date ≥ today. Id116 (Isaiah) drops, and a newer SessionState time (SS 481) must not bring it back. Pradeepreddy Id227 (Adidela × Pradeepreddy / Michael Luo) stays even with Id217 (Manpreet, Sep 26) present. Id149 never wins. A saved carousel position must not land on Isaiah or on the future row.

**Fix:** Same client gate as 1.3.091824b. A future booking does not count as “starts today.” After wrap-up, last night is no longer the pin. If the saved carousel spot points at a different night, My session snaps to the bindable row (Id115 / Id227). Team label for that row is the assignment team, Adidela × Pradeepreddy. SS 494 (Isaiah orbit on the Satya schedule) is not the pin.

**Version:** **1.3.091824c**. Same draft [#168](https://github.com/DK-Centific/Twilight-Tracker/pull/168). Do **not** merge.

**Verify (David):** Hard refresh → **1.3.091824c**. Sign in as Narendra-tw. My session should be Narendra × Satya / Jodie, not Isaiah and not Amy. Sign in as Pradeepreddy-tw. My session should be Adidela × Pradeepreddy / Michael Luo, not Manoj and not the Sep 26 booking.

---

## 2026-09-24 · SessionState time must not pin the older Booked row (1.3.091824b)

**Ask:** On Sep 24 afternoon neither Narendra row starts today. Amanda (Id 116, Booked, SS 481 Modified 15:58Z) was newer than Jodie (Id 115, Rescheduled, SS 498 Modified 06:15Z), so My session could stick on Isaiah.

**Fix:** After 9 AM, a prior start whose end day is yesterday is dropped even when no booking starts today. Ranking is later booking date, then later start, then Rescheduled/Scheduled. SessionState Modified is not a rank. The team name stays the selected booking’s team (Narendra × Satya / Adidela × Pradeepreddy). Manpreet SS 511 does not take Pradeepreddy’s pin.

**Version:** **1.3.091824b**. Same draft [#168](https://github.com/DK-Centific/Twilight-Tracker/pull/168). Do **not** merge.

---

## 2026-09-24 · Last-night overnight stays My session (1.3.091824a)

**Ask:** After 9 AM PT, Pradeepreddy-tw still missed Adidela × Pradeepreddy (Michael Luo, Sep 23 7 PM–2 AM) and Narendra-tw still showed Isaiah × Narendra instead of Narendra × Satya (Jodie, Rescheduled).

**Cause:** The 9 AM gate treated any future Booked row (Sep 25 / Sep 26) as “today” and dropped last night, because overnight rows are dated on the evening start (Sep 23). The floor still kept the older Sep 22 night that ended Sep 23 (Isaiah, still Booked). TeamLog name is secondary: the wrong row was selected. List team text on the right rows is already correct.

**Fix (client only, no List/OD writes):**
- After 9 AM, last night’s incomplete overnight (end calendar day is today) stays the pin until wrap-up. A future booking does not remove it or take the pin.
- A booking that starts today still replaces last night (unchanged).
- Sessions whose end day is before today drop after 9 AM (Isaiah). Before 9 AM, last night can still be the live session.
- A newer Rescheduled row beats an older Booked row. Booked is not a bonus.
- Team label uses the assignment’s team name when TeamLog disagrees.
- Version **1.3.091824b** (was 1.3.091824a). Selftest: `scripts/mod-overnight-stale-team-selftest.js`.

**PR:** [#168](https://github.com/DK-Centific/Twilight-Tracker/pull/168) draft on `cursor/mod-overnight-stale-team-80c9`. Do **not** merge until David types **push**.

**Verify (David):** Hard refresh → **1.3.091824c**. Sign in as Narendra-tw. My session should be Narendra × Satya / Jodie, not Isaiah and not Amy. Sign in as Pradeepreddy-tw. My session should be Adidela × Pradeepreddy / Michael Luo, not Manoj and not the Sep 26 booking.

---

**Last updated:** 2026-09-23 · Grok · Hide Lakitu edit toolbar from moderators (1.3.091823e)

## 2026-09-23 · Hide Lakitu edit toolbar from moderators (1.3.091823e)

**Ask:** Signed in as Moderator, the Color / Size / Bold / Add table strip was still showing in the Lakitu Guide. Only Admins should see that.

**Cause:** The toolbar style set `display: flex`, which beat the `hidden` flag, so the bar stayed on screen even when the script marked it hidden.

**Fix:**
- A hidden toolbar (and the error line, Edit, Publish, and Undo publish) stays fully gone.
- Moderators and reviewers never get the edit strip. Opening the guide clears edit mode if it was on.
- Admins still see Edit, and the strip only while they are editing.
- Version **1.3.091823e**. Same pull request [#167](https://github.com/DK-Centific/Twilight-Tracker/pull/167). David authorized Watchdog to merge. Do **not** merge from this agent.

**Verify (David):** Hard refresh → **1.3.091823e**. Sign in as a Moderator. Open the Lakitu Guide. You should see the steps and the pills only — no Color, Size, Bold, Add table, Image, or Undo strip, and no Edit or Publish. Sign in as Admin, open the guide, and tap **Edit**. That strip should show then, and hide again after you leave edit.

---

## 2026-09-23 · Lakitu how-to guide drawer (1.3.091823d)

**Ask:** Add a Lakitu Guide button right after the calibration guide. It opens a panel from the right. Admins can edit and publish the steps. Do not merge until David checks it on localhost.

**Fix:**
- Moderator and Admin each get a Lakitu mark button (black circle, white triangle) immediately after the calibration guide / beside the Approval tutorial.
- The guide slides in from the right, about 80% of the screen. Close, click outside, or Escape puts it away. The section pills scroll inside the panel.
- Opening this guide closes the calibration guide and the Approval tutorial, and the reverse.
- Admins see Edit, Publish, and Undo publish. Publish saves one SessionState row, `ss_app_setting_lakitu_guide`. No new Power Automate flow. An unpublished draft stays on this browser only.
- The built-in steps show until an admin publishes. Publishing an empty guide is refused. Pasted web images are removed. A pasted picture must be under 80 KB.
- Station submit is unchanged. The old Ring/Lakitu outside link button is not the guide.
- Version **1.3.091823d**. Selftest: `scripts/lakitu-guide-selftest.js`.

**PR:** [#167](https://github.com/DK-Centific/Twilight-Tracker/pull/167) draft on `cursor/lakitu-howto-guide-2e1c`. David reviews on localhost. Do **not** merge from this agent.

**Verify (David):** Hard refresh → **1.3.091823d**. On the moderator side, the new circle-and-triangle button sits just after the book icon. Tap it. A panel should slide in from the right with Steps, Metadata, Bad takes, Troubleshooting, and FAQ. Tap FAQ and the panel should scroll, not the page behind it. Tap outside the panel or press Escape and it should close. Sign in as Admin. The same button is next to the Approval tutorial. Open it, tap **Edit**, change a line, tap **Publish**. Refresh. The new line should still be there. Tap **Undo publish** to put the previous text back.

---

## 2026-09-23 · Approval, arrival, and session wipe fixes (1.3.091823c)

**Ask:** Fix the seven remaining critical client bugs from the AHP audit. Strike fixes in **1.3.091823b** stay as they are.

**Cause:**
- A failed review submit still showed Pending, and a later refresh never cleared it, so the moderator stayed locked with no card for the reviewer.
- While bookings were still loading, an empty booking id wiped every saved Approved or Pending.
- After about 10 minutes, an approved station locked again if the refresh missed.
- A booking with no address counted as on site, so Confirm Arrival worked off site.
- A background refresh could treat a finished booking as a new one and erase Done, arrival, and notes.
- Team sync scored progress before it threw out yesterday’s work, then remembered that high score and blocked a later real sync.
- Sync from another browser could replace a finished session with an empty copy.

**Fix:**
- Pending is kept only after the review row is actually saved. If the save fails, the moderator can submit again. A refresh that finds no review row clears a stuck Pending.
- Gates are left alone until a real booking id is known.
- A reviewer-approved station stays unlocked until it is sent back or submitted again.
- No address means not on site. Confirm Arrival does not succeed.
- A background refresh does not erase a finished session. Progress clears when the person swipes to another booking, or when the booking id and day really change.
- Team sync scores progress after yesterday’s work is removed. An empty other-browser copy does not replace a finished session.
- Version **1.3.091823c**. Selftest: `scripts/critical-client-selftest.js`.
- AHP follow-up: a cloud-confirmed automatic approval stays unlocked (the 10-minute timer is only before the cloud confirms it). A finished session is not cleared by a swipe while wrap-up still pins that booking. A Pending that just saved is kept for 5 minutes if the refresh has not shown the row yet.

**PR:** [#166](https://github.com/DK-Centific/Twilight-Tracker/pull/166) ready for review on `cursor/critical-ahp-client-fixes-ea44`. Do not merge from this agent. Watchdog merges after AHP review.

**Verify (David):** Hard refresh → **1.3.091823c**. Submit a station for review only when you are on a booked session. If the send fails, you should see a message and the Submit button again, not a stuck “waiting” card. After a reviewer approves, stay on that station for more than 10 minutes (or turn the network off briefly and back on). The later scenarios should stay open. Confirm Arrival should stay locked when the booking has no address. Finish a session, leave the page open through a refresh, and Done should stay Done.

---

## 2026-09-23 · No strike before 9 AM, Skip sticks, finished teams stay at their stars (1.3.091823b)

**Ask:** Do not give a strike before 9:00 AM Pacific. Admin Skip on a flagged incomplete session must stick and block that session’s strike. A team that finished before 9:00 AM must never lose a star. After the live push, **Pradeepreddy × Manoj** and **Jashit × Adidela** were struck even though they had finished.

**Cause:**
- The 9 AM check read the hour with a clock format that can say “past 9” at midnight (hour 24 or a 12-hour number). Stars could drop before 9:00 AM PT.
- Auto-strike ran as soon as assignments loaded, **before SessionState was read**. Finish status (station 4 done, wrap-up, session done, all scenarios uploaded) lives on SessionState. The Assignment row often stays Booked. With no rows loaded, the team looked incomplete and lost a star. **Pradeepreddy × Manoj** is that shape in the notes (both primaries at station 4 done, Assignment not flipped to Completed). **Jashit × Adidela** is not in the repo; the same path explains a finished pair losing a star. A 256-row SessionState page can also hide an older finish row; that case is no longer treated as incomplete.
- The strike save wrote an older copy of the star list back over the new one, and Skip was stored only on “today,” so a refresh could miss it. Idempotency was the team id, so one session could collide with another.

**Fix:**
- Strike only at or after **9:00 AM PT on the morning after the booking date**, and only when SessionState has loaded and the team is still incomplete (team-OR: any primary finishing counts).
- Skip is saved on the booking day and the strike morning, keyed by assignment id, and blocks that session only. A later session for the same team is not stuck flagged.
- The strike job does not write an old star list back on top of Skip or a real decrement.
- A false star already taken is **not** auto-cleared. Admin can open **Moderators**, open the person, and tap **Reset** to put stars back to 4. The job will not strike that same finished session again.
- Version **1.3.091823b**. Selftest: `scripts/mod-strike-selftest.js`, `scripts/team-happypath-flag-selftest.js`.

**PR:** [#165](https://github.com/DK-Centific/Twilight-Tracker/pull/165) ready for review on `cursor/strike-9am-skip-gate-429d`. David authorized merge once this PR is ready. Watchdog merges. Do not merge from this agent.

**Verify (David):** Hard refresh → **1.3.091823b**. Before 9:00 AM PT, an unfinished team can show Flagged, and stars stay put. After 9:00 AM, an unfinished team can lose one star. A team that already finished (either person done) does not lose a star. On the 9 AM list, tap **Skip** for one incomplete team, refresh, and that team does not lose a star. Their next session is not stuck on Flagged. To give back a star that was taken by mistake: **Moderators** → open the person → **Reset**.

---

## 2026-09-23 · Message a moderator lists people, not teams (1.3.091823a)

**Ask:** Admin → Performance → Message a moderator. The dropdown showed teams. David wants the people whose role is Moderator.

**Cause:** The note composer asked for a team first, then only the primaries and backups on that team. It did not read the moderator directory’s Moderator role.

**Fix:**
- The composer has one Moderator list. It shows directory people whose role is Moderator (Mod / Moderator). Admins, reviewers, and team names are not in the list. A moderator who is not on a team is still listed.
- Send still writes the same private note to that person’s login. Team feedback is unchanged.
- Version **1.3.091823a**. Selftest: `scripts/feedback-inbox-selftest.js`.

**PR:** [#164](https://github.com/DK-Centific/Twilight-Tracker/pull/164) ready for review on `cursor/perf-message-moderators-4a27`. Do not merge until David types **push**.

**Verify (David):** Hard refresh → **1.3.091823a**. Admin → Performance → **Message a moderator**. The list should be people’s names, not team names. Pick one person, write a short note, and send. That person should get it in Inbox.

---

## 2026-09-23 · Admin Performance no longer jumps to Moderator Hub (1.3.091822e)

**Ask:** Opening Admin → Performance landed on Moderator Hub. Performance clicks also felt slow. Keep the calm 822a fades.

**Cause:** Performance and Moderator Hub both paint into `#subtabBody`. The hub’s role filter stays on Moderators even while another tab is open. When the moderator list finished loading (often after Performance was already open), it wrote the hub into that shared spot. Filter clicks also rebuilt the whole Performance screen and then built the tile list again to decide if anything changed.

**Fix:**
- A finished moderator or participant load only draws the hub when that tab is actually open. On Performance it only refreshes the list. Overview → Moderators, the Activities pill, and the Moderator Hub tab still open the hub on purpose.
- Tile, date, Teams/Moderators, and search clicks light the control right away and update the list on the next frame. The first-open rise and the short 160ms list fade stay. The pressed pill reacts in about 90ms.
- Version **1.3.091822e**. Selftests: `scripts/perf-hub-redirect-selftest.js`, `scripts/perf-motion-soft-selftest.js`.

**PR:** [#163](https://github.com/DK-Centific/Twilight-Tracker/pull/163) draft on `cursor/perf-hub-redirect-latency-066a` — do **not** merge until David types **push**.

**Verify (David):** Hard refresh → **1.3.091822e**. Admin → Performance. You should stay on Performance (tiles: All, Done, Live, Next, Flagged). Click **Live**, **Past**, **Teams**, and **Moderators**. The list should fade briefly and the button you clicked should highlight right away. Then click **Moderator Hub** on purpose. That should still open the hub.

---

## 2026-09-23 · Admin scenario edit past the approval gate (1.3.091822d)

**Ask:** Admin opens Admin → Switch into the checklist (moderator station) app. The Edit pencil on scenarios after scenario 3 looks locked. Moderators must stay locked.

**Cause:** The moderator approval gate locks every button on scenarios after calibration (`01` / `02`; scenario `03` and later). That includes the Master Admin scenario Edit pencil. The same gate also stops the next-scenario and next-station controls, so later stations cannot be opened to edit.

**Fix:**
- Signed-in Admin and Master Admin can open later scenarios and stations and tap Edit. Status buttons and notes on a locked scenario stay disabled. Submit still waits for reviewer approval.
- Reviewer and moderator locks are unchanged.
- Version **1.3.091822d**. Selftest: `scripts/admin-scenario-edit-gate-selftest.js`.

**PR:** [#162](https://github.com/DK-Centific/Twilight-Tracker/pull/162) ready for review on `cursor/admin-scenario-edit-gate-9819`. David said **once done, push** (2026-09-23). Watchdog squash-merges. Do not merge from this agent.

**Verify (David):** Hard refresh → **1.3.091822d**. Admin → Switch. Open a station that still needs reviewer approval. Scenarios after scenario 3 show an Edit pencil you can tap. A moderator on that same station still cannot edit or move ahead until approval.

---

## 2026-09-22 · Stars no longer reset on refresh (1.3.091822c)

**Ask:** After a new build and a hard refresh, some moderators lost stars. david-tw showed 3★, then SessionState row 450 put a bad or empty cloud copy on top.

**Cause:** The earlier protect (1.3.091821f) was not enough on a cold load. The app picked the strikes row with the newest time, even when that row was empty, and ignored an older row that still had the stars. A refresh could also turn a real 3★ into 4★ when the cloud copy was already on the 4★ scale but one person’s stamp was missing. Opening the page could save that wrong count back to the cloud before the good copy was read.

**Fix:**
- An empty newer strikes row cannot hide an older row that still has stars.
- A real 3★ that is already on the 4★ scale stays 3★. A build number change does not redo that conversion.
- The page does not write stars to the cloud until it has read the strikes row. Reading the page does not schedule that write.
- After Reset, a refresh within about a minute still blocks an older lower copy.
- Version **1.3.091822c**. Selftest: `scripts/mod-strike-selftest.js`. Rebased onto main **1.3.091822b** (Booking week scroll, PR #160).

**PR:** [#161](https://github.com/DK-Centific/Twilight-Tracker/pull/161) draft on `cursor/strike-cloud-ingest-guard-e1e7` — do **not** merge until David types **push**.

**Verify (David):** Hard refresh → **1.3.091822c**. Admin → Moderators. A person who had 3★ should still show 3★. Reset someone to 4★, refresh, and they should stay at 4★.

**PA:** If row 450’s blob is actually empty (`mods: {}`) and there is no older strikes row with the real stars, the app cannot invent the old counts. Keep one row, id `ss_app_setting_moderator_strikes`, with `key`, `mods`, `checkpoints`, and `starScale`. Do not append a second empty row with a newer time.

---

## 2026-09-22 · Booking week Sessions this day scrolls (1.3.091822b)

**Ask:** In Booking week view, Sessions this day stopped scrolling once a day had more than about three sessions. Extra cards were cut off.

**Cause:** Week view with Assign a team open set the booking sheet to `overflow: hidden`. The session list’s own cap was `min(52vh, 540px)`, taller than the space left under the week header, so the sheet clipped the 4th card before the list could scroll.

**Fix:**
- Week session list max-height is about three cards (`3 × 116px` plus gaps) with `overflow-y: auto` and a visible scrollbar.
- The booking sheet scrolls again so that three-row list is not cut off on a phone or a short window. The app behind the sheet stays still.
- Month view still uses the taller list. Week grid, day headers, and Assign a team are unchanged.
- Version **1.3.091822b**. Selftest: `scripts/booking-week-sessions-scroll-selftest.js`.

**PR:** [#160](https://github.com/DK-Centific/Twilight-Tracker/pull/160) merged to main.

**Verify (David):** Hard refresh → **1.3.091822b**. Admin → Booking → Week. Pick a day with four or more sessions. Sessions this day shows about three, and you can scroll inside that list to see the rest. The day buttons and the rest of the week screen stay put.

---

## 2026-09-22 · Performance clicks are calmer (1.3.091822a)

**Ask:** Clicking Performance tiles or filters flashed the whole page. Keep the first-visit motion. Make later clicks short and smooth.

**Cause:** Every Live / Next / Done / Flagged tile, date pill, Teams/Moderators switch, search, and Flagged filter rebuilt the list and replayed the full Helios rise-and-stagger (cards starting invisible and sliding up, one after another). The red Flagged glow was not the flash.

**Fix:**
- First time you open Performance, or first time you open Flagged history, the gentle staggered entrance still plays.
- Tile, filter, date, Teams/Moderators, search, Grid/List, and Sessions/Incident clicks only fade the results for **160ms**. The summary tiles and toolbar stay still.
- Flagged filters, sort, and search do the same short fade. List/Split does too.
- Version **1.3.091822a**. Selftest: `scripts/perf-motion-soft-selftest.js`.

**PR:** [#159](https://github.com/DK-Centific/Twilight-Tracker/pull/159) draft on `cursor/perf-calm-motion-3ffe` — do **not** merge until David types **push**.

**Verify (David):** Hard refresh → **1.3.091822a**. Admin → Performance. The first open can still ease in. Click **Live**, **Next**, **Done**, **Flagged**, **Today**, **Past**, **Teams**, and **Moderators**. The list should fade briefly. The tiles you clicked should not blink or slide in again.

---

## 2026-09-22 · Team complete is the best primary (1.3.091821g)

**Ask:** If any co-mod on the assignment finishes (all stations / `station_4_done` / `session_done` / full scenarios), the whole team is complete for Flagged, Done, and the 9 AM strike — even when the other co-mod is short or their SessionState never synced. Same idea as team happypath.

**Case:** Venkata × Jashit / Seth Schnurman (`od_2e9f20e3…`). Venkata at `station_4_done` with scenarios Uploaded and no `session_done`. Jashit SessionState empty. Flagged still showed incomplete because a missing Station4 stamp was treated as “still checked in,” and the empty co-mod row could hide the finished one.

**Fix:**
- Team completeness is the best **primary** on that assignment (backups do not finish the team).
- `station_4_done` counts without `session_done` / `sessionCompletedAt`.
- A full scenario set on one primary covers a short co-mod.
- A prior-day status on a reused booking does not finish today’s session.
- Version **1.3.091821g**. Selftest: `scripts/team-happypath-flag-selftest.js`.

**PR:** [#158](https://github.com/DK-Centific/Twilight-Tracker/pull/158) draft on `cursor/team-complete-or-flagged-f537` — do **not** merge until David types **push**.

**Verify (David):** Hard refresh → **1.3.091821g**. Admin → Performance → Flagged. Venkata × Jashit (Seth Schnurman) should **not** be listed when Venkata is at station 4 done, even if Jashit has no progress. The same session should show under Done (or Past, if it is not today).

---



## 2026-09-21 · Strike reset stays after a stale poll (1.3.091821e)

**Ask:** Admin reactivates a moderator and resets stars (david-tw, about 3★ / deactivated → 4★). Within about a minute the stars flip back to deactivated. PA confirmed the shared SessionState row and healed it: david-tw Active, 4★, deactivated false, blob version 1.

**Cause:** The strikes row is one blob (`ss_app_setting_moderator_strikes`) saved with overwrite. A late poll, or a second Admin tab, could lay an older copy on top of a fresher reset. That re-ran deactivate.

**Fix:**
- Each moderator record stores `updatedAt` and `updatedBy` on set / reset / manual / auto.
- Merge keeps the newer `updatedAt` (if that is missing, `log[0].at`). An older remote copy cannot lower stars over a fresher reset.
- While that save is still sending, and for a short time after reset, a poll cannot lower stars or deactivate that person.
- Blob `version` + `lastWriter` are stamped and compared. An older version loses. The strikes save has no etag, so this check is on the client.
- Version **1.3.091821f** (was **1.3.091821e** on this same PR). Selftest: `scripts/mod-strike-selftest.js`.
- Moderator Hub **Grid**: the Orbit ID line under the name is gone. Stars sit in that spot, on one reserved line, so a long name does not clip or wrap them. List view still shows Twilight Login ID. Opening a card still lists Twilight Login ID in the details.

**PR:** [#157](https://github.com/DK-Centific/Twilight-Tracker/pull/157) on `cursor/mod-strike-freshness-merge-08cf` — Watchdog merges (David authorized push). Do not merge from this agent.

**Verify (David):** Hard refresh → **1.3.091821f**. Admin → Moderators. Open the person who was deactivated, set them Active, and confirm stars show **4**. Leave the page open for a minute (a second Admin tab can stay open too). Stars must stay **4** and the status must stay **Active**. On the card view, the line under the name is the stars, not the login id.

---

## 2026-09-21 · Performance Live / Next / Done window (1.3.091821d)

**Ask:** Admin Performance Live tiles showed **5 teams as Live** whose sessions were **not today**. Align Live / Next / Done with David’s policy.

**Cause:** `classifyBookingForPerf` treated any `arrived` booking that had not yet reached booked end as Live (`!pastEnd && assignmentPerfSessionStarted`). That included leftover arrived on **future-day** and **stale past-day** rows, plus Notified / geo-only. Overnight that had already ended could also stay pinned via the admin-queue bypass.

**Fix:**
- New `assignmentInPerfLiveWindow` — Pacific **today** overlap (overnight counts) + not past booked end + now inside the booked clock window (or up to **2 hours** early check-in).
- **Live** = checked in from the app (`arrived` or later, not wrap-up) AND in that window.
- **Next** = not yet checked in / upcoming, including today not-started and tonight before the window.
- **Done** unchanged for wrap-up / happypath — past-day and overnight-finished still belong here (Past / history synergy).
- Overview Live + queue bypass use the same window helper. Notified-only and geo-only are not Live.
- Version **1.3.091821d** (past main `821b` and open #155 `821c`). Selftest: `scripts/perf-live-next-done-selftest.js`.

**PR:** [#156](https://github.com/DK-Centific/Twilight-Tracker/pull/156) draft on `cursor/perf-live-next-done-window-eff0` — do **not** merge until David types **push**. Started from **main** (did not rebase #155 foreign-orbit).

**Verify (David):** Hard refresh → **1.3.091821d**. Admin → Performance → **Today**. Live should only list teams who checked in and whose session is happening now (or last night’s overnight still running before end). Tonight’s not-started teams are **Next**. Yesterday evening finished teams are **Done** (click **Past** or **Done** if they are not on Today).

---

## 2026-09-21 · Team = Session Flag / 9 AM (1.3.091821b)

**Ask:** **Rohith × Venkata** showed Completed under Performance → Done (all stations) but still appeared on Flagged / 9 AM auto-strike. After PA healed SS 477/479 to `session_done` + Skip/resolved by assignmentId, the client must not re-queue. Flag list + red glow must auto-show only when flagged teams exist. Flagged history stars are **per moderator**, not Team (4/4).

**Cause:** Flagged required a `session_done` stamp on one row (`isAssignmentCompleteForFlagged`) while Done treated `station_4_done` after session end as complete. Teammate wrap-up could lose to the other mod’s thinner station stamps. After Past/history defaulted the date pill to **Today**, the 9 AM banner hid yesterday’s queue. History presented one star count that read as a team 4/4.

**Fix:**
- `isAssignmentTeamHappypathComplete` — either co-mod `session_done` / wrap-up / `station_4_done` / all-stations maps completes the assignment (soft-merge richer → thinner).
- Flagged + 9 AM strike share that helper. Skip/resolved by **assignmentId** still works when List `teamId` is null.
- Checkpoint banner always rebuilds; Today still shows the 9 AM Flag list; Flagged tile gets the red glow only when count > 0.
- History rows are **one moderator’s stars** (Warning 1/2, Locked, Final Chance, Deactivated). Completeness is team-level; stars are not shared.
- Version **1.3.091821b**. Selftest: `scripts/team-happypath-flag-selftest.js`. Fixture report: `docs/ROHITH-VENKATA-FLAG-FIX-REPORT.md`.

**PR:** [#154](https://github.com/DK-Centific/Twilight-Tracker/pull/154) draft on `cursor/team-happypath-flag-946c` — do **not** merge until David types **push**.

**Verify (David):** Hard refresh → **1.3.091821b**. Admin → Performance. **Rohith × Venkata** (Danica, Sep 20) is Completed under Done / Past. Flagged and the 9 AM list must **not** show them. If another team is still incomplete, the Flagged tile glows red and the list appears. Open Flagged history: each name has **that person’s** stars (someone with 3★ can sit next to someone with 4★).

---

## 2026-09-21 · Admin Performance Past / history (1.3.091821a)

**Ask:** Yesterday’s completed teams **Pradeepreddy × Manoj** (PxM, SS 468/470, `od_27c50635`) and **Muhammad × Sravya** (MxS, SS 454/455, `od_d9286d02`) vanished from Admin Performance after PA healed them to `session_done` + Approved + Skip/resolved. David wants past sessions reviewable.

**Cause (client filter, not a SessionState gap):** PA confirmed SS rows present and healthy. Performance tiles always read the **live admin queue** (`perfTeamBookingCandidates` + `perfAssignmentVisibleInAdminQueue`), which drops Completed / `session_done` wrap-up, applies the 2-day floor, and after 9 AM PT scopes to today+. Date pills (All time / This week / Custom) ran *after* that cut, so they never saw healed rows. Skip/resolved does **not** hide tiles; it only keeps them out of **Flagged** (correct — do not re-flag).

**Fix:**
- Default date range is **Today** (ops Live queue unchanged).
- New **Past** pill + This week / All time / Custom / **Done** use a **history** source that includes completed + skipped.
- Flagged still excludes complete + Skip/resolved. Strike checkpoint UX unchanged.
- Version **1.3.091821a**. Selftest: `scripts/perf-past-history-selftest.js`.

**PR:** [#153](https://github.com/DK-Centific/Twilight-Tracker/pull/153) draft on `cursor/perf-past-history-review-9f44` — do **not** merge until David types **push**.

**PA follow-up (2026-09-21):** Assignment List present — PxM `od_27c50635` status/odStatus **Rescheduled**; MxS `od_d9286d02` Booked/Scheduled. Confirmed no gap: Past/history keeps Rescheduled; `classifyBookingForPerf` marks **Done** from SS `session_done`. Selftest fixtures match those live rows.

**Verify (David):** Hard refresh → **1.3.091821a**. Admin → Performance → **Today** still Live-focused. Click **Past** (or **All time**). Open **Pradeepreddy × Manoj** and **Muhammad × Sravya**. They should show Completed. Flagged must **not** light them up again.

---

## 2026-09-20 · Pixel 7 + phone-class mobile layout (1.3.091820y)

**Ask:** Make the mobile UI adaptive for **Google Pixel 7** (portrait + landscape) as well as iPhone 13+ / Galaxy S20+ / Pixel 8+.

**Cause:** Phone chrome keyed on `max-width: 760px` only. Pixel 7 landscape is **915×412**, so Stations cover-flow, Helios bottom bar, accordion, and docked panic switched to the desktop rail. Portrait 412 also missed the 400px Confirm Arrival compact rules.

**Fix (no UA sniff):**
- Shared `isPhoneLayout` / `isPhoneLayoutSize` — width ≤ 760 **or** landscape short side ≤ 500 and long side ≤ 1100 (Pixel 7/8 412×915, Pixel 8 Pro 448×998, iPhone 13, Galaxy S20).
- CSS: every `max-width: 760px` also matches `(orientation: landscape) and (max-height: 500px)`; desktop `min-width: 761px` also needs `min-height: 501px`.
- Arrival / My session compact **400px → 430px** so 412px Pixel 7/8 get full-width Confirm Arrival.
- `100dvh` + `visualViewport` for scenario-flow height / Android URL bar.
- `html.is-phone-layout` backup for rail / bottom bar / sc-flow.
- Landscape login card compact so Sign In fits on a 412px-tall Pixel 7.

**Version:** **1.3.091820y**. Selftest: `scripts/phone-layout-selftest.js`.

**PR:** [#152](https://github.com/DK-Centific/Twilight-Tracker/pull/152) draft to `main` — do **not** merge until David types **push**.

**Verify (David):** Hard refresh → **1.3.091820y**. On a Pixel 7 (or Chrome DevTools 412×915): Stations tiles, actions bar, header, My session, Confirm Arrival all fit. Rotate to landscape: same mobile Stations flow (not desktop rail), nothing clipped.

---

## 2026-09-20 · Team sync full audit + fix + toast (1.3.091820x)

**Ask:** Team sync does not work for co-mods. PA verified SS READ/WRITE healthy; flag reset David-tw only. Ship client past 820w.

**Bugs / gaps fixed:**
1. Soft-auto-merge when teammate `progressScore` ahead **even with local partial** (`pickBetterScenario`).
2. Freshness from `progressAt` / `sessionCompletedAt` / `Modified` when SS column `lastActive` is null.
3. Clearer banner copy (merge stations, not TeamLog; auto-merge when ahead).
4. `_lastSyncMergeScore` — Decline / wall-clock must not permanently block a later richer teammate (Sravya 108621 > Muhammad 100201).
5. PRIMARY pick: same `assignmentId` wins despite `teamId` diverge; `sessionStateRowTeamId` resolves via `sessionStateId`.
6. **Toast:** `Team sync complete · Pulled Station N–M from Name` on auto-merge, banner Sync, welcome Sync, and modal Accept.

**Ship:** **1.3.091820x**. Selftest `scripts/team-sync-assignment-teamid-selftest.js`. Contract `docs/team-sync-contract.md`.

**Verify (David):** Hard refresh → **1.3.091820x**. Co-mod with lower score should auto-merge + toast; Decline then teammate advances score → sync again; null `lastActive` still works via `progressAt`.

---

## 2026-09-20 · Admin station merge prefer-richer + Approval Approved>Pending (1.3.091820w)

**Ask:** Yesterday (2026-09-19 PT) PxM Rohit + MxS lisa payne finished stations + checkout but Admin showed wrong state after 1.3.091820v. PA fixing SS maps + session_done + Approvals — investigate remaining **client** gaps.

**Live data (diagnose 11:28 AM PT):**
| Team | OD | SS | Approvals |
|------|----|----|-----------|
| Pradeepreddy×Manoj · Rohit | `od_27c50635…` | 468/470 both `station_4_done` all 8/8 · **no sessionCompletedAt** | Manoj Station1 **Pending** (08:29) after Pradeep Station1 **Approved** (04:11) |
| Muhammad×Sravya · lisa payne | `od_d9286d02…` | 455 Sravya `station_4_done` 8/8 · 454 Muhammad Station3 **2/8** | Sravya St3 Approved · Muhammad St3 Pending (stable id) |

**Client gaps found (code):**
1. **Admin Performance station panel** (`renderPerfStationListHTML`) first-wins by `lastActive` per station key → newer empty/partial heartbeat clobbers richer teammate map → **Station3 2/8** while overall pill is Completed (`station_4_done` past end).
2. **Approval list dedupe** (`dedupeApprovalsByTeamStation`) newest-epoch wins → later Pending clobbers earlier Approved → **Approval pending** while session detail shows all stations done.
3. Completion write to wrong SS / scrub wipe: **not reproduced** on these rows — writes landed on correct `ss_od_*`; `state.assignmentId` null in JSON is normal (`extractSyncableState` omits it; SharePoint column set). Missing `sessionCompletedAt` = wrap-up never stamped (checkout-only) · PA stamp + existing 820g pin cover.

**Fix (1.3.091820w):**
- `mergeStationMapsPreferRicher` + `pickBetterScenario` soft-merge in Admin station panel; skip geo_presence/remote shells.
- `dedupeApprovalsByTeamStation`: Approved/AutoApproved always beat Pending/InReview; Rejected still yields to later Pending resubmit.
- Selftests: `admin-station-merge-prefer-richer-selftest.js`, extended `approval-one-per-team-selftest.js`.

**PA coordinate (data — still needed):**
1. Stamp `session_done` + `sessionCompletedAt` on SS 468/470/455 (and soft-merge 455→454 station maps if Muhammad stays 2/8).
2. Soft-delete or Approve leftover Pending: Manoj `appr_Manoj-tw_od_27c50635…_Station1_…`; Muhammad `appr_od_d9286d02…_Station3`.
3. Strikes cp **2026-09-20** Skip/resolved for both assignmentIds if flag still shows after session_done.
4. Do **not** invent Assignment List Completed (OD sync owns status).

**Verify (David):** Hard refresh → **1.3.091820w**. Perf panel for lisa payne: Station3 **8/8** (not 2/8). Approvals: Rohit Station1 shows **Approved** (not Pending). After PA stamp: both teams Completed / not flagged incomplete.

**PR:** ship after selftests green.

---

**Last updated:** 2026-09-20 · Grok · Master-Admin Approval Delete soft-append go-live (1.3.091820o)

## 2026-09-20 · Enable Master-Admin Approval Delete via soft-append (1.3.091820o)

**Ask:** PA Condition `operation:'delete'` is still not saved; soft-delete append already works on Approval WRITE URL `ab87a7c7…`. Flip Delete ON for Master Admin using WRITE append `{ approval_id, status:'Deleted' }` / `event_type=deleted`.

**Fix:**
- `APPROVAL_PA_DELETE_ENABLED = true`
- `deleteApprovalRequest` soft-appends via `writeApprovalEvent` (`status:'Deleted'`, `event_type:'deleted'`, optional `requestingAdminOrbitId`) — does **not** POST `operation:'delete'`
- Master Admin only (`isMasterAdminUser`) unchanged
- Confirm → refresh list (`ensureApprovalData({ force:true })`); `isApprovalSoftDeleted` / `resolveApprovals` filter Deleted rows

**Selftest:** `scripts/approval-delete-selftest.js` (+ one-per-team soft-delete assert).

**Version:** **1.3.091820o**.

**PR:** [#148](https://github.com/DK-Centific/Twilight-Tracker/pull/148) · merged to `main`.

---

## 2026-09-19 · Gate Approval Delete until PA soft-delete is saved (1.3.091820n)

**Ask:** PA soft-delete `operation:'delete'` is not saved yet; keep the live Master-Admin Delete action off.

**Fix:** Added explicit `APPROVAL_PA_DELETE_ENABLED = false` near the existing Write/Delete URL alias. The Approval list does not render Delete for Master Admin while false, and the delete handlers fail closed as a defensive backstop. Flip the one boolean to `true` after PA confirms delete probes.

**Selftest:** `scripts/approval-delete-selftest.js` covers the disabled default and render gate.

**Version:** **1.3.091820n**.

**PR:** [#147](https://github.com/DK-Centific/Twilight-Tracker/pull/147) · merged to `main`.

---
## 2026-09-19 · One Approval per team/session (1.3.091820m)

**Ask:** Ship one approval card per team/session; PA WRITE OK confirmed.

**A — Stable approval_id**
- `approval_id` = `appr_{assignmentId}_{StationLabel}` (no orbit, no timestamp)
- `orbit_login_id` remains the submitter on WRITE
- Either primary submit/resubmit reuses the same id
- Admin Approvals list: dedupe one card per `assignment_id|station` (team + submitter)
- Approve/Reject once unlocks both (existing teammate unlock + Admin 1 row)
- Soft-delete by `approval_id` unchanged
- Selftest: `scripts/approval-one-per-team-selftest.js`

**B — PanicLog READ** — already on main as **1.3.091820k** (`PANICLOG_PA_READ_URL` + Excel-serial `sessionDate` normalize).

**C — Approval arrival-style toast + chime** — included from 820l (Admin/Reviewer on new Pending; mod on Approved/Rejected).

**Version:** **1.3.091820m** (past 820j delete + 820k PanicLog + 820l toast).

---

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
| **`main` version** | **`1.3.091822b`** (Booking week scroll · #160 merged) |
| **This branch** | **`1.3.091822c`** · Stars survive an empty/stale SessionState 450 ingest after refresh · `cursor/strike-cloud-ingest-guard-e1e7` · [#161](https://github.com/DK-Centific/Twilight-Tracker/pull/161) |
| **Live site** | https://dk-centific.github.io/Twilight-Tracker/ |
| **Last merged** | PR #154 · team happypath Flag / strike |

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
| [#161](https://github.com/DK-Centific/Twilight-Tracker/pull/161) | `cursor/strike-cloud-ingest-guard-e1e7` | Stars survive an empty or stale SessionState 450 ingest after refresh | Draft · **1.3.091822c** · do not merge |
| [#159](https://github.com/DK-Centific/Twilight-Tracker/pull/159) | `cursor/perf-calm-motion-3ffe` | Performance tile/filter clicks fade 160ms instead of re-staggering | Draft · **1.3.091822a** · do not merge |
| [#158](https://github.com/DK-Centific/Twilight-Tracker/pull/158) | `cursor/team-complete-or-flagged-f537` | Team complete = best primary for Flagged / Done / 9 AM | Merged to main · **1.3.091821g** |
| [#156](https://github.com/DK-Centific/Twilight-Tracker/pull/156) | `cursor/perf-live-next-done-window-eff0` | Live/Next/Done = checked-in + today/overnight window | Draft · newest |
| [#155](https://github.com/DK-Centific/Twilight-Tracker/pull/155) | `cursor/perf-foreign-orbit-scope-18f9` | Hide foreign orbits on Done Arrival / LATEST UPDATE | Draft · `1.3.091821c` · not included |
| [#154](https://github.com/DK-Centific/Twilight-Tracker/pull/154) | `cursor/team-happypath-flag-946c` | Team=Session happypath for Flagged/9AM · per-mod stars · Flag glow | **Merged** to main |
| [#153](https://github.com/DK-Centific/Twilight-Tracker/pull/153) | `cursor/perf-past-history-review-9f44` | Admin Performance Past / history so completed+skipped stay reviewable | Merged to main |
| [#112](https://github.com/DK-Centific/Twilight-Tracker/pull/112) | `cursor/activities-map-perf-today-6662` | Activities Map Today = Performance overnight overlap + 9 AM queue gate | Draft |
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