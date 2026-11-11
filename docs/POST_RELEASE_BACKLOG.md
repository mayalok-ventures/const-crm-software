# Post-Release Backlog & Non-Blocking Technical Debt

**Release**: `release/rc-5`  
**Policy**: Triage rule strictly enforced during release freeze. Only release blockers ((a) acknowledged-write loss, (b) cross-tenant data exposure or auth bypass, (c) user lockout / boot crash) were permitted in-tree. All non-blocking findings and architectural evolutions are tracked here for Milestone 2.

---

## Triage Item 1: Keyset Cursor Streaming & Late-Soak Event-Loop Optimization
- **Severity**: Medium (Performance Optimization)
- **Component**: `backend/src/controllers/leadsController.js`
- **Evidence**: Standalone multiprocess soak benchmarks revealed that as document counts exceed 60,000 active records on single-node disk, V8 BSON deserialization (`deserializeObject` & `internalDeserialize`: 79,677 CPU profile hits) and JSON serialization (`stringify`: 33,184 hits) cause event-loop lag to rise to p99 = 288ms at minute 30.
- **Recommended Action for Milestone 2**:
  - Migrate list pagination from standard `$skip`/`$limit` offsets to keyset cursor pagination (`_id < lastSeenId`) with lean field projections.
  - Implement streaming JSON serialization for large lead exports and list queries exceeding 50 items.

---

## Triage Item 2: Pre-Existing Legacy Prototype Core Test Suite Deprecation
- **Severity**: Low (Test Hygiene)
- **Component**: `backend/tests/` (24 suites in `core` category)
- **Evidence**: 24 out of 75 suites in the `core` category failed during the full manifest test run. All 24 are documented pre-existing failures originating on `main` before Audit Batch 1, attempting to import non-existent legacy files (e.g. `LeadDistributionRule.js`, `CommissionRule.js`, `projectsController.js`, `Project.js`).
- **Recommended Action for Milestone 2**:
  - Formally prune or rewrite obsolete test files to target the current unified controllers and workspace architecture.

---

## Triage Item 3: Distributed Inter-Process Message Bus (BullMQ) for Multi-Instance Scaling
- **Severity**: Medium (Architectural Evolution)
- **Component**: `backend/src/services/waSession.js`, `backend/server.js`
- **Evidence**: Baileys multi-device WebSocket connections live exclusively in the heap of the single worker process holding the distributed lease. In multi-instance deployments, non-leaseholder instances intercept outbound send attempts and return HTTP 503 `WA_SESSION_OWNED_BY_ANOTHER_INSTANCE`.
- **Recommended Action for Milestone 2**:
  - Deploy BullMQ / Redis PubSub RPC bus so secondary API instances can enqueue outbound WhatsApp messages to be dispatched by the worker node.

---

## Triage Item 4: Frontend Development Dependency Vulnerability Remediation
- **Severity**: Low (Dev-Only Dependency Maintenance)
- **Component**: `frontend/package.json` (`devDependencies`: `@serwist/next`, `zod`, `glob`)
- **Evidence**: Local `npm audit` reports 13 advisories confined strictly to `devDependencies`. Production builds compile ahead of time into a static export (`output: 'export'`) deployed to Cloudflare Pages CDN with zero Node.js runtime.
- **Recommended Action for Milestone 2**:
  - Upgrade `@serwist/next` to modern configurator mode once Turbopack stable support matures.
