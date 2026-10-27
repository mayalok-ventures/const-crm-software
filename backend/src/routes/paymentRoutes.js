const express = require('express');
const router = express.Router();
const { optionalAuth, protect, superAdminOnly } = require('../middleware/auth');
const { paymentUpload, processPaymentUpload } = require('../middleware/paymentUpload');
const {
  createRazorpayOrder,
  verifyRazorpayPayment,
  handleRazorpayWebhook,
  createPaymentRequest,
  getUserPaymentRequest,
  getAdminPaymentRequests,
  approvePaymentRequest,
  rejectPaymentRequest,
} = require('../controllers/paymentController');

// ─────────────────────────────────────────────────────────────
// RAZORPAY STANDARD WEB CHECKOUT ENDPOINTS
// ─────────────────────────────────────────────────────────────
router.post('/create-order', optionalAuth, createRazorpayOrder);
router.post('/verify', optionalAuth, verifyRazorpayPayment);
router.post('/webhook', handleRazorpayWebhook);

// ─────────────────────────────────────────────────────────────
// MANUAL HYBRID UPI PROOF-OF-PAYMENT ENDPOINTS (LEGACY)
// ─────────────────────────────────────────────────────────────
router.post('/', protect, paymentUpload, processPaymentUpload, createPaymentRequest);
router.get('/my-request', protect, getUserPaymentRequest);

// Platform SuperAdmin payments endpoints
router.get('/admin', protect, superAdminOnly, getAdminPaymentRequests);
router.put('/admin/:id/approve', protect, superAdminOnly, approvePaymentRequest);
router.put('/admin/:id/reject', protect, superAdminOnly, rejectPaymentRequest);

module.exports = router;
