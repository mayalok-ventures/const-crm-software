# Sahyak CRM — Production Monitoring & Observability Runbook

## 1. Built-in Observability Endpoints
- `GET /health/live`: Process liveness probe. Fast 200 OK without dependencies.
- `GET /health/ready`: Readiness probe. Validates MongoDB connection state (200 when ready, 503 if disconnected).
- `GET /health/database`: Detailed database metrics, collection statistics, and connection pool telemetry.
- `GET /health`: Overall system summary status.

---

## 2. Request Correlation & Structured Logging
- Every inbound request receives a unique `X-Request-Id` (either preserved from trusted proxy or auto-generated).
- All logs are structured JSON containing timestamp, level, module, message, and `requestId`.
- Log sanitization automatically masks sensitive fields (passwords, JWT tokens, API keys, signatures, payment data).

---

## 3. Recommended Production Alert Thresholds
| Metric | Warning Threshold | Critical Threshold |
|---|---|---|
| HTTP 5xx Error Rate | > 1% over 5m | > 5% over 2m |
| API Response Time (p95) | > 1000ms over 5m | > 3000ms over 2m |
| MongoDB Connection State | `readyState !== 1` for 30s | `readyState !== 1` for 2m |
| Node.js Process Memory | > 80% Heap Limit | > 95% Heap Limit |
| Unhandled Exception Rate | > 0 per hour | > 5 per hour |
