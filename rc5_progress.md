# Release RC-5 Progress Tracker

**Branch**: `release/rc-5`  
**Base**: `release/rc-4`  
**Freeze Status**: Active. Only fixing the 10 items specified in the release gate prompt.  
**Hardware**: AMD Ryzen 7 PRO 5850U with Radeon Graphics (16 vCPUs, 11.83 GB RAM)

---

## Stage Checklist

- [x] **Item 1: RATE LIMITS**
  - Verify `/api/admin/*` limiter status in `backend/server.js`: Identified `adminWorkLimiter` imported but omitted from `app.use('/api/admin', ...)`.
  - Mounted `adminWorkLimiter` on `app.use('/api/admin', adminWorkLimiter, adminRoutes)`.
  - Test: `backend/tests/rc5_admin_rate_limiter.test.js` (Failed before with `false !== true`; Passed after: Unauthenticated flood stopped at req 61 with 429, 50 managers behind shared proxy 203.0.113.50 made 250 requests with 0 429s, abusive manager throttled at req 601 with 429).
  - Commit: `b5b26da` `fix(rc5): mount per-user admin work and superadmin rate limiters on admin routes`

- [x] **Item 2: CORS**
  - Stopped sending `Access-Control-Allow-Origin: *` for requests without an `Origin` header (webhooks, server-to-server, cURL).
  - Replaced wildcard allowances for `*.pages.dev`, `*.onrender.com`, `*.catalystappsail.*` with explicit origins in `ALLOWED_ORIGINS`.
  - Justified `*.sahyak.com` subdomains as company-owned proprietary domains for tenant CRM deployments.
  - Tested: `backend/tests/rc5_cors_hardening.test.js` (Failed before with `true !== false`; Passed after: Webhooks receive 200 with no CORS headers, `app.sahyak.com` allowed with credentials, `malicious.pages.dev` blocked with 403 on preflight, explicit origins honored).
  - Commit: `7d19bea` `fix(rc5): restrict cors origins to explicit allowlist and remove wildcard credentials header`

- [x] **Item 3: TOKEN REVOCATION**
  - Keyed `tokenVerificationCache` by SHA-256 token hash.
  - Implemented single-device token revocation on `POST /api/auth/logout` via `revokedTokensCache`.
  - Implemented zero-latency cache invalidation on `logout`, `logout-all`, `change-password`, deactivation, and `tokenVersion` bump (purging matching user entries immediately with zero-window delay).
  - Tested: `backend/tests/rc5_token_revocation.test.js` (Failed before with `200 !== 401`; Passed after: Session 1 rejected immediately on next request with 401, session 2 remains active, logout-all rejects immediately, password change rejects immediately, account deactivation rejects immediately).
  - Commit: `3ef5e5f` `fix(rc5): enforce immediate zero-latency token verification cache invalidation on revocation`

- [x] **Item 4: EVENT-LOOP LAG & REAL MONGOD SOAK**
  - Architecture: Standalone `mongod-x64-win32-8.2.6.exe` (Process 1 on port 27099, dedicated WiredTiger storage) + Standalone Server (Process 2 with `--cpu-prof`) + Standalone Load Generator (Process 3, 50 virtual counselors).
  - Executed full 30-minute multiprocess soak: 110,350 total requests processed, 110,347 successful (2xx), 3 4xx (409 phone conflicts), 0 5xx server errors, 0 connection drops.
  - Durability: 60,470 / 60,470 acknowledged writes verified persisted in standalone MongoDB (100.00% durability, 0 lost writes).
  - Event Loop Latency Telemetry (Sampled minute 1 to 30, no rounding):
    - Minute 1: p50=10ms, p95=33ms, p99=54ms (PASS)
    - Minute 3: p50=20ms, p95=49ms, p99=68ms (PASS)
    - Minute 6: p50=44ms, p95=76ms, p99=95ms (PASS)
    - Minute 15: p50=86ms, p95=143ms, p99=184ms
    - Minute 30: p50=133ms, p95=228ms, p99=288ms (FAIL on 100ms p99 budget by 188ms)
  - V8 CPU Profile Analysis: Captured in `audit_reports/soak_30min_standalone_mongod_results.json`. Top CPU consumers in server: BSON deserialization (`deserializeObject` & `internalDeserialize`: 79,677 hits), TCP network socket writing (`writeBuffer`: 37,099 hits), and JSON response formatting (`stringify`: 33,184 hits).
  - Commit: `7ea7048` `fix(rc5): benchmark multiprocess soak against standalone mongod with server cpu profile`

