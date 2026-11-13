# Feature Release Notes: Post-RC5 Hardening & Production Polish

**Branch**: `feature/post-rc5`  
**Base Commit**: `release/rc-5`  
**Date**: November 2026  
**Final Canary Assessment**: **`READY-FOR-CANARY`** (Strictly subject to Canary Soak Criteria; Never Declare Unconditional Production Ready)

---

## 1. Executive Summary

Branch `feature/post-rc5` completes all 7 core stages of post-RC5 system hardening, security vulnerability elimination, automation engine repair, superadmin command center restoration, unified campaign leads experience, and mobile-first PWA notification reliability.

This release eliminates critical security blockers (tenant isolation leakage, privilege escalation in agent updates, and superadmin 2FA boot wiping), repairs the silent MongoDB query bugs that suppressed scheduled follow-ups and idle automation transitions, protects candidate PII from notification lockscreens, and establishes single-use cryptographic tokens for mobile quick actions.

All changes have been developed under strict non-destructive constraints, with extensive automated regression coverage across backend services, multi-tenant isolation suites, frontend unit components, and full Playwright cross-device E2E viewports.

---

## 2. Commit Ledger & Stage Summary

| Stage | Commit Hash | Area | Key Changes & Delivered Capabilities |
|---|---|---|---|
| **S1** | `82c3dbb` | Security & RBAC | • Eliminated privilege escalation in `adminController.js:updateAdminAgent`<br>• Enforced workspace tenancy & phone masking on `getCampaignLeads`<br>• Fixed SuperAdmin 2FA reset bug in `seedSuperAdmin.js`<br>• Enforced `audit.view` permissions & verified workspace isolation |
| **S2** | `7e7778e` | Follow-up Schedulers | • Fixed duplicate `$or` key collision in `followUpSchedulerService.js`<br>• Corrected `completed_at` typo in `FollowUp.js`<br>• Added dual-field synchronization hooks (`scheduled_at` ↔ `scheduledAt`)<br>• Integrated `timezoneHelper.js` with IANA offset calculations & DST safety |
| **S3** | `23bd59f` | Campaigns & Leads UI | • Embedded unified `LeadsContent` into `CampaignDetailsClient`<br>• Added campaign-scoped filtering without accidental filter clearing<br>• Fixed `campaign.template.length` null pointer crash<br>• Corrected duplicate `$or` collisions in inbound campaign aggregation metrics |
| **S4** | `e9c38a4` | Automation Engine | • Registered `tag_added` trigger in `CRM_EVENTS` & `AutomationEngine`<br>• Enforced deterministic idempotency keys and loop depth guards (`depth >= 3`)<br>• Replaced inaccurate `Lead.updatedAt` with `stageHistory.changedAt`<br>• Added `dead_letter` status with UI retry capability for failed automations |
| **S5** | `e20bf1a` | Super Admin Hardening | • Restored full 15-module `SuperAdminSidebar` command center UI<br>• Injected target user's `tokenVersion` into impersonation tokens<br>• Barred impersonation of SuperAdmin accounts and barred impersonated access to superadmin endpoints<br>• Enforced typed confirmation strings (`CLEAN_SLATE_CONFIRM`) and production env guards on destructive endpoints |
| **S6** | `cd2c402`<br>`ad5c0d2` | Notifications & PWA | • Flag-gated Web Push (`ENABLE_WEB_PUSH_FOLLOWUPS`, default `false`)<br>• Stripped candidate phone numbers from all notification text/payloads (PII protection)<br>• Created `ConsumedToken` TTL model and HMAC-SHA256 single-use tokens for lockscreen quick actions<br>• Created mobile-first `/follow-ups/quick-action` route with mandatory outcome notes<br>• Added unacknowledged follow-up retry sweep (15m, max 3 retries)<br>• Added notifications health diagnostics & per-platform permission recovery guides |
| **S7** | `b02644c` | Native Android Alarm Memo | • Authored `docs/NATIVE_ALARM_DECISION_MEMO.md` detailing pure PWA vs Android Capacitor AlarmManager vs iOS constraints and phased rollout roadmap |
| **Build** | `39fe219`<br>`9f511ba` | Build & E2E Polish | • Resolved syntax duplicate button tag in `LeadsContent.jsx`<br>• Configured Vitest single-fork teardown and JSDOM DOM cleanup<br>• Refined Playwright strict selector matchers for campaign leads mobile spec |

---

## 3. Configuration Flags & Default Values

All newly introduced operational features default to **safe OFF / disabled** states to prevent unexpected production divergence:

