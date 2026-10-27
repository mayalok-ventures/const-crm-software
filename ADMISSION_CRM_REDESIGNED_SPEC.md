# Admission Consultant CRM — Redesigned Product & Engineering Specification
**Version:** 1.0  
**Date:** 23 October 2026  
**Purpose:** Source of truth for redesigning and implementing the admission-consultant CRM as a simple, fast, configurable, secure, responsive multi-user SaaS product.

## 1. Executive product decision

Build **one CRM with a frictionless single-user default and an optional team workspace**. Do not fork the product into separate “single-user” and “team” editions. A solo consultant should be able to sign up and immediately add leads; when they are ready, they can invite managers and counsellors without migrating their data.

The product remains purpose-built for admission consultants, education agencies, and counselling teams. Domain-specific defaults should cover student enquiries, courses, colleges, entrance exams, academic sessions, counselling, follow-ups, admissions, fees, and university commissions. Users may customize the workflow, but should not need to configure everything before using the CRM.

### Product principles
1. **Fast path first:** common actions should take one or two deliberate interactions.
2. **Progressive disclosure:** show essential controls first; put advanced options under clearly named settings.
3. **Safe by default:** permissions, data access, bulk messaging, deletion, and public sharing must default to restrictive behavior.
4. **Configurable, not chaotic:** allow customization through guided builders, validation, previews, and reset-to-default options.
5. **One source of truth:** pipeline stages, lead status, follow-up state, and deal status must have explicit meanings and not silently contradict one another.
6. **Mobile-first, responsive everywhere:** no core workflow may depend on hover, wide tables, drag-and-drop, or desktop-only controls.
7. **Measured speed:** optimize based on real-user metrics and profiling, not vague “instant/ultra-fast” claims.
8. **No hidden automation:** automatic stage changes, notifications, and bulk actions must be explainable, logged, and reversible where feasible.

## 2. What the supplied blueprint already establishes

The source blueprint describes:
- Consultant workflows: authentication, dashboard, leads, admissions Kanban, follow-ups with a two-delay limit, college catalogue, public college profiles, form studio, WhatsApp, campaigns/groups, deals/commission, analytics, profile/settings.
- A platform Super Admin console for consultant accounts, subscription plans, coupons, audit logs, and platform health.
- Admission-specific defaults such as lead temperature, college matching, entrance exam information, seat booking, admission confirmation, and university commission tracking.
- Mobile bottom navigation, a dashboard action agenda, quick call/WhatsApp actions, lead timelines, CSV/XLSX import/export, and custom intake forms.

These are retained as the domain foundation. The changes below are recommendations to resolve gaps and make the product suitable for real teams and scale.

## 3. Key logic defects and recommended resolutions

