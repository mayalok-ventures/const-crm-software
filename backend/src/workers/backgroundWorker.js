/**
 * Dedicated Background Worker Process for CRM
 * Runs in a separate PM2 process (crm-worker) to keep the HTTP API event loop 100% responsive.
 * Handles:
 * - Campaign delivery background loops (MongoDB persistent queue)
 * - Due follow-up notifications and webhook cleanup crons
 * - Monitoring agents and system telemetry probes
 * - Google Sheets scheduled synchronization sweeps
 */

require('dotenv').config();
const { validateEnvironment } = require('../config/envValidator');
validateEnvironment();

process.on('uncaughtException', (err) => {
  console.error('💥 [Worker Fatal] Uncaught Exception:', err.stack || err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ [Worker Warning] Unhandled Promise Rejection:', reason instanceof Error ? reason.message : reason);
});

const connectDB = require('../config/db');
const { startFollowUpCron } = require('../utils/cron');
const campaignWorker = require('../services/campaignWorker');

async function start() {
  console.log('🚀 [crm-worker] Initializing CRM Background Worker process...');
  await connectDB();

  // 1. Follow-up scheduler and webhook sweeper
  startFollowUpCron();
  console.log('✅ [crm-worker] Follow-up cron & notification scheduler initialized.');

  // 2. Campaign background sender
  campaignWorker.startWorker();
  console.log('✅ [crm-worker] Campaign worker queue started.');

  // 3. System monitoring telemetry agents & workers
  let agent, heartbeat, statusEvaluator, aggregator;
  let databaseMonitorWorker, backupMonitorWorker, alertMonitorWorker;
  let integrationMonitorWorker, usageMonitorWorker, apiKeySecurityWorker;
  let deploymentMonitorWorker, healthScoreWorker;

  if (process.env.NODE_ENV !== 'test') {
    try {
      const MonitoringAgent = require('../monitoring/MonitoringAgent').default;
      const ServerHeartbeat = require('../monitoring/ServerHeartbeat').default;
      const StatusEvaluator = require('../monitoring/StatusEvaluator').default;
      const MetricsAggregator = require('../monitoring/MetricsAggregator').default;
      const dbWorkerMod = require('../monitoring/database/DatabaseMonitorWorker');
      databaseMonitorWorker = dbWorkerMod.databaseMonitorWorker || (dbWorkerMod.DatabaseMonitorWorker && dbWorkerMod.DatabaseMonitorWorker.getInstance()) || dbWorkerMod.default;

      const bkWorkerMod = require('../monitoring/backup/BackupMonitorWorker');
      backupMonitorWorker = bkWorkerMod.backupMonitorWorker || (bkWorkerMod.BackupMonitorWorker && bkWorkerMod.BackupMonitorWorker.getInstance()) || bkWorkerMod.default;

      const alWorkerMod = require('../monitoring/alerts/AlertMonitorWorker');
      alertMonitorWorker = alWorkerMod.alertMonitorWorker || (alWorkerMod.AlertMonitorWorker && alWorkerMod.AlertMonitorWorker.getInstance()) || alWorkerMod.default;

      const intWorkerMod = require('../monitoring/integrations/IntegrationMonitorWorker');
      integrationMonitorWorker = intWorkerMod.integrationMonitorWorker || (intWorkerMod.IntegrationMonitorWorker && intWorkerMod.IntegrationMonitorWorker.getInstance()) || intWorkerMod.default;

      const usWorkerMod = require('../monitoring/usage/UsageMonitorWorker');
      usageMonitorWorker = usWorkerMod.usageMonitorWorker || (usWorkerMod.UsageMonitorWorker && usWorkerMod.UsageMonitorWorker.getInstance()) || usWorkerMod.default;

      const akWorkerMod = require('../monitoring/apikeys/ApiKeySecurityWorker');
      apiKeySecurityWorker = akWorkerMod.apiKeySecurityWorker || (akWorkerMod.ApiKeySecurityWorker && akWorkerMod.ApiKeySecurityWorker.getInstance()) || akWorkerMod.default;

      const depWorkerMod = require('../monitoring/deployment/DeploymentMonitorWorker');
      deploymentMonitorWorker = depWorkerMod.deploymentMonitorWorker || (depWorkerMod.DeploymentMonitorWorker && depWorkerMod.DeploymentMonitorWorker.getInstance()) || depWorkerMod.default;

      const hlthWorkerMod = require('../monitoring/health/HealthScoreWorker');
      healthScoreWorker = hlthWorkerMod.healthScoreWorker || (hlthWorkerMod.HealthScoreWorker && hlthWorkerMod.HealthScoreWorker.getInstance()) || hlthWorkerMod.default;

      agent = new MonitoringAgent();
      heartbeat = new ServerHeartbeat();
      statusEvaluator = new StatusEvaluator();
      aggregator = new MetricsAggregator();

      agent.start();
      heartbeat.start();
      statusEvaluator.start();
      aggregator.start();

      if (databaseMonitorWorker && typeof databaseMonitorWorker.start === 'function') databaseMonitorWorker.start(30000);
      if (backupMonitorWorker && typeof backupMonitorWorker.start === 'function') backupMonitorWorker.start(60000);
      if (alertMonitorWorker && typeof alertMonitorWorker.start === 'function') alertMonitorWorker.start(30000);
      if (integrationMonitorWorker && typeof integrationMonitorWorker.start === 'function') integrationMonitorWorker.start(60000);
      if (usageMonitorWorker && typeof usageMonitorWorker.start === 'function') usageMonitorWorker.start(60000);
      if (apiKeySecurityWorker && typeof apiKeySecurityWorker.start === 'function') apiKeySecurityWorker.start(60000);
      if (deploymentMonitorWorker && typeof deploymentMonitorWorker.start === 'function') deploymentMonitorWorker.start(60000);
      if (healthScoreWorker && typeof healthScoreWorker.start === 'function') healthScoreWorker.start(60000);
      console.log('✅ [crm-worker] Telemetry probes & monitoring workers active.');
    } catch (e) {
      console.warn('⚠️ [crm-worker] Monitoring components skipped:', e.message);
    }

    // 4. Google Sheets polling service
    try {
      const googleSheetsPollingService = require('../services/integrations/googleSheetsPollingService');
      const sheetsPollInterval = setInterval(() => {
        googleSheetsPollingService.sweepAll().catch((err) => {
          console.error('[crm-worker] [Sheets Poller Error]:', err.message);
        });
      }, 5 * 60 * 1000);
      if (sheetsPollInterval.unref) sheetsPollInterval.unref();
      console.log('✅ [crm-worker] Google Sheets synchronization sweep active.');
    } catch (e) {
      console.warn('⚠️ [crm-worker] Google Sheets poller skipped:', e.message);
    }
  }

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n🛑 [crm-worker] Received ${signal}. Stopping worker gracefully...`);
    try {
      if (campaignWorker && typeof campaignWorker.stopWorker === 'function') campaignWorker.stopWorker();
      if (databaseMonitorWorker && typeof databaseMonitorWorker.stop === 'function') databaseMonitorWorker.stop();
      if (backupMonitorWorker && typeof backupMonitorWorker.stop === 'function') backupMonitorWorker.stop();
      if (alertMonitorWorker && typeof alertMonitorWorker.stop === 'function') alertMonitorWorker.stop();
      if (integrationMonitorWorker && typeof integrationMonitorWorker.stop === 'function') integrationMonitorWorker.stop();
      if (usageMonitorWorker && typeof usageMonitorWorker.stop === 'function') usageMonitorWorker.stop();
      if (apiKeySecurityWorker && typeof apiKeySecurityWorker.stop === 'function') apiKeySecurityWorker.stop();
      if (deploymentMonitorWorker && typeof deploymentMonitorWorker.stop === 'function') deploymentMonitorWorker.stop();
      if (healthScoreWorker && typeof healthScoreWorker.stop === 'function') healthScoreWorker.stop();
      const mongoose = require('mongoose');
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log('🎯 [crm-worker] Background Worker is running independently.');
}

start().catch((err) => {
  console.error('💥 [crm-worker] Failed to start background worker:', err);
  process.exit(1);
});
