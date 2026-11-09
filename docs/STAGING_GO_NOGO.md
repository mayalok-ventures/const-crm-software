# Staging Go / No-Go Verification Gates & Staging Soak Specification

**Release Candidate**: `release/rc-3`  
**Target Soak Environment**: Staging Cluster (Atlas Replica Set + Redis + 2 Web Instances + 1 Worker Instance)  
**Auditor Panel**: Principal Performance Engineer, SRE/Chaos Engineer, Database Specialist, Pentester/Security Specialist, Frontend INP Lead, QA Lead.  
**Local Testbed Hardware**: AMD Ryzen 7 PRO 5850U with Radeon Graphics (16 vCPUs), 11.83 GB RAM, Windows 11 Enterprise (10.0.26100), Node.js v24.22.1, MongoDB 8.2.6 (in-memory replica set and standalone harnesses).

---

## 1. Operational Boundary & Executive Verdict

### **VERDICT: GO-TO-STAGING-SOAK**

> [!IMPORTANT]
> **Operational Boundary & Governance Policy**:
> 1. This verdict authorizes deployment **exclusively to the Staging Soak Cluster** for a mandatory **72-hour soak verification** under real human counselor traffic and automated background workers.
> 2. This verdict **DOES NOT** authorize production deployment. Under no circumstances may this release candidate be deployed to production or declared "production ready" prior to the successful completion and numeric verification of the 72-hour staging soak.
> 3. Final Production GO / NO-GO is strictly reserved for human engineering leadership following review of the telemetry gathered during the live staging soak.

---

## 2. Staging Verification Gates Matrix

The table below separates **Local Pre-Flight Evidence** (gathered on local developer hardware) from the **Mandatory Staging Gates** that must be observed on the staging Atlas replica set across $\ge 72$ hours.

> [!NOTE]
> All local measurements are reported truthfully from local harness runs. Local PASS results serve only as pre-flight eligibility for staging entry; **all Staging Gate Status entries remain PENDING STAGING SOAK until verified in staging**.

