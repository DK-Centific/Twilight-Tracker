#!/usr/bin/env node
/* Self-test: Admin→Mod feedback inbox (unread counts, pill, toast, publish).
 * Extracts the FEEDBACK_INBOX block from twilight.js so the live helpers
 * stay the source of truth.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const srcPath = path.join(__dirname, '..', 'twilight.js');
const src = fs.readFileSync(srcPath, 'utf8');
const begin = src.indexOf('/* FEEDBACK_INBOX_BEGIN */');
const end = src.indexOf('/* FEEDBACK_INBOX_END */');
if (begin < 0 || end < 0 || end <= begin) {
  console.error('Could not find FEEDBACK_INBOX markers in twilight.js');
  process.exit(1);
}

const context = { console };
vm.createContext(context);
vm.runInContext(src.slice(begin, end + '/* FEEDBACK_INBOX_END */'.length), context);

const {
  FEEDBACK_TOAST_INTERVAL_MS,
  feedbackOrbitKey,
  feedbackAliasesForUser,
  parseFeedbackStateJson,
  collectFeedbackFromSessionRows,
  emptyFeedbackStore,
  applyPublishedTeamAnnouncement,
  applySentDirectMessage,
  applyReadReceipt,
  buildInboxItems,
  countUnreadInbox,
  inboxPillView,
  shouldShowInboxToast,
  resetInboxToastAt,
  sanitizeFeedbackHtml,
  stripFeedbackHtml,
  buildTeamAnnouncementRecord,
  buildIndividualFeedbackRecord,
  buildFeedbackAppSettingPayload,
  feedbackMatchesRecipient,
} = context;

let failed = 0;
function assert(name, cond) {
  if (cond) console.log('  ok  ' + name);
  else {
    failed += 1;
    console.log('  FAIL  ' + name);
  }
}

console.log('Feedback inbox self-test');

assert('toast interval is 30 minutes', FEEDBACK_TOAST_INTERVAL_MS === 30 * 60 * 1000);
assert('orbit key folds case and spaces', feedbackOrbitKey('David-tw') === feedbackOrbitKey(' david-tw '));
assert('aliases include login + first-name guess',
  feedbackAliasesForUser({ loginId: 'Alex-tw', name: 'Alex Chen' }).includes('alex-tw')
  && feedbackAliasesForUser({ loginId: 'Alex-tw', name: 'Alex Chen' }).includes('alex chen'));

assert('sanitize strips scripts', !/script/i.test(sanitizeFeedbackHtml('<p>Hi</p><script>alert(1)</script>')));
assert('sanitize keeps color span', /style="color:#6B8F71"/.test(sanitizeFeedbackHtml('<span style="color:#6B8F71">ok</span>')));
assert('strip html to text', stripFeedbackHtml('<p>Hello <strong>team</strong></p>') === 'Hello team');

const announcement = buildTeamAnnouncementRecord({
  title: 'Tonight',
  bodyHtml: '<p>Drive <span style="color:#C47A6A">slowly</span></p>',
  icon: 'warn',
  accent: 'coral',
}, 'Admin-Twilight');
assert('team record has id + publishedAt', !!(announcement.id && announcement.publishedAt && announcement.bodyText));
assert('team record is not a draft after publish', announcement.draft === false);

const direct = buildIndividualFeedbackRecord({
  message: 'Please upload CAL_EXT tonight.',
  toLoginId: 'Alex-tw',
  toName: 'Alex Chen',
}, { loginId: 'Admin-Twilight', name: 'Admin-Twilight' });
assert('direct record targets Alex-tw', direct.toLoginId === 'alex-tw' || direct.toLoginId === 'Alex-tw');
assert('direct record matches Alex aliases',
  feedbackMatchesRecipient(direct, feedbackAliasesForUser({ loginId: 'Alex-tw', name: 'Alex Chen' })));
assert('direct record does not match Pat',
  !feedbackMatchesRecipient(direct, feedbackAliasesForUser({ loginId: 'Pat-tw', name: 'Pat Lee' })));

const teamPayload = buildFeedbackAppSettingPayload(
  'ss_app_setting_team_feedback',
  'app_setting_team_feedback',
  { type: 'appSetting', key: 'teamFeedback', announcement }
);
assert('team write uses upsert', teamPayload.writeMode === 'upsert' && teamPayload.overwrite === true);
assert('team write keeps a stable sessionStateId', teamPayload.sessionStateId === 'ss_app_setting_team_feedback');
assert('team write stateJson is parseable appSetting',
  parseFeedbackStateJson(teamPayload.stateJson).key === 'teamFeedback');

const directPayload = buildFeedbackAppSettingPayload(
  'ss_fb_' + direct.feedbackId,
  'app_setting_feedback',
  Object.assign({ type: 'appSetting', key: 'modFeedback' }, direct)
);
assert('direct write uses unique sessionStateId', directPayload.sessionStateId.indexOf('ss_fb_') === 0);

