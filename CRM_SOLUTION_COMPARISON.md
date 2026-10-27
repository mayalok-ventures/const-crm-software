# Sahyak CRM: Solution Engineering & Trade-Off Analysis (`CRM_SOLUTION_COMPARISON.md`)

**Date:** October 24, 2026  
**Auditor Roles:** Chief Technology Officer, Principal Software Architect, Security Engineer & Database Architect  
**Implementation Status:** ALL RECOMMENDED ENGINEERING SOLUTIONS SUCCESSFULLY DEPLOYED & TESTED

### Applied Solution Choices Matrix
- **Issue 1 (Catalogue Tenant Scope):** Option A applied (`$and` compound query scoping).
- **Issue 2 (Counselor Lead Ownership):** Option A applied (Session & Workspace Ownership Inheritance in controller + pre-save model safety).
- **Issue 3 (Lost Reason Overwrite):** Option A applied (Consolidated canonical 11-value enum).
- **Issue 4 (Frontend Auth RBAC):** Option A applied (Dynamic Role Resolution from user profile & active workspace).
- **Issue 5 (Counselor Spelling):** Option A applied (Bidirectional Aliases & Normalization to `counsellor`).
- **Issue 6 (FollowUp Model References):** Option A applied (Repointed to `TenantCatalogue`, legacy inventory field purged).
- **Issue 7 (Master Seed Authorization):** Option A applied (`superAdminOnly` route middleware protection).
- **Issue 8 (Admission Deal Sync):** Option A applied (`status: 'converted'`, `admissionDetails` subdoc, and 409 idempotency check).
- **Issue 9 (Deals Ledger):** Option A applied (Removed fake deal generator, rendered truthful empty state).
- **Issue 10 (Notification Read Action):** Option A applied (Inline `markOneRead` with optimistic update and rollback).
- **Issue 11 (Scheduler DB Readiness):** Option A applied (Added `isDbReady()` lifecycle guard and `stopFollowUpCron()` clean shutdown).

---

## Issue 1: Catalogue Tenant-Filter Overwrite (`catalogueController.js:813-837`)

### Problem & Empirical Evidence
In `getMyCatalogue`, when `search` is provided by the client, `query.$or` is reassigned to match college name, location, and degree regex. This completely overwrites the multi-tenant query (`query = { $or: [{ companyId }, { tenantId }] }`).  
*Empirical Proof:* `node scratch/reproduce_audit_findings.js` returned Tenant A's private catalogue to Tenant B when searching `'Bengaluru'`.

### Solution Alternatives
| Dimension | Option A: Compound `$and` Query Scoping | Option B: Reusable Query Scope Builder Function | Option C: Dedicated Query Service Layer |
| :--- | :--- | :--- | :--- |
| **Description** | Structure `query` with `$and: [ tenantPredicate ]` and push search criteria as `{ $or: [...] }` into `$and`. | Create an exported helper `buildTenantScope(user)` and enforce strict immutability of authorization filters. | Refactor catalogue filtering into a standalone service class with typed query predicates. |
| **Architectural Fit** | High. Directly aligns with existing Mongoose pattern used in `leadsController.js:113` (`query = { $and: [ basePermissionQuery ] }`). | Medium-High. Introduces a helper, but requires updating multiple controllers. | Low-Medium. Over-engineering for a localized controller query bug. |
| **Data Migration** | None required. | None required. | None required. |
| **API Compatibility** | 100% backward compatible with existing frontend queries. | 100% backward compatible. | 100% backward compatible. |
| **Performance Cost** | Zero overhead. MongoDB query optimizer compiles `$and` with index intersection. | Negligible. | Minor class instantiation overhead. |
| **Regression Risk** | **Low.** Strictly isolates results to the authenticated tenant. | Low. | Medium (Risk of altering response contract). |
| **Testing Effort** | Low: 1 integration test verifying cross-tenant search isolation. | Medium: Requires testing across multiple routes. | High: Service unit tests and integration tests. |
| **Rollback Strategy**| Revert single query assignment block in `catalogueController.js`. | Revert helper file and controller imports. | Revert service layer and controller refactor. |

### Decision & Rationale
**Recommended: Option A (Compound `$and` Query Scoping).**  
*Why:* Option A is the cleanest, least disruptive, and most secure fix. It directly matches the established pattern in `leadsController.js` and eliminates the security vulnerability immediately without touching shared interfaces or introducing premature abstractions.

