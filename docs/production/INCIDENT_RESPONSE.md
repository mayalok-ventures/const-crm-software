# Sahyak CRM — Production Incident Response Runbook

## Incident Severities
- **P0**: Critical outage affecting all users (e.g., Database unavailable, server down, data corruption).
- **P1**: High impact issue affecting core functionality (e.g., Login failing, payment webhooks failing).
- **P2**: Degraded performance or non-critical feature issue (e.g., Slow query latency, WhatsApp disconnect).
- **P3**: Minor defect or operational anomaly.

---

## Response Procedures by Scenario

### Scenario A: Backend Outage (5xx Spike or Server Down)
1. Check process status: `pm2 status` or `docker ps`.
2. Review structured error logs: `pm2 logs crm-backend --lines 100` or `docker logs crm-backend --tail 100`.
3. Check system resources: `htop` / `df -h`.
4. If process crashed from an uncaught exception, restart and inspect error fingerprint in monitoring.
5. If failure persists, execute rollback runbook.

### Scenario B: Database Outage / Connection Loss
1. Check Atlas cluster status in MongoDB Cloud console.
2. Verify Network Access / IP Allowlist on Atlas (ensure server IP is permitted).
3. Test connectivity from server: `mongosh "<MONGO_URI>"`.
4. Backend auto-reconnect backoff will automatically re-establish connection once Atlas recovers.

### Scenario C: WhatsApp Session Disconnect Storm
1. Verify user WhatsApp session status: `GET /api/whatsapp/status`.
2. Re-trigger connection handshake if disconnected.
3. If Baileys credentials expired, prompt user to re-scan QR code.

### Scenario D: High API Latency / Slow Queries
1. Query slow query interceptor: `GET /health/database`.
2. Inspect MongoDB Atlas Profiler for COLLSCAN operations.
3. Verify compound indexes match query filter and sort fields.
