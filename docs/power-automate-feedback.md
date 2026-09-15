# Feedback · Team announcement + moderator inbox

Twilight Admin can publish a **team announcement** and send **1:1 notes** to one moderator. Moderators read them in the Moderator app Inbox.

This first slice uses the **existing SessionState Write / Read** flows. No new `sig=` URL is invented here.

Optional dedicated Feedback List URLs (`FEEDBACK_PA_WRITE_URL` / `FEEDBACK_PA_READ_URL` in `twilight.js`) stay **empty** until Watchdog / PA wires a SharePoint List. If you paste a real URL later, Twilight will also POST the same payload there.

## Why SessionState

Twilight already upserts `appSetting` rows for tracking, deactivated users, and master-admin grants. Moderators already poll SessionState. That is enough for Admin laptop → phone moderator delivery after refresh.

Do **not** rely on localStorage alone for Admin→Mod delivery.

## Rows Twilight writes

| What | `sessionStateId` | `assignmentId` | `stateJson` |
| --- | --- | --- | --- |
| Last team announcement | `ss_app_setting_team_feedback` | `app_setting_team_feedback` | `{ type: "appSetting", key: "teamFeedback", announcement }` |
| Live calibration guide | `ss_app_setting_cal_guide` | `app_setting_cal_guide` | `{ type: "appSetting", key: "calGuide", guide }` |
| One 1:1 message | `ss_fb_{feedbackId}` | `app_setting_feedback` | `{ type: "appSetting", key: "modFeedback", feedbackId, toLoginId, toName, fromName, message, messageHtml, sentAt }` |
| That moderator's read ids | `ss_app_setting_inbox_read_{orbitKey}` | `app_setting_inbox_read` | `{ type: "appSetting", key: "inboxRead", orbitLoginId, ids: ["TF-…", "FB-…"] }` |

`orbitKey` is the login with spaces removed and letters lowercased (`Alex-tw` → `alextw`).

Session **calibration-guide acknowledgment** stays on the assignment SessionState row (`calGuideAck`). Team feedback and calibration-guide **content** never write that key.

Admin **Team feedback** (Performance → Team feedback) publishes the inbox announcement. Admin **Calibration guide** (Performance → Calibration guide) publishes the warning banner, Motion Detection block, length reminder, and DOs & DON'Ts into `ss_app_setting_cal_guide`. Those are two different rows.

## Exact write envelope

Same shape as other SessionState upserts:

```json
{
  "sessionStateId": "ss_app_setting_team_feedback",
  "assignmentId": "app_setting_team_feedback",
  "teamId": "",
  "orbitLoginId": "_app_setting",
  "assignmentAddress": "",
  "milesFromHq": "",
  "stateJson": "{\"type\":\"appSetting\",\"key\":\"teamFeedback\",\"announcement\":{}}",
  "lastActive": "2026-09-15T17:25:00.000Z",
  "appVersion": "1.3.091526b",
  "overwrite": true,
  "writeMode": "upsert"
}
```

`stateJson` must be **multiple lines of text**, not a 255-character single line.

## What PA / Watchdog should confirm

1. SessionState Write still **upserts** by `sessionStateId` (see `docs/power-automate-sessionstate-overwrite.md`).
2. SessionState Read returns these `appSetting` rows to both Admin and Moderator apps.
3. If you later want a Feedback Excel / SharePoint List (Kilo-style), create Write + Read flows, paste the URLs into the empty `FEEDBACK_PA_*` constants, and map the payload fields above. Do not recreate the SessionState trigger URL unless you also paste the new URL into `SESSIONSTATE_PA_WRITE_URL`.

## Team announcement object

```json
{
  "id": "TF-1770000000000-abc123",
  "title": "Tonight",
  "bodyHtml": "<p>Drive slowly</p>",
  "bodyText": "Drive slowly",
  "icon": "warn",
  "accent": "coral",
  "publishedAt": "2026-09-15T17:25:00.000Z",
  "publishedBy": "Admin-Twilight",
  "draft": false
}
```

Drafts stay in the Admin browser (`centific_twilight_team_fb_draft_v1`) until Confirm and send.

Admin Team feedback has two tabs:

- **New** — blank / local draft composer (same as the first slice).
- **Edit current** — loads title, body, color, and icon from the live `ss_app_setting_team_feedback` row. Confirm send **upserts that same `sessionStateId`** (overwrite). It does not create a second current team note.

A re-send mints a new announcement `id` and `publishedAt` so moderators who already opened the previous version see the update as unread. The SessionState row id stays `ss_app_setting_team_feedback`.