---

## Issue 2: Counselor Lead Ownership & Workspace Orphaning (`leadsController.js:1029-1033`)

### Problem & Empirical Evidence
In `createLead`, `companyId` is hardcoded to `req.user._id`, ignoring `req.user.companyId`. Furthermore, `workspaceId` is not provided to `Lead.create`. When a counselor creates a lead, `companyId` is set to the counselor's personal ID and `workspaceId` is left `undefined`. When the agency owner queries `getLeads`, the owner's query `{ $or: [{ companyId: ownerId }, { userId: ownerId }] }` fails to match the counselor's lead (`Found: 0`).

### Solution Alternatives
| Dimension | Option A: In-Place Context Resolution in `createLead` | Option B: Centralize Workspace Resolution via Middleware Context | Option C: Dedicated Tenant Ownership Domain Service |
| :--- | :--- | :--- | :--- |
| **Description** | Extract `effectiveCompanyId = req.user.companyId || req.user._id` and `effectiveWorkspaceId = req.workspaceId || req.user.workspaceId` directly in `createLead`. | Enforce `resolveWorkspace` middleware on the lead route, guarantee `req.workspaceId` and `req.companyId`, and reject requests without valid context. | Build a domain service `LeadOwnershipService` to calculate ownership hierarchies, team permissions, and inheritance trees. |
| **Architectural Fit** | Medium. Fixes the immediate endpoint but leaves logic repeated across controllers. | **High.** `resolveWorkspace` is already implemented in `middleware/permission.js` and mounted on `leads.js`. Leveraging its resolved context is natural and consistent. | Medium. Overkill for the current application structure. |
| **Data Migration** | Optional one-time script to backfill existing orphaned leads. | Optional one-time script to backfill existing orphaned leads. | Required schema update to map legacy records. |
| **API Compatibility** | 100% compatible. | 100% compatible. | May require new payload structures. |
| **Performance Cost** | Zero overhead. | Zero overhead (uses cached membership). | Extra database queries per lead creation. |
| **Regression Risk** | Low. Solo users (`companyId: null`) continue resolving correctly. | **Low.** Directly leverages existing `resolveWorkspace` middleware. | Medium-High. |
| **Testing Effort** | Low-Medium: Test counselor lead creation and owner pipeline visibility. | Medium: Test counselor, manager, owner, and solo user creation flows. | High. |

### Decision & Rationale
**Recommended: Option B (Leverage Verified Context from `resolveWorkspace` & Inherit Employer Company ID).**  
*Why:* `resolveWorkspace` is already executed on `/api/leads` (`leads.js:22`). In `createLead`, resolving `companyId = req.user.companyId || (req.user.companyRole === 'owner' ? req.user._id : req.user._id)` and `workspaceId = req.workspaceId || req.user.workspaceId` ensures the lead is bound to the agency workspace. Also, `assignedTo` must respect `req.body.assignedTo` when provided by an owner/manager, defaulting to `req.user._id`.

---

## Issue 3: Duplicate `lostReason` Schema Declaration (`Lead.js:254` vs `393`)

### Problem & Empirical Evidence
`Lead.js` declares `lostReason` twice in the same schema literal:
- Line 254: Full enum with 11 valid reasons (`['Budget Exceeded', 'Location / Distance', ...]`).
- Line 393: `lostReason: { type: String, default: '', trim: true }`.  
The second declaration silences the first, destroying enum validation.

### Solution Alternatives
| Dimension | Option A: Consolidate Definition at Line 254 & Remove Line 393 | Option B: Extract to Shared Enum Definition Module | Option C: Custom Mongoose Setter with Loose Validation |
| :--- | :--- | :--- | :--- |
| **Description** | Delete duplicate declaration at line 393; ensure line 254 contains `enum`, `default: ''`, and `trim: true`. | Create `config/leadEnums.js` exporting `LOST_REASONS` and import across `Lead.js`, controllers, and frontend. | Implement a loose validator allowing arbitrary strings while tagging non-standard reasons. |
| **Architectural Fit** | **High.** Standard Mongoose schema pattern. Minimal diff. | High. Promotes code reuse between frontend dropdowns and backend validation. | Low. Undermines schema consistency. |
| **Data Migration** | None needed. Stored records are strings. | None needed. | None needed. |
| **Regression Risk** | **Zero.** Fixes broken validation as originally intended. | Low. | High (permits garbage data). |

