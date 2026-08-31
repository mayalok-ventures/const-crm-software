const Subscription = require('../../models/Subscription');
const Payment = require('../../models/Payment');
const Transaction = require('../../models/Transaction');
const PaymentAttempt = require('../../models/PaymentAttempt');
const Plan = require('../../models/Plan');
const Coupon = require('../../models/Coupon');
const { getRevenueMetrics } = require('../queries/revenueQueries');
const { reconcileSubscription, runPeriodicReconciliation } = require('../../services/reconciliationService');

/**
 * SuperAdmin Revenue Dashboard Endpoint
 * Aggregates deterministic MRR, ARR, active subscriptions, and real payment transactions.
 */
exports.getRevenueDashboard = async (req, res) => {
  try {
    const [metrics, subscriptions, transactions, leadPayments, plans, coupons] = await Promise.all([
      getRevenueMetrics(),
      Subscription.find({})
        .populate('userId', 'name email phone companyInfo')
        .populate('planId')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Transaction.find({})
        .populate('userId', 'name email companyInfo')
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Payment.find({})
        .populate('lead_id', 'name phone email')
        .populate('agent_id', 'name email companyInfo')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Plan.find({}).sort({ tier: 1 }).lean(),
      Coupon.find({}).sort({ createdAt: -1 }).lean(),
    ]);

    // Format transaction ledger with fallback for UI
    const formattedPayments = transactions.length > 0 ? transactions.map((t) => ({
      _id: t._id,
      transaction_id: t.razorpay_payment_id || t.razorpay_order_id || String(t._id).slice(-8),
      transactionId: t.razorpay_payment_id || t.razorpay_order_id,
      amount: t.amount,
      method: t.paymentMethod || 'Razorpay',
      status: t.status === 'captured' ? 'SUCCESS' : t.status.toUpperCase(),
      createdAt: t.createdAt,
      agent_id: t.userId,
    })) : leadPayments;

    res.json({
      success: true,
      metrics,
      subscriptions,
      payments: formattedPayments,
      transactions,
      plans,
      coupons,
    });
  } catch (error) {
    console.error('SuperAdmin Get Revenue Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch revenue metrics' });
  }
};

/**
 * SuperAdmin Run Subscription / Payment Reconciliation Trigger
 */
exports.triggerReconciliation = async (req, res) => {
  try {
    const { subscriptionId, batchSize = 50 } = req.body;

    if (subscriptionId) {
      const result = await reconcileSubscription(subscriptionId);
      return res.json({ success: true, result });
    }

    const batchSummary = await runPeriodicReconciliation({ batchSize });
    res.json({
      success: true,
      message: `Reconciliation executed across ${batchSummary.processedCount || batchSummary.reconciledCount} subscriptions.`,
      batchSummary,
    });
  } catch (error) {
    console.error('SuperAdmin Reconciliation Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Reconciliation execution failed' });
  }
};

/**
 * SuperAdmin Get Manual Review Queue
 */
exports.getManualReviewIssues = async (req, res) => {
  try {
    const { getManualReviewQueue } = require('../../services/reconciliationService');
    const queue = await getManualReviewQueue();
    res.json({
      success: true,
      ...queue,
    });
  } catch (error) {
    console.error('SuperAdmin Get Review Queue Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch manual review queue' });
  }
};

/**
 * SuperAdmin Resolve Manual Review Discrepancy
 */
exports.resolveManualReview = async (req, res) => {
  try {
    const { paymentAttemptId, subscriptionId, action, notes } = req.body;
    const AuditLog = require('../../models/AuditLog');

    if (paymentAttemptId) {
      const attempt = await PaymentAttempt.findById(paymentAttemptId);
      if (attempt) {
        attempt.reconciliationStatus = action === 'ACCEPT' ? 'MATCHED' : 'MANUAL_REVIEW';
        await attempt.save();

        await AuditLog.create({
          actorId: req.user?._id,
          actorName: req.user?.name || 'SuperAdmin',
          actorRole: req.user?.role || 'superadmin',
          action: 'MANUAL_RECONCILIATION_ACTION',
          resourceType: 'PaymentAttempt',
          resourceId: attempt._id.toString(),
          resourceName: 'Manual Reconciliation Decision',
          metadata: { action, notes },
          timestamp: new Date(),
        });
      }
    }

    if (subscriptionId) {
      const sub = await Subscription.findById(subscriptionId);
      if (sub) {
        sub.reconciliationStatus = action === 'ACCEPT' ? 'MATCHED' : 'MANUAL_REVIEW';
        if (notes) sub.reconciliationNotes = notes;
        await sub.save();

        await AuditLog.create({
          actorId: req.user?._id,
          actorName: req.user?.name || 'SuperAdmin',
          actorRole: req.user?.role || 'superadmin',
          action: 'MANUAL_RECONCILIATION_ACTION',
          resourceType: 'Subscription',
          resourceId: sub._id.toString(),
          resourceName: 'Manual Subscription Reconciliation Decision',
          metadata: { action, notes },
          timestamp: new Date(),
        });
      }
    }

    res.json({ success: true, message: 'Discrepancy resolved and audited.' });
  } catch (error) {
    console.error('SuperAdmin Resolve Review Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to resolve review item' });
  }
};
