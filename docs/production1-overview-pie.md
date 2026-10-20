# Overview chart · Production status

The ring on **Admin → Overview** counts sessions from the Google Sheet **Mirror of Parakeet Nighttime Tracker**, tab **Production1**.

It does **not** use Twilight bookings. **Performance** is unchanged.

## What you should see

- The chart title says **Production status**.
- The number in the middle is how many sessions were counted.
- Each slice is a **Status** from the sheet (Completed, Confirmed, Not complete, Cancelled, and any other status that shows up).
- **Not complete** and **Not Complete** are one slice.
- A row counts as **one** session when column D (Session Kit) is a real kit and column K (Status) is filled in. The kit number itself is not added up. **Select** and a blank Status are left out.
- The chart tries again about once a minute while Overview is open.

## Why the numbers looked frozen (2026-10-14)

The counts-only file below is a copy made by hand on Oct 6. Nothing updates it, so the ring kept showing those numbers even though the app re-reads it every minute. The ring now shows when the counts were taken. Until the live link below is set, the line under the title says **not live, last counted Oct 6 …**.

## Live link (set 2026-10-20, 1.3.102026a)

The ring now reads live counts from the Apps Script web app **Twilight Production1 status counts**, owned by **david.kang@centific.com**:

`https://script.google.com/macros/s/AKfycbyZTV6g3DJ_5cIAOYxCy5705fBnuFCOnd3uoLZa-YBiPTS4LAJ0k5t9knNMgjPUpBk/exec`

It is stored as `PRODUCTION1_STATUS_LIVE_URL` in `twilight.js`. The line under the title says **updated <time>** while it answers. If the script is ever redeployed as a *new* deployment, the address changes and must be pasted again; **Manage deployments → Edit → New version** keeps the same address.

## Make it live (Google Apps Script, about 5 minutes)

1. Open **https://script.google.com**, signed in with a Google account that can open the Production1 sheet.
2. Click **New project**. Delete what is in the editor.
3. Paste everything from `docs/production1-status-apps-script.gs` in this repo. Click **Save**.
4. Click **Deploy → New deployment**. Click the gear next to **Select type** and pick **Web app**.
5. Set **Execute as** to **Me** and **Who has access** to **Anyone**. Click **Deploy**.
6. Google asks you to allow access to your spreadsheets. Click **Authorize access**, pick your account, then **Allow** (if it says the app isn't verified, click **Advanced → Go to project**).
7. Copy the **Web app URL** (it ends in `/exec`) and send it to an agent. It goes in `PRODUCTION1_STATUS_LIVE_URL` in `twilight.js`.

The script answers counts only (no names, addresses or phone numbers) and reads the sheet fresh on each call, with a 30-second cache. Opening the `/exec` address in a browser should show something like `{"updatedAt":"…","slices":[{"status":"Completed","count":45}, …]}`.

The ring tries the live link first, then the file below, then the private sheet link.

The ring reads this counts-only file as a fallback:

`https://dk-centific.github.io/twilight-production1-status/production1-status.json`

That file has status counts only. It does not include names or addresses. The app does not store a Google password. If that address cannot be read, the line under the title says **The production sheet is not connected yet.**

## How to connect it

Pick one. The first one keeps names and addresses off the website.

### A. Counts-only link (preferred)

Someone who can edit Power Automate builds a flow that:

1. Reads **Production1** on that sheet.
2. Counts rows with the rules above.
3. Answers with **only** the counts. No names, no addresses, no phone numbers.

Either of these answers is fine:

```json
{ "rows": [ { "sessionKit": "1", "status": "Completed" } ] }
```

```json
{ "slices": [ { "status": "Completed", "count": 40 } ] }
```

That address is already stored as `PRODUCTION1_STATUS_PROXY_URL` in `twilight.js`. If the file moves, replace that line with the new address. Do not paste a Google password or a key file into the repo.

The flow must allow the Twilight website to call it (the same kind of open reply the other Twilight flows already use).

### B. Public sheet link

The app also tries this address:

`https://docs.google.com/spreadsheets/d/1zJWzg3b9qOC-weB0VZ_4MuNdd1GI557JUlsh-t5cogc/gviz/tq?tqx=out:csv&gid=0`

Today that address answers **not allowed**, because the sheet is not public. Publishing the whole sheet would show names and addresses to anyone with the link. Do **not** publish it for this chart. Use the counts-only link instead.

## What did not change

- **Performance**, including Incomplete
- The bookings line chart
- The Moderators, Live teams, and Bookings numbers on the left
