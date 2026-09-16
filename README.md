# Project Twilight

This is the **Twilight** data-collection app.

## Open the app

**https://dk-centific.github.io/Twilight-Tracker/**

You should see a login screen titled **Project Twilight**.

If the page looks old, refresh hard: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac).

If you land on **Kilo** or an old **Orbit** page instead of Twilight, you are on a legacy bookmark or home-screen icon. Open the link above in the browser, confirm the login title says **Project Twilight**, then add that page to your home screen again (delete the old Kilo/Orbit icon first).

Login IDs such as `Admin-Twilight` stay the same. The old `Admin-orbit` name still works and opens the same account.

## Local preview (before merge)

Serve the **twilight-tracker repo root** over HTTP and open `http://localhost:8080/`. Do not open `index.html` as a file (`file://`) — some screens fetch sibling files.

⚠ If you see **Kilo** instead of **Project Twilight**, the preview server is running from the wrong folder (often your home folder because `~/index.html` is an old Kilo copy). Stop that server and use the script below.

From the repo folder:

```bash
./scripts/serve-twilight.sh
```

Or manually:

```bash
cd /path/to/twilight-tracker
python3 -m http.server 8080
```

Then open **http://localhost:8080/** — login title must say **Project Twilight**.

App scripts and images are **relative** (`twilight.js`, `icons/…`, `assets/…`). There is no GitHub Pages origin check for Admin / Moderator UI.

### Files that must be served together

Styles live **inside** `index.html` (no separate `.css`).

| File | Why |
| --- | --- |
| `index.html` | Login, Admin, and Moderator UI |
| `twilight.js` | App logic |
| `twilight-panic.js` | Help & safety |
| `email-template-preview-moderator.html` | Loaded at runtime for safety-email preview |
| `favicon.ico` | Tab icon |
| `manifest.json` | Home-screen / PWA metadata |
| `icons/*` | Tab icons, moon art, panic icons |
| `assets/master-admin-brand.gif` | Master-admin brand mark |

Optional (not required for Admin / Mod login): `orbit.html`, `404.html`, `helios/`, `docs/`, `scripts/`.

Fonts and Excel export load from the public internet (Google Fonts, jsDelivr `xlsx`). Login still works if those CDNs are blocked; export may not.

### SessionState / Power Automate from localhost

Cloud saves still call the live Power Automate URLs. SessionState Read/Write currently send `Access-Control-Allow-Origin: *`, so **localhost can talk to live PA**. If a later flow locks CORS to GitHub Pages only, the local UI still opens; cloud read/write would fail in the browser console and drafts would stay on this device.

## Files

- `index.html` — Twilight home / login
- `twilight.js` — Twilight app
- `twilight-panic.js` — Help & safety
- `orbit.html` — old Orbit address; opens Twilight
