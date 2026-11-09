# Production Deployment, Operations & Disaster Recovery Runbook

**Target Release**: `release/rc-2`  
**Platform**: Render (Web Service + Dedicated Background Worker) / MongoDB Atlas Replica Set / Cloudflare CDN  
**Verification Target**: Enterprise-grade CRM with strict financial durability, real-time counselor speed, and fail-safe configuration.

---

## 1. Release Overview & Architecture

### 1.1 Architecture & Separation of Concerns
To ensure counselor interactions achieve sub-100ms response times without interference from resource-intensive background processing, production workloads are split into two decoupled Render services sharing a common MongoDB Atlas Replica Set and Redis instance:

```mermaid
flowchart TD
    CF["Cloudflare Edge CDN (PWA Static Hosting & SSL)"] --> ALB["Render Load Balancer (Reverse Proxy)"]
    ALB --> WEB1["Web Instance 1 (RUN_BACKGROUND_WORKERS=false)"]
    ALB --> WEB2["Web Instance 2 (RUN_BACKGROUND_WORKERS=false)"]
    WEB1 --> ATLAS[("MongoDB Atlas Replica Set (Primary + Secondaries)")]
    WEB2 --> ATLAS
    WEB1 --> REDIS[("Redis Cache & Rate Limiting")]
    WEB2 --> REDIS

    WORKER["Render Background Worker Service\n(RUN_BACKGROUND_WORKERS=true, RUN_CRON_WORKERS=true)"] --> ATLAS
    WORKER --> REDIS
    WORKER --> WA["Meta / WhatsApp Cloud API & Baileys Sockets"]
```

1. **`crm-api` (Render Web Service)**:
   - Configured with `RUN_BACKGROUND_WORKERS=false`.
   - Dedicated solely to processing REST API endpoints, user authentication, live counselor searches, lead detail views, and fast saves.
   - Zero cron jobs or heavy background pollers run on this tier, guaranteeing uninhibited event-loop availability.
2. **`crm-worker` (Render Background Worker Service)**:
   - Configured with `RUN_BACKGROUND_WORKERS=true` and `RUN_CRON_WORKERS=true`.
   - Runs scheduled crons (`followUpReminders`, `campaignWorker`, `googleSheetsPollingService`, soft-delete purges).
   - Coordinates multi-instance cron execution using MongoDB distributed locks (`CronLock` collection with automatic TTL expiry).

---

## 2. Production Environment Variable Matrix & Validation

All production nodes execute the strict environment validator (`validateProductionEnv.js`) during startup. If any critical variable is missing, malformed, or insecure, the process **fails closed immediately** before binding ports or accepting traffic.

