# NPM Dependency Audit & Security Risk Evaluation
**Audit Date**: November 9, 2026  
**Auditor**: Panel (SRE, Security Engineer, Backend Lead)  
**Target Release**: `release/rc-2`

---

## 1. Executive Summary & Raw Output Metrics

| Scope | Total Direct/Transitive | Critical | High | Moderate | Low / Info | Fix Available | Production Runtime Impact |
|---|---|---|---|---|---|---|---|
| **Backend** | 430 packages | 0 | 1 | 4 | 0 | 0 direct (xlsx discontinued) | Isolated to Worker Thread |
| **Frontend** | 684 packages | 3 | 13 | 12 | 0 | Major bumps available | Zero (Dev/Build-time only) |

---

## 2. Backend Vulnerability Analysis & Risk Acceptance

### 2.1 Package: `xlsx` (High Severity)
- **Advisories**:
  - `GHSA-4r6h-8v6p-xvw6` (CVSS 7.8 - High): Prototype Pollution in SheetJS via corrupted workbook structures.
  - `GHSA-5pgg-2g8v-p4x9` (CVSS 7.5 - High): Regular Expression Denial of Service (ReDoS) during sheet formula parsing.
- **Upstream Status**: SheetJS discontinued public npm releases after 0.18.5 / 0.19.x; official fixes are hosted on a proprietary CDN. Upgrading via npm registry is not possible without breaking change / commercial license.
- **Exploitability Analysis in CRM Codebase**:
  - In `release/rc-1` / `release/rc-2`, all XLSX and CSV file parsing was decoupled from the main Express HTTP event loop and moved into an isolated Node.js worker thread (`backend/src/utils/xlsxWorker.js`).
  - **Magic-Byte Gating**: `backend/src/utils/fileMagicBytes.js` strictly verifies PKZIP magic bytes (`50 4B 03 04`) before any buffer is passed to `xlsx.read()`.
  - **Memory & Process Isolation**: The parsing runs in a dedicated worker thread with `resourceLimits: { maxOldGenerationSizeMb: 256 }`. Any prototype pollution is confined to the worker thread's isolated global object and terminated upon worker exit. It cannot pollute the main server process's Object prototype.
  - **ReDoS Mitigation**: Synchronous XLSX parsing row budget is enforced at 50,000 rows max; payloads larger than 50,000 rows return an immediate HTTP 413 Payload Too Large. Worker threads have an explicit 30-second timeout; if parsing exceeds 30 seconds, the thread is forcefully terminated.
- **Verdict**: **ACCEPTED WITH DEFENSE-IN-DEPTH CONTROLS**. The risk of main-process denial of service or prototype pollution is completely mitigated by worker sandboxing, magic-byte inspection, and row limits.

### 2.2 Package: `qs` via `express` (Moderate Severity)
- **Advisories**: `GHSA-4mjr-xmp4-gh2g`, `GHSA-6pq8-jhm2-2vcw` (CVSS 5.3 - Moderate).
- **Exploitability**: Query parser DoS when deep nested objects or commas are formatted unexpectedly.
- **Mitigation**: Express `extended: false` or body-parser strict options, combined with `rateLimiter` (100 req/min per IP) and WAF/Helmet, prevent continuous replay attack vectors.
- **Verdict**: **ACCEPTED FOR RC-2**. To be addressed in next scheduled minor Express bump.

### 2.3 Package: `uuid` via `node-cron` (Moderate Severity)
- **Advisories**: `GHSA-w5hq-g745-h8pq` (CVSS 7.5 - Moderate). Missing buffer bounds check in v3/v5/v6 when external buffer is passed.
- **Exploitability**: `node-cron` generates internal job identifiers via `uuid.v4()` without passing attacker-controlled binary buffers. No user-supplied input reaches `node-cron`'s UUID generator.
- **Verdict**: **ACCEPTED (Zero Exploitability)**.

---

## 3. Frontend Vulnerability Analysis & Risk Acceptance

### 3.1 Package: `vitest` / `@vitest/mocker` / `vite` (Critical Severity)
- **Advisories**: `GHSA-5xrq-8626-4rwp` (CVSS 9.8 - Critical). When Vitest UI server is listening, arbitrary file can be read and executed.
- **Scope**: `devDependencies` ONLY.
- **Production Impact**: ZERO. The CRM frontend is built as a static Next.js export (`output: 'export'`) distributed via CDN / static web server. Neither Vitest nor Vite runs in production. Vitest UI server (`vitest --ui`) is never launched or exposed to any network interface.
- **Verdict**: **ACCEPTED (Dev-only, no production presence)**.

### 3.2 Package: `@serwist/build`, `@serwist/next`, `zod` (High Severity)
- **Advisories**: `GHSA-mrhx-c7xc-m3w5` (CVSS 7.5 - High). Memory exhaustion in Zod during schema validation.
- **Scope**: Build-time Service Worker bundling via `@serwist/next`.
- **Production Impact**: ZERO. Only the precompiled, bundled client scripts (`public/sw.js`, `public/swe-worker-*.js`) are served in production.
- **Verdict**: **ACCEPTED (Build-time compiler toolchain only)**.

### 3.3 Package: `@typescript-eslint/*`, `eslint-config-next` (Moderate Severity)
- **Scope**: Linting toolchain. Zero production runtime artifact.
- **Verdict**: **ACCEPTED**.
