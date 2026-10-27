# Sahyak CRM — Production Deployment Readiness Report

**Author:** Antigravity Architectural & Reliability Engineering Team  
**Evaluation Date:** October 2026  
**Target Infrastructure:**
- **Frontend:** Cloudflare Pages (`https://app.sahyak.com`)
- **Backend:** Zoho Hosting (Evaluated: Zoho Catalyst AppSail)
- **Database:** MongoDB Atlas (M10+ recommended with TLS)
- **Source Control & CI/CD:** GitHub Actions (`main` branch)
- **Integrations:** Meta Lead Ads, Google Ads lead forms, Google Sheets, WhatsApp (Baileys & Meta Cloud API), Email (SMTP/OAuth), Razorpay Webhooks.

---

## 1. Executive Summary & Verdict

### Final Readiness Verdict: **READY FOR STAGING & PRODUCTION DEPLOYMENT (SUBJECT TO EXTERNAL CREDENTIAL PROVISIONING)**

- **Code & Build Status:** **PASS** (Next.js 16.2.10 static export built successfully with exit code 0 across all 39 CRM routes; Serwist PWA service worker generated; backend integration and security test suites passed 18/18 and 55/55).
- **Runtime Compatibility:** **PASS WITH SPECIFIC ARCHITECTURE DESIGN** (Zoho Catalyst AppSail is compatible for the Node.js/Express backend provided single-instance topology and port resolution are observed).
- **Application Security:** **PASS** (CORS allowlisting strictly locked to `https://app.sahyak.com`; cleartext credential logging remediated; production startup validator enforces strong JWT and AES-256 encryption keys; IDOR tenant boundaries verified).
- **Database Readiness:** **PASS** (Mongoose 8 pool settings configured; idempotent index migration script tested; credential masking implemented).
- **Operational Readiness:** **ACTION REQUIRED FROM OPERATOR** (Live DNS records, Zoho AppSail container creation, MongoDB Atlas database user creation, and provider API keys must be populated by the account owner).

---

## 2. Phase 2 Decision Gate: Zoho Hosting Product Evaluation

### Outcome: **Category B — Compatible with Specific Architectural Changes & Runtime Limitations**

A rigorous architectural evaluation of Zoho's hosting platforms against Sahyak CRM requirements yielded the following determination:

| Zoho Platform | Evaluation | Compatibility Status | Technical Justification |
|---|---|---|---|
| **Zoho Creator** | Low-code proprietary Deluge runtime | **INCOMPATIBLE (Category C)** | Cannot run arbitrary Node.js code, Express servers, Mongoose ODM, or npm dependencies. |
| **Zoho Catalyst Serverless Functions** (Advanced I/O / Event) | Stateless micro-functions with 10–30s execution limits | **INCOMPATIBLE (Category C)** | 1. **Persistent Connections:** Fails Baileys WhatsApp WebSocket sessions (`@whiskeysockets/baileys`).<br>2. **Long-Running Crons:** Cannot support 5-minute continuous Google Sheets polling sweeps or large campaign batch sends.<br>3. **In-Memory Cache:** In-memory rate limiters, auth caches, and IP blockers are flushed between invocations. |
| **Zoho Catalyst AppSail** | Managed standalone containerized PaaS runtime for Node.js (v18/v20) | **COMPATIBLE WITH CHANGES (Category B)** | 1. **Long-Running HTTP:** Runs long-running Node.js processes listening on assigned port.<br>2. **WebSockets:** Supports long-lived connections for WebSockets.<br>3. **Environment:** Full custom environment variable injection and custom domain mapping (`api.sahyak.com`). |

### Mandatory AppSail Architecture Requirements & Limitations:

1. **Port Binding (`X_ZOHO_CATALYST_LISTEN_PORT`):**
   - AppSail dynamically assigns listening ports via `process.env.X_ZOHO_CATALYST_LISTEN_PORT`.
   - *Code Fix Implemented:* `backend/server.js` was updated to listen on `process.env.X_ZOHO_CATALYST_LISTEN_PORT || process.env.PORT || 5000`.
   - `backend/app-config.json` was generated specifying `node server.js`, `stack: node20`, and `memory: 1024`.

2. **Single Container Instance Topology:**
   - Multi-container auto-scaling cannot be used without an external Redis instance. Sahyak CRM uses process-local caches (`authCache`, `countCache`, Baileys WhatsApp socket sessions).
   - The AppSail service must run as **1 persistent container instance** with `RUN_BACKGROUND_WORKERS=true`.

3. **MongoDB Atlas Egress IP Whitelisting:**
   - Zoho Catalyst AppSail runs on dynamic shared cloud egress IP pools and does not offer a single static outbound IP out-of-the-box.
   - *Network Security Recommendation:*
     - **Option 1 (Recommended):** If Zoho enterprise VPC/private gateway is unavailable, configure MongoDB Atlas IP Access List with Atlas API automation or allow access secured by TLS 1.3 + strong database username/password (minimum 32-character high-entropy secret).
     - **Option 2:** Route outbound database or external API traffic through an external static forward proxy (e.g. Squid on a micro VPS with an Elastic IP).

---

## 3. Production Blockers Identified & Remediated

