const crypto = require('crypto');
const mongoose = require('mongoose');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const Entitlement = require('../models/Entitlement');
const PaymentAttempt = require('../models/PaymentAttempt');
const AuditLog = require('../models/AuditLog');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const { razorpayInstance, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET } = require('../config/razorpay');

/**
 * Helper: Resolve Tenant Identity & Account Type
 */
const resolveTenantIdentity = (user) => {
  const isOwner = user.workStatus === 'company_owner' || user.companyRole === 'owner';
  const isOrgMember = !!user.companyId || isOwner;

  return {
    tenantId: isOwner ? user._id : (user.companyId || user._id),
    companyId: isOrgMember ? (isOwner ? user._id : user.companyId) : null,
    accountType: isOrgMember ? 'ORGANIZATION' : 'INDIVIDUAL',
    isOwner: isOwner || !isOrgMember,
  };
};

/**
 * Helper: Ensure Razorpay Plan exists on Razorpay gateway
 */
const ensureRazorpayPlan = async (plan) => {
  if (plan.razorpayPlanId) {
    return plan.razorpayPlanId;
  }

  if (!razorpayInstance) {
    throw new Error('Razorpay instance is not initialized. Please verify API keys.');
  }

  try {
    const createdPlan = await razorpayInstance.plans.create({
      period: plan.interval === 'yearly' ? 'yearly' : 'monthly',
      interval: 1,
      item: {
        name: plan.name,
        amount: plan.priceInPaise,
        currency: plan.currency || 'INR',
        description: `${plan.name} (${plan.accountType} - ${plan.interval})`,
      },
      notes: {
        planCode: plan.code,
        accountType: plan.accountType,
        tier: plan.tier,
      },
    });

    plan.razorpayPlanId = createdPlan.id;
    await plan.save();
    return createdPlan.id;
  } catch (err) {
    console.error('[Billing Engine] Failed to create Razorpay plan:', err);
    throw new Error(`Razorpay plan creation failed: ${err.message}`);
  }
};

/**
 * Helper: Ensure or create Razorpay Customer entity
 */
