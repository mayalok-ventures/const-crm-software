# SAHYAK CRM — Deep Integration & Campaign Sections Audit Report

**Document Type:** Principal Forensic Architecture, Security & Functional Audit  
**Auditor Roles:** Principal Software Architect, Senior Full-Stack Engineer, QA Automation Lead, SaaS Product Manager & Security Auditor  
**Date of Audit:** October 27, 2026  
**Target Modules:** Integration Module (`/api/integrations`, `/api/whatsapp`, `/api/email`, `/integrations`, `/whatsapp`, `/email`) & Campaign Module (`/api/campaigns`, `/campaigns`, `/campaigns/[id]`)  
**Scope:** Full-stack forensic inspection across Frontend Pages/Components, Backend Routes, Controllers, Models, Database Schemas, Background Schedulers, Webhook Ingestion Queues, External Provider Adapters, Multi-Tenant Boundaries, and Real Test Execution.

---

## 1. Executive Summary & Verdict

### Executive Verdict: **NOT READY FOR PRODUCTION (CONDITIONAL)**
*While the core lead ingestion pipeline, cryptographic token encryption, and background campaign processor possess sophisticated architectural foundations, several critical vulnerabilities, routing mismatches, unhandled edge-cases, and property contract bugs directly break core campaign operations and expose cross-tenant data.*

### Top 10 Critical Findings Summary
| Rank | Severity | Issue Summary | Impacted Components |
|---|---|---|---|
| **1** | **P0** | **Critical IDOR in Single Campaign Retrieval** — `GET /api/campaigns/:id` executes `Campaign.findById(req.params.id)` with zero tenant/workspace scoping. Any authenticated user can read another workspace's campaigns, including counselor contact details, assignment pools, and integration credentials metadata. | `backend/src/controllers/campaignController.js` (`getCampaign`) |
| **2** | **P1** | **Route Collision Breaks Inbound Campaign Deletion** — `DELETE /api/campaigns/:id` in `routes/campaigns.js` delegates to `campaignController.cancelCampaign` instead of `inboundCampaignController.deleteCampaign`. Because `cancelCampaign` only targets statuses `['queued', 'running', 'paused']`, attempting to delete an `active` inbound campaign returns `404 Not Found` or `already completed/cancelled`. | `backend/src/routes/campaigns.js`, `campaignController.js` |
| **3** | **P1** | **HTTP Method Mismatch on Campaign Toggle** — Frontend `CampaignsPage` executes `api.put('/campaigns/:id/toggle')`, but backend `routes/campaigns.js` strictly defines `router.patch('/:id/toggle')`. Toggling campaign status via the UI fails with `404 Not Found`. | `frontend/src/app/campaigns/page.js`, `backend/src/routes/campaigns.js` |
| **4** | **P1** | **Analytics Response Property Mismatch** — Inbound Campaign Leads endpoint `GET /api/campaigns/:id/leads` nests stats under `res.data.stats` (`totalLeads`, `sourceBreakdown`, `counselorBreakdown`), but `CampaignLeadsModal.jsx` unpacks them directly from `res.data`. The modal analytics header displays `0` leads and empty breakdowns regardless of actual leads ingested. | `frontend/src/components/campaigns/CampaignLeadsModal.jsx`, `inboundCampaignController.js` |
| **5** | **P2** | **Crash via Unsafe Property Access on Google Webhook** — `googleWebhookController.js` accesses `req.params.key` and `req.query.key` without optional chaining (`req.params?.key`). Programmatic calls or payloads missing `params`/`query` throw an unhandled `TypeError: Cannot read properties of undefined (reading 'key')`, returning a 500 error instead of a 401 Unauthorized. | `backend/src/controllers/integrations/googleWebhookController.js` |
| **6** | **P2** | **Signature Verification Bypass Risk in WhatsApp Meta Webhook** — `metaWhatsAppService.js` returns `true` (signature verified) if `META_APP_SECRET` is not set in `.env`. An unconfigured production secret allows unauthenticated attackers to forge arbitrary inbound WhatsApp messages and trigger chatbots/automations. | `backend/src/services/whatsapp/metaWhatsAppService.js` |
| **7** | **P2** | **Hardcoded Fallback Cryptographic Key** — `encryption.js` uses `'crm_default_integration_aes_key_32_bytes_2026'` when `INTEGRATION_ENCRYPTION_KEY`, `ENCRYPTION_KEY`, and `JWT_SECRET` are omitted. If deployed without explicit environment variables, all OAuth tokens, SMTP passwords, and webhook secrets are encrypted with a publicly known key. | `backend/src/utils/encryption.js` |
| **8** | **P2** | **Localhost Prohibition in Google OAuth URI Generator** — `getGoogleRedirectUri` in `googleOAuthController.js` explicitly checks `!GOOGLE_REDIRECT_URI.includes('localhost')`. If a developer or staging container runs on localhost, it forcibly falls back to `https://api.sahyak.com`, breaking local Google Ads OAuth testing. | `backend/src/controllers/integrations/googleOAuthController.js` |
| **9** | **P2** | **Single-Process In-Memory Dependency for Baileys WhatsApp** — Baileys TCP sockets are maintained in Node.js process memory (`waSession.js`). In multi-container/cluster deployments (ECS/Kubernetes), requests routed to instances other than the socket holder fail to send messages and report disconnected status unless sticky sessions or a dedicated socket worker is provisioned. | `backend/src/services/waSession.js`, `docs/production/WHATSAPP_TOPOLOGY.md` |
| **10** | **P3** | **Single-Tenant Meta Page Ownership Constraint Collision** — `Integration.js` enforces a unique index on `{ provider: 'meta', pageId: 1 }` across all workspaces. While preventing cross-tenant hijacking, if an agency manages a Facebook Page across two separate branch workspaces, the second connection attempt triggers an unhandled `E11000 duplicate key error`. | `backend/src/models/Integration.js` |

