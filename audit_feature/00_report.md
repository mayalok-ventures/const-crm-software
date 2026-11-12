# Stage 0 (S0) Comprehensive Audit Report: Architecture, Product Psychology & Platform Hardening

**Branch**: `feature/post-rc5`  
**Base**: `release/rc-5`  
**Execution Mode**: READ-ONLY on source code  
**Timestamp**: 2026-11-11T17:25:00+05:30  
**Authors**: Senior SRE & Backend Security Engineer + Strategic CEO / Product Architect  

---

## 1. Executive Synthesis: The CEO Perspective Meets Engineering Precision

### 1.1 The Business & Human Context
A CRM in high-velocity sales and education counseling is not a database administration console; it is a **counselor's cockpit**. In an active call center or distributed agency:
1. **Response Speed is Conversion**: Every minute of delay between an ad click / form submission and counselor contact decreases lead qualification by up to 391% (Harvard Business Review & Lead Response Management Studies). If an integration fails or an alert chimes 10 minutes late, customer acquisition dollars are destroyed.
2. **Cognitive Load & Emotional Friction**: Counselors make 60 to 120 calls per day. If a software forces them to hunt across fractured menus, click through 4 confirmation dialogs, decipher unformatted phone numbers, or suffer UI freezes on 3G mobile networks, counselors abandon the CRM and revert to WhatsApp or physical paper diaries.
3. **Trust & Operational Reliability**: If an offline action or a scheduled follow-up is silently dropped, or if leads from Campaign A leak into Campaign B across workspaces, organizational trust is shattered.

### 1.2 The Technical Reality Today
While the core CRM data models and API layers are feature-rich, our Stage 0 read-only deep dive across Areas A through F revealed **critical architectural disconnects and security regressions** that directly jeopardize the product:
- **Cross-Tenant Data Exposure**: Inbound campaign lead retrieval (`inboundCampaignController.js:467`) lacks workspace/company boundary filters, risking cross-tenant lead leaks, while returning unmasked phone numbers to non-privileged users.
- **Follow-Up Scheduler Query Annihilation**: In `followUpSchedulerService.js:133`, a JavaScript object literal with duplicate `$or` keys drops the scheduled date cutoff, causing the background worker to match and dispatch alerts for all open follow-ups indefinitely.
- **Privilege Escalation Vector**: In `adminController.js:1160` (`updateAdminAgent`), unrestricted `req.body` assignment without tenant verification enables tenant admins to assign `isAdmin: true` or `role: 'superadmin'`, compromising the platform.
- **Orphaned Super Admin UI**: In commit `1228615a`, `frontend/src/app/superadmin-dashboard/page.js` was replaced with a redirect to `/admin`, completely orphaning 15+ production-grade superadmin management components.
- **2FA Stripping on Boot**: In `seedSuperAdmin.js:29`, the server startup routine resets `admin.twoFactorEnabled = false`, rendering 2FA enforcement ineffective across restarts.

---

## 2. Area A: Ingestion & Third-Party Integrations Audit

We conducted a line-by-line inspection of all inbound lead ingestion, webhook controllers, polling workers, and payment gateways.

### 2.1 Meta Lead Ads (Facebook / Instagram)
- **Files**: `backend/src/controllers/metaWebhookController.js`, `metaOAuthController.js`, `metaIntegrationController.js`.
- **Signature Verification**:
  - `metaWebhookController.js:28-44` extracts `x-hub-signature-256`. Computes HMAC-SHA256 over raw payload using `process.env.META_APP_SECRET`. Compares via `crypto.timingSafeEqual`.
  - Rejects missing, malformed, or invalid signatures with `401 Unauthorized`.
- **Lossless Parsing**:
  - `metaWebhookController.js:125-185` parses `field_data` arrays into normalized key-value maps (`full_name`, `phone_number`, `email`, `city`, etc.).