| Blueprint behavior / risk | Why it is problematic | Required resolution |
|---|---|---|
| “Single-operator” scope, while login already mentions `admin/consultant` roles | Team membership, account ownership, and tenant boundaries are undefined | Introduce Workspace → Membership → Role/Permission model. Preserve a solo workspace as the default |
| JWT stored in `localStorage` | Any successful same-origin XSS can expose persistent credentials | Prefer server-managed sessions or short-lived access tokens with `HttpOnly; Secure; SameSite` cookies/BFF, subject to existing architecture. Never put secrets in URLs. Follow OWASP session guidance |
| Adding any call note automatically advances a lead | A note may be an internal comment, an unsuccessful call, or admin correction; note presence does not prove counselling occurred | Make note creation independent. Offer a contextual “Mark as contacted / Move to next stage” action. Automation can be configured explicitly with a trigger, conditions, preview, and audit record |
| Stage probabilities are hard-coded (15%, 30%, etc.) | These are unvalidated assumptions and may produce misleading forecasts | Make probability configurable per pipeline stage, explain that it is an estimate, and allow historical conversion rates to replace defaults only when sample size is adequate |
| Formula uses lead budget × stage probability as “revenue forecast” | Student budget is not consultancy revenue; tuition value is not the same as commission or expected cash received | Separate `studentBudget`, `tuitionValue`, `expectedCommission`, `commissionInvoiced`, `commissionReceived`, and `cashCollected`. Forecast using the chosen metric, with clear labels |
| “Converted” / “Admission Confirmed” conflates admission and commission invoicing | Admission can be confirmed while university payout is still pending; invoice, payout, and admission are separate events | Model lead lifecycle, admission/deal, and commission settlement as linked but distinct state machines |
| Follow-up alarm depends on browser/local clock, tab state, and `followUpNotified` | Browser tabs may be closed, background tabs throttled, permissions denied, device asleep, or notification permission unavailable | Persist due state server-side; use a reliable scheduler/queue for notifications; make overdue items visible on next open; deduplicate events with idempotency keys. Browser audio is a best-effort UX enhancement, never the only reminder channel |
| Two delays are a hard wall for every use case | A rigid limit can block legitimate rescheduling and encourage users to work around the system | Keep the “snooze” shortcut limited/configurable if it improves discipline, but always provide an audited “Reschedule” action. Distinguish snooze from changing the planned appointment |
| Public intake form creates leads with no duplicate policy | Same student can submit repeatedly or arrive through WhatsApp/import and form | Normalize phone/email; warn on likely duplicates; allow merge or link records; never silently overwrite existing lead history |
| Public share token only described as “secure” | Token expiry, revocation, indexing, leakage, and field allow-list are unspecified | Use high-entropy unguessable tokens, optional expiry/revocation, `noindex`, rate limits, minimal field allow-list, and server-side stripping of internal fees/commission/notes |
| “Delete consultant and cascade all leads” | Irreversible tenant-wide data loss and potential compliance/support issue | Prefer deactivate/archive, export and retention workflow, explicit ownership transfer, soft delete/grace period, and audited hard-delete policy. Do not cascade-delete without a deliberate data-retention decision |
| “Random human jitter” to avoid WhatsApp bans | Random delays do not guarantee compliance or prevent bans; wording suggests evasion | Use supported/authorized WhatsApp integration, consent and opt-out controls, templates where required, rate/quality safeguards, retry handling, and transparent provider status. Do not promise ban prevention |
| Static pre-rendering of all authenticated CRM routes | Private, user-specific data cannot safely be treated as static public content; pre-rendering does not make data fetching instant | Static shell/assets are fine; authenticate and fetch private data at runtime with proper caching rules. Never publicly cache cross-tenant responses |
| Super Admin access inferred from a UI crown/role alone | UI visibility is not a security boundary | Enforce permissions on every server/API operation; UI only mirrors authorization decisions |
| Team permissions are unspecified | A counsellor could potentially see all leads, commission, exports, or settings | Implement server-enforced object-level and field-level access, scoped by workspace, ownership/team, and explicit permissions |
| No concurrency / assignment conflict rules | Two users can edit or follow up the same lead simultaneously | Add assignment, version checks/optimistic concurrency, activity timeline, duplicate action protection, and clear conflict messages |
| “Offline-capable” implied by static assets/background polling | Static assets do not guarantee safe offline CRUD or sync correctness | Define offline scope explicitly. Start with read/cache of safe data only unless conflict-aware queued writes, encryption, expiry, and logout clearing are implemented and tested |

### Research-grounded security and performance anchors
- OWASP recommends least privilege and deny-by-default authorization: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP session guidance warns against storing auth tokens in `localStorage`/`sessionStorage` and recommends safer cookie/BFF patterns where appropriate: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- Google’s Core Web Vitals “good” thresholds at the 75th percentile are LCP ≤ 2.5 s, INP ≤ 200 ms, and CLS ≤ 0.1: https://web.dev/articles/vitals
- PostgreSQL row security documentation is a useful reference for database-enforced tenant boundaries if the stack ever uses PostgreSQL; equivalent isolation must be enforced in the current database/application if it remains MongoDB: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

## 4. Information architecture: simpler and more task-oriented

### Primary navigation
Desktop sidebar:
1. **Home** — dashboard and action agenda
2. **Leads** — master directory, saved views, imports/exports
3. **Pipelines** — pipeline selector and board/list views
4. **Follow-ups** — today, overdue, upcoming, completed
5. **Colleges** — master catalogue and My Catalogue
6. **Communication** — WhatsApp inbox, templates, campaigns (show only enabled features)
7. **Admissions & Finance** — deals/admissions and commission ledger
8. **Reports** — analytics and saved reports
9. **Forms & Automation** — intake forms, workflow rules
10. **Workspace Settings** — team, roles & permissions, custom fields, pipelines, integrations, billing