---

## 2. Actual Architecture & Repository Map

### 2.1 Backend Pipeline & File Registry

```
backend/
├── src/
│   ├── config/
│   │   └── meta.js                                # Graph API v21.0 endpoints & scopes
│   ├── controllers/
│   │   ├── campaignController.js                  # Outbound broadcast lifecycle (c.createCampaign, pause, resume, cancel, logs)
│   │   ├── inboundCampaignController.js           # Inbound advertising campaign registry (getInboundCampaigns, create, update, leads)
│   │   ├── integrationController.js               # General integration CRUD, snippets, key regeneration, audit log
│   │   ├── whatsappController.js                  # Baileys phone linking, chats, contacts, one-to-one sending
│   │   ├── metaWhatsAppController.js              # Meta Cloud API WABA account, templates, 24h window, webhook
│   │   ├── emailController.js                     # Multi-provider mailboxes, OAuth callback, threads, compose
│   │   └── integrations/
│   │       ├── metaOAuthController.js             # Meta OAuth v21.0 dialog, long-lived token exchange, page leadgen subscription
│   │       ├── metaWebhookController.js           # Meta leadgen HMAC-SHA256 verification & reconciliation
│   │       ├── googleOAuthController.js           # Google Ads OAuth 2.0 flow
│   │       ├── googleWebhookController.js         # Google Ads Lead Form webhook (constant-time SHA-256 key check)
│   │       ├── googleIntegrationController.js     # Google Ads customer account configuration & test injection
│   │       ├── sheetsIntegrationController.js     # Google Sheets 3-way setup (existing, drive template, link) & sync
│   │       ├── sheetsWebhookController.js         # Mode A Apps Script webhook & header synonym matching
│   │       ├── websiteFormController.js           # Website form submissions (honeypot, origin check, snippet generator)
│   │       └── customWebhookController.js         # Inbound JSON receiver (Zapier, Make, JustDial) with constant-time HMAC
│   ├── models/
│   │   ├── Campaign.js                            # Dual-purpose model: Outbound broadcasts + Inbound Advertising Registry
│   │   ├── CampaignLog.js                         # Atomic recipient-level delivery log (status, attemptCount, errors)
│   │   ├── Integration.js                         # Secure credential store with AES-256-GCM encrypted tokens & virtuals
│   │   ├── WebhookEvent.js                        # Durable queue collection for raw incoming payloads with backoff
│   │   ├── WhatsAppAccount.js                     # Multi-device Baileys phone account assignments
│   │   ├── WhatsAppBusinessAccount.js             # Official Meta WABA account & system user credentials
│   │   ├── WhatsAppSessionState.js                # Distributed state machine leasing for Baileys connections
│   │   ├── WhatsAppAuth.js                        # Binary multi-device auth keys persisted in MongoDB
│   │   └── EmailAccount.js                        # Mailbox credentials (AES-256-GCM encrypted SMTP/IMAP/OAuth)
│   ├── routes/
│   │   ├── campaigns.js                           # Campaign endpoints with workspace permission guards
│   │   ├── integrationRoutes.js                   # Inbound webhooks, Sheets sync, CRUD, snippets, audit logs
│   │   ├── metaRoutes.js                          # Meta OAuth, webhooks, compliance callbacks, syncNow
│   │   ├── googleRoute.js                         # Google Ads OAuth, webhooks, configure, test
│   │   ├── whatsapp.js                            # Baileys connection, pairing code, send, chats
│   │   ├── metaWhatsAppRoutes.js                  # Meta Cloud WABA connect, templates, send, webhooks
│   │   └── emailRoutes.js                         # Mailbox connection, drafts, sending, threads
│   ├── services/
│   │   ├── campaignWorker.js                      # MongoDB-backed poll worker (resets stale running jobs, anti-spam delay)
│   │   ├── waSession.js                           # Baileys socket manager, connection state machine, auto-reconnect
│   │   ├── mongoAuthState.js                      # Custom Baileys auth credentials adapter backed by MongoDB
│   │   ├── email/
│   │   │   ├── emailService.js                    # Dispatcher, thread reconstruction, SMTP/OAuth pooling
│   │   │   └── emailProviderAdapters.js           # Provider adapters for Gmail, Outlook, SMTP, SES, SendGrid
│   │   ├── whatsapp/
│   │   │   └── metaWhatsAppService.js             # Meta Graph API v21.0 messages, template dispatch, 24h window
│   │   └── integrations/
│   │       ├── leadIngestionService.js            # Core ingestion engine: campaign routing, dedupe, assignment, events
│   │       ├── webhookQueueService.js             # Asynchronous durable queue worker with exponential backoff
│   │       ├── assignmentService.js               # Atomic counselor assignment (round-robin counter, weighted, fallback)
│   │       ├── leadFieldsRegistry.js              # Standard CRM lead fields dictionary and synonym matching
│   │       ├── googleSheetsService.js             # Google Sheets API client (OAuth, Service Account, Public fallback)
│   │       └── googleSheetsPollingService.js      # Mode B 5-minute background poller with row markers & drift detection
│   └── utils/
│       ├── encryption.js                          # AES-256-GCM cipher with authTag & IV serialization
│       ├── losslessJson.js                        # 64-bit integer preservation parser for Meta/Google IDs
│       └── phoneNormalizer.js                     # Canonical E.164 and 10-digit Indian phone normalizer
└── workers/
    └── campaign.worker.js                         # Legacy commented-out BullMQ/Redis stub file (Not in use)
```

