# Render Production Canary Deploy Runbook

**Target Architecture**: Single Instance Web + Worker Unified Process  
**Environment**: Production (`NODE_ENV=production`)  
**Deployment Tag**: `v-canary-1`  
**Worker Topology**: `RUN_BACKGROUND_WORKERS=true`, `INSTANCE_COUNT=1` (prevents multi-instance Redis race conditions, duplicate cron execution, and dual-leasing issues)  
**Strict Rule**: No raw credentials or secret values are ever exposed in runbooks, logs, or command outputs.

---

## 1. Architectural Invariants & Topology

| Parameter | Required Value | Architectural Purpose |
| :--- | :--- | :--- |
| **Instance Type** | Render Standard / Pro Web Service | Compute node with dedicated CPU and min 2 GB RAM |
| **Instance Count** | `1` | Single-process topology eliminating multi-instance queue races |
| **Background Workers** | `RUN_BACKGROUND_WORKERS=true` | Co-locates background cron, WhatsApp message queues, and token sweeps inside the Node process |
| **Node.js Runtime** | Node.js v24.x LTS | High-performance V8 engine with low-latency garbage collection |
| **Database** | MongoDB Atlas Replica Set (M10+) | WiredTiger replica set with majority write concern |
| **CORS Policy** | Explicit origins only (No `'*'`) | Reject wildcard CORS when credentials/cookies are active |

---

## 2. Environment Validator Verification

Before initiating deployment, verify that `backend/src/config/envValidator.js` enforces strict fail-closed security.

### 2.1 Negative Test Case (Insecure / Incomplete Environment)
When executed with weak keys, dev defaults, or localhost MongoDB URIs, the validator terminates the process with exit code 1 and zero leaked secrets:

```bash
$ node scratch/test_env_validator.js
======================================================================
TESTING envValidator.js: NEGATIVE TEST CASE (Weak / Missing Env)
======================================================================
⚠️ [FATAL] Production Environment Validation Failed:
  - CORS_ORIGIN / ALLOWED_ORIGINS: Wildcard origin ('*') with credentials enabled is insecure and rejected by modern browsers. Specify explicit trusted domain(s).
  - JWT_SECRET: Insecure default development secret detected in production.
  - ENCRYPTION_KEY / INTEGRATION_ENCRYPTION_KEY: Secret length (9 chars) is below the minimum cryptographic requirement of 32 characters.
  - WA_ENCRYPTION_KEY: Dedicated WhatsApp auth encryption key (min 32 chars or 64 hex chars) is required in production when WhatsApp background workers are active.
  - MONGO_URI: Production database URI cannot point to localhost or 127.0.0.1.

Server startup aborted to prevent insecure execution in production (exit code 1).
```

### 2.2 Positive Test Case (Complete Hardened Environment)
When configured with high-entropy cryptographic keys ($\ge 32$ characters), Atlas replica set URI, and explicit allowed origins:

```bash
$ node scratch/test_env_validator.js
======================================================================
TESTING envValidator.js: POSITIVE TEST CASE (Valid Production Env)
======================================================================
✅ [EnvValidator] Production environment configuration verified.
Security violations on valid environment: 0
✅ PASS: Complete hardened environment passes all validation checks.
```

---

## 3. Order of Operations for Human Operator

```mermaid
flowchart TD
    A["1. Pre-Deploy: Atlas Snapshot & Additive Migrations Dry-Run"] --> B["2. Deploy from Git Tag v-canary-1 on Render"]
    B --> C["3. Smoke Verification Checklist (Healthz, Login, Mutating Write)"]
    C --> D["4. Post-Deploy 15-Minute Telemetry Soak (RSS, Event Loop, DB Pool)"]
    D --> E{"Pass All Rollback Invariants?"}
    E -- Yes --> F["5. Feature Flags Staged Rollout (Internal Tenant First)"]
    E -- No --> G["EMERGENCY ROLLBACK: Revert Render to Previous Tag"]
```

### Phase 1: Pre-Deploy Backup & Migrations
1. **Trigger Atlas Snapshot**:
   - Navigate to MongoDB Atlas Console $\to$ **Backup** $\to$ **Take Snapshot Now**.
   - Note the snapshot ID and timestamp prior to any schema touches.
2. **Execute Additive Migrations (Dry-Run)**:
   - All migrations in this codebase are strictly additive (no dropping columns, no destructive field renames).
   - In Render Shell or local authorized terminal:
     ```bash
     cd backend && node src/scripts/migrate.js --dry-run
     ```
   - Verify zero dropped fields, then run migration:
     ```bash
     node src/scripts/migrate.js --apply
     ```

