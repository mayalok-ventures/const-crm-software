# Sahyak CRM — Canonical Permission Matrix & RBAC Blueprint

**Document Version:** 2.0.0  
**Status:** Authoritative / Canonical  
**Classification:** Application Security Architecture & RBAC Specification  
**System:** Sahyak CRM Multi-Tenant Educational SaaS  

---

## 1. Executive Summary & Core Security Guarantees

Sahyak CRM operates on a zero-trust, fail-closed Role-Based Access Control (RBAC) architecture with hierarchical multi-tenant isolation. Every user request, whether traversing the REST API, executing database queries, or rendering UI components in the browser, is governed by a unified security framework.

### The Five Core Guarantees:

1. **NO PERMISSION, NO UI (DOM Omission):**
   Unauthorized navigation links, buttons, modal triggers, batch actions, and sensitive data fields are strictly omitted from the Document Object Model (DOM). Client-side styling hacks (such as CSS `display: none` or disabled HTML buttons) are explicitly forbidden as a sole line of defense. If a user lacks the requisite permission, the element is not rendered.

2. **END-TO-END CONFIGURATION-TO-EXECUTION FIDELITY:**
   The permission configuration defined in `backend/src/config/permissions.js` perfectly matches the evaluation logic in `backend/src/middleware/permission.js`, the query filtering in Mongoose database models, and the frontend permission evaluator in `frontend/src/lib/auth.js`.

3. **STRICT ADMINISTRATIVE BOUNDARIES (Anti-Privilege Escalation):**
   Managers, counsellors, and auditors cannot escalate privileges. Only workspace `owner` accounts (or platform `superadmin`) can invite members with elevated roles, assign custom roles, modify permission sets, or deactivate owners. A manager cannot grant permissions they do not possess.

4. **0-MILLISECOND INSTANT REVOCATION:**
   When a user's role or custom permissions are mutated or deactivated, Redis and in-memory caches (`bootstrap:userId:wsId` and `user:auth:token`) are immediately evicted via post-save/post-remove hooks in `WorkspaceMembership.js` and controller actions. The client immediately reflects permission revocation upon next interaction with zero stale lag.

5. **FIELD-LEVEL DATA MASKING:**
   Commercial variables (such as university tie-up commissions, admission margins, and SPOC contract details) are redacted at both the API serialization level and the UI presentation level unless the actor holds explicit field-view authority (`canViewField(user, 'commission')` or `canViewField(user, 'customTieUpDetails')`).

---

## 2. Scope Hierarchy & Evaluation Logic

Permissions in Sahyak CRM support three hierarchical granularities:

```
┌─────────────────────────────────────────────────────────────┐
│                    SCOPE HIERARCHY                          │
│                                                             │
│   workspace (Level 3)  ──► Entire organization/tenant       │
│           ▲                                                 │
│           │                                                 │
│      team (Level 2)    ──► Assigned counselling team/branch │
│           ▲                                                 │
│           │                                                 │
│       own (Level 1)    ──► Self-assigned records only       │
└─────────────────────────────────────────────────────────────┘
```

### Evaluation Algorithm:
A permission check succeeds if and only if:
1. The user possesses the specified `permissionKey` in their effective permissions list; AND
2. The user's granted scope level is greater than or equal to the required scope level:
   $$\text{ScopeLevel}(\text{granted}) \ge \text{ScopeLevel}(\text{required})$$

---

## 3. Canonical System Roles & Default Permissions

| Role | Target Persona | Scope Defaults | Key Capabilities | Prohibited Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **`owner`** | Agency Founder / Principal | `workspace` (All) | Full tenant control, billing, invitations, custom role editing, commissions, deletions. | None within own workspace. Cannot access other tenant workspaces. |
| **`manager`** | Team Lead / Operations Head | `workspace` (Operational) | Lead assignments, bulk export, pipeline management, reporting, campaigns, templates, member invites (counsellor/auditor). | Cannot invite owners/managers, cannot manage custom roles, cannot access billing/plans, cannot delete workspace. |
| **`counsellor`** | Tele-counsellor / Admissions Agent | `own` (Student Facing) | View/edit own assigned leads, schedule follow-ups, make calls, send WhatsApp/email, record admissions. | Cannot export leads, cannot view commissions/margins, cannot access settings/billing, cannot assign leads to others. |
| **`auditor`** | Compliance / Financial Auditor | `workspace` (Read-Only) | Read-only inspection of leads, deals, audit logs, reports, commission totals, campaigns. | Cannot create, edit, delete, export records; cannot send messages; cannot alter configurations. |

