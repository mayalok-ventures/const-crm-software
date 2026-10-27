# SAHYAK CRM — Self-Service Lead Integration Setup & Operator Guide

**Target Audience:** Sahyak CRM Platform Administrators, DevOps Engineers, and Account Operators  
**Purpose:** Comprehensive operational guide to configure, launch, verify, and maintain live Meta and Google Ads lead integrations in production.

---

## 1. Required Backend Environment Variables

Configure these environment variables in your production environment (e.g. Docker `.env`, AWS ECS, or PM2 ecosystem config).

> [!CAUTION]
> Never commit real production secrets or API keys into version control. Store secrets in a secure secret manager (AWS Secrets Manager, GCP Secret Manager, or HashiCorp Vault).

```bash
# -------------------------------------------------------------
# Core Server Configuration
# -------------------------------------------------------------
NODE_ENV=production
PORT=5000
BACKEND_URL=https://api.yourdomain.com
FRONTEND_URL=https://crm.yourdomain.com
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/mobile-crm?retryWrites=true&w=majority

# -------------------------------------------------------------
# Security & Token Encryption (Mandatory in Production)
# -------------------------------------------------------------
JWT_SECRET=your_super_strong_random_jwt_secret_minimum_32_characters
INTEGRATION_ENCRYPTION_KEY=your_64_character_hex_or_base64_aes256_encryption_key

# -------------------------------------------------------------
# Meta Lead Ads & WhatsApp Business Platform
# -------------------------------------------------------------
META_APP_ID=your_meta_app_id_from_developer_dashboard
META_APP_SECRET=your_meta_app_secret_from_developer_dashboard
META_API_VERSION=v21.0
META_WEBHOOK_VERIFY_TOKEN=your_secure_random_meta_webhook_challenge_token
META_REDIRECT_URI=https://api.yourdomain.com/api/integrations/meta/oauth/callback

# -------------------------------------------------------------
# Google Ads Lead Form Webhook Configuration
# -------------------------------------------------------------
# Note: Google Ads Lead Form Webhook requires no external API keys on the server!
# Keys are generated uniquely per integration inside Sahyak CRM.
```

### Generating Strong Encryption Keys
To generate a cryptographically secure 256-bit AES encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Paste the 64-character output into `INTEGRATION_ENCRYPTION_KEY`.

---

## 2. Meta (Facebook & Instagram) Developer App Setup

To allow customers to connect their Facebook Pages and Lead Gen Forms via OAuth, you must configure a Meta Developer Application.

