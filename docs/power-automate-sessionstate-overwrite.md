# SessionState write flow · overwrite one row per assignment

The Twilight app now sends the **same** `sessionStateId` every time a team updates the same assignment (`ss_{assignmentId}`). The Power Automate write flow must **update that row** instead of adding a new row each time.

Use the existing **SessionState Write** flow (HTTP trigger). Do not create a new HTTP URL unless you also paste the new URL into `SESSIONSTATE_PA_WRITE_URL` in `twilight.js`.

## What you should see after this

- First activity for an assignment → one new Excel row
- Later activity on that same assignment → **same row** updates (`stateJson`, `lastActive`)
- A new assignment at a new address → a **new** row

## Click-by-click

1. Open **https://make.powerautomate.com**
2. Sign in.
3. Click **My flows** (left side).
4. Open the **SessionState Write** flow (the one whose HTTP URL is already in Twilight).
5. Click **Edit**.

### A. Keep the trigger

6. Leave **When an HTTP request is received** as the first step.
7. Click that trigger. Confirm the body includes at least:
   - `sessionStateId`
   - `assignmentId`
   - `teamId`
   - `orbitLoginId`
   - `stateJson`
   - `lastActive`
   - `appVersion`
8. If those names are missing, click **Use sample payload to generate schema** and paste:

```json
{
  "sessionStateId": "ss_asgn_123",
  "assignmentId": "asgn_123",
  "teamId": "1",
  "orbitLoginId": "Mod-orbit",
  "assignmentAddress": "123 Main St, Redmond, WA",
  "milesFromHq": 8.2,
  "stateJson": "{}",
  "lastActive": "2026-09-08T12:00:00.000Z",
  "appVersion": "1.3.090826f",
  "overwrite": true
}
```

9. Click **Done**.

### B. Look up the existing row

10. Click **+ New step** under the trigger.
11. Search for **List rows present in a table**.
12. Click **List rows present in a table** (Excel Online).
13. Pick the same **Location / Document Library / File / Table** the old Add-a-row step already uses (the SessionState table).
14. Click **Show advanced options**.
15. In **Filter Query**, type exactly:

```
sessionStateId eq '@{triggerBody()?['sessionStateId']}'
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
28. **Key Column:** `sessionStateId`
29. **Key Value:** click in the box, then pick **sessionStateId** from the HTTP trigger (Dynamic content).
30. Fill these columns from the HTTP trigger (Dynamic content):
    - `assignmentId`
    - `teamId`
    - `orbitLoginId`
    - `stateJson`
    - `lastActive`
    - `appVersion`
    - `assignmentAddress` (if that Excel column exists)
    - `milesFromHq` (if that Excel column exists)
31. Do **not** change `sessionStateId` on the row. That is the key.

### E. If no (first time) · add a row

32. In the pink **If no** box, click **Add an action**.
33. If the flow already has **Add a row into a table**, **drag that existing step** into **If no**.
34. If it does not, add **Add a row into a table** and map the same columns as step 30, plus `sessionStateId` from the trigger.
35. Make sure there is **no other Add a row** sitting outside the Condition. Only one write should run.

### F. Save

36. Click **Save** (top right).
37. Wait until it says the flow is saved.
38. Click **Back**. Confirm the flow is **On**.

## Check that it worked

1. Open the SessionState Excel table.
2. Note how many rows exist.
3. In Twilight, do two actions on the **same** assignment (for example tap a station, then tap again).
4. Refresh Excel.
5. You should still have the **same number of rows** for that assignment. Only `lastActive` and `stateJson` should change.
6. If a new row appeared, the Add-a-row step is still running on every request. Go back to step 35.

## If List rows says the column is invalid

The Excel table header must be exactly `sessionStateId` (no spaces). If the column has a different name, use that exact header in the Filter Query and Key Column.

## Do not change the HTTP URL

If you recreate the trigger, Power Automate gives a new URL. Then Twilight will stop writing until that URL is pasted into `SESSIONSTATE_PA_WRITE_URL` in `twilight.js`.
