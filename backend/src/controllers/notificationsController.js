const Notification = require('../models/Notification');

// Map of active SSE client connections: userId -> Set of res objects
const sseClients = new Map();

// Helper to broadcast real-time event to active SSE connections
exports.broadcastNotification = (userId, notificationData) => {
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

// @desc  Get user notifications
// @route GET /api/notifications
// @access Private
exports.getNotifications = async (req, res) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user._id })
        .populate('leadId', 'name phone status project location budget followUpDate')
        .populate('transferRequestId', 'status requestType reason requestedBy requestedTo createdAt expiresAt')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Notification.countDocuments({ userId: req.user._id, isRead: false }),
    ]);

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('getNotifications error:', error);
    res.status(500).json({ message: 'Failed to fetch notifications' });
  }
};

// @desc  Mark all notifications as read
// @route PUT /api/notifications/read-all
// @access Private
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { isRead: true }
    );
    res.json({ message: 'All notifications marked as read ✅' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update notifications' });
  }
};

// @desc  Mark single notification as read
// @route PUT /api/notifications/:id/read
// @access Private
exports.markOneRead = async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { isRead: true }
    );
    res.json({ message: 'Notification marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update notification' });
  }
};

// @desc  Real-Time Server-Sent Events (SSE) Stream for Instant WhatsApp/Follow-up Alerts
// @route GET /api/notifications/stream
// @access Private
exports.streamNotifications = (req, res) => {
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
      if (clients.size === 0) sseClients.delete(userId);
    }
  });
};