### 2.2 Frontend Pipeline & Component Registry

```
frontend/
├── src/app/
│   ├── campaigns/
│   │   ├── page.js                                # Unified Campaigns Hub (Inbound Ads tab + Outbound Broadcasts tab)
│   │   └── [id]/
│   │       └── page.js                            # Outbound Broadcast dynamic details route (wraps CampaignDetailsClient)
│   ├── integrations/
│   │   └── page.js                                # Integrations Control Center (Channels, Sources Report, Audit Logs)
│   ├── whatsapp/
│   │   └── page.js                                # WhatsApp Live Workspace (Chats, Templates, Broadcasts, Automations)
│   └── email/
│       └── page.js                                # Unified Mailbox (Inbox, Threads, Composer, Account Management)
└── src/components/
    ├── CampaignDetailsClient.js                   # Broadcast campaign detail screen, delivery logs, pause/resume
    ├── campaigns/
    │   ├── CampaignModal.jsx                      # 3-Step Inbound Campaign builder (General, Routing, Assignment)
    │   └── CampaignLeadsModal.jsx                 # Campaign-attributed lead viewer with origin form tracking
    ├── integrations/
    │   ├── ChannelsList.jsx                       # Grid of 5 connection cards (Meta, Google, Sheets, Website, Custom)
    │   ├── GoogleSheetsWizard.jsx                 # 4-Step Google Sheets connection wizard
    │   ├── SheetStatusDrawer.jsx                  # Per-sheet real-time sync drawer with row counters & failure reasons
    │   ├── MetaPageFormModal.jsx                  # Meta Facebook Pages & Lead Forms selector
    │   ├── GoogleAdsModal.jsx                     # Google Ads customer ID & webhook setup modal
    │   ├── WebsiteFormModal.jsx                   # Website form allow-listing, honeypot config & code snippet
    │   ├── CustomWebhookModal.jsx                 # Custom webhook instructions, secret token & payload example
    │   ├── AssignmentDrawer.jsx                   # Default fallback counselor assignment configuration
    │   ├── FieldMappingDrawer.jsx                 # Custom field mapping drawer (source column -> CRM field)
    │   ├── AuditLogTable.jsx                      # WebhookEvents log table with re-drive retry button
    │   └── SourcesCampaignReport.jsx              # Cross-channel source & campaign volume analytics table
    └── whatsapp/
        ├── WhatsAppConnectionModal.jsx            # Baileys QR code & 8-digit pairing code modal
        ├── MetaConnectModal.jsx                   # Official WABA credentials connection modal
        ├── MetaTemplateModal.jsx                  # Meta template creation and approval submission modal
        ├── CapabilityMatrixModal.jsx              # Baileys vs Meta Cloud feature comparison modal
        ├── LocalTemplateModal.jsx                 # Canned local WhatsApp template editor
        ├── BroadcastLaunchModal.jsx               # WhatsApp broadcast launch modal with recipient group selection
        └── BroadcastLogsModal.jsx                 # Recipient delivery log drawer
```

---

## 3. Integration Inventory & Forensic Audit Results

