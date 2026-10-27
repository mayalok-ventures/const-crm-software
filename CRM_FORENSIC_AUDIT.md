# Sahyak CRM: Comprehensive Forensic System Audit & Architectural Reconstruction

**Date of Audit:** 

While the frontend compiles cleanly across all 37 static and dynamic Next.js routes and existing mock-based integration suites pass, **empirical reproduction scripts and AST code audits confirmed critical vulnerabilities, broken business invariants, and tenant isolation breaches**.

### Critical Threat Matrix
| Vulnerability / Defect | Severity | Category | Impact |
| :--- | :--- | :--- | :--- |
| **Cross-Tenant Catalogue Overwrite** (`catalogueController.js:813-837`) | **CRITICAL** | Security / Tenant Isolation | Any tenant searching for colleges receives private institution tie-ups, secret commission percentages, and confidential MOUs belonging to all other agencies across the platform. |
| **Team Lead Orphaning & Owner InvisibOctober 24, 2026  
**Auditor Roles:** Chief Technology Officer, CEO / Business Risk Owner, Principal Software Architect, Security Engineer, Database Architect & QA Lead  
**Audit Target:** Sahyak Multi-Tenant Admission & Educational Consultancy CRM (`mobile-crm`)  
**Repository State:** Commit `459bad8` on branch `main`  
**Execution Environment:** Windows x64, Node.js v24.19.0, Next.js 14, Express 4.x, MongoDB 7.x (WiredTiger)  
**Audit Scope & Methodology:** Read-only empirical inspection, AST analysis, end-to-end data tracing, and isolated live reproduction tests.  

---

## 1. Executive Risk Summary

A deep architectural and security audit was conducted across the Sahyak CRM codebase. The audit evaluated whether the platform is functionally correct, secure against cross-tenant attacks, financially accurate, and structurally reliable.ility** (`leadsController.js:1029-1033`) | **HIGH** | Core Business Logic / RBAC | Leads created by counselors are assigned `companyId = counselorId` and `workspaceId = undefined`. Agency owners cannot see leads created by their own counselors (`Found: 0`). |
| **Duplicate Schema Overwrite** (`Lead.js:254` vs `393`) | **HIGH** | Database Integrity | Duplicate declaration of `lostReason` completely erases the 11-value validated enum, permitting arbitrary strings and invalidating pipeline reporting. |
| **Single-User Hardcoding in Frontend RBAC** (`frontend/src/lib/auth.js:47-67`) | **HIGH** | Frontend Authorization | `isOwner()` returns `true` for all non-superadmin users, while `isManager()` and `isAgent()` return `false`. Every counselor and agent is evaluated as an Owner on the frontend. |
| **Spelling Inconsistency in Role Enums** (`User.js` vs `WorkspaceMembership.js`) | **HIGH** | Data Integrity / Schema | `User.companyRole` defines `'counselor'` (one 'l'), while `WorkspaceMembership.role` defines `'counsellor'` (two 'l's), triggering validation exceptions on member operations. |
| **Dead Model References in FollowUp** (`FollowUp.js:98-100`) | **MEDIUM** | Schema Disconnect | `siteVisitDetails` references non-existent models `'Project'` and `'Inventory'`, throwing `MissingSchemaError` on population. |
| **Unguarded Master Seed Endpoint** (`catalogue.js:31`) | **MEDIUM** | Security / Access Control | `POST /api/catalogue/seed-master` is mounted without `adminOnly` protection; any client user can overwrite the master university database. |
| **Deal-to-Lead Status Disconnect** (`dealController.js:163-175`) | **MEDIUM** | Workflow Integrity | Confirmed admission deals update non-existent fields `pipeline_stage` and `admissionDetails`, leaving `lead.status` stuck in previous stages. |
| **Fabricated Ledger Fallback Data** (`deals/page.js:68-87`) | **MEDIUM** | Financial Data Integrity | Unconverted leads are artificially rendered as confirmed deals with fabricated ₹2.5L tuition and ₹25K token fees when zero deals exist. |
| **Missing Individual Notification Action** (`notifications/page.js:250-263`) | **LOW** | Usability / UI State | UI lacks an individual "Mark as Read" action despite the backend supporting `PUT /api/notifications/:id/read`. |
| **Unchecked Database Readiness in Schedulers** (`cron.js:107-111`) | **LOW** | Reliability / Startup Order | Initial worker sweeps trigger immediately at startup without asserting `mongoose.connection.readyState === 1`. |

---

## 2. Phase 0: Baseline & Working-Tree State

Prior to conducting any analysis, the working tree and repository environment were captured:
- **Repository Root:** `c:\Users\Hi\OneDrive\Documents\crm\mobile-crm`
- **Active Git Branch:** `main`
- **Head Commit:** `459bad8edb3e6314502bce517f4f35c15088894e` (*"fix(superadmin): fix plan archive route not found and add permanent delete option"*)
- **Working Tree Status:** 
  - Significant architectural transition underway: legacy real estate and agency models (`Booking.js`, `Inventory.js`, `Project.js`, `EOI.js`) deleted from the working tree in favor of the admission consultancy model (`AdmissionDeal.js`, `TenantCatalogue.js`, `Workspace.js`, `WorkspaceMembership.js`).
  - Active background process: `npm run dev` running development server (`http://localhost:3000`, `http://localhost:5000`, MongoDB `127.0.0.1:27017`).
- **Baseline Integration Test Run:**
  - Command: `node backend/tests/run_all_integration_tests.js`
  - Output: 10 test suites passed (38 integration, 25 observability, 22 security, 13 health engine).
  - *Critical Discovery:* Existing tests pass because they do not exercise the specific multi-tenant search overwrite or counselor team lead creation paths.

---

## 3. Phase 1: Application Architecture & End-to-End Tracing

### 3.1 Tech Stack Reality
- **Frontend:** Next.js 14.2.x (React 18, App Router, Vanilla Tailwind CSS, Lucide React, Axios client with custom in-memory caching and request deduplication).
- **Backend:** Node.js (v24), Express 4.x REST API, Mongoose 8.x ODM, JWT Bearer Token Auth, Server-Sent Events (SSE).
- **Database:** MongoDB with WiredTiger storage engine.
- **External Integrations:** Meta Graph API (Lead Gen webhooks), Google Ads REST API, Google Sheets API, Razorpay Web Checkout & Webhooks.
- **Background Tasks:** `node-cron` running 5 recurring jobs inside the backend Node process.

### 3.2 End-to-End Workflow Tracing

#### Workflow 1: Lead Ingestion & Creation
```
[User Form / Webhook] 
       │
       ▼
[leadsController.createLead / leadIngestionService.ingest]
       │
       ├── Auth & Scoping: req.user resolved via protect middleware
       │     🚨 FLAW: companyId hardcoded to req.user._id; workspaceId omitted.
       │
       ├── Mongoose Validation: Lead.js
       │     🚨 FLAW: lostReason enum validation overwritten by duplicate definition.
       │
       ├── Pre-Save Hook: Attempts Workspace.findOne({ ownerId: this.userId })
       │     🚨 FLAW: Fails for counselors/agents, leaving workspaceId = undefined.
       │
       ▼
[Database Persistence] ➔ Lead record orphaned from Agency Owner view.
```

#### Workflow 2: Catalogue Search & Multi-Tenancy Scoping
```
[Client UI /catalogue]
       │
       ▼
[GET /api/catalogue/my-catalogue?search=Engineering]
       │
       ├── Auth: req.user authenticated via protect
       ├── Controller: catalogueController.getMyCatalogue
       │     Step 1: Sets query = { $or: [{ companyId }, { tenantId }] }
       │     Step 2: If (search) query.$or = [ { customCollegeName: rx }, ... ]
       │     🚨 CRITICAL FLAW: Step 2 completely wipes out Step 1!
       │
       ▼
[TenantCatalogue.find(query)] ➔ Scans ALL tenant records across database!
```

#### Workflow 3: Admission Deal Conversion & Financial Ledger
```
[User records confirmed admission deal via POST /api/deals]
       │
       ▼
[dealController.createDeal]
       │
       ├── Creates AdmissionDeal document with calculated commission
       │
       ├── Attempts to update Lead:
       │     Lead.findOneAndUpdate({ _id: leadId, workspaceId }, {
       │       $set: { pipeline_stage: 'converted', 'admissionDetails.college': ... }
       │     })
       │     🚨 FLAW: pipeline_stage and admissionDetails do NOT exist in Lead schema.
       │     🚨 FLAW: workspaceId mismatch prevents record match.
       │
       ▼
[Result] ➔ Deal created, but original student Lead remains unconverted in pipeline.
```

---

## 4. Phase 2: Systematic Forensic Audit Findings

### A. Security & Multi-Tenant Isolation
1. **Cross-Tenant Catalogue Breach (`catalogueController.js:813-837`):**
   - The query object replaces its tenant-scoping `$or` array with an unconstrained field search array.
   - Tested live: Tenant B searched `'Bengaluru'` and received private records belonging to Tenant A containing confidential fee structures and MOU notes.
2. **Missing Workspace Scoping on Sensitive Routes:**
   - While `leads.js`, `pipelineRoutes.js`, and `dealRoutes.js` enforce `resolveWorkspace`, routes like `catalogue.js`, `campaigns.js`, `analytics.js`, `whatsapp.js`, and `templates.js` do not mount `resolveWorkspace`.
   - Users without verified workspace membership can interact with catalogue endpoints if authenticated.
3. **Privilege Escalation on Master Seed Route (`catalogue.js:31`):**
   - `POST /api/catalogue/seed-master` lacks role restriction (`adminOnly`). Any authenticated user can trigger a master college database reset.

### B. Business Logic & Workflow Integrity
1. **Team Lead Visibility Failure (`leadsController.js:1029-1033`):**
   - `createLead` sets `companyId: req.user._id`, ignoring `req.user.companyId`.
   - When counselor `C` (employed by owner `O`) creates a lead, `lead.companyId` is set to `C._id` instead of `O._id`.
   - The owner's query `{ $or: [{ companyId: O._id }, { userId: O._id }] }` finds 0 records.
2. **Deal-to-Lead Status Disconnect (`dealController.js:163-175`):**
   - The deal creation controller attempts to update `pipeline_stage: 'converted'`, but `Lead.js` uses `status`. Because Mongoose operates in strict mode by default, undeclared fields are silently ignored.
3. **Duplicate Webhook Submissions Handled Safely:**
   - `leadIngestionService.js` incorporates idempotency checking on `externalLeadId` and unique compound indexing on `inquiries.externalLeadId`. This was verified as working correctly.

### C. Database & Data Integrity
1. **Duplicate `lostReason` Definition (`Lead.js:254` & `393`):**
   - Object literal key collision causes JavaScript engine to silently discard the first property.
   - Live inspection confirmed `Lead.schema.paths['lostReason'].options.enum === undefined`.
2. **Dead Model References in `FollowUp.js` (`FollowUp.js:98-100`):**
   - `siteVisitDetails.projectId` references `'Project'`, and `inventoryId` references `'Inventory'`.
   - Neither model exists in the codebase. Any query invoking `.populate('siteVisitDetails.projectId')` throws an unhandled `MissingSchemaError`.
3. **Spelling Inconsistency in Role Enums:**
   - `User.js:76`: `companyRole: ['owner', 'solo', 'agent', 'manager', 'counselor', ...]`
   - `WorkspaceMembership.js:19`: `role: ['owner', 'manager', 'counsellor', 'auditor', 'custom']`
   - Inviting a team member as a `counselor` crashes with validation errors on `WorkspaceMembership`.

### D. Frontend Completeness & Usability
1. **Single-User RBAC Short-Circuit (`frontend/src/lib/auth.js:47-67`):**
   - `isOwner(user)` unconditionally returns `true` for all non-superadmin users.
   - `isManager()` and `isAgent()` return `false`.
   - The UI displays administrative buttons to counselors, which subsequently fail with 403 Forbidden errors when submitted to the backend.
2. **Fabricated Ledger Fallback Data (`deals/page.js:68-87`):**
   - When no deals exist in `AdmissionDeal`, the page transforms all unconverted leads into fake deals with ₹2,50,000 tuition and ₹25,000 token fees.
   - This violates financial integrity principles by displaying false revenue figures.
3. **Missing Individual Notification Action (`notifications/page.js:250-263`):**
   - While the backend exposes `PUT /api/notifications/:id/read`, the frontend only exposes a global "Mark all read" button. Cards have no action to mark single notifications as read.

### E. Background Schedulers & Reliability
1. **Unchecked MongoDB Readiness in `cron.js`:**
   - Background tasks execute at startup before asserting `mongoose.connection.readyState === 1`.
   - While `server.js` awaits `connectDB()`, external test suites or standalone workers importing `cron.js` risk executing queries against disconnected sockets.

---

## 5. Audit Limitations & Scope Verification

1. **Production Data Access:** The audit was conducted in the local development environment (`mongodb://127.0.0.1:27017/mobile-crm`). Live production MongoDB Atlas clusters were not queried or altered.
2. **External Third-Party APIs:** Meta Graph API, Google Ads, and Razorpay production webhook dispatches were evaluated via sandbox and unit mocks to prevent incurring external charges or sending unauthorized test transmissions.
3. **Hardware & Deployment Boundaries:** Load tests were executed on local x64 hardware; multi-region cluster latency under AWS EC2 / PM2 was evaluated via configuration review rather than live traffic injection.

---
*Certified by CTO, Principal Architect, and Security Lead.*
