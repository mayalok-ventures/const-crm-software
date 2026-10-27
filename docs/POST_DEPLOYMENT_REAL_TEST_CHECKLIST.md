# Sahyak CRM — Post-Deployment Verification Checklist

This document contains the verification checklist to be executed **after** the application has been deployed to live production infrastructure (`https://app.sahyak.com` and `https://api.sahyak.com`).

Tests are segregated into **Safe Smoke Tests** (harmless read/health checks), **Configuration & Functional Tests** (internal lead and routing checks), and **Customer-Facing Integration Tests** (must be conducted with test numbers and test ad accounts to avoid messaging real customers).

---

## Part 1: Harmless Smoke Tests (Execute Immediately)

- [ ] **1. Frontend Domain & TLS Certificate:**
  - Open `https://app.sahyak.com/login` in an incognito browser window.
  - Verify TLS certificate is valid, issued by Cloudflare / Google Trust Services, and shows HTTPS lock.
  - Check browser console (F12) for zero mixed-content warnings or failed script loads.

- [ ] **2. Static Assets & PWA Service Worker:**
  - Verify `https://app.sahyak.com/sw.js` returns HTTP 200 with service worker script.
  - Verify `https://app.sahyak.com/manifest.json` returns valid JSON with CRM application icons.

- [ ] **3. Backend Liveness & Readiness Endpoints:**
  - Query `curl -I https://api.sahyak.com/health` (Expect: HTTP 200 OK).
  - Query `curl -I https://api.sahyak.com/health/ready` (Expect: HTTP 200 OK with `{"status":"HEALTHY","ready":true}`).
  - Verify response does not leak internal MongoDB connection strings or server paths.

- [ ] **4. Cross-Origin Resource Sharing (CORS) Verification:**
  - In browser console on `https://app.sahyak.com`:
    ```javascript
    fetch('https://api.sahyak.com/api/plans').then(r => r.json()).then(console.log);
    ```
  - Verify response completes successfully with HTTP 200 without CORS errors.
  - Test unauthorized origin rejection:
    ```bash
    curl -H "Origin: https://malicious-site.example.com" -I -X OPTIONS https://api.sahyak.com/api/leads
    ```
    (Expect: HTTP 403 Forbidden or no `Access-Control-Allow-Origin` header).

- [ ] **5. Client-Side Deep Link Refresh (Cloudflare Rewrite Verification):**
  - Navigate to `https://app.sahyak.com/plans`.
  - Press `Ctrl + F5` (Hard refresh).
  - Verify the page re-renders the pricing catalog without returning a Cloudflare 404 error.

---

## Part 2: Authentication & Multi-Tenant Isolation Tests

- [ ] **6. SuperAdmin & Admin Login:**
  - Log in with the initial administrator account.
  - Verify JWT token is saved to `localStorage` under key `token`.
  - Verify initial dashboard metrics and workspace name load cleanly.

- [ ] **7. Workspace Switch & Role Verification:**
  - Verify user cannot access `/superadmin-dashboard` unless account holds `superadmin` role.
  - Verify team member invites can be sent and generate valid invite links (`https://app.sahyak.com/invite/<token>`).

- [ ] **8. Cross-Tenant IDOR Protection Check:**
  - Create two test tenant accounts (Tenant A and Tenant B).
  - Obtain an integration ID or lead ID from Tenant A.
  - Attempt to fetch or delete Tenant A's ID while authenticated as Tenant B.
  - Verify backend returns HTTP 404 Not Found (tenant isolation enforced).

---

## Part 3: Lead Ingestion & Integration Functional Tests

- [ ] **9. Self-Service Website Webhook Form Submission:**
  - In Tenant Admin, navigate to: **Integrations** -> **Website Forms**.
  - Create a new website form titled `Test Website Landing Page`.
  - Link it to a destination Campaign Group (e.g. `General Enquiries`).
  - Copy the generated Webhook URL and Form Key.
  - Send a test curl lead:
    ```bash
    curl -X POST "https://api.sahyak.com/api/integrations/website/submit/<form_key>" \
      -H "Content-Type: application/json" \
      -d '{"name":"Smoke Test Student","phone":"+919876500001","email":"teststudent@example.com","course":"B.Tech"}'
    ```
  - Verify HTTP 201 Created response.
  - In CRM, verify the lead appears under `General Enquiries` campaign group with Source `Website`.

- [ ] **10. Duplicate Lead Ingestion Idempotency:**
  - Resend the exact same curl request with the same phone number.
  - Verify backend responds with HTTP 200 (duplicate detected) and does **not** create a duplicate lead record.

- [ ] **11. Google Ads Lead Form Webhook Test:**
  - In **Integrations** -> **Google Ads**, obtain your per-integration Webhook URL.
  - In Google Ads Lead Form extension builder, click **Send Test Data**.
  - Verify lead appears in CRM with campaign attribution and phone number normalized to `+91`.

- [ ] **12. Meta Lead Ads Webhook Test (Via Meta Lead Ads Testing Tool):**
  - Go to [Meta Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing/).
  - Select your Page and Lead Ad Form.
  - Click **Create Lead**.
  - Verify CRM receives the webhook, attributes the lead to the linked form subscription, and assigns the configured counselor.

---

## Part 4: WhatsApp, Messaging & Background Worker Tests (CAUTION)

> [!CAUTION]
> Conduct these tests **only** using designated internal test phone numbers. Do not trigger bulk campaigns to real prospect lists during deployment validation.

- [ ] **13. WhatsApp QR Connection (Baileys Engine):**
  - Navigate to `/whatsapp`.
  - Scan the QR code using a dedicated business testing phone.
  - Verify status changes to `Connected` with green indicator.
  - Restart the backend process in Zoho AppSail console.
  - Wait 30 seconds and refresh `/whatsapp`; verify session auto-reconnects without requiring re-scan.

- [ ] **14. Single Test WhatsApp Message Dispatch:**
  - Send a single test message from a lead profile to your personal test mobile number.
  - Verify message is received on your device with correct variable substitution.

- [ ] **15. Follow-Up Due Notification Scheduler:**
  - Create a test lead with a follow-up scheduled 2 minutes in the future.
  - Wait for follow-up cron trigger.
  - Verify in-app bell notification and sound/push alert triggers when follow-up becomes due.

- [ ] **16. Google Sheets Poller Sweep:**
  - Connect a test Google Sheet with Mode B (Scheduled Polling).
  - Add a row with a new student name and phone.
  - Wait 5 minutes for the background poller sweep.
  - Verify lead is ingested and row status updates.

---

## Part 5: Logging, Recovery & Rollback Verification

- [ ] **17. Structured Logging & Secret Masking Verification:**
  - Inspect Zoho AppSail container logs in the Zoho Console.
  - Verify requests output structured JSON logs with `requestId`, `timestamp`, `status`, and `durationMs`.
  - Verify MongoDB URI logs show masked credentials (`//***:***@`) and zero plaintext tokens.

- [ ] **18. Worker & Container Restart Recovery:**
  - Trigger a manual restart of the AppSail container during an active session.
  - Verify `/health/ready` recovers to 200 OK within 10 seconds of container boot.
  - Verify no dropped database locks.
