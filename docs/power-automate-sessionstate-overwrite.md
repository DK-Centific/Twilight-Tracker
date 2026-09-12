# SessionState Write · upsert by sessionStateId (required)

**Audit (2026-09-10, still the live contract unless you already changed it):** SessionState Write is **Add a row**. It does **not** update the existing row. Every save adds another row. The Sept 9 `lastGeo` row stays. Admin Activities can keep showing that old pin even when today’s write succeeds.

Twilight always sends:

- the **same** `sessionStateId` for the same person + assignment (or same-day presence row)
- `overwrite: true`
- `writeMode: "upsert"`

The flow must **look up that `sessionStateId` and update the row**. Add a row only when no row exists.

Do not create a new HTTP URL unless you also paste it into `SESSIONSTATE_PA_WRITE_URL` in `twilight.js`.

## What you should see after this

- First save for David on an assignment → one new row
- Later location / station saves for that same assignment → **same row** updates (`stateJson`, `lastActive`, `lastGeo`)
- After wrap-up, same-day location may use one presence row: `geo_presence_David-tw_2026-09-12` → `sessionStateId` like `ss_geo_presence_David-tw_2026-09-12_davidtw`
- A new assignment at a new address → a **new** row
- Excel / List row count for that assignment does **not** grow on every heartbeat

## Exact payload Twilight sends

```json
{
  "sessionStateId": "ss_asgn_123_davidtw",
  "assignmentId": "asgn_123",
  "teamId": "1",
  "orbitLoginId": "David-tw",
  "assignmentAddress": "123 Main St, Redmond, WA",
  "milesFromHq": 8.2,
  "lastGeoLat": 47.6446,
  "lastGeoLng": -122.137,
  "lastGeoAt": 1757690000000,
  "lastGeoName": "David",
  "lastGeoRole": "moderator",
  "stateJson": "{\"lastGeo\":{\"lat\":47.6446,\"lng\":-122.137,\"at\":1757690000000,\"name\":\"David\",\"role\":\"moderator\",\"syncReason\":\"tracking_enabled\"}}",
  "lastActive": "2026-09-12T07:40:00.000Z",
  "appVersion": "1.3.091226g",
  "overwrite": true,
  "writeMode": "upsert"
}
```

**Key:** `sessionStateId` is stable. Pattern: `ss_{assignmentId}_{orbitLoginId with only letters and numbers}`.

Examples:

| What | assignmentId | sessionStateId |
| --- | --- | --- |
| Open assignment | `asgn_123` | `ss_asgn_123_davidtw` |
| Same-day location after wrap-up | `geo_presence_David-tw_2026-09-12` | `ss_geo_presence_David-tw_2026-09-12_davidtw` |
| Tracking setting | `app_setting_mod_tracking` | `ss_app_setting_mod_tracking` |

`lastGeo` lives inside `stateJson`. Extra `lastGeoLat` / `lastGeoLng` / `lastGeoAt` fields are optional columns. Ignore them if the table does not have them yet. Do **not** fail the write if they are unmapped.

`stateJson` must be **multiple lines of text**, not a 255-character single line.

## Click-by-click · change Add a row into upsert

1. Open **https://make.powerautomate.com**
2. Sign in.
3. Click **My flows**.
4. Open **SessionState Write** (the flow Twilight already points at).
5. Click **Edit**.

### A. Keep the same HTTP trigger

6. Leave **When an HTTP request is received** as the first step.
7. Click that trigger. Click **Use sample payload to generate schema**. Paste the JSON in “Exact payload Twilight sends” above.
8. Click **Done**.

### B. Find the existing row

9. Under the trigger, add **List rows present in a table** (Excel) or **Get items** (SharePoint List).
10. Point it at the **same** SessionState table the app should use. If this still points at a **locked Excel** file, change it to the live list / workbook. Locked Excel is why writes have returned **429**.
11. Open **Show advanced options**.
12. **Filter Query** (Excel) — type exactly:

```
sessionStateId eq '@{triggerBody()?['sessionStateId']}'
```

13. **Top Count:** `1`.

### C. Update if found, add if missing

14. Add a **Condition**.
15. Left box, **Expression**:

```
length(outputs('List_rows_present_in_a_table')?['body/value'])
```

(Use the Get items output name if this is a SharePoint list.)

16. Middle: **is greater than**. Right: `0`.

17. **If yes** → **Update a row** (or Update item).
    - **Key Column:** `sessionStateId`
    - **Key Value:** `sessionStateId` from the HTTP trigger
    - Map `assignmentId`, `teamId`, `orbitLoginId`, `stateJson`, `lastActive`, `appVersion`
    - Map `assignmentAddress` / `milesFromHq` / `lastGeoLat` / `lastGeoLng` / `lastGeoAt` only if those columns exist
    - Do **not** change `sessionStateId` on the row

18. **If no** → **Add a row** (or Create item) with the same fields **plus** `sessionStateId`.

19. **There must be no Add a row outside the Condition.** If Add a row still sits under the trigger, every save creates a new row and the Sept 9 pin stays. Drag that step into **If no**.

### D. Answer Twilight

20. After the Condition, add **Response**.
21. Status `200`. Body:

```json
{ "ok": true }
```

22. Click **Save**. Confirm the flow is **On**.

## Check that it worked

1. Open the SessionState table. Count the rows for David’s current assignment.
2. On the phone, open the **moderator** app with tracking on. Wait about 30 seconds.
3. Refresh the table.
4. The row count for that `sessionStateId` should be **the same**. Only `lastActive` and `stateJson` / `lastGeo` should change.
5. If a new row appeared, Add a row is still running on every request. Go back to step 19.

## Locked Excel / 429

If the run history shows **429** or file locked:

1. Confirm Write is **not** still pointed at the old Excel workbook.
2. Point List / Update / Add at the live SharePoint list (or an unlocked workbook).
3. Save. Try one save from the moderator app.
4. Twilight will show **Location was not saved** if Write fails. That message is real.

## Do not change the HTTP URL

If you recreate the trigger, Power Automate gives a new URL. Paste it into `SESSIONSTATE_PA_WRITE_URL` in `twilight.js` or Twilight will stop writing.

SessionState **Read** must also return those rows. See `docs/power-automate-sessionstate-read.md`.
