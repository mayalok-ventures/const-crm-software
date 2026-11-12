const { getSystemHealth, getPlatformErrorLogs } = require('../services/systemService');

exports.getHealth = async (req, res) => {
  try {
    const health = await getSystemHealth();
    res.json({ success: true, ...health });
  } catch (error) {
    console.error('SuperAdmin System Health Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch system health' });
  }
};

exports.getErrorLogs = async (req, res) => {
  try {
    const { severity, page = 1, limit = 50 } = req.query;
    const result = await getPlatformErrorLogs({ severity, page, limit });
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('SuperAdmin Error Logs Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch error logs' });
  }
};

/**
 * Super Admin Reminder & Web Push System Health Telemetry
 */
exports.getReminderHealth = async (req, res) => {
  try {
    const FollowUp = require('../../models/FollowUp');
    const PushSubscription = require('../../models/PushSubscription');
    const Notification = require('../../models/Notification');
    const { getSchedulerHealth } = require('../../services/followUpSchedulerService');

    const now = new Date();
    const [
      activeSubscriptionsCount,
      pendingDueFollowUps,
      unacknowledgedReminders,
      failedPushCount,
    ] = await Promise.all([
      PushSubscription.countDocuments({ isActive: true }),
      FollowUp.countDocuments({ status: 'open', notified: false, scheduled_at: { $lte: now } }),
      FollowUp.countDocuments({ status: 'open', notified: true, acknowledged: { $ne: true } }),
      Notification.countDocuments({ 'deliveryStatus.push': 'failed' }),
    ]);

    res.json({
      success: true,
      scheduler: getSchedulerHealth(),
      activeSubscriptionsCount,
      pendingDueFollowUps,
      unacknowledgedReminders,
      failedPushCount,
      timestamp: now,
    });
  } catch (error) {
    console.error('SuperAdmin Reminder Health Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch reminder health' });
  }
};
