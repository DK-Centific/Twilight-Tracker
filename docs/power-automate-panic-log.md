# Panic report log · Excel table + write flow

Use this after the panic escalate buttons are live. The write-flow URL is already pasted into `PANICLOG_PA_WRITE_URL`. The Incident Report page also needs a **read** flow so every admin can see reports from Excel.

Keep every Excel column as **Text**.

## A. Create the Excel table

1. Open the same Excel workbook Twilight already uses (the one with TeamLog / Assignment).
2. Add a new sheet named **PanicLog**.
3. In row 1, type these exact header names, one per column:

| Header | What goes in it |
|---|---|
| panicLogId | Unique id from the app |
| reportedAt | Time the person tapped Send (ISO) |
| reportedBy | Their Orbit Login ID |
| reporterName | Their display name |
| teamId | Team number, if known |
| teamName | Team name, if known |
| assignmentId | Open session id, if any |
| sessionDate | Session date |
| reportType | `contact_police` / `data_loss` / `nda_consent` / `misconduct` |
| reportLabel | Contact Police / Data Loss / NDA/Consent Question / Misconduct Report |
| reportSubtype | Environment misconduct or Teammate misconduct (misconduct only) |
| comment | What they typed |
| followUpNote | The Teams-chat reminder, when that option is used |
| emailTo | `ben_prod_twilight@centific.com` |
| emailStatus | `sent` / `failed` / `skipped` |
| emailError | Empty unless send failed |
| appVersion | App version at send time |
| localTimestamp | Device time as text |

4. Select the header row plus a few empty rows under it.
5. Click **Insert** → **Table**.
6. Check **My table has headers**.
7. Click **OK**.
8. Click inside the table. Open **Table Design**.
9. Set the table name to **PanicLog**.
10. Click **Save**.

## B. Create the write flow

1. Open **https://make.powerautomate.com**
2. Sign in.
3. Click **My flows**.
4. Click **+ New flow** → **Instant cloud flow**.
5. Name it **Twilight PanicLog Write**.
6. Choose **When an HTTP request is received**.
7. Click **Create**.
8. Open the HTTP trigger.
9. Click **Use sample payload to generate schema**.
10. Paste this and click **Done**:

```json
{
  "panicLogId": "pl_David-tw_123",
  "reportedAt": "2026-09-09T07:35:00.000Z",
  "reportedBy": "David-tw",
  "reporterName": "David",
  "teamId": "409",
  "teamName": "Team 01",
  "assignmentId": "asgn_123",
  "sessionDate": "2026-09-09",
  "reportType": "data_loss",
  "reportLabel": "Data Loss",
  "reportSubtype": "",
  "comment": "Capture file will not open",
  "followUpNote": "Also, please notify the managers in the Teams chat immediately.",
  "emailTo": "ben_prod_twilight@centific.com",
  "emailStatus": "sent",
  "emailError": "",
  "appVersion": "1.3.090826bb",
  "localTimestamp": "Wed Sep 09 2026"
}
```

11. Click **New step**.
12. Search for **Add a row into a table**.
13. Pick the Excel file and the **PanicLog** table.
14. Map each Excel column to the matching field from **When an HTTP request is received**.
15. Click **New step**.
16. Search for **Response**.
17. Set **Status Code** to `200`.
18. Set **Body** to `{ "ok": true }`.
19. Click **Save**.
20. Open the HTTP trigger again.
21. Copy the **HTTP POST URL**.
22. Send that URL back here so it can be pasted into `PANICLOG_PA_WRITE_URL`.

## C. Create the read flow (needed for the admin Incident Report page)

1. Open **https://make.powerautomate.com**
2. Click **My flows**.
3. Click **+ New flow** → **Instant cloud flow**.
4. Name it **Twilight PanicLog Read**.
5. Choose **When an HTTP request is received**.
6. Click **Create**.
7. Click **New step**.
8. Search for **List rows present in a table**.
9. Pick the same Excel file and the **PanicLog** table.
10. Click **New step**.
11. Search for **Response**.
12. Set **Status Code** to `200`.
13. Set **Body** to the **value** list from **List rows present in a table** (or `{ "value": <value> }`).
14. Click **Save**.
15. Open the HTTP trigger.
16. Copy the **HTTP POST URL**.
17. Paste the HTTP POST URL into `PANICLOG_PA_READ_URL` in `twilight.js`. This is already done.

Until that URL is pasted, the Incident Report page still shows reports sent from the same computer.

## D. High-priority email (existing send flow)

The panic button reuses the current email send flow and also sends:

- `importance`: `High`
- `priority`: `high`

To make Outlook mark it high priority:

1. Open the existing Twilight email send flow (the one used for booking emails).
2. Click **Edit**.
3. Click the HTTP trigger → **Use sample payload to generate schema**.
4. Add `importance` and `priority` to the sample (keep `to`, `subject`, `body`).
5. Open **Send an email (V2)**.
6. Open **Show advanced options**.
7. Set **Importance** to the `importance` field from the trigger (or pick **High**).
8. Click **Save**.
