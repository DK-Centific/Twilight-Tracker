# Worklog write flow · one row per session

Twilight now sends the **same** `worklogId` every time a team finishes another station on the same session (`wl_{assignmentId}`). The Power Automate write flow must **update that row** instead of adding a new row each time.

A **new session** for the same team (Start new session on the team card) uses a new assignment id, so it becomes a **new Excel line**.

Use the existing **Worklog Write** flow. Do not create a new HTTP URL unless you also paste the new URL into `WORKLOG_PA_WRITE_URL` in `twilight.js`.

## What you should see after this

- First station complete for a session → one new Excel row
- Later stations on that same session → **same row** updates (`status`, `timestamp`)
- Finish flow complete → same row says completed
- Admin starts a new session for the same team → a **new** row

## Click-by-click

1. Open **https://make.powerautomate.com**
2. Sign in.
3. Click **My flows** (left side).
4. Open the **Worklog Write** flow (the one whose HTTP URL is already in Twilight).
5. Click **Edit**.

### A. Keep the trigger

6. Leave **When an HTTP request is received** as the first step.
7. Click that trigger. Confirm the body includes at least:
   - `worklogId`
   - `assignmentId`
   - `teamId`
   - `status`
   - `timestamp`
   - `overwrite`
8. If those names are missing, click **Use sample payload to generate schema** and paste:

```json
{
  "worklogId": "wl_asgn_123",
  "sessionId": "sess_2026-09-08_mod_abc",
  "assignmentId": "asgn_123",
  "orbitLoginId": "Mod-orbit",
  "moderatorName": "Alex Mod",
  "teamId": "1",
  "team": "Team 01",
  "participantFirstName": "",
  "participantLastName": "",
  "participantId": "",
  "address": "123 Main St, Redmond, WA",
  "status": "station_2_done",
  "statusLabel": "In session",
  "timestamp": "2026-09-08T19:00:00.000Z",
  "localTimestamp": "9/8/2026, 12:00:00 PM",
  "notes": "",
  "appVersion": "1.3.090826z",
  "overwrite": true
}
```

9. Click **Done**.

### B. Look up the existing row

10. Click **+ New step** under the trigger.
11. Search for **List rows present in a table**.
12. Click **List rows present in a table** (Excel Online).
13. Pick the same **Location / Document Library / File / Table** the old Add-a-row step already uses (the Worklog table).
14. Click **Show advanced options**.
15. In **Filter Query**, type exactly:

```
worklogId eq '@{triggerBody()?['worklogId']}'
```

16. In **Top Count**, type `1`.

### C. Split: update if found, add if not

17. Click **+ New step**.
18. Search for **Condition**. Click **Condition**.
19. Click **Choose a value** on the left.
20. Click **Expression**.
21. Paste:

```
length(outputs('List_rows_present_in_a_table')?['body/value'])
```

22. Click **OK**.
23. Leave the middle dropdown as **is greater than**.
24. On the right, type `0`.

### D. If yes (row already exists) · update it

25. In the green **If yes** box, click **Add an action**.
26. Search for **Update a row**. Click **Update a row** (Excel Online).
27. Use the same Location / File / Table as before.
28. **Key Column:** `worklogId`
29. **Key Value:** click in the box, then pick **worklogId** from the HTTP trigger (Dynamic content).
30. Fill these columns from the HTTP trigger (Dynamic content):
    - `sessionId`
    - `assignmentId`
    - `orbitLoginId`
    - `moderatorName`
    - `teamId`
    - `team`
    - `status`
    - `statusLabel`
    - `timestamp`
    - `localTimestamp`
    - `address`
    - `participantId`
    - `notes`
    - `appVersion`
31. Do **not** change `worklogId` on the row. That is the key.

### E. If no (first time) · add a row

32. In the pink **If no** box, click **Add an action**.
33. If the flow already has **Add a row into a table**, **drag that existing step** into **If no**.
34. If it does not, add **Add a row into a table** and map the same columns as step 30, plus `worklogId` from the trigger.
35. Make sure there is **no other Add a row** sitting outside the Condition. Only one write should run.

### F. Save

36. Click **Save** (top right).
37. Wait until it says the flow is saved.
38. Click **Back**. Confirm the flow is **On**.

## Check that it worked

1. Open the Worklog Excel table.
2. Note how many rows exist.
3. In Twilight, complete two stations on the **same** session.
4. Refresh Excel.
5. You should still have the **same number of rows** for that session. Only `status` and `timestamp` should change.
6. If a new row appeared, the Add-a-row step is still running on every request. Go back to step 35.

## How sessions start

1. Open Twilight as admin.
2. Click **Moderator Hub**.
3. Click **By Team**.
4. Create a team (Lakitu, Ring, address). A session line is created for that team.
5. After the team finishes, the card says **Session complete**.
6. Click **Start new session**. That is a new Excel line for the same team.

## Do not change the HTTP URL

If you recreate the trigger, Power Automate gives a new URL. Then Twilight will stop writing until that URL is pasted into `WORKLOG_PA_WRITE_URL` in `twilight.js`.
