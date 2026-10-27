# Sahyak CRM: Comprehensive Technical Audit & Forensic Architecture Report

**Audit Date:** October 24, 2026  
**Auditor Role:** Senior Software Architect, Full-Stack Developer, Database Engineer, Security Auditor & QA Lead  
**Audit Target:** Sahyak Multi-Tenant Admission & Sales CRM (`mobile-crm`)  
**Audit Status:** Confirmed Evidence Established | Read-Only Audit Complete  

---

## Executive Summary

A deep, forensic, multi-layered architectural audit was conducted across the frontend, backend API, database schemas, authorization models, and integration pipelines of the Sahyak CRM codebase.

The system builds successfully (`Next.js` 37 routes compile cleanly) and existing mock-based integration test suites report passing statuses. However, **deep code inspection and live deterministic reproduction scripts revealed critical security vulnerabilities, database integrity violations, tenant data leakage, and team workflow breakdowns** that standard tests fail to catch.

### Top Critical & High Risks Identified
1. **CRITICAL SECURITY / TENANT DATA LEAK (`catalogueController.js:813-837`):**  
   In `getMyCatalogue`, when a user passes a `search` query parameter, `query.$or` is reassigned to match the search regex. This completely overwrites the multi-tenant scope (`query.$or = [{ companyId }, { tenantId }]`). Consequently, **any authenticated user typing any search query receives private institution tie-ups, secret commission rates, and confidential MOUs belonging to all other agencies across the platform**.
2. **HIGH / TEAM LEAD ORPHANING & VISIBILITY FAILURE (`leadsController.js:1029-1033` & `Lead.js`):**  
   In `createLead`, `companyId` is hardcoded to `req.user._id`, ignoring `req.user.companyId`. Furthermore, `workspaceId` is not passed to `Lead.create`. When a counselor or staff member creates a student lead, the lead is assigned `companyId = counselorId` and `workspaceId = undefined`. When the agency owner logs in and views their pipeline, **all leads created by their team members are completely invisible (`Found: 0`)**.
3. **HIGH / SCHEMA DEFINITION CORRUPTION (`Lead.js:254` vs `393`):**  
   `lostReason` is declared twice in `Lead.js`. The first declaration specifies an 11-item validated `enum`. The second declaration at line 393 silently overwrites the first, setting `type: String, default: ''` without enum validation, corrupting pipeline integrity and analytics.
4. **HIGH / ROLE-BASED ACCESS CONTROL SHORT-CIRCUIT (`frontend/src/lib/auth.js:47-67`):**  
   Frontend authentication helpers hardcode `isOwner(user) => true` for all non-superadmin users with the comment `// Single-user CRM: No managerial hierarchy`, while `isManager()` and `isAgent()` return `false`. Any staff member, agent, or counselor is evaluated by the client UI as the workspace owner, exposing owner controls in the UI while failing or mismatching backend RBAC.
5. **HIGH / ENUM SPELLING MISMATCH (`User.js:76` vs `WorkspaceMembership.js:19`):**  
   `User.companyRole` defines `'counselor'` (American spelling with one 'l'), while `WorkspaceMembership.role` defines `'counsellor'` (British spelling with two 'l's). This prevents counselor users from being properly associated with workspace memberships without runtime validation errors.
6. **MEDIUM / DATABASE DEAD REFERENCE RELICS (`FollowUp.js:98-100`):**  
   `FollowUp.js` points to `Project` and `Inventory` models (`ref: 'Project'`, `ref: 'Inventory'`). Neither model exists in the database. Any `.populate('siteVisitDetails.projectId')` triggers an unhandled `MissingSchemaError`.
7. **MEDIUM / UNGUARDED ADMINISTRATIVE SEED ROUTE (`backend/src/routes/catalogue.js:31`):**  
   `POST /api/catalogue/seed-master` is mounted with standard `protect` middleware but lacks any role verification (`adminOnly` or `superadmin`). Any counselor or regular client user can call it with `{ force: true }` and reset the platform's master university database.
8. **MEDIUM / DEAL-TO-LEAD STATUS DISCONNECT (`dealController.js:163-175`):**  
   When an admission deal is confirmed, `dealController.js` attempts to update the lead with `{ pipeline_stage: 'converted', 'admissionDetails.college': ... }`. Neither `pipeline_stage` nor `admissionDetails` exist in `Lead.js`, meaning the lead's pipeline status (`lead.status`) remains stuck in its previous stage.

---

## Phase 1: Architecture & System Topology