Use section groups and collapsible labels only if necessary; avoid two competing navigation systems and duplicated links.

Mobile bottom navigation (5 slots):
- Home
- Leads
- Pipeline
- Follow-ups
- More

“More” opens a searchable/action-oriented menu for Colleges, Communication, Admissions & Finance, Reports, Forms, and Settings. Keep a persistent, permission-aware **+ Add** action for Lead, Follow-up, Note, or Task. Do not place every module in the bottom bar.

### Global interaction patterns
- Global search: leads, phone, college, course, and relevant records; permission-filtered.
- Quick create: minimal required fields first; optional details after save.
- Saved views: “My Leads”, “Unassigned”, “Due Today”, “Hot Leads”, “Recently Updated”, and custom filters.
- Page headers consistently show page title, short context, primary action, and overflow menu.
- Use inline edits for low-risk fields; use dialogs/drawers for focused tasks; use full pages for complex builders.
- Preserve filter/sort/page state when users open a lead and return to the list.
- Provide loading skeletons, empty states with a next action, retryable errors, and clear save states.
- Keyboard support: visible focus, logical tab order, Escape to close overlays, keyboard alternatives to drag/drop.
- Never use color as the only indicator; labels and icons must carry meaning.

## 5. Workspace and team architecture

### Core entities
- **User:** global identity, authentication, account status.
- **Workspace:** one consultancy/business tenant, business profile, preferences, subscription/entitlements.
- **Membership:** `workspaceId`, `userId`, status, role IDs, team IDs, invitation metadata, joined/disabled timestamps.
- **Role:** workspace-scoped role name, description, system/custom flag, permission set.
- **Permission:** stable key, resource, action, optional scope/field constraints.
- **Team:** optional team/group of memberships (e.g. North Zone, MBBS Desk, Study Abroad).
- **Lead:** belongs to a workspace; includes owner/assignee and optional team.
- **Pipeline / Stage:** workspace-owned configuration; lead/deal references stable stage IDs, not editable display names.
- **Activity / Audit Event:** workspace, actor, subject, action, timestamp, before/after summary where appropriate.
- **Invitation:** hashed/unguessable token, workspace, invitee email/phone, assigned role/team, expiry, status.
- **Integration Connection:** workspace-scoped connection, credential reference stored server-side, connection status and audit events.

### Single-user onboarding
1. Sign up and create a workspace automatically.
2. Owner lands on a useful dashboard; no team setup is required.
3. Show a discreet “Invite your team” option, not a blocking wizard.
4. When invited, teammate accepts, creates/signs into a user identity, and joins the workspace.
5. Workspace owner can add or disable memberships at any time.
6. Adding members must not create duplicate workspaces or copy lead data.

### Invitation lifecycle
`Draft → Sent → Accepted` or `Expired / Revoked`.
- Expiring, revoking, and resending are supported.
- Invitations are single-use, time-limited, and bound to the intended email/identity.
- Do not grant access until acceptance and membership creation succeed.
- Invitee must not be able to select a more privileged role than the inviter is authorized to grant.
- Owner can change role/team or deactivate membership.
- Membership removal revokes sessions/refresh tokens and integration access where applicable.
- Define ownership transfer before removing/deactivating the only owner.

### Workspace isolation — non-negotiable
Every tenant-owned record and query must be scoped by `workspaceId` (or equivalent verified tenant context). Never trust a client-supplied workspace ID without checking the authenticated user’s membership. Apply the scope to API routes, search, exports, file access, public share generation, jobs/queues, analytics, WebSocket events, and integrations. Add cross-tenant negative tests.

## 6. Dynamic roles and permissions

### Recommended model: RBAC + scoped conditions
Use **role-based access control (RBAC)** for understandable job roles, with additional scope conditions for “own records”, “assigned team”, “workspace”, and field-level visibility where necessary. Do not create a hard-coded role check in every component.

