const crypto = require('crypto');
const mongoose = require('mongoose');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const PaymentAttempt = require('../models/PaymentAttempt');
const Transaction = require('../models/Transaction');
const AuditLog = require('../models/AuditLog');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const Entitlement = require('../models/Entitlement');
const { razorpayInstance, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET } = require('../config/razorpay');
const { transitionTenantState } = require('../superadmin/services/tenantLifecycleService');
const { updateUserPlan } = require('../utils/subscriptionManager');
const { getPlanPrice, getPlanDetails } = require('../utils/planLimits');

/**
 * CENTRALIZED PAYMENT & SUBSCRIPTION RECONCILIATION ENGINE (v2 Hardened)
 * Authoritative production system for:
 * 1. Raw-Body Webhook Cryptographic Verification & Concurrency Idempotency
 * 2. Integer-Paise Financial Math & Multiple Partial Refund Reconciliation
 * 3. Out-of-Order Webhook Event Ordering & Stale Replay Rejection (IGNORED_STALE)
 * 4. Deterministic Self-Healing Safety Boundaries & Manual Review Queue
 * 5. Tenant Lifecycle State Machine Isolation & Concurrency Versioning
 * 6. Structured Correlation Auditing & Observability
 */

/**
 * Safe Structured Logger that filters secrets
 */
function logReconciliation(level, message, metadata = {}) {
  const sanitizedMeta = { ...metadata };
  // Redact any potential credentials
  delete sanitizedMeta.secret;
  delete sanitizedMeta.keySecret;
  delete sanitizedMeta.webhookSecret;
  delete sanitizedMeta.signature;

  const logEntry = {
    timestamp: new Date().toISOString(),
    component: 'ReconciliationEngine',
    level,
    message,
    ...sanitizedMeta,
  };

  if (level === 'error') {
    console.error(JSON.stringify(logEntry));
  } else if (level === 'warn') {
    console.warn(JSON.stringify(logEntry));
  } else {
    console.log(JSON.stringify(logEntry));
  }
}

/**
 * Verify Razorpay Webhook HMAC SHA256 Signature using raw body bytes/string
 * @param {string|Buffer} rawBody - Raw unmodified HTTP request body
 * @param {string} signature - x-razorpay-signature header
 * @returns {boolean}
 */
function verifyWebhookSignature(rawBody, signature) {
  if (!signature || !rawBody) {
    return false;
  }
  const secret = RAZORPAY_WEBHOOK_SECRET || RAZORPAY_KEY_SECRET;
  if (!secret) {
    return false;
  }

  try {
    const bodyBuffer = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
    if (bodyBuffer.length === 0) {
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(bodyBuffer)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const sigBuf = Buffer.from(String(signature), 'utf8');

    if (expectedBuf.length !== sigBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, sigBuf);
  } catch (err) {
    logReconciliation('error', 'Webhook signature verification exception', { error: err.message });
    return false;
  }
}

/**
 * Verify Razorpay Payment Checkout Signature (order_id|payment_id)
 * @param {string} orderId
 * @param {string} paymentId
 * @param {string} signature
 * @returns {boolean}
 */
function verifyPaymentSignature(orderId, paymentId, signature) {
  if (!orderId || !paymentId || !signature) return false;
  const secret = RAZORPAY_KEY_SECRET;
  if (!secret) return false;

  try {
    const payloadStr = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadStr)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature, 'utf8');
    const sigBuf = Buffer.from(String(signature), 'utf8');

    if (expectedBuf.length !== sigBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, sigBuf);
  } catch (err) {
    logReconciliation('error', 'Payment signature verification exception', { error: err.message });
    return false;
  }
}

/**
 * Reconcile & Verify an Individual Payment
 * Validates integer amount in paise, currency, status, idempotency, and synchronizes Transaction ledger.
 * @param {object} paymentParams
 * @returns {Promise<object>}
 */