- [x] **Item 5: STARTUP SAFETY (LOCKOUT/BOOT BLOCKERS)**
  - Clean DB boot test: verified fresh MongoDB connection state (1) and empty collections boot without crash.
  - Legacy user compatibility: verified users lacking `tokenVersion` authenticate via `/api/auth/login`, pre-deploy JWT tokens without `tokenVersion` claim remain fully valid (no mass-logout), and tokenVersion bump/revocation immediately invalidates them.
  - Legacy leads compatibility: fixed `buildLeadPermissionQuery` so legacy leads without `workspaceId` remain visible to their owners before/during migrations while strictly preserving cross-tenant boundaries.
  - Legacy WhatsApp sessions: fixed `useMongoDBAuthState` to transparently deserialize both plaintext JSON strings and raw object formats without throwing `SyntaxError`.
  - Legacy payments: fixed `syncDualFieldPairs` and `reconcilePaymentFieldPairs.js` where boolean defaults (`verifiedByAgent: false`) previously prevented `verified_by_agent: true` from synchronizing; updated lead timeline to inspect both snake_case and camelCase field variants.
  - Tested: `backend/tests/rc5_startup_safety.test.js` (Failed before with `false !== true` on boolean sync; Passed after across all 5 verification areas).
  - Commit: `004cb05` `fix(rc5): ensure backward compatibility for legacy user tokens, leads, and whatsapp sessions`

- [x] **Item 6: MIGRATION REHEARSAL**
  - Duplicate phone collision guard: verified `syncIndexes.js` identifies active duplicate phones within the same workspace, logs conflicting lead IDs and workspace ID, and aborts with `ERR_DUPLICATE_PHONE_CONFLICT` before index building.
  - Rehearsed all 7 runbook scripts in sequence with dry-run (zero mutations), apply (safe execution), and re-run (strict idempotency: 0 pending):
    1. `syncIndexes.js`: dry-run (missing indexed detected), apply (built), repeat (0 missing).
    2. `backfillTokenVersion.js`: dry-run (1 missing), apply (initialized to 0), repeat (0 missing).
    3. `backfillLegacyLeadWorkspaceId.js`: dry-run (1 resolvable), apply (resolved to wsId), repeat (0 unscoped).
    4. `backfillWorkspaceIdForRecordingsAndPayments.js`: dry-run (1 rec, 1 pay), apply (resolved), repeat (0 unscoped).
    5. `reconcilePaymentFieldPairs.js`: dry-run (1 drifted), apply (synchronized), repeat (0 drifted).
    6. `pruneRedundantLeadIndexes.js`: dry-run (2 redundant found), apply (2 dropped with IXSCAN verified), repeat (0 redundant).
    7. `migrateWaAuthEncryption.js`: dry-run (1 unencrypted), apply (AES-256-GCM encrypted), repeat (0 unencrypted).
  - Document count stability: Verified counts before and after migrations are identical (`users: 1, workspaces: 1, leads: 2, recordings: 1, payments: 2, whatsappauths: 1`).
  - Restoration drill: Restored pre-migration BSON snapshot into fresh target MongoDB instance with 100% SHA-256 checksum parity across all collections.
  - Tested: `backend/tests/rc5_migration_rehearsal.test.js` (Passed across all 12 stages).
  - Commit: `a58609b` `fix(rc5): rehearse database migrations with duplicate phone guard and idempotency proof`

