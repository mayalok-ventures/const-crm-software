const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { PLAN_LIMITS, getPlanPrice, getPlanDetails } = require('./planLimits');
const { calculateSubscriptionLifecycle } = require('../middleware/auth');

/**
 * CENTRALIZED SUBSCRIPTION MANAGER — Single Source of Truth
 *
 * This function is the ONLY authoritative entry point for modifying user subscription plans
 * across the entire platform. Both Automated Webhooks, Razorpay Client Verification, Promo Codes,
 * and Super Admin Manual Overrides must route through this function.
 *
 * @param {string|ObjectId} userId - Target user ID
 * @param {string} planName - Plan identifier (e.g. 'basic_solo', 'smart_solo', 'team_starter', 'free', etc.)
 * @param {string} cycle - Billing cycle ('monthly' | 'yearly', default: 'monthly')
 * @param {boolean} isManualAdminOverride - Flag indicating whether an admin manually assigned this plan
 * @param {object} options - Optional parameters (durationDays, expiryDate, couponCode, paymentId, orderId, signature, etc.)
 * @returns {Promise<{ user: Document, subscriptionLifecycle: object }>}
 */
const updateUserPlan = async (userId, planName, cycle = 'monthly', isManualAdminOverride = false, options = {}) => {
  if (!userId) {
    throw new Error('userId is required to update subscription plan');
  }

  const normalizedPlan = String(planName || '').trim().toLowerCase();
  const planConfig = PLAN_LIMITS[normalizedPlan];

  if (!planConfig) {
    throw new Error(`Invalid plan identifier "${planName}". Must be a valid plan defined in planLimits.js.`);
  }

  const user = await User.findById(userId);
  if (!user) {
    throw new Error(`User with ID "${userId}" not found`);
  }

  const selectedCycle = cycle === 'yearly' ? 'yearly' : 'monthly';

  // ─────────────────────────────────────────────────────────────
  // 1. FREE PLAN LOGIC (RESET & NULLIFY TIMESTAMPS)
  // ─────────────────────────────────────────────────────────────
  if (normalizedPlan === 'free') {
    user.plan = 'free';
    user.billingCycle = 'monthly';
    user.planStartDate = null;
    user.planEndDate = null;
    user.isCustomPlan = false;
    user.billing = {
      originalPrice: 0,
      discountedPrice: 0,
      couponCodeUsed: null,
      lastPaymentId: null,
      lastOrderId: null,
    };
  } else {
    // ───────────────────────────────────────────────────────────
    // 2. PAID SUBSCRIPTION LOGIC (CALCULATE EXACT DATES & PRICING)
    // ───────────────────────────────────────────────────────────
    const defaultPrice = getPlanPrice(normalizedPlan, selectedCycle);
    const originalPrice = typeof options.originalPrice === 'number' ? options.originalPrice : defaultPrice;
    const discountedPrice = typeof options.discountedPrice === 'number' ? options.discountedPrice : originalPrice;

    const now = new Date();
    let expiryDate;

    if (options.expiryDate) {
      expiryDate = new Date(options.expiryDate);
    } else if (options.durationDays && parseInt(options.durationDays, 10) > 0) {
      expiryDate = new Date(now.getTime() + parseInt(options.durationDays, 10) * 24 * 60 * 60 * 1000);
    } else {
      const standardDuration = selectedCycle === 'yearly' ? 365 : 30;
      expiryDate = new Date(now.getTime() + standardDuration * 24 * 60 * 60 * 1000);
    }

    user.plan = normalizedPlan;
    user.billingCycle = selectedCycle;
    user.planStartDate = now;
    user.planEndDate = expiryDate;
    user.isCustomPlan = Boolean(isManualAdminOverride || options.isCustomPlan);
    user.billing = {
      originalPrice,
      discountedPrice,
      couponCodeUsed: options.couponCode || null,
      lastPaymentId: options.paymentId || null,
      lastOrderId: options.orderId || null,
    };
  }

  await user.save({ validateBeforeSave: false });

  // ─────────────────────────────────────────────────────────────
  // 3. IMMUTABLE FINANCIAL LEDGER ENTRY (TRANSACTION RECORD)
  // ─────────────────────────────────────────────────────────────
  if (normalizedPlan !== 'free' || isManualAdminOverride || options.paymentId || options.utrNumber) {
    try {
      const companyId = user.companyId || (user.workStatus === 'company_owner' ? user._id : null);
      const paymentId = options.paymentId || (options.utrNumber ? `utr_${options.utrNumber}` : `txn_${isManualAdminOverride ? 'admin' : 'sys'}_${Date.now()}_${user._id.toString().slice(-4)}`);
      const orderId = options.orderId || (options.utrNumber ? `manual_utr_${options.utrNumber}` : `order_${isManualAdminOverride ? 'admin' : 'sys'}_${Date.now()}`);

      await Transaction.findOneAndUpdate(
        { razorpay_payment_id: paymentId },
        {
          $set: {
            userId: user._id,
            companyId,
            amount: user.billing.discountedPrice || 0,
            currency: 'INR',
            razorpay_order_id: orderId,
            razorpay_payment_id: paymentId,
            razorpay_signature: options.signature || (isManualAdminOverride ? 'admin_override_signature' : 'system_verified'),
            planName: planConfig.name || normalizedPlan,
            billingCycle: user.billingCycle || 'monthly',
            status: 'captured',
            paymentMethod: options.paymentMethod || (isManualAdminOverride ? 'admin_override' : (options.utrNumber ? 'manual_upi' : 'razorpay')),
            metadata: {
              ...options,
              processedAt: new Date(),
              isManualAdminOverride: Boolean(isManualAdminOverride),
            },
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    } catch (txErr) {
      console.warn('[SubscriptionManager] Transaction record creation notice:', txErr.message);
    }
  }

  // Calculate live subscription lifecycle
  const subscriptionLifecycle = await calculateSubscriptionLifecycle(user);
  user.subscriptionLifecycle = subscriptionLifecycle;

  return {
    user,
    subscriptionLifecycle,
  };
};

module.exports = {
  updateUserPlan,
};