| Variable | Scope | Type / Format | Default | Description & Operational Security Rules |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Global | String (`production`) | `production` | Enforces production mode, disabling stack traces in API errors and enabling security headers. |
| `PORT` | API | Integer (e.g. `10000`) | `5000` | Injected dynamically by Render. Web process binds to `0.0.0.0:${PORT}`. |
| `MONGODB_URI` / `MONGO_URI` | Both | MongoDB URI (`mongodb+srv://...`) | *None* | Must point to MongoDB Atlas replica set. Connection-level write concern `{ w: 'majority', j: true }` is enforced by Mongoose. |
| `JWT_SECRET` | Both | Hex / Base64 (min 32 chars) | *None* | Primary cryptographic key for HMAC-SHA256 user authentication tokens. **Never regenerate on active deploy**. |
| `INTEGRATION_ENCRYPTION_KEY` | Both | 64-char Hex (32 bytes) | *None* | AES-256-GCM symmetric key used to encrypt OAuth tokens and integration credentials in database. |
| `WHATSAPP_AUTH_ENCRYPTION_KEY`| Both | 64-char Hex (32 bytes) | *Fallback to INTEGRATION*| Dedicated key for encrypting Baileys auth tokens (`WhatsAppAuthCredential`). |
| `REDIS_URL` | Both | Redis URI (`redis://...`) | *None* | Redis instance for multi-instance distributed rate limiting and token blacklists. |
| `RUN_BACKGROUND_WORKERS` | Global | Boolean (`true`/`false`) | `true` | Set to `false` on `crm-api` (web service); set to `true` on `crm-worker` (worker service). |
| `RUN_CRON_WORKERS` | Worker | Boolean (`true`/`false`) | `true` | Secondary switch for cron workers. Active on worker tier. |
| `RUN_WHATSAPP_WORKER` | Worker | Boolean (`true`/`false`) | `true` | Enables WhatsApp background listener loops on the worker service. |
| `ALLOWED_ORIGINS` | API | Comma-delimited URLs | *See db.js* | Permitted CORS origins (e.g., `https://crm.sahyak.com,https://app.sahyak.com`). |
| `RAZORPAY_KEY_ID` | Both | String | *Optional* | Razorpay API key ID for payment link generation. |
| `RAZORPAY_KEY_SECRET` | Both | String | *Optional* | Razorpay API key secret. |
| `RAZORPAY_WEBHOOK_SECRET` | Both | String | *Optional* | Secret used to verify raw HMAC SHA256 signatures on inbound webhook events. |
| `META_APP_SECRET` | Both | String | *Optional* | Meta App Secret for validating `X-Hub-Signature-256` on WhatsApp / Lead Ads webhooks. |
| `PUBLIC_SHARE_RATE_LIMIT_MAX` | API | Integer | `30` | Max public share link requests per IP per minute. |
| `ADMIN_RATE_LIMIT_MAX` | API | Integer | `30` | Max administrative operations per IP per minute. |
| `IMPORT_CONCURRENCY` | Worker | Integer | `4` | Max parallel chunks for background CSV/XLSX imports. |
| `MAX_IMPORT_FILE_SIZE_BYTES` | API | Integer | `52428800` | 50MB ceiling for uploaded import files. |

---

## 3. Pre-Flight Deployment Checklist

Before triggering a deployment to staging or production:

- [ ] **1. Secrets Backup**: Verify that `JWT_SECRET`, `INTEGRATION_ENCRYPTION_KEY`, and `WHATSAPP_AUTH_ENCRYPTION_KEY` are safely archived in team 1Password / HashiCorp Vault.
- [ ] **2. Database Connectivity & IP Access**: Ensure MongoDB Atlas Network Access whitelist contains Render outbound egress IPs or `0.0.0.0/0` with strong SCRAM-SHA-256 credentials.
- [ ] **3. Replica Set Health**: Confirm MongoDB Atlas cluster status is green with 0 replication lag and primary node healthy.
- [ ] **4. Backup Confirmation**: Verify Atlas automated continuous backup snapshot was completed within the last 15 minutes.
- [ ] **5. Environment Audit**: Run environment validator script locally against target environment variables:
  ```bash
  node backend/src/config/validateProductionEnv.js
  ```

---

## 4. Database Migration Sequencing

Database migrations in `release/rc-2` are strictly **idempotent**, supporting non-destructive dry-run previews before execution.

```mermaid
flowchart TD
    M1["1. syncIndexes.js (--apply)"] --> M2["2. backfillTokenVersion.js (--apply)"]
    M2 --> M3["3. backfillLegacyLeadWorkspaceId.js (--apply)"]
    M3 --> M4["4. backfillWorkspaceIdForRecordingsAndPayments.js (--apply)"]
    M4 --> M5["5. reconcilePaymentFieldPairs.js (--apply)"]
    M5 --> M6["6. pruneRedundantLeadIndexes.js (--apply)"]
```

### Step 4.1: Synchronize Base Indexes
Executes model index declarations safely with duplicate pre-checks:
```bash
# Preview
node backend/src/scripts/syncIndexes.js
# Apply
node backend/src/scripts/syncIndexes.js --apply
```

