# SAHYAK / CoreSetu CRM — Production Deployment Runbook

## Overview
This document outlines the production deployment architecture and procedures for SAHYAK CRM across Frontend (Cloudflare Pages) and Backend (AWS EC2).

---

## 1. Dual Deployment Architecture

```
GitHub (Repository: mayalok-ventures/mobile-crm)
  │
  ├──► [Branch: main] ──► Cloudflare Pages (Git Integration) ──► Frontend PWA (https://crm.coresetu.com)
  │
  └──► [Branch: main] ──► GitHub Actions (.github/workflows/deploy-ec2.yml)
                             │ (SSH over port 22 via appleboy/ssh-action)
                             ▼
                         AWS EC2 (crm-backend-server | Ubuntu 22.04 LTS)
                             │
                             ├──► /home/ubuntu/mobile-crm
                             ├──► git fetch & reset --hard origin/main
                             ├──► cd backend && npm ci --omit=dev
                             ├──► pm2 reload crm-backend --update-env
                             └──► Health Probe: http://127.0.0.1:5000/api/health/live (HTTP 200)
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

# 2. Synchronize codebase with origin/main
git fetch origin main
git checkout main
git reset --hard origin/main

# 3. Install production dependencies
cd backend
npm ci --omit=dev

# 4. Zero-downtime PM2 reload
pm2 reload crm-backend --update-env || pm2 start server.js --name "crm-backend"
pm2 save

# 5. Automated Health Verification
curl -f http://127.0.0.1:5000/api/health/live
```

---

## 4. Manual / Host Deployment (Fallback)

If manual deployment or server bootstrapping is required:

```bash
# 1. SSH into EC2 instance
ssh -i ~/.ssh/your-key.pem ubuntu@13.51.219.53

# 2. Navigate and update repository
cd /home/ubuntu/mobile-crm
git pull origin main

# 3. Update backend dependencies & reload PM2
cd backend
npm ci --omit=dev
pm2 reload crm-backend --update-env
pm2 save

# 4. Verify health
curl -f http://127.0.0.1:5000/api/health/live
```

---

## 5. Rollback Procedure

If a deployment introduces issues, execute the following fast rollback steps on EC2:

1. **Identify Previous Working Commit**:
   ```bash
   cd /home/ubuntu/mobile-crm
   git log -n 5 --oneline
   ```
2. **Checkout Previous Commit**:
   ```bash
   git checkout <PREVIOUS_KNOWN_GOOD_COMMIT_HASH>
   ```
3. **Re-install dependencies & Reload PM2**:
   ```bash
   cd backend
   npm ci --omit=dev
   pm2 reload crm-backend --update-env
   ```
4. **Verify Health**:
   ```bash
   curl -f http://127.0.0.1:5000/api/health/live
   ```
5. **Inspect Error Logs**:
   ```bash
   pm2 logs crm-backend --lines 100 --nostream
   ```

