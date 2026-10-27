# SAHYAK CRM — ARCHITECTURE FREEZE

**Document Type:** Architecture Decision Record / Product Architecture Contract  
**Status:** FROZEN — implementation must follow this document  
**Primary Rollout:** Education → Admission Consultants  
**Protected Reference System:** Real Estate  
**Purpose:** Establish a safe composable architecture without destabilizing the existing Real Estate implementation.

---

# 1. NON-NEGOTIABLE ARCHITECTURE PRINCIPLES

These rules are mandatory unless explicitly changed by a future architecture decision.

## 1.1 SAHYAK is ONE CRM, not multiple separate CRMs

SAHYAK must have:

- One shared CRM core
- Shared authentication and RBAC
- Shared tenant isolation
- Shared Lead system
- Shared Follow-up system
- Shared communication infrastructure
- Shared billing/entitlements
- Shared dynamic configuration infrastructure

Industry-specific functionality must be composed on top of this core.

---

# 2. PRIMARY PROFILE ≠ CAPABILITY

Every tenant has a primary business profile.

Conceptually:

```text
Tenant
 ├── Primary Industry
 ├── Primary Sub-Industry
 └── Enabled Capabilities
```

## Primary Industry

Defines the broad business domain.

Examples:

- Real Estate
- Education
- Event Management
- Healthcare
- Agency
- Consulting
- SaaS
- E-Commerce

## Primary Sub-Industry

Defines the tenant's default operating context.

Example:

```text
Industry: Education
Sub-Industry: Admission Consultant
```

The primary sub-industry determines:

- default terminology
- default dashboard experience
- default lead forms
- default workflows
- default navigation emphasis
- default seeded configuration

### Critical rule

**Primary Industry/Sub-Industry is a DEFAULT EXPERIENCE, NOT A HARD FUNCTIONAL RESTRICTION.**

---

# 3. CAPABILITY MODEL

Capabilities represent actual business functionality that a tenant can activate.

Examples:

```text
Education
 ├── Admission Consulting
 ├── Study Abroad
 ├── Higher Education
 ├── Test Preparation
 └── K12

Other capabilities
 ├── Event Management
 ├── Document Vault
 ├── Application Management
 ├── Visa Management
 └── etc.
```

A tenant can therefore have:

```text
Primary:
Education → Admission Consultant

Enabled:
- Admission Management
- Study Abroad
- Event Management
- Document Management
```

Another tenant may have:

```text
Primary:
Real Estate

Enabled:
- Property Inventory
- Event Management
```

This allows the same CRM to support multiple business models without duplicating the entire CRM.

---

# 4. CAPABILITY ≠ PIPELINE

This distinction is mandatory.

A capability may contain:

- modules
- entities
- forms
- workflows
- permissions
- automations
- one or more pipelines

Example:

```text
Study Abroad Capability
 ├── Student Profile
 ├── Country Profile
 ├── University Catalogue
 ├── Shortlist
 ├── Applications
 ├── Documents
 ├── Offers
 ├── CAS / I-20
 └── Visa
```

Its workflow may use:

```text
Study Abroad Admissions Pipeline
```

Event Management may use:

```text
Exhibitor Pipeline
Attendee Pipeline
Sponsorship Pipeline
```

Therefore:

> Do NOT model every capability as exactly one pipeline.

---

# 5. PIPELINE ARCHITECTURE

Pipeline is a workflow abstraction.

A pipeline represents progression through a business process.

Examples:

```text
Domestic Admission
New → Contacted → Counselling → Application → Admission → Enrolled
```

```text
Study Abroad
New → Profile Evaluation → Shortlisted → Applied → Offer → Visa → Enrolled
```

```text
Event Exhibitor
Lead → Qualified → Proposal → Negotiation → Booked
```

## Multiple pipelines are allowed

A tenant may have multiple active pipelines.

Pipeline selection must be explicit and deterministic.

---

# 6. PIPELINE SOURCE-OF-TRUTH RULE

The current codebase contains fragmented pipeline concepts:

