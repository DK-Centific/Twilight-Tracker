# User-save flow · Create / update a directory user

Twilight **Create user** and **Save changes** send one POST to the Power Automate flow in `ADMIN_PA_MODERATOR_WRITE_URL`.

If that flow does not send a success reply, the admin app shows **The save service did not answer** (older builds said `HTTP 502 (transient)`). The form is fine. The Excel row was not saved.

The directory **read** flow still works. Only this **write** flow is broken.

## What you should see after this

- Add user → Create user → toast **User created**
- The new person appears in Moderator Hub
- That person can sign in (after they set a password the usual way)

## Condition must use Create, not Update

Twilight **Add user** sends `userAction: "create"`.

In the Condition, do **not** pick the word **operation** from the list. That word is the Excel **Update a row** action, so every new user goes down the Update side and Twilight shows HTTP 502.

**Use this Condition instead:**

1. Click the **Condition**.
2. Click the left box. Delete what is there.
3. Click **Dynamic content**.
4. Under **When an HTTP request is received**, pick **userAction**.
5. Middle box: **is equal to**.
6. Right box: type `create` (all lowercase).
7. Click the HTTP trigger. Choose **Use sample payload to generate schema**. Paste the sample in section C below so `userAction` is on the trigger.
8. Click **Save**.

True = **Add a row**. False = **Update a row**. Response stays under the Condition.

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
  "userAction": "create",
  "writeMode": "create",
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
