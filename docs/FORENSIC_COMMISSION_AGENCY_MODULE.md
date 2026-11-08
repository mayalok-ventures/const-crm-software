# Forensic Report: Commission & Agency Module Architecture

**Audit Item**: F5 (Commission & Agency Module Analysis)  
**Author**: Principal Software Architect & QA Lead  
**Branch**: `fix/audit-batch-3`  
**Date**: November 2026  

---

## 1. Executive Summary & Audit Hypothesis Verdict

### Audit Hypothesis:
> *"Commission tracking is completely broken/missing; university tie-up payouts cannot be calculated."*

### Forensic Verdict: **INTENTIONAL PIVOT / DELETED LEGACY BROKER MODULE (PROVEN VIA COMMIT 1228615a)**
Forensic inspection of commit `1228615a07ee30ff8fb409124fb271dceeacdf9a` confirms that the agency broker module was intentionally removed as part of a major architectural pivot:
- **Legacy Files Deleted in `1228615a`**:
  - `backend/src/controllers/agencyController.js` (-1,338 lines)
  - `backend/src/controllers/realEstateController.js` (-2,250 lines)
  - `backend/src/controllers/companyController.js` (-884 lines)
  - `frontend/src/components/admin/modules/CommissionsModule.jsx` (-194 lines)
  - `frontend/src/components/admin/modules/DistributionModule.jsx` (-135 lines)
  - `frontend/src/components/admin/modules/HierarchyModule.jsx` (-179 lines)
- **New Architecture Established**:
  - Pivoted platform from multi-tier real-estate brokerage to an **Admission Consultancy CRM** (`ADMISSION_CRM_REDESIGNED_SPEC.md` [+533 lines], `ADMISSION_CONSULTANTS_CRM_ARCHITECTURE.md` [+254 lines]).
  - Replaced real-estate agent commission MLM distribution with university student admission deals (`backend/src/controllers/dealController.js` [+557 lines], `AdmissionDeal.js`), institutional catalogues (`Catalogue.js`, `catalogueController.js`), and tuition fee installments (`FeeInstallment.js`).

The CRM maintains a complete, production-grade **University Commission & Deal Lifecycle Engine**, while **Internal Multi-tier Real Estate Agent Incentive Rules** were intentionally eliminated during the admission CRM architectural pivot.

---

## 2. Evidence from Codebase Inspection

### A. Implemented & Operational: University Commission Engine

1. **Schema & Ledger (`backend/src/models/AdmissionDeal.js`, lines 77–96)**:
   Each admission deal tracks university commission with full financial lifecycle states:
   ```javascript
   commission: {
     ratePercent: { type: Number, default: 0, min: 0, max: 100 },
     expectedAmount: { type: Number, default: 0, min: 0 },
     invoiceNumber: { type: String, default: '', trim: true },
     invoiceStatus: {
       type: String,
       enum: ['unbilled', 'invoiced', 'overdue', 'paid'],
       default: 'unbilled',
       index: true,
     },
     invoicedAt: { type: Date, default: null },
     receivedAmount: { type: Number, default: 0, min: 0 },
     payoutStatus: {
       type: String,
       enum: ['pending', 'partial', 'paid'],
       default: 'pending',
       index: true,
     },
     settledAt: { type: Date, default: null },
   }
   ```

2. **Aggregation Endpoint (`backend/src/controllers/dealController.js`, lines 396–466)**:
   `GET /api/deals/summary/commission` performs a MongoDB aggregation pipeline strictly scoped to `req.workspaceId`:
   - `totalDeals`
   - `confirmedDeals`
   - `totalTuition`
   - `totalExpectedCommission`
   - `totalReceivedCommission`
   - `outstandingCommission` (`Math.max(0, expected - received)`)
   - Lifecycle breakdown: `unbilledCount`, `invoicedCount`, `paidCount`

3. **Institutional Tie-up Margins (`backend/src/controllers/catalogueController.js`)**:
   Master university catalogue stores `defaultCommissionRate` and `commissionType` (`percentage` / `fixed`), gated behind fine-grained RBAC permission `'catalogue.view_commission'`.

4. **Security & RBAC Enforcement (`backend/src/config/permissions.js`)**:
   - `catalogue.view_commission`: Restricts viewing confidential university margin percentages to directors and managers.
   - `commission.view`: Restricts inspecting university revenue ledger and payouts.
   - `commission.edit`: Restricts creating and settling university commission invoices.
   - Verified across multiple automated test suites (`backend/tests/workspace_rbac_and_isolation.test.js`, lines 327–380).

---

### B. What is Stubbed vs Missing (The Source of the Audit Claim)

1. **Legacy Admin Stubs (`backend/src/controllers/adminController.js`, lines 1796–1808)**:
   ```javascript
   exports.saveCommissionRule = async (req, res) => {
     res.json({ success: true, message: 'Single-user CRM operates without team commission rules.' });
   };
   ```
   *Forensic Finding*: These endpoints were legacy single-user placeholders created prior to the admission CRM redesign. In the multi-tenant admission model, admission revenue is tied to university tie-ups (`AdmissionDeal`), not internal agent MLM/team split tiers.

2. **Decoupled Test Artifacts (`backend/tests/admin_rebuild_acceptance.test.js`)**:
   References to `CommissionRule` and `CommissionPayout` models in `admin_rebuild_acceptance.test.js` were legacy test harnesses from an experimental internal agent tier module that was superseded by `AdmissionDeal`.

---

## 3. Financial Reconciliation & Immutability Assessment

| Capability | Status | Evidence / Implementation |
| :--- | :---: | :--- |
| University Tie-up Margin Tracking | ✅ Operational | `AdmissionDeal.commission.ratePercent` & `Catalogue.commissionRate` |
| Expected vs Realized Commission | ✅ Operational | Aggregated via `GET /api/deals/summary/commission` |
| Invoicing & Settlement Lifecycle | ✅ Operational | `unbilled` -> `invoiced` -> `paid` workflow on deal records |
| Workspace / Tenant Isolation | ✅ Operational | Strict `workspaceId` matching in all queries and aggregations |
| Multi-tier Agent Split Engine | ⚠️ Stubbed | Intentional: agency model tracks gross university commissions |

---

## 4. Architectural Recommendations

1. **Route Clean-up**: Formally deprecate the legacy stub endpoints in `adminController.js` (`getCommissionRules`, `saveCommissionRule`) and redirect client callers to `/api/deals/summary/commission`.
2. **University Invoice Generator**: If formal PDF billing to universities is desired, extend the existing `pdfkit` utility to generate formatted tax invoices from `AdmissionDeal.commission`.
3. **Audit Trail**: Continue leveraging `AuditLog` for all deal status transitions and commission settlements.