Provide defaults:
- **Owner:** full workspace control, billing, team, roles, integrations, data export/deletion policy, pipelines.
- **Manager:** operational control within explicitly granted scope; can assign leads, review activity, reports, and team performance, but cannot automatically manage billing or transfer ownership.
- **Counsellor:** assigned/allowed leads, call notes, follow-ups, course/college matching, permitted communication, and permitted stage changes.
- **Read-only / Auditor:** view allowed records and audit/reporting without changing them.
- **Custom role:** owner/authorized admin selects permissions and scope.

These are starting presets, not hard-coded limitations. The owner may customize them, subject to protected system invariants.

### Permission matrix starter set
Permission keys should be stable and explicit, for example:

| Resource | Example permissions |
|---|---|
| Leads | `leads.view`, `leads.create`, `leads.edit`, `leads.delete`, `leads.assign`, `leads.export`, `leads.merge`, `leads.view_all`, `leads.view_team`, `leads.view_own` |
| Sensitive lead fields | `leads.view_sensitive`, `leads.edit_sensitive`, `leads.view_documents` |
| Activities & follow-ups | `activities.view`, `activities.create`, `followups.create`, `followups.reschedule`, `followups.complete`, `followups.delete` |
| Pipelines | `pipelines.view`, `pipelines.create`, `pipelines.edit`, `pipelines.archive`, `pipelines.manage_stages`, `pipelines.manage_automation` |
| Colleges & courses | `catalogue.view_master`, `catalogue.manage_workspace`, `catalogue.edit_fees`, `catalogue.view_commission` |
| Communication | `whatsapp.view`, `whatsapp.send_one_to_one`, `whatsapp.manage_templates`, `campaigns.create`, `campaigns.approve`, `campaigns.launch`, `campaigns.cancel` |
| Admissions & finance | `deals.view`, `deals.create`, `deals.edit`, `commission.view`, `commission.edit`, `commission.mark_paid`, `finance.export` |
| Forms & automation | `forms.view`, `forms.create`, `forms.publish`, `automation.view`, `automation.create`, `automation.activate` |
| Reports | `reports.view`, `reports.create`, `reports.export`, `reports.view_team`, `reports.view_workspace` |
| Team & settings | `members.view`, `members.invite`, `members.edit_role`, `members.deactivate`, `roles.view`, `roles.create`, `roles.edit`, `integrations.manage`, `workspace.settings.edit`, `billing.manage`, `audit.view` |

### Scope model
Each data permission should support appropriate scopes:
- `own`: records created by or assigned to the user, according to the documented rule.
- `team`: records associated with the user’s team(s).
- `workspace`: all records in the workspace.
- `restricted`: explicit records/teams, where a use case justifies it.

Do not make “created by” and “assigned to” silently interchangeable. Define whether a counsellor keeps access after reassignment, and preserve historical activity attribution.

### Permission UI UX
- Role list with name, member count, and last updated.
- Role editor groups permissions by work task (Leads, Follow-ups, Pipeline, Communication, Finance, Reports, Workspace).
- Each group has simple “View”, “Create”, “Edit”, “Delete”, “Manage/Export” labels and a “Scope” selector where applicable.
- Explain risky permissions in plain language, e.g. “Can export all student contact details.”
- Show a “Preview access” summary before saving.
- Warn if a change locks the owner out; protect the last active owner and critical security controls.
- Permission changes take effect server-side promptly; revoke sessions or refresh authorization context as needed.
- Record who changed permissions, what changed, when, and for which workspace.

### Security invariants
Even custom roles cannot bypass:
- workspace/tenant isolation;
- platform Super Admin boundary;
- server-side authentication and authorization;
- last-owner protection;
- protected billing/ownership transfer rules;
- required audit events;
- data-retention and deletion safeguards;
- consent/opt-out and provider policy checks for messaging.

## 7. Multiple configurable pipelines

### UX
- Pipeline switcher at the top of `/pipelines`.
- “Create pipeline” offers templates: **College Admissions** (default), **Study Abroad**, **School Admissions**, **Test Prep**, **Custom**.
- Each pipeline can have its own name, stages, stage order, color, probability, entry criteria, terminal outcome, required fields, and optional automation.
- Support Kanban and compact list/table views. Mobile default is list with stage filter; board can be horizontally scrollable only as an optional view.
- Provide a guided stage editor with preview, reorder controls, archive, and restore.
- Provide “Set as default” and “Duplicate pipeline”.
- Prevent accidental destructive edits: show how many leads use a stage and require a mapping when deleting/merging a stage.
- Existing leads retain their stable `stageId`; display labels can change without breaking history.
- A lead belongs to a clearly defined active pipeline; if multi-pipeline membership is needed later, model it explicitly rather than overloading a single `stageId`.