async function reconcilePayment(paymentParams) {
  const {
    razorpayPaymentId,
    razorpayOrderId,
    razorpaySubscriptionId,
    amountInPaise,
    currency = 'INR',
    status = 'captured',
    method = 'emandate',
    userId,
    companyId,
    planCode,
    billingCycle = 'monthly',
    rawGatewayResponse = {},
    idempotencyKey,
  } = paymentParams;

  if (!razorpayPaymentId && !razorpayOrderId) {
    const err = new Error('Reconciliation error: Either razorpayPaymentId or razorpayOrderId is mandatory for payment matching.');
    err.statusCode = 400;
    throw err;
  }

  const effectiveIdempotencyKey = idempotencyKey || `pay_${razorpayPaymentId || razorpayOrderId}_${status}`;
  const correlationId = { paymentId: razorpayPaymentId, orderId: razorpayOrderId, idempotencyKey: effectiveIdempotencyKey };

  // 1. Database-Level Idempotency Check on PaymentAttempt
  const existingAttempt = await PaymentAttempt.findOne({
    $or: [
      { idempotencyKey: effectiveIdempotencyKey },
      ...(razorpayPaymentId ? [{ razorpayPaymentId, status: 'captured' }] : []),
    ],
  });

  if (existingAttempt && existingAttempt.status === 'captured') {
    return {
      success: true,
      idempotent: true,
      reconciliationStatus: existingAttempt.reconciliationStatus || 'MATCHED',
      message: 'Payment already reconciled and recorded.',
      paymentAttempt: existingAttempt,
    };
  }

  // 2. Financial Amount & Currency Integrity (Integer Paise Arithmetic)
  let expectedAmountPaise = paymentParams.expectedAmountPaise !== undefined
    ? Math.round(Number(paymentParams.expectedAmountPaise))
    : (paymentParams.expectedAmount !== undefined ? Math.round(Number(paymentParams.expectedAmount) * 100) : null);

  let dbPlan = null;
  if (expectedAmountPaise === null && planCode) {
    dbPlan = await Plan.findOne({
      $or: [
        { code: String(planCode).toUpperCase().trim() },
        { code: String(planCode).trim() },
        { name: new RegExp(`^${planCode}$`, 'i') },
      ],
    }).lean();

    if (dbPlan) {
      const price = billingCycle === 'yearly' ? (dbPlan.yearlyPrice || dbPlan.price) : (dbPlan.monthlyPrice || dbPlan.price);
      expectedAmountPaise = Math.round((Number(price) || 0) * 100);
    } else {
      const planDetails = getPlanDetails(planCode);
      if (planDetails) {
        const priceInRupees = getPlanPrice(planCode, billingCycle);
        expectedAmountPaise = Math.round(priceInRupees * 100);
      }
    }
  }

  let reconciliationStatus = 'MATCHED';
  let reconciliationNotes = null;
  const parsedPaise = Math.round(Number(amountInPaise) || 0);

  if (currency.toUpperCase() !== 'INR') {
    reconciliationStatus = 'MISMATCHED';
    reconciliationNotes = `Currency mismatch: Expected INR, got ${currency}`;
  } else if (expectedAmountPaise !== null && parsedPaise !== undefined && parsedPaise < expectedAmountPaise) {
    reconciliationStatus = 'MISMATCHED';
    reconciliationNotes = `Underpayment detected: Expected ${expectedAmountPaise} paise, received ${parsedPaise} paise.`;
  }

  // 3. Resolve Target Tenant & Subscription
  let targetTenantId = userId;
  let targetCompanyId = companyId;
  let subscription = null;

  if (razorpaySubscriptionId) {
    subscription = await Subscription.findOne({ razorpaySubscriptionId });
    if (subscription) {
      targetTenantId = targetTenantId || subscription.userId;
      targetCompanyId = targetCompanyId || subscription.companyId;
    }
  }

  if (!targetTenantId && razorpayOrderId) {
    const existingTxn = await Transaction.findOne({ razorpay_order_id: razorpayOrderId });
    if (existingTxn) {
      targetTenantId = existingTxn.userId;
      targetCompanyId = existingTxn.companyId;
    }
  }

  // 4. Create or Update PaymentAttempt with Database-Level Concurrency Guard
  let paymentAttempt;
  try {
    paymentAttempt = await PaymentAttempt.findOneAndUpdate(
      { idempotencyKey: effectiveIdempotencyKey },
      {
        $set: {
          subscriptionId: subscription?._id || new mongoose.Types.ObjectId(),
          userId: targetTenantId || new mongoose.Types.ObjectId(),
          companyId: targetCompanyId || null,
          razorpayPaymentId: razorpayPaymentId || null,
          razorpayOrderId: razorpayOrderId || null,
          razorpaySubscriptionId: razorpaySubscriptionId || null,
          amountInPaise: parsedPaise,
          netAmountInPaise: parsedPaise,
          currency: currency.toUpperCase(),
          status,
          method,
          reconciliationStatus,
          rawGatewayResponse,
          capturedAt: status === 'captured' ? new Date() : null,
        },
      },
      { upsert: true, new: true }
    );
  } catch (dbErr) {
    if (dbErr.code === 11000) {
      logReconciliation('warn', 'Concurrent duplicate write intercepted by unique index', correlationId);
      paymentAttempt = await PaymentAttempt.findOne({ idempotencyKey: effectiveIdempotencyKey });
      return {
        success: true,
        idempotent: true,
        reconciliationStatus: paymentAttempt?.reconciliationStatus || 'MATCHED',
        message: 'Concurrent duplicate payment resolved canonically.',
        paymentAttempt,
      };
    }
    throw dbErr;
  }

  // 5. If Payment Captured and Matched -> Synchronize Transaction Ledger & Tenant Lifecycle
  if (status === 'captured' && reconciliationStatus === 'MATCHED') {
    const amountInRupees = parsedPaise / 100;
    const planName = planCode || subscription?.planId?.name || 'SaaS Plan Subscription';

    try {
      await Transaction.findOneAndUpdate(
        { razorpay_payment_id: razorpayPaymentId },
        {
          $set: {
            userId: targetTenantId,
            companyId: targetCompanyId,
            amount: amountInRupees,
            amountInPaise: parsedPaise,
            netAmountInPaise: parsedPaise,
            currency: currency.toUpperCase(),
            razorpay_order_id: razorpayOrderId || `order_${Date.now()}`,
            razorpay_payment_id: razorpayPaymentId,
            planName,
            billingCycle,
            status: 'captured',
            paymentMethod: method,
            metadata: {
              reconciliationStatus,
              reconciledAt: new Date(),
            },
          },
        },
        { upsert: true, new: true }
      );
    } catch (txnErr) {
      if (txnErr.code === 11000) {
        logReconciliation('warn', 'Transaction duplicate index caught concurrent write', { razorpayPaymentId });
      } else {
        throw txnErr;
      }
    }

    // Synchronize Subscription
    if (subscription) {
      subscription.status = 'ACTIVE';
      subscription.lastPaymentStatus = 'captured';
      subscription.lastPaymentDate = new Date();
      subscription.gracePeriodEnd = null;
      subscription.retryCount = 0;
      subscription.reconciliationStatus = 'MATCHED';
      subscription.lastReconciledAt = new Date();
      await subscription.save();
    }

    // Synchronize Tenant Lifecycle (TRIAL -> ACTIVE or PAST_DUE -> ACTIVE)
    if (targetTenantId) {
      try {
        const tenantUser = await User.findById(targetTenantId);
        if (tenantUser) {
          const currentLifeState = tenantUser.lifecycleStatus || 'TRIAL';
          if (['TRIAL', 'PAST_DUE', 'PROVISIONING'].includes(currentLifeState)) {
            await transitionTenantState(targetTenantId, 'ACTIVE', { isSystem: true, role: 'system' }, {
              reason: `Payment verified & reconciled via Razorpay (${razorpayPaymentId})`,
            });
          }
        }
      } catch (lifeErr) {
        logReconciliation('warn', 'Lifecycle transition notice:', { error: lifeErr.message, tenantId: targetTenantId });
      }
    }

    // Record Immutable Audit Log
    try {
      await AuditLog.create({
        actorRole: 'system',
        actorName: 'Reconciliation Engine',
        organizationId: targetCompanyId || targetTenantId,
        action: 'PAYMENT_RECONCILED',
        resourceType: 'Payment',
        resourceId: razorpayPaymentId,
        resourceName: `Payment ₹${amountInRupees}`,
        before: { status: 'pending' },
        after: { status: 'captured', reconciliationStatus: 'MATCHED' },
        metadata: {
          razorpayPaymentId,
          razorpayOrderId,
          razorpaySubscriptionId,
          amountInPaise: parsedPaise,
          amountInRupees,
        },
        timestamp: new Date(),
      });
    } catch (auditErr) {
      logReconciliation('warn', 'Audit log write notice:', { error: auditErr.message });
    }
  } else if (reconciliationStatus === 'MISMATCHED') {
    // Record Mismatch in Audit Log for SuperAdmin Manual Review Queue
    try {
      await AuditLog.create({
        actorRole: 'system',
        actorName: 'Reconciliation Engine',
        organizationId: targetCompanyId || targetTenantId,
        action: 'RECONCILIATION_MISMATCH',
        resourceType: 'Payment',
        resourceId: razorpayPaymentId || razorpayOrderId,
        resourceName: `Flagged Payment Mismatch`,
        before: { reconciliationStatus: 'PENDING' },
        after: { reconciliationStatus: 'MISMATCHED', notes: reconciliationNotes },
        metadata: {
          razorpayPaymentId,
          razorpayOrderId,
          amountInPaise: parsedPaise,
          expectedAmountPaise,
          notes: reconciliationNotes,
        },
        timestamp: new Date(),
      });
    } catch (auditErr) {
      logReconciliation('warn', 'Audit mismatch note:', { error: auditErr.message });
    }
  }

  return {
    success: true,
    reconciliationStatus,
    reconciliationNotes,
    paymentAttempt,
  };
}

