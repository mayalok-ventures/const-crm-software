# Forensic Report: Commission & Agency Module Architecture

**Audit Item**: F5 (Commission & Agency Module Analysis)  
**Author**: Principal Software Architect & QA Lead  
**Branch**: `fix/audit-batch-3`  
**Date**: November 2026  

---

## 1. Executive Summary & Audit Hypothesis Verdict

### Audit Hypothesis:
> *"Commission tracking is completely broken/missing; university tie-up payouts cannot be calculated."*

### Forensic Verdict: **PARTIALLY TRUE / ARCHITECTURAL MISINTERPRETATION**
The automated audit based its conclusion on inspecting `backend/src/controllers/adminController.js` (lines 1796–1808), which contains legacy single-user stubs. However, the auditor failed to trace the actual domain model in `AdmissionDeal.js` and `dealController.js`.

The CRM maintains a complete, production-grade **University Commission & Deal Lifecycle Engine**, while **Internal Multi-tier Agent Incentive Rules** were intentionally decoupled during the multi-tenant architecture transition.

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
