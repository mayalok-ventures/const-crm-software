# CoreSetu CRM — Production Rollback Runbook

## Rollback Strategy
CoreSetu CRM employs a stateless application layer design with backward-compatible MongoDB schemas. Rollbacks can be executed rapidly without requiring database restoration unless an intentional destructive migration was executed.

---

## 1. Triggers for Rollback
- Spike in HTTP 5xx error rate (> 1% of total requests)
- `/health/ready` consistently returning HTTP 503
- Authentication or login failures across active tenants
- High latency degradation (API p95 > 2000ms)
- Background worker crash loops

---

## 2. Docker Rollback Procedure
```bash
# 1. Stop the failing container
docker stop crm-backend

# 2. Start the previous known-good image version
docker run -d \
  --name crm-backend \
  --restart unless-stopped \
  -p 5000:5000 \
  --env-file ./backend/.env \
  coresetu-crm-backend:previous-tag

# 3. Verify health & readiness
curl -f http://localhost:5000/health/live
curl -f http://localhost:5000/health/ready
```

---

## 3. Git / PM2 Rollback Procedure
```bash
# 1. Checkout previous known-good git tag/commit
git checkout <previous-release-tag>

# 2. Re-install dependencies and build
cd backend && npm ci --omit=dev
cd ../frontend && npm ci && npm run build

# 3. Reload PM2 processes
pm2 reload crm-backend --update-env
pm2 reload crm-frontend --update-env

# 4. Run smoke test
curl -f http://localhost:5000/health/ready
```

---

## 4. Post-Rollback Verification
1. Confirm `/health/ready` returns 200 OK.
2. Confirm admin login succeeds.
3. Confirm lead creation and listing queries succeed.
4. Notify incident response team and initiate post-mortem.