### Tech Stack Identification
- **Frontend:** Next.js 14 (App Router, React 18, Tailwind CSS, Lucide React icons, Axios, SWR/custom cached get).
- **Backend:** Node.js, Express.js REST API, Mongoose 8.x ODM, JWT Authentication.
- **Database:** MongoDB (Local WiredTiger on port 27017 or remote Atlas via `MONGODB_URI`).
- **Real-Time & Background:** Server-Sent Events (`/api/notifications/stream`), `node-cron` schedulers (`cron.js`).
- **External Integrations:** Meta Graph API (Lead Gen webhooks), Google Ads REST API, Razorpay Web Checkout & Webhooks.

### Multi-Tenancy Architecture
The codebase operates under a hybrid tenancy model:
1. **Legacy Solo Tenancy:** Identified by `companyId: null`, `userId: user._id`.
2. **Agency / Organization Tenancy:** Identified by `companyId: owner_id`, `companyRole: 'owner' | 'manager' | 'counselor'`.
3. **Workspace Model:** Introduced via `Workspace` and `WorkspaceMembership` models, resolved via `resolveWorkspace` middleware on specific routes.

---

## Phase 2: Frontend Audit Findings

### 1. Hardcoded Single-User RBAC Short-Circuit
- **Affected File:** [frontend/src/lib/auth.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/frontend/src/lib/auth.js#L47-L67)
- **Code:**
  ```javascript
  export const isOwner = (user) => {
    if (!user) return false;
    if (user.role === 'superadmin' || user.isAdmin === true) return false;
    // Single-user CRM: No managerial hierarchy
    return true;
  };
  export const isManager = () => false;
  export const isAgent = () => false;
  ```
- **User Impact:** Every user (including counselors and subordinate agents) is treated as an agency owner by the UI. UI elements intended for owners (billing, workspace deletion, inviting agents) are rendered to counselors, resulting in 403 Forbidden errors when submitted to the backend.

### 2. Missing Individual "Mark Read" UI in Notifications Center
- **Affected File:** [frontend/src/app/notifications/page.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/frontend/src/app/notifications/page.js#L35-L45)
- **Problem:** The backend provides `PUT /api/notifications/:id/read`, but the frontend only exposes a global "Mark all read" button. Individual notification cards have no click handler or check button to acknowledge single alerts.
- **User Impact:** Users cannot dismiss or clear individual reminders without wiping their entire alert history.

### 3. Fake Admissions Ledger Fallback Data
- **Affected File:** [frontend/src/app/deals/page.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/frontend/src/app/deals/page.js#L68-L87)
- **Problem:** If no dedicated deals exist in `AdmissionDeal`, the page maps every lead from `/leads` into an admission deal with hardcoded values: `tuitionValue: 250000`, `tokenFeePaid: 25000`, `ratePercent: 10`.
- **User Impact:** A brand-new consultancy dashboard immediately shows inflated, fictitious financial revenue and treats unconverted prospective leads as confirmed/seat-locked deals.

---

## Phase 3: Backend and API Audit Findings

### 1. Unguarded Master Seed Route
- **Affected File:** [backend/src/routes/catalogue.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/routes/catalogue.js#L31)
- **Code:** `router.post('/seed-master', seedMasterCatalogue);`
- **Problem:** Mounted directly under `protect` with no `adminOnly` or `requirePermission` guard.
- **Impact:** Any authenticated user can issue a `POST /api/catalogue/seed-master` with `{ "force": true }` to wipe and overwrite the master university catalogue.

### 2. Disconnect in Admission Deal Lead Updates
- **Affected File:** [backend/src/controllers/dealController.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/controllers/dealController.js#L163-L175)
- **Code:**
  ```javascript
  await Lead.findOneAndUpdate(
    { _id: leadId, workspaceId },
    {
      $set: {
        pipeline_stage: 'converted',
        'admissionDetails.college': collegeName.trim(),
        'admissionDetails.course': courseName.trim(),
        'admissionDetails.admissionDate': new Date(),
      },
    }
  );
  ```
- **Problem:**
  - In `Lead.js`, the pipeline stage field is named `status`, not `pipeline_stage`.
  - `admissionDetails` is not declared in `Lead.js`. Under Mongoose `strict: true`, these fields are stripped.
  - If the lead was created by a counselor, `lead.workspaceId` is `undefined`, so `{ _id: leadId, workspaceId }` matches 0 records.
- **Impact:** Recording an admission deal fails to update the student lead status in the CRM pipeline.

---

## Phase 4: Database Integrity Audit Findings

### 1. Duplicate Schema Property Overwrite in Lead Schema
- **Affected File:** [backend/src/models/Lead.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/models/Lead.js#L254-L266) and [backend/src/models/Lead.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/models/Lead.js#L393-L397)
- **Code:**
  - Line 254:
    ```javascript
    lostReason: {
      type: String,
      enum: ['Budget Exceeded', 'Location / Distance', 'Preferred Course Unavailable', ...],
      default: '',
    }
    ```
  - Line 393:
    ```javascript
    lostReason: {
      type: String,
      default: '',
      trim: true,
    }
    ```
- **Evidence:** Tested live via `reproduce_audit_findings.js`: `Lead.schema.paths['lostReason'].options.enum === undefined`.
- **Impact:** Enum constraints are lost. Any arbitrary string can be inserted, breaking lost-deal reporting.

### 2. Model Reference Disconnect in FollowUp Schema
- **Affected File:** [backend/src/models/FollowUp.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/models/FollowUp.js#L98-L100)
- **Code:**
  ```javascript
  siteVisitDetails: {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    inventoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Inventory', default: null },
  }
  ```
- **Impact:** `Project` and `Inventory` do not exist. Any populate query on `siteVisitDetails.projectId` throws `MissingSchemaError`.

### 3. Enum Spelling Inconsistency Between User and WorkspaceMembership
- **Affected Files:**
  - [backend/src/models/User.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/models/User.js#L76): `companyRole: enum: ['owner', 'solo', 'agent', 'manager', 'counselor', ...]`
  - [backend/src/models/WorkspaceMembership.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/models/WorkspaceMembership.js#L19): `role: enum: ['owner', 'manager', 'counsellor', 'auditor', 'custom']`
- **Impact:** Mismatched enums cause validation errors during team member onboarding.

---

## Phase 5: Security and Multi-Tenant Isolation Audit

### 1. Cross-Tenant Catalogue Data Leak
- **Affected File:** [backend/src/controllers/catalogueController.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/controllers/catalogueController.js#L813-L837)
- **Root Cause:**
  ```javascript
  const query = companyId
    ? { $or: [{ companyId }, { tenantId: companyId }, { tenantId: req.user._id }] }
    : { tenantId: req.user._id };

  if (search && search.trim()) {
    const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [
      { customCollegeName: rx },
      { 'location.city': rx },
      { 'location.state': rx },
      { accreditation: rx },
      { 'courses.degreeName': rx },
      { 'courses.specialization': rx },
    ];
  }
  ```
- **Deterministic Live Evidence:**
  Running `node scratch/reproduce_audit_findings.js`:
  ```text
  --- TEST 1: Cross-Tenant Catalogue Search Query Overwrite ---
  Results returned to Tenant B on searching 'Bengaluru': 2
  🚨 CRITICAL EVIDENCE CONFIRMED: Tenant B received Tenant A private catalogue record!
  Leaked Record ID: 6adc9238ba965080f1f70fad, Name: Confidential University A, Secret Notes: Secret 25% MOU with Dean
  ```
- **Security Impact:** Direct breach of tenant isolation. Private partner universities, negotiated commission rates, and confidential contact information are exposed across agencies.

---

## Phase 6: Performance, Schedulers & Reliability

### Background Schedulers Analysis (`backend/src/utils/cron.js`)
The server runs 5 active cron schedules:
1. Every 1 minute: Follow-up alarms (`cron.schedule('* * * * *')`).
2. Every 1 minute: Webhook Ingestion Queue sweep.
3. Every 15 minutes: Meta Leads Reconciliation.
4. Every 15 minutes: Subscription lifecycle worker.
5. Every 24 hours (09:00 AM): Test Prep Fee Due Date Reminders.

**Reliability Concern:**  
At server startup, `cron.js` calls `processSubscriptionLifecycle()`, `runTestPrepFeeAlertsCron()`, and `webhookQueueService.processQueueSweep()` concurrently without checking database connection readiness. If MongoDB has not finished connecting, unhandled connection errors are logged.

---

## Audit Evidence Log

| Test Suite / Script | Command | Outcome |
| :--- | :--- | :--- |
| Integration Test Suite | `node backend/tests/run_all_integration_tests.js` | 10 Suites Passed (38 integration, 25 observability, 22 security) |
| Frontend Production Build | `npm run build` (in `/frontend`) | 37 Pages Compiled Successfully |
| Live Evidence Reproduction Script | `node scratch/reproduce_audit_findings.js` | **4 Major Defects Confirmed & Replicated** |

---
*Report certified by Principal Auditor & Senior Architect.*