let store = emptyFeedbackStore();
store = applyPublishedTeamAnnouncement(store, announcement);
store = applySentDirectMessage(store, direct);

const alexInbox = buildInboxItems(store, { loginId: 'Alex-tw', name: 'Alex Chen' });
const patInbox = buildInboxItems(store, { loginId: 'Pat-tw', name: 'Pat Lee' });
assert('Alex sees team + direct (2)', alexInbox.length === 2);
assert('Pat sees only the team announcement (1)', patInbox.length === 1 && patInbox[0].kind === 'team');
assert('both unread before any read receipt', countUnreadInbox(alexInbox) === 2 && countUnreadInbox(patInbox) === 1);

const pillUnread = inboxPillView(2);
assert('pill unread uses red + count', pillUnread.hasUnread === true && pillUnread.dot === 'unread' && pillUnread.label === 'Inbox · 2');
const pillIdle = inboxPillView(0);
assert('pill idle is yellow / Inbox', pillIdle.hasUnread === false && pillIdle.dot === 'idle' && pillIdle.label === 'Inbox');

const now = 1_000_000;
assert('no toast when inbox is empty', shouldShowInboxToast(now, 0, 0, false) === false);
assert('no toast while inbox is open', shouldShowInboxToast(now, 0, 2, true) === false);
assert('no immediate toast on first unread detect', shouldShowInboxToast(now, 0, 2, false) === false);
assert('toast after 30 min if still unread',
  shouldShowInboxToast(now + FEEDBACK_TOAST_INTERVAL_MS, now, 2, false) === true);
assert('no toast before 30 min',
  shouldShowInboxToast(now + FEEDBACK_TOAST_INTERVAL_MS - 1, now, 2, false) === false);
assert('opening inbox resets the timer',
  shouldShowInboxToast(now + 1000, resetInboxToastAt(now), 2, false) === false);

store = applyReadReceipt(store, announcement.id);
const alexAfterTeamRead = buildInboxItems(store, { loginId: 'Alex-tw', name: 'Alex Chen' });
const patAfterTeamRead = buildInboxItems(store, { loginId: 'Pat-tw', name: 'Pat Lee' });
assert('reading team announcement clears Pat unread', countUnreadInbox(patAfterTeamRead) === 0);
assert('Alex still has the 1:1 unread', countUnreadInbox(alexAfterTeamRead) === 1 && alexAfterTeamRead.some(m => m.kind === 'direct' && m.unread));

store = applyReadReceipt(store, direct.feedbackId);
const alexAllRead = buildInboxItems(store, { loginId: 'Alex-tw', name: 'Alex Chen' });
assert('Alex pill returns to idle after reading 1:1', inboxPillView(countUnreadInbox(alexAllRead)).hasUnread === false);

const rows = [
  {
    sessionStateId: 'ss_app_setting_team_feedback',
    orbitLoginId: '_app_setting',
    lastActive: '2026-09-15T17:00:00.000Z',
    stateJson: JSON.stringify({ type: 'appSetting', key: 'teamFeedback', announcement }),
  },
  {
    sessionStateId: 'ss_fb_' + direct.feedbackId,
    orbitLoginId: direct.toLoginId,
    lastActive: '2026-09-15T17:01:00.000Z',
    stateJson: JSON.stringify(Object.assign({ type: 'appSetting', key: 'modFeedback' }, direct)),
  },
  {
    sessionStateId: 'ss_asgn_123_alextw',
    orbitLoginId: 'Alex-tw',
    lastActive: '2026-09-15T17:02:00.000Z',
    stateJson: JSON.stringify({ stations: {}, calGuideAck: { acknowledgedAt: '2026-09-15T10:00:00.000Z' } }),
  },
];
const collected = collectFeedbackFromSessionRows(rows);
assert('ingest finds the published team announcement', collected.teamAnnouncement && collected.teamAnnouncement.id === announcement.id);
assert('ingest finds the 1:1 message', collected.messages.length === 1 && collected.messages[0].feedbackId === direct.feedbackId);
assert('ingest ignores session calGuideAck rows', !collected.messages.some(m => m.calGuideAck));

const afterPublish = applyPublishedTeamAnnouncement(emptyFeedbackStore(), announcement);
const modPath = buildInboxItems(afterPublish, { loginId: 'Sam-tw', name: 'Sam Ortiz' });
assert('publish → any mod can read the team announcement',
  modPath.length === 1 && modPath[0].kind === 'team' && modPath[0].unread === true);
const afterAck = applyReadReceipt(afterPublish, announcement.id);
assert('mod read does not drop the announcement, only unread',
  buildInboxItems(afterAck, { loginId: 'Sam-tw', name: 'Sam Ortiz' })[0].unread === false);

if (failed) {
  console.log('\n' + failed + ' check(s) failed');
  process.exit(1);
}
console.log('\nAll feedback inbox checks passed');