### Stage configuration
Fields:
- `id` (stable, immutable)
- `pipelineId`
- `name`, `description`, `position`
- `category`: open / won / lost (or equivalent controlled semantic)
- `probability` (0–100, optional)
- `requiredFieldsOnEntry` (optional)
- `allowedTransitions` (optional; default sensible progression)
- `automationRules` (optional, validated)
- `archivedAt`, timestamps, actor IDs

Keep business state distinct from display label. “Admission Confirmed” may map to `won`, but commission status remains a separate financial lifecycle.

### Transition safeguards
- Manual drag/drop is one transition path, not the only path.
- On a lost transition, request a configurable lost reason and optional note.
- On won transition, validate the required admission/deal fields without forcing every agency to use the same payment model.
- If a stage is archived, map existing leads to a chosen replacement stage or preserve as historical state; never silently orphan leads.
- Automation rules are explicit: trigger, conditions, action, scope, execution history, pause switch, and failure state.
- Adding a note alone must not auto-advance a lead unless the workspace owner deliberately configures that exact rule.

## 8. Dynamic fields, forms, and workflows

### Custom fields
Support custom fields for leads and, when relevant, colleges, deals, and admissions:
- Text, long text, phone, email, number, currency, date, dropdown, multi-select, checkbox, URL.
- Field key is immutable; display label can change.
- Required/default/validation/visibility settings; archive rather than hard delete when data exists.
- Field-level permissions for sensitive values (e.g. documents, financial notes).
- Validate schema changes against existing records and public forms before publishing.
- Avoid creating arbitrary custom fields for every concept already represented by a core field.

### Form Studio
- Draft → preview → publish → pause/archive.
- Each public form has a stable version. Submissions record the version used.
- Configure required fields, labels, helper text, dropdown choices, consent wording, success message, and destination pipeline/stage/owner/team.
- Public forms must rate-limit, validate server-side, protect against spam, and normalize phone/email.
- Form field changes must not rewrite prior submissions.
- Duplicate detection should suggest match/merge rather than silently overwrite.

### Automation builder
Start with a small set of reliable triggers:
- Lead created
- Lead assigned/reassigned
- Stage changed
- Follow-up due/overdue
- Form submitted
- Admission marked won/lost
- Commission status changed

Actions:
- Create follow-up/task
- Notify user/team
- Assign by rule
- Add tag
- Send approved template if authorized and compliant
- Update a non-sensitive field
- Request approval

Every automation must have a preview, enable/disable switch, execution log, retry policy, idempotency, and failure visibility. Avoid arbitrary scripts or unrestricted code execution in user-configured rules.

## 9. Lead, follow-up, and admission lifecycle

### Lead model essentials
- Workspace, source, created-by, owner/assignee, team, pipeline/stage, temperature, course/program, academic year, contact channels, custom fields, tags, duplicate/merge references, timestamps.
- Maintain an append-only activity history for meaningful actions; do not overwrite who did what.
- Separate internal notes from student-facing messages.
- Use clear status labels and consistent terminology across dashboard, board, detail page, reports, and exports.

### Follow-up model
Each follow-up is a first-class record, not merely one date field on a lead:
- `leadId`, `workspaceId`, assigned user/team, due time + timezone, channel, purpose, status, snooze count, outcome, created-by, completed-by, timestamps.
- Multiple follow-ups can exist for a lead.
- Rescheduling preserves the old due time and reason in history.
- Completion requires a meaningful outcome; use a short structured outcome plus optional note to reduce typing.
- Server scheduler/queue is authoritative for due/overdue state. Browser notifications/audio are optional enhancements.
- Avoid duplicate reminders with idempotency keys. Define quiet hours, retries, and notification preferences.
- Dashboard shows overdue first, then due today, then upcoming.

