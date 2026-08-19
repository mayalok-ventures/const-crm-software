const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createSubscription,
  getCurrentSubscription,
  cancelSubscription,
  changePlan,
  handleSubscriptionWebhook,
} = require('../controllers/subscriptionController');

// ── Authenticated Subscription Operations ───────────────────────────────────
router.post('/create', protect, createSubscription);
router.get('/current', protect, getCurrentSubscription);
router.post('/cancel', protect, cancelSubscription);
router.post('/change-plan', protect, changePlan);

// ── Razorpay Webhook Endpoint ───────────────────────────────────────────────
router.post('/webhook', handleSubscriptionWebhook);

module.exports = router;