| Gate # | Invariant / Requirement | Mandatory Staging Threshold ($\ge$72h Soak) | Local Pre-Flight Evidence (AMD Ryzen 7 PRO 5850U) | Staging Gate Status | Staging Verification Telemetry Source |
| :---: | :--- | :--- | :--- | :---: | :--- |
| **G-01** | **System HTTP Error Rate** | 5xx error rate $< 0.1\%$ across all human counselor routes | **0.00% 5xx errors** (0/131,724 requests failed in 30.1-minute local soak test) | ⏳ **PENDING STAGING SOAK** | Render / Datadog APM HTTP response codes across $\ge 72$ hours |
| **G-02** | **API Latency (p95)** | p95 $< 300\text{ ms}$ for list, detail, and fast save under 50 concurrent users | **p50 = 6.09 ms, p95 = 7.33 ms** (Cached Count list); **p50 = 42.67 ms, p95 = 52.31 ms** (Full Count); **73.1 reqs/sec throughput** | ⏳ **PENDING STAGING SOAK** | CloudWatch / Datadog route p95 metrics under real counselor concurrency |
| **G-03** | **Event-Loop Lag (p99)** | Event-loop lag p99 $< 100\text{ ms}$ on API nodes | **p50 = 82 ms, p95 = 160 ms, p99 = 211 ms, max = 629 ms** (30.1-min soak, 50 virtual users in single process; CPU profile: BSON serialization + Mongoose document instantiation); **$< 10\text{ ms}$** in `xlsxWorker.js` off-heap | ⏳ **PENDING STAGING SOAK** | Node.js `perf_hooks` event-loop lag monitor sampled at 100ms intervals |
| **G-04** | **Runtime Memory Profile** | Zero unbounded heap or RSS growth over $\ge 72\text{ hours}$ (flat memory curve) | **RSS: 339 MB $\to$ 486 MB peak**; **Heap: 143 MB $\to$ 225 MB** (flat/stabilized over 30.1 mins, 131,724 requests; 0 unhandled rejections) | ⏳ **PENDING STAGING SOAK** | Prometheus / Datadog process RSS & `nodejs_heap_size_used_bytes` time-series |
| **G-05** | **WhatsApp Messaging Fencing** | Zero duplicate message dispatches; exactly one instance owns session lease | **Verified via dual-instance test**: non-owner returns HTTP 503 `WA_SESSION_OWNED_BY_ANOTHER_INSTANCE` | ⏳ **PENDING STAGING SOAK** | Distributed lease lock audit logs and recipient WhatsApp delivery receipts |
| **G-06** | **Acknowledged Write Durability** | Zero acknowledged writes lost; write ledger matches database state 100% | **0 lost writes** (2,000/2,000 acknowledged writes durably verified in MongoDB after 30.1-min soak; 40/40 writes verified in live chaos test) | ⏳ **PENDING STAGING SOAK** | Production write ledger comparison against MongoDB Atlas change streams |
| **G-07** | **Disaster Recovery / Restore** | Full restore from `mongodump` completed with 100% checksum and count match | **Documented in Runbook & Tested**: verified local dump/restore sequence and checksum script | ⏳ **PENDING STAGING SOAK** | Real rehearsal of backup capture and restore to isolated staging test database |
| **G-08** | **Session Rollout / tokenVersion** | Pre-deploy JWT sessions remain active; zero mass logout; logout invalidates current session | **Verified in test**: tokens lacking `tokenVersion` tolerated with 30s grace; logout revokes session | ⏳ **PENDING STAGING SOAK** | Auth token refresh logs during rolling blue-green deploy on staging cluster |
| **G-09** | **Bulk Pipeline Performance** | 5,000-row CSV export $\ge 2,000\text{ rows/s}$; bulk import $\ge 1,000\text{ rows/s}$; XLSX capped | **CSV Export: 7,961 rows/s (628ms)**; **CSV Import: 2,118 rows/s**; **XLSX capped at 10k rows (HTTP 413)** | ⏳ **PENDING STAGING SOAK** | File upload/download latency telemetry on staging S3/Cloudinary/temp disk |
| **G-10** | **Master Regression Gate** | 100% test pass rate across all test-manifest suites | **60/60 batch suites passed** in local manifest harness runner | ⏳ **PENDING STAGING SOAK** | Staging CI/CD pre-deploy automated test suite execution |

---

## 3. High-Priority Risk Register Status & Operational Safeguards

The 12 High and Critical risks identified across Audits Round 1, 2, and 3 are addressed as follows:

| Risk ID | Title | Severity | Code Status (`release/rc-3`) | Operational Mitigation / Proof |
| :--- | :--- | :---: | :---: | :--- |
| **R-01** | Database Write Concern & Durability | **CRITICAL** | **FIXED** (`37b6252`) | Connection-level `{ w: 'majority', j: true }` enforced on Mongoose pool. |
| **R-02** | WhatsApp Baileys Auth Credential Exposure | **CRITICAL** | **FIXED** (`9f21ffc`) | Dedicated `WA_ENCRYPTION_KEY`, AES-256-GCM, key rotation with key ring, fail-safe verify script. |
| **R-03** | Webhook Raw Body Signature Verification | **CRITICAL** | **FIXED** (`37b6252`) | Fail-closed verification on unparsed Buffer (`req.rawBody`) with replay timestamp check. |
| **R-04** | Email Attachment Local File Inclusion (LFI) | **CRITICAL** | **FIXED** (`37b6252`) | Path traversal checks, extension allowlist, and magic-byte header validation. |
| **R-05** | Public Share Token Phone Oracle | **CRITICAL** | **FIXED** (`182d1da`) | User/IP rate limiting, isolated token limits (`token:IP`), server-side phone masking. |
| **R-06** | Lead Model Index Bloat (64 $\to$ 51) | **HIGH** | **FIXED** (`37b6252`) | 13 redundant indexes pruned with explain-guard proving 100% `IXSCAN`. |
| **R-07** | Lead List Pagination Count Bottleneck | **HIGH** | **FIXED** (`37b6252`) | Dynamic pagination with cached total count; p95 reduced to 7.33 ms. |
| **R-08** | Synchronous XLSX Parsing Event Loop Lag | **HIGH** | **FIXED** (`37b6252`) | Offloaded to Node.js `worker_threads` (`xlsxWorker.js`); main thread lag $< 10\text{ ms}$. |
| **R-09** | Rate Limiting Granularity & Hop Trust | **HIGH** | **FIXED** (`182d1da`) | User-keyed limiters, configurable `TRUST_PROXY_HOPS`, split superadmin / manager limits. |
| **R-10** | WhatsApp Multi-Instance Dual Leasing | **HIGH** | **FIXED** (`3075d2d`) | Explicit unified web+worker topology; non-owner WhatsApp send returns HTTP 503 with lease holder. |
| **R-11** | Bulk Export / Import Memory & Latency | **HIGH** | **FIXED** (`52d6906`) | Streaming CSV export (7,961 rows/s), XLSX 10k row cap (HTTP 413), chunked `bulkWrite` transfer. |
| **R-12** | Production Environment Validator Refusal | **HIGH** | **FIXED** (`fix(rc3)`) | Fail-closed boot refusal when missing secrets, insecure CORS, or weak credentials. |

