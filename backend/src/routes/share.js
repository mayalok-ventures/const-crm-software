const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { getShareDashboard, getNotifications, markAllRead } = require('../controllers/shareController');
const { protect } = require('../middleware/auth');

const shareLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60, // 60 requests per 15 minutes per token+IP
  keyGenerator: (req) => {
    const token = req.params.token || req.params.shareToken || 'unknown';
    const ip = req.ip || '127.0.0.1';
    return `share:${token}:${ip}`;
  },
  skip: (req) => process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit'],
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests to this shared dashboard. Please try again later.' }
});

// Public share route
router.get('/share/:token', shareLimiter, getShareDashboard);

// Notifications (private)
router.get('/notifications', protect, getNotifications);
router.put('/notifications/read-all', protect, markAllRead);

module.exports = router;
module.exports.shareLimiter = shareLimiter;
