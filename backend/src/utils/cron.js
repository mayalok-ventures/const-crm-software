const cron = require('node-cron');
const Lead = require('../models/Lead');
const Notification = require('../models/Notification');
const { processSubscriptionLifecycle } = require('../services/subscriptionWorker');

// Run every minute — check for due follow-ups
const startFollowUpCron = () => {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const leads = await Lead.find({
        followUpDate: { $lte: now },
        followUpNotified: false,
        status: { $ne: 'closed' },
      }).limit(100).lean();

      if (leads.length === 0) return;

      const notifications = leads.map((lead) => ({
        userId: lead.userId,
        leadId: lead._id,
        leadName: lead.name,
        message: `⏰ Follow-up due for ${lead.name} (${lead.phone})`,
        type: 'follow_up',
        isRead: false,
      }));

      await Notification.insertMany(notifications, { ordered: false });

      // Mark as notified
      const ids = leads.map((l) => l._id);
      await Lead.updateMany({ _id: { $in: ids } }, { followUpNotified: true });

      console.log(`[Cron] Created ${notifications.length} follow-up notifications`);
    } catch (err) {
      console.error('[Cron] Follow-up error:', err.message);
    }
  });

  // Run every 15 minutes — process subscription downgrades, grace expiries, and quota drips
  cron.schedule('*/15 * * * *', async () => {
    try {
      await processSubscriptionLifecycle();
    } catch (err) {
      console.error('[Cron] Subscription lifecycle worker error:', err.message);
    }
  });

  // Execute initial lifecycle pass at startup
  processSubscriptionLifecycle().catch(console.error);

  console.log('[Cron] Follow-up notification & Subscription lifecycle schedulers active');
};

module.exports = { startFollowUpCron };
