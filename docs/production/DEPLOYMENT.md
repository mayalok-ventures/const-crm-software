# SAHYAK / CoreSetu CRM — Production Deployment Runbook

## Overview
This document outlines the stabilized production deployment architecture, automated CI/CD pipeline, bounded health verification, rollback procedures, and operational runbook for SAHYAK CRM across Frontend (Cloudflare Pages) and Backend (AWS EC2).

---

## 1. Dual Deployment Architecture

```
GitHub (Repository: mayalok-ventures/mobile-crm)
  │
  ├──► [Branch: main] ──► Cloudflare Pages (Git Integration) ──► Frontend PWA (https://crm.coresetu.com)
  │
  └──► [Branch: main] ──► GitHub Actions (.github/workflows/deploy-ec2.yml)
                             │ Concurrency Group: production-backend-deployment (cancel-in-progress: false)
                             │ SSH over port 22 via appleboy/ssh-action
                             ▼
                         AWS EC2 (crm-backend-server | Ubuntu 22.04 LTS)
                             │
                             ├──► /home/ubuntu/mobile-crm
                             ├──► Capture PREVIOUS_COMMIT=$(git rev-parse HEAD)
                             ├──► git fetch origin main & git reset --hard origin/main
                             ├──► cd backend && npm ci --omit=dev
                             ├──► Graceful PM2 reload (ecosystem.config.js)
                             ├──► Bounded Health Probe: http://127.0.0.1:5000/api/health/live (up to 60s)
                             │      ├── HTTP 200 ──► Deployment SUCCESS
                             │      └── Timeout (60s) ──► Trigger Automatic Rollback to PREVIOUS_COMMIT
                             └──► Nginx Reverse Proxy (port 80) ──► Node.js / Express (port 5000)
```

---

## 2. GitHub Actions Secrets Configuration

To enable automated backend deployment to the EC2 server, configure the following encrypted secrets in GitHub repository settings (**Settings > Secrets and variables > Actions**):

| Secret Name | Description | Example / Default |
| :--- | :--- | :--- |
| `EC2_HOST` | Public IP or DNS of the EC2 instance | `13.51.219.53` |
| `EC2_USER` | SSH Username for the instance | `ubuntu` |
| `EC2_SSH_KEY` | Private SSH Key (.pem) for EC2 authentication | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `EC2_SSH_PORT` | *(Optional)* SSH Port | `22` |

---

## 3. Automated Deployment Sequence (GitHub Actions)

When code is pushed to `main` impacting the backend, the workflow `.github/workflows/deploy-ec2.yml` runs the following commands on EC2 non-destructively:

```bash
# 1. Navigate to application root
cd /home/ubuntu/mobile-crm

# 2. Record previous known commit hash for safe rollback
PREVIOUS_COMMIT=$(git rev-parse HEAD)

# 3. Synchronize codebase with origin/main
git fetch origin main
git checkout -f main
git reset --hard origin/main

# 4. Install production dependencies
cd backend
npm ci --omit=dev

# 5. Graceful reload with bounded readiness verification
pm2 reload ecosystem.config.js --update-env || pm2 reload crm-backend --update-env || pm2 start ecosystem.config.js
pm2 save

# 6. Bounded Health Polling (Every 2s, bounded 60s timeout)
# Polls http://127.0.0.1:5000/api/health/live until HTTP 200 is returned
```

### Production Data Safety Guarantees
The deployment pipeline guarantees that untracked production files remain completely untouched:
- `backend/.env` (Production secrets and credentials)
- `backend/uploads/` (User recordings and media)
- `backend/data/` (Embedded/local runtime data)
- WhatsApp multi-device authentication session stores

---

## 4. Bounded Health Polling & Automatic Rollback

### Health Probe Strategy
The canonical liveness probe (`/api/health/live`) performs an in-memory event loop and process responsiveness inspection. Because Node.js requires a brief startup window (connecting to MongoDB, running database migrations and initializing security caches before `app.listen()` binds port 5000), the deployment uses **bounded polling**:
- Poll frequency: Every 2 seconds
- Maximum attempts: 30 (60-second total ceiling)
- Success condition: Immediate HTTP 200 OK

### Automatic Rollback Mechanism
If the liveness probe does not return HTTP 200 within 60 seconds:
1. Diagnostics are captured (`pm2 status`, `pm2 logs crm-backend --lines 50 --nostream`).
2. Git checks out `PREVIOUS_COMMIT`.
3. Backend dependencies are re-synchronized (`npm ci --omit=dev`).
4. PM2 reloads the previous known-good version.
5. Health polling verifies that the rolled-back version is healthy.
6. The GitHub Actions job exits with code 1, clearly reporting **AUTOMATIC ROLLBACK SUCCESS** while leaving production online and healthy.

---

## 5. PM2 Process Manager Configuration

The application is managed via `backend/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'crm-backend',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      kill_timeout: 10000,
      listen_timeout: 10000,
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    },
  ],
};
```

---

## 6. Manual / Host Deployment (Fallback)

If manual deployment or server troubleshooting is required:

```bash
# 1. SSH into EC2 instance
ssh -i ~/.ssh/your-key.pem ubuntu@13.51.219.53

# 2. Navigate and update repository
cd /home/ubuntu/mobile-crm
git fetch origin main
git checkout main
git reset --hard origin/main

# 3. Update backend dependencies & reload PM2
cd backend
npm ci --omit=dev
pm2 reload ecosystem.config.js --update-env
pm2 save

# 4. Verify health
curl -f http://127.0.0.1:5000/api/health/live
```

---

## 7. Security Hardening Roadmap

### Current Architecture:
- SSH Access: Port 22 open via Security Group.
- Authentication: Private SSH Key stored in GitHub Actions encrypted secrets (`EC2_SSH_KEY`).

### Recommended Long-Term Hardening (AWS SSM + GitHub OIDC):
To eliminate long-lived SSH credentials and close port 22 on EC2:
```
GitHub Actions
    ↓
GitHub OpenID Connect (OIDC)
    ↓
AWS IAM Role (AssumeRoleWithWebIdentity)
    ↓
AWS Systems Manager (SSM) Run Command / Session Manager
    ↓
AWS EC2 Instance (No inbound port 22 required)
```