/**
 * Reconcile Subscription State Against Gateway State
 * Compares CoreSetu Subscription vs Razorpay Subscription and heals recoverable discrepancies.
 * Ambiguous cases are strictly flagged for MANUAL_REVIEW.
 * @param {string|ObjectId} subscriptionIdOrRzpSubId
 * @param {object} options
 * @returns {Promise<object>}
 */
async function reconcileSubscription(subscriptionIdOrRzpSubId, options = {}) {
  let subscription = null;

  if (mongoose.Types.ObjectId.isValid(subscriptionIdOrRzpSubId)) {
    subscription = await Subscription.findById(subscriptionIdOrRzpSubId).populate('planId');
  }

  if (!subscription) {
    subscription = await Subscription.findOne({ razorpaySubscriptionId: String(subscriptionIdOrRzpSubId) }).populate('planId');
  }

  if (!subscription) {
    return {
      success: false,
      reconciliationStatus: 'MISMATCHED',
      message: `Subscription "${subscriptionIdOrRzpSubId}" not found in CoreSetu database.`,
    };
  }

  // Verify Tenant Identity Exists
  const tenantExists = await User.findById(subscription.companyId || subscription.userId);
  if (!tenantExists) {
    subscription.reconciliationStatus = 'MANUAL_REVIEW';
    subscription.reconciliationNotes = 'Associated tenant record missing from database.';
    await subscription.save();
    return {
      success: true,
      subscriptionId: subscription._id,
      reconciliationStatus: 'MANUAL_REVIEW',
      isRecoverable: false,
      reason: 'Unknown tenant record.',
    };
  }

  const internalStatus = subscription.status;
  let externalStatus = null;
  let externalSubData = null;

  // Query Razorpay Gateway if available
  if (subscription.razorpaySubscriptionId && razorpayInstance && !options.mockExternalStatus) {
    try {
      externalSubData = await razorpayInstance.subscriptions.fetch(subscription.razorpaySubscriptionId);
      externalStatus = externalSubData.status;
    } catch (rzpErr) {
      logReconciliation('warn', `Could not fetch Razorpay subscription ${subscription.razorpaySubscriptionId}:`, { error: rzpErr.message });
    }
  } else if (options.mockExternalStatus) {
    externalStatus = options.mockExternalStatus;
  }

  // Normalize Gateway status
  const normalizedExternal = externalStatus ? String(externalStatus).toUpperCase() : null;

  let reconciliationStatus = 'MATCHED';
  let isRecoverable = false;
  let healAction = null;

  if (!normalizedExternal) {
    reconciliationStatus = 'MATCHED'; // Standalone internal subscription
  } else if (normalizedExternal === 'ACTIVE') {
    if (['PAST_DUE', 'GRACE_PERIOD', 'PLAN_LOCKED'].includes(internalStatus)) {
      reconciliationStatus = 'RECOVERABLE';
      isRecoverable = true;
      healAction = 'ACTIVATE';
    } else if (internalStatus === 'ACTIVE') {
      reconciliationStatus = 'MATCHED';
    } else {
      reconciliationStatus = 'MANUAL_REVIEW';
    }
  } else if (['HALTED', 'EXPIRED', 'PENDING'].includes(normalizedExternal)) {
    if (internalStatus === 'ACTIVE') {
      reconciliationStatus = 'RECOVERABLE';
      isRecoverable = true;
      healAction = 'PAST_DUE';
    } else if (['PAST_DUE', 'GRACE_PERIOD', 'PLAN_LOCKED'].includes(internalStatus)) {
      reconciliationStatus = 'MATCHED';
    }
  } else if (normalizedExternal === 'CANCELLED') {
    if (internalStatus !== 'CANCELLED' && !subscription.cancelAtPeriodEnd) {
      reconciliationStatus = 'RECOVERABLE';
      isRecoverable = true;
      healAction = 'CANCEL';
    } else {
      reconciliationStatus = 'MATCHED';
    }
  }

  // Perform Self-Healing Repair ONLY if Deterministically Recoverable
  if (isRecoverable && healAction && !options.dryRun) {
    const previousState = subscription.status;
    const now = new Date();
    const repairId = `rep_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    if (healAction === 'ACTIVATE') {
      subscription.status = 'ACTIVE';
      subscription.gracePeriodEnd = null;
      subscription.retryCount = 0;
      subscription.reconciliationStatus = 'LAST_RECONCILED';
      subscription.lastReconciledAt = now;
      await subscription.save();

      // Heal Tenant Lifecycle
      try {
        await transitionTenantState(subscription.companyId || subscription.userId, 'ACTIVE', { isSystem: true, role: 'system' }, {
          reason: `Reconciliation self-healing: Razorpay subscription verified as ACTIVE.`,
        });
      } catch (lifeErr) {
        logReconciliation('warn', 'Lifecycle healing notice:', { error: lifeErr.message });
      }

      await AuditLog.create({
        actorRole: 'system',
        actorName: 'SYSTEM_RECONCILIATION',
        organizationId: subscription.companyId || subscription.userId,
        action: 'RECONCILIATION_REPAIRED',
        resourceType: 'Subscription',
        resourceId: subscription._id.toString(),
        resourceName: 'Subscription Self-Healing',
        before: { status: previousState },
        after: { status: 'ACTIVE', reconciliationStatus: 'MATCHED' },
        metadata: {
          repairId,
          tenantId: subscription.companyId || subscription.userId,
          subscriptionId: subscription._id,
          previousState,
          newState: 'ACTIVE',
          reason: `Reconciliation self-healing: Razorpay subscription verified as ACTIVE.`,
          source: 'Razorpay Gateway',
          gatewayState: normalizedExternal,
          internalState: previousState,
          timestamp: now,
          actor: 'SYSTEM_RECONCILIATION',
        },
        timestamp: now,
      });
    } else if (healAction === 'PAST_DUE') {
      subscription.status = 'PAST_DUE';
      subscription.reconciliationStatus = 'LAST_RECONCILED';
      subscription.lastReconciledAt = now;
      await subscription.save();

      try {
        await transitionTenantState(subscription.companyId || subscription.userId, 'PAST_DUE', { isSystem: true, role: 'system' }, {
          reason: `Reconciliation: External subscription is ${normalizedExternal}.`,
        });
      } catch (lifeErr) {
        logReconciliation('warn', 'Lifecycle transition notice:', { error: lifeErr.message });
      }
    } else if (healAction === 'CANCEL') {
      subscription.status = 'CANCELLED';
      subscription.cancelledAt = now;
      subscription.reconciliationStatus = 'LAST_RECONCILED';
      subscription.lastReconciledAt = now;
      await subscription.save();
    }
  }

  return {
    success: true,
    subscriptionId: subscription._id,
    internalStatus,
    externalStatus: normalizedExternal,
    reconciliationStatus,
    isRecoverable,
    healAction,
    subscription,
  };
}

/**
 * Master Webhook Event Handler & Router (v2 Hardened)
 * Centralized, idempotent, signature-verified handler with ordering and replay protection.
 * @param {string} event - Event name (e.g. 'payment.captured', 'subscription.activated')
 * @param {object} payload - Webhook payload object
 * @param {string} signature - Cryptographic HMAC signature
 * @param {string|Buffer} rawBody - Raw body buffer for verification
 * @returns {Promise<object>}
 */
async function reconcileWebhookEvent(event, payload, signature, rawBody) {
  // 1. Mandatory Cryptographic Raw-Body Signature Verification
  if (!rawBody || (typeof rawBody === 'string' && rawBody.trim().length === 0)) {
    const err = new Error('Missing raw body for webhook signature verification');
    err.statusCode = 400;
    err.code = 'MISSING_RAW_BODY';
    throw err;
  }

  const isSignatureValid = verifyWebhookSignature(rawBody, signature);
  if (!isSignatureValid) {
    const err = new Error('Invalid Razorpay webhook signature');
    err.statusCode = 400;
    err.code = 'INVALID_SIGNATURE';
    throw err;
  }

  // 2. Deterministic Idempotency Key Construction
  const paymentEntity = payload?.payment?.entity || {};
  const orderEntity = payload?.order?.entity || {};
  const subEntity = payload?.subscription?.entity || {};
  const invoiceEntity = payload?.invoice?.entity || {};
  const refundEntity = payload?.refund?.entity || {};

  const paymentId = paymentEntity.id || invoiceEntity.payment_id || refundEntity.payment_id || null;
  const orderId = orderEntity.id || paymentEntity.order_id || null;
  const rzpSubId = subEntity.id || paymentEntity.subscription_id || invoiceEntity.subscription_id || null;
  const refundId = refundEntity.id || null;

  const eventIdentifier = refundId || paymentId || orderId || rzpSubId || Date.now();
  const idempotencyKey = `wh_${event}_${eventIdentifier}`;

  // 3. Database-Level Concurrency & Replay Check
  const existingAttempt = await PaymentAttempt.findOne({ idempotencyKey });
  if (existingAttempt) {
    logReconciliation('info', `Idempotent duplicate webhook safely skipped: ${idempotencyKey}`);
    return {
      success: true,
      idempotent: true,
      status: 'ALREADY_PROCESSED',
      message: `Event "${idempotencyKey}" already processed. Safe NO-OP executed.`,
      paymentAttempt: existingAttempt,
    };
  }

  // 4. Webhook Event Ordering & Stale Replay Guard
  const rawCreatedAt = subEntity.created_at || paymentEntity.created_at || refundEntity.created_at || payload.created_at;
  const eventTimestamp = rawCreatedAt ? new Date(rawCreatedAt * 1000) : new Date();

  if (rzpSubId) {
    const existingSub = await Subscription.findOne({ razorpaySubscriptionId: rzpSubId });
    if (existingSub) {
      // Check if event is stale (e.g. older event received after newer event)
      if (existingSub.lastEventTimestamp && eventTimestamp < existingSub.lastEventTimestamp) {
        logReconciliation('warn', `Stale webhook event "${event}" arrived after newer event. Marking IGNORED_STALE.`, {
          rzpSubId,
          incomingTimestamp: eventTimestamp,
          currentTimestamp: existingSub.lastEventTimestamp,
        });

        try {
          await AuditLog.create({
            actorRole: 'system',
            actorName: 'Reconciliation Engine',
            organizationId: existingSub.companyId || existingSub.userId,
            action: 'RECONCILIATION_STALE_EVENT',
            resourceType: 'Subscription',
            resourceId: existingSub._id.toString(),
            resourceName: 'Stale Webhook Event Ignored',
            metadata: {
              event,
              incomingTimestamp: eventTimestamp,
              currentLastEventTimestamp: existingSub.lastEventTimestamp,
              currentStatus: existingSub.status,
            },
            timestamp: new Date(),
          });
        } catch (auditErr) {
          logReconciliation('warn', 'Audit stale log notice:', { error: auditErr.message });
        }

        return {
          success: true,
          status: 'IGNORED_STALE',
          message: 'Stale webhook event ignored to preserve current state.',
        };
      }

      // Update Subscription event watermark
      existingSub.lastEventTimestamp = eventTimestamp;
      existingSub.lastWebhookEvent = event;
      await existingSub.save();
    }
  }

  logReconciliation('info', `Processing verified webhook event: "${event}" (${idempotencyKey})`);

  let result = null;

  // 5. Route by Event Type
  switch (event) {
    case 'payment.captured':
    case 'order.paid': {
      const notes = { ...orderEntity.notes, ...paymentEntity.notes };
      result = await reconcilePayment({
        razorpayPaymentId: paymentEntity.id,
        razorpayOrderId: orderId,
        razorpaySubscriptionId: rzpSubId,
        amountInPaise: paymentEntity.amount,
        currency: paymentEntity.currency || 'INR',
        status: 'captured',
        method: paymentEntity.method || 'emandate',
        userId: notes.userId,
        companyId: notes.companyId,
        planCode: notes.planId || notes.planCode,
        billingCycle: notes.cycle || 'monthly',
        rawGatewayResponse: payload,
        idempotencyKey,
      });
      break;
    }

    case 'payment.failed': {
      const notes = { ...orderEntity.notes, ...paymentEntity.notes };
      let sub = null;
      if (rzpSubId) {
        sub = await Subscription.findOne({ razorpaySubscriptionId: rzpSubId });
      }

      let attempt;
      try {
        attempt = await PaymentAttempt.create({
          subscriptionId: sub?._id || new mongoose.Types.ObjectId(),
          userId: sub?.userId || notes.userId || new mongoose.Types.ObjectId(),
          companyId: sub?.companyId || notes.companyId || null,
          razorpayPaymentId: paymentEntity.id || null,
          razorpayOrderId: orderId,
          razorpaySubscriptionId: rzpSubId,
          idempotencyKey,
          amountInPaise: Math.round(Number(paymentEntity.amount) || 0),
          netAmountInPaise: Math.round(Number(paymentEntity.amount) || 0),
          currency: paymentEntity.currency || 'INR',
          status: 'failed',
          errorCode: paymentEntity.error_code || 'PAYMENT_FAILED',
          errorDescription: paymentEntity.error_description || 'Payment debit failed',
          rawGatewayResponse: payload,
        });
      } catch (dupErr) {
        if (dupErr.code === 11000) {
          attempt = await PaymentAttempt.findOne({ idempotencyKey });
        } else {
          throw dupErr;
        }
      }

      // Update subscription to GRACE_PERIOD
      if (sub) {
        sub.status = 'GRACE_PERIOD';
        if (!sub.gracePeriodEnd) {
          sub.gracePeriodEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        }
        sub.retryCount = (sub.retryCount || 0) + 1;
        sub.lastPaymentStatus = 'failed';
        sub.lastPaymentError = paymentEntity.error_description || 'Payment debit failed';
        await sub.save();

        try {
          await transitionTenantState(sub.companyId || sub.userId, 'PAST_DUE', { isSystem: true, role: 'system' }, {
            reason: `Payment debit failed. Grace period active until ${sub.gracePeriodEnd.toISOString()}`,
          });
        } catch (lifeErr) {
          logReconciliation('warn', 'Lifecycle transition notice:', { error: lifeErr.message });
        }
      }

      result = { success: true, status: 'FAILED_RECORDED', paymentAttempt: attempt };
      break;
    }

    case 'subscription.authenticated': {
      if (rzpSubId) {
        const sub = await Subscription.findOneAndUpdate(
          { razorpaySubscriptionId: rzpSubId },
          { $set: { status: 'AUTHENTICATED', billingLock: false } },
          { new: true }
        );
        result = { success: true, subscription: sub };
      }
      break;
    }

    case 'subscription.activated':
    case 'subscription.charged': {
      if (rzpSubId) {
        const periodStart = subEntity.current_start ? new Date(subEntity.current_start * 1000) : new Date();
        const periodEnd = subEntity.current_end ? new Date(subEntity.current_end * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        const sub = await Subscription.findOneAndUpdate(
          { razorpaySubscriptionId: rzpSubId },
          {
            $set: {
              status: 'ACTIVE',
              currentPeriodStart: periodStart,
              currentPeriodEnd: periodEnd,
              gracePeriodEnd: null,
              retryCount: 0,
              billingLock: false,
              lastPaymentStatus: 'captured',
              lastPaymentDate: new Date(),
              reconciliationStatus: 'MATCHED',
              lastReconciledAt: new Date(),
            },
          },
          { new: true }
        );

        if (sub) {
          const parsedChargePaise = Math.round(Number(paymentEntity.amount || invoiceEntity.amount || 0));
          try {
            await PaymentAttempt.create({
              subscriptionId: sub._id,
              userId: sub.userId,
              companyId: sub.companyId,
              razorpayPaymentId: paymentId,
              razorpayOrderId: orderId,
              razorpaySubscriptionId: rzpSubId,
              idempotencyKey,
              amountInPaise: parsedChargePaise,
              netAmountInPaise: parsedChargePaise,
              currency: paymentEntity.currency || 'INR',
              status: 'captured',
              method: paymentEntity.method || 'emandate',
              rawGatewayResponse: payload,
              capturedAt: new Date(),
            });
          } catch (dbErr) {
            if (dbErr.code !== 11000) throw dbErr;
          }

          // Transition Tenant Lifecycle to ACTIVE
          try {
            await transitionTenantState(sub.companyId || sub.userId, 'ACTIVE', { isSystem: true, role: 'system' }, {
              reason: `Razorpay subscription charged & active (${rzpSubId})`,
            });
          } catch (lifeErr) {
            logReconciliation('warn', 'Lifecycle transition notice:', { error: lifeErr.message });
          }
        }
        result = { success: true, subscription: sub };
      }
      break;
    }

    case 'subscription.halted': {
      if (rzpSubId) {
        const sub = await Subscription.findOneAndUpdate(
          { razorpaySubscriptionId: rzpSubId },
          { $set: { status: 'PLAN_LOCKED', billingLock: false } },
          { new: true }
        );
        if (sub) {
          try {
            await transitionTenantState(sub.companyId || sub.userId, 'SUSPENDED', { isSystem: true, role: 'system' }, {
              reason: `Razorpay subscription halted. Grace period expired.`,
            });
          } catch (lifeErr) {
            logReconciliation('warn', 'Lifecycle transition notice:', { error: lifeErr.message });
          }
        }
        result = { success: true, subscription: sub };
      }
      break;
    }

    case 'subscription.cancelled': {
      if (rzpSubId) {
        const sub = await Subscription.findOneAndUpdate(
          { razorpaySubscriptionId: rzpSubId },
          { $set: { status: 'CANCELLED', cancelledAt: new Date(), billingLock: false } },
          { new: true }
        );
        if (sub && !sub.cancelAtPeriodEnd) {
          try {
            await transitionTenantState(sub.companyId || sub.userId, 'CANCELLED', { isSystem: true, role: 'system' }, {
              reason: `Razorpay subscription explicitly cancelled.`,
            });
          } catch (lifeErr) {
            logReconciliation('warn', 'Lifecycle transition notice:', { error: lifeErr.message });
          }
        }
        result = { success: true, subscription: sub };
      }
      break;
    }

    case 'refund.processed': {
      const incomingRefundPaise = Math.round(Number(refundEntity.amount || 0));
      const targetPayId = refundEntity.payment_id;

      if (targetPayId) {
        const existingTxn = await Transaction.findOne({ razorpay_payment_id: targetPayId });
        const existingAttempt = await PaymentAttempt.findOne({ razorpayPaymentId: targetPayId });

        const capturedPaise = existingTxn?.amountInPaise || (existingTxn ? Math.round(existingTxn.amount * 100) : (existingAttempt?.amountInPaise || 0));
        const prevRefundPaise = existingTxn?.refundAmountInPaise || existingAttempt?.refundAmountInPaise || 0;
        const totalRefundPaise = prevRefundPaise + incomingRefundPaise;

        // Overflow check: Reject impossible refund state
        if (capturedPaise > 0 && totalRefundPaise > capturedPaise) {
          logReconciliation('error', 'Refund overflow detected: total refunds exceed captured amount', {
            targetPayId,
            capturedPaise,
            totalRefundPaise,
          });

          await AuditLog.create({
            actorRole: 'system',
            actorName: 'Reconciliation Engine',
            action: 'RECONCILIATION_MISMATCH',
            resourceType: 'Payment',
            resourceId: targetPayId,
            resourceName: 'Refund Overflow Flagged',
            metadata: {
              targetPayId,
              capturedPaise,
              totalRefundPaise,
              reason: 'Refund amount exceeds original captured payment amount',
            },
            timestamp: new Date(),
          });

          return {
            success: false,
            status: 'MANUAL_REVIEW',
            message: 'Refund amount exceeds captured payment amount.',
          };
        }

        const isFullRefund = capturedPaise > 0 && totalRefundPaise >= capturedPaise;
        const finalStatus = isFullRefund ? 'refunded' : 'captured';

        if (existingTxn) {
          existingTxn.refundAmountInPaise = totalRefundPaise;
          existingTxn.netAmountInPaise = Math.max(0, capturedPaise - totalRefundPaise);
          existingTxn.status = finalStatus;
          existingTxn.refundId = refundEntity.id;
          existingTxn.refundedAt = new Date();
          await existingTxn.save();
        }

        if (existingAttempt) {
          existingAttempt.refundAmountInPaise = totalRefundPaise;
          existingAttempt.netAmountInPaise = Math.max(0, capturedPaise - totalRefundPaise);
          existingAttempt.status = finalStatus;
          existingAttempt.refundId = refundEntity.id;
          existingAttempt.refundedAt = new Date();
          existingAttempt.refundReason = refundEntity.notes?.reason || 'Customer refund processed';
          await existingAttempt.save();
        }

        await AuditLog.create({
          actorRole: 'system',
          actorName: 'Reconciliation Engine',
          action: isFullRefund ? 'PAYMENT_REFUNDED' : 'PAYMENT_PARTIALLY_REFUNDED',
          resourceType: 'Payment',
          resourceId: targetPayId,
          resourceName: `Refund ₹${incomingRefundPaise / 100}`,
          metadata: {
            refundId: refundEntity.id,
            paymentId: targetPayId,
            refundAmountInPaise: incomingRefundPaise,
            totalRefundedPaise: totalRefundPaise,
            remainingNetAmountPaise: Math.max(0, capturedPaise - totalRefundPaise),
            isFullRefund,
          },
          timestamp: new Date(),
        });
      }
      result = { success: true, status: 'REFUND_RECORDED', refundId: refundEntity.id };
      break;
    }

    default:
      result = { success: true, status: 'UNHANDLED_ACKNOWLEDGED', event };
  }

  return result || { success: true, event };
}

/**
 * Periodic Batch Reconciliation Worker Function (v2 Hardened)
 * Queries open or inconsistent subscriptions and synchronizes their state.
 * @param {object} options - { batchSize = 50 }
 * @returns {Promise<object>} - Reconciliation summary
 */
async function runPeriodicReconciliation(options = {}) {
  const batchSize = options.batchSize || 50;
  const runId = `rec_run_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const startedAt = new Date();

  logReconciliation('info', `Starting periodic reconciliation worker (runId: ${runId})`, { batchSize });

  const activeAndPastDueSubs = await Subscription.find({
    status: { $in: ['ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'PLAN_LOCKED'] },
    razorpaySubscriptionId: { $exists: true, $ne: null },
  })
    .limit(batchSize)
    .populate('planId');

  let processedCount = 0;
  let matchedCount = 0;
  let repairedCount = 0;
  let manualReviewCount = 0;
  let mismatchCount = 0;
  let errorCount = 0;

  for (const sub of activeAndPastDueSubs) {
    try {
      processedCount += 1;
      const recResult = await reconcileSubscription(sub._id);
      if (recResult.isRecoverable && recResult.healAction) {
        repairedCount += 1;
      } else if (recResult.reconciliationStatus === 'MANUAL_REVIEW') {
        manualReviewCount += 1;
      } else if (recResult.reconciliationStatus === 'MISMATCHED') {
        mismatchCount += 1;
      } else {
        matchedCount += 1;
      }
    } catch (err) {
      errorCount += 1;
      logReconciliation('error', `Error reconciling subscription ${sub._id}:`, { error: err.message, runId });
    }
  }

  const completedAt = new Date();
  const summary = {
    runId,
    startedAt,
    completedAt,
    durationMs: completedAt.getTime() - startedAt.getTime(),
    processedCount,
    matchedCount,
    repairedCount,
    manualReviewCount,
    mismatchCount,
    errorCount,
    batchSize: activeAndPastDueSubs.length,
  };

  logReconciliation('info', `Periodic reconciliation run completed (runId: ${runId})`, summary);
  return summary;
}

/**
 * SuperAdmin Manual Review Queue Lookup
 * @param {object} filterOptions
 * @returns {Promise<Array>}
 */
async function getManualReviewQueue(filterOptions = {}) {
  const [mismatchedAttempts, mismatchedSubs] = await Promise.all([
    PaymentAttempt.find({ reconciliationStatus: { $in: ['MISMATCHED', 'MANUAL_REVIEW'] } })
      .populate('userId', 'name email companyInfo')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    Subscription.find({ reconciliationStatus: { $in: ['MISMATCHED', 'MANUAL_REVIEW'] } })
      .populate('userId', 'name email companyInfo')
      .populate('planId')
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean(),
  ]);

  return {
    paymentIssues: mismatchedAttempts,
    subscriptionIssues: mismatchedSubs,
    totalOpenIssues: mismatchedAttempts.length + mismatchedSubs.length,
  };
}

module.exports = {
  verifyWebhookSignature,
  verifyPaymentSignature,
  reconcilePayment,
  reconcileSubscription,
  reconcileWebhookEvent,
  runPeriodicReconciliation,
  getManualReviewQueue,
  logReconciliation,
};