### Step 4.2: Backfill User `tokenVersion`
Initializes `tokenVersion: 0` for all legacy user documents missing this field:
```bash
# Preview
node backend/src/scripts/backfillTokenVersion.js
# Apply
node backend/src/scripts/backfillTokenVersion.js --apply
```

### Step 4.3: Backfill Workspace Isolation Identifiers
Ensures all orphaned leads, recordings, and payments are scoped to valid workspaces:
```bash
# Preview
node backend/src/scripts/backfillLegacyLeadWorkspaceId.js
# Apply
node backend/src/scripts/backfillLegacyLeadWorkspaceId.js --apply

# Preview
node backend/src/scripts/backfillWorkspaceIdForRecordingsAndPayments.js
# Apply
node backend/src/scripts/backfillWorkspaceIdForRecordingsAndPayments.js --apply
```

### Step 4.4: Reconcile Payment Field Pairs
Normalizes camelCase and snake_case payment schema inconsistencies:
```bash
# Preview
node backend/src/scripts/reconcilePaymentFieldPairs.js
# Apply
node backend/src/scripts/reconcilePaymentFieldPairs.js --apply
```

### Step 4.5: Prune Redundant Indexes with Explain-Guard
Drops 13 redundant indexes on `leads` collection while verifying that all top 10 query shapes remain index-backed (`IXSCAN`):
```bash
# Preview
node backend/src/scripts/pruneRedundantLeadIndexes.js
# Apply
node backend/src/scripts/pruneRedundantLeadIndexes.js --apply
```

---

## 5. Render Zero-Downtime Deployment Sequence

### Step 5.1: Deploy Background Worker First (`crm-worker`)
1. In Render Dashboard, select `crm-worker` -> Deploy Latest Commit (`release/rc-2`).
2. Verify worker startup logs:
   - `[Config] Production environment configuration verified successfully.`
   - `✅ MongoDB Connected: ... (majority journaled write concern)`
   - `[Cron] Initializing background workers...`
3. Confirm worker is healthy and taking distributed locks.

### Step 5.2: Rolling Deploy Web Service (`crm-api`)
1. In Render Dashboard, select `crm-api` -> Manual Deploy -> Deploy Latest Commit.
2. Render starts a new container instance and waits for the Kubernetes readiness probe:
   - Healthcheck URL: `GET /health/ready`
   - Initial delay: 5s, timeout: 5s, interval: 10s.
3. Once the new instance responds with `HTTP 200 {"ready": true, "checks": {"mongodb": {"status": "HEALTHY"}}}`, Render switches inbound traffic to the new instance and gracefully terminates the old instance via `SIGTERM`.

### Step 5.3: Deploy Frontend Static PWA (Cloudflare Pages / Vercel)
1. Build frontend static bundle:
   ```bash
   cd frontend
   npm run build
   ```
2. Deploy the `out/` directory to Cloudflare Pages.
3. Clients reloading the PWA will receive the updated Serwist service worker, caching new assets and invalidating obsolete bundles.

---

## 6. 24-Hour Canary & Post-Deployment Smoke Verification

Execute these verification checks immediately following deployment:

### 6.1 Service Readiness & Liveness
```bash
curl -f -s https://api.crm.sahyak.com/health/ready | jq .
```
*Expected*: HTTP 200 `{"ready": true, "checks": {"mongodb": {"status": "HEALTHY"}}}`.

### 6.2 Public Share Token Rate Limiting & Masking
```bash
# Request 1: Valid masked response
curl -s -i https://api.crm.sahyak.com/api/share/<validToken>
```
*Expected*: HTTP 200. Lead phone is masked (`+91 ••••• •1234`). Response includes `X-RateLimit-Limit: 30` and `X-RateLimit-Remaining: 29`.
```bash
# Rapid burst (31 requests):
for i in {1..35}; do curl -s -o /dev/null -w "%{http_code}\n" https://api.crm.sahyak.com/api/share/<validToken>; done
```
*Expected*: Responses 1–30 return HTTP 200; responses 31–35 return HTTP 429 (`Too many requests`).

