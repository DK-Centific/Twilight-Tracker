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

The ring reads this counts-only address first:

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