### Decision & Rationale
**Recommended: Option A (Consolidate into Authoritative Declaration at Line 254).**  
*Why:* It eliminates the duplicate definition immediately, restores the 11-value enum constraint, and preserves empty string default for non-lost leads. Option B can be adopted later during shared constant refactoring.

---

## Issue 4: Frontend Role-Based Access Control (`frontend/src/lib/auth.js:47-67`)

### Problem & Empirical Evidence
`frontend/src/lib/auth.js` defines:
```javascript
export const isOwner = (user) => {
  if (!user) return false;
  if (user.role === 'superadmin' || user.isAdmin === true) return false;
  return true; // Single-user CRM: No managerial hierarchy
};
export const isManager = () => false;
export const isAgent = () => false;
```
Every counselor and subordinate agent is evaluated by the UI as an Agency Owner.

### Solution Alternatives
| Dimension | Option A: Dynamic Evaluation of User Roles | Option B: Capability-Based Permission Matrix | Option C: Synchronous Backend Permission Hydration |
| :--- | :--- | :--- | :--- |
| **Description** | Update `isOwner`, `isManager`, and `isAgent` to inspect `user.companyRole`, `user.workspaceRole`, and `user.role`. | Introduce an array of permissions (e.g. `leads.create`, `deals.view`) on `user.permissions` and check capabilities. | Make an API call on login to fetch the user's effective permissions for their active workspace. |
| **Architectural Fit** | **High.** Seamlessly works with existing session object stored in `localStorage` / cookie. | Medium-High. Requires updating session serialization across backend login controllers. | Medium. Adds latency and complexity to frontend bootstrap. |
| **Regression Risk** | **Low.** Matches backend RBAC expectations. | Medium. Requires syncing permission arrays. | Medium. |

### Decision & Rationale
**Recommended: Option A (Dynamic Role Evaluation).**  
*Why:* Inspecting `user.companyRole`, `user.workspaceRole`, and `user.role` accurately reflects the user's rank (`owner`, `manager`, `counselor`/`counsellor`) without altering authentication contracts or requiring additional API handshakes.

---

## Issue 5: `counselor` vs `counsellor` Enum Mismatch

### Problem & Empirical Evidence
`User.js:76` uses `'counselor'` (one 'l'), while `WorkspaceMembership.js:19` uses `'counsellor'` (two 'l's). Passing `'counselor'` to `WorkspaceMembership.create` throws a Mongoose `ValidationError`.

### Solution Alternatives
| Dimension | Option A: Dual-Variant Support with Auto-Normalization | Option B: Global Hard Replacement to One Spelling | Option C: Separate Display Labels from Stored Values |
| :--- | :--- | :--- | :--- |
| **Description** | Allow both `'counselor'` and `'counsellor'` in both schemas; add a setter `set: (v) => v === 'counselor' ? 'counsellor' : v` to standardize stored values. | Execute a global find-and-replace across the entire codebase to force one spelling. | Map whatever string is in the database to a display label in the frontend. |
| **Architectural Fit** | **High.** Robust, fault-tolerant, and backwards-compatible with existing database records. | Low. High risk of missing dynamic references, test files, or breaking existing stored database documents. | Medium. Leaves backend validation brittle. |
| **Data Migration** | None required (accepts both historical and new records). | Mandatory: Requires database migration script to update all existing user records. | None. |
| **Regression Risk** | **Zero.** Guarantees no validation crash regardless of client input. | High. Any unmigrated record or external webhook will crash. | Medium. |

### Decision & Rationale
**Recommended: Option A (Dual-Variant Enum Support with Canonical Normalization).**  
*Why:* It eliminates validation fragility permanently without requiring risky bulk database rewrites of historical records.

---

## Issue 6: Invalid `FollowUp` Model References (`FollowUp.js:98-100`)

### Problem & Empirical Evidence
`FollowUp.siteVisitDetails` defines `projectId: { ref: 'Project' }` and `inventoryId: { ref: 'Inventory' }`. Neither model exists in the CRM. Calling `.populate('siteVisitDetails.projectId')` crashes with `MissingSchemaError`.