### Admissions and money
Keep these distinct:
1. Lead progression
2. Admission/deal record
3. Student fee/payment milestones, if tracked
4. University commission invoice
5. Commission payout/settlement

Require currency and source for financial values. Store amount and currency consistently, use integer minor units or Decimal128 (not binary floating point for financial calculations), and record adjustments with an audit trail. Clearly label estimated versus confirmed amounts.

## 10. College catalogue and public sharing

- Distinguish a shared/master institution record from a workspace-specific catalogue entry.
- Importing a college should create a workspace mapping/snapshot of relevant editable values, not mutate the master institution.
- Show data provenance and last-verified date for accreditation, fee, seat availability, and course data. Never present stale/uncertain status as confirmed.
- Keep private commission, negotiation notes, internal costs, and student records out of public shares at the API serialization layer.
- Share links should be revocable and optionally expire; public view should disclose only explicit allow-listed fields.
- Avoid implying that accreditation/approval is verified unless the source and verification date are recorded.

## 11. WhatsApp, campaigns, and consent

- Treat connection state, message queue state, delivery status, and provider error as separate values.
- Use a supported, authorized integration path where possible. Do not promise that random delays prevent bans.
- Enforce role permissions for connecting numbers, reading messages, sending one-to-one messages, managing templates, exporting contacts, and launching broadcasts.
- Add opt-in/consent source, timestamp, purpose, and opt-out status where applicable.
- Campaign launch requires a recipient count preview, template preview, sample-variable validation, duplicate/opt-out filtering, confirmation, and an audit record.
- Queue sends with provider-compliant rate limits, idempotency, retry/backoff, pause/cancel semantics, and visible failure reasons.
- Prevent counsellors from launching workspace-wide campaigns unless explicitly authorized.
- Keep connection secrets server-side; never return them to frontend clients.

## 12. Responsive UI/UX requirements

### Breakpoint behavior (adapt to content, not device names alone)
- **Small mobile (320–479 px):** one-column layouts; bottom nav; full-screen focused forms; no wide tables; sticky primary action only when it does not cover content.
- **Large mobile (480–767 px):** compact cards/lists, filters in a sheet, action menus, optional horizontally scrollable Kanban.
- **Tablet (768–1023 px):** collapsible navigation, two-column detail layouts where readable, board/list choice.
- **Desktop (1024 px+):** sidebar, dense table option, multi-column board, keyboard shortcuts and bulk actions.
- Test at narrow widths, zoom, landscape, long names, large text, empty states, slow network, and touch input.

### Accessibility baseline
Target WCAG 2.2 AA where feasible:
- Semantic labels, accessible names, keyboard operation, visible focus, sufficient contrast, reduced-motion support, clear validation messages, and no color-only status.
- Drag-and-drop must have keyboard/menu alternatives.
- Dialogs trap/restore focus correctly and close predictably.
- Tap targets should be comfortably usable; do not pack icon-only controls without labels/tooltips and accessible names.
Reference: https://www.w3.org/TR/WCAG22/

### Performance targets and implementation practices
Use field measurement at the 75th percentile, segmented by mobile/desktop:
- LCP ≤ 2.5 seconds
- INP ≤ 200 milliseconds
- CLS ≤ 0.1
Reference: https://web.dev/articles/vitals

Implementation:
- Paginate/virtualize large lead lists and catalogue results.
- Debounce search; cancel stale requests; index common search/filter fields.
- Load expensive charts, rich editors, and rarely used modules on demand.
- Avoid loading the entire college catalogue or full lead history on initial page load.
- Use server-side filtering/sorting/pagination for large datasets.
- Cache only safe, appropriately scoped data; never leak one workspace’s data through shared cache keys.
- Optimistic updates only for reversible low-risk actions; reconcile server response and show failure rollback.
- Use skeletons that preserve layout, avoid layout shifts, and provide retry controls.
- Measure API latency, query plans, JS bundle size, errors, and Core Web Vitals before and after changes.

## 13. Dashboard and work-speed design

Dashboard should answer in under five seconds:
1. What must I act on now?
2. Which leads are at risk or overdue?
3. What is progressing and what is converting?

Suggested order:
1. **Action agenda:** overdue, due today, unassigned hot leads.
2. **Quick actions:** Add Lead, Log Call, Schedule Follow-up, Import Leads.
3. **Small KPI row:** active leads, overdue follow-ups, admissions won, expected commission (only when data is meaningful).
4. **Pipeline snapshot:** stage counts and conversion trend.
5. **Team queue** (only if permission allows).
6. **Recent activity** and system alerts.

Avoid decorative charts with no action path. Every KPI should link to the filtered records behind it. Users should be able to hide/reorder dashboard widgets later, but defaults should be sensible.

## 14. Data, audit, and operational safeguards

Audit at minimum:
- membership invites/acceptance/revocation;
- role and permission changes;
- lead assignment, merge, export, deletion, and sensitive field access where appropriate;
- pipeline/stage configuration changes and bulk transitions;
- public link creation/revocation;
- WhatsApp connection, campaign launch/pause/cancel, and exports;
- admission/deal/commission changes;
- billing/ownership changes and admin account actions.

Audit records should be append-only from ordinary application workflows, include actor, workspace, action, target, timestamp, and safe before/after diff. Never log passwords, tokens, session cookies, provider secrets, or unnecessary student sensitive data.

Use soft deletion/archive for business records by default, with retention and permanent-deletion policies explicitly defined. Ensure exports are permission-checked, audited, and scoped.

## 15. Suggested data model (adapt to the existing stack)

This is a conceptual model; the coding agent must map it to existing database conventions and avoid a needless rewrite.

- `User`
- `Workspace`
- `WorkspaceMembership`
- `Invitation`
- `Role`
- `PermissionDefinition` (code-defined stable catalogue) + `RolePermission`
- `Team` + `TeamMembership`
- `Lead`
- `LeadActivity`
- `FollowUp`
- `Pipeline`
- `PipelineStage`
- `CustomFieldDefinition` + custom values/schema strategy
- `FormDefinition` + `FormVersion` + `FormSubmission`
- `AutomationRule` + `AutomationExecution`
- `InstitutionMaster` + `WorkspaceInstitution`
- `AdmissionDeal`
- `CommissionInvoice` + `CommissionPayment`
- `IntegrationConnection` + `Message` + `Campaign` + `CampaignRecipient`
- `AuditEvent`

Prefer stable IDs and explicit relationships over storing mutable stage names or role names as business logic. If the current project uses MongoDB/Mongoose, design indexes and validation accordingly; do not introduce a second database merely to follow this conceptual list.

## 16. Migration and compatibility

1. Audit current schemas, auth/session implementation, API routes, frontend state, background workers, tests, and deployed behavior before coding.
2. Create a migration map from the current consultant account to a new workspace with an owner membership.
3. Backfill `workspaceId` on all existing tenant-owned records using a verified account-to-workspace mapping.
4. Create a default pipeline and map current stages to stable stage IDs.
5. Convert legacy follow-up fields to first-class follow-up records carefully; preserve due dates, notes, and timestamps.
6. Add indexes and verify query plans before enabling tenant-scoped paths.
7. Deploy compatibility reads/writes or a controlled migration window; avoid partial state where some APIs enforce workspace scope and others do not.
8. Provide backup, rollback, migration verification, and idempotent rerun strategy.
9. Test existing solo-user behavior before and after migration.
10. Do not delete or overwrite real customer data during migration.

## 17. Implementation phases

### Phase 0 — Repository and behavior audit
- Identify stack, models, APIs, auth, jobs, integrations, route guards, tests, deployment pipeline.
- Produce an existing-vs-target gap matrix and risk list.
- Confirm all current flows and record the baseline.

### Phase 1 — Tenant foundation and secure authorization
- Workspace/membership and owner migration.
- Server-side tenant scoping across every resource.
- Permission catalogue, authorization middleware/service, secure session handling.
- Cross-tenant tests and audit foundation.

### Phase 2 — Team and role management
- Invite/accept/revoke flow.
- Default roles and custom role editor.
- Assignment/team scopes, member deactivation, session revocation.
- Protect last owner and billing/ownership actions.

### Phase 3 — Configurable pipelines and lead workflows
- Multiple pipelines, stage builder, stable IDs, stage mapping.
- Lead assignment, duplicate handling, explicit transitions.
- Follow-up record/scheduler reliability and clear outcomes.
- Separate admissions and commission state machines.

### Phase 4 — Navigation and responsive redesign
- Desktop sidebar + mobile bottom navigation/More.
- List/Kanban responsive patterns, quick create, saved views.
- Accessibility, loading/empty/error states, keyboard/touch alternatives.

### Phase 5 — Dynamic fields, forms, automation, integrations
- Custom fields/forms with versioning.
- Guarded automation builder and execution logs.
- WhatsApp/campaign permissions, consent and queue reliability.
- Public share hardening.

### Phase 6 — Performance, QA, rollout
- Profile and optimize hot paths.
- Accessibility and responsive QA.
- Security/authorization tests, migration verification, regression suite.
- Staged rollout and monitoring.

Do not attempt a large risky rewrite in one pass. Keep changes small, testable, backward-compatible, and shippable.

## 18. Definition of done / acceptance criteria

### Solo mode
- A new user can sign up, create a lead, schedule a follow-up, move a lead through the default pipeline, and view their dashboard without inviting anyone.
- Existing solo accounts retain access to their data and core workflows after migration.
- No team setup is mandatory.

### Team mode
- Owner can invite multiple users, assign a role/team, revoke an invite, change membership role, and deactivate a member.
- Invitee joins the correct workspace and sees only authorized data.
- Counsellor cannot access owner-only billing, role editing, or other workspace data unless granted.
- Permission changes are enforced by the API, not only hidden in the UI.
- Deactivation invalidates active sessions and access to integration actions.

### Tenant isolation
- Automated tests prove that workspace A cannot read/update/delete/export workspace B records by changing IDs, filters, pagination, URLs, WebSocket payloads, or job arguments.
- Public links expose only allow-listed data and can be revoked.
- Search, exports, analytics, files, and background jobs are tenant-scoped.

### Pipelines and customization
- User can create, rename, reorder, duplicate, set default, and archive a pipeline.
- User can add/rename/reorder/archive stages and set probability.
- Deleting a used stage requires a replacement mapping.
- Existing leads remain valid after labels/order change.
- Adding a note does not unexpectedly change stage unless a deliberate automation says so.

### Follow-ups and finance
- Due/overdue reminders remain visible even if the browser was closed at the scheduled time.
- Snooze and reschedule are distinct and history is retained.
- Deal value, student budget, expected commission, invoiced commission, and received commission are not conflated.
- Financial edits are audited.

### Responsive/accessibility/performance
- Core workflows work at 320 px wide and up, tablet, desktop, keyboard-only, and touch.
- No essential action is hover-only or drag-only.
- Errors, empty states, loading, offline/network failures, and permission denials are understandable.
- Measure LCP/INP/CLS at the 75th percentile and document baseline/results against target thresholds.
- Large lists are paginated or virtualized; no full catalogue or unbounded history is fetched by default.

### Engineering quality
- Unit/integration/e2e tests cover auth, permissions, tenant isolation, pipeline transitions, follow-ups, invitations, and migration.
- Lint/typecheck/build pass.
- No secrets are added to client bundles or logs.
- Final report lists files changed, migrations, tests run, known gaps, and rollout/rollback instructions.

## 19. CEO/product decisions that should remain explicit

Before shipping, make a deliberate decision on:
1. Subscription limits: seats, leads, WhatsApp usage, storage, pipelines, and advanced automation. Enforce entitlements server-side.
2. Whether custom roles are included in every plan or gated by plan.
3. Team-level versus workspace-level reporting visibility.
4. Data retention and permanent deletion rules.
5. Supported WhatsApp integration path and consent policy.
6. Whether offline mode is read-only initially or supports queued writes.
7. What counts as a “won admission” and how revenue/commission is recognized.

Do not invent these policies in code. Use current product/business rules where they exist; flag unresolved decisions in the final report.

## 20. References

- Supplied source blueprint: CRM UI Behavior & Logic Blueprint (uploaded files in this conversation).
- OWASP Authorization Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html
- OWASP Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- WCAG 2.2: https://www.w3.org/TR/WCAG22/
- Google Core Web Vitals: https://web.dev/articles/vitals
- PostgreSQL Row Security Policies (architectural reference): https://www.postgresql.org/docs/current/ddl-rowsecurity.html
