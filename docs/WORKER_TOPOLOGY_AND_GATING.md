# Architecture Blueprint: Background Worker Topology and Gating

## Overview

Sahyak CRM supports two deployment topologies:

1. **Unified Monolithic Deployment** (Single container / Small footprint):
   - A single process serves HTTP API endpoints AND executes recurring background jobs (follow-up alarms, delayed automations, telemetry workers, campaigns).
   - Set: `RUN_BACKGROUND_WORKERS=true` (or omit, defaults to `true`).

2. **Decoupled API & Dedicated Worker Topology** (High concurrency / Enterprise):
   - **HTTP API Instances** (`salyak-api`): Handle inbound user requests, webhooks, and real-time SSE streams. No background cron, monitoring loops, or poller threads run on these instances.
     - Set: `RUN_BACKGROUND_WORKERS=false`.
   - **Dedicated Worker Instance** (`salyak-worker`): Runs `backend/src/workers/backgroundWorker.js`. Executes heavy cron sweeps, sheets polling, and telemetry workers.
     - Set: `RUN_BACKGROUND_WORKERS=true`.

---

## Gated Components in `server.js`

When `RUN_BACKGROUND_WORKERS === 'false'`, the following components are strictly gated and disabled on the HTTP API server:

1. **`startFollowUpCron()`**:
   - Follow-up alarm sweep (`sweepDueFollowUps`).
   - Webhook ingestion queue processing.
   - Delayed automation sweeps.
   - Subscription lifecycle evaluation.
2. **`campaignWorker.startWorker()`**: Outbound campaign dispatch.
3. **Monitoring Workers**:
   - `MonitoringAgent`, `ServerHeartbeat`, `StatusEvaluator`, `MetricsAggregator`.
   - `DatabaseMonitorWorker`, `BackupMonitorWorker`, `AlertMonitorWorker`.
   - `IntegrationMonitorWorker`, `UsageMonitorWorker`, `ApiKeySecurityWorker`.
   - `DeploymentMonitorWorker`, `HealthScoreWorker`.
4. **Google Sheets Poller Interval**: Background polling interval for active spreadsheets.

In addition, all recurring jobs are protected by MongoDB distributed locks (`withDistributedLock`), guaranteeing that even if multiple worker containers are accidentally deployed with workers enabled, each job executes **at most once per cycle**.