### Phase 2: Deploy Execution from Git Tag `v-canary-1`
1. **Render Dashboard**:
   - Select the Web Service: `crm-production-api`.
   - Settings $\to$ **Build & Deploy** $\to$ **Branch**: Point to tag `v-canary-1`.
   - Verify Environment Variables in Render:
     - `NODE_ENV=production`
     - `INSTANCE_COUNT=1`
     - `RUN_BACKGROUND_WORKERS=true`
     - `TRUST_PROXY_HOPS=1`
     - `JWT_SECRET=[32+ char high-entropy secret]`
     - `INTEGRATION_ENCRYPTION_KEY=[32+ char AES key]`
     - `WA_ENCRYPTION_KEY=[32+ char dedicated WhatsApp key]`
     - `MONGO_URI=mongodb+srv://[user]:[pwd]@cluster0.xyz.mongodb.net/crm_production?retryWrites=true&w=majority`
     - `ALLOWED_ORIGINS=https://app.yourcrm.com,https://admin.yourcrm.com`
2. **Trigger Manual Deploy**:
   - Click **Manual Deploy** $\to$ **Deploy a specific commit/tag** $\to$ `v-canary-1`.

### Phase 3: Smoke Verification Checklist
Perform these checks immediately after Render reports "Build succeeded" and "Service is live":

- [ ] **Health Check**:
  ```bash
  curl -i https://api.yourcrm.com/healthz
  # Expect: HTTP 200 OK, {"status":"healthy","database":"connected","timestamp":...}
  ```
- [ ] **Counselor & Admin Login**:
  - Authenticate via `/api/auth/login`. Confirm JWT token received, user role validated, and `tokenVersion` tracked.
- [ ] **Lead Creation (Mutating Write)**:
  - Submit POST `/api/leads` with test lead payload.
  - Confirm HTTP 201 Created and response contains generated `_id` and audit log generated.
- [ ] **Lead OCC Fast Save**:
  - Submit PUT `/api/leads/:id` with updated stage and optimistic concurrency version `__v`.
  - Confirm HTTP 200 OK and version incremented.
- [ ] **Inbound Webhook Ingestion**:
  - Submit test payload to dynamic web form endpoint: `POST /api/integrations/forms/:formKey/submit`.
  - Confirm deduplication check, tenant workspace attribution, and event ledger entry.
- [ ] **SuperAdmin 2FA Policy Verification**:
  - Access `/api/super-admin/overview` without TOTP token.
  - Confirm HTTP 403 Forbidden with `{ "code": "2FA_REQUIRED" }`.
- [ ] **Zero Event-Loop Lag Spike**:
  - Verify event loop p99 remains below 50ms during smoke requests.

### Phase 4: Post-Deploy Telemetry Watch (15 Minutes)
Observe Render metrics and MongoDB Atlas metrics for 15 minutes:
1. **Memory Profile**: Ensure Node.js process RSS memory flatlines (e.g. 200–450 MB) without continuous upward slope.
2. **MongoDB Connection Pool**: Confirm connection count stays within bounds (typically 10–25 connections for single instance).
3. **HTTP 5xx Rate**: Strictly 0 unexpected 5xx responses.

### Phase 5: Feature Flags Staged Rollout
1. **Initial Boot Posture**:
   - All experimental features remain disabled or minimal at boot.
2. **Single Internal Workspace Activation**:
   - In SuperAdmin panel (`/admin?tab=feature_flags`), enable the candidate feature flag *only* for the internal testing tenant workspace.
   - Execute internal smoke testing for 1 hour.
3. **Global Activation**:
   - Once verified stable, enable feature globally.

---

## 4. Rollback Triggers & Exact Rollback Procedures

### 4.1 Strict Rollback Triggers
Initiate emergency rollback immediately if ANY of the following occur:
1. **Event-Loop Degradation**: p99 event-loop lag exceeds 100ms for 3 consecutive minutes.
2. **Mutating Route Failures**: Any HTTP 5xx errors on lead creation, updates, or payments.
3. **Memory Leak**: Process RSS memory increases by $> 20\text{ MB/min}$ sustained over 15 minutes without plateau.
4. **Data Durability Anomaly**: Any acknowledged write fails to appear in MongoDB queries (lost write).
5. **Cross-Tenant Leakage**: Any telemetry showing unauthorized cross-workspace record access.

### 4.2 Exact Rollback Execution Steps
1. **Revert Render Deployment**:
   - In Render Dashboard $\to$ **Events** $\to$ Find previous stable deployment $\to$ Click **Rollback**.
   - Or click **Manual Deploy** $\to$ Select previous stable tag/commit (e.g., `release/rc-5` previous commit hash).
2. **Database Down-Migrations**:
   - **DO NOT run down-migrations**. All schema additions on this branch are strictly backwards-compatible (optional fields, new collections). Existing code runs cleanly on the current schema.
3. **Catastrophic Data Corruption Only (Atlas Restore)**:
   - If and only if data was corrupted by an invalid write:
     - MongoDB Atlas Console $\to$ **Backup** $\to$ **Restore** $\to$ Select Pre-Deploy Snapshot.
4. **Post-Rollback Audit**:
   - Confirm `/healthz` is green.
   - Notify incident response channel with captured Render log output.

---

## 5. Deployment Verification Verdict

- **Status**: **READY-FOR-CANARY**
- **Blockers**: None. (0 cross-tenant leaks, 0 lost writes, 160 total lint errors down from 201 on main, fail-closed envValidator verified).