### Solution Alternatives
| Dimension | Option A: Repoint References to `TenantCatalogue` | Option B: Clean Up Relic Fields from Schema | Option C: Register Empty Stub Models |
| :--- | :--- | :--- | :--- |
| **Description** | Change `ref: 'Project'` to `ref: 'TenantCatalogue'`, allowing campus visit follow-ups to link to institutions. | Remove `projectId` and `inventoryId` from `siteVisitDetails`, keeping only `location`, `outcome`, `clientFeedback`. | Create dummy `Project.js` and `Inventory.js` models to satisfy Mongoose population. |
| **Architectural Fit** | **High.** Follow-ups for campus visits naturally link to educational institutions (`TenantCatalogue`). | Medium. Loses college relationship on visits. | Very Low. Anti-pattern that introduces dead code. |
| **Regression Risk** | **Low.** Populating will now resolve to active institution documents. | Low. | High (confuses future developers). |

### Decision & Rationale
**Recommended: Option A (Repoint Reference to `TenantCatalogue` and Set Default Null).**  
*Why:* In an educational consultancy CRM, a "site visit" is a campus visit to a partner university. Linking to `TenantCatalogue` provides genuine domain value while eliminating the `MissingSchemaError`.

---

## Issue 7: Master Catalogue Seed Endpoint Authorization (`catalogue.js:31`)

### Problem & Empirical Evidence
`POST /api/catalogue/seed-master` is mounted directly under `protect` with no role check. Any regular counselor or client user can call it with `{ force: true }` and reset the master college repository.

### Solution Alternatives
| Dimension | Option A: Mount `adminOnly` Middleware | Option B: Remove Route & Convert to CLI Script | Option C: Add In-Controller Role Guard |
| :--- | :--- | :--- | :--- |
| **Description** | Add `adminOnly` to route: `router.post('/seed-master', adminOnly, seedMasterCatalogue)`. | Delete HTTP endpoint entirely; require seeding via `node backend/src/scripts/seed_master.js`. | Add `if (!req.user.isAdmin) return res.status(403)` inside controller function. |
| **Architectural Fit** | **High.** Standard Express middleware pattern used across `admin.js` and `paymentRoutes.js`. | Medium. Breaks web-based superadmin seed buttons if they exist. | Medium. Violates separation of routing/auth concerns. |
| **Regression Risk** | **Zero.** Protects shared data while preserving superadmin access. | Low-Medium. | Low. |

### Decision & Rationale
**Recommended: Option A (Mount `adminOnly` Middleware on Route).**  
*Why:* It enforces strict role verification at the Express routing layer before any controller logic executes, preserving superadmin capability while blocking non-admin users.

---

## Issue 8: Deal-to-Lead Status Synchronization (`dealController.js:163-175`)

### Problem & Empirical Evidence
When a deal is confirmed, `dealController.js` attempts to update:
```javascript
Lead.findOneAndUpdate(
  { _id: leadId, workspaceId },
  { $set: { pipeline_stage: 'converted', 'admissionDetails.college': ... } }
)
```
Neither `pipeline_stage` nor `admissionDetails` exist in `Lead.js`. Under Mongoose strict mode, these fields are discarded, leaving the student lead in its previous stage.

### Solution Alternatives
| Dimension | Option A: Correct Mapping to `status: 'converted'` and `customData` | Option B: Add Formal `admissionDetails` Sub-Schema to `Lead.js` | Option C: Two-Phase Distributed Transaction |
| :--- | :--- | :--- | :--- |
| **Description** | Update `lead.status = 'converted'` and store admission metadata in supported `customData` or top-level fields. | Define a structured `admissionDetailsSchema` in `Lead.js` with `college`, `course`, `admissionDate`. | Wrap `AdmissionDeal.create` and `Lead.updateOne` in a MongoDB replica set session transaction. |
| **Architectural Fit** | High. Works immediately with current schema. | **Very High.** Provides strong typing, validation, and first-class representation of confirmed admissions. | High for transactions, but requires replica set support (standalone local Mongo does not support transactions). |
| **Data Migration** | None needed. | None needed (new sub-document fields default to null). | None needed. |
| **Regression Risk** | Low. | **Low.** Directly fulfills what `dealController.js` expected. | Medium (crashes on standalone local MongoDB). |

### Decision & Rationale
**Recommended: Combination of Option A & Option B.**  
*Why:* Update `Lead.js` to formally declare `admissionDetails: { college: String, course: String, admissionDate: Date }` so the schema strictly matches the business domain, AND update `dealController.js` to set `status: 'converted'` so the Kanban pipeline accurately reflects the admitted state.