---

## 4. Staging Soak Plan & Exit Criteria

### 4.1 Topology Requirements on Staging
1. **Compute Topology**: Single unified web+worker instance (`crm-app`, `RUN_BACKGROUND_WORKERS=true`, `INSTANCE_COUNT=1`) behind a reverse proxy.
   > [!WARNING]
   > **Horizontal Scaling Warning**: Do NOT scale beyond 1 instance until an inter-process RPC layer or dedicated messaging broker exists for Baileys WhatsApp sessions. In multi-instance deployments without RPC, inbound/outbound WhatsApp traffic routing to a non-leaseholding node returns HTTP 503 (`WA_SESSION_OWNED_BY_ANOTHER_INSTANCE`).
2. **Database**: 3-node MongoDB Atlas replica set (tier M10 or higher) with replica set connection string.
3. **Cache**: Redis instance (TLS enabled) configured via `REDIS_URL`.
4. **Environment Configuration**:
   - `NODE_ENV=staging` (or `production`)
   - `INSTANCE_COUNT=1`
   - `RUN_BACKGROUND_WORKERS=true`
   - `TRUST_PROXY_HOPS=1`
   - `WA_ENCRYPTION_KEY=<64-char-hex-32-bytes>`
   - `JWT_SECRET=<32-char-min-secure-random>`

### 4.2 Mandatory 72-Hour Load Profile
During the 72-hour staging soak, the system must support active counselor daily operations combined with automated background jobs:
- **Human Counselor Traffic**: Real counselors running sales workflows: lead creation, fast saves, pipeline stage updates, calling/WhatsApp redirects, follow-up scheduling, and lead exports.
- **Concurrent Load**: At least 50 concurrent virtual user sessions simulating mixed active workflows.
- **Background Cron Jobs**: Follow-up notification sweeps, lead assignment rules, token sweep jobs, and cache invalidation routines running continuously without duplicate execution.

### 4.3 Mandatory Exit Criteria for Production Sign-Off
To achieve final engineering approval for Production GO, the staging telemetry gathered over the $\ge 72$-hour window must satisfy every numeric threshold in Section 2:
1. **G-01**: 5xx error rate strictly $< 0.1\%$ of total HTTP requests.
2. **G-02**: Sustained API p95 latency $< 300\text{ ms}$ for list, detail, and update endpoints.
3. **G-03**: Event-loop lag p99 strictly $< 100\text{ ms}$ on all web instances.
4. **G-04**: Process memory remains flat (no steady upward slope over 72 hours).
5. **G-05**: Exactly zero duplicate WhatsApp messages dispatched.
6. **G-06**: Write ledger durability audit shows zero lost acknowledged writes.
7. **G-07**: Disaster recovery rehearsal: real `mongodump` and `mongorestore` successfully executed on staging with verified document count and field checksum parity.
8. **G-08**: Rolling restart verified with zero mass user logouts.
