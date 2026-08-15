const crypto = require('crypto');
const PaymentRequest = require('../models/PaymentRequest');
const Transaction = require('../models/Transaction');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const AbuseLog = require('../models/AbuseLog');
const waSession = require('../services/waSession');
const { razorpayInstance, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET } = require('../config/razorpay');
const { getPlanPrice, getPlanDetails } = require('../utils/planLimits');
const { updateUserPlan } = require('../utils/subscriptionManager');

// @desc  Create Razorpay Order for Plan Subscription
// @route POST /api/payments/create-order
// @access Private
exports.createRazorpayOrder = async (req, res) => {
  try {
    const { planId, cycle = 'monthly', couponCode } = req.body;

    if (!planId) {
      return res.status(400).json({ message: 'planId is required' });
    }

    const plan = getPlanDetails(planId);
    if (!plan || plan.id === 'free') {
      return res.status(400).json({ message: 'Invalid subscription plan selected' });
    }

    const selectedCycle = cycle === 'yearly' ? 'yearly' : 'monthly';
    const originalPrice = getPlanPrice(planId, selectedCycle);

    let discountedPrice = originalPrice;
    let validCoupon = null;

    if (couponCode) {
      validCoupon = await Coupon.findOne({ code: String(couponCode).toUpperCase().trim(), isActive: true });
      if (validCoupon && (!validCoupon.expiresAt || new Date() <= new Date(validCoupon.expiresAt))) {
        const discount = (originalPrice * (validCoupon.discountPercent || 0)) / 100;
        discountedPrice = Math.max(0, Math.round(originalPrice - discount));
      }
    }

    const amountInPaise = Math.round(discountedPrice * 100);

    // Create Order with Razorpay
    let order;
    const receiptId = `rcpt_${req.user._id.toString().slice(-6)}_${Date.now().toString().slice(-6)}`;
    const orderNotes = {
      userId: req.user._id.toString(),
      companyId: (req.user.companyId || (req.user.workStatus === 'company_owner' ? req.user._id : null))?.toString() || '',
      planId,
      cycle: selectedCycle,
      couponCode: validCoupon?.code || '',
    };

    if (razorpayInstance && RAZORPAY_KEY_SECRET && !RAZORPAY_KEY_SECRET.startsWith('rzp_test_mock')) {
      order = await razorpayInstance.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: receiptId,
        notes: orderNotes,
      });
    } else {
      // Robust development fallback order
      order = {
        id: `order_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        entity: 'order',
        amount: amountInPaise,
        amount_paid: 0,
        amount_due: amountInPaise,
        currency: 'INR',
        receipt: receiptId,
        status: 'created',
        notes: orderNotes,
      };
    }

    res.json({
      success: true,
      orderId: order.id,
      amount: amountInPaise,
      currency: 'INR',
      keyId: RAZORPAY_KEY_ID,
      planId,
      cycle: selectedCycle,
      planName: plan.name,
      originalPrice,
      finalPrice: discountedPrice,
      user: {
        name: req.user.name,
        email: req.user.email,
        phone: req.user.phone,
      }
    });
  } catch (error) {
    console.error('[Payments] createRazorpayOrder error:', error);
    res.status(500).json({ message: error.message || 'Failed to create payment order' });
  }
};

// @desc  Verify Razorpay Payment Signature (HMAC SHA256 Anti-Spoofing Verification)
// @route POST /api/payments/verify
// @access Private
exports.verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
      cycle = 'monthly',
      couponCode,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing Razorpay signature verification parameters.' });
    }

    if (!planId) {
      return res.status(400).json({ message: 'planId is required for subscription activation' });
    }

    // ─────────────────────────────────────────────────────────────
    // 1. CRYPTOGRAPHIC HMAC SHA256 SIGNATURE VERIFICATION
    // ─────────────────────────────────────────────────────────────
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const isMatch = expectedSignature === razorpay_signature;

    if (!isMatch) {
      // Security Incident: Log payload forgery attempt
      try {
        await AbuseLog.create({
          userId: req.user._id,
          ip: req.ip || req.connection?.remoteAddress,
          type: 'suspicious_activity',
          detail: `PAYMENT_SIGNATURE_FORGERY_ATTEMPT: Signature mismatch for order ${razorpay_order_id}. Provided: ${razorpay_signature}, Expected: ${expectedSignature}`,
        });
      } catch (err) {
        console.warn('[Payments] Could not record abuse log:', err.message);
      }

      return res.status(400).json({
        code: 'PAYMENT_FORGERY_DETECTED',
        message: 'Payment verification failed: Cryptographic signature mismatch. Unauthorized tampering attempt detected.',
      });
    }

    // ─────────────────────────────────────────────────────────────
    // 2. CENTRALIZED PLAN UPDATE & TRANSACTION INVOICE VIA MANAGER
    // ─────────────────────────────────────────────────────────────
    const selectedCycle = cycle === 'yearly' ? 'yearly' : 'monthly';
    const originalPrice = getPlanPrice(planId, selectedCycle);
    let finalPrice = originalPrice;

    if (couponCode) {
      const coupon = await Coupon.findOne({ code: String(couponCode).toUpperCase().trim() });
      if (coupon) {
        finalPrice = Math.max(0, Math.round(originalPrice * (1 - (coupon.discountPercent / 100))));
        coupon.usedCount = (coupon.usedCount || 0) + 1;
        await coupon.save();
      }
    }

    const { user, subscriptionLifecycle } = await updateUserPlan(
      req.user._id,
      planId,
      selectedCycle,
      false,
      {
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        signature: razorpay_signature,
        couponCode: couponCode || null,
        originalPrice,
        discountedPrice: finalPrice,
        paymentMethod: 'razorpay',
      }
    );

    const plan = getPlanDetails(planId);

    res.json({
      success: true,
      message: `🎉 ${plan.name} subscription successfully activated!`,
      plan: user.plan,
      billingCycle: user.billingCycle,
      planStartDate: user.planStartDate,
      planEndDate: user.planEndDate,
      subscriptionLifecycle,
    });
  } catch (error) {
    console.error('[Payments] verifyRazorpayPayment error:', error);
    res.status(500).json({ message: 'Server error during payment verification' });
  }
};

// @desc  Razorpay Webhook Handler (Fallback for browser-close edge cases)
// @route POST /api/webhooks/razorpay (also mounted at POST /api/payments/webhook)
// @access Public (HMAC Verified)
exports.handleRazorpayWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
      return res.status(400).json({ message: 'Missing Razorpay webhook signature header' });
    }

    const rawBody = typeof req.rawBody === 'string' ? req.rawBody : (Buffer.isBuffer(req.rawBody) ? req.rawBody.toString('utf8') : JSON.stringify(req.body));
    
    const expectedSignature = crypto
      .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.warn('[Webhook] Razorpay webhook signature mismatch. Request ignored.');
      return res.status(400).json({ message: 'Invalid webhook signature' });
    }

    const event = req.body?.event;
    console.log(`[Webhook] Received verified Razorpay event: ${event}`);

    if (event === 'payment.captured' || event === 'order.paid') {
      const payment = req.body.payload?.payment?.entity || {};
      const order = req.body.payload?.order?.entity || {};
      const notes = { ...order.notes, ...payment.notes };

      const userId = notes.userId;
      const planId = notes.planId;
      const cycle = notes.cycle === 'yearly' ? 'yearly' : 'monthly';
      const couponCode = notes.couponCode || null;

      if (userId && planId) {
        const paymentId = payment.id || `pay_webhook_${Date.now()}`;
        const orderId = payment.order_id || order.id || 'webhook_order';
        const amountInRupees = payment.amount ? payment.amount / 100 : getPlanPrice(planId, cycle);

        await updateUserPlan(
          userId,
          planId,
          cycle,
          false,
          {
            paymentId,
            orderId,
            signature,
            couponCode,
            originalPrice: getPlanPrice(planId, cycle),
            discountedPrice: amountInRupees,
            paymentMethod: payment.method || 'razorpay',
            source: 'razorpay_webhook_fallback',
          }
        );

        console.log(`[Webhook] Successfully activated ${planId} (${cycle}) for user ${userId} via centralized subscriptionManager.`);
      }
    }

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('[Payments Webhook] Error processing webhook:', error);
    res.status(500).json({ message: 'Webhook processing error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MANUAL HYBRID UPI PROOF-OF-PAYMENT FLOW (LEGACY FALLBACK)
// ─────────────────────────────────────────────────────────────────────────────

// @desc  Create a new manual payment request
// @route POST /api/payments
// @access Private
exports.createPaymentRequest = async (req, res) => {
  try {
    const { planSelected, originalPrice, finalPrice, utrNumber, couponCodeUsed } = req.body;
    const screenshotUrl = req.screenshotUrl;

    if (!planSelected || !originalPrice || !finalPrice || !utrNumber) {
      return res.status(400).json({ message: 'All payment verification fields are required' });
    }

    const trimmedUTR = utrNumber.trim();
    if (trimmedUTR.length < 10) {
      return res.status(400).json({ message: 'UTR number must be at least 10 characters long' });
    }

    const pendingRequest = await PaymentRequest.findOne({ userId: req.user._id, status: 'pending' });
    if (pendingRequest) {
      return res.status(400).json({ message: 'You already have a pending payment request. Please wait for admin approval.' });
    }

    const duplicateUTR = await PaymentRequest.findOne({ utrNumber: trimmedUTR });
    if (duplicateUTR) {
      return res.status(400).json({ message: 'This UTR number has already been submitted.' });
    }

    const paymentRequest = await PaymentRequest.create({
      userId: req.user._id,
      username: req.user.name,
      planSelected,
      originalPrice: Number(originalPrice),
      finalPrice: Number(finalPrice),
      couponCodeUsed: couponCodeUsed || null,
      utrNumber: trimmedUTR,
      screenshotUrl,
      status: 'pending'
    });

    // Send WhatsApp notification to Admin
    const adminNumber = process.env.WA_BUSINESS_NUMBER || '918796475107';
    const messageText = `🚨 New Manual Payment Request\n\nUser: ${req.user.name}\nPlan: ${planSelected.toUpperCase()}\nPrice: ₹${finalPrice}\nUTR: ${trimmedUTR}`;
    try {
      await waSession.sendFromAnyActiveSession(adminNumber, messageText);
    } catch {}

    res.status(201).json({
      message: 'Verification in progress (5–15 mins). Our admins are verifying your payment.',
      paymentRequest
    });
  } catch (error) {
    console.error('[Payments] Create error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get current user's latest payment request status
// @route GET /api/payments/my-request
// @access Private
exports.getUserPaymentRequest = async (req, res) => {
  try {
    const latestRequest = await PaymentRequest.findOne({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json(latestRequest || null);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get all payment requests for admin panel
// @route GET /api/payments/admin
// @access AdminOnly
exports.getAdminPaymentRequests = async (req, res) => {
  try {
    const { status } = req.query;
    const query = {};
    if (status) query.status = status;

    const requests = await PaymentRequest.find(query).sort({ createdAt: -1 }).lean();
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Approve a payment request manually
// @route PUT /api/payments/admin/:id/approve
// @access AdminOnly
exports.approvePaymentRequest = async (req, res) => {
  try {
    const paymentRequest = await PaymentRequest.findById(req.params.id);
    if (!paymentRequest) return res.status(404).json({ message: 'Payment request not found' });
    if (paymentRequest.status !== 'pending') {
      return res.status(400).json({ message: `Payment request is already processed (${paymentRequest.status})` });
    }

    const { user, subscriptionLifecycle } = await updateUserPlan(
      paymentRequest.userId,
      paymentRequest.planSelected,
      'monthly',
      false,
      {
        utrNumber: paymentRequest.utrNumber,
        originalPrice: paymentRequest.originalPrice,
        discountedPrice: paymentRequest.finalPrice,
        couponCode: paymentRequest.couponCodeUsed || null,
        approvedBy: req.user.name,
        paymentMethod: 'manual_upi',
      }
    );

    paymentRequest.status = 'approved';
    await paymentRequest.save();

    res.json({
      message: 'Payment request approved and plan activated successfully!',
      paymentRequest,
      user,
      subscriptionLifecycle,
    });
  } catch (error) {
    console.error('approvePaymentRequest error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc  Reject a payment request manually
// @route PUT /api/payments/admin/:id/reject
// @access AdminOnly
exports.rejectPaymentRequest = async (req, res) => {
  try {
    const paymentRequest = await PaymentRequest.findById(req.params.id);
    if (!paymentRequest) return res.status(404).json({ message: 'Payment request not found' });
    if (paymentRequest.status !== 'pending') {
      return res.status(400).json({ message: `Payment request is already processed (${paymentRequest.status})` });
    }

    paymentRequest.status = 'rejected';
    await paymentRequest.save();

    res.json({ message: 'Payment request rejected.', paymentRequest });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};
