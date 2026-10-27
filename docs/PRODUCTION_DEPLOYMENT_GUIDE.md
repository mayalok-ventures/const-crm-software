# Sahyak CRM — Production Deployment Operator's Guide

This step-by-step guide contains the exact procedures, menu paths, configuration parameters, and verification tests required to deploy Sahyak CRM to production.

---

## Stage 1: GitHub Repository & Release Preparation

1. **Verify Git Status:**
   - Ensure all changes from this readiness task are committed to your feature or release branch.
   - Do **NOT** commit any `.env` or `.env.local` files containing actual passwords or tokens.
2. **Review CI Workflow:**
   - A GitHub Actions CI pipeline is configured at `.github/workflows/ci.yml`.
   - On pull request or push to `main`, it automatically runs backend integration tests and frontend static build verification.
3. **Merge to Production Branch:**
   - Merge verified commits into your production branch (typically `main`).

---

## Stage 2: MongoDB Atlas Database Setup

### 2.1 Create Database User
1. Log into [MongoDB Atlas Console](https://cloud.mongodb.com/).
2. Select your Project and Cluster (M10+ recommended for production).
3. Navigate to: **Security** -> **Database Access**.
4. Click **+ Add New Database User**:
   - **Authentication Method:** Password
   - **Username:** `crm_app_prod`
   - **Password:** Generate a strong 32+ character random password. *(Keep safe; you will need this for the connection string).*
   - **Database User Privileges:** Select **Built-in Role** -> **Read and write to any database** (or restrict to database: `mobile-crm`).
5. Click **Add User**.

### 2.2 Configure Network Security (IP Access List)
1. In the Atlas Console, navigate to: **Security** -> **Network Access**.
2. Click **+ Add IP Address**:
   - Because Zoho Catalyst AppSail uses a shared dynamic cloud egress pool without static outbound IPs, you have two options:
     - **Option A (Standard Cloud PaaS):** Allow access from anywhere (`0.0.0.0/0`) with a comment `Zoho AppSail Egress`. Ensure you use a high-entropy password (32+ chars) and TLS encryption.
     - **Option B (VPC / Forward Proxy):** If using Zoho Catalyst Enterprise Private Network or a dedicated proxy VPS with a static Elastic IP, enter that specific `/32` CIDR address.
3. Click **Confirm**.

### 2.3 Obtain Connection String
1. Navigate to: **Deployment** -> **Database**.
2. Click **Connect** on your cluster.
3. Select **Drivers** (Node.js, version 5.5 or later).
4. Copy the connection string format:
   ```
   mongodb+srv://crm_app_prod:<password>@<cluster-host>.mongodb.net/mobile-crm?retryWrites=true&w=majority
   ```
5. Replace `<password>` with your generated user password and verify the database name is `mobile-crm`.

---

## Stage 3: Backend Deployment (Zoho Catalyst AppSail)

### 3.1 Initialize AppSail Service in Zoho Catalyst Console
1. Log into the [Zoho Catalyst Console](https://catalyst.zoho.com/).
2. Select or create your Project (e.g. `Sahyak-CRM-Production`).
3. In the left sidebar, navigate to: **Compute** -> **AppSail**.
4. Click **Create AppSail**:
   - **AppSail Name:** `sahyak-backend`
   - **Runtime Stack:** `Node.js 20`
   - **Instance Memory:** `1024 MB` (or `2048 MB` if running high-volume campaigns)
   - **Start Command:** `node server.js`
   - **Source Code Directory:** Select the `backend/` folder (or connect your GitHub repository).

### 3.2 Configure Backend Environment Variables
In the Zoho Catalyst AppSail console, navigate to: **AppSail** -> `sahyak-backend` -> **Configuration** -> **Environment Variables**. Add the following variables:

| Variable Name | Production Value / Instruction |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `5000` *(AppSail will inject `X_ZOHO_CATALYST_LISTEN_PORT` automatically)* |
| `RUN_BACKGROUND_WORKERS` | `true` |
| `MONGODB_URI` | *[Your Atlas connection string from Stage 2]* |
| `JWT_SECRET` | *[Generate via CLI: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`]* |
| `INTEGRATION_ENCRYPTION_KEY` | *[Generate via CLI: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`]* |
| `ALLOWED_ORIGINS` | `https://app.sahyak.com,https://crm.sahyak.com` |
| `FRONTEND_URL` | `https://app.sahyak.com` |
| `BACKEND_URL` | `https://api.sahyak.com` |
| `META_APP_ID` | *[From Meta for Developers Portal]* |
| `META_APP_SECRET` | *[From Meta for Developers Portal]* |
| `META_VERIFY_TOKEN` | *[Strong random token created for webhook verification]* |
| `META_REDIRECT_URI` | `https://api.sahyak.com/api/integrations/meta/oauth/callback` |
| `GOOGLE_CLIENT_ID` | *[From Google Cloud Console]* |
| `GOOGLE_CLIENT_SECRET` | *[From Google Cloud Console]* |
| `GOOGLE_REDIRECT_URI` | `https://api.sahyak.com/api/integrations/google/oauth/callback` |
| `RAZORPAY_KEY_ID` | *[From Razorpay Dashboard]* |
| `RAZORPAY_KEY_SECRET` | *[From Razorpay Dashboard]* |
| `RAZORPAY_WEBHOOK_SECRET` | *[From Razorpay Webhooks]* |

Click **Save & Deploy**.

### 3.3 Map Custom Domain (`api.sahyak.com`)
1. In Zoho Catalyst, navigate to: **Domain Mappings** -> **Custom Domains**.
2. Click **Add Custom Domain**:
   - **Domain:** `api.sahyak.com`
   - **Target Service:** Select your AppSail service (`sahyak-backend`).
3. Zoho will provide a CNAME target (e.g. `sahyak-backend.catalystappsail.zoho.com`).
4. In your DNS provider (e.g., Cloudflare DNS for `sahyak.com`):
   - **Type:** `CNAME`
   - **Name:** `api`
   - **Target:** *[Zoho Catalyst provided target hostname]*
   - **Proxy Status:** DNS Only / Grey-clouded (or Orange-clouded if using Cloudflare Full SSL mode).
5. Wait for SSL certificate validation in Zoho Console.

### 3.4 Verify Backend Health
Open a terminal or browser and query the health endpoints:
```bash
curl -i https://api.sahyak.com/health
curl -i https://api.sahyak.com/health/ready
```
**Expected Response:** HTTP 200 OK with `{"status":"HEALTHY","ready":true,"checks":{"mongodb":{"status":"HEALTHY"}}}`.

---

## Stage 4: Frontend Deployment (Cloudflare Pages)

### 4.1 Create Cloudflare Pages Project
1. Log into the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. In the left navigation, click: **Workers & Pages** -> **Create application** -> **Pages**.
3. Click **Connect to Git**:
   - Select your GitHub account and authorize Cloudflare.
   - Choose the `mobile-crm` repository.
4. Click **Begin setup**.

### 4.2 Configure Build Settings
Fill in the deployment configuration:
- **Project name:** `sahyak-crm-frontend`
- **Production branch:** `main`
- **Framework preset:** `None` (or `Next.js (Static HTML Export)`)
- **Root directory:** `frontend`
- **Build command:** `npm run build`
- **Build output directory:** `out`

### 4.3 Configure Frontend Build Environment Variables
Under **Environment variables (Advanced)**, add:
- `NODE_ENV` = `production`
- `NEXT_PUBLIC_API_URL` = `https://api.sahyak.com/api`
- `NEXT_PUBLIC_BACKEND_URL` = `https://api.sahyak.com`

Click **Save and Deploy**. Cloudflare will pull the code, install dependencies, run `next build --webpack`, and publish the prerendered pages to Cloudflare's global edge network.

### 4.4 Bind Custom Domain (`app.sahyak.com`)
1. In the Cloudflare Pages project, click the **Custom domains** tab.
2. Click **Set up a custom domain**.
3. Enter domain: `app.sahyak.com`.
4. Click **Continue**:
   - If your apex domain `sahyak.com` is already hosted on Cloudflare DNS, Cloudflare will automatically configure the CNAME record and issue an edge TLS certificate.
   - If DNS is hosted externally, add a `CNAME` record for `app` pointing to `sahyak-crm-frontend.pages.dev`.
5. Once active, visit `https://app.sahyak.com` in your browser. Verify the login page loads with zero console errors.

---

## Stage 5: External Integration Dashboards Configuration

### 5.1 Meta for Developers (Lead Ads & OAuth)
1. Go to [Meta for Developers](https://developers.facebook.com/apps/).
2. Select your App:
   - Navigate to: **App Settings** -> **Basic**: Verify `App Domains` includes `sahyak.com`, and Privacy Policy URL is `https://app.sahyak.com/privacy`.
   - Navigate to: **Facebook Login for Business** -> **Settings**:
     - Add to **Valid OAuth Redirect URIs**:
       `https://api.sahyak.com/api/integrations/meta/oauth/callback`
   - Navigate to: **Webhooks** -> **Page**:
     - **Callback URL:** `https://api.sahyak.com/api/integrations/meta/webhook`
     - **Verify Token:** *[Value matching your `META_VERIFY_TOKEN` env var]*
     - **Subscribed Fields:** `leadgen`

### 5.2 Google Cloud Console (Google Ads & Sheets OAuth)
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to: **APIs & Services** -> **Credentials**.
3. Edit your OAuth 2.0 Web Client:
   - **Authorized JavaScript origins:**
     - `https://app.sahyak.com`
   - **Authorized redirect URIs:**
     - `https://api.sahyak.com/api/integrations/google/oauth/callback`
4. Click **Save**.

### 5.3 Razorpay Dashboard (Subscriptions & Billing)
1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com/).
2. Navigate to: **Settings** -> **Webhooks**.
3. Click **Add New Webhook**:
   - **Webhook URL:** `https://api.sahyak.com/api/webhooks/razorpay`
   - **Secret:** *[Value matching `RAZORPAY_WEBHOOK_SECRET`]*
   - **Active Events:**
     - `subscription.authenticated`
     - `subscription.activated`
     - `subscription.charged`
     - `subscription.completed`
     - `payment.captured`
4. Click **Save Webhook**.

---

## Stage 6: Rollback Procedure

If a deployment encounters a critical failure:

### Frontend Rollback (Instant)
1. In Cloudflare Dashboard, go to **Workers & Pages** -> `sahyak-crm-frontend` -> **Deployments**.
2. Locate the previous working deployment.
3. Click the three dots (`...`) -> **Rollback to this deployment**.
4. The edge CDN instantly shifts traffic back to the previous static build with zero downtime.

### Backend Rollback
1. In Zoho Catalyst AppSail Console, navigate to `sahyak-backend` -> **Deployments**.
2. Select the previous build version and click **Redeploy**.
3. In case of database index issues, run `node backend/scripts/ensure_indexes.js` to ensure backward-compatible sparse indexes.
