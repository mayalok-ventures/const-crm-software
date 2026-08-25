# CoreSetu CRM — Production Deployment Runbook

## Overview
This document outlines the standard, repeatable deployment procedure for CoreSetu CRM across single-instance and containerized environments.

---

## 1. Prerequisites
- Node.js 20 LTS
- MongoDB Atlas (7.0+) Cluster with TLS connection string
- Cloudinary Account (Cloud Name, API Key, API Secret)
- Domain Names: `crm.coresetu.com` (Frontend), `api.coresetu.com` (API)
- Edge Reverse Proxy / WAF (Cloudflare or Nginx / AWS ALB)

---

## 2. Environment Setup
Create `/app/backend/.env` on the host with production secrets:
```env
PORT=5000
NODE_ENV=production
MONGO_URI=mongodb+srv://<db_user>:<db_pass>@<cluster>.mongodb.net/crm_production?retryWrites=true&w=majority
JWT_SECRET=<min-32-char-random-jwt-secret>

FRONTEND_URL=https://crm.coresetu.com
BACKEND_URL=https://api.coresetu.com

CLOUDINARY_CLOUD_NAME=<cloud_name>
CLOUDINARY_API_KEY=<api_key>
CLOUDINARY_API_SECRET=<api_secret>

RAZORPAY_KEY_ID=<rzp_key_id>
RAZORPAY_KEY_SECRET=<rzp_key_secret>
RAZORPAY_WEBHOOK_SECRET=<rzp_webhook_secret>

META_APP_ID=<meta_app_id>
META_APP_SECRET=<meta_app_secret>
META_VERIFY_TOKEN=<meta_verify_token>
META_REDIRECT_URI=https://api.coresetu.com/api/integrations/meta/oauth/callback

GOOGLE_CLIENT_ID=<google_client_id>
GOOGLE_CLIENT_SECRET=<google_client_secret>
GOOGLE_REDIRECT_URI=https://api.coresetu.com/api/integrations/google/oauth/callback
GOOGLE_WEBHOOK_SECRET=<google_webhook_secret>
```

---

## 3. Docker Deployment Procedure
```bash
# 1. Build backend container image
docker build -t coresetu-crm-backend:latest ./backend

# 2. Run backend container
docker run -d \
  --name crm-backend \
  --restart unless-stopped \
  -p 5000:5000 \
  --env-file ./backend/.env \
  coresetu-crm-backend:latest

# 3. Verify health & readiness
curl -f http://localhost:5000/health/live
curl -f http://localhost:5000/health/ready
```

---

## 4. PM2 / Host Deployment Procedure
```bash
# Backend
cd backend
npm ci --omit=dev
pm2 restart crm-backend --update-env || pm2 start server.js --name "crm-backend"

# Frontend
cd ../frontend
npm ci
npm run build
pm2 restart crm-frontend --update-env || pm2 start npm --name "crm-frontend" -- start
```

---

## 5. Post-Deployment Verification
1. Verify `GET https://api.coresetu.com/health/live` returns HTTP 200.
2. Verify `GET https://api.coresetu.com/health/ready` returns HTTP 200 with `ready: true`.
3. Open `https://crm.coresetu.com/login` and verify administrative login.
4. Check error logs: `pm2 logs crm-backend` or `docker logs crm-backend`.
