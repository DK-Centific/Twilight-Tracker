# SessionState Read flow · live location for Admin Activities

Twilight **Write** to SessionState is working. Twilight **Read** is not.

A probe on 12 Sep 2026:

- **Write** `POST SESSIONSTATE_PA_WRITE_URL` → `200 {"ok":true}` in about 2 seconds
- **Read** `GET SESSIONSTATE_PA_READ_URL` → `HTTP 502` in about 0.4 seconds  
  Body: `NoResponse` · “The server did not receive a response from an upstream server.”

That is why Admin → Moderators → **Activities** still shows an old pin (for example Sept 9). The phone can save a new location. The admin map cannot load it.

Do **not** make a new HTTP URL unless you also paste it into `SESSIONSTATE_PA_READ_URL` in `twilight.js`.

## What you should see after this

- SessionState Read flow is **On**
- Opening the flow’s run history shows a **Succeeded** run when you refresh Activities
- The run’s **Response** body is a list of rows (or `{ "value": [ ...rows ] }`)
- David’s pin on Activities shows **today’s** time, not Sept 9

## Click-by-click

1. Open **https://make.powerautomate.com**
2. Sign in.
3. Click **My flows** (left side).
4. Open the **SessionState Read** flow (the one Twilight already points at).
5. Look at the **On / Off** switch at the top.
   - If it is **Off**, click it so it is **On**.
   - Go back to Twilight → Admin → Moderators → **Activities** and tap **Refresh**.
6. If it is already **On**, click **28 day run history**.
7. Open the newest failed run.
8. Click the red step. Write down the error.

Typical errors after the Excel → List cutover:

- Excel file is **locked** or moved
- The flow still points at the **old Excel** table
- **List rows** / **Get items** times out
- There is **no Response** step at the end (this often shows up as HTTP 502 `NoResponse`)

### A. The flow must answer Twilight

9. Click **Edit**.
10. Scroll to the **end** of the flow.
11. If there is no step named **Response**, click **New step**.
12. Search for **Response** and add **Request → Response**.
13. Set **Status Code** to `200`.
14. Set **Body** to the rows from the list step. Either of these shapes is fine:

```json
@{body('List_rows_present_in_a_table')?['value']}
```

or

```json
{ "value": @{body('List_rows_present_in_a_table')?['value']} }
```

If the list step is SharePoint **Get items**, use that step’s `value` instead.

15. Click **Save**.
16. Confirm the flow is **On**.
17. In Twilight, open Admin → Moderators → **Activities** and tap **Refresh**.

### B. Point the list step at the same table Write uses

18. Still in **Edit**, open the **List rows** (Excel) or **Get items** (SharePoint List) step.
19. Confirm it uses the **same** file / list that **SessionState Write** updates.
20. If Write was moved to a SharePoint List and Read still points at the old Excel workbook, Read will keep failing and Activities will stay on the old pin.
21. Click **Save**.

### C. Columns Twilight reads

Each row should include at least:

| Field | Used for |
| --- | --- |
| `sessionStateId` | Which row to update |
| `assignmentId` | Assignment or `geo_presence_{orbitId}_{day}` |
| `teamId` | Team filter |
| `orbitLoginId` | Who the pin belongs to (`David-tw`) |
| `stateJson` | JSON. Must keep `lastGeo` |
| `lastActive` | When the row was written |
| `appVersion` | Build stamp |

`stateJson` must be **multiple lines of text** (not a 255-character single line). If it is only 255 characters, `lastGeo` is cut off and the map stays on the last pin that fit.

Twilight also sends these extra names on Write (safe to ignore if the table does not have them yet):

- `lastGeoLat`
- `lastGeoLng`
- `lastGeoAt`
- `lastGeoName`
- `lastGeoRole`

If you add those columns to the list and map them on Write **and** Read, the pin still works even when `stateJson` is truncated.

### D. `lastGeo` inside `stateJson`

```json
{
  "lastGeo": {
    "lat": 47.6446,
    "lng": -122.137,
    "at": 1757690000000,
    "name": "David",
    "role": "moderator",
    "syncReason": "app_open"
  }
}
```

`at` is milliseconds since 1970, or an ISO date string.

### E. Do not change the HTTP URL

If you recreate the trigger, Power Automate gives a new URL. Then Twilight will stop reading until that URL is pasted into `SESSIONSTATE_PA_READ_URL` in `twilight.js`.

## Check that it worked

1. On the phone, sign in as **David**.
2. Open the **moderator** app (not Admin).
3. Allow location if the phone asks.
4. You should see a short message **Location saved**.
5. On the computer, open Admin → Moderators → **Activities**.
6. Pick **David**.
7. The pin time should be **today**, not Sept 9.
8. If the orange line still says **Live location service did not answer**, the Read flow is still failing. Go back to step 6 and open the newest run.
