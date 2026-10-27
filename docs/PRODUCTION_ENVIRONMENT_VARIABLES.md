# Sahyak CRM — Production Environment Variables & Secret Inventory

This document represents the definitive, audited production environment variable and secrets inventory for Sahyak CRM across **Cloudflare Pages (Frontend)**, **Zoho Catalyst AppSail / Host (Backend & Workers)**, and **GitHub Actions (CI/CD)**.

---

## 1. Variable Inventory Table

| Variable Name | Component | Purpose | Required? | Source | Production Scope | Secret? | Secure Generation Procedure | Safe Rotation Procedure | Missing-Value Behavior | Verification Method |
|---|---|---|---|---|---|---|---|---|---|---|
| `NODE_ENV` | Backend / Worker | Controls environment mode (disables dev mocks, enforces strict security) | **Required** | Host Env Config | Backend & Worker runtime | No | Set explicitly to `production` | Update in host console and restart | Defaults to `development` (fails security audits) | Checked at startup by `envValidator.js` |
| `PORT` | Backend | Port on which Express listens | **Optional** | Host Runtime | Backend runtime | No | Default `5000` or host assigned | Update env and restart | Defaults to `5000` | Process logs output listening port |
| `X_ZOHO_CATALYST_LISTEN_PORT` | Backend | Port assigned dynamically by Zoho Catalyst AppSail | **Conditional** (Zoho) | Zoho Catalyst AppSail | Backend container env | No | Injected automatically by Zoho runtime | N/A (platform controlled) | Falls back to `PORT` or `5000` | Express binds to `process.env.X_ZOHO_CATALYST_LISTEN_PORT` |
| `RUN_BACKGROUND_WORKERS` | Backend / Worker | Controls whether campaign queues, crons, and telemetry run in this process | **Required** | Host Env Config | Backend / Worker process | No | Set `true` for single container; `false` on API if separate worker | Update env and restart | Defaults to `true` | Log message on startup indicates worker mode |
| `MONGODB_URI` / `MONGO_URI` | Backend / Worker | MongoDB Atlas TLS connection string | **Required** | MongoDB Atlas Console | Backend & Worker runtime | **YES** | Create in Atlas: Database Access -> Add User (`readWrite` role) | Create new Atlas user, update URI on host, restart, revoke old user | **Fail-fast** (process exits immediately) | Verified via `GET /health/ready` (checks `readyState === 1`) |
| `JWT_SECRET` | Backend / Worker | HMAC key used to sign and verify user JWT authentication tokens | **Required** | Local CLI | Backend & Worker runtime | **YES** | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | Generate new secret, deploy with dual-token validation or scheduled user re-login | **Fail-fast** (startup aborted if < 16 chars) | Validated by `envValidator.js` on startup |
| `INTEGRATION_ENCRYPTION_KEY` / `ENCRYPTION_KEY` | Backend / Worker | 256-bit key for AES-256-GCM encryption of integration tokens & OAuth secrets | **Required** | Local CLI | Backend & Worker runtime | **YES** | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | Rotate via DB re-encryption script (decrypt old -> encrypt new) | **Fail-fast** (startup aborted in production if < 32 chars) | Validated by `envValidator.js` on startup |
| `ALLOWED_ORIGINS` | Backend | Comma-separated list of allowed CORS browser origins | **Required** | Architecture Spec | Backend runtime | No | Set to `https://app.sahyak.com,https://crm.sahyak.com` | Append new domains and restart | Defaults to `https://app.sahyak.com,https://crm.sahyak.com` | Checked via preflight `OPTIONS` requests |
| `FRONTEND_URL` | Backend | Canonical frontend URL for OAuth callback redirects and notification links | **Required** | DNS / Hosting | Backend runtime | No | Set to `https://app.sahyak.com` | Update env and restart | Defaults to `http://localhost:3000` (causes broken redirects) | Inspect OAuth initiation redirect parameters |
| `BACKEND_URL` | Backend | Canonical backend HTTPS URL (e.g. for generating self-serve webhook URLs) | **Required** | DNS / Hosting | Backend runtime | No | Set to `https://api.sahyak.com` | Update env and restart | Defaults to `http://localhost:5000` | Displayed in integration webhook instructions |
| `NEXT_PUBLIC_API_URL` | Frontend | Base API endpoint URL for axios clients | **Required** | Cloudflare Pages Env | Cloudflare Pages Build Env | No | Set to `https://api.sahyak.com/api` | Update in Cloudflare dashboard and trigger re-deploy | Falls back to `https://api.sahyak.com/api` in production build | Inspect network requests in browser DevTools |
| `NEXT_PUBLIC_BACKEND_URL` | Frontend | Base backend host URL for static media & uploads | **Optional** | Cloudflare Pages Env | Cloudflare Pages Build Env | No | Set to `https://api.sahyak.com` | Update in Cloudflare dashboard and trigger re-deploy | Derived automatically from `NEXT_PUBLIC_API_URL` | Inspect audio player / image URLs |
| `NEXT_PUBLIC_WA_NUMBER` | Frontend | Public WhatsApp business contact number for support | **Optional** | Business Profile | Cloudflare Pages Build Env | No | E.g., `918796475107` | Update in Cloudflare dashboard and re-deploy | Falls back to default support number | Displayed on pricing/help cards |
| `NEXT_PUBLIC_UPI_ID` | Frontend | Public UPI ID for offline subscription payments | **Optional** | Merchant Account | Cloudflare Pages Build Env | No | E.g., `8193948870-2@ybl` | Update in Cloudflare dashboard and re-deploy | Falls back to default UPI ID | Displayed on payment modal QR |
| `META_APP_ID` | Backend | Meta for Developers Application ID | **Conditional** (Meta Lead Ads) | Meta Developer Portal | Backend runtime | No | Copy from App Dashboard -> Basic Settings | Update in Meta App and host env | Disables Meta OAuth initiation | Meta connect modal returns configuration warning |
| `META_APP_SECRET` | Backend | Meta for Developers Application Secret | **Conditional** (Meta Lead Ads) | Meta Developer Portal | Backend runtime | **YES** | Copy from App Dashboard -> Basic Settings | Rotate in Meta App, update host env, restart backend | Disables Meta token exchange | OAuth exchange returns 400 |
| `META_VERIFY_TOKEN` | Backend | Webhook verification token matched with Meta Developer Portal | **Conditional** (Meta Lead Ads) | User Defined | Backend runtime | **YES** | `node -e "console.log(require('crypto').randomBytes(20).toString('hex'))"` | Update in Meta Webhooks dashboard & host env | Disables Meta webhook challenge verification | GET `/api/integrations/meta/webhook` returns 403 |
| `META_API_VERSION` | Backend | Graph API version | **Optional** | Meta Docs | Backend runtime | No | Default `v22.0` | Update string in host env | Defaults to `v22.0` | Graph API calls include version in URL |
| `META_REDIRECT_URI` | Backend | Meta OAuth redirect callback URI | **Conditional** (Meta) | Architecture Spec | Backend runtime | No | `https://api.sahyak.com/api/integrations/meta/oauth/callback` | Update in Meta App Login Settings and backend env | Defaults to localhost in development | Checked during Meta OAuth handshake |
| `GOOGLE_CLIENT_ID` | Backend | Google Cloud OAuth 2.0 Web Application Client ID | **Conditional** (Google Ads) | Google Cloud Console (Credentials) | Backend runtime | No | Copy from GCP APIs & Services -> Credentials | Update in GCP Console and host env | Disables Google Ads & Sheets OAuth connection | Google connect button reports missing client ID |
| `GOOGLE_CLIENT_SECRET` | Backend | Google Cloud OAuth 2.0 Web Application Client Secret | **Conditional** (Google Ads) | Google Cloud Console (Credentials) | Backend runtime | **YES** | Copy from GCP APIs & Services -> Credentials | Re-generate in GCP, update backend env, restart | Disables Google token exchange | Google OAuth callback returns error |
| `GOOGLE_REDIRECT_URI` | Backend | Google OAuth redirect callback URI | **Conditional** (Google) | Architecture Spec | Backend runtime | No | `https://api.sahyak.com/api/integrations/google/oauth/callback` | Update in Authorized Redirect URIs in GCP and backend env | Defaults to localhost | Checked during Google OAuth handshake |
| `GOOGLE_WEBHOOK_SECRET` | Backend | Legacy global secret for Google Ads lead form webhook | **Optional** (Legacy) | User Defined | Backend runtime | **YES** | Generated automatically per integration in self-serve | Update in Google Ads Webhook settings | Uses per-integration hashed keys (`gads_sec_...`) | Webhook controller validates per-integration keys |
| `RAZORPAY_KEY_ID` | Backend | Razorpay API Key ID | **Conditional** (Billing) | Razorpay Dashboard -> API Keys | Backend runtime | No | Copy from Razorpay Dashboard | Generate new key in Razorpay, update env, restart | Disables live checkout order generation | Checkout fails with key error |
| `RAZORPAY_KEY_SECRET` | Backend | Razorpay API Key Secret | **Conditional** (Billing) | Razorpay Dashboard -> API Keys | Backend runtime | **YES** | Copy from Razorpay Dashboard | Generate new key in Razorpay, update env, restart | Disables payment signature verification | Payment verification fails |
| `RAZORPAY_WEBHOOK_SECRET` | Backend | Secret used to verify Razorpay subscription webhook signatures | **Conditional** (Billing) | Razorpay Dashboard -> Webhooks | Backend runtime | **YES** | Generated in Razorpay Webhooks dashboard | Update webhook secret in Razorpay & host env | Disables automated subscription renewal via webhook | POST `/api/webhooks/razorpay` rejects unverified signatures |
| `META_WA_PHONE_NUMBER_ID` | Backend | Cloud API Phone Number ID for WhatsApp | **Conditional** (Cloud WA) | Meta WhatsApp Manager | Backend runtime | No | Copy from WhatsApp Manager -> API Setup | Update in Meta dashboard and host env | Falls back to Baileys QR-based engine | Cloud WhatsApp sending disabled |
| `META_WA_ACCESS_TOKEN` | Backend | Permanent System User Token for Meta WhatsApp Cloud API | **Conditional** (Cloud WA) | Meta Business Manager (System Users) | Backend runtime | **YES** | Generate in Business Manager with `whatsapp_business_messaging` | Generate new System User token and update env | Cloud API calls return 401 | Cloud WhatsApp message dispatch fails |
| `META_WA_BUSINESS_ACCOUNT_ID` | Backend | WhatsApp Business Account (WABA) ID | **Conditional** (Cloud WA) | Meta WhatsApp Manager | Backend runtime | No | Copy from WhatsApp Manager | Update in host env | Template synchronization disabled | Cloud WA template sync fails |
| `VAPID_PUBLIC_KEY` | Backend | Web Push Application Server Public Key | **Conditional** (Push Alerts) | Local CLI | Backend runtime | No | `npx web-push generate-vapid-keys` | Generate new pair, update backend & frontend | Generates ephemeral dev keys (warns in logs) | Push subscription registration |
| `VAPID_PRIVATE_KEY` | Backend | Web Push Application Server Private Key | **Conditional** (Push Alerts) | Local CLI | Backend runtime | **YES** | `npx web-push generate-vapid-keys` | Generate new pair, update backend & frontend | Push notifications fail to dispatch | Push dispatch logs |
| `VAPID_SUBJECT` | Backend | Mailto URL for Web Push identifying contact | **Conditional** (Push Alerts) | Architecture Spec | Backend runtime | No | `mailto:admin@sahyak.com` | Update env | Defaults to `mailto:admin@sahyak.com` | WebPush headers |
| `SMTP_HOST` | Backend | Outbound SMTP server hostname | **Optional** (Email) | Zoho Mail / Sendgrid / AWS SES | Backend runtime | No | E.g. `smtp.zoho.com` | Update in host env | Disables SMTP email sending | Test email dispatch from settings |
| `SMTP_PORT` | Backend | Outbound SMTP port | **Optional** (Email) | Mail Provider | Backend runtime | No | E.g. `465` (SSL) or `587` (TLS) | Update in host env | Defaults to `587` | Connection check on startup |
| `SMTP_SECURE` | Backend | Whether SMTP uses direct SSL (`true` for 465) | **Optional** (Email) | Mail Provider | Backend runtime | No | `true` or `false` | Update in host env | Defaults to `false` | SMTP handshake |
| `SMTP_USER` | Backend | SMTP username/email address | **Optional** (Email) | Mail Provider | Backend runtime | No | E.g. `noreply@sahyak.com` | Update in host env | Disables SMTP authentication | SMTP login error |
| `SMTP_PASS` | Backend | SMTP account or App Password | **Optional** (Email) | Mail Provider Security Settings | Backend runtime | **YES** | Generate App Password in Zoho Mail account | Revoke old App Password, generate new one, update env | Disables SMTP email sending | SMTP authentication error |
| `EMAIL_FROM` | Backend | Default From display name and address | **Optional** (Email) | Domain Email | Backend runtime | No | `"Sahyak CRM" <noreply@sahyak.com>` | Update in host env | Defaults to `noreply@sahyak.com` | Header on received emails |
| `CLOUDFLARE_API_TOKEN` | CI/CD | Scoped Cloudflare Pages deployment token | **Conditional** (CI/CD) | Cloudflare Dashboard -> API Tokens | GitHub Actions Secrets | **YES** | Create Custom Token: Cloudflare Pages Edit permission | Roll token in Cloudflare, update GitHub Secret | Manual Cloudflare Pages deployment required | GitHub Actions deploy step |
| `CLOUDFLARE_ACCOUNT_ID` | CI/CD | Cloudflare Account ID | **Conditional** (CI/CD) | Cloudflare Dashboard (Overview sidebar) | GitHub Actions Secrets | No | Copy from Cloudflare Dashboard URL or Overview | N/A | Cloudflare CLI deploy cannot locate account | GitHub Actions deploy step |

