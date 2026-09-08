# User-save flow · Create / update a directory user

Twilight **Create user** and **Save changes** send one POST to the Power Automate flow in `ADMIN_PA_MODERATOR_WRITE_URL`.

If that flow does not send a success reply, the admin app shows **The save service did not answer** (older builds said `HTTP 502 (transient)`). The form is fine. The Excel row was not saved.

The directory **read** flow still works. Only this **write** flow is broken.

## What you should see after this

- Add user → Create user → toast **User created**
- The new person appears in Moderator Hub
- That person can sign in (after they set a password the usual way)

## Click-by-click

1. Open **https://make.powerautomate.com**
2. Sign in.
3. Click **My flows** (left side).
4. Open the flow that used to be called **Orbit App Mod Info** (this is the user-save flow Twilight already points at).
5. Look at the **On / Off** switch at the top.
   - If it is **Off**, click it so it is **On**.
   - Go back to Twilight and try **Create user** again.
6. If it is already **On**, click **28 day run history**.
7. Open the newest failed run.
8. Click the red step. Write down the error text (often Excel **Add a row** or a missing **Response**).

### A. The flow must answer Twilight

9. Click **Edit**.
10. Scroll to the **end** of the flow.
11. If there is no step named **Response**, click **New step**.
12. Search for **Response** and add **Request → Response**.
13. Set **Status Code** to `200`.
14. Set **Body** to:

```json
{ "ok": true }
```

15. Click **Save**.
16. In Twilight, try **Create user** again.

### B. Excel must add one Moderators row

17. Still in **Edit**, find **Add a row into a table** (or **Update a row**).
18. Confirm it uses the same Excel file and **Moderators** table as the directory list.
19. Map at least these names from the HTTP trigger:

- `orbitLoginId`
- `firstName`
- `lastName`
- `LoginRole`
- `phoneNumber`
- `centificEmail`
- `personalEmail`
- `modAddress`
- `zipcode`
- `timeOff`
- `smartPhone`
- `carType`
- `off-date`

20. Do **not** require extra columns such as `deactivated` or `userStatus`. Twilight stores deactivate separately.
21. Click **Save**.
22. Try **Create user** again.

### C. Only if the old flow cannot be repaired

23. Create a new **Instant cloud flow**.
24. Trigger: **When an HTTP request is received**.
25. Click **Use sample payload to generate schema** and paste:

```json
{
  "operation": "create",
  "orbitLoginId": "Jamie-tw",
  "firstName": "Jamie",
  "lastName": "Lee",
  "LoginRole": "Mod",
  "phoneNumber": "",
  "centificEmail": "",
  "personalEmail": "",
  "modAddress": "",
  "zipcode": "",
  "timeOff": "",
  "smartPhone": "",
  "carType": "",
  "off-date": ""
}
```

26. Add **Excel Online (Business) → Add a row into a table**.
27. Point it at the Moderators table and map the same fields as step 19.
28. Add **Response** with status `200` and body `{ "ok": true }`.
29. Click **Save**.
30. Click the trigger. Copy the **HTTP POST URL**.
31. Paste that URL into `ADMIN_PA_MODERATOR_WRITE_URL` in `twilight.js`.
32. Save, then try **Create user** again.

## How to check it worked

1. In Twilight, open **Moderator Hub**.
2. Click **Add user**.
3. Fill Twilight Login ID, First name, Last name, and Login Role.
4. Click **Create user**.
5. You should see **User created**, and the new row in the list.