### 6.3 Fail-Closed Webhook Signature Verification
```bash
# Forged signature test:
curl -X POST https://api.crm.sahyak.com/api/payments/razorpay-webhook \
  -H "Content-Type: application/json" \
  -H "X-Razorpay-Signature: forged_bad_hex_signature" \
  -d '{"event":"payment.captured"}'
```
*Expected*: HTTP 400 Bad Request (`Invalid webhook signature`).

### 6.4 Administrative Rate Limiting
```bash
# Test administrative endpoint rate limiting
for i in {1..35}; do curl -s -o /dev/null -w "%{http_code}\n" -H "Authorization: Bearer <ADMIN_TOKEN>" https://api.crm.sahyak.com/api/admin/users; done
```
*Expected*: Requests 31+ receive HTTP 429.

---

## 7. Operational Monitoring & Alerting Thresholds

Configure alerts in Render / Datadog / BetterStack with the following numeric triggers:

| Alert Metric | Warning Threshold | Critical Threshold | Action Required |
| :--- | :--- | :--- | :--- |
| **API p95 Latency** | > 200 ms for 5 min | > 300 ms for 3 min | Inspect MongoDB slow queries and slot connection contention. |
| **HTTP 5xx Error Rate**| > 0.5% for 5 min | > 1.0% for 2 min | Inspect application error logs; initiate rollback if spike follows deploy. |
| **Event Loop Lag** | > 50 ms for 2 min | > 100 ms for 1 min | Verify bulk imports are running in worker threads, not API main thread. |
| **Node.js Memory RSS** | > 75% container limit | > 85% container limit | Inspect heap dump for memory leak; restart worker if necessary. |
| **MongoDB Disk Usage** | > 75% allocated | > 85% allocated | Execute `purgeSoftDeletedLeads.js` or scale Atlas storage tier. |
| **Replication Lag** | > 2 seconds | > 5 seconds | Verify Atlas secondary health and network IOPS saturation. |

---

## 8. Emergency Rollback Procedures (Rehearsed in Stage F1)

In the event of an unrecoverable runtime regression or critical service degradation:

### 8.1 Application Code Rollback
Render supports instant one-click rollback to any prior release build:
1. Navigate to Render Dashboard -> `crm-api` -> **Deploys**.
2. Select the previous stable commit (e.g. `release/rc-1` or `fix/audit-batch-3`).
3. Click **Rollback to this deploy**.
4. Repeat for `crm-worker`.
*Rollback execution time: < 90 seconds (zero downtime)*.

### 8.2 Database Migration Rollback (DOWN Execution)
If a schema or data migration requires reversal:
- **User `tokenVersion`**:
  ```bash
  # Reverts tokenVersion to uninitialized state
  node backend/src/scripts/backfillTokenVersion.js --rollback
  ```
- **Index Restoration**:
  If pruned indexes need to be recreated immediately:
  ```bash
  node backend/src/scripts/syncIndexes.js --apply
  ```

### 8.3 Disaster Recovery: Database Point-in-Time Restore (PITR)
- **Target RPO (Recovery Point Objective)**: < 15 minutes.
- **Target RTO (Recovery Time Objective)**: < 30 minutes.

**Procedure for MongoDB Atlas**:
1. Log in to MongoDB Atlas Console -> Clusters -> Backup -> Point-in-Time Restore.
2. Select target timestamp (e.g. 5 minutes prior to incident).
3. Choose "Restore to a new cluster" or "Restore in-place".
4. If restoring to a new cluster, update `MONGODB_URI` in Render Environment Variables.

**Procedure for Local / Self-Hosted MongoDB**:
```bash
# Restore from daily compressed archive:
mongorestore --uri="${MONGODB_URI}" --archive=/backups/crm-backup-latest.archive.gz --gzip --drop
```
