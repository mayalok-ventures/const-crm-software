# SAHYAK CRM — Automation UX Redesign & Capability Architecture Report

**Document Version:** 2.0.0  
**Date:** October 27, 2026  
**Authors:** Principal SaaS Product Architect, Senior UX Designer, Workflow Automation Specialist, Full-Stack Architect, QA Automation Lead  
**Scope:** Automation Module Redesign — User Mental Model, Guided Workflow Builder, Canonical Capability Registry, Dynamic Fields & Variables, Multi-Action Engine, and Background Execution Observability.

---

## 1. Baseline Evaluation: Problems Found in Previous Design

An independent evaluation of the previous implementation and audit uncovered severe usability and architectural limitations:

1. **Cognitive Overload & Technical Jargon:**
   - The UI exposed internal engineering identifiers such as `triggerType: 'stage_duration'`, `matchType: 'contains'`, `channel: 'internal'`, and unescaped regex keyword inputs. Non-technical sales counselors and admissions managers struggled to configure simple workflows.
2. **Template Dominance vs Custom Builder Disincentive:**
   - Modal Step 1 was entirely dedicated to hardcoded `PRESET_RECIPES`. Users felt restricted to predefined templates rather than composing custom automations easily.
3. **Conflation of Triggers and Conditions:**
   - Filtering criteria (Lead Sources, Target Stage, Inactivity Days) were mashed into the "Trigger" tab, obscuring the critical distinction between *what starts the automation* (Event) and *which records qualify* (Conditions).
4. **Single-Action Restriction in UI:**
   - Although the Mongoose schema supported `actions: []`, the UI only permitted configuring a single action. Real-world workflows (e.g. "Apply Tag ➔ Assign Counselor ➔ Send WhatsApp") were impossible to build without direct database manipulation.
5. **No Visual Variable Toolbar or Fallbacks:**
   - Users were forced to memorize raw template syntax like `{{counselorPhone}}` and `{{course}}`. There was no click-to-insert variable toolbar or live preview of rendered text.
6. **No "Draft" State for Incomplete Work:**
   - The system only supported a binary `isActive` toggle. Users could not save work-in-progress drafts without either making them active or leaving them paused.
7. **Buried Execution Logs & Silent Failures:**
   - Execution history was hidden inside a secondary modal. The main page had no insight into failing workflows, and users could not diagnose why a condition did not match or why an action failed.
8. **Lack of a Canonical Capability Registry:**
   - Triggers, actions, condition fields, and variable tags were hardcoded independently across multiple frontend components and backend controllers, making extensions brittle and error-prone.

---

## 2. Redesigned Information Architecture & Mental Model

The entire experience has been restructured around the universal automation mental model:

$$\mathbf{When\ (Trigger)} \longrightarrow \mathbf{Check\ (Conditions)} \longrightarrow \mathbf{Do\ (Actions)} \longrightarrow \mathbf{Timing\ (Delay)} \longrightarrow \mathbf{Review\ \&\ Activate}$$

### 2.1 Top-Level Navigation Sub-Views
The Automation landing page ([frontend/src/app/automations/page.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/frontend/src/app/automations/page.js)) now provides three purpose-driven sub-views:

1. **Workflows View (`workflows`):**
   - Clean, searchable catalog of all automated workflows.
   - Purpose-driven category tabs:
     - All Workflows
     - Lead Lifecycle & Speed-to-Lead
     - Omnichannel Messaging (WhatsApp & Email)
     - Pipeline Stages & Milestones
     - Counselor Assignment & Routing
     - Inactivity & Schedulers
     - Chatbots
   - Status filters: All, Active, Paused, Drafts.
   - Card details include:
     - Real-time generated plain-English summary: *"When a new lead arrives from Meta Ads (only if City is equal to "Pune") ➔ add tag "High Intent", then wait 15m then send WhatsApp message."*
     - Live status badge: 🟢 Active (pulsing dot), 🟡 Paused, ⚪ Draft.
     - Sequenced action steps badge: e.g. "3 Actions: Tag ➔ Assign ➔ WhatsApp".
     - Action menu: Edit, Pause/Resume toggle, Duplicate as Draft, View Logs, Delete.
2. **Activity & Execution History View (`activity`):**
   - First-class real-time execution log embedded directly on the page.
   - Filters by Status (`all`, `success`, `failed`, `pending`).
   - Detailed columns: Timestamp, Rule Name, Target Lead, Action Type, Status badge, Execution details/error message, and safe 1-click Retry button.
3. **Issues & Health View (`issues`):**
   - Automatically surfaces all workflows and executions requiring user attention (failed dispatches, missing recipient details, SMTP timeouts).
   - Direct 1-click retry and troubleshooting guidance.

### 2.2 Accurate Real-Time Operational Metrics
Calculated directly from MongoDB collections (`AutomationRule` and `AutomationLog`):
- **Active Workflows:** Count of active vs total workflows.
- **Executions (Today):** Live 24-hour count of background executions.
- **Success Rate:** Exact percentage of successful vs failed runs today.
- **Attention Needed:** Count of failed executions in the last 24 hours (highlighted in red with direct link to Issues view).

---

## 3. Guided 5-Step Workflow Builder

The redesigned builder modal ([frontend/src/components/automations/AutomationRuleModal.jsx](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/frontend/src/components/automations/AutomationRuleModal.jsx)) leads users through 5 intuitive steps:

```
[ Step 1: When ] ➔ [ Step 2: Check ] ➔ [ Step 3: Do ] ➔ [ Step 4: Timing ] ➔ [ Step 5: Review & Save ]
```