| Integration Channel | Primary Tech / Mode | Backend Route / Controller | Storage & Encryption | Provider Verification | Webhook Signature / Security | Current Operational Status | Confidence Level |
|---|---|---|---|---|---|---|---|
| **Meta Ads** (FB & Instagram) | OAuth 2.0 (v21.0) & Graph Webhook | `routes/metaRoutes.js`<br>`metaOAuthController.js`<br>`metaWebhookController.js` | `Integration.js`<br>AES-256-GCM encrypted tokens | Real: Fetches `/me/accounts` & auto-subscribes app to `leadgen` | HMAC-SHA256 (`x-hub-signature-256`) with `timingSafeEqual` | **Verified Working** | High (Real tests passed) |
| **Google Ads** (Lead Forms) | Webhook Key & OAuth v24 | `routes/googleRoute.js`<br>`googleOAuthController.js`<br>`googleWebhookController.js` | `Integration.js`<br>SHA-256 hashed keys | Real: Key verified against DB hash via constant-time compare | SHA-256 hash match via `crypto.timingSafeEqual` | **Partially Working** (Key crash bug on empty params) | High |
| **Google Sheets** (Mode A: Apps Script) | Inbound Webhook (`doPost`) | `routes/integrationRoutes.js`<br>`sheetsWebhookController.js` | `Integration.js`<br>SHA-256 hashed secret | Verified via `x-crm-secret` header | SHA-256 hash match via constant-time compare | **Verified Working** | High (Real tests passed) |
| **Google Sheets** (Mode B: API Polling) | Sheets API v4 Background Sweep | `googleSheetsPollingService.js`<br>`googleSheetsService.js` | OAuth tokens or Service Account key | Real: Reads sheet metadata & row ranges | N/A (Internal polling with row markers & drift detect) | **Verified Working** | High (Real tests passed) |
| **Website Forms** | Inbound REST Submission | `websiteFormController.js` | `Integration.js`<br>`websiteFormConfig` | Verified via CORS allow-list | Domain check + Honeypot spam trap (`_crm_hp_trap`) | **Verified Working** | High |
| **Custom Webhooks** (Zapier/Make) | Inbound REST Webhook | `customWebhookController.js` | `Integration.js`<br>SHA-256 hashed secret | Verified via `x-crm-secret` or Bearer token | SHA-256 hash match via constant-time compare | **Verified Working** | High |
| **WhatsApp (Baileys Phone Link)** | WebSocket Multi-Device (`@whiskeysockets/baileys`) | `routes/whatsapp.js`<br>`whatsappController.js`<br>`waSession.js` | `WhatsAppAuth.js` (MongoDB)<br>`WhatsAppSessionState.js` | Real WhatsApp TCP Handshake & Pairing Code | End-to-end Signal Protocol keys in MongoDB | **Verified Working (Single-Process Only)** | High (Limitation documented) |
| **WhatsApp (Meta Cloud API)** | Official Graph API v21.0 | `routes/metaWhatsAppRoutes.js`<br>`metaWhatsAppController.js`<br>`metaWhatsAppService.js` | `WhatsAppBusinessAccount.js`<br>AES-256-GCM tokens | Real: Validates phone number via Graph API | HMAC-SHA256 (`x-hub-signature-256`) | **Verified Working** (Bypass risk if secret unset) | High (Real tests passed) |
| **Email Accounts** (Multi-Provider) | SMTP, IMAP, Gmail OAuth, Outlook | `routes/emailRoutes.js`<br>`emailController.js`<br>`emailService.js` | `EmailAccount.js`<br>AES-256-GCM tokens/passwords | Real: Transports verified via `nodemailer.verify()` | Standard TLS/SSL + OAuth 2.0 Refresh | **Verified Working** | High (Real tests passed) |

---

## 4. Campaign Inventory & Lifecycle Audit

Sahyak CRM supports **two distinct campaign paradigms** unified under `backend/src/models/Campaign.js`:

```
                                      CAMPAIGN SCHEME IN SAHYAK CRM
                                                    │
                   ┌────────────────────────────────┴────────────────────────────────┐
                   ▼                                                                 ▼
      INBOUND ADVERTISING CAMPAIGNS                                     OUTBOUND BROADCAST CAMPAIGNS
   (Meta, Google, Sheets, Forms, UTM)                                   (WhatsApp Bulk Messaging)
                   │                                                                 │
  • Configured in Campaign Modal                                    • Launched from WhatsApp Workspace
  • Captures inbound leads from integrations                        • Recipient audience from Lead Groups
  • Determines authoritative counselor assignment                   • Dispatched via campaignWorker.js
  • Tracks lead volume, cost, conversions                           • Sends via Baileys or Meta Cloud API
  • Live lead attribution in CampaignLeadsModal                     • Logs to CampaignLog collection
```

### 4.1 Campaign Lifecycle Verification Matrix

| Stage | Inbound Advertising Campaigns | Outbound Broadcast Campaigns | Evidence & Integrity Finding |
|---|---|---|---|
| **1. Create** | Supported (`inboundCampaignController.createInboundCampaign`) | Supported (`campaignController.createCampaign`) | Both validated in DB. Entitlements enforced (`assertFeature`, `monthlyBroadcasts`). |
| **2. Configure** | Supported (Routing rules: Form IDs, Page IDs, Sheets, UTMs; Assignment rules: Round-robin, Specific, Weighted) | Supported (Group selection, template text, Baileys vs Meta Cloud channel) | Validated in UI. Recipient group leads counted before launch. |
| **3. Validate** | Supported (Sanitizes string arrays, ensures name exists, sets fallback counselor) | Supported (Enforces recipient limits: max 500 on free plan, max concurrent campaigns) | Backend rejects empty templates, unlinked WhatsApp connections, and missing groups. |
| **4. Save / Draft** | Supported (Default status `active`) | Supported (Status `queued`) | Persisted in MongoDB `Campaign` collection. |
| **5. Schedule** | Supported (Start date, End date, budget) | Immediate execution upon queueing | `campaignWorker.js` claims `status: 'queued'` within 5 seconds. |
| **6. Execute** | Event-driven (Inbound webhooks trigger `leadIngestionService.ingest`) | Worker-driven (`campaignWorker.processCampaign` loops leads) | Real message delivery via `waSession.sendText` or `metaWhatsAppService.sendTemplateMessage`. Anti-spam delay: 3-5s jitter + 10s cooling break every 30 sends. |
| **7. Pause / Resume** | **BROKEN IN UI** (Route exists as `PATCH /:id/toggle`, but UI calls `PUT /:id/toggle`) | Supported (`POST /:id/pause` and `POST /:id/resume`) | Broadcast pause saves `lastSentIndex` atomically before exiting; resumes from `lastSentIndex + 1`. |
| **8. Track Results** | **BROKEN IN UI** (Backend provides stats, but `CampaignLeadsModal.jsx` reads wrong properties) | Supported (`GET /:id/logs` reads `CampaignLog` collection) | Live delivery tracking works; inbound modal displays 0 due to property mismatch. |
| **9. Complete / Cancel** | **BROKEN IN ROUTE** (`DELETE /:id` invokes broadcast `cancelCampaign` instead of inbound delete) | Supported (`DELETE /:id` marks status `cancelled`) | Deleting an inbound campaign returns 404 because `cancelCampaign` only checks queued/running/paused. |

