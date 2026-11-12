# Notifications, Follow-Up Reminders & PWA Device QA Manual

This document provides exact manual testing procedures, expected results, edge cases, and architectural constraints for Sahyak CRM's PWA push notifications and follow-up reminders.

---

## 1. Architecture Overview & Standards Compliance

- **W3C Push API / RFC 8030 & RFC 8292 (VAPID)**: Device subscriptions are registered with authenticated VAPID keys (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`).
- **Urgency & TTL**: Follow-up reminders dispatch with `Urgency: high` and `TTL: 3600` (1 hour) to ensure immediate wake-up from low-power states without lingering as obsolete alerts.
- **Privacy Enforcement**: Reminders strictly exclude lead telephone numbers across all push payloads, titles, bodies, and OS shades.
- **Notification Deduplication**: Uses deterministic `tag: fup_<followUpId>` with `renotify: true`. Rescheduling or updating a reminder replaces the active notification card rather than stacking clutter.
- **Quick-Action Security**: Direct actions from notifications load a minimal screen authenticated via single-use, HMAC-SHA256 signed tokens (valid 30–60 mins). Replay attempts are rejected with HTTP 409 Conflict.
- **Policy Enforcement**: Completing, snoozing, or rescheduling via notifications or quick-action screen **strictly requires a non-empty outcome note**.

---

## 2. Platform QA Procedures

### A. Android (Google Chrome, Microsoft Edge, Brave)

#### 1. Setup & Subscription
1. Open Sahyak CRM in Android Chrome (`https://crm.yourdomain.com`).
2. Navigate to **Notification Center** (`/notifications`).
3. Verify that the browser does **NOT** prompt for notification permission on initial page load (Zero unsolicited prompts).
4. Tap **Enable Device Push Alarms**.
5. When the Android permission dialog appears ("Sahyak CRM wants to send you notifications"), tap **Allow**.
6. **Expected Result**:
   - Status badge transitions to `Enabled` (green).
   - "Setup & Health" shows `Browser Permission: granted` and `Active Devices: 1 connected`.

#### 2. Background Wake-Up (App Closed)
1. Schedule a follow-up for 2 minutes in the future on any candidate.
2. Swipe away Chrome from the Android Recents/Multitasking tray (force backgrounded).
3. Lock the phone screen.
4. Wait for the scheduled minute to arrive.
5. **Expected Result**:
   - Phone screen wakes up or displays heads-up notification in Android shade.
   - Vibration pattern fires: `[300ms, 150ms, 300ms, 150ms, 450ms]`.
   - Title displays `⏰ Follow-Up Reminder: <Candidate Name>`.
   - Message displays Candidate Name and follow-up note (strictly NO phone number).
   - Action buttons appear in shade: **[Done / Note]** and **[Snooze 15m]**.

#### 3. Action Button Interaction
1. Tap **[Snooze 15m]** in the notification shade.
2. **Expected Result**:
   - Browser opens directly to `/follow-ups/quick-action?fupId=...&token=...&action=snooze&delayMinutes=15`.
   - Screen prompts for the mandatory snooze reason note.
   - Enter note: `"Student requested callback after lecture"` and submit.
   - Follow-up is updated, alarm is silenced, and new reminder is queued for +15 minutes.

#### 4. Reschedule Notification Replacement (No Duplicate Stacking)
1. When a reminder fires, reschedule it from another device or tab to a new time.
2. **Expected Result**:
   - The previous notification is replaced in-place in the Android tray via matching tag (`fup_<id>`).
   - Two notification cards for the same follow-up are NEVER stacked.

> **[Android Hardware Only]**: Android Doze Mode, OEM aggressive battery optimization (e.g. Xiaomi MIUI / Samsung OneUI sleeping apps), and hardware vibration motors can only be verified on physical devices.

---

### B. Apple iOS & iPadOS (Safari iOS 16.4+)

*Official WebKit Citation: WebKit Blog, "Web Push for Web Apps on iOS and iPadOS", Feb 16, 2023.*

#### 1. Standalone PWA Installation Prerequisite
> **CRITICAL REQUIREMENT**: Safari mobile tabs on iOS do **NOT** support Web Push notifications. Apple WebKit strictly restricts Web Push to web apps added to the iOS Home Screen (Standalone mode).

1. Open Safari on iPhone running iOS 16.4 or later.
2. Visit Sahyak CRM.
3. Tap the Safari **Share** icon (square with arrow pointing up).
4. Scroll down and tap **Add to Home Screen**.
5. Name the icon and tap **Add**.
6. Close Safari and tap the new **Sahyak CRM** icon on the Home Screen.

#### 2. User-Gesture Permission Request
1. Inside the installed PWA, navigate to **Notifications** (`/notifications`).
2. Tap **Enable Device Push Alarms**. (Must be an explicit user tap; programmatic requests will fail silently on iOS).
3. Tap **Allow** on the iOS system prompt.
4. **Expected Result**: Push subscription is created and registered with APNs (Apple Push Notification service).

#### 3. Lock Screen & Notification Center
1. Lock the iPhone.
2. Trigger follow-up reminder.
3. **Expected Result**:
   - iOS lock screen displays alert with Sahyak CRM app icon.
   - Tapping notification launches standalone PWA directly into `/follow-ups/quick-action`.

> **[iOS Hardware Only]**:
> - Apple Web Push relies on APNs routing and Apple Push servers.
> - iOS hardware Ring/Silent switch cannot be overridden by Web Push; notifications are silent when hardware switch is set to mute.
> - Web Audio in-app chiming is only possible when the PWA is active and unmuted by user gesture.

---

### C. Desktop (Google Chrome, Microsoft Edge, macOS Safari)

#### 1. System Notification Toast
1. Open CRM on desktop Chrome or Edge.
2. Enable push notifications in `/notifications`.
3. Minimise browser or switch to another desktop app.
4. When follow-up is due, verify Windows Action Center toast or macOS Notification banner appears in top/bottom right corner.
5. Verify `requireInteraction: true` keeps the desktop toast visible until clicked.
6. Verify clicking toast navigates and focuses the existing CRM tab.

#### 2. Dual-Tone Audible Alarm (Active App)
1. Keep CRM open in an active browser tab.
2. When follow-up is due, verify synthesized dual-tone high-clarity chime plays (`CHIME_WAV_B64` / WebAudio API).
3. Verify clicking **Acknowledge** or **Snooze** mutes and stops the audio loop.

---

## 3. Security & Integrity Verification Checklist

| Test Case | Step | Expected Result | Pass/Fail |
|---|---|---|---|
| **Privacy / No Phone Leak** | Inspect notification title, body, and pushPayload | ZERO phone digits present; lead name and note only | PASS |
| **Mandatory Note** | Attempt submitting quick action with whitespace note | HTTP 400 Bad Request; submission blocked | PASS |
| **Token Replay** | Replay submitted quick-action URL with same token | HTTP 409 Conflict: Token consumed or expired | PASS |
| **Tenant Isolation** | Use quick-action token from Tenant A on Tenant B follow-up | HTTP 404/403: Cross-tenant access forbidden | PASS |
| **Single-Device Logout** | Call `/api/auth/logout` passing active `endpoint` | That device subscription deleted; other devices remain | PASS |
| **Revoke All Logout** | Call `/api/auth/logout-all` | ALL push subscriptions for user deleted from DB | PASS |
| **Expired Subscription Cleanup** | Push server responds with HTTP 410 or 404 | Endpoint immediately deleted from `PushSubscription` | PASS |
| **Unack Re-send** | Leave follow-up open and unacknowledged for 15m | Overdue reminder re-dispatched (capped at 3) | PASS |
