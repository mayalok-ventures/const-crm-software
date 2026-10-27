# Sahyak CRM: Prioritized Issues Register (`CRM_ISSUES_REGISTER.md`)

**Date:** October 24, 2026  
**Status:** ALL 11 ISSUES RESOLVED & VERIFIED (Production Gate Passed)

---

### Implementation & Verification Summary

| Issue ID | Category | Severity | File Modified | Resolution | Test Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **ISSUE-01** | Security / Isolation | Critical | `backend/src/controllers/catalogueController.js` | Protected tenant predicate using `$and` compound queries | ✅ VERIFIED (`crm_forensic_fixes.test.js`) |
| **ISSUE-02** | Workflow / Multi-User | High | `backend/src/controllers/leadsController.js`, `models/Lead.js` | Resolved workspace & agency owner inheritance | ✅ VERIFIED (`crm_forensic_fixes.test.js`) |
| **ISSUE-03** | Data Integrity | High | `backend/src/models/Lead.js` | Consolidated duplicate definitions into canonical 11-value enum | ✅ VERIFIED (`crm_forensic_fixes.test.js`) |
| **ISSUE-04** | Frontend RBAC | High | `frontend/src/lib/auth.js` | Derived dynamic role checks from session & membership | ✅ VERIFIED (`auth_roles.test.js`) |
| **ISSUE-05** | Data Integrity | High | `models/User.js`, `models/WorkspaceMembership.js`, `models/Invitation.js` | Unified strictly on single canonical 'counsellor' with auto-normalizing setters | ✅ VERIFIED (`crm_forensic_fixes.test.js`) |
| **ISSUE-06** | Schema Disconnect | Medium | `backend/src/models/FollowUp.js` | Re-pointed `projectId` to `TenantCatalogue`, removed `inventoryId` | ✅ VERIFIED (`crm_forensic_fixes.test.js`) |
| **ISSUE-07** | Security / Auth | Medium | `backend/src/routes/catalogue.js`, `middleware/auth.js` | Mounted `superAdminOnly` guard on `POST /seed-master` | ✅ VERIFIED (`hybrid_catalogue.test.js`) |
| **ISSUE-08** | Business Logic | Medium | `backend/src/controllers/dealController.js` | Synchronized `status: 'converted'`, `admissionDetails`, idempotency | ✅ VERIFIED (`crm_forensic_fixes.test.js`) |
| **ISSUE-09** | Frontend Ledger | Medium | `frontend/src/app/deals/page.js` | Purged fake deal generator, rendered truthful empty state | ✅ VERIFIED (Frontend Next.js Build) |
| **ISSUE-10** | Usability / UI | Low | `frontend/src/app/notifications/page.js` | Added inline `markOneRead` with optimistic state update | ✅ VERIFIED (Frontend Next.js Build) |
| **ISSUE-11** | Operations | Low | `backend/src/utils/cron.js` | Guarded jobs with `isDbReady()` and clean shutdown | ✅ VERIFIED (`crm_forensic_fixes.test.js`) |

---

## Detailed Issue Specifications