---

## 4. Master 32-Permission Canonical Matrix

The table below provides the authoritative mapping of all 32 permissions across the 10 core functional modules.

### Module 1: Leads Management

| Key | Label | Scope | Owner | Mgr | Couns | Aud | Protected UI Elements | Enforcing Backend Route | Protected Fields / Records | Test Reference |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- | :--- | :--- |
| `leads.view` | View Leads | `workspace` / `own` | ✅ | ✅ | `own` | ✅ | Lead Table, Candidate Cards, Navigation Link | `GET /api/leads`<br>`GET /api/leads/:id` | Filtered by `assignedTo: req.user._id` for `own` scope | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `leads.create` | Create Leads | `workspace` | ✅ | ✅ | ✅ | ❌ | "Add Lead" Button, Quick Import Drawer | `POST /api/leads` | Default assigns creator or workspace unassigned pool | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `leads.edit` | Edit Leads | `workspace` / `own` | ✅ | ✅ | `own` | ❌ | Stage Dropdown, Edit Modal, Inline Inputs | `PUT /api/leads/:id`<br>`PATCH /api/leads/:id/stage` | Blocks mutating leads assigned to other counsellors | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `leads.delete` | Delete Leads | `workspace` | ✅ | ❌ | ❌ | ❌ | Context Menu "Delete", Bulk Delete Action | `DELETE /api/leads/:id` | Soft-deletes record (`deletedAt: Date.now()`) | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `leads.assign` | Assign Leads | `workspace` | ✅ | ✅ | ❌ | ❌ | Assignee Selector, Bulk Assign Action Bar | `POST /api/leads/assign`<br>`POST /api/leads/bulk-assign` | Prevents re-assignment of records by non-managers | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `leads.export` | Export Leads | `workspace` | ✅ | ✅ | ❌ | ❌ | "Export CSV", "Download Spreadsheet" | `GET /api/leads/export` | Complete contact dataset download blocked for agents | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `leads.view_sensitive` | View Sensitive Fields | `workspace` | ✅ | ✅ | ❌ | ❌ | Financial Notes, Family Income, Entrance Ranks | `GET /api/leads/:id` | Redacted from JSON response if permission absent | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `leads.view_documents` | View Student Documents | `workspace` / `own` | ✅ | ✅ | `own` | ❌ | Document Vault Tab, Download Marksheets | `GET /api/leads/:id/documents` | Signed URLs omitted from response for unpermitted users | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |

---

### Module 2: Follow-ups & Activities

| Key | Label | Scope | Owner | Mgr | Couns | Aud | Protected UI Elements | Enforcing Backend Route | Protected Fields / Records | Test Reference |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- | :--- | :--- |
| `activities.view` | View Activities | `workspace` / `own` | ✅ | ✅ | `own` | ✅ | Activity Timeline, Call Logs Feed | `GET /api/leads/:id/activities`<br>`GET /api/activities` | Non-managers only see interactions on assigned leads | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `activities.create` | Log Call / Note | `workspace` | ✅ | ✅ | ✅ | ❌ | "Log Call" Button, "Add Note" Textarea | `POST /api/leads/:id/activities`<br>`POST /api/activities` | Appends immutable activity audit trail | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `followups.create` | Schedule Follow-Ups | `workspace` / `own` | ✅ | ✅ | `own` | ❌ | "Schedule Follow-up" Button / Modal | `POST /api/leads/:id/followups` | Sets future reminder timestamp and agenda | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `followups.reschedule` | Reschedule Follow-Ups | `workspace` / `own` | ✅ | ✅ | `own` | ❌ | "Reschedule" Date Picker Trigger | `PATCH /api/followups/:id/reschedule` | Requires mandatory postponement reason note | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `followups.complete` | Complete Follow-Ups | `workspace` / `own` | ✅ | ✅ | `own` | ❌ | "Complete" Checkbox / Resolve Modal | `POST /api/followups/:id/complete` | Closes active reminder and prompts next touchpoint | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `followups.delete` | Delete Follow-Ups | `workspace` | ✅ | ❌ | ❌ | ❌ | "Stop / Cancel Follow-up" Button | `DELETE /api/followups/:id` | Cancels reminder stream without outcome note | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |

---

### Module 3: Pipelines & Stages