### Step 2.1: Create Meta Developer App
1. Go to [developers.facebook.com](https://developers.facebook.com) and log in.
2. Click **My Apps** → **Create App**.
3. Select **Other** as the use case → Click **Next**.
4. Choose **Business** as the App Type → Click **Next**.
5. Set the App Display Name (e.g., *Sahyak CRM Lead Sync*) and select your Business Account.

### Step 2.2: Add Products
1. In the App Dashboard, add **Facebook Login for Business**.
2. Add **Webhooks**.

### Step 2.3: Configure Facebook Login Settings
1. Navigate to **Facebook Login for Business** → **Settings**.
2. Under **Valid OAuth Redirect URIs**, enter the exact backend callback URL:
   ```text
   https://api.yourdomain.com/api/integrations/meta/oauth/callback
   ```
3. Save changes.

### Step 2.4: Configure Webhooks
1. In the App Dashboard, navigate to **Webhooks** → Select **Page** from the dropdown → Click **Subscribe to this object**.
2. Set Callback URL:
   ```text
   https://api.yourdomain.com/api/integrations/meta/webhook
   ```
3. Set Verify Token to match `META_WEBHOOK_VERIFY_TOKEN` from your `.env`.
4. Click **Verify and Save**. Meta will send a GET challenge request; Sahyak CRM will echo it and verify immediately.
5. In the fields list, locate **`leadgen`** and click **Subscribe**.

### Step 2.5: App Review & Permissions Checklist
For customers to connect their accounts in Live Mode, submit for Meta App Review with these permissions:
- `pages_show_list`: Allows the user to select which Facebook Pages to connect.
- `pages_read_engagement`: Allows reading Page metadata and form assets.
- `pages_manage_metadata`: Allows Sahyak to subscribe the Page to webhooks.
- `leads_retrieval`: Allows retrieving full customer answers from Meta Instant Lead Forms.
- `ads_read`: Allows reading ad set and campaign attribution metadata.

> [!NOTE]
> In **Development Mode**, only administrators, developers, and testers added under **App Roles** can connect their accounts without App Review.

---

## 3. Google Ads Lead Form Webhook Setup

Google Ads Lead Forms send leads directly to Sahyak CRM via HTTP POST webhooks configured inside Google Ads Manager. No Google Developer Token is required for this delivery path!

### Step 3.1: Generate Webhook Key in Sahyak CRM
1. Log in to Sahyak CRM as an Admin/Manager.
2. Navigate to **Integrations** → **Channels**.
3. Under **Google Ads**, click **Configure Webhook** (or **Generate New Key**).
4. Sahyak will generate:
   - **Webhook URL:** `https://api.yourdomain.com/api/integrations/google/webhook`
   - **Key (Secret):** A high-entropy 32-character string (e.g. `gkey_91f8a72b0c34e819a5...`).
5. Copy both the URL and Key.

### Step 3.2: Configure Google Ads Manager
1. Log in to [ads.google.com](https://ads.google.com).
2. Navigate to **Campaigns** → **Assets** (or **Ads & Assets**).
3. Click the **+** button → Select **Lead form**.
4. Create or edit your Lead Form asset.
5. Scroll down to the **Lead delivery option** section → Expand **Export leads via webhook**.
6. In **Webhook URL**, paste:
   ```text
   https://api.yourdomain.com/api/integrations/google/webhook
   ```
7. In **Key**, paste the key copied from Sahyak CRM.
8. Click **Send test data**.
9. Google will show: *"Test data sent. View your CRM to confirm receipt."*
10. Click **Save**.

---

## 4. Multi-Form to Campaign Group Routing Setup

To configure which forms route to which Campaign Groups:

### Step 4.1: Ensure Campaign Groups Exist
1. Navigate to **Campaigns** in Sahyak CRM.
2. Create your destination Campaign Groups:
   - Example 1: *Property Buyers Group* (Platform: All / Meta, Assignment: Round-Robin).
   - Example 2: *Seller Enquiries Group* (Platform: All / Meta, Assignment: Dedicated Agent Sunita).
   - Example 3: *Rental Leads Group* (Platform: All / Meta, Assignment: Dedicated Agent Rajesh).

### Step 4.2: Link Forms to Campaign Groups
1. Navigate to **Integrations** → **Channels**.
2. On your connected **Meta Ads** card, click **Select Page & Forms**.
3. Select your Facebook Page from the list.
4. Under **Default CRM Campaign Group**, select *Property Buyers Group*.
5. You will see all active Lead Gen Forms discovered from that page.
6. For each form, set its destination:
   - *Property Buyers Form* → Set to **Property Buyers Group**.
   - *Property Sellers Form* → Set to **Seller Enquiries Group**.
   - *Rental Inquiry Form* → Set to **Rental Leads Group**.
7. Click **Save & Subscribe Forms**.
8. Navigate to the **Lead Sources & Routing** tab: You will see each form listed with its destination group, lead counter, and healthy status badge!

---

## 5. End-to-End Verification & Testing

### How to Verify Meta Lead Ads
1. Open the [Meta Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing/).
2. Select your Facebook Page and Lead Form.
3. Click **Create Lead**.
4. In Sahyak CRM, navigate to **Integrations** → **Audit Log**:
   - You will see the incoming `leadgen` event recorded with status `completed`.
5. Open **Leads**:
   - The test lead will appear assigned to the counselor configured for that Campaign Group.
   - Origin attribution will clearly show: Source: `META`, Form Name, and Destination Campaign.

### How to Verify Google Ads
1. In Google Ads Manager (Lead Form asset editor), click **Send test data**.
2. In Sahyak CRM, navigate to **Integrations** → **Channels** → Google Ads card.
3. Under **Diagnostic Test**, click **Send Test Lead**.
4. Confirm the test lead appears in your pipeline with Google attribution and tag `TEST LEAD`.

---

## 6. Troubleshooting & Operational Runbook

| Symptom | Root Cause | Solution |
| :--- | :--- | :--- |
| **Meta webhook returns 403 Forbidden** | `META_WEBHOOK_VERIFY_TOKEN` mismatch. | Ensure the token entered in Meta matches `META_WEBHOOK_VERIFY_TOKEN` in `.env`. |
| **Meta webhook returns 401 Signature Verification Failed** | `META_APP_SECRET` incorrect or request body modified by a proxy. | Verify `META_APP_SECRET`. Ensure reverse proxies (Nginx/Cloudflare) pass the raw request body untouched. |
| **Google Ads webhook returns 401 Unauthorized** | Webhook key incorrect or modified in Google Ads. | Re-copy the key from Sahyak CRM into Google Ads Manager. If lost, click **Regenerate Key** in Sahyak CRM and update Google Ads. |
| **Leads appear under "Needs Review"** | Lead submitted without both phone and email. | Sahyak CRM never drops leads. Incomplete leads are safely flagged as `needs_review` for manual agent follow-up. |
| **Leads show 0 count in modal** | Cache delay or browser stale state. | Click the **Refresh** button in the modal or the Lead Sources tab. |
| **Form leads routing to default instead of selected group** | Form was added in Meta Ads Manager after initial connection. | Re-open **Select Page & Forms** in Sahyak CRM and assign the new form to its destination group. |