const ensureRazorpayCustomer = async (user) => {
  if (!razorpayInstance) return null;

  try {
    const customer = await razorpayInstance.customers.create({
      name: user.name || 'SalesCRM Subscriber',
      email: user.email,
      contact: user.phone ? user.phone.replace(/\D/g, '') : undefined,
      notes: {
        userId: user._id.toString(),
        usercode: user.usercode || '',
      },
    });
    return customer.id;
  } catch (err) {
    // If customer already exists with this email/contact, fetch or fallback gracefully
    console.warn('[Billing Engine] Razorpay customer notice:', err.message);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. CREATE SUBSCRIPTION / E-MANDATE INITIATION
// ─────────────────────────────────────────────────────────────────────────────
exports.createSubscription = async (req, res) => {
  try {
    const { planCode, seatQuantity = 1, couponCode } = req.body;

    if (!planCode) {
      return res.status(400).json({ success: false, message: 'planCode is required.' });
    }

    const { tenantId, companyId, accountType, isOwner } = resolveTenantIdentity(req.user);

    if (!isOwner) {
      return res.status(403).json({
        success: false,
        message: 'Only the account owner or company administrator can manage subscriptions.',
      });
    }

    // 1. Immutable Plan Lookup
    const plan = await Plan.findOne({ code: String(planCode).toUpperCase().trim(), isActive: true });
    if (!plan) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive subscription plan selected.' });
    }

    // 2. Strict Account Type Isolation
    if (plan.accountType !== accountType) {
      return res.status(403).json({
        success: false,
        message: `Account isolation violation: An ${accountType} account cannot subscribe to an ${plan.accountType} plan.`,
      });
    }

    // 3. Concurrency Lock check on active subscription
    const activeSub = await Subscription.findOne({
      userId: tenantId,
      status: { $in: ['ACTIVE', 'GRACE_PERIOD', 'CREATED', 'AUTHENTICATED'] },
    });

    if (activeSub && activeSub.billingLock) {
      const lockAge = Date.now() - new Date(activeSub.billingLockAcquiredAt || 0).getTime();
      if (lockAge < 5 * 60 * 1000) { // 5-minute safety window
        return res.status(409).json({
          success: false,
          message: 'A billing operation is already in progress for this account. Please wait a moment.',
        });
      }
    }

    // 4. Server-Side Price Calculation (Zero Frontend Trust)
    const validSeats = accountType === 'ORGANIZATION' ? Math.max(1, parseInt(seatQuantity, 10) || 1) : 1;
    let basePriceInPaise = plan.priceInPaise;
    let extraSeatsPriceInPaise = 0;

    if (accountType === 'ORGANIZATION' && validSeats > (plan.defaultEntitlements?.maxSeats || 1)) {
      const extraSeats = validSeats - (plan.defaultEntitlements?.maxSeats || 1);
      extraSeatsPriceInPaise = extraSeats * (plan.perSeatPriceInPaise || 0);
    }

    let finalPriceInPaise = basePriceInPaise + extraSeatsPriceInPaise;

    // Optional Coupon Validation
    let appliedCoupon = null;
    if (couponCode) {
      const couponDoc = await Coupon.findOne({
        code: String(couponCode).toUpperCase().trim(),
        isActive: true,
      });

      if (couponDoc && (!couponDoc.expiresAt || new Date() <= new Date(couponDoc.expiresAt))) {
        const discountPaise = Math.round((finalPriceInPaise * (couponDoc.discountPercent || 0)) / 100);
        finalPriceInPaise = Math.max(100, finalPriceInPaise - discountPaise); // Minimum 100 paise
        appliedCoupon = couponDoc.code;
      }
    }

    // 5. Razorpay Plan & Customer Resolution
    const rzpPlanId = await ensureRazorpayPlan(plan);
    const rzpCustomerId = await ensureRazorpayCustomer(req.user);

    // 6. Razorpay Subscription Creation
    const rzpSubscriptionPayload = {
      plan_id: rzpPlanId,
      total_count: plan.interval === 'yearly' ? 10 : 120, // 10 years or 120 months
      quantity: validSeats,
      customer_notify: 1,
      notes: {
        userId: tenantId.toString(),
        companyId: companyId ? companyId.toString() : '',
        accountType,
        planCode: plan.code,
        planId: plan._id.toString(),
        appliedCoupon: appliedCoupon || '',
      },
    };

    if (rzpCustomerId) {
      rzpSubscriptionPayload.customer_id = rzpCustomerId;
    }

    const rzpSubscription = await razorpayInstance.subscriptions.create(rzpSubscriptionPayload);

    // 7. Store Subscription Record in MongoDB
    const newSubscription = await Subscription.create({
      userId: tenantId,
      companyId,
      accountType,
      planId: plan._id,
      quantity: validSeats,
      razorpaySubscriptionId: rzpSubscription.id,
      razorpayCustomerId: rzpCustomerId || null,
      status: 'CREATED',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + (plan.interval === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000),
      billingLock: true,
      billingLockAcquiredAt: new Date(),
      metadata: {
        planCode: plan.code,
        appliedCoupon,
        finalPriceInPaise,
        shortUrl: rzpSubscription.short_url,
      },
    });

    res.status(201).json({
      success: true,
      subscriptionId: newSubscription._id,
      razorpaySubscriptionId: rzpSubscription.id,
      shortUrl: rzpSubscription.short_url,
      keyId: RAZORPAY_KEY_ID,
      amountInPaise: finalPriceInPaise,
      currency: plan.currency || 'INR',
      plan: {
        code: plan.code,
        name: plan.name,
        interval: plan.interval,
        seats: validSeats,
      },
    });
  } catch (err) {
    console.error('[Billing Engine] createSubscription error:', err);
    res.status(500).json({ success: false, message: err.message || 'Failed to initiate subscription.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. GET CURRENT SUBSCRIPTION & ACTIVE ENTITLEMENTS
// ─────────────────────────────────────────────────────────────────────────────
exports.getCurrentSubscription = async (req, res) => {
  try {
    const { tenantId, companyId, accountType } = resolveTenantIdentity(req.user);

    const subscription = await Subscription.findOne({
      userId: tenantId,
      status: { $in: ['ACTIVE', 'GRACE_PERIOD', 'PLAN_LOCKED', 'AUTHENTICATED', 'CREATED'] },
    })
      .populate('planId')
      .populate('pendingChange.targetPlanId')
      .lean();

    const entitlement = await Entitlement.findOne({ userId: tenantId }).lean();

    res.json({
      success: true,
      accountType,
      subscription: subscription || null,
      entitlement: entitlement || null,
      inGracePeriod: subscription?.status === 'GRACE_PERIOD',
      isPlanLocked: subscription?.status === 'PLAN_LOCKED',
    });
  } catch (err) {
    console.error('[Billing Engine] getCurrentSubscription error:', err);
    res.status(500).json({ success: false, message: 'Server error loading subscription status' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. CANCEL SUBSCRIPTION (END-OF-CYCLE OR IMMEDIATE)
// ─────────────────────────────────────────────────────────────────────────────
exports.cancelSubscription = async (req, res) => {
  try {
    const { cancelImmediately = false, reason = 'User requested cancellation' } = req.body;
    const { tenantId, isOwner } = resolveTenantIdentity(req.user);

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Only account owner can cancel subscriptions.' });
    }

    const subscription = await Subscription.findOne({
      userId: tenantId,
      status: { $in: ['ACTIVE', 'GRACE_PERIOD', 'AUTHENTICATED'] },
    });

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'No active subscription found to cancel.' });
    }

    // Cancel on Razorpay gateway
    if (subscription.razorpaySubscriptionId && razorpayInstance) {
      try {
        await razorpayInstance.subscriptions.cancel(
          subscription.razorpaySubscriptionId,
          !cancelImmediately // cancel_at_cycle_end
        );
      } catch (rzpErr) {
        console.warn('[Billing Engine] Razorpay cancel notice:', rzpErr.message);
      }
    }

    if (cancelImmediately) {
      subscription.status = 'CANCELLED';
      subscription.cancelledAt = new Date();
      subscription.cancellationReason = reason;
      await subscription.save();

      // Revoke Entitlement
      await Entitlement.findOneAndUpdate(
        { userId: tenantId },
        { $set: { status: 'RESTRICTED' } }
      );
    } else {
      subscription.cancelAtPeriodEnd = true;
      subscription.cancelledAt = new Date();
      subscription.cancellationReason = reason;
      await subscription.save();
    }

    await AuditLog.create({
      actorId: req.user._id,
      actorRole: req.user.role === 'superadmin' ? 'superadmin' : 'user',
      targetUserId: tenantId,
      action: 'SUBSCRIPTION_FORCE_CANCELLED',
      beforeState: { status: 'ACTIVE', cancelAtPeriodEnd: false },
      afterState: { status: subscription.status, cancelAtPeriodEnd: subscription.cancelAtPeriodEnd },
      reason,
    });

    res.json({
      success: true,
      message: cancelImmediately
        ? 'Subscription cancelled immediately.'
        : 'Subscription scheduled for cancellation at the end of the billing cycle.',
      subscription,
    });
  } catch (err) {
    console.error('[Billing Engine] cancelSubscription error:', err);
    res.status(500).json({ success: false, message: 'Failed to cancel subscription' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. PROVISION / REFRESH ENTITLEMENT ENGINE
// ─────────────────────────────────────────────────────────────────────────────
const syncEntitlementsForSubscription = async (subscription, plan, user) => {
  const accountType = subscription.accountType;
  const isAnnualPaidMonthly = plan.interval === 'yearly';
  const tenantAgeDays = (Date.now() - new Date(user.createdAt || Date.now()).getTime()) / (24 * 60 * 60 * 1000);

  // Anti-fraud: Export Gating logic
  let canExportData = true;
  let exportUnlockedAt = null;
  let gatingReason = null;

  if (plan.defaultEntitlements?.exportGatedDays > 0) {
    if (tenantAgeDays < plan.defaultEntitlements.exportGatedDays) {
      canExportData = false;
      exportUnlockedAt = new Date(new Date(user.createdAt).getTime() + plan.defaultEntitlements.exportGatedDays * 24 * 60 * 60 * 1000);
      gatingReason = `Anti-churn fraud gate: Exports unlock after ${plan.defaultEntitlements.exportGatedDays} days of continuous tenure.`;
    }
  }

  // Anti-fraud: Import velocity
  const dailyImportLimit = tenantAgeDays < 30 ? 500 : (plan.defaultEntitlements?.dailyImportLimit || 5000);

  // WhatsApp Quota & Drip
  const monthlyWA = plan.defaultEntitlements?.monthlyWAQuota || 1000;
  const isDrip = !!plan.defaultEntitlements?.isDripEnabled;
  const totalAnnualWA = plan.defaultEntitlements?.totalAnnualQuota || (monthlyWA * 12);

  const existingEntitlement = await Entitlement.findOne({ userId: subscription.userId });

  const drippedAccumulator = existingEntitlement
    ? (existingEntitlement.whatsapp?.drippedQuotaAccumulator || 0) + monthlyWA
    : monthlyWA;

  const entitlementUpdate = {
    userId: subscription.userId,
    companyId: subscription.companyId,
    subscriptionId: subscription._id,
    accountType,
    status: 'ACTIVE',
    seats: {
      maxAllowed: subscription.quantity || plan.defaultEntitlements?.maxSeats || 1,
      currentUsed: existingEntitlement?.seats?.currentUsed || 1,
    },
    leads: {
      maxAllowed: plan.defaultEntitlements?.maxLeads || 500,
      currentCount: existingEntitlement?.leads?.currentCount || 0,
    },
    whatsapp: {
      monthlyLimit: monthlyWA,
      messagesSentThisPeriod: 0, // Reset counter on successful billing
      quotaResetDate: subscription.currentPeriodEnd,
      isDripEnabled: isDrip,
      totalAnnualQuota: totalAnnualWA,
      drippedQuotaAccumulator: drippedAccumulator,
      nextDripDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    exportGating: {
      canExportData,
      exportUnlockedAt,
      gatingReason,
    },
    importVelocity: {
      dailyLimit: dailyImportLimit,
      importedToday: 0,
      lastResetAt: new Date(),
    },
    features: plan.defaultEntitlements?.features || {},
  };

  const updatedEntitlement = await Entitlement.findOneAndUpdate(
    { userId: subscription.userId },
    { $set: entitlementUpdate },
    { upsert: true, new: true }
  );

  // Sync User document plan status
  const planSlug = plan.tier === 3 ? 'enterprise' : (plan.tier === 2 ? 'pro' : 'starter');
  await User.findByIdAndUpdate(subscription.userId, {
    $set: {
      plan: planSlug,
      planStartDate: subscription.currentPeriodStart,
      planEndDate: subscription.currentPeriodEnd,
    },
  });

  return updatedEntitlement;
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. IDEMPOTENT RAZORPAY SUBSCRIPTION WEBHOOK RECEIVER
// ─────────────────────────────────────────────────────────────────────────────
exports.handleSubscriptionWebhook = async (req, res) => {
  try {
    const signature = req.headers['x-razorpay-signature'];
    const secret = RAZORPAY_WEBHOOK_SECRET;

    // 1. Mandatory Webhook Signature Verification
    if (!signature || !req.rawBody) {
      console.warn('[Webhook Engine] Missing signature or rawBody');
      return res.status(400).json({ status: 'error', message: 'Missing webhook signature' });
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(req.rawBody)
      .digest('hex');

    if (expectedSignature !== signature) {
      console.error('[Webhook Engine] 🚨 Invalid Razorpay signature attempt!');
      return res.status(400).json({ status: 'error', message: 'Invalid webhook signature' });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    console.log(`[Webhook Engine] Received verified event: "${event}"`);

    // 2. Deterministic Idempotency Key
    const subEntity = payload?.subscription?.entity;
    const paymentEntity = payload?.payment?.entity;
    const invoiceEntity = payload?.invoice?.entity;

    const rzpSubId = subEntity?.id || paymentEntity?.subscription_id || invoiceEntity?.subscription_id;
    const paymentId = paymentEntity?.id || (invoiceEntity?.payment_id || null);

    const idempotencyKey = `wh_${event}_${paymentId || invoiceEntity?.id || rzpSubId || Date.now()}`;

    // Check if this exact webhook execution has already been recorded
    const existingAttempt = await PaymentAttempt.findOne({ idempotencyKey });
    if (existingAttempt) {
      console.log(`[Webhook Engine] Idempotent skip: Event "${idempotencyKey}" already processed.`);
      return res.status(200).json({ status: 'ok', message: 'Already processed' });
    }

    // 3. Subscription Lookup
    let subscription = null;
    if (rzpSubId) {
      subscription = await Subscription.findOne({ razorpaySubscriptionId: rzpSubId }).populate('planId');
    }

    // ── EVENT ROUTING ────────────────────────────────────────────────────────
    switch (event) {
      // ── Event: Mandate Authenticated by Bank ─────────────────────────────
      case 'subscription.authenticated': {
        if (subscription) {
          subscription.status = 'AUTHENTICATED';
          subscription.billingLock = false;
          await subscription.save();
        }
        break;
      }

      // ── Event: Subscription Activated / Successfully Charged ─────────────
      case 'subscription.activated':
      case 'subscription.charged': {
        if (subscription) {
          const periodStart = subEntity?.current_start ? new Date(subEntity.current_start * 1000) : new Date();
          const periodEnd = subEntity?.current_end ? new Date(subEntity.current_end * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          subscription.status = 'ACTIVE';
          subscription.currentPeriodStart = periodStart;
          subscription.currentPeriodEnd = periodEnd;
          subscription.gracePeriodEnd = null; // Clear any active grace period
          subscription.retryCount = 0;
          subscription.billingLock = false;
          subscription.lastPaymentStatus = 'captured';
          subscription.lastPaymentDate = new Date();
          await subscription.save();

          // Record PaymentAttempt
          if (paymentEntity || invoiceEntity) {
            await PaymentAttempt.create({
              subscriptionId: subscription._id,
              userId: subscription.userId,
              companyId: subscription.companyId,
              razorpayPaymentId: paymentEntity?.id || null,
              razorpayOrderId: paymentEntity?.order_id || null,
              razorpaySubscriptionId: rzpSubId,
              razorpayInvoiceId: invoiceEntity?.id || null,
              idempotencyKey,
              amountInPaise: paymentEntity?.amount || invoiceEntity?.amount || subscription.planId?.priceInPaise || 0,
              currency: paymentEntity?.currency || 'INR',
              status: 'captured',
              method: paymentEntity?.method || 'emandate',
              rawGatewayResponse: payload,
              capturedAt: new Date(),
            });
          }

          // Provision / Refresh Entitlements
          const user = await User.findById(subscription.userId);
          if (user && subscription.planId) {
            await syncEntitlementsForSubscription(subscription, subscription.planId, user);
          }
        }
        break;
      }

      // ── Event: Payment Failed / Pending Retry (Enter Grace Period) ────────
      case 'subscription.pending':
      case 'payment.failed': {
        if (subscription) {
          subscription.status = 'GRACE_PERIOD';
          if (!subscription.gracePeriodEnd) {
            subscription.gracePeriodEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3-Day Grace Period
          }
          subscription.retryCount = (subscription.retryCount || 0) + 1;
          subscription.lastPaymentStatus = 'failed';
          subscription.lastPaymentError = paymentEntity?.error_description || 'Payment authorization failed';
          await subscription.save();

          await PaymentAttempt.create({
            subscriptionId: subscription._id,
            userId: subscription.userId,
            companyId: subscription.companyId,
            razorpayPaymentId: paymentEntity?.id || null,
            razorpaySubscriptionId: rzpSubId,
            idempotencyKey,
            amountInPaise: paymentEntity?.amount || 0,
            currency: paymentEntity?.currency || 'INR',
            status: 'failed',
            errorCode: paymentEntity?.error_code || 'PAYMENT_FAILED',
            errorDescription: paymentEntity?.error_description || 'Payment debit failed',
            rawGatewayResponse: payload,
          });

          await AuditLog.create({
            actorRole: 'system',
            targetUserId: subscription.userId,
            targetCompanyId: subscription.companyId,
            action: 'SUBSCRIPTION_RENEWAL_FAILED',
            beforeState: { status: 'ACTIVE' },
            afterState: { status: 'GRACE_PERIOD', gracePeriodEnd: subscription.gracePeriodEnd },
            reason: `Automatic debit failed. Grace period active until ${subscription.gracePeriodEnd.toISOString()}`,
          });
        }
        break;
      }

      // ── Event: Subscription Halted (Grace Period Expired $\rightarrow$ Lock Plan) ────
      case 'subscription.halted': {
        if (subscription) {
          subscription.status = 'PLAN_LOCKED';
          subscription.billingLock = false;
          await subscription.save();

          // Lock Entitlements (Suspends WhatsApp messaging, data export, lead addition)
          await Entitlement.findOneAndUpdate(
            { userId: subscription.userId },
            { $set: { status: 'LOCKED' } }
          );

          await AuditLog.create({
            actorRole: 'system',
            targetUserId: subscription.userId,
            targetCompanyId: subscription.companyId,
            action: 'SUBSCRIPTION_LOCKED',
            beforeState: { status: 'GRACE_PERIOD' },
            afterState: { status: 'PLAN_LOCKED' },
            reason: 'Razorpay subscription halted. Grace period expired without payment resolution.',
          });
        }
        break;
      }

      // ── Event: Subscription Cancelled ─────────────────────────────────────
      case 'subscription.cancelled': {
        if (subscription) {
          subscription.status = 'CANCELLED';
          subscription.billingLock = false;
          await subscription.save();

          // Revoke entitlement if not scheduled at period end
          if (!subscription.cancelAtPeriodEnd) {
            await Entitlement.findOneAndUpdate(
              { userId: subscription.userId },
              { $set: { status: 'RESTRICTED' } }
            );
          }
        }
        break;
      }

      default:
        console.log(`[Webhook Engine] Unhandled event "${event}" acknowledged.`);
    }

    res.status(200).json({ status: 'ok', eventReceived: event });
  } catch (err) {
    console.error('[Webhook Engine] Webhook processing error:', err);
    // Return 200 to prevent Razorpay storm on unhandled internal error, log for telemetry
    res.status(200).json({ status: 'error', message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. PLAN MODIFICATION (UPGRADE PRORATION & END-OF-CYCLE DOWNGRADE)
// ─────────────────────────────────────────────────────────────────────────────
exports.changePlan = async (req, res) => {
  try {
    const { targetPlanCode, targetQuantity = 1 } = req.body;
    const { tenantId, accountType, isOwner } = resolveTenantIdentity(req.user);

    if (!isOwner) {
      return res.status(403).json({ success: false, message: 'Only account owners can modify plans.' });
    }

    if (!targetPlanCode) {
      return res.status(400).json({ success: false, message: 'targetPlanCode is required.' });
    }

    // 1. Fetch Target Plan
    const targetPlan = await Plan.findOne({ code: String(targetPlanCode).toUpperCase().trim(), isActive: true });
    if (!targetPlan) {
      return res.status(400).json({ success: false, message: 'Invalid or inactive target plan selected.' });
    }

    // 2. Strict Account Type Isolation Check
    if (targetPlan.accountType !== accountType) {
      return res.status(403).json({
        success: false,
        message: `Account isolation violation: An ${accountType} account cannot change to an ${targetPlan.accountType} plan.`,
      });
    }

    // 3. Fetch Active Subscription
    const subscription = await Subscription.findOne({
      userId: tenantId,
      status: { $in: ['ACTIVE', 'AUTHENTICATED'] },
    }).populate('planId');

    if (!subscription) {
      return res.status(404).json({ success: false, message: 'No active subscription found to modify.' });
    }

    const currentPlan = subscription.planId;
    const requestedSeats = accountType === 'ORGANIZATION' ? Math.max(1, parseInt(targetQuantity, 10) || 1) : 1;

    // 4. Determine UPGRADE vs DOWNGRADE
    const isIntervalUpgrade = currentPlan.interval === 'monthly' && targetPlan.interval === 'yearly';
    const isTierUpgrade = targetPlan.tier > currentPlan.tier;
    const isSeatsUpgrade = requestedSeats > (subscription.quantity || 1);
    const isUpgrade = isIntervalUpgrade || isTierUpgrade || (targetPlan.tier === currentPlan.tier && isSeatsUpgrade);

    // 5. Ensure Razorpay target plan exists
    const rzpTargetPlanId = await ensureRazorpayPlan(targetPlan);

    if (isUpgrade) {
      // ── UPGRADE: IMMEDIATE PRORATION CALCULATION ─────────────────────────
      const now = Date.now();
      const periodStart = new Date(subscription.currentPeriodStart).getTime();
      const periodEnd = new Date(subscription.currentPeriodEnd).getTime();
      const totalDuration = Math.max(1, periodEnd - periodStart);
      const remainingDuration = Math.max(0, periodEnd - now);
      const unusedFraction = remainingDuration / totalDuration;

      // Current plan value calculation
      const currentExtraSeats = Math.max(0, (subscription.quantity || 1) - (currentPlan.defaultEntitlements?.maxSeats || 1));
      const currentTotalPaise = currentPlan.priceInPaise + (currentExtraSeats * (currentPlan.perSeatPriceInPaise || 0));
      const unusedValuePaise = Math.round(currentTotalPaise * unusedFraction);

      // Target plan value calculation
      const targetExtraSeats = Math.max(0, requestedSeats - (targetPlan.defaultEntitlements?.maxSeats || 1));
      const targetTotalPaise = targetPlan.priceInPaise + (targetExtraSeats * (targetPlan.perSeatPriceInPaise || 0));

      const payableDifferencePaise = Math.max(0, targetTotalPaise - unusedValuePaise);

      // Update Razorpay subscription schedule
      if (subscription.razorpaySubscriptionId && razorpayInstance) {
        try {
          await razorpayInstance.subscriptions.update(subscription.razorpaySubscriptionId, {
            plan_id: rzpTargetPlanId,
            schedule_change_at: 'now',
            quantity: requestedSeats,
          });
        } catch (rzpErr) {
          console.warn('[Billing Engine] Razorpay update notice:', rzpErr.message);
        }
      }

      const previousPlanId = subscription.planId;
      subscription.planId = targetPlan._id;
      subscription.quantity = requestedSeats;
      subscription.currentPeriodStart = new Date();
      subscription.currentPeriodEnd = new Date(now + (targetPlan.interval === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000);
      subscription.pendingChange = { targetPlanId: null, targetQuantity: null, changeType: null, requestedAt: null, effectiveDate: null, prorationSummary: null };
      await subscription.save();

      // Immediately sync upgraded entitlements
      await syncEntitlementsForSubscription(subscription, targetPlan, req.user);

      await AuditLog.create({
        actorId: req.user._id,
        actorRole: req.user.role === 'superadmin' ? 'superadmin' : 'user',
        targetUserId: tenantId,
        targetCompanyId: subscription.companyId,
        action: 'SUBSCRIPTION_PRORATION_APPLIED',
        beforeState: { planId: previousPlanId, code: currentPlan.code },
        afterState: { planId: targetPlan._id, code: targetPlan.code },
        reason: `Immediate upgrade executed with proration adjustment.`,
        metadata: {
          unusedValuePaise,
          targetTotalPaise,
          payableDifferencePaise,
        },
      });

      return res.json({
        success: true,
        changeType: 'UPGRADE',
        message: `Upgraded to ${targetPlan.name} immediately.`,
        proration: {
          unusedValuePaise,
          targetTotalPaise,
          payableDifferencePaise,
        },
        subscription,
      });
    } else {
      // ── DOWNGRADE: SCHEDULE AT END OF BILLING CYCLE ──────────────────────
      if (subscription.razorpaySubscriptionId && razorpayInstance) {
        try {
          await razorpayInstance.subscriptions.update(subscription.razorpaySubscriptionId, {
            plan_id: rzpTargetPlanId,
            schedule_change_at: 'cycle_end',
            quantity: requestedSeats,
          });
        } catch (rzpErr) {
          console.warn('[Billing Engine] Razorpay downgrade schedule notice:', rzpErr.message);
        }
      }

      subscription.pendingChange = {
        targetPlanId: targetPlan._id,
        targetQuantity: requestedSeats,
        changeType: 'DOWNGRADE',
        requestedAt: new Date(),
        effectiveDate: subscription.currentPeriodEnd,
        prorationSummary: {
          reason: 'Downgrade scheduled at end of cycle. No refund.',
          targetPlanCode: targetPlan.code,
        },
      };
      await subscription.save();

      await AuditLog.create({
        actorId: req.user._id,
        actorRole: req.user.role === 'superadmin' ? 'superadmin' : 'user',
        targetUserId: tenantId,
        targetCompanyId: subscription.companyId,
        action: 'SUBSCRIPTION_DOWNGRADE_SCHEDULED',
        beforeState: { planId: currentPlan._id, code: currentPlan.code },
        afterState: { targetPlanId: targetPlan._id, code: targetPlan.code, effectiveDate: subscription.currentPeriodEnd },
        reason: `Scheduled downgrade to ${targetPlan.name} at end of cycle on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}.`,
      });

      return res.json({
        success: true,
        changeType: 'DOWNGRADE',
        message: `Your downgrade to ${targetPlan.name} is scheduled for the end of your billing period (${new Date(subscription.currentPeriodEnd).toLocaleDateString()}). Current plan remains active until then.`,
        effectiveDate: subscription.currentPeriodEnd,
        subscription,
      });
    }
  } catch (err) {
    console.error('[Billing Engine] changePlan error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error changing plan' });
  }
};