| Key | Label | Scope | Owner | Mgr | Couns | Aud | Protected UI Elements | Enforcing Backend Route | Protected Fields / Records | Test Reference |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- | :--- | :--- |
| `pipelines.view` | View Pipelines | `workspace` | ✅ | ✅ | ✅ | ✅ | Kanban Board, Forecast Funnel, Pipeline Nav | `GET /api/pipelines`<br>`GET /api/pipelines/:id` | Pipeline stages and card distribution | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `pipelines.manage` | Manage Pipelines & Stages | `workspace` | ✅ | ✅ | ❌ | ❌ | "New Pipeline", Stage Settings, Stage Reorder | `POST /api/pipelines`<br>`PUT /api/pipelines/:id` | Creation, renaming, probability weighting of stages | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |

---

### Module 4: Catalogue & Fee Structure

| Key | Label | Scope | Owner | Mgr | Couns | Aud | Protected UI Elements | Enforcing Backend Route | Protected Fields / Records | Test Reference |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- | :--- | :--- |
| `catalogue.view_master` | Explore Master Repository | `workspace` | ✅ | ✅ | ✅ | ❌ | "Explore Master Repo" Tab, Search Master | `GET /api/catalogue/master` | National database of 10,000+ colleges | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `catalogue.manage_workspace` | Manage Active Catalogue | `workspace` | ✅ | ✅ | ❌ | ❌ | "Add Partner", "1-Click Import", Delete College | `POST /api/catalogue`<br>`DELETE /api/catalogue/:id` | Active institutions in consultancy portfolio | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `catalogue.edit_fees` | Edit Fees & Quotas | `workspace` | ✅ | ✅ | ❌ | ❌ | "Edit Fee", Add Degree, Add Stream | `PUT /api/catalogue/:id/courses` | Tuition fees, management quotas, intake seats | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `catalogue.view_commission` | View Commission Rates | `workspace` | ✅ | ✅ | ❌ | ❌ | Tie-Up Commission Metric, SPOC Contact Box | `GET /api/catalogue/:id` | Redacts `customTieUpDetails.commission` from JSON | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |

---

### Module 5: Communication & WhatsApp

| Key | Label | Scope | Owner | Mgr | Couns | Aud | Protected UI Elements | Enforcing Backend Route | Protected Fields / Records | Test Reference |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- | :--- | :--- |
| `whatsapp.view` | View WhatsApp Chats | `workspace` / `own` | ✅ | ✅ | `own` | ❌ | WhatsApp Inbox, Chat List, Message Bubbles | `GET /api/whatsapp/chats`<br>`GET /api/whatsapp/messages` | Scoped to messages involving assigned leads for agents | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `whatsapp.send_one_to_one` | Send Direct Messages | `workspace` / `own` | ✅ | ✅ | `own` | ❌ | Message Input Bar, Send Button, Quick Replies | `POST /api/whatsapp/send` | Chat transmission to student phone number | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `whatsapp.manage_templates` | Manage Canned Templates | `workspace` | ✅ | ✅ | ❌ | ❌ | "New Template", Edit Template, Presets | `POST /api/templates`<br>`PUT /api/templates/:id` | Canned response repository | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `whatsapp.manage_integrations` | Manage WABA Integrations | `workspace` | ✅ | ❌ | ❌ | ❌ | Connect WABA Modal Trigger, QR Pairing | `POST /api/whatsapp/connect`<br>`DELETE /api/whatsapp/session` | Meta WhatsApp Cloud API credentials & tokens | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `campaigns.view` | View Broadcasts | `workspace` | ✅ | ✅ | ❌ | ✅ | Broadcast History, Campaign Status Pills | `GET /api/campaigns` | Inbound and outbound broadcast stats | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `campaigns.launch` | Launch Broadcasts | `workspace` | ✅ | ✅ | ❌ | ❌ | "Launch Broadcast", Group Message Form | `POST /api/campaigns/broadcast` | Bulk message queue insertion | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `campaigns.cancel` | Cancel / Pause Broadcasts | `workspace` | ✅ | ❌ | ❌ | ❌ | "Pause", "Resume", "Cancel Campaign" | `POST /api/campaigns/:id/cancel` | Halts pending jobs in background worker queue | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |

---

### Module 6: Email Communication

