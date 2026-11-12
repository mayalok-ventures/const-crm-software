const express = require('express');
const router = express.Router();
const {
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
  getPushHealth,
  acknowledgeNotification,
  recordNotificationClick,
  getUnacknowledgedCount,
} = require('../controllers/notificationsController');
const { protect } = require('../middleware/auth');

router.use(protect);

// Notifications retrieval & state management
router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.get('/unacknowledged-count', getUnacknowledgedCount);
router.get('/stream', streamNotifications);
router.put('/read-all', markAllRead);
router.put('/:id/read', markOneRead);
router.post('/:id/acknowledge', acknowledgeNotification);
router.post('/:id/clicked', recordNotificationClick);
router.delete('/:id', deleteNotification);

// Web Push endpoints
router.get('/push/vapid-key', getVapidKey);
router.get('/push/health', getPushHealth);
router.post('/push/subscribe', registerPushSubscription);
router.post('/push/unsubscribe', unregisterPushSubscription);
router.post('/push/test', testPushNotification);

module.exports = router;