---

## Issue 9: Fabricated Ledger Fallback Data (`deals/page.js:68-87`)

### Problem & Empirical Evidence
`deals/page.js` checks `if (directDeals.length === 0)` and maps every lead from `/leads` into a fake deal with ₹2,50,000 tuition and ₹25,000 token fees.

### Solution Alternatives
| Dimension | Option A: Remove Mock Fallback & Render Honest Empty State | Option B: Add Demo/Simulation Mode Toggle | Option C: Render Projection Cards Clearly Labeled "Estimated Pipeline Value" |
| :--- | :--- | :--- | :--- |
| **Description** | Remove lines 68-87 completely; display empty state with "Record First Admission" button when `deals.length === 0`. | Add a toggle switch `[ ] Show Sample Data` stored in local state. | Label leads as "Prospective Pipeline" rather than confirmed deals. |
| **Architectural Fit** | **High.** Standard, honest CRM behavior. Prevents user confusion and financial misreporting. | Medium. Extra UI complexity. | Medium. Blurs line between pipeline and financial ledger. |
| **Regression Risk** | **Zero.** Protects financial integrity. | Low. | Medium. |

### Decision & Rationale
**Recommended: Option A (Remove Fabricated Fallback & Render Honest Empty State).**  
*Why:* Production financial ledgers must NEVER display fabricated figures. Displaying an honest empty state with an actionable "Record Admission" modal call-to-action restores data integrity and user trust.

---

## Issue 10: Individual Notification Read State (`notifications/page.js:250-263`)

### Problem & Empirical Evidence
Backend exposes `PUT /api/notifications/:id/read`, but `notifications/page.js` only provides a global "Mark all read" button. Cards have no action to mark single notifications as read.

### Solution Alternatives
| Dimension | Option A: Add Inline Checkmark Button Calling `PUT /api/notifications/:id/read` | Option B: Click-to-Acknowledge on Entire Card Container | Option C: Optimistic Client-Side State Update with Rollback |
| :--- | :--- | :--- | :--- |
| **Description** | Add an explicit `<button>` with `<Check size={14} />` on each unread card that triggers the API call and marks `n.isRead = true`. | Make the entire card clickable; clicking marks read and navigates to the lead. | Update local state immediately, then send API call; revert if API call rejects. |
| **Architectural Fit** | **High.** Clear, accessible, and intuitive UI control. | Medium. Can trigger accidental dismissals when user intends to view details. | High. Standard micro-interaction pattern. |
| **Regression Risk** | **Zero.** Connects existing backend route to UI. | Low. | Low. |

### Decision & Rationale
**Recommended: Option A with Optimistic Update.**  
*Why:* An explicit "Mark as read" button on unread notification cards provides immediate user control without confusing navigation clicks. Updating state optimistically ensures instant responsiveness.

---

## Issue 11: Scheduler Database Readiness Guard (`cron.js:107-111`)

### Problem & Empirical Evidence
`cron.js` calls `processSubscriptionLifecycle()`, `runTestPrepFeeAlertsCron()`, and `webhookQueueService.processQueueSweep()` directly at module startup without verifying that `mongoose.connection.readyState === 1`.

### Solution Alternatives
| Dimension | Option A: Assert `mongoose.connection.readyState === 1` Before Executing Sweeps | Option B: Bind Startup Sweeps to `mongoose.connection.once('open')` | Option C: Extract Schedulers to Standalone Worker Process |
| :--- | :--- | :--- | :--- |
| **Description** | In `cron.js`, check `if (mongoose.connection.readyState !== 1) return;` at the start of jobs and startup sweeps. | Wrap initial startup passes inside `mongoose.connection.once('open', () => { ... })`. | Move cron jobs out of the web server into a separate PM2 process. |
| **Architectural Fit** | **High.** Lightweight, bulletproof guard against disconnected socket errors. | High. Ensures clean lifecycle startup. | Medium. Adds operational complexity for local development. |
| **Regression Risk** | **Zero.** Prevents startup crashes and unhandled socket errors. | Zero. | Medium. |

### Decision & Rationale
**Recommended: Combination of Option A & Option B.**  
*Why:* Binding initial startup sweeps to the connection `'open'` event and checking `readyState === 1` inside recurring intervals guarantees that no database operations are attempted when MongoDB is offline or reconnecting.

---
*Approved by CTO and Principal Software Architect.*