| Key | Label | Scope | Owner | Mgr | Couns | Aud | Protected UI Elements | Enforcing Backend Route | Protected Fields / Records | Test Reference |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- | :--- | :--- |
| `email.view` | View Email Inbox | `workspace` / `own` | ✅ | ✅ | `own` | ❌ | Email Inbox, Thread Viewer, Attachments | `GET /api/email/inbox`<br>`GET /api/email/threads/:id` | Student communication email archives | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `email.send` | Send Emails | `workspace` / `own` | ✅ | ✅ | `own` | ❌ | "Compose Email", Reply Box, Send Button | `POST /api/email/send` | Candidate email dispatch | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `email.manage_accounts` | Manage Email Accounts | `workspace` | ✅ | ✅ | ❌ | ❌ | Connect Google Workspace, SMTP Setup Modal | `POST /api/email/accounts`<br>`DELETE /api/email/accounts/:id` | OAuth tokens and SMTP credentials | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `email.manage_templates` | Manage Email Templates | `workspace` | ✅ | ✅ | ❌ | ❌ | Rich HTML Template Builder, Snippets | `POST /api/email/templates` | Marketing and transactional email layouts | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `email.campaigns` | Email Campaigns | `workspace` | ✅ | ✅ | ❌ | ❌ | Bulk Email Dispatcher, Drip Sequences | `POST /api/email/campaigns` | Scheduled email blast jobs | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |

---

### Module 7: Deals & Financial Management

| Key | Label | Scope | Owner | Mgr | Couns | Aud | Protected UI Elements | Enforcing Backend Route | Protected Fields / Records | Test Reference |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- | :--- | :--- |
| `deals.view` | View Admission Deals | `workspace` / `own` | ✅ | ✅ | `own` | ✅ | Deals Kanban, Confirmed Admissions Feed | `GET /api/deals`<br>`GET /api/deals/:id` | Scoped to own closed candidates for counsellors | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `deals.create` | Record Admissions | `workspace` / `own` | ✅ | ✅ | `own` | ❌ | "Record Admission" Button, Deal Form Modal | `POST /api/deals` | Generates admission transaction record | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `deals.edit` | Edit Admission Deals | `workspace` | ✅ | ✅ | ❌ | ❌ | Edit Deal Modal, Fee Revision Trigger | `PUT /api/deals/:id` | Modifies tuition fee, discounts, seat quota | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `deals.delete` | Delete Admission Deals | `workspace` | ✅ | ✅ | ❌ | ❌ | Delete Deal Trigger, Cancel Admission | `DELETE /api/deals/:id` | Cancels unbilled admission records | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `commission.view` | View University Commission | `workspace` | ✅ | ✅ | ❌ | ✅ | Commission Ledger KPI Cards, Table Columns | `GET /api/commission`<br>`GET /api/deals (commission fields)` | Redacted for counsellors via `canViewField` | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `commission.edit` | Manage Invoices | `workspace` | ✅ | ❌ | ❌ | ❌ | "Claim Commission", Settle Payout Button | `POST /api/commission/claim`<br>`PUT /api/commission/:id` | University invoice status & receipt uploads | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `finance.export` | Export Financial Reports | `workspace` | ✅ | ❌ | ❌ | ❌ | "Export P&L", "Download Commission Excel" | `GET /api/finance/export` | Complete institutional revenue datasets | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |

---

### Module 8: Forms & Dynamic Studio

| Key | Label | Scope | Owner | Mgr | Couns | Aud | Protected UI Elements | Enforcing Backend Route | Protected Fields / Records | Test Reference |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- | :--- | :--- |
| `forms.view` | View Intake Forms | `workspace` | ✅ | ✅ | ✅ | ❌ | Form Studio Live Preview, Submissions Tab | `GET /api/auth/form-schema` | Active form schema layout and preview | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `forms.manage` | Build & Publish Forms | `workspace` | ✅ | ✅ | ❌ | ❌ | "Save Changes", "Add Field", Reorder, Toggles | `POST /api/auth/form-schema` | Custom field creation, validation rules, reordering | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |

---

### Module 9: Reports & Analytics

| Key | Label | Scope | Owner | Mgr | Couns | Aud | Protected UI Elements | Enforcing Backend Route | Protected Fields / Records | Test Reference |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- | :--- | :--- |
| `reports.view` | View Analytics | `workspace` | ✅ | ✅ | ❌ | ✅ | Analytics Navigation, Conversion Funnels | `GET /api/analytics/overview`<br>`GET /api/analytics/funnel` | Consultancy KPIs, counselor leaderboards | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `reports.export` | Export Reports | `workspace` | ✅ | ✅ | ❌ | ❌ | "Export Report" Button / Modal Trigger | `GET /api/analytics/export` | Raw analytics aggregation datasets | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |

---

### Module 10: Team, Roles & Workspace Administration

| Key | Label | Scope | Owner | Mgr | Couns | Aud | Protected UI Elements | Enforcing Backend Route | Protected Fields / Records | Test Reference |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- | :--- | :--- |
| `members.view` | View Team Members | `workspace` | ✅ | ✅ | ❌ | ✅ | Workspace Team Tab, Staff Roster | `GET /api/workspace/members` | Team names, emails, roles, phone numbers | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `members.invite` | Invite Team Members | `workspace` | ✅ | ✅* | ❌ | ❌ | "Invite Teammate" Button / Modal | `POST /api/workspace/invite` | *Managers restricted: cannot invite owners/managers | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `members.edit_role` | Change Member Roles | `workspace` | ✅ | ❌ | ❌ | ❌ | "Edit Role" Button in Member Row | `PUT /api/workspace/members/:id/role` | Privilege escalation prevented; caches evicted | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `members.deactivate` | Deactivate Members | `workspace` | ✅ | ❌ | ❌ | ❌ | "Deactivate Member" Button | `DELETE /api/workspace/members/:id` | Status flipped to inactive; sessions invalidated | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `roles.manage` | Manage Custom Roles | `workspace` | ✅ | ❌ | ❌ | ❌ | "Roles" Tab, Create Role, Edit Role, Delete | `POST /api/workspace/roles`<br>`PUT /api/workspace/roles/:id` | Custom role definitions; evicts all role-holders | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `workspace.settings.edit` | Edit Settings | `workspace` | ✅ | ❌ | ❌ | ❌ | "Settings" Tab, Save Settings Button | `PUT /api/workspace/settings` | Agency name, branding logo, timezone | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `billing.manage` | Manage Billing & Plans | `workspace` | ✅ | ❌ | ❌ | ❌ | Plans Navigation, Upgrade CTA, Invoices | `POST /api/billing/checkout`<br>`GET /api/billing/invoices` | Razorpay subscription plans, billing contacts | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |
| `audit.view` | View Audit Logs | `workspace` | ✅ | ✅ | ❌ | ✅ | Audit Log Stream, Security Event Feed | `GET /api/audit` | Comprehensive actor-action event logs | `backend/tests/permission_matrix_and_ui_lifecycle.test.js` |

---

## 5. Instant Revocation Architecture & Cache Invalidation

Stale bootstrap or user permissions present severe security vulnerabilities (e.g., an ex-employee retaining read access for minutes after deactivation). Sahyak CRM guarantees real-time, zero-lag revocation through synchronous invalidation hooks:

```
                  ┌───────────────────────────────────────────────┐
                  │   Administrative Action (Role/Member Change)  │
                  └───────────────────────┬───────────────────────┘
                                          │
                        DB Update (WorkspaceMembership)
                                          │
                     ┌────────────────────┴────────────────────┐
                     ▼                                         ▼
         Post-Save / Post-Remove Hooks           Controller Explicit Eviction
                     │                                         │
                     └────────────────────┬────────────────────┘
                                          │
                                          ▼
                         invalidateBootstrapCache(userId, wsId)
                                          │
                     ┌────────────────────┴────────────────────┐
                     ▼                                         ▼
          Redis Key Eviction:                       In-Memory Cache Eviction:
          `bootstrap:{userId}:{wsId}`               `workspaceContextCache.del(...)`
          `user:auth:{userId}`                      `userSessionCache.del(...)`
                                          │
                                          ▼
               Next Request Refreshes Authoritative Permissions from DB
                                          │
                                          ▼
                      Frontend Dispatches `user-updated` Event
                                          │
                                          ▼
                  DOM Re-renders Immediately (Unauthorized UI Removed)
```

---

## 6. Verification and Automated Testing

All permissions mapped above are backed by automated regression tests in:
1. `backend/tests/security_rbac_and_payment_remediation.test.js` (57 core assertions)
2. `backend/tests/workspace_rbac_and_isolation.test.js` (Multi-tenant & isolation assertions)
3. `backend/tests/permission_matrix_and_ui_lifecycle.test.js` (Comprehensive RBAC & Revocation lifecycle assertions)

These tests enforce both positive authorization (permitted actors receive 200 OK and expected records) and negative authorization (unpermitted actors receive 403 Forbidden with `PERMISSION_DENIED` and zero sensitive data leaks).