| # | Component | Blocker / Risk Description | Severity | Remediation Implemented |
|---|---|---|---|---|
| 1 | **Backend Security** | `server.js` reflected any incoming `Origin` and set `Access-Control-Allow-Credentials: true`, permitting cross-origin CSRF/unauthorized access from any site. | **CRITICAL** | Replaced with strict origin allowlist (`ALLOWED_ORIGINS`, default: `https://app.sahyak.com,https://crm.sahyak.com`). Disallowed origins are rejected with 403 on preflight. |
| 2 | **Database Security** | `backend/src/config/db.js` printed cleartext `mongoUri` in startup logs, leaking MongoDB Atlas credentials into stdout/PM2 logs. | **HIGH** | Implemented regex URI credential masking (`//***:***@`) for both direct and retry connection logs. |
| 3 | **Startup Validation** | `backend/src/config/envValidator.js` failed to enforce `ENCRYPTION_KEY` in production, risking integration token encryption with dev defaults. | **HIGH** | Added fail-fast validation in `envValidator.js`: in production, `ENCRYPTION_KEY` / `INTEGRATION_ENCRYPTION_KEY` must be at least 32 characters and non-default. |
| 4 | **Hosting Port** | `server.js` only checked `PORT || 5000`. In Zoho AppSail, the port is passed as `X_ZOHO_CATALYST_LISTEN_PORT`. | **HIGH** | Updated `server.js` to bind to `X_ZOHO_CATALYST_LISTEN_PORT || PORT || 5000`. |
| 5 | **Frontend Callbacks** | Several frontend modals (`MetaConnectModal.jsx`, `CustomWebhookModal.jsx`, `whatsapp/page.js`) displayed `http://localhost:5000` or misspelled `sahyakcrm.com`. | **MEDIUM** | Updated callback generators to resolve to `https://api.sahyak.com` in production or when accessed via `app.sahyak.com`. |
| 6 | **Frontend Routing** | Direct page refresh on Cloudflare Pages for dynamic routes (`/leads/123`, `/colleges/456`, `/integrations`) risked 404 errors. | **MEDIUM** | Created comprehensive `frontend/public/_redirects` covering all 39 CRM routes, rewriting dynamic routes to their client shells. |
| 7 | **Frontend Headers** | Cloudflare Pages lacked HTTP security headers and caching directives. | **MEDIUM** | Created `frontend/public/_headers` specifying `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, and immutable static asset caching. |
| 8 | **Database Indexes** | Potential index creation conflicts and unindexed multi-tenant queries on `integrations`, `subscriptions`, and `campaigns`. | **MEDIUM** | Upgraded `backend/scripts/ensure_indexes.js` to idempotently ensure all critical compound indexes with `background: true`. |

---

## 4. Frontend & Backend Deployment Topology

```
                                  INTERNET
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            │                                                   │
  HTTPS Requests                                      HTTPS API & Webhooks
  (app.sahyak.com)                                    (api.sahyak.com)
            │                                                   │
            ▼                                                   ▼
┌───────────────────────┐                           ┌───────────────────────┐
│   CLOUDFLARE PAGES    │                           │  ZOHO CATALYST        │
│   (Edge CDN & Static) │                           │  APPSAIL CONTAINER    │
│                       │                           │                       │
│ - Next.js 16.2.10     │                           │ - Node.js 20 Express  │
│ - Serwist PWA (sw.js) │                           │ - server.js           │
│ - 39 Prerendered HTML │ ─── REST API / Bearer ───►│ - REST API Handlers   │
│ - Client-Side Hydrate │                           │ - In-Process Workers  │
│ - Strict CSP Headers  │                           │   (Campaigns, Crons)  │
└───────────────────────┘                           └───────────┬───────────┘
                                                                │
                                                      TLS 1.3 Encrypted
                                                      Connection Pool
                                                                │
                                                                ▼
                                                    ┌───────────────────────┐
                                                    │     MONGODB ATLAS     │
                                                    │   (Database Cluster)  │
                                                    │                       │
                                                    │ - Multi-Tenant Leads  │
                                                    │ - Encrypted Tokens    │
                                                    │ - Partial Indexes     │
                                                    │ - Idempotent Queues   │
                                                    └───────────────────────┘
```

---

## 5. Background Workers & Queue Resilience

- **Queue Storage:** Persistent MongoDB collection queues (`campaigns`, `lead_source_subscriptions`, `activities`).
- **Idempotency:** Webhook deliveries from Meta and Google utilize compound unique constraints and cryptographic hashes (`googleKeyHash`, `externalLeadId`), preventing duplicate lead creation even during network retries.
- **Process Model:** In AppSail, workers run in the same process via `RUN_BACKGROUND_WORKERS=true`. On a multi-process VPS/EC2 setup, `backend/ecosystem.config.js` cleanly isolates `crm-api` (`RUN_BACKGROUND_WORKERS=false`) from `crm-worker` (`RUN_BACKGROUND_WORKERS=true`).
- **Restart Recovery:** On process restart, `waSession.initSessions()` restores WhatsApp connections, and `campaignWorker.startWorker()` automatically resumes pending scheduled campaigns.

---

## 6. Verification & Test Evidence

| Test Suite | Command | Result | Verification Notes |
|---|---|---|---|
| **Frontend Static Build** | `npm run build` in `frontend/` | **EXIT 0 (PASS)** | All 39 routes compiled and exported to `frontend/out/` with zero missing static parameters. |
| **Self-Service Integrations** | `node tests/self_service_lead_integration.test.js` | **18 / 18 PASSED** | Multi-tenant lead ingestion, Meta/Google campaign routing, IDOR defense, and deduplication verified. |
| **Integration Architecture Audit** | `node tests/integration_architecture_audit.test.js` | **55 / 55 PASSED** | AES-256-GCM encryption, phone normalization, webhook challenge responses, rate limiting, and 100-lead batch query latency (<17ms) verified. |
| **Database Index Migration** | `node scripts/ensure_indexes.js` | **EXIT 0 (PASS)** | Idempotent index creation verified across leads, integrations, campaigns, users, and automations. |
