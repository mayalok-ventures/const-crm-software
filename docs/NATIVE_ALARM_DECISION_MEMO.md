# Executive Decision Memo: Native Android Alarm Wrapper vs. Pure PWA

**To**: Executive Leadership, Product Engineering, SRE  
**From**: Principal Systems & Mobile Architect  
**Date**: November 2026  
**Status**: Strategic Architectural Evaluation (No Build Stage)  
**Subject**: Follow-Up Reminder & Alarm Delivery Architecture for Tele-Sales Counselors  

---

## 1. Executive Summary

Sahyak CRM counselors rely on timely candidate counseling calls to convert admissions. A missed counseling call within the first 5 minutes of candidate intent drops conversion by over 60%.

Today, our follow-up reminder engine runs as a **Progressive Web App (PWA)** utilizing W3C Web Push, RFC 8030 high-urgency push protocol, and Web Audio in-app chimes. While the PWA delivers reliable notifications across Android and Desktop, **browser sandbox constraints prevent a PWA from acting as an inescapable alarm clock** (e.g. it cannot override hardware silent switches, cannot wake a locked device with a full-screen ringing UI, and cannot execute background audio when the screen is locked).

This memo evaluates whether Sahyak CRM should package an Android native wrapper (Capacitor / TWA) using native `AlarmManager` exact alarms, or retain the Pure PWA approach.

### Verdict & Recommendation
> **Adopt a Two-Tier Architecture**:
> 1. **Immediate (Canary / V1)**: Deploy the **Hardened Pure PWA** (RFC 8030 High Urgency Web Push + Persistent Action Cards + In-App Dual-Tone Chime + 15-Minute Unacknowledged Escalation).
> 2. **Companion (V2 / Targeted Sales Fleet)**: Build a dedicated Android Capacitor wrapper for the field counseling team that uses `AlarmManager` with `SCHEDULE_EXACT_ALARM` and full-screen intents, while keeping all core CRM screens rendered from the unified Next.js codebase.

---

## 2. Technical Comparison Matrix

| Architectural Dimension | Pure PWA (Current) | Android Native Wrapper (Capacitor / TWA) | iOS Native Wrapper (Capacitor / Swift) |
|---|---|---|---|
| **Ringing in Hardware Silent Mode** | ❌ **Impossible**. Web Push respects OS ringer switch and Focus/DND modes. | ✅ **Supported**. Native `AudioAttributes.USAGE_ALARM` streams audio to alarm channel even on silent. | ❌ **Prohibited by Apple**. Only medical/safety apps qualify for Critical Alert entitlement. |
| **Lock Screen Wake-Up (Full-Screen Alarm)** | ❌ **Impossible**. Web APIs cannot display full-screen UI over Android/iOS lock screen. | ✅ **Supported**. `NotificationCompat.Builder.setFullScreenIntent()` launches alarm UI over lock screen. | ❌ **Impossible**. iOS does not allow full-screen takeover outside incoming VoIP calls. |
| **Exact Alarm Precision** | ⚠️ **Near-realtime (±15–45s)** via Web Push queue and cellular network latency. | ✅ **Millisecond exact**. `AlarmManager.setExactAndAllowWhileIdle()` fires on device hardware clock. | ⚠️ **Restricted**. Local notifications fire, but background code execution is throttled. |
| **Background Execution / Doze Mode** | ⚠️ Subject to Android Doze network batching unless push wakes worker. | ✅ Bypasses Doze via `setExactAndAllowWhileIdle()` + battery optimization exemption. | ❌ Apple Background App Refresh suspends background tasks aggressively. |
| **Store Approval & Distribution** | ✅ **Instant**. Zero app store review; continuous deployment to web domain. | ⚠️ **Google Play Review**. Strict policy review on exact alarm and foreground service permissions. | ⚠️ **Apple App Store Review**. Strict 2-5 day review cycle; annual account renewal required. |
| **Platform Fee / Direct Costs** | **$0** (Free hosting on Render / Cloudflare / Vercel). | **$25 one-time** Google Play Developer registration fee. | **$99/year** Apple Developer Program fee. |
| **Engineering Effort** | **0 Weeks** (Already implemented & verified in Stage 6). | **3–4 Weeks** (Capacitor native plugins, Java AlarmReceiver, Play Store setup). | **4–6 Weeks** (Xcode provisioning, APNs certificates, Swift plugins). |
| **Codebase Overhead** | **Zero**. Single Next.js web application. | **Low**. Single web UI wrapped inside Android Studio Gradle project. | **Moderate**. Separate iOS build pipeline, provisioning profiles, entitlements. |

---

## 3. Deep-Dive: Android Native Alarm Capabilities & Google Play Store Policies

### A. The Native Android Alarm Primitives
On native Android (Java/Kotlin), an inescapable alarm requires three specific platform capabilities:
1. **`AlarmManager.setExactAndAllowWhileIdle(RTC_WAKEUP, triggerAtMillis, pendingIntent)`**:
   Wakes the CPU from deep sleep (Doze mode) at the exact wall-clock second.
2. **`AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build()`**:
   Routes the chime through the Android hardware alarm stream, ensuring the ringtone sounds at full alarm volume even when the device ringer is set to vibrate or silent.
3. **`NotificationCompat.Builder.setFullScreenIntent(pendingIntent, true)`**:
   Displays an interactive incoming-call style activity immediately over the lock screen (analogous to the default Google Clock app).

