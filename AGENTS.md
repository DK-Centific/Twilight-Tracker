# Project Twilight — agent instructions

**Grok Build, Cursor agents, and other assistants:** read this file at session start, then read `docs/HANDOFF.md` for the latest work state.

---

## Start every session

1. **Read `docs/HANDOFF.md`** — current version, in-flight work, open PRs, and next steps.
2. **Work from `main`** unless HANDOFF says otherwise. Pull latest before editing.
3. **Follow the working rules below** (same as `.cursor/rules/project-instructions.mdc` for Cursor).
4. **At session end, update `docs/HANDOFF.md`** — date, what you finished, what's left, branch/PR links, version if bumped.

---

## Project overview

**Project Twilight** is a single-page web app for Centific field data collection. It has three surfaces in one HTML shell:

| Surface | Who | Purpose |
| --- | --- | --- |
| **Admin** | Admins / Master Admin | Calendar, Booking, Assignment, Teams, Moderators, Performance, Approval, Checklist |
| **Moderator** | Field moderators | Session flow, stations, Lakitu, arrival, panic/help |
| **Reviewer** | QA reviewers | Approval queue, Lakitu/Ring side panel |

**Live site:** https://dk-centific.github.io/Twilight-Tracker/

**Repo:** https://github.com/DK-Centific/Twilight-Tracker

**Owner:** David (Product Manager). Treat him as non-technical — give click-by-click steps when he needs to act.

---

## Architecture (no build step)

Vanilla JS + HTML. No npm, bundler, or compile step for the app itself.

| File | Role |
| --- | --- |
| `index.html` | All UI markup and CSS (~10k lines) |
| `twilight.js` | All app logic (~45k lines) — Admin, Moderator, Reviewer, Excel/PA I/O |
| `twilight-panic.js` | Help & safety / panic button |
| `scripts/*-selftest.js` | Node self-tests (run with `node scripts/…`) |
| `docs/` | Power Automate setup guides, handoff |

**Version:** `APP_VERSION` and `APP_UPDATED_AT` at top of `twilight.js`. Bump both on every ship. Cache-bust query string in `index.html` must match (`twilight.js?v=twilight-<version>`).

**Backend:** Microsoft Power Automate HTTP triggers → Excel tables (Assignment, Worklog, SessionState, TeamLog, Approval, PanicLog, etc.). URLs are constants near the bottom of `twilight.js`. PA flow changes are documented in `docs/power-automate-*.md`.

**Design system:** Helios-inspired. Dark mode is primary; light “Soft Sage” theme exists. Brand cyan for logo / My Session only. Helios gold for CTAs and mailto links.

---

## Local preview

```bash
python3 -m http.server 8080
```

Open **http://localhost:8080/** — never `file://`. See `README.md` for files that must be served together.

Cloud saves hit live Power Automate URLs; localhost works while PA sends `Access-Control-Allow-Origin: *`.

---

## Working rules

### Clarify when genuinely ambiguous
If two interpretations would mean redoing the work, ask David with 2–4 short labeled options. Otherwise pick a sensible default and note the assumption.

### Preview before significant work
For new UI, multi-file features, or layout changes: show a mockup or numbered walkthrough and wait for confirmation. Skip for typos, version bumps, or when David says “go ahead” / “ship it”.

### Structured update when done
Use this format in replies:

**Build summary** — version or label  
**File / scope:** area · one-line metadata  
**What changed** — 2–4 sentences, one paragraph  
**Test steps** — numbered, bold action → expected result  
**What's NOT changed** — short list  
**Warnings** — only if relevant (⚠ **term**)

### Push / deploy policy

- **Major changes:** do **not** merge or push until David types **"push"**.
- **Small changes:** may commit and push to `main` (GitHub Pages auto-deploys).
- **Draft PRs:** many Cursor cloud-agent PRs stay draft until David reviews. Do not merge without explicit OK.
- **Never force-push `main`.**

### Code style

- Minimize scope — smallest correct diff.
- Match existing patterns in `twilight.js` / `index.html`.
- No new dependencies unless unavoidable.
- Self-tests in `scripts/` for non-trivial logic; run relevant ones before finishing.

---

## Testing

```bash
node scripts/scenario-catalog-selftest.js
node scripts/booking-end-duration-selftest.js
node scripts/e2e-approval-arrival-selftest.js
# … see scripts/ for the full list
```

Run tests tied to the area you changed. All should pass before handoff.

---

## Agent tooling (optional)

| Tool | Use |
| --- | --- |
| **CodeGraph** | `codegraph_explore` before large reads/edits |
| **Ponytail** | `/ponytail` — avoid over-engineering |
| **Caveman** | `/caveman` — shorter replies when David prefers |

---

## Session end checklist

Update `docs/HANDOFF.md` with:

- [ ] Date and agent name (e.g. Grok, Cursor)
- [ ] `APP_VERSION` on `main` after your work
- [ ] What you completed
- [ ] What's blocked or waiting on David
- [ ] Branch / PR links
- [ ] Recommended next step for the next agent

If you created a PR, note whether David has reviewed it and whether merge is allowed.
