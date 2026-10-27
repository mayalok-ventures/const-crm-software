const Notification = require('../models/Notification');
const PushSubscription = require('../models/PushSubscription');
const { getVapidPublicKey, subscribe, unsubscribe, sendPushNotification } = require('../services/pushNotificationService');

// Map of active SSE client connections: userId -> Set of res objects
const sseClients = new Map();

// Helper to broadcast real-time event to active SSE connections
const broadcastNotification = (userId, notificationData) => {
  if (!userId) return;
  const userStr = userId.toString();
  const clients = sseClients.get(userStr);
  if (clients && clients.size > 0) {
    const payload = `data: ${JSON.stringify(notificationData)}\n\n`;
    for (const res of clients) {
      try {
        res.write(payload);
      } catch (err) {
        clients.delete(res);
      }
    }
  }
};

// @desc  Get user notifications with filtering and pagination
// @route GET /api/notifications
// @access Private
const getNotifications = async (req, res) => {
  try {
    const { category, unreadOnly, page = 1, limit = 50 } = req.query;
    const query = { userId: req.user._id };

    if (category && category !== 'all') {
      query.category = category;
    }
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(100, parseInt(limit, 10));

    const [notifications, unreadCount, totalCount] = await Promise.all([
      Notification.find(query)
        .populate('leadId', 'name phone status project location budget followUpDate')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Math.min(100, parseInt(limit, 10)))
        .lean(),
      Notification.countDocuments({ userId: req.user._id, isRead: false }),
      Notification.countDocuments(query),
    ]);

    res.json({
      notifications,
      unreadCount,
      totalCount,
      page: parseInt(page, 10),
    });
  } catch (error) {
    console.error('getNotifications error:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

// @desc  Get fast unread counter for top-nav bell
// @route GET /api/notifications/unread-count
// @access Private
const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user._id, isRead: false });
    res.json({ unreadCount: count });
  } catch (error) {
    res.status(500).json({ message: 'Failed to count unread notifications' });
  }
};

// @desc  Mark all notifications as read
// @route PUT /api/notifications/read-all
// @access Private
const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } }
    );
    res.json({ message: 'All notifications marked as read ✅' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update notifications' });
  }
};

// @desc  Mark single notification as read
// @route PUT /api/notifications/:id/read
// @access Private
const markOneRead = async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true }
    );
    if (!notif) return res.status(404).json({ message: 'Notification not found' });
    res.json({ message: 'Notification marked as read', notification: notif });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update notification' });
  }
};

// @desc  Delete single notification
// @route DELETE /api/notifications/:id
// @access Private
const deleteNotification = async (req, res) => {
  try {
    const result = await Notification.deleteOne({ _id: req.params.id, userId: req.user._id });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    res.json({ message: 'Notification removed' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete notification' });
  }
};

// @desc  Get VAPID Public Key for Web Push client setup
// @route GET /api/notifications/push/vapid-key
// @access Private
const getVapidKey = (req, res) => {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return res.status(503).json({ message: 'Web Push VAPID is not configured on this server' });
  }
  res.json({ publicKey });
};

// @desc  Register client device push subscription
// @route POST /api/notifications/push/subscribe
// @access Private
const registerPushSubscription = async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'Valid PushSubscription required' });
    }

    const userAgent = req.headers['user-agent'] || '';
    const platform = req.headers['sec-ch-ua-platform'] || '';
    const workspaceId = req.workspace?._id || req.user.workspaceId || null;
    const companyId = req.user.companyId || null;

    const saved = await subscribe(req.user._id, subscription, userAgent, platform, workspaceId, companyId);
    res.json({ message: 'Device subscribed to Push notifications ✅', subscriptionId: saved._id });
  } catch (err) {
    console.error('registerPushSubscription error:', err.message);
    res.status(500).json({ message: err.message || 'Failed to register push subscription' });
  }
};

// @desc  Unsubscribe client device push subscription
// @route POST /api/notifications/push/unsubscribe
// @access Private
const unregisterPushSubscription = async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ message: 'Endpoint is required' });

    await unsubscribe(req.user._id, endpoint);
    res.json({ message: 'Device unsubscribed from push notifications' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to unsubscribe' });
  }
};

// @desc  Send a test push notification to user's registered devices
// @route POST /api/notifications/push/test
// @access Private
const testPushNotification = async (req, res) => {
  try {
    const result = await sendPushNotification(req.user._id, {
      title: '🔔 Sahyak CRM Test Notification',
      body: `Hello ${req.user.name || 'Agent'}! Push notifications are working perfectly on this device.`,
      url: '/notifications',
      tag: 'test-push',
      timestamp: Date.now(),
    });

    if (result.sentCount === 0) {
      return res.status(404).json({
        message: 'No active device subscriptions found for this user. Please enable notifications in your browser first.',
        details: result,
      });
    }

    res.json({
      message: `Test push sent to ${result.sentCount} device(s) successfully! ✅`,
      result,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Test push notification failed' });
  }
};

// @desc  Real-Time Server-Sent Events (SSE) Stream
// @route GET /api/notifications/stream
// @access Private
const streamNotifications = (req, res) => {
  const userId = req.user._id.toString();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId).add(res);

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date() })}\n\n`);

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    const clients = sseClients.get(userId);
    if (clients) {
      clients.delete(res);
      if (clients.size === 0) {
        sseClients.delete(userId);
      }
    }
  });
};

module.exports = {
  broadcastNotification,
  getNotifications,
  getUnreadCount,
  markAllRead,
  markOneRead,
  deleteNotification,
  getVapidKey,
  registerPushSubscription,
  unregisterPushSubscription,
  testPushNotification,
  streamNotifications,
};