- `User.pipelineStages`
- `TenantConfig.pipelineStages`
- `Pipeline`
- `Lead.pipelineId`
- `Lead.status`
- hardcoded stage labels
- UI-specific stage definitions

These must NOT be casually unified through a large refactor.

## Freeze rule

Before implementing the new composable pipeline system:

1. Map existing Real Estate pipeline behavior.
2. Identify the current runtime path.
3. Define the new pipeline source of truth.
4. Build the new architecture alongside the protected Real Estate path.
5. Migrate other industries only after validation.

### Do NOT:

- immediately replace `User.pipelineStages`
- immediately remove `Lead.status`
- immediately force all existing pipelines into `Pipeline.js`
- refactor Real Estate to use a new pipeline engine
- perform a global pipeline migration as part of Education implementation

Any such migration requires a separate architecture decision.

---

# 7. LEAD IS UNIVERSAL

`Lead` remains a shared CRM entity.

A Lead can represent:

- student
- buyer
- seller
- exhibitor prospect
- attendee prospect
- patient inquiry
- client prospect
- etc.

The core Lead model should contain universal CRM information.

Examples:

- identity
- contact information
- source
- assignment
- ownership
- status
- activities
- follow-ups
- communication
- tenant/company relationship

Industry-specific information should be added through controlled configuration or domain entities.

---

# 8. LEAD ≠ BUSINESS TRANSACTION

Do not turn Lead into a giant universal object containing every industry process.

For example:

```text
Student Lead
   ↓
Application
   ↓
University
   ↓
Offer
   ↓
Visa
```

The application is NOT merely a Lead field.

Similarly:

```text
Real Estate Lead
   ↓
EOI
   ↓
Booking
   ↓
Payment Schedule
```

These are separate business-domain entities.

---

# 9. EDUCATION APPLICATION MODEL

Education must follow:

```text
Lead
  ↓ 1:N
Application
```

Example:

```text
Student Lead
 ├── Application → University A
 ├── Application → University B
 └── Application → University C
```

An Application should have its own lifecycle.

Potential states:

```text
Draft
Profile Ready
Documents Pending
Submitted
Under Review
Offer Received
Accepted
Deposit Paid
CAS / I-20
Visa
Enrolled
Rejected
Withdrawn
```

Do not store multiple university applications as a large array inside `Lead.customData`.

---

# 10. OTHER DOMAIN ENTITIES

The same principle applies to other business processes.

Examples:

```text
Lead
 ├── Application
 ├── Event Participation
 ├── Sponsorship
 ├── Booking
 ├── EOI
 ├── Requirement
 └── other domain entities
```

Each entity owns its own lifecycle where business complexity justifies it.

---

# 11. customData BOUNDARY

`customData` is for configurable tenant/industry fields.

Good examples:

```text
preferredCountry
qualification
passingYear
budget
parentName
entranceExam
```

Bad examples:

```text
applications
payment ledger
booking state
inventory allocation
visa case lifecycle
commission ledger
```

## Rule

If data involves:

- money
- concurrency
- independent lifecycle
- relationships
- reporting
- permissions
- audit requirements
- multiple records per Lead

it should generally become a proper entity/model rather than being hidden in `customData`.

---

# 12. TENANT CONFIGURATION RESPONSIBILITY

`TenantConfig` should contain tenant-level configuration.

Examples:

```text
Primary Industry
Primary Sub-Industry
Enabled Capabilities
Custom Fields
Automation Settings
UI Preferences
Feature Configuration
```

It should NOT become the database for all runtime business entities.

---

# 13. ACTIVE PIPELINES

Do not blindly introduce:

```text
TenantConfig.activePipelines
```

until the pipeline source-of-truth decision has been finalized.

The preferred future direction is:

```text
Pipeline collection
       ↓
Pipeline instances
       ↓
Tenant ownership
       ↓
Capability association
```

But this must be implemented without destabilizing the existing Real Estate runtime.

---

# 14. INDUSTRY TEMPLATES

The current `industryTemplates` concept mixes several responsibilities:

- default pipeline stages
- forms
- fields
- automation
- dual pipelines
- product configuration