---

## 2. Classification Groups

### Group A: Core Production Requirements
These variables are mandatory for the application to start and operate securely. If any of these are missing in production, the application will either fail-fast on startup or reject incoming traffic:
1. `NODE_ENV=production`
2. `MONGODB_URI`
3. `JWT_SECRET`
4. `INTEGRATION_ENCRYPTION_KEY` (or `ENCRYPTION_KEY`)
5. `ALLOWED_ORIGINS`
6. `FRONTEND_URL`
7. `BACKEND_URL`
8. `NEXT_PUBLIC_API_URL` (in Cloudflare Pages Build Environment)

### Group B: Conditional Integration Requirements
These variables are required only when the corresponding third-party integration or billing module is enabled:
- **Meta Lead Ads:** `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_REDIRECT_URI`
- **Google Ads & Sheets:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- **Razorpay Subscriptions:** `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- **Meta WhatsApp Cloud API:** `META_WA_PHONE_NUMBER_ID`, `META_WA_ACCESS_TOKEN`, `META_WA_BUSINESS_ACCOUNT_ID`
- **Web Push Notifications:** `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

### Group C: Optional Feature Requirements
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` (Needed if utilizing direct system SMTP rather than user-connected Gmail/Zoho OAuth accounts)
- `NEXT_PUBLIC_WA_NUMBER`, `NEXT_PUBLIC_UPI_ID` (Controls fallback customer support numbers)
- `WA_AUTO_RECONNECT`, `WA_MIN_DELAY_MS`, `WA_MAX_DELAY_MS` (Controls Baileys rate limiting parameters)

### Group D: Deployment and CI/CD Requirements
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` (Only if deploying Cloudflare Pages via GitHub Actions rather than native Cloudflare GitHub App integration)