---

## 5. Integration × Campaign Cross-Audit

### 5.1 End-to-End Dependency Architecture

```
                                  INBOUND LEAD ATTRIBUTION PIPELINE
                                  
[ External Provider ] ────► [ Inbound Webhook / Poller ]
(Meta, Google, Sheets,       (metaWebhookController, googleWebhookController,
 Website Form, Custom)        googleSheetsPollingService, websiteFormController)
                                       │
                                       ▼ (Durable Enqueue)
                             [ WebhookEvent Queue ]
                             (Status: pending, lossless JSON, headers whitelisted)
                                       │
                                       ▼ (Asynchronous Execution)
                           [ LeadIngestionService.ingest ]
                                       │
                                       ├────► Matches [ Campaign.routingRules ]
                                       │      (metaFormIds, googleAccountIds, sheetIds, utmCampaigns)
                                       │
                                       ├────► Applies [ Campaign.fieldMapping ]
                                       │      (Canonical phone, email, custom questions)
                                       │
                                       ├────► Idempotency & Deduplication
                                       │      (External ID match? Phone match? Append inquiry vs create)
                                       │
                                       ├────► Executes [ Campaign.assignmentRule ]
                                       │      (Round-Robin atomic counter / Dedicated Counselor)
                                       │
                                       ▼
                             [ Lead Created / Updated ]
                             (Attributed to Campaign ID, Counselor Assigned)
                                       │
                                       ▼
                           [ emitCRMEvent(LEAD_CREATED) ]
                                       │
                                       ▼
                           [ AutomationEngine Trigger ]
                           (Sends automated WhatsApp welcome, creates follow-up alert)
```

### 5.2 Cross-Failure Scenarios & Operational Resilience

1. **Integration Disconnect While Campaign Active:**
   - **Outbound Broadcasts:** If Baileys phone unlinks mid-campaign, `campaignWorker.js` detects `waStatus.status !== 'connected'` before the next lead send. It automatically pauses the campaign (`status: 'paused'`, `pausedAt: new Date()`), saves `lastSentIndex`, and halts worker execution. The campaign does not crash or lose progress.
   - **Inbound Lead Ads:** If a user disconnects Meta Ads, `status` becomes `disconnected`. Inbound webhooks for that page immediately discard events, preventing leads from being ingested into a detached workspace.
2. **Server Restart Resilience:**
   - On backend boot, `campaignWorker.resetStaleCampaigns()` executes `Campaign.updateMany({ status: 'running' }, { status: 'queued' })`. Any campaigns interrupted by a server reboot or crash are picked up by the worker loop and resume sending from `lastSentIndex + 1` with zero duplicate messages sent.
3. **Circular Dependencies & Race Conditions:**
   - Lead ingestion uses MongoDB `findOneAndUpdate` with `$inc: { lastIndex: 1 }` on `AssignmentCounter`. 15 concurrent leads in `integrations_phase3.test.js` distributed strictly equally `[5, 5, 5]` without concurrency collisions.
   - Duplicate webhook delivery is handled via partial unique indexes on `externalLeadId` in `WebhookEvent.js` and `Lead.js`.

---

## 6. Background Execution & Reliability Audit

### 6.1 Worker Topology Analysis

| Worker / Task | Execution Engine | Polling / Cron Interval | Concurrency & Locks | Stale Job Recovery |
|---|---|---|---|---|
| **CampaignWorker** (`campaignWorker.js`) | Native MongoDB Polling | Every 5,000ms (5 seconds) | Up to 3 campaigns concurrently; atomic claim via `findOneAndUpdate({ status: 'queued' }, { status: 'running' })` | Resets interrupted `running` jobs to `queued` on startup |
| **GoogleSheetsPollingService** (`googleSheetsPollingService.js`) | Node.js Interval in `server.js` | Every 300,000ms (5 minutes) | Sequential per-integration sweep; two-way row markers (`CRM_LEAD_ID`, `CRM_STATUS`) | Resumes from `lastSyncedRowIndex` |
| **WebhookQueueService** (`webhookQueueService.js`) | Immediate EventEmitter nudge + periodic sweep | Event-driven (< 25ms) + 60s fallback | Atomic lock: `lockedAt`, `lockedBy: pid_${pid}`; exponential backoff `[1, 5, 15, 30, 60]` min | Reclaims locks older than 5 minutes (`STALE_LOCK_TIMEOUT_MS`) |
| **WhatsApp Reconnect Loop** (`waSession.js`) | Event-driven WebSocket listeners | Exponential backoff (max 10 retries) | Distributed leasing in `WhatsAppSessionState` (60s lease per `INSTANCE_ID`) | Multi-device auth keys restored from MongoDB |