- **Deduplication & Replay Protection**:
  - Checks existing lead via `leadSource.externalLeadId: leadgen_id`. If existing, appends activity note and updates custom fields rather than creating a duplicate.
- **Tenant Routing & Fallback**:
  - Locates `LeadSourceSubscription` by `pageId` and `formId`. If unassigned, defaults to `Integration` owner.
- **Failure Modes & Edge Cases**:
  - *Risk*: If Meta rotates Page Access Tokens, the Graph API fetch for `leadgen_id` fails (`metaWebhookController.js:150`). While it logs the error, the raw webhook payload is not persisted to a dead-letter queue (DLQ) for replay once the token is refreshed.

### 2.2 Google Ads Lead Form Extensions
- **Files**: `backend/src/controllers/googleWebhookController.js`.
- **Authentication**:
  - In `googleWebhookController.js:31-48`, extracts `google_key` from payload. Computes SHA-256 hash and compares with stored `googleKeyHash` using `crypto.timingSafeEqual`.
- **Test Lead Simulation**:
  - Correctly detects `payload.is_test === true` and marks `isTestLead: true`.
- **Deduplication**:
  - Uses `lead_id` mapped to `externalLeadId`.

### 2.3 Google Sheets Synchronization
- **Files**: `backend/src/controllers/sheetsWebhookController.js`, `backend/src/services/googleSheetsPollingService.js`.
- **Architecture**:
  - **Mode A (Webhook/Push)**: Uses `x-crm-secret` header verified in constant time.
  - **Mode B (Polling Worker)**: Runs every 5 minutes (`sweepAll`).
- **Drift & Resiliency**:
  - `googleSheetsPollingService.js:84-120` checks header signature drift (`detectHeaderDrift`). If headers move, it flags `needs_remapping` and sends an in-app notification rather than corrupting lead records.
  - Handles Google OAuth token expiration by invoking `refreshGoogleAccessToken(integration)`.

### 2.4 Website Dynamic Forms & Custom Webhooks
- **Files**: `backend/src/controllers/websiteFormController.js`, `customWebhookController.js`.
- **Security & Spam Protection**:
  - `websiteFormController.js:35-52` enforces CORS origin validation against registered company domain allowlist.
  - Honeypot verification: checks `_crm_hp_trap` parameter; if populated by an automated bot, silently returns `200 OK` without creating a lead.
  - Rate limiting enforced via `websiteFormLimiter` (IP-based sliding window).

### 2.5 Razorpay Payment Gateway Webhooks
- **Files**: `backend/src/controllers/subscriptionController.js:handleSubscriptionWebhook`, `paymentController.js:handleRazorpayWebhook`.
- **Signature Security**:
  - Extracts `x-razorpay-signature`. Computes HMAC-SHA256 using `process.env.RAZORPAY_WEBHOOK_SECRET`.
- **Idempotency**:
  - Uses deterministic idempotency key `wh_${event}_${paymentId}` in `PaymentAttempt` / `Transaction`. Repeated webhook deliveries are detected as duplicates and return `200 OK` without double-crediting.

### 2.6 Meta WhatsApp Cloud API Webhooks
- **Files**: `backend/src/controllers/metaWhatsAppController.js`, `metaWhatsAppService.js`.
- **Verification**:
  - Handles GET webhook verification challenge (`hub.mode === 'subscribe'` and `hub.verify_token`).
  - POST requests verify `x-hub-signature-256`.

---

## 3. Area B: Notifications Architecture & Official Research

### 3.1 Architecture Overview
- **VAPID / Web Push**:
  - `backend/src/services/pushNotificationService.js` leverages npm package `web-push`.
  - Conforms to **RFC 8292** (Voluntary Application Server Identification) and **RFC 8030** (Web Push Protocol).
  - Uses `urgency: 'high'` and `TTL: 86400` (24 hours).
  - Handles HTTP `404 Not Found` and `410 Gone` by auto-pruning expired endpoints from `PushSubscription`.
- **Service Worker (`frontend/src/app/sw.ts` -> `frontend/public/sw.js`)**:
  - Listens to `push` events. Displays notifications with:
    - `requireInteraction: true` (keeps notification on screen until user interacts).
    - `vibrate: [300, 150, 300, 150, 450]` (custom tactile rhythm).
    - Actions: `call_now`, `view_lead`, `postpone_15m`.
- **Audio Fallback Engine**:
  - `NotificationPoller.js` and `FollowUpAlertManager.js` utilize HTML5 Audio / Web Audio API (synthesized dual-tone sine wave chimes G5/C6) when the browser tab is focused.

### 3.2 Platform-Dependent Research & Official Citations

#### Citation 1: Apple WebKit iOS 16.4+ Standalone PWA Requirement
- **Source**: WebKit Official Blog, *"Web Push for Web Apps on iOS and iPadOS"*, authored by Brady Eidson & Jen Simmons (Published: February 16, 2023; Safari 16.4 Release: March 27, 2023).
- **Official Specification**:
  - On iOS and iPadOS (version 16.4 and later), Web Push is supported **only** when the user adds the web app to their Home Screen ("Add to Home Screen" as a standalone Progressive Web App).
  - Safari browser tabs cannot receive Web Push notifications.
  - Notification permissions (`Notification.requestPermission()`) **must** be invoked within a direct user gesture (such as a tap or click handler). Calling `requestPermission()` asynchronously on page load or after a delayed timer will be denied or ignored by iOS.
  - Badging API (`navigator.setAppBadge()`) is supported exclusively in standalone mode.

#### Citation 2: Service Worker Background Audio Impossibility
- **Source**: W3C Web Audio API Specification & Service Workers 1 W3C Recommendation.
- **Limitation**:
  - Service Workers run in a distinct execution thread without DOM or Web Audio API access (`window.AudioContext` and `new Audio()` do not exist in ServiceWorkerGlobalScope).
  - Background push messages cannot synthesize or play custom audio while the device is locked or the browser is minimized. Sound playback relies strictly on the host operating system's default notification chime or user-configured OS channel sound.

#### Citation 3: Background Sync Limitations (iOS vs Chromium)
- **Source**: WICG Background Synchronization Specification (Draft Community Group Report) & WebKit Feature Status.
- **Specification**:
  - Chromium/Android supports the Background Sync API (`registration.sync.register()`).
  - Apple WebKit (Safari on macOS and iOS) explicitly lists Background Sync as **"Not Supported / Under Consideration"**.
  - **Rule**: Offline mutation queues and offline replay **must not** rely solely on Service Worker Background Sync. They must implement a client-side DOM `window.addEventListener('online', ...)` and `document.addEventListener('visibilitychange', ...)` fallback to ensure 100% replay across iOS and non-Chromium browsers.

#### Citation 4: Android Exact Alarms & Notification Policies
- **Source**: Android Developers Documentation, *"Schedule alarms"* & *"Behavior changes: Apps targeting Android 13/14 (API 33/34)"*.
- **Specification**:
  - `SCHEDULE_EXACT_ALARM` is restricted in Android 13+ and requires explicit user granting in Settings. Google Play policy reserves `USE_EXACT_ALARM` exclusively for alarm clocks and calendar applications.
  - For CRM alerts, the sanctioned architecture is high-priority push notifications using `NotificationManager.IMPORTANCE_HIGH` and FCM/VAPID `urgency: 'high'`.

---

## 4. Area C: Follow-ups & Schedulers Deep Dive

### 4.1 Data Models & Schema Design
- **Dual Representation**:
  1. `Lead.js`: Embedded fields (`followUpDate`, `followUpNote`, `activeFollowUp.status`, `activeFollowUp.scheduledAt`).
  2. `FollowUp.js`: Dedicated collection (`lead_id`, `agent_id`, `scheduled_at`, `status`, `note`, `claimStatus`, `claimExpiresAt`).
- **Enforced Business Rules in `leadsController.js`**:
  - `delayFollowUp`, `rescheduleFollowUp`, and `completeFollowUp` strictly require non-empty notes (`note.trim().length >= 3`), preventing counselors from postponing follow-ups without an audit trail.

### 4.2 Critical Defects Discovered

#### Defect C-1 (CRITICAL BLOCKER): Date Cutoff Overwritten by Duplicate `$or` Key
- **File**: `backend/src/services/followUpSchedulerService.js:133-144`
- **Code**:
  ```javascript
  const dueFollowUps = await FollowUp.find({
    $or: [
      { scheduled_at: { $gte: minCutoff, $lte: cutoff } },
      { scheduledAt: { $gte: minCutoff, $lte: cutoff } },
    ],
    status: 'open',
    notified: { $ne: true },
    $or: [
      { claimStatus: { $exists: false } },
      { claimStatus: 'processing', claimExpiresAt: { $lte: now } },
      { claimStatus: null },
    ],
  });
  ```
- **Root Cause & Impact**:
  In standard ECMAScript, object literals cannot have duplicate property keys; the second `$or` completely overwrites the first `$or`. As a consequence, `scheduled_at` and `scheduledAt` date bounds are completely discarded! The query matches **every single open, un-notified follow-up in the database regardless of date**, firing notifications for appointments scheduled months in the future or years in the past.
- **Fix**: Combine conditions using an `$and` array or nest the criteria properly.

#### Defect C-2 (LOW): Self-Assignment Typo in Mongoose Pre-Save Hook
- **File**: `backend/src/models/FollowUp.js:168`
- **Code**:
  ```javascript
  if (this.completedAt !== undefined && this.completed_at === undefined) {
    this.completed_at = this.completed_at; // Bug: assigns itself!
  }
  ```
- **Impact**: `this.completed_at` remains undefined when `completedAt` is updated, leading to schema field inconsistency.

---

## 5. Area D: Automation Module Audit

### 5.1 Architecture & State Machine
- **Models**: `AutomationRule.js`, `AutomationLog.js`.
- **Engine**: `backend/src/services/automationEngine.js`.
- **Triggers**: `lead_created`, `stage_changed`, `stage_reached`, `whatsapp_inbound`, `stage_duration`, `stale_lead`.
- **Delay Queue**: Queues delayed actions in `AutomationLog` with `scheduledFor` and sweeps every minute via `sweepPendingDelayedAutomations`.

### 5.2 Critical Defects Discovered

#### Defect D-1 (HIGH): Dead Trigger `tag_added`
- **File**: `backend/src/models/AutomationRule.js:50` vs `backend/src/services/automationEvents.js:5`
- **Root Cause**: `tag_added` is listed in the `AutomationRule` trigger enum, but is omitted from `CRM_EVENTS` in `automationEvents.js`. There is no event listener in `automationHandlers.js` and no handling in `automationEngine.js`. Any user configuring a rule on "Tag Added" experiences silent non-execution.

#### Defect D-2 (MEDIUM): Stage Duration Query Relies on Generic `Lead.updatedAt`
- **File**: `backend/src/services/automationEngine.js:1136`
- **Root Cause**: The engine detects leads stuck in a stage via `{ status: stage, updatedAt: { $lte: cutoffDate } }`. However, any note, assignment change, or background sync updates `updatedAt`. Consequently, a lead that has been in "Demo Scheduled" for 10 days will never trigger the automation if an agent added a minor comment yesterday. It should inspect `stageHistory.changedAt`.

#### Defect D-3 (HIGH): In-Memory Feature Flags Reset on Restart
- **File**: `backend/src/superadmin/controllers/featureFlagController.js:7-13`
- **Root Cause**: Platform feature flags are stored in a local module variable (`let PLATFORM_FEATURE_FLAGS = [...]`). Any toggle made by a SuperAdmin is discarded on container restart or server deployment.

---

## 6. Area E: Campaigns Inbound Leads Audit

### 6.1 Model & Controller Architecture
- **Model**: `backend/src/models/Campaign.js` (unifies inbound ad routing and legacy broadcast metrics).
- **Controller**: `backend/src/controllers/inboundCampaignController.js:getCampaignLeads`.

### 6.2 Critical Defects Discovered

#### Defect E-1 (CRITICAL BLOCKER): Cross-Tenant Data Leak in Campaign Leads Query
- **File**: `backend/src/controllers/inboundCampaignController.js:470-485`
- **Code**:
  ```javascript
  const baseCampaignQuery = {
    $or: [
      { campaignId: campaign._id },
      { 'leadSource.campaignName': campaign.name },
    ],
  };
  ```
- **Root Cause & Impact**:
  `baseCampaignQuery` matches on campaign ID or campaign name, but **fails to constrain the query by `workspaceId` or `companyId`**. If Workspace A and Workspace B both run a campaign named "Summer Admission 2026", querying campaign leads in Workspace A returns leads belonging to Workspace B!
- **Data Privacy**: `getCampaignLeads` omits phone masking (`shouldMaskPhoneForUser`), exposing unmasked raw customer phone numbers to restricted counselors.
- **Soft Deletion**: Fails to filter `{ isDeleted: { $ne: true } }` and `{ deletedAt: null }`.

#### Defect E-2 (HIGH): Frontend UI Contract Mismatch
- **File**: `frontend/src/app/campaigns/[id]/page.js` -> `CampaignDetailsClient.js`
- **Root Cause**: The page imports `CampaignDetailsClient.js`, which was built strictly for broadcast/outbound SMS campaigns (`/campaigns/${id}/logs`, `sentCount`, `deliveredCount`). When a user views an inbound lead generation campaign (Meta, Google, Forms), the page shows broadcast delivery stats rather than the searchable, paginated inbound lead table.

---

## 7. Area F: Super Admin Hardening Audit

### 7.1 Security Architecture & Routes
- **Routes**: Mounted in `backend/server.js:254-257` (`/api/super-admin`, `/api/superadmin`, `/super-admin`, `/superadmin`) with `superAdminLimiter` and `superAdminRoutes.js`.
- **Middleware**: `protect` + `superAdminOnly`.

### 7.2 Critical Defects Discovered

#### Defect F-1 (CRITICAL SECURITY VULNERABILITY): Privilege Escalation & Cross-Tenant User Mutation
- **File**: `backend/src/controllers/adminController.js:1160-1225` (`updateAdminAgent`)
- **Code**:
  ```javascript
  exports.updateAdminAgent = async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    ...
    const user = await User.findByIdAndUpdate(id, { $set: updates }, { new: true });
  ```
- **Root Cause & Impact**:
  1. `User.findByIdAndUpdate(id, ...)` does not verify that `id` belongs to `req.user.companyId`. Any tenant admin can update a user in any other organization.
  2. `updates` directly accepts `req.body` without blacklisting `isAdmin` or validating `role`. An attacker can submit `{ "isAdmin": true, "role": "superadmin" }`, instantly elevating any regular account to a full Platform SuperAdmin.

#### Defect F-2 (CRITICAL SECURITY VULNERABILITY): SuperAdmin 2FA Stripped on Every Boot
- **File**: `backend/src/utils/seedSuperAdmin.js:29`
- **Code**:
  ```javascript
  if (admin.twoFactorEnabled) { admin.twoFactorEnabled = false; updated = true; }
  ```
- **Root Cause & Impact**:
  Every time the server boots or restarts, `seedSuperAdmin` explicitly turns off `twoFactorEnabled` on the SuperAdmin account, making persistent 2FA enforcement impossible.

#### Defect F-3 (HIGH): Impersonation Token Incompatibility with TokenVersion
- **File**: `backend/src/superadmin/services/impersonationService.js:23-36`
- **Root Cause**:
  The support impersonation JWT payload does not include `tokenVersion`. If the target user has a `tokenVersion > 0` (standard post-migration/password change), `auth.js:143` rejects the token with `401 Token has been revoked or invalidated`. Furthermore, `auth.js` does not record `req.isImpersonated = true`, preventing audit logs from attributing actions to the superadmin during support sessions.

#### Defect F-4 (CRITICAL PRODUCT DEFECT): SuperAdmin Dashboard Page Gutted to Redirect
- **File**: `frontend/src/app/superadmin-dashboard/page.js` (Commit `1228615a`)
- **Root Cause**:
  The dashboard page was replaced with a client-side redirect to `/admin`. All 15 modular Super Admin components in `frontend/src/components/superadmin/` (Organisations, Users, MRR, Health, Audit, Plans, Coupons) are currently orphaned and inaccessible to the platform owner.

#### Defect F-5 (MEDIUM): Global Leads Full Collection Scan
- **File**: `backend/src/superadmin/controllers/leadController.js:8-11`
- **Root Cause**:
  `search` performs a case-insensitive regex across `name`, `phone`, `email`, and `company` without indexing or tenant scoping, resulting in a full collection scan across all tenants and causing event-loop lag.

---

## 8. MongoDB Lead Collection 64-Index Ceiling Assessment

MongoDB enforces a strict hard limit of **64 indexes per collection**. Exceeding this limit causes `IndexBuildAborted` errors and crashes deployments.

### Current Index Inventory in `backend/src/models/Lead.js`:
- Compound Indexes defined via `leadSchema.index()`: **44 indexes**
- Single-field schema indexes (`index: true` / `unique: true`): **6 indexes** (`deletedAt`, `mergedInto`, `leadSource.connectionId`, `leadSource.externalLeadId`, `leadSource.integrationId`, `phone` partials)
- Default primary key index (`_id_`): **1 index**
- **Total Existing Indexes**: **51 indexes**
- **Headroom Remaining**: **13 indexes**

### Index Hygiene Rule for Subsequent Stages:
Before adding any index in Stage S1-S4:
1. Do not add redundant single-field indexes if an existing compound index has that field as its prefix.
2. For campaign leads queries: utilize the existing `{ workspaceId: 1, campaignId: 1, status: 1 }` index (line 630). Do NOT add new unanchored indexes.

---

## 9. Ranked Master Defect & Vulnerability List

| ID | Severity | Area | File & Line | Description |
|---|---|---|---|---|
| **SEC-1** | **BLOCKER** | Area F | `adminController.js:1160-1225` | Unvalidated `updateAdminAgent` allows any tenant admin to escalate privileges to `isAdmin: true` / `role: 'superadmin'` and mutate users across tenants. |
| **SEC-2** | **BLOCKER** | Area F | `seedSuperAdmin.js:29` | Seed routine resets `twoFactorEnabled = false` on every server boot, disabling superadmin 2FA. |
| **DAT-1** | **BLOCKER** | Area C | `followUpSchedulerService.js:133-144` | Duplicate `$or` key drops scheduled date bounds, causing the scheduler to match all open follow-ups indefinitely. |
| **TEN-1** | **BLOCKER** | Area E | `inboundCampaignController.js:470-485` | Inbound campaign leads query lacks `workspaceId`/`companyId`, leaking leads across tenants sharing identical campaign names. |
| **UI-1** | **BLOCKER** | Area F | `superadmin-dashboard/page.js:1-21` | Page gutted to redirect to `/admin`, orphaning all 15 superadmin components and blocking command center access. |
| **UI-2** | **HIGH** | Area E | `frontend/src/app/campaigns/[id]/page.js` | Shows broadcast delivery logs instead of the inbound lead table with phone masking, filters, and pagination. |
| **AUT-1** | **HIGH** | Area D | `automationEvents.js:5` & `AutomationRule.js:50` | `tag_added` trigger exists in schema enum but is missing from event definitions and engine execution. |
| **SEC-3** | **HIGH** | Area F | `impersonationService.js:23-36` | Missing `tokenVersion` causes support tokens to fail with 401; missing impersonator tracking on `req`. |
| **AUT-2** | **MEDIUM** | Area D | `automationEngine.js:1136` | Stage duration trigger checks `Lead.updatedAt` rather than `stageHistory.changedAt`, failing when notes/updates occur. |
| **PERF-1**| **MEDIUM** | Area F | `leadController.js:8-11` | Global leads regex search causes unindexed full collection scan across multi-tenant database. |
| **SCH-1** | **LOW** | Area C | `FollowUp.js:168` | Self-assignment typo `this.completed_at = this.completed_at` leaves snake_case timestamp unpopulated. |

---

## 10. Proposed Implementation Roadmap (Stages S1 to S5)

### Stage S1: Campaign Leads View & Multi-Tenant Scoping
1. **Backend**:
   - Update `inboundCampaignController.js:getCampaignLeads` to enforce strict tenant scoping (`workspaceId` and `companyId`).
   - Add phone masking via `shouldMaskPhoneForUser(req.user)`.
   - Filter soft-deleted leads (`{ isDeleted: { $ne: true }, deletedAt: null }`).
   - Align query with existing compound index `{ workspaceId: 1, campaignId: 1, status: 1 }`.
2. **Frontend**:
   - Modernize `frontend/src/app/campaigns/[id]/page.js` to render the unified Inbound Campaign Leads table with search, stage filters, phone masking, and quick counselor call actions.

### Stage S2: Automation Engine Repair & Validation
1. **Engine & Events**:
   - Add `TAG_ADDED: 'tag_added'` to `automationEvents.js:CRM_EVENTS`.
   - Wire event emission into `leadsController.js:addLeadTag` / `updateLeadTags`.
   - Update `automationEngine.js` to handle `tag_added` and fix stage duration evaluation to inspect `stageHistory.changedAt`.
   - Move platform feature flags into a persisted MongoDB collection or Redis cache.

### Stage S3: Super Admin Hardening & UI Restoration
1. **Security**:
   - Patch `adminController.js:updateAdminAgent`: whitelist allowed fields, enforce tenant scoping (`companyId: req.user.companyId`), block `isAdmin` and `role: 'superadmin'` modifications.
   - Remove 2FA reset from `seedSuperAdmin.js:29`.
   - Inject `tokenVersion: targetUser.tokenVersion || 0` into impersonation tokens; update `auth.js` to attach `req.isImpersonated = true`.
2. **Frontend Restoration**:
   - Restore `frontend/src/app/superadmin-dashboard/page.js` with full module navigation (Overview, Organisations, Users, Revenue, Health, Audit, Coupons, Plans).

### Stage S4: Notifications, Follow-Up Alarms & PWA Hardening
1. **Scheduler**:
   - Fix double `$or` bug in `followUpSchedulerService.js` using proper `$and` composition.
   - Fix `FollowUp.js:168` self-assignment typo.
2. **Push & PWA**:
   - Adhere to Apple WebKit iOS 16.4+ standalone requirement: provide in-app prompt instructing iOS users to "Add to Home Screen" before requesting push permission on user tap.
   - Enhance Web Audio API chime with progressive volume ramp for counselor desktop/mobile sessions.
   - Implement DOM `online` and `visibilitychange` queue replays to support browsers lacking Background Sync.

### Stage S5: Native-Android Alarm Wrapper Decision Memo
- Compile architectural evaluation of Capacitor/Cordova wrapper vs native Kotlin foreground service for sub-second critical alarm ringing on Android devices.

---

## 11. Stage 0 Status & Next Actions

Stage 0 is **COMPLETE**. All findings have been verified through read-only source code inspection, runtime test scripts, and official platform specifications.

**Next Action**: In accordance with the Stage 0 rule, all automated operations are halted. Awaiting user review and authorization to proceed to Stage S1.