### ISSUE-01: Cross-Tenant Catalogue Search Overwrite
- **Category:** Security / Multi-Tenant Isolation
- **Severity:** Critical
- **Confidence:** Confirmed (Live reproduction test executed)
- **Affected Module:** [backend/src/controllers/catalogueController.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/controllers/catalogueController.js#L813-L837) (`getMyCatalogue`)
- **Reproduction Steps:**
  1. Create a private institution under Tenant A with proprietary commission notes.
  2. Log in as Tenant B (different organization/user).
  3. Query `GET /api/catalogue/my-catalogue?search=Bengaluru`.
  4. Tenant B receives Tenant A's private catalogue record.
- **Expected Behavior:** Tenant B should only receive records matching `search` that belong strictly to Tenant B's `companyId` or `tenantId`.
- **Actual Behavior:** The `search` filter assigns `query.$or = [...]`, overwriting `query.$or = [{ companyId }, { tenantId }]`. Tenant filtering is eliminated from the MongoDB query.
- **Root Cause:** Direct mutation of `query.$or` instead of wrapping tenant conditions and search conditions in `$and: [ tenantQuery, searchQuery ]`.
- **Impact:** Complete breach of tenant privacy, exposing proprietary university partnerships, commission percentages, and contact details across competing agencies.
- **Recommended Fix:** Combine tenant criteria and search regex within a `$and` compound query:
  ```javascript
  const tenantFilter = companyId
    ? { $or: [{ companyId }, { tenantId: companyId }, { tenantId: req.user._id }] }
    : { tenantId: req.user._id };
  const query = { $and: [tenantFilter] };
  if (search && search.trim()) {
    query.$and.push({ $or: [ /* search fields */ ] });
  }
  ```
- **Regression Risk:** Low (Strictly narrows results to proper tenant scope).
- **Required Tests:** Cross-tenant search isolation integration test.

---

### ISSUE-02: Multi-User Lead Creation Orphaning & Owner Invisibility
- **Category:** Core Workflow / Workspace Architecture
- **Severity:** High
- **Confidence:** Confirmed (Live reproduction test executed)
- **Affected Module:** [backend/src/controllers/leadsController.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/controllers/leadsController.js#L1029-L1033) (`createLead`)
- **Reproduction Steps:**
  1. Invite a counselor to an Agency Owner's workspace (`counselor.companyId = owner._id`).
  2. Counselor logs in and creates a lead via `POST /api/leads`.
  3. Lead is stored with `companyId = counselor._id` and `workspaceId = undefined`.
  4. Owner logs in and queries `GET /api/leads`.
  5. The query checks `{ companyId: owner._id }` or `{ userId: owner._id }`.
  6. The counselor's lead is completely omitted (`Found: 0`).
- **Expected Behavior:** Leads created by any team member should inherit the workspace's `companyId` and `workspaceId`, remaining visible to the agency owner and assigned team members.
- **Actual Behavior:** `Lead.create` hardcodes `companyId: req.user._id` and omits `workspaceId`. Leads become orphaned in private counselor silos.
- **Root Cause:**
  - `leadsController.js:1031`: `companyId: req.user._id` instead of `req.user.companyId || req.user._id`.
  - Missing `workspaceId: req.workspaceId || req.user.workspaceId` in `Lead.create`.
  - `Lead.js` pre-save hook only queries `Workspace.findOne({ ownerId: this.userId })`, which fails when `userId` is a counselor.
- **Impact:** Agency owners cannot monitor leads entered by their counselors. Broken team collaboration.
- **Recommended Fix:**
  - In `createLead`, set:
    ```javascript
    companyId: req.user.companyId || req.user._id,
    workspaceId: req.workspaceId || req.user.workspaceId || null,
    assignedTo: req.body.assignedTo || req.user._id,
    ```
- **Regression Risk:** Medium (Requires ensuring legacy solo users without companyId continue to function seamlessly).
- **Required Tests:** Team lead creation and multi-role visibility integration test.

---

### ISSUE-03: Duplicate `lostReason` Property Overwrite in Lead Schema
- **Category:** Database Integrity
- **Severity:** High
- **Confidence:** Confirmed (Live inspection & script verification)
- **Affected Module:** [backend/src/models/Lead.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/models/Lead.js#L254-L266) & [backend/src/models/Lead.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/models/Lead.js#L393-L397)
- **Reproduction Steps:**
  1. Inspect `Lead.schema.paths['lostReason'].options`.
  2. Notice `enum` is `undefined`.
- **Expected Behavior:** `lostReason` should enforce the 11-value standard enum for accurate loss analytics.
- **Actual Behavior:** The second declaration at line 393 completely removes the enum validation.
- **Root Cause:** Redundant key declaration in the Mongoose schema literal.
- **Impact:** Arbitrary invalid lost reasons can be saved; lost-reason analytics and charts become inconsistent.
- **Recommended Fix:** Merge the two definitions into a single declaration at line 254 preserving the enum, default, and trim options; remove the duplicate at line 393.
- **Regression Risk:** Low.
- **Required Tests:** Mongoose schema validation unit test.

---

### ISSUE-04: Hardcoded Single-User RBAC in Frontend Auth Helpers
- **Category:** Frontend Security / RBAC
- **Severity:** High
- **Confidence:** Confirmed
- **Affected Module:** [frontend/src/lib/auth.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/frontend/src/lib/auth.js#L47-L67)
- **Reproduction Steps:**
  1. Log in with a user whose role is `counselor` or `agent`.
  2. Inspect `isOwner(user)` in browser console.
  3. Returns `true`. `isAgent()` and `isManager()` return `false`.
- **Expected Behavior:** Frontend role checkers should accurately inspect `user.companyRole`, `user.workspaceRole`, and `user.role`.
- **Actual Behavior:** Any regular user evaluates as an Owner on the frontend.
- **Root Cause:** Legacy stub code explicitly hardcoded `return true;` for `isOwner`.
- **Impact:** Misleading UI states; counselors see owner settings and management buttons, causing confusing errors when backend blocks them.
- **Recommended Fix:** Refactor `isOwner`, `isManager`, and `isAgent` in `frontend/src/lib/auth.js` to inspect `user.role`, `user.companyRole`, and `user.workspaceRole`.
- **Regression Risk:** Low.
- **Required Tests:** Client RBAC helper unit tests.

---

### ISSUE-05: Counselor Enum Spelling Inconsistency (`User` vs `WorkspaceMembership`)
- **Category:** Database Integrity
- **Severity:** High
- **Confidence:** Confirmed
- **Affected Module:** [backend/src/models/User.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/models/User.js#L76) & [backend/src/models/WorkspaceMembership.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/models/WorkspaceMembership.js#L19)
- **Reproduction Steps:**
  1. Attempt to create a `WorkspaceMembership` with `role: 'counselor'`.
  2. Mongoose throws `ValidationError: 'counselor' is not a valid enum value for path 'role'`.
- **Expected Behavior:** Consistent enum values across models.
- **Actual Behavior:** `User.companyRole` uses `'counselor'` (one 'l'), while `WorkspaceMembership.role` uses `'counsellor'` (two 'l's).
- **Recommended Fix:** Unify strictly on a single canonical spelling (`'counsellor'`) across all enums (`WorkspaceMembership`, `User`, `Invitation`), remove confusing dual-enum entries, and employ pre-validation setters to automatically map legacy/variant inputs (`'counselor'`, `'agent'`, `'telecaller'`, `'sales_rep'`) into the canonical representation without ambiguity.
- **Regression Risk:** Low.
- **Required Tests:** Team member invite and role transition integration test.

---

### ISSUE-06: Dead Model References (`Project` & `Inventory`) in `FollowUp` Schema
- **Category:** Database Integrity / Schema Relics
- **Severity:** Medium
- **Confidence:** Confirmed
- **Affected Module:** [backend/src/models/FollowUp.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/models/FollowUp.js#L98-L100)
- **Reproduction Steps:**
  1. Execute `FollowUp.find().populate('siteVisitDetails.projectId')`.
  2. Mongoose throws `MissingSchemaError: Schema hasn't been registered for model "Project"`.
- **Expected Behavior:** References should point to active CRM models (`Catalogue` or `TenantCatalogue`).
- **Actual Behavior:** Points to non-existent real-estate models from an earlier codebase template.
- **Root Cause:** Incomplete cleanup when adapting the CRM from a real estate CRM to an educational consultancy CRM.
- **Impact:** Any query attempting to populate `siteVisitDetails` crashes the request.
- **Recommended Fix:** Change `ref: 'Project'` to `ref: 'TenantCatalogue'` or remove the relic fields.
- **Regression Risk:** Low.
- **Required Tests:** Follow-up population test.

---

### ISSUE-07: Unguarded Master Catalogue Seed Endpoint
- **Category:** Security / Authorization
- **Severity:** Medium
- **Confidence:** Confirmed
- **Affected Module:** [backend/src/routes/catalogue.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/routes/catalogue.js#L31)
- **Reproduction Steps:**
  1. Obtain a JWT token for any standard counselor or client account.
  2. Issue `POST /api/catalogue/seed-master` with body `{"force": true}`.
  3. The request succeeds and rewrites master university records.
- **Expected Behavior:** Only superadmins (`adminOnly`) should be able to execute master database seeding.
- **Actual Behavior:** Any authenticated user can trigger a master seed.
- **Root Cause:** Missing `adminOnly` middleware on route line 31.
- **Impact:** Uncontrolled mutation of platform-wide shared catalogue data.
- **Recommended Fix:** Mount `adminOnly` middleware on `router.post('/seed-master', adminOnly, seedMasterCatalogue)`.
- **Regression Risk:** Low.
- **Required Tests:** Role-guard test for seed endpoint.

---

### ISSUE-08: Admission Deal Lead Status & Field Disconnect
- **Category:** Business Logic / Workflow
- **Severity:** Medium
- **Confidence:** Confirmed
- **Affected Module:** [backend/src/controllers/dealController.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/controllers/dealController.js#L163-L175)
- **Reproduction Steps:**
  1. Create a lead.
  2. Record a confirmed admission deal referencing that lead ID.
  3. Check the lead document in the database.
  4. `lead.status` remains `new_lead` or `follow_up`.
- **Expected Behavior:** Recording a confirmed admission updates `lead.status = 'converted'` or `'admitted'`.
- **Actual Behavior:** `dealController.js` updates `pipeline_stage: 'converted'`, which does not exist in `Lead.js`.
- **Root Cause:** Field name mismatch (`pipeline_stage` vs `status`).
- **Impact:** Deal and pipeline states diverge; converted leads still show as pending in Kanban boards.
- **Recommended Fix:** Update `lead.status = 'converted'` and add proper activity logs in `dealController.js`.
- **Regression Risk:** Low.
- **Required Tests:** Deal conversion lead sync integration test.

---

### ISSUE-09: Fabricated Ledger Fallback Data in Deals Page
- **Category:** Frontend Data Integrity
- **Severity:** Medium
- **Confidence:** Confirmed
- **Affected Module:** [frontend/src/app/deals/page.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/frontend/src/app/deals/page.js#L68-L87)
- **Reproduction Steps:**
  1. Open `/deals` on a fresh tenant account with existing leads but no deals.
  2. Inspect the deals ledger.
- **Expected Behavior:** Display an empty state or real recorded deals.
- **Actual Behavior:** Generates fabricated deals with fake ₹2,50,000 tuition and ₹25,000 token fees for all unconverted leads.
- **Root Cause:** Client-side proxy fallback intended as mockup demonstration code.
- **Impact:** Distorts financial summaries and reports misleading revenue data to users.
- **Recommended Fix:** Remove fake fallback mapping and display a clean Empty State with a "Record First Admission" call to action.
- **Regression Risk:** Low.
- **Required Tests:** Frontend empty state rendering test.

---

### ISSUE-10: Missing Individual Notification Acknowledgment Action in UI
- **Category:** Usability / UI State
- **Severity:** Low
- **Confidence:** Confirmed
- **Affected Module:** [frontend/src/app/notifications/page.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/frontend/src/app/notifications/page.js#L250-L263)
- **Reproduction Steps:**
  1. Open `/notifications` with several unread alerts.
  2. Attempt to mark a single notification as read.
  3. No button or card click action exists.
- **Expected Behavior:** A checkmark button on each card or click-to-mark-read calling `PUT /api/notifications/:id/read`.
- **Actual Behavior:** Only a global "Mark all read" button exists in the header.
- **Root Cause:** Incomplete UI action implementation.
- **Impact:** Cluttered notification lists and poor user control over alert statuses.
- **Recommended Fix:** Add an inline "Mark read" button calling `api.put('/notifications/' + n._id + '/read')`.
- **Regression Risk:** None.
- **Required Tests:** Frontend notification interaction test.

---

### ISSUE-11: Scheduler Database Readiness Guard at Startup
- **Category:** Reliability / Operations
- **Severity:** Low
- **Confidence:** Confirmed
- **Affected Module:** [backend/src/utils/cron.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/utils/cron.js#L107-L111)
- **Reproduction Steps:**
  1. Call `startFollowUpCron()` before MongoDB connection resolves.
  2. Immediate passes `processSubscriptionLifecycle()`, `runTestPrepFeeAlertsCron()`, and `webhookQueueService.processQueueSweep()` execute against disconnected sockets.
- **Expected Behavior:** Schedulers should assert `mongoose.connection.readyState === 1` before querying the database.
- **Actual Behavior:** Fires sweeps unconditionally at module load.
- **Root Cause:** Missing lifecycle connection guard.
- **Impact:** Unhandled rejection notices logged during test runs or cold server restarts.
- **Recommended Fix:** Guard sweeps and intervals with `if (mongoose.connection.readyState !== 1) return;`.
- **Regression Risk:** None.
- **Required Tests:** Disconnected startup test.

