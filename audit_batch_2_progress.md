# Audit Batch 2 Implementation Progress

**Branch**: `fix/audit-batch-2`
**Base Commit**: `6b89880` (End of Batch 1)
**Started At**: 2026-11-08

## Commits & Status Tracker

| Issue / Phase | Task Description | Commit Hash | Test File | Status |
| :--- | :--- | :---: | :--- | :---: |
| **Phase 0 (1)** | `fix(batch1-followup): request-level idempotency on lead payment creation` | `25ba8d3` | `backend/tests/lead_payment_idempotency.test.js` | ✅ DONE |
| **Phase 0 (2)** | `fix(batch1-followup): preserve original phone and status with partial unique indexes on Lead` | `052b359` | `backend/tests/lead_soft_delete_partial_index.test.js` | ✅ DONE |
| **Phase 0 (3)** | `fix(batch1-followup): prune redundant Lead indexes and add composite updatedAt sort index` | `052b359` | `backend/tests/lead_soft_delete_partial_index.test.js` | ✅ DONE |
| **Phase 0 (4)** | `fix(batch1-followup): ensure companyId resolution in lead pre-save and scope memo cache` | `1d4fff6` | `backend/tests/lead_presave_tenant_fix.test.js` | ✅ DONE |
| **Phase 0 (5)** | `fix(batch1-followup): fail closed on unscoped lead queries when legacy mode disabled` | `86017cc` | `backend/tests/tenant_fail_closed.test.js` | ✅ DONE |
| **Phase 0 (6)** | `fix(batch1-followup): preserve default 200 limit on admin payment requests when query params absent` | `3e26bab` | `backend/tests/admin_payment_requests_pagination.test.js` | ✅ DONE |
| **B4** | `fix(deals): combine search and counselor role-scoping using and conditions` | `d02b6f6` | `backend/tests/deals_counselor_search.test.js` | ✅ DONE |
| **B5** | `fix(followups): validate date and enforce postpone remark on valid date postponements` | `e54388e` | `backend/tests/followup_postpone_validation.test.js` | ✅ DONE |
| **B3** | `fix(coupons): resolve counter drift and enforce atomic coupon redemption` | `eba57b3` | `backend/tests/coupon_atomic_redemption.test.js` | ✅ DONE |
| **B2** | `fix(pipeline): prevent stage ID corruption in lead status during pipeline delete and remapping` | `b8b98a6` | `backend/tests/pipeline_remap_status_integrity.test.js` | ✅ DONE |
| **B6** | `fix(leads): unify status and pipelineStage sync with central helper` | `32e46b2` | `backend/tests/lead_stage_status_sync.test.js` | ✅ DONE |
| **B1** | `fix(assignment): enforce maxActiveLeads in round-robin and weighted assignment with fallback` | `16b8255` | `backend/tests/assignment_max_active_leads.test.js` | ✅ DONE |
| **R7** | `fix(cache): enforce max size and periodic sweep on in-memory fallback caches` | `79d1eb0` | `backend/tests/cache_capacity_and_eviction.test.js` | ✅ DONE |
| **R6** | `fix(server): handle uncaughtException with graceful shutdown and exit code 1` | `cb6a7b7` | `backend/tests/uncaught_exception_resilience.test.js` | ✅ DONE |
| **R5** | `fix(followups): add capped 24h lookback and atomic claim to follow-up cron` | `fccb2f0` | `backend/tests/followup_cron_lookback_cap.test.js` | ✅ DONE |
| **R3** | `fix(cron): add mongo distributedLock for once-only recurring jobs` | `c457eba` | `backend/tests/distributed_lock.test.js` | ✅ DONE |
| **R1** | `fix(whatsapp): add distributed mongo lease and prevent 440 reconnect loops` | `8de1fa2` | `backend/tests/whatsapp_distributed_lease.test.js` | ✅ DONE |
| **R4** | `docs(infra): document manual secrets backup procedure for Render deployments` | `0c97b89` | N/A (Doc/Config) | ✅ DONE |
| **R2** | `docs(infra): audit and gate server background workers topology` | `d98ba0d` | N/A (Doc/Config) | ✅ DONE |
| **P1** | `perf(admin): replace N+1 agent performance queries with single aggregation` | `363bdd3` | `backend/tests/agent_performance_n_plus_one.test.js` | ✅ DONE |
| **P3** | `perf(leads): add deterministic tiebreaker and compound index for leads pagination` | `5b61bf8` | `backend/tests/leads_pagination_tiebreaker.test.js` | ✅ DONE |
| **P2** | `perf(leads): yield event loop and enforce row cap during PDF exports` | `ae62aff` | `backend/tests/pdf_export_event_loop.test.js` | ✅ DONE |
| **P4** | `perf(frontend): lazy load heavy leaf modals using next dynamic imports` | `f3a6b8d` | Next.js production build (`39/39` static pages) | ✅ DONE |
| **Test Runner** | `test(audit): add master test runner for batch 1 and batch 2 suites` | `1a1161e` | `backend/tests/run_audit_suites.js` | ✅ DONE |