Future architecture should conceptually separate:

```text
Template / Seed Configuration
        ↓
Tenant Configuration
        ↓
Capability Configuration
        ↓
Runtime Entities
```

Do not perform a large refactor merely to make the code aesthetically generic.

Extract only when it provides a concrete architectural benefit.

---

# 15. REAL ESTATE PROTECTION CONTRACT

This is one of the most important sections of this document.

The existing Real Estate implementation is:

> **PROTECTED PRODUCTION SYSTEM + REFERENCE IMPLEMENTATION**

It has been manually developed, refined, tested and trusted.

The following must be treated as protected unless explicitly approved:

```text
realEstateController.js
realEstate.js
RealEstateLeadPanel.js
Booking.js
EOI.js
PaymentSchedule.js
Requirement.js
```

Related Real Estate behavior must also be treated carefully.

---

# 16. REAL ESTATE MUST NOT BE REFACTORED INTO A GENERIC ENGINE

Never use this migration pattern:

```text
Real Estate
     ↓
Aggressive refactor
     ↓
Generic Engine
     ↓
All industries depend on it
```

Instead use:

```text
Existing Real Estate
       ↓
Understand proven behavior
       ↓
Identify reusable pattern
       ↓
Build new shared/additive capability
       ↓
Education consumes new capability
```

Real Estate becomes the **reference implementation**, not the codebase to be dismantled.

---

# 17. REUSABLE BEHAVIOR FROM REAL ESTATE

Existing Real Estate behavior may provide proven patterns for:

- inventory/hold concepts
- appointments/visits
- document handling
- commissions
- domain-specific workflows
- audit behavior
- operational UI patterns

However:

> Reusable behavior does NOT automatically mean reusable code.

A new adapter/service/module may be safer than modifying the existing Real Estate implementation.

---

# 18. EDUCATION-FIRST COMPOSABLE ARCHITECTURE

The first major consumer of the composable architecture should be:

```text
Education
 → Admission Consultant
```

Possible configuration:

```text
Primary Industry:
Education

Primary Sub-Industry:
Admission Consultant

Enabled Capabilities:
- Admission Management
- Study Abroad
- Application Management
- Document Management
- Event Management
```

This becomes the proving ground for the composable architecture.

---

# 19. STUDY ABROAD CAPABILITY

Study Abroad is a capability, not a replacement for the Education profile.

It may contain:

```text
Country Profile
University Catalogue
Course Catalogue
Shortlist
Application Management
Document Management
Offer Tracking
CAS / I-20
Visa
```

A Study Abroad tenant may have multiple applications per student.

---

# 20. EVENT MANAGEMENT CAPABILITY

Event Management should also be composable.

Example:

```text
Admission Consultant
        +
Event Management
```

could support:

```text
Education Expo
 ├── Exhibitor Pipeline
 ├── Attendee Pipeline
 ├── Sponsorship
 └── Event Follow-ups
```

Do not force Event Management into the Admission pipeline.

---

# 21. REAL ESTATE + EVENT MANAGEMENT

This combination is technically valid.

Example:

```text
Primary:
Real Estate

Capability:
Event Management
```

Possible workflow:

```text
Property Expo
 ├── Event Leads
 ├── Exhibitors
 ├── Sponsorship
 └── Property Leads
```

The existing Real Estate system must remain untouched.

---

# 22. EDUCATION + REAL ESTATE

Technically, multiple domains can coexist.

However, one workspace containing completely unrelated operational domains is NOT the preferred default because of:

- terminology collision
- dashboards
- permissions
- scoring
- forms
- workflows
- navigation complexity
- reporting

Preferred future model:

```text
Company
 ├── Education Workspace
 └── Real Estate Workspace
```

where appropriate.

Cross-workspace architecture is a future capability, not a prerequisite for the first Education implementation.

---

# 23. UI COMPOSITION

The UI must not depend on giant conditionals such as:

```js
if (isRealEstate) ...
else if (isEducation) ...
else if (isEvent) ...
```

for every feature.

Preferred conceptual model:

```text
Core Navigation
      +
Primary Profile
      +
Enabled Capabilities
```

Capabilities can contribute:

- navigation items
- dashboard widgets
- lead sections
- forms
- actions
- detail panels
- reports
- workflows

But this should be introduced progressively.

---

# 24. BACKEND AUTHORIZATION

Capabilities must never be UI-only.

The backend must validate:

```text
Tenant
+
User Role
+
Capability Entitlement
+
Resource Permission
```

Example:

```text
User requests Application API
        ↓
Authenticated?
        ↓
Correct tenant?
        ↓
User authorized?
        ↓
Study Abroad/Application capability enabled?
        ↓
Allow / Reject
```

Hiding a button is NOT security.

---

# 25. BILLING / ENTITLEMENTS

Capabilities may eventually be connected to billing.

Conceptually:

```text
Plan
 ↓
Entitlements
 ↓
Capabilities
 ↓
Modules
```

Example:

```text
Professional Plan
 + Study Abroad Add-on
 + Event Management Add-on
```

Do not modify subscription/payment logic casually.

Billing changes require separate impact analysis.

---

# 26. DEPENDENCY MODEL

Capabilities may have dependencies.

Example:

```text
Study Abroad
    ↓
University Catalogue
    ↓
Application Management
    ↓
Document Management
```

Activation must prevent invalid configurations.

Example:

```text
Application Management
requires:
- Education base
- University/Institution data
```

Dependencies should be explicit rather than hidden inside UI assumptions.

---

# 27. SHARED ENGINES

Shared engines are cross-industry infrastructure.

Examples:

```text
CRM Core
Pipeline Engine
Form Engine
Follow-up Engine
Notification Engine
Document Engine
Communication Engine
Automation Engine
Permission Engine
```

But:

> Do not create a generic engine merely because two modules look similar.

The abstraction must be justified by stable common behavior.

---

# 28. DOMAIN MODULES

Domain modules own industry/business-specific concepts.

Examples:

```text
Real Estate
 ├── Inventory
 ├── EOI
 ├── Booking
 └── Payment Schedule

Education
 ├── University
 ├── Course
 ├── Application
 ├── Offer
 └── Visa

Event Management
 ├── Event
 ├── Exhibitor
 ├── Sponsorship
 └── Attendance
```

Domain modules should depend on shared infrastructure, not the reverse.

---

# 29. TARGET ARCHITECTURE

Conceptually:

```text
                         SAHYAK
                            │
             ┌──────────────┴──────────────┐
             │                             │
         CORE CRM                    SHARED ENGINES
             │                             │
          Leads                         Forms
          Users                       Pipelines
          RBAC                       Follow-ups
        WhatsApp                    Documents
         Billing                   Automations
             │                             │
             └──────────────┬──────────────┘
                            │
                     TENANT PROFILE
                            │
              ┌─────────────┴─────────────┐
              │                           │
       PRIMARY PROFILE               CAPABILITIES
              │                           │
       Industry/Subindustry         Study Abroad
                                    Applications
                                    Documents
                                    Events
                                    etc.
              │                           │
              └─────────────┬─────────────┘
                            │
                      DOMAIN ENTITIES
                            │
              Lead / Application / Event /
              Property / Booking / etc.
```

---

# 30. MIGRATION STRATEGY

Migration must be additive and incremental.

## Phase 1 — Architecture

Freeze:

- terminology
- ownership
- boundaries
- pipeline strategy
- capability strategy
- Real Estate protection

## Phase 2 — Education

Build the composable architecture primarily for:

```text
Education → Admission Consultant
```

## Phase 3 — Capabilities

Add:

```text
Study Abroad
Application Management
Document Management
Event Management
```

as appropriate.

## Phase 4 — Validation

Run:

- backend integration tests
- frontend regression tests
- permission tests
- tenant isolation tests
- pipeline tests
- Real Estate regression tests

## Phase 5 — Expansion

Only after the new architecture is proven should additional industries migrate.

---

# 31. REAL ESTATE REGRESSION REQUIREMENT

