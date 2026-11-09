# Production Risk Acceptance & Operational Waivers
**Target Branch**: `release/rc-3`  
**Date**: November 9, 2026  
**Auditor / Engineering Panel**: Principal Performance Engineer, SRE / Chaos Engineer, Database Specialist, Security Engineer, Frontend Performance Engineer, QA Lead  
**Verdict**: `GO-TO-STAGING-SOAK` (Production GO reserved for user sign-off after staging soak)

---

## Executive Summary
All 32 identified risks across Audit Rounds 1–2, Batches 1–4, and RC 1–3 gates have been categorized into either:
1. **FIXED & VERIFIED**: 26 critical and high vulnerabilities remediated in code with dedicated regression tests that fail before and pass after.
2. **ACCEPTED WITH RESIDUAL MITIGATION**: 6 architectural or third-party dependency risks that cannot or should not be patched in-tree without unacceptable business trade-offs. Each item below includes a precise risk summary, compensatory technical controls, and a dedicated signature block for leadership sign-off.

---

### Waiver 1: Google Sheets Self-Service Public URL Ingestion (RISK-17)
> **Risk Description**: The self-service Google Sheets integration allows connecting spreadsheets shared publicly via "Anyone with the link can view". If a customer administrator publishes an unauthenticated spreadsheet containing sensitive student PII or financial details, the spreadsheet remains accessible to any party possessing the URL.
> 
> **Compensatory Controls**: The CRM enforces an un-dismissible high-visibility warning banner in the sheet inspector dialog, restricts Google Sheets fetch scopes to read-only column headers and cell values, and gates all public sheet connections behind the tenant administrative policy flag `ALLOW_PUBLIC_SHEETS=true`. Multi-tenant workspaces requiring strict FERPA, HIPAA, or SOC-2 compliance are instructed to utilize authenticated Google OAuth 2.0 service accounts.
> 
> **Signature & Sign-Off**:
> ```
> [ ] ACCEPTED & WAIVED FOR STAGING SOAK
> Approver: _____________________________ (Security & Compliance Officer)
> Date:     _____________________________
> ```

---

### Waiver 2: SheetJS (`xlsx@0.18.5`) Prototype Pollution Advisories (RISK-21)
> **Risk Description**: Upstream SheetJS (`xlsx`) versions on public npm contain unpatched prototype pollution and memory advisory notices (CVE-2023-30533, GHSA-4r6h-8v6p-xvw6) which cannot be resolved without migrating to proprietary closed-source distributions or rewriting core spreadsheet parsing logic.
> 
> **Compensatory Controls**: The CRM strictly isolates all `xlsx` workbook parsing inside an off-heap Node.js `worker_thread` (`backend/src/workers/xlsxWorker.js`). The worker thread is sandboxed with an OS-enforced memory ceiling (`resourceLimits: { maxOldGenerationSizeMb: 256 }`), a hard cap of 50,000 rows, an uncatchable 30-second kill timer, and pre-parsing PE/ELF/Mach-O executable magic-byte rejection. The main Express event loop and Mongoose memory space are 100% physically isolated from worker thread memory.
> 
> **Signature & Sign-Off**:
> ```
> [ ] ACCEPTED & WAIVED FOR STAGING SOAK
> Approver: _____________________________ (Principal Systems Architect)
> Date:     _____________________________
> ```

---

### Waiver 3: Express `qs` Deep Query String Parsing Advisory (RISK-22)
> **Risk Description**: Older versions of `qs` bundled via Express allow deeply nested object parameter expansion which can induce memory exhaustion when flooded with maliciously crafted querystrings.
> 
> **Compensatory Controls**: Express is configured with strict parsing controls (`extended: false` or sanitized depth limits), an inbound recursive `sanitizeNoSql` middleware stripping all `$` operator prefixes and `.` dot notation keys from `req.query`, and an IP/user-keyed rate limiter capping query volume.
> 
> **Signature & Sign-Off**:
> ```
> [ ] ACCEPTED & WAIVED FOR STAGING SOAK
> Approver: _____________________________ (Security Engineer)
> Date:     _____________________________
> ```

---

### Waiver 4: Frontend Development-Only Vulnerabilities (`vitest`, `vite`, `@serwist`) (RISK-23)
> **Risk Description**: Several frontend development dependencies report vulnerability notices during `npm audit` in local development environments.
> 
> **Compensatory Controls**: All flagged packages are strictly confined to `devDependencies` in `frontend/package.json`. The CRM frontend is compiled ahead of time into a static web application (`output: 'export'`) consisting exclusively of static HTML, CSS, and client-side JavaScript deployed directly to Cloudflare Pages / CDN edges. Neither Node.js, Vite, Vitest, nor Serwist CLI run in the production hosting tier.
> 
> **Signature & Sign-Off**:
> ```
> [ ] ACCEPTED & WAIVED FOR STAGING SOAK
> Approver: _____________________________ (Frontend Engineering Lead)
> Date:     _____________________________
> ```

---

### Waiver 5: Baileys Unofficial WhatsApp Multi-Device Protocol Dependency (RISK-31)
> **Risk Description**: Direct integration with WhatsApp Web via `@whiskeysockets/baileys` relies on reverse-engineered multi-device WebSockets. Meta may adjust cryptographic handshakes or WebSocket protocol definitions without advance notice, potentially causing temporary connection drops or requiring library maintenance updates.
> 
> **Compensatory Controls**: WhatsApp worker execution is fully decoupled from core CRM operations. Auth credentials and cryptographic session states are protected with dedicated AES-256-GCM encryption (`WA_ENCRYPTION_KEY`) and automated key rotation (`enc:k1:...`). Distributed single-lease locks prevent split-brain socket conflicts, and enterprise Meta Graph API (WhatsApp Cloud API) is maintained in the codebase as an instant fail-closed fallback.
> 
> **Signature & Sign-Off**:
> ```
> [ ] ACCEPTED & WAIVED FOR STAGING SOAK
> Approver: _____________________________ (Head of Engineering)
> Date:     _____________________________
> ```

---

### Waiver 6: Single WhatsApp-Owning Instance Horizontal Scale Constraint (RISK-32)
> **Risk Description**: Baileys multi-device sessions maintain stateful in-memory WebSocket connections. In horizontal multi-instance deployments, only one compute instance holds the active lease for a given WhatsApp account; other instances cannot directly dispatch outbound messages through that connection without an inter-process message bus.
> 
> **Compensatory Controls**: The production runbook defines the unified single Web+Worker topology as the supported baseline. In multi-instance deployments, non-leaseholder instances intercept outbound send attempts and return HTTP 503 `WA_SESSION_OWNED_BY_ANOTHER_INSTANCE` along with the owning `leaseOwner` ID, preventing duplicate socket registrations or silent dropped messages. An asynchronous message queue (BullMQ / Redis PubSub) is scheduled for post-staging Milestone 2.
> 
> **Signature & Sign-Off**:
> ```
> [ ] ACCEPTED & WAIVED FOR STAGING SOAK
> Approver: _____________________________ (Principal SRE & DevOps Lead)
> Date:     _____________________________
> ```