1. **Step 1: When should this automation run? (Trigger)**
   - Plain-English trigger cards with category badges and one-sentence explanations.
   - Contextual configuration:
     - `lead_created`: Lead source filters.
     - `stage_changed`: Target stage and optional previous stage.
     - `stage_reached`: Milestone stage.
     - `stage_duration`: Inactivity threshold days.
     - `whatsapp_inbound`: Keyword tags with Contains vs Exact toggle.
2. **Step 2: Define when this automation applies (Conditions)**
   - Choice: "Run for all records" vs "Only if specific conditions match".
   - Dynamic condition builder with CRM fields, operators (`equals`, `contains`, `gt`, `is_empty`, etc.), value inputs, and ALL (AND) vs ANY (OR) logic.
3. **Step 3: What should happen? (Actions)**
   - **Multi-Action Sequencing:** Users can add, reorder (Move Up/Down), and delete multiple actions in a single workflow.
   - Action types supported: Send WhatsApp, Send Email, Assign Counselor, Transfer Lead, Update Stage, Add Tag.
   - Reusable variable toolbar: Click-to-insert `{{name}}`, `{{course}}`, `{{counselorPhone}}`, etc., with character counters.
4. **Step 4: Configure timing (Timing)**
   - Immediate dispatch vs Scheduled delay (minutes/hours).
   - Durable persistence guarantee note.
5. **Step 5: Review & Save (Review & Status)**
   - Dynamic natural-language summary generated in real-time.
   - Live dry-run test simulation against real CRM or sample lead data.
   - Initial status choice:
     - 🟢 **Active:** Validates rule completely; registers triggers for immediate background execution.
     - 🟡 **Paused:** Saves rule in inactive state.
     - ⚪ **Draft:** Saves work-in-progress draft without executing.

---

## 4. Canonical Capability Registry Architecture

A new authoritative registry module was established in [backend/src/services/automationRegistry.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/services/automationRegistry.js).

### 4.1 Registry Contract (`GET /api/automations/capabilities`)
Exposes:
- `triggers`: Metadata, description, category, and config schema.
- `fields`: Supported CRM fields (source, status, city, course, payable_amount, tags) with allowed operators.
- `operators`: Standardized comparisons (`equals`, `not_equals`, `contains`, `not_contains`, `gt`, `gte`, `lt`, `lte`, `is_empty`, `is_not_empty`, `in`, `not_in`).
- `actions`: Supported actions with input requirements and channels.
- `variables`: Context placeholders with human labels, sample values, and fallback defaults.
- `recipes`: Starter workflow templates for 1-click wizard pre-population.

### 4.2 Server-Side Validation & Summary Generation
- `AutomationRegistry.validateRule(ruleData)`: Independently validates triggers, conditions, and action configurations before activation.
- `AutomationRegistry.generateRuleSummary(ruleData)`: Computes authoritative, human-readable natural language summaries persisted on the rule.

---

## 5. Background Execution & Observability Architecture

1. **Draft Protection:**
   - Draft rules (`status: 'draft'`, `isActive: false`) are completely excluded from event queries (`executeLeadCreatedAutomations`, `executeStageChangedAutomations`, etc.). They will never execute until explicitly activated.
2. **Durable Delayed Action Persistence:**
   - Actions with `delayMinutes > 0` are persisted in [AutomationLog.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/models/AutomationLog.js) with `status: 'pending'` and a precise `scheduledFor` timestamp.
   - [cron.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/utils/cron.js) runs a 1-minute sweep that reclaims and executes any pending jobs that matured during downtime.
3. **Multi-Action Sequential Execution:**
   - When a workflow has multiple actions, `AutomationEngine.executeRuleActions` executes each action in sequence:
     - Immediate actions run in order.
     - Delayed actions schedule individual durable pending logs.
     - Each action records its own audit trail with execution duration and status.
4. **Safe Retries:**
   - `POST /api/automations/logs/:logId/retry` allows retrying failed executions with immediate database updates, incrementing `retryCount`.

---

## 6. Security & Multi-Tenant Isolation

1. **Authorization & RBAC:**
   - All management endpoints require `automations.manage`.
   - Read-only users can only view rules (`automations.view`).
2. **Workspace Scoping:**
   - Rules, execution logs, and dry-run tests strictly filter by `req.workspaceId` and `req.user._id`.
   - Cross-tenant lead references return HTTP 404.
3. **No Arbitrary Code Execution:**
   - Triggers and actions dispatch exclusively to allowlisted registry handlers. Client-submitted arbitrary functions, eval strings, or unvalidated database queries are strictly rejected.

---

## 7. Verification Evidence & Test Results

All changes were verified using reproducible automated test suites:

| Suite Name | Command | Exit Code | Tests | Status |
|---|---|---|---|---|
| **Builder & Registry Suite** | `node tests/automation_builder_and_registry.test.js` | **0** | **7 / 7 Passed** | Capability registry, validation, summary, draft lifecycle, multi-action, clone |
| **Deep Audit Suite** | `node tests/automation_deep_audit.test.js` | **0** | **12 / 12 Passed** | All 10 prior defects, IDOR protection, delayed cron recovery, idempotency |
| **Engine Core Suite** | `node tests/automations_engine.test.js` | **0** | **6 / 6 Passed** | WhatsApp & Email dispatch, keyword bots, auto-provisioning |
| **Lead Transfer Suite** | `node tests/lead_transfer_and_automation.test.js` | **0** | **6 / 6 Passed** | Lead transfer permissions, bulk reassignments, idle lead sweeps |
| **REST API Suite** | `node tests/verify_automations_api.js` | **0** | **6 / 6 Passed** | CRUD, toggle, dry-run test, log retrieval |