Every change that could indirectly affect shared infrastructure must answer:

1. Can this change affect Real Estate?
2. Which existing Real Estate path could be affected?
3. What regression tests cover it?
4. What manual smoke tests are required?
5. Can the change be implemented additively instead?

If a safer parallel implementation exists, prefer it.

---

# 32. FILE-LEVEL SAFETY RULE

### DO NOT TOUCH without explicit approval

```text
backend/src/controllers/realEstateController.js
backend/src/models/realEstate.js
backend/src/models/Booking.js
backend/src/models/EOI.js
backend/src/models/PaymentSchedule.js
backend/src/models/Requirement.js
frontend/.../RealEstateLeadPanel.js
```

The exact paths must be verified against the current repository before implementation.

### High-risk shared files

Treat these as controlled-change files:

```text
backend/server.js
backend/src/middleware/auth.js
frontend/src/lib/auth.js
backend/src/controllers/leadsController.js
frontend/.../BottomNav.js
subscription/payment/entitlement files
WhatsApp session/bootstrap infrastructure
```

Do not modify them casually.

---

# 33. PROTECTED SYSTEM PRINCIPLE

Real Estate must remain operational even if the new composable architecture is disabled.

The new architecture should therefore be capable of existing in parallel during the migration period.

Desired safety model:

```text
Existing Real Estate
        │
        │ remains stable
        ▼
Protected Production Path


New Composable Architecture
        │
        │ evolves independently
        ▼
Education / New Capabilities
```

---

# 34. WHAT MUST NOT HAPPEN

Do NOT:

- rewrite the CRM from scratch
- convert every industry into a separate CRM
- create one giant universal schema
- put every business entity in Lead
- put every business entity in customData
- create one giant pipeline for every capability
- force Real Estate into the new architecture immediately
- replace proven Real Estate code merely for architectural elegance
- migrate all pipeline logic in one change
- create abstractions without stable common behavior
- rely on frontend capability checks for security
- treat primary sub-industry as a hard restriction
- make billing changes as part of unrelated architecture work

---

# 35. DECISION HIERARCHY

When architectural decisions conflict, use this priority order:

```text
1. Production safety
2. Tenant isolation / security
3. Existing Real Estate stability
4. Data integrity
5. Correct domain modeling
6. Composability
7. Maintainability
8. Code elegance
```

Do not sacrifice production safety for architectural purity.

---

# 36. DEFINITION OF "DONE"

The architecture is considered successfully implemented only when:

- Existing Real Estate behavior remains intact.
- Education can operate using the new composable architecture.
- Primary industry/sub-industry defines defaults.
- Capabilities can be activated independently.
- Multiple pipelines are supported correctly.
- Lead remains universal.
- Domain entities have independent lifecycles.
- Backend authorization enforces capabilities.
- Tenant isolation remains intact.
- Education Application supports multiple applications per Lead.
- Regression tests demonstrate no unacceptable Real Estate regression.
- No unnecessary global refactor was introduced.

---

# 37. FINAL ARCHITECTURAL POSITION

SAHYAK should evolve toward:

> **One CRM Core + Shared Engines + Primary Business Profile + Composable Capabilities + Domain Entities**

The architecture must be:

- composable
- tenant-aware
- capability-aware
- pipeline-aware
- domain-correct
- incrementally migratable
- backward-safe

Most importantly:

> **Real Estate is protected production software and the reference implementation for proven operational behavior.**

We reuse the lessons and patterns from Real Estate.

We do NOT dismantle Real Estate to build the future.

The future architecture should be built **around** proven behavior, not by putting production behavior at unnecessary risk.

---

# 38. IMPLEMENTATION GATE

This document is an architecture freeze.

Reading this document does NOT authorize implementation.

Before changing code, the team must:

1. Read this document.
2. Inspect the current repository.
3. Confirm that the existing implementation matches the assumptions.
4. Identify contradictions.
5. Report any contradiction.
6. Obtain explicit approval for implementation.

No code changes should be made merely because this document has been provided.

**Architecture approval and implementation approval are separate decisions.**