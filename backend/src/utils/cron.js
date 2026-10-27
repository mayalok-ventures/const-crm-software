const cron = require('node-cron');
const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const Notification = require('../models/Notification');
const { processSubscriptionLifecycle } = require('../services/subscriptionWorker');
const { runTestPrepFeeAlertsCron } = require('../services/automationHandlers');

let scheduledTasks = [];
let isSchedulerStarted = false;

/**
 * Ensures a background job only runs when MongoDB is ready and connected.
 */
const isDbReady = () => mongoose.connection.readyState === 1;

/**
 * Start all scheduled recurring background jobs with database lifecycle protection.
 */
const startFollowUpCron = () => {
  if (isSchedulerStarted) {
    console.log('[Cron] Scheduler is already initialized. Skipping duplicate startup.');
    return;
  }
  isSchedulerStarted = true;

  const { sweepDueFollowUps } = require('../services/followUpSchedulerService');

  // Run every minute — check for due follow-ups & dispatch due notifications (In-App + SSE + Web Push)
  let isFollowUpRunning = false;
  const followUpTask = cron.schedule('* * * * *', async () => {
    if (!isDbReady() || isFollowUpRunning) return;
    isFollowUpRunning = true;
    try {
      await sweepDueFollowUps();
    } catch (err) {
      console.error('[Cron] Follow-up alarm error:', err.message);
    } finally {
      isFollowUpRunning = false;
    }
  });
  scheduledTasks.push(followUpTask);

  // Run every minute — Webhook Ingestion Queue sweep (processes due retries & reclaims stale locks)
  const webhookQueueService = require('../services/integrations/webhookQueueService');
  let isWebhookSweepRunning = false;
  const webhookSweepTask = cron.schedule('* * * * *', async () => {
    if (!isDbReady() || isWebhookSweepRunning) return;
    isWebhookSweepRunning = true;
    try {
      await webhookQueueService.processQueueSweep();
    } catch (err) {
      console.error('[Cron] Webhook queue sweep error:', err.message);
    } finally {
      isWebhookSweepRunning = false;
    }
  });
  // Run every minute — Pending Delayed Automations Sweep (recovers delayed jobs after server restart)
  let isDelayedSweepRunning = false;
  const delayedSweepTask = cron.schedule('* * * * *', async () => {
    if (!isDbReady() || isDelayedSweepRunning) return;
    isDelayedSweepRunning = true;
    try {
      const AutomationEngine = require('../services/automationEngine');
      await AutomationEngine.sweepPendingDelayedAutomations();
    } catch (err) {
      console.error('[Cron] Delayed automation sweep error:', err.message);
    } finally {
      isDelayedSweepRunning = false;
    }
  });
  scheduledTasks.push(delayedSweepTask);

  // Run every 15 minutes — Meta Leads Reconciliation Job
  const { reconcileMetaIntegration } = require('../controllers/integrations/metaWebhookController');
  const Integration = require('../models/Integration');
  let isMetaReconcileRunning = false;
  const metaReconcileTask = cron.schedule('*/15 * * * *', async () => {
    if (!isDbReady() || isMetaReconcileRunning) return;
    isMetaReconcileRunning = true;
    try {
      const activeMeta = await Integration.find({ provider: 'meta', status: 'connected' }).select('_id');
      for (const intDoc of activeMeta) {
        await reconcileMetaIntegration(intDoc._id);
      }
    } catch (err) {
      console.error('[Cron] Meta reconciliation sweep error:', err.message);
    } finally {
      isMetaReconcileRunning = false;
    }
  });
  scheduledTasks.push(metaReconcileTask);

  // Run every 15 minutes — process subscription downgrades, grace expiries, and quota drips
  let isSubCronRunning = false;
  const subTask = cron.schedule('*/15 * * * *', async () => {
    if (!isDbReady() || isSubCronRunning) return;
    isSubCronRunning = true;
    try {
      await processSubscriptionLifecycle();
    } catch (err) {
      console.error('[Cron] Subscription lifecycle worker error:', err.message);
    } finally {
      isSubCronRunning = false;
    }
  });
  scheduledTasks.push(subTask);

  // Run every 15 minutes — Automated Lead State & Idle Stage Reassignments
  let isIdleLeadCronRunning = false;
  const idleLeadTask = cron.schedule('*/15 * * * *', async () => {
    if (!isDbReady() || isIdleLeadCronRunning) return;
    isIdleLeadCronRunning = true;
    try {
      const AutomationEngine = require('../services/automationEngine');
      await AutomationEngine.processIdleLeadAutomations();
    } catch (err) {
      console.error('[Cron] Idle lead automation worker error:', err.message);
    } finally {
      isIdleLeadCronRunning = false;
    }
  });
  scheduledTasks.push(idleLeadTask);

  // Run daily at 09:00 AM — Test Prep / Education 5-day fee due date reminders
  let isFeeCronRunning = false;
  const feeTask = cron.schedule('0 9 * * *', async () => {
    if (!isDbReady() || isFeeCronRunning) return;
    isFeeCronRunning = true;
    try {
      await runTestPrepFeeAlertsCron();
    } catch (err) {
      console.error('[Cron] Fee due alert scheduler error:', err.message);
    } finally {
      isFeeCronRunning = false;
    }
  });
  scheduledTasks.push(feeTask);

  // Safe startup execution: run once MongoDB is ready
  const runStartupPass = async () => {
    if (!isDbReady()) {
      mongoose.connection.once('connected', runStartupPass);
      return;
    }
    if (!isSchedulerStarted) return; // stopped before startup ran
    try {
      if (isSchedulerStarted && isDbReady()) await processSubscriptionLifecycle().catch(err => { if (isDbReady() && isSchedulerStarted) console.error('[Cron Startup] Subscription error:', err.message); });
      if (isSchedulerStarted && isDbReady()) await runTestPrepFeeAlertsCron().catch(err => { if (isDbReady() && isSchedulerStarted) console.error('[Cron Startup] Fee alerts error:', err.message); });
      if (isSchedulerStarted && isDbReady()) await webhookQueueService.processQueueSweep().catch(err => { if (isDbReady() && isSchedulerStarted) console.error('[Cron Startup] Webhook queue error:', err.message); });
      if (isSchedulerStarted && isDbReady()) {
        const AutomationEngine = require('../services/automationEngine');
        await AutomationEngine.sweepPendingDelayedAutomations().catch(err => { if (isDbReady() && isSchedulerStarted) console.error('[Cron Startup] Delayed automation sweep error:', err.message); });
      }
    } catch (err) {
      if (isDbReady() && isSchedulerStarted) console.error('[Cron Startup] Initialization pass error:', err.message);
    }
  };

  runStartupPass();

  console.log('[Cron] Follow-up notification, Webhook Queue, Meta Reconciliation & Fee Alert schedulers active (DB-guarded)');
};

/**
 * Stop and destroy all scheduled cron tasks (for graceful shutdown / testing)
 */
const stopFollowUpCron = () => {
  for (const task of scheduledTasks) {
    if (task && typeof task.stop === 'function') {
      task.stop();
    }
  }
  scheduledTasks = [];
  isSchedulerStarted = false;
  console.log('[Cron] All background schedulers stopped.');
};

module.exports = { startFollowUpCron, stopFollowUpCron, isDbReady };