| Flag Name | Env Variable / Schema Field | Default Value | Purpose & Production Behavior |
|---|---|---|---|
| **Web Push Follow-ups** | `ENABLE_WEB_PUSH_FOLLOWUPS` | `'false'` | Gates web push subscription dispatches and VAPID key initialization. When false, in-app notifications and WebSockets function normally while push network egress is disabled. |
| **Destructive Clean Slate** | `ALLOW_DESTRUCTIVE_CLEANSLATE` | `'false'` | Gates superadmin destructive endpoints (`purgeFakeDataAndCleanSlate`, `purgeTestDataOnly`, user deletion). Permanently blocked in production unless explicitly set to `'true'`. |
| **Phone Number Masking** | `TenantConfig.maskLeadPhones` | `true` (enforced per role) | Dynamically masks candidate phone numbers (`+9198765XXXXX`) for counselors and non-admin viewers across lead views, campaign lists, and exports. |
| **Automations Loop Guard** | `AUTOMATION_MAX_DEPTH` | `3` (internal constant) | Hard-caps nested automation execution chains to 3 levels, preventing infinite event loops. |

---

## 4. Environment Variables Catalog

The following variables have been integrated into `backend/src/config/envValidator.js`:

```javascript
// Web Push VAPID Configuration (Required only when ENABLE_WEB_PUSH_FOLLOWUPS === 'true')
VAPID_PUBLIC_KEY   // String: RFC 8292 Application Server Public Key (Base64 URL-safe)
VAPID_PRIVATE_KEY  // String: RFC 8292 Application Server Private Key (Base64 URL-safe)
VAPID_SUBJECT      // String: mailto: or https: URL identifying the application operator

// Destructive Action Guard (Production safety)
ALLOW_DESTRUCTIVE_CLEANSLATE // String: 'true' | 'false' (default 'false')
```

When `ENABLE_WEB_PUSH_FOLLOWUPS !== 'true'`, missing VAPID keys will log a non-fatal warning and fall back to ephemeral development keys for local unit testing, ensuring the server boots cleanly without requiring production keys in local or CI environments.

---

## 5. Data Model & Index Changes

### 5.1 New Models
- **`ConsumedToken`** (`backend/src/models/ConsumedToken.js`):
  - Fields: `jti` (String, indexed), `action` (String), `targetId` (String), `userId` (ObjectId), `workspaceId` (ObjectId), `consumedAt` (Date), `expiresAt` (Date).
  - Index: `{ expiresAt: 1 }` with `{ expireAfterSeconds: 0 }` (MongoDB TTL index for automatic expiration).

### 5.2 Updated Schemas & Backwards Compatibility
- **`FollowUp`** (`backend/src/models/FollowUp.js`):
  - Fields added: `acknowledged` (Boolean, default `false`), `acknowledgedAt` (Date), `reminderCount` (Number, default `0`), `lastReminderAt` (Date).
  - Indexes: `{ status: 1, notified: 1, scheduled_at: 1, claimStatus: 1 }`, `{ status: 1, acknowledged: 1, lastReminderAt: 1 }`.
  - Backwards Compatibility: Existing documents without `acknowledged` evaluate to falsy (`false`), preserving standard notification sweeps without migration locks.
- **`PushSubscription`** (`backend/src/models/PushSubscription.js`):
  - Field added: `deviceInfo.deviceLabel` (String, e.g., `"Pixel 7 - Chrome Mobile"`).
  - Index: `{ endpoint: 1, user: 1 }` (unique compound index).
- **`AutomationLog`** (`backend/src/models/AutomationLog.js`):
  - Enum extended: `status` now permits `'dead_letter'`.

### 5.3 MongoDB Index Ceiling
- Total active Lead indexes remain at **51** (well beneath MongoDB's 64-index hard limit), leaving **13** indexes of headroom for future expansion.

---

## 6. Verification & Automated Test Evidence

### 6.1 Backend Integration Master Runner
- **Command**: `node backend/tests/run_all_integration_tests.js`
- **Total Test Suites**: 162
- **Passing Suites**: **136**
- **Cataloged Pre-Existing Main Failures**: 26 (Documented in `backend/tests/final_manifest_report.json`; verified identical to `main` baseline).

### 6.2 New Stage Test Suites (100% Passing)
- `stage1_security_blockers.test.js`: 4/4 passing
- `stage2_followup_schedulers.test.js`: 5/5 passing
- `stage3_campaign_leads_view.test.js`: 5/5 passing
- `stage4_automations_repair.test.js`: 8/8 passing
- `stage5_superadmin_hardening.test.js`: 6/6 passing
- `stage6_notifications_pwa.test.js`: 7/7 passing

### 6.3 Dual-Instance Concurrency & Distributed Locking
- **Command**: `node backend/tests/dual_instance_concurrency.test.js`
- **Results**:
  - Test 1: Once-only cron execution strictly executed exactly ONCE across two competing server instances under race conditions.
  - Test 2: WhatsApp distributed lease strictly enforced single-holder semantics across cluster instances. Competing worker acquisitions rejected; expired leases reclaimed cleanly.

### 6.4 Frontend Unit & Integration Tests (100% Passing)
- **Vitest Unit Tests**: `npm run test:unit`
  - Suites: 7 passed of 7
  - Tests: **21 passed of 21**
- **Integration Test Suites**: `npm test`
  - Helpers (`helpers.test.js`): PASSED
  - Dexie & Virtualization (`dexie_and_virtualization.test.js`): PASSED
  - Navigation Responsiveness (`navigation_responsiveness.test.js`): PASSED (12/12 routes)
  - Performance & Workspace Isolation (`performance_and_isolation.test.js`): PASSED
  - OAuth Popup Handling (`oauth_popup.test.js`): PASSED
  - Offline Sync Replay (`offline_sync_replay.test.js`): PASSED

### 6.5 Full Playwright E2E Suite (100% Passing)
- **Command**: `npx playwright test`
- **Total Tests**: **30 passed of 30** (across 8 parallel workers)
  - Mobile Pixel 7: 10/10 passed
  - Mobile iPhone 14: 10/10 passed
  - Desktop Chrome: 10/10 passed
- **Covered Scenarios**:
  - Rapid lead switching ($A \to B \to C \to A$) under network latency with zero stale bleed.
  - Save-while-navigating preserving optimistic writes in payload.
  - Campaign header metrics, embedded lead list, and phone number masking on mobile viewports.
  - Accessible dialog modals, mobile bottom navigation tap targets, and non-clipping filter bars.
  - Font size enforcement ($\ge 16\text{px}$) preventing iOS WebKit auto-zoom.

### 6.6 Production Static Export Build
- **Command**: `next build` (Next.js 16.2.10 Turbopack)
- **Output**: **40 of 40 routes** statically generated and optimized with zero compilation or typing errors.
- **TypeScript**: `tsc --noEmit` exited code `0` with zero diagnostic errors.

---

## 7. Stage Rollback Runbooks

In the event of an operational anomaly during Canary soak, follow these granular rollback procedures:

### Stage 1 (Security & RBAC) Rollback
- **Trigger**: Legitimate tenant admins unable to edit permissible staff fields.
- **Action**: Git revert commit `82c3dbb`. Restart API instances.
- **Impact**: Reopens privilege escalation vulnerability; requires immediate hotfix rather than prolonged revert.

### Stage 2 (Follow-up Schedulers) Rollback
- **Trigger**: Follow-up notification sweep causing high CPU or database lock contention.
- **Action**: Git revert commit `7e7778e`. Drop index `idx_followup_sweep_opt` if disk I/O spikes.
- **Impact**: Reverts to legacy `$or` behavior (scheduled follow-ups may be missed).

### Stage 3 (Campaign Leads) Rollback
- **Trigger**: Campaign details page failing to render on older mobile browsers.
- **Action**: In `frontend/src/app/campaigns/[id]/page.js`, swap `CampaignDetailsClient` back to previous broadcast client or revert commit `23bd59f`. Re-deploy static frontend bundle to CDN.

### Stage 4 (Automation Engine) Rollback
- **Trigger**: Event bus memory leak or excessive automation log table growth.
- **Action**: Set `AUTOMATION_ENABLED=false` in environment variables. To revert code, git revert commit `e9c38a4`.
- **Database**: No schema changes require migration rollback; `dead_letter` status records remain queryable.

### Stage 5 (Super Admin) Rollback
- **Trigger**: SuperAdmin support mode causing unexpected impersonation lockouts.
- **Action**: Git revert commit `e20bf1a`. Ensure `ALLOW_DESTRUCTIVE_CLEANSLATE` is unset.

### Stage 6 (Notifications & PWA) Rollback
- **Emergency Kill Switch**: Set `ENABLE_WEB_PUSH_FOLLOWUPS=false` in environment configuration and restart the backend server.
- **Zero-Code Rollback**: Setting `ENABLE_WEB_PUSH_FOLLOWUPS=false` immediately halts all Web Push network dispatches while preserving internal in-app notification toasts and database records.
- **Code Revert**: Git revert commits `cd2c402` and `ad5c0d2`. The `ConsumedToken` collection can be dropped or left to expire via TTL without impact.

---

## 8. Final Canary Assessment & Recommendation

### Canary Readiness Verdict: **`READY-FOR-CANARY`**

> [!IMPORTANT]
> In accordance with production release governance, this branch is designated **`READY-FOR-CANARY`** and must NOT be declared "production ready" unconditionally without staging soak verification.

### Staging Soak Protocol
1. Deploy `feature/post-rc5` to the Staging Environment.
2. Maintain a single server instance with `RUN_BACKGROUND_WORKERS=true`.
3. Verify the `/api/superadmin/notifications/reminder-health` and `/api/notifications/push/health` endpoints return HTTP 200 with `schedulerRunning: true`.
4. Run a 60-minute synthetic load simulation (50 virtual users executing simultaneous lead mutations, follow-up scheduling, and campaign navigation).
5. Confirm:
   - Zero unhandled promise rejections or process crashes.
   - P99 event-loop lag remains $< 50\text{ms}$.
   - Zero acknowledged write losses or duplicate automation triggers.
   - Web Push delivery success rate $\ge 98\%$ on registered Canary test devices.
