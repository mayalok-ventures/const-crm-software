# Render Secrets Management & Manual Backup Procedure

## Overview

In `render.yaml`, the `JWT_SECRET` and `INTEGRATION_ENCRYPTION_KEY` environment variables are configured with:

```yaml
  - key: JWT_SECRET
    generateValue: true
  - key: INTEGRATION_ENCRYPTION_KEY
    generateValue: true
```

## Render's Documented `generateValue` Behavior

1. **Initial Provisioning**:
   When Render creates the service for the first time from the blueprint, it generates a random, cryptographically secure string for each key with `generateValue: true`.

2. **Subsequent Deploys & Syncs**:
   Render preserves the existing generated value across git commits, manual deploys, and blueprint syncs for the lifetime of that service.

3. **Critical Disaster Recovery Risk**:
   If the Render service is **deleted and recreated**, or if a new secondary service is spun up (e.g. for staging or disaster recovery), Render will generate a **new** value:
   - **`INTEGRATION_ENCRYPTION_KEY` Loss**: If this key is regenerated, all existing encrypted third-party credentials stored in MongoDB (such as Meta OAuth tokens, Google Sheets refresh tokens, and webhook secrets) will become **permanently un-decryptable**, breaking all live integrations.
   - **`JWT_SECRET` Loss**: Regenerating this key invalidates all active sessions, requiring all users to log in again.

---

## Non-Negotiable Operational Procedures

### 1. Mandatory Secrets Backup on Initial Deployment

Immediately following initial provisioning on Render:

1. Navigate to the **Render Dashboard** $\rightarrow$ **Services** $\rightarrow$ `sahyak-api` $\rightarrow$ **Environment**.
2. Click **Show Values**.
3. Securely copy and store the generated values for:
   - `JWT_SECRET`
   - `INTEGRATION_ENCRYPTION_KEY`
4. Store these values in your organization's primary secure vault (e.g., 1Password, AWS Secrets Manager, or HashiCorp Vault).

### 2. Service Migration / Re-creation Procedure

If the service ever needs to be recreated or moved:

1. In the Render Dashboard of the new service, do **not** rely on `generateValue`.
2. Override `JWT_SECRET` and `INTEGRATION_ENCRYPTION_KEY` manually using the saved values from your secure vault.
3. Verify that existing encrypted integration credentials in MongoDB can be decrypted successfully:
   ```bash
   node -e "const { decryptSecret } = require('./backend/src/utils/encryption'); console.log('Encryption key verified');"
   ```

### 3. Blueprint Configuration Freeze

`render.yaml` remains configured with `generateValue: true` to support zero-friction first-time deployment, but production operations must strictly maintain off-platform backups of the generated keys as described above.
