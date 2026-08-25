const cron = require('node-cron');
const Lead = require('../models/Lead');
const Notification = require('../models/Notification');
const { processSubscriptionLifecycle } = require('../services/subscriptionWorker');
const { runTestPrepFeeAlertsCron } = require('../services/automationHandlers');

// Run every minute — check for due follow-ups & dispatch due notifications
const startFollowUpCron = () => {
  let isFollowUpCronRunning = false;
  cron.schedule('* * * * *', async () => {
    if (isFollowUpCronRunning) return;
    isFollowUpCronRunning = true;
    try {
      const now = new Date();
      const leads = await Lead.find({
        followUpDate: { $lte: now, $ne: null },
        followUpNotified: false,
        status: {
          $nin: [
            'closed', 'lost', 'Closed', 'Lost',
            'Closed / Won', 'Lost / Dropped', 'payment_done',
            'converted', 'not_interested'
          ]
        },
      }).limit(100).lean();

      if (leads.length === 0) return;

      const notifications = leads.map((lead) => ({
        userId: lead.assignedTo || lead.userId,
        leadId: lead._id,
        leadName: lead.name,
        title: `⏰ Urgent Follow-Up Due: ${lead.name}`,
        message: `⏰ Follow-up due for ${lead.name} (${lead.phone})${lead.followUpNote ? ' — Agenda: ' + lead.followUpNote : ''}`,
        type: 'follow_up',
        isRead: false,
      }));

      await Notification.insertMany(notifications, { ordered: false });

      // Mark as notified and set activeFollowUp.status to 'due'
      const ids = leads.map((l) => l._id);
      await Lead.updateMany(
        { _id: { $in: ids } },
        {
          followUpNotified: true,
          followUpStatus: 'due',
          'activeFollowUp.status': 'due',
        }
      );

      console.log(`[Cron] Processed ${notifications.length} due follow-up alarms`);
    } catch (err) {
      console.error('[Cron] Follow-up alarm error:', err.message);
    } finally {
      isFollowUpCronRunning = false;
    }
  });

  // Run every 15 minutes — process subscription downgrades, grace expiries, and quota drips
  let isSubCronRunning = false;
  cron.schedule('*/15 * * * *', async () => {
    if (isSubCronRunning) return;
    isSubCronRunning = true;
    try {
      await processSubscriptionLifecycle();
    } catch (err) {
      console.error('[Cron] Subscription lifecycle worker error:', err.message);
    } finally {
      isSubCronRunning = false;
    }
  });

  // Run daily at 09:00 AM (and every 6 hours) — Test Prep / Education 5-day fee due date reminders
  cron.schedule('0 9 * * *', async () => {
    try {
      await runTestPrepFeeAlertsCron();
    } catch (err) {
      console.error('[Cron] Fee due alert scheduler error:', err.message);
    }
  });

  // Execute initial lifecycle pass at startup
  processSubscriptionLifecycle().catch(console.error);
  runTestPrepFeeAlertsCron().catch(console.error);

  console.log('[Cron] Follow-up notification, Subscription lifecycle & Fee Alert schedulers active');
};

module.exports = { startFollowUpCron };