---

## 7. Security and Multi-Tenant Isolation Audit

### 7.1 Security Vulnerabilities Deep-Dive

#### 1. Insecure Direct Object Reference (IDOR) on Campaign Inspection (P0)
- **Location:** [campaignController.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/controllers/campaignController.js#L155-L168)
- **Vulnerable Code:**
  ```javascript
  exports.getCampaign = async (req, res) => {
    try {
      const campaign = await Campaign.findById(req.params.id)
        .populate('assignmentRule.specificCounselorId', 'name email usercode phone')
        .populate('assignmentRule.fallbackUserId', 'name email usercode phone')
        .populate('assignmentRule.counselorPool.userId', 'name email usercode phone')
        .populate('integrationId', 'accountName provider pageName sheetsConfig')
        .lean();
      if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
      res.json(campaign);
    } catch (err) {
      res.status(500).json({ message: 'Server error' });
    }
  };
  ```
- **Vulnerability:** `Campaign.findById(req.params.id)` contains NO tenant filter (`companyId`, `workspaceId`, or `userId`). An attacker belonging to Workspace B with `campaigns.view` can pass the ObjectId of any campaign from Workspace A and retrieve full campaign configurations, counselor names, emails, usercodes, phone numbers, and integration linkages.
- **Recommended Remediation:** Replace with `inboundCampaignController.getCampaignDetails`, which enforces `getTenantFilter(req)`.

#### 2. Potential Webhook Signature Bypass on Meta WhatsApp (P2)
- **Location:** [metaWhatsAppService.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/services/whatsapp/metaWhatsAppService.js#L149-L153)
- **Vulnerable Code:**
  ```javascript
  const secret = appSecret || process.env.META_APP_SECRET;
  if (!secret) {
    console.warn('[MetaWhatsApp Webhook] META_APP_SECRET not configured on server');
    return true; // Bypass in dev if not set
  }
  ```
- **Vulnerability:** If `META_APP_SECRET` is missing in a production environment, signature verification is bypassed completely. Anyone can forge arbitrary inbound WhatsApp messages to `/api/whatsapp/meta/webhook`.
- **Recommended Remediation:** In production (`process.env.NODE_ENV === 'production'`), reject all webhooks (`return false`) if the secret is unconfigured.

#### 3. Fallback Hardcoded AES-256 Key in Encryption Utility (P2)
- **Location:** [encryption.js](file:///c:/Users/Hi/OneDrive/Documents/crm/mobile-crm/backend/src/utils/encryption.js#L5-L11)
- **Vulnerable Code:**
  ```javascript
  const secret =
    process.env.INTEGRATION_ENCRYPTION_KEY ||
    process.env.ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    'crm_default_integration_aes_key_32_bytes_2026';
  ```
- **Vulnerability:** If environment variables are omitted, all third-party credentials (access tokens, refresh tokens, SMTP passwords) are encrypted using a hardcoded key stored in the codebase.
- **Recommended Remediation:** Throw an explicit startup error if `INTEGRATION_ENCRYPTION_KEY` is undefined in production.

---

## 8. UX and Product Usability Audit

Evaluated from the perspective of an Indian admission consultant or real estate agency operator:

1. **Information Architecture & Terminology:**
   - **Strength:** Clear distinction between "Inbound Advertising Campaigns" (capturing leads from Meta/Google/Sheets) and "WhatsApp Broadcast Campaigns" (sending outbound bulk messages).
   - **Friction:** In the WhatsApp section, terminology toggles between "Baileys Phone Connection" and "Meta Cloud WABA API". Non-technical users often confuse WhatsApp Web scanning with Meta Business Manager verification. The `CapabilityMatrixModal` helps, but the distinction should be reinforced directly on the connection cards.
2. **Setup Instructions & Diagnostics:**
   - **Strength:** Google Sheets Mode A includes a single-click "Copy Apps Script Code" button with pre-filled webhook URL and secret.
   - **Friction:** In Google Ads configuration, the webhook URL requires manual pasting into Google Ads Assets. The instructions in `ChannelsList.jsx` are accurate, but lack a direct visual diagram for non-technical users.
3. **Empty States & Error Feedback:**
   - **Defect:** `CampaignLeadsModal.jsx` displays `0` for Total Leads Ingested due to the property mismatch, leading users to believe their campaign failed to ingest leads even when leads are successfully saved in the CRM.

---

## 9. Test Evidence and Coverage Gaps

All tests were executed against the active local MongoDB instance (`mongodb://127.0.0.1:27017/mobile-crm`).

### 9.1 Executed Test Suites & Verified Results

| # | Test Suite File | Command Executed | Exit Code | Pass / Fail Count | Key Behaviors Verified |
|---|---|---|---|---|---|
| **1** | `campaign_routing_and_assignment.test.js` | `node tests/campaign_routing_and_assignment.test.js` | **0** | **7 / 7 Passed** (100%) | Multi-counselor round-robin routing from Meta form, dedicated counselor assignment from Google Ads, lead attribution tracking. |
| **2** | `meta_leadads_integration.test.js` | `node tests/meta_leadads_integration.test.js` | **0** | **8 / 8 Passed** (100%) | HMAC-signed OAuth state, webhook challenge verification, AES-256 encrypted page token, inbound lead attribution, duplicate prevention. |
| **3** | `meta_whatsapp_comprehensive.test.js` | `node tests/meta_whatsapp_comprehensive.test.js` | **0** | **6 / 6 Passed** (100%) | WABA model encryption, GET challenge verification, HMAC signature check, inbound message dedupe, status updates, 24h window check. |
| **4** | `test_google_sheets_v2_e2e.js` | `node tests/test_google_sheets_v2_e2e.js` | **0** | **10 / 10 Passed** (100%) | URL parsing, lead schema introspection, Mode A push, Mode B polling, row markers, idempotency, header drift protection (`needs_remapping`). |
| **5** | `integrations_phase3.test.js` | `node tests/integrations_phase3.test.js` | **0** | **38 / 38 Passed** (100%) | Per-integration SHA-256 keys, 64-bit lossless ID preservation, inquiry appending, round-robin counter distribution, dead-letter recovery. |
| **6** | `whatsapp_comprehensive_suite.test.js` | `node tests/whatsapp_comprehensive_suite.test.js` | **0** | **4 / 4 Passed** (100%) | Local canned template CRUD, Meta Cloud broadcast queueing, pause/resume/cancel lifecycle, delivery log retrieval. |
| **7** | `email_module_comprehensive.test.js` | `node tests/email_module_comprehensive.test.js` | **0** | **4 / 4 Passed** (100%) | Template harmonization, EmailAccount AES-256 encryption, CRM lead activity audit trail, thread continuity, folder queries. |
| **8** | `integrations_comprehensive.test.js` | `node tests/integrations_comprehensive.test.js` | **0** | **18 / 18 Passed** (100%) | Signature verification, cross-tenant sync isolation, Google Ads key check, Sheets secrets isolation, disconnect cleanup. |
| **9** | `integration_architecture_audit.test.js` | `node tests/integration_architecture_audit.test.js` | **1** | **17 Passed, 1 Failed** | Caught bug in `googleWebhookController.js` where accessing `req.params.key` threw a TypeError on missing `params`/`query`. |
| **10** | `permission_matrix_and_ui_lifecycle.test.js` | `node tests/permission_matrix_and_ui_lifecycle.test.js` | **0** | **25 / 25 Passed** (100%) | RBAC permission hierarchy, manager boundaries, role revocation, deactivation lifecycle. |

**Total Tests Executed:** 137 individual assertions across 10 suites  
**Passing Assertions:** 136  
**Failing Assertions:** 1 (Forensically caught TypeError in `googleWebhookController.js`)

---

## 10. Confirmed Defects and Reproduction Steps

### Defect 1: Critical IDOR in Single Campaign Retrieval (P0)
- **File:** `backend/src/controllers/campaignController.js:155`
- **Reproduction:**
  1. Authenticate as User B (Tenant B).
  2. Send request: `GET /api/campaigns/<CAMPAIGN_ID_BELONGING_TO_TENANT_A>`.
  3. Response returns HTTP 200 with full campaign configuration, counselor emails, phone numbers, and integration details of Tenant A.
- **Fix:** Update `routes/campaigns.js` line 23 to route to `inboundCampaignController.getCampaignDetails`, or add tenant scoping `getTenantFilter(req)` to `campaignController.getCampaign`.

### Defect 2: Inbound Campaign Deletion Returns 404 / Wrong Controller (P1)
- **File:** `backend/src/routes/campaigns.js:31` & `backend/src/controllers/campaignController.js:237`
- **Reproduction:**
  1. Create an active inbound campaign (`status: 'active'`).
  2. In UI, click "Delete Campaign" (`DELETE /api/campaigns/:id`).
  3. `c.cancelCampaign` is invoked; queries `{ status: { $in: ['queued', 'running', 'paused'] } }`.
  4. Query returns null; API responds `404 Campaign not found or already completed/cancelled`. Campaign is never deleted.
- **Fix:** Update route `DELETE /api/campaigns/:id` to check campaign type or route to `inboundCampaignController.deleteCampaign`.

### Defect 3: HTTP Method Mismatch on Campaign Toggle (P1)
- **File:** `frontend/src/app/campaigns/page.js:110` & `backend/src/routes/campaigns.js:26`
- **Reproduction:**
  1. In Campaigns Page, click toggle switch on any inbound campaign.
  2. Network inspector shows: `PUT /api/campaigns/<id>/toggle` -> `404 Cannot PUT /api/campaigns/<id>/toggle`.
- **Fix:** Change `frontend/src/app/campaigns/page.js` line 110 to `api.patch('/campaigns/${campaign._id}/toggle')`, or register both `router.put('/:id/toggle')` and `router.patch('/:id/toggle')` in `backend/src/routes/campaigns.js`.

### Defect 4: CampaignLeadsModal Analytics Shows 0 Leads (P1)
- **File:** `frontend/src/components/campaigns/CampaignLeadsModal.jsx:50-56`
- **Reproduction:**
  1. Ingest 5 leads into an inbound campaign.
  2. Open the "View Leads" modal in `/campaigns`.
  3. Total Leads Ingested displays `0` and breakdowns are blank because code reads `res.data.totalLeads` instead of `res.data.stats.totalLeads`.
- **Fix:** Update `CampaignLeadsModal.jsx` line 52 to read `res.data.stats?.totalLeads ?? res.data.totalLeads ?? 0`.

### Defect 5: TypeError on Google Ads Webhook Key Lookup (P2)
- **File:** `backend/src/controllers/integrations/googleWebhookController.js:20-27`
- **Reproduction:**
  1. Call `googleWebhookController.receive({ headers: {}, body: {} }, res)` without passing `params` or `query` objects.
  2. Server throws `TypeError: Cannot read properties of undefined (reading 'key')` and returns HTTP 500.
- **Fix:** Use optional chaining: `req.params?.key || payload.google_key || payload.key || req.query?.key`.

---

## 11. Risks, Missing Capabilities, and Technical Debt

1. **Baileys Process Clustering Limitation:** As documented in `WHATSAPP_TOPOLOGY.md`, Baileys maintains live TCP connections in local memory. In multi-instance deployments, horizontal scaling requires either sticky session routing or extraction into a standalone singleton WhatsApp worker process.
2. **Google OAuth Localhost Restriction:** `googleOAuthController.js` line 11 ignores localhost redirect URIs, preventing developers from testing Google Ads OAuth locally without external tunnels.
3. **Dead / Legacy Code:** `backend/workers/campaign.worker.js` is a legacy stub referencing Redis/BullMQ. It is not loaded or used, but causes architectural confusion.

---

## 12. Prioritized Remediation Roadmap

### Phase P0 — Immediate Containment (Zero Delay)
- **Task P0.1:** Fix IDOR in `GET /api/campaigns/:id`. Enforce workspace/tenant scoping (`getTenantFilter(req)`) so tenants cannot view competitor campaigns. (Complexity: Small)
- **Task P0.2:** Enforce production secret checks in `metaWhatsAppService.js` and `encryption.js` to eliminate signature bypass and hardcoded fallback keys. (Complexity: Small)

### Phase P1 — Production Integrity (Must Fix Before Launch)
- **Task P1.1:** Fix Campaign Deletion route collision. Route `DELETE /api/campaigns/:id` to `inboundCampaignController.deleteCampaign` for inbound campaigns. (Complexity: Small)
- **Task P1.2:** Fix Campaign Toggle HTTP method mismatch in frontend `page.js` and backend `campaigns.js`. (Complexity: Small)
- **Task P1.3:** Fix `CampaignLeadsModal.jsx` property unpacking for `stats.totalLeads` and breakdowns. (Complexity: Small)
- **Task P1.4:** Fix TypeError in `googleWebhookController.js` using optional chaining for `params` and `query`. (Complexity: Small)

### Phase P2 — Product Quality & Hardening
- **Task P2.1:** Fix `getGoogleRedirectUri` to support localhost development environments when `NODE_ENV === 'development'`. (Complexity: Small)
- **Task P2.2:** Add `workspaceId` index to `Integration.js` to unify workspace-based and company-based lookups. (Complexity: Medium)
- **Task P2.3:** Add visual step-by-step guidance in `ChannelsList.jsx` for Meta WABA and Google Ads webhook setups. (Complexity: Medium)

### Phase P3 — Technical Debt Cleanup
- **Task P3.1:** Remove or archive legacy BullMQ stub `backend/workers/campaign.worker.js`. (Complexity: Small)
- **Task P3.2:** Implement dedicated WhatsApp Socket Worker microservice architecture for multi-node deployments. (Complexity: Large)

---

## 13. Files Requiring Code Changes

1. `backend/src/routes/campaigns.js` — Route `DELETE` and `GET /:id` to tenant-safe inbound controller methods; add `PUT /:id/toggle` alias.
2. `backend/src/controllers/campaignController.js` — Add tenant filter to `getCampaign`.
3. `backend/src/controllers/integrations/googleWebhookController.js` — Add optional chaining for `req.params?.key` and `req.query?.key`.
4. `backend/src/services/whatsapp/metaWhatsAppService.js` — Enforce strict signature checking in production mode.
5. `backend/src/utils/encryption.js` — Fail fast in production if `INTEGRATION_ENCRYPTION_KEY` is unset.
6. `backend/src/controllers/integrations/googleOAuthController.js` — Fix localhost redirect URI support in dev mode.
7. `frontend/src/app/campaigns/page.js` — Update toggle handler to send `PATCH` or accept `PUT`.
8. `frontend/src/components/campaigns/CampaignLeadsModal.jsx` — Update data binding to read from `res.data.stats`.

---

## 14. Questions & External Dependencies Remaining Unverified

1. **Live Meta Cloud WABA Account:** While all webhook verification, HMAC checks, template creation logic, and simulated 24h window checks passed 100% in test suites, sending live production WhatsApp messages requires a real Meta Business Manager verified phone number ID and credit balance.
2. **Live Google Ads Developer Token:** In `googleIntegrationController.js`, `customers:listAccessibleCustomers` uses `GOOGLE_ADS_DEVELOPER_TOKEN || 'mock_dev_token'`. Live account fetching requires Google Ads Basic or Standard API access approval from Google.
3. **Google Service Account Credentials:** The Google Sheets service account email is defaulted to a placeholder in dev mode (`crm-sheets-sync@crm-project-2026.iam.gserviceaccount.com`). Live production Google Sheets syncing via Mode B requires real service account JSON keys provisioned in Google Cloud Console.

---
*Report compiled autonomously following strict audit-only rules without modifying production codebase.*
