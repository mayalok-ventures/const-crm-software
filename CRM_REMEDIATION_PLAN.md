# Sahyak CRM: Prioritized Remediation Plan (`CRM_REMEDIATION_PLAN.md`)

**Date:** October 24, 2026  
**Status:** Ready for Review (Read-Only Mode Maintained)  

---

## Remediation Strategy Overview

This remediation plan organizes all confirmed defects into four sequential, dependency-ordered phases.  
**Strict Safety Rule:** No changes will be deployed to production and no destructive database operations will be executed until this plan is reviewed and approved.

```
┌────────────────────────────────────────────────────────────────────────┐
│                      REMEDIATION ROADMAP PHASES                        │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE A: Critical Security & Tenant Isolation Fixes (ISSUE-01, 07)     │
│   ➔ Fix $or query overwrite in catalogueController.js                  │
│   ➔ Secure /api/catalogue/seed-master with adminOnly guard             │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE B: Core Lead & Workspace Multi-Tenancy Architecture (ISSUE-02, 05)│
│   ➔ Propagate companyId & workspaceId in leadsController.js            │
│   ➔ Reconcile 'counselor' vs 'counsellor' enum variants across schemas │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE C: Schema Integrity & Cross-Model Sync (ISSUE-03, 06, 08)        │
│   ➔ Merge duplicate lostReason declarations in Lead.js                 │
│   ➔ Align dealController status update to lead.status = 'converted'    │
│   ➔ Clean up legacy Project/Inventory refs in FollowUp.js              │
├────────────────────────────────────────────────────────────────────────┤
│ PHASE D: Frontend RBAC, Data Ledger & Usability (ISSUE-04, 09, 10)     │
│   ➔ Implement dynamic RBAC in frontend/src/lib/auth.js                 │
│   ➔ Remove fake ₹2.5L ledger fallback in deals/page.js                 │
│   ➔ Add single notification 'Mark as Read' button in notifications UI  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Phase A: Critical Security & Tenant Isolation (Priority 1)

### Work Package A.1: Cross-Tenant Catalogue Search Isolation (ISSUE-01)
- **Root Cause:** In [catalogueController.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/controllers/catalogueController.js#L813-L837), `query.$or` is overwritten when `search` is provided, wiping out the tenant filter.
- **Files to Change:**
  - `backend/src/controllers/catalogueController.js`
- **Database Migration:** None required.
- **Data Compatibility & Rollback:**
  - Fully backward compatible. Does not alter stored records.
  - Rollback consists of reverting the query builder in `catalogueController.js`.
- **Implementation Design:**
  ```javascript
  const tenantFilter = companyId
    ? { $or: [{ companyId }, { tenantId: companyId }, { tenantId: req.user._id }] }
    : { tenantId: req.user._id };

  const query = { $and: [tenantFilter] };

  if (country && country !== 'all') query['location.country'] = new RegExp(`^${country.trim()}$`, 'i');
  if (state && state !== 'all') query['location.state'] = new RegExp(state.trim(), 'i');
  if (type && type !== 'all') query.collegeType = type;

  if (search && search.trim()) {
    const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$and.push({
      $or: [
        { customCollegeName: rx },
        { 'location.city': rx },
        { 'location.state': rx },
        { accreditation: rx },
        { 'courses.degreeName': rx },
        { 'courses.specialization': rx },
      ],
    });
  }
  ```
- **Dependencies:** None.
- **Regression Risk:** Low.
- **Acceptance Criteria:**
  - Searching for colleges returns only records owned by the requesting tenant's agency.
  - Zero records from other tenants are returned under any search string.
  - Existing un-searched catalogue queries continue returning all tenant colleges.

---

### Work Package A.2: Guard Master Catalogue Seed Route (ISSUE-07)
- **Root Cause:** In [backend/src/routes/catalogue.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/routes/catalogue.js#L31), `POST /seed-master` lacks role restriction.
- **Files to Change:**
  - `backend/src/routes/catalogue.js`
- **Database Migration:** None.
- **Data Compatibility & Rollback:** Safe. Reversible via route definition change.
- **Implementation Design:**
  - Mount `adminOnly` middleware: `router.post('/seed-master', adminOnly, seedMasterCatalogue);`
- **Dependencies:** None.
- **Regression Risk:** None.
- **Acceptance Criteria:**
  - Non-admin tokens receive `403 Forbidden` when posting to `/api/catalogue/seed-master`.
  - Superadmin accounts retain full authority to seed master universities.

---

## Phase B: Core Lead & Workspace Multi-Tenancy Architecture (Priority 2)

### Work Package B.1: Team Lead Workspace & Ownership Inheritance (ISSUE-02)
- **Root Cause:** [leadsController.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/controllers/leadsController.js#L1029-L1033) hardcodes `companyId: req.user._id` and ignores `workspaceId`, orphaning leads created by counselors.
- **Files to Change:**
  - `backend/src/controllers/leadsController.js`
  - `backend/src/models/Lead.js` (pre-save hook)
- **Database Migration:** Optional backfill script to associate existing orphaned leads with their creator's employer `companyId` and `workspaceId`.
- **Data Compatibility & Rollback:** Backward compatible with solo users (`user.companyId === null`).
- **Implementation Design:**
  1. In `leadsController.createLead`:
     ```javascript
     const effectiveCompanyId = req.user.companyId || (req.user.companyRole === 'owner' ? req.user._id : req.user._id);
     const effectiveWorkspaceId = req.workspaceId || req.user.workspaceId || null;
     const assignedUserId = req.body.assignedTo && mongoose.Types.ObjectId.isValid(req.body.assignedTo)
       ? req.body.assignedTo
       : req.user._id;

     const lead = await Lead.create({
       userId: req.user._id,
       companyId: effectiveCompanyId,
       workspaceId: effectiveWorkspaceId,
       assignedTo: assignedUserId,
       assignedToName: resolvedAssigneeName,
       // ... other fields
     });
     ```
  2. Update `Lead.js` pre-save hook to resolve workspace via `WorkspaceMembership` if `Workspace.findOne({ ownerId: this.userId })` is not found.
- **Dependencies:** None.
- **Regression Risk:** Low to Medium.
- **Acceptance Criteria:**
  - Agency owners immediately see leads created by their counselors in pipeline views.
  - Counselor leads retain correct counselor assignment while belonging to the organization workspace.

---

### Work Package B.2: Role Enum Reconciliation (`counselor` vs `counsellor`) (ISSUE-05)
- **Root Cause:** [User.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/models/User.js#L76) defines `counselor`, whereas [WorkspaceMembership.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/models/WorkspaceMembership.js#L19) defines `counsellor`.
- **Files to Change:**
  - `backend/src/models/WorkspaceMembership.js`
  - `backend/src/models/User.js`
- **Database Migration:** None.
- **Implementation Design:**
  - Add both variants (`'counselor'`, `'counsellor'`) to the allowed `enum` lists of both models with an auto-normalizing setter to avoid validation errors regardless of which spelling is passed.
- **Dependencies:** None.
- **Regression Risk:** None.
- **Acceptance Criteria:**
  - Creating a member with either `'counselor'` or `'counsellor'` succeeds without Mongoose validation failure.

---

## Phase C: Schema Integrity & Cross-Model Sync (Priority 3)

### Work Package C.1: Merge Duplicate `lostReason` Declarations (ISSUE-03)
- **Root Cause:** [Lead.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/models/Lead.js#L254-L266) has an enum definition that is overwritten by line 393.
- **Files to Change:**
  - `backend/src/models/Lead.js`
- **Database Migration:** None.
- **Implementation Design:**
  - Consolidate into a single property:
    ```javascript
    lostReason: {
      type: String,
      enum: [
        'Budget Exceeded',
        'Location / Distance',
        'Preferred Course Unavailable',
        'Opted for Government / Merit Seat',
        'Lost to Direct College',
        'Joined Other Institute',
        'Fake Lead / Not Interested',
        'Dropped Year',
        'Family Decision',
        'Invalid Contact / Unreachable',
        'Other',
        '',
        null,
      ],
      default: '',
      trim: true,
    },
    ```
  - Remove redundant declaration at line 393.
- **Dependencies:** None.
- **Regression Risk:** Low.
- **Acceptance Criteria:**
  - `Lead.schema.paths['lostReason'].options.enum` is defined with all 11 valid loss reasons.

---

### Work Package C.2: Synchronize Admission Deal to Lead Status (ISSUE-08)
- **Root Cause:** [dealController.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/controllers/dealController.js#L163-L175) writes to unmapped fields `pipeline_stage` and `admissionDetails`.
- **Files to Change:**
  - `backend/src/controllers/dealController.js`
- **Database Migration:** None.
- **Implementation Design:**
  - When deal is created, update `lead.status = 'converted'` and add an entry into `leadActivities`:
    ```javascript
    if (leadId) {
      await Lead.findOneAndUpdate(
        { _id: leadId },
        {
          $set: {
            status: 'converted',
            'customData.admittedCollege': collegeName.trim(),
            'customData.admittedCourse': courseName.trim(),
            'customData.admissionDate': new Date().toISOString(),
          },
          $push: {
            leadActivities: {
              action: 'admission_confirmed',
              performerName: req.user.name,
              details: `Admission confirmed for ${courseName} at ${collegeName} (Tuition: ₹${tuition})`,
              timestamp: new Date(),
            },
          },
        }
      );
    }
    ```
- **Dependencies:** Work Package B.1.
- **Regression Risk:** Low.
- **Acceptance Criteria:**
  - Confirming an admission deal automatically transitions the linked lead to the "Converted / Admitted" column in the Kanban board.

---

### Work Package C.3: Clean Up Legacy Relic References in `FollowUp` (ISSUE-06)
- **Root Cause:** [FollowUp.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/models/FollowUp.js#L98-L100) references non-existent models `Project` and `Inventory`.
- **Files to Change:**
  - `backend/src/models/FollowUp.js`
- **Database Migration:** None.
- **Implementation Design:**
  - Update `ref: 'TenantCatalogue'` or `ref: 'Catalogue'`.
- **Dependencies:** None.
- **Regression Risk:** Low.
- **Acceptance Criteria:**
  - Populating follow-up records does not throw `MissingSchemaError`.

---

## Phase D: Frontend RBAC, Ledger Data & Usability (Priority 4)

### Work Package D.1: Dynamic Role Checking in Frontend Auth (ISSUE-04)
- **Root Cause:** [frontend/src/lib/auth.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/frontend/src/lib/auth.js#L47-L67) hardcodes `isOwner() => true` and `isManager() => false`.
- **Files to Change:**
  - `frontend/src/lib/auth.js`
- **Implementation Design:**
  - Inspect `user.companyRole`, `user.workspaceRole`, and `user.role` dynamically:
    ```javascript
    export const isOwner = (user) => {
      if (!user) return false;
      if (user.role === 'superadmin' || user.isAdmin === true) return false;
      return user.companyRole === 'owner' || user.workStatus === 'company_owner' || user.role === 'owner' || user.workspaceRole === 'owner';
    };

    export const isManager = (user) => {
      if (!user) return false;
      return user.companyRole === 'manager' || user.workspaceRole === 'manager';
    };

    export const isAgent = (user) => {
      if (!user) return false;
      return user.companyRole === 'counselor' || user.companyRole === 'counsellor' || user.companyRole === 'agent' || user.workspaceRole === 'counsellor';
    };
    ```
- **Dependencies:** Work Package B.2.
- **Acceptance Criteria:** Counselors no longer evaluate as owners in the UI.

---

### Work Package D.2: Eliminate Fabricated Ledger Data in Deals View (ISSUE-09)
- **Root Cause:** [frontend/src/app/deals/page.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/frontend/src/app/deals/page.js#L68-L87) converts all unconverted leads into fake ₹2.5L deals when no deals exist.
- **Files to Change:**
  - `frontend/src/app/deals/page.js`
- **Implementation Design:**
  - Remove proxy fallback; if `directDeals.length === 0`, set `deals = []` and render a clean empty state with a "Record First Admission" button.
- **Acceptance Criteria:** Zero fabricated financial figures displayed on new accounts.

---

### Work Package D.3: Individual Notification Acknowledgment Action (ISSUE-10)
- **Root Cause:** [frontend/src/app/notifications/page.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/frontend/src/app/notifications/page.js#L250-L263) lacks single mark-read handler.
- **Files to Change:**
  - `frontend/src/app/notifications/page.js`
- **Implementation Design:**
  - Add inline "Mark as read" button on notification cards calling `PUT /api/notifications/:id/read`.
- **Acceptance Criteria:** Users can dismiss individual notifications without clearing all alerts.

---

## Verification & Rollback Protocols

1. **Pre-Implementation Verification:**
   - Execute baseline integration test: `node backend/tests/run_all_integration_tests.js`.
   - Run reproduction suite: `node scratch/reproduce_audit_findings.js`.
2. **Post-Implementation Verification:**
   - Re-run reproduction script to prove all 4 critical/high vulnerabilities resolve to 0 errors.
   - Run full frontend production build: `npm run build` in `/frontend`.
3. **Rollback Plan:**
   - All changes are code-level and non-destructive.
   - Git checkout / revert can restore the previous state in seconds if any regression occurs.