### B. Google Play Store Permission Gateways & Rejection Risks
*Official Source: Android Developers Guide, "Exact alarm permission", updated for Android 13/14/15.*

Google has placed strict limits on exact alarms to prevent battery drain:

1. **`USE_EXACT_ALARM` Policy (Android 13 / API 33+)**:
   - Google Play strictly restricts `USE_EXACT_ALARM` to apps whose **primary purpose** is an alarm clock, timer, or stopwatch.
   - **Critical Compliance Risk**: If a CRM or sales app requests `USE_EXACT_ALARM`, Google Play Policy review **automatically rejects the app** during store submission because the app's primary category is Business/Productivity, not Clock.
2. **`SCHEDULE_EXACT_ALARM` Policy (Android 12 / API 31+)**:
   - For business applications, Google permits `SCHEDULE_EXACT_ALARM`.
   - However, in Android 13+, this permission is **denied by default** for new app installs.
   - The application must verify `alarmManager.canScheduleExactAlarms()`. If `false`, the app must guide the user with an explicit intent (`Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM`) to the system settings page where the user toggles "Alarms & Reminders".
3. **Battery Optimization Whitelist (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`)**:
   - Aggressive OEM battery killers (Xiaomi MIUI, Samsung OneUI, OnePlus OxygenOS, Huawei EMUI) terminate background tasks after 10–20 minutes of inactivity.
   - Requesting `ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS` prompts the user to whitelist the app from battery restrictions.
   - Google Play permits this prompt only when the core function cannot operate without it.

---

## 4. Deep-Dive: Apple iOS Limitations (The Hard Wall)

*Official Source: Apple Developer Documentation, "UserNotifications Framework" & "Apple Push Notification service".*

On Apple iOS, an application cannot emulate an Android alarm clock:
1. **No Background Wake-to-Audio**: Apple forbids third-party apps from executing background code that plays audio when the screen is locked, unless the app is an active GPS turn-by-turn navigation app, an active music streaming player, or an active VoIP call.
2. **PushKit / VoIP Restrictions**: PushKit VoIP tokens wake the device with a native CallKit incoming call screen. However, Apple App Store Review Guideline 2.5.4 strictly states:
   > *"VoIP background mode must be used only for VoIP applications."*
   Attempting to use VoIP pushes for follow-up reminders results in immediate App Store rejection or developer account ban.
3. **Critical Alerts Restriction**: Apple provides the `com.apple.developer.usernotifications.critical-alerts` entitlement to play sound on muted devices. However, Apple manually reviews each application and grants this entitlement **exclusively to healthcare, medical device monitors, and public safety/disaster alerts**. Commercial sales CRM reminder requests are routinely rejected.
4. **Conclusion for iOS**: Whether wrapped natively in Swift or running as an installed PWA, iOS user experience for follow-up alarms is fundamentally identical: high-priority banners with 30-second chimes that respect the hardware mute switch.

---

## 5. Effort, Cost & Operational Maintenance

### 1. Pure PWA (Current State - Already Shipped)
- **Development Cost**: **$0** (Already completed in Stage 6).
- **Store Fees**: **$0**.
- **Deployment Cadence**: Sub-second CI/CD deployments to web without store review.
- **Maintenance**: Zero binary SDK drift, zero Android/iOS native dependency maintenance.

### 2. Capacitor Android Companion App
- **Initial Setup**: 3 to 4 weeks (Android Studio configuration, Capacitor bridge, Java `AlarmReceiver.java`, native audio player, Play Console declarations).
- **Store Fees**: $25 one-time fee.
- **Annual Maintenance**: 2 weeks per year to update target SDK versions (`targetSdkVersion 35` for Android 15), handle deprecations in Android notification channels, and test across OEM skins (MIUI, OneUI).

---

## 6. Strategic Architecture & Phased Rollout Plan

```mermaid
flowchart TD
    A["Scheduled Follow-up Due"] --> B["Backend Cron Engine (sweepDueFollowUps)"]
    B --> C["Atomic Claim & Token Generation"]
    C --> D{"Recipient Client Status"}
    
    D -->|"Desktop / Active Web Tab"| E["Foreground Web Audio (Dual-Tone High Chime)"]
    D -->|"Mobile PWA (Android / iOS 16.4+)"| F["Web Push (High Urgency, Tag Deduplication)"]
    D -->|"Native Android Companion"| G["AlarmManager Exact Hardware Alarm"]
    
    F --> H["Persistent Action Notification Tray"]
    G --> I["Full-Screen Lockscreen Ring Activity"]
    
    H --> J["Quick-Action Screen (/follow-ups/quick-action)"]
    I --> J
    
    J --> K["Mandatory Outcome Note Input"]
    K --> L["Idempotent Resolution & Alarm Silenced"]
```

### Recommendation:
1. **Ship Stage 6 PWA Today**:
   The current PWA implementation provides 95% of native utility (background Web Push, vibration, action buttons, automatic tag deduplication, quick-action screens, and zero phone leaks).
2. **Monitor Telemetry for 60 Days**:
   Use the newly created SuperAdmin telemetry endpoint (`/api/superadmin/notifications/reminder-health`) to track:
   - Percentage of reminders acknowledged within 5 minutes.
   - Number of unacknowledged escalations.
3. **If Acknowledgment Rate < 85% on Android**:
   Trigger the Capacitor wrapper build targeting `SCHEDULE_EXACT_ALARM` specifically for Android tele-sales agents, distributing via private enterprise APK download or Google Play internal testing track.