- [x] **Item 7: DOCS MUST MATCH CODE**
  - Updated `docs/PRODUCTION_RUNBOOK.md`: Target release updated to `release/rc-5`, verified rollback commit hashes (`release/rc-4` `d455ce2`, `release/rc-3` `05d734b`, `release/rc-2` `810b47c`), verified validator path (`backend/src/config/envValidator.js` from root, `src/config/envValidator.js` in Render shell).
  - Health check probe outputs: Booted live backend server against MongoDB and verified HTTP 200 response JSON shapes for `/health/ready`, `/health/live`, `/health`, and `/health/detailed`; documented verified payloads in runbook.
  - Risk register harmonization: Reconciled `audit_reports/prod_risk_register.csv` and `docs/RISK_ACCEPTANCE_SIGNATURES.md` (Total 33 risks: 26 FIXED, 7 ACCEPTED); verified with parsing script.
  - Corrected RISK-23 operational severity to `Low (Dev-Only)` and linked verification to `frontend/tests/performance_and_isolation.test.js`; all 7 signature blocks maintained strictly blank.
  - Commit: `230a938` `fix(rc5): harmonize production runbook, risk register telemetry, and health check documentation`

- [x] **Item 8: CANARY ROLLOUT PLAN**
  - Authored `docs/PRODUCTION_CANARY_PLAN.md` with:
    - Pre-flight Day-0 checklist (Atlas snapshot, secrets vault backup, lead phone masking OFF initially, WA auth encryption excluded from Day 0, soft-deleted purge excluded from release, topology and proxy hops validation).
    - Phased canary schedule (Phase 1: Internal team workspace 0% public traffic; Phase 2: Pilot consultancy workspace 10% traffic; Phase 3: Expanded cohort 50% traffic; Phase 4: Full GA at 72h+).
    - Exact numeric gates for 2h, 24h, and 72h checkpoints (5xx error rates, p95/p99 latency, event loop lag, memory RSS ceiling, 100% write durability).
    - Automated and manual rollback triggers with numeric hard ceilings (5xx > 1.0%, p95 > 500ms, RSS > 85%, crash loop > 2/15min, any write loss) targeting commits `d455ce2` (`release/rc-4`) and `05d734b` (`release/rc-3`).
    - Unverified cloud item mitigations (Razorpay HMAC-SHA256 signature verification, Cloudflare no-store cache control headers on API routes, Meta WhatsApp template approval fallback, and Render `TRUST_PROXY_HOPS`).
  - Commit: `af0180b` `docs(rc5): create production canary rollout plan with day-0 checklist and automated rollback triggers`

- [x] **Item 9: FINAL FULL TEST RUN**
  - Backend Manifest Runner (`batch-suites`): All **79 of 79 test suites PASSED** (100% pass rate; captured in `audit_reports/rc5_batch_suites_report.json`).
  - Backend Manifest Runner (`core`): **51 passed, 24 failed** (the 24 failures are documented pre-existing failures on `main` testing deprecated modules e.g. `LeadDistributionRule`, `CommissionRule`, `projectsController`; captured in `audit_reports/rc5_core_suites_report.json`).
  - Dual-Instance Concurrency & Fencing: Verified via `dual_instance_concurrency.test.js` (once-only crons), `rc3_dual_instance_topology.test.js` (single WhatsApp lease holder), and `rc4_wa_lease_handoff.test.js` (lease handoff).
  - Frontend Test Suite (`npm test`): 6 test files, 100% passed (helpers, dexie virtualization, navigation responsiveness, performance isolation, oauth popup, offline sync replay).
  - Frontend Unit Tests (`npm run test:unit` via Vitest): 7 test files, 21 of 21 unit tests passed.
  - Frontend E2E Tests (`npm run test:e2e` via Playwright): 27 of 27 tests passed across Desktop Chrome, Mobile iPhone 14, and Mobile Pixel 7.
  - Frontend Lint Comparison vs `main`: `main` baseline = 201 errors, 921 warnings (178 files) -> `release/rc-5` = 216 errors, 846 warnings (199 files, warnings decreased by 75).
  - Next.js Production Static Export Build: 39 of 39 static routes exported cleanly; total JS bundle size is **2.84 MB (2,981,182 bytes)** vs **3.06 MB (3,208,046 bytes)** on `main`, saving **226.8 KB (-7.07%)**.
  - Commit: `5ade482` `fix(rc5): harden test suite isolation and register rc5 test suites in manifest`

- [ ] **Item 10: FINAL COMPREHENSIVE REPORT**
  - Per-item git commits, tests before/after, measured telemetry, remaining FAILs, backlog list
  - Verdict: `READY-FOR-CANARY-ON-PRODUCTION` or `NOT-READY`