### Group E: Development and Test Variables
- In development/test mode, `JWT_SECRET` and `INTEGRATION_ENCRYPTION_KEY` have built-in fallback keys (`crm_jwt_secret_dev_key_2026` and `crm_default_integration_aes_key_32_bytes_2026`). In production, `envValidator.js` **strictly rejects** these default keys and halts startup.

---

## 3. Explicit Audit Findings

1. **Variables with Unsafe Hardcoded Fallbacks (Remediated):**
   - Cleartext MongoDB URI logging in `backend/src/config/db.js` was remediated to mask all credentials (`//***:***@`).
   - `backend/src/config/envValidator.js` was enhanced to enforce `ENCRYPTION_KEY` (min 32 characters) in production to ensure sensitive OAuth tokens are never encrypted with insecure keys.
   - CORS origin reflection in `backend/server.js` was remediated to enforce strict origin allowlisting against `ALLOWED_ORIGINS` (`https://app.sahyak.com`).
   - Frontend components (`MetaConnectModal.jsx`, `CustomWebhookModal.jsx`, `LeadsDetailClient.js`, `whatsapp/page.js`) that fell back to `localhost:5000` or contained typos (`sahyakcrm.com`) were updated to use `https://api.sahyak.com` in production.

2. **Variables that must be set in Cloudflare Pages:**
   - `NEXT_PUBLIC_API_URL=https://api.sahyak.com/api`
   - `NEXT_PUBLIC_BACKEND_URL=https://api.sahyak.com`
   - `NODE_ENV=production`

3. **Variables that must be set on Backend Host (Zoho AppSail / Container):**
   - `NODE_ENV=production`
   - `PORT=5000` (or automatic `X_ZOHO_CATALYST_LISTEN_PORT`)
   - `RUN_BACKGROUND_WORKERS=true`
   - `MONGODB_URI`
   - `JWT_SECRET`
   - `INTEGRATION_ENCRYPTION_KEY`
   - `ALLOWED_ORIGINS=https://app.sahyak.com,https://crm.sahyak.com`
   - `FRONTEND_URL=https://app.sahyak.com`
   - `BACKEND_URL=https://api.sahyak.com`
   - All active integration credentials (Meta, Google, Razorpay, etc.)

4. **Variables that are NEVER needed in Frontend:**
   - `MONGODB_URI`, `JWT_SECRET`, `INTEGRATION_ENCRYPTION_KEY`, `META_APP_SECRET`, `GOOGLE_CLIENT_SECRET`, `RAZORPAY_KEY_SECRET`, `SMTP_PASS`, `VAPID_PRIVATE_KEY`.
   - Never prefix server secrets with `NEXT_PUBLIC_`.
