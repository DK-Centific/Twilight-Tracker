# Agent handoff — Project Twilight

**Last updated:** 2026-09-17 · Cursor (Composer) · Booking team picker + session-first + 8h gate off  
**Read this file first every session.** Update it before you sign off.

---

## Current live state

| Item | Value |
| --- | --- |
| **`main` version** | `1.3.091726d` (pushing) |
| **Live site** | https://dk-centific.github.io/Twilight-Tracker/ |
| **Last merged** | Session-first team/day rules, booking edit team picker, no 8h save gate, handoff fixes |
| **Local branch** | `main` |

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
| [#108](https://github.com/DK-Centific/Twilight-Tracker/pull/108) | `cursor/booking-manual-name-address-81f9` | Booking: type Participant name + Address (editable even after roster pick) | Draft · newest |
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
**Last updated:** YYYY-MM-DD · <agent name>
**Version after work:** x.x.xxxxxxx
**Completed:** …
**Blocked / waiting:** …
**PR / branch:** …
**Next agent should:** …
```
