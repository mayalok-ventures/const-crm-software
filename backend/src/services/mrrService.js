const mongoose = require('mongoose');
const Subscription = require('../models/Subscription');
const Plan = require('../models/Plan');
const PaymentAttempt = require('../models/PaymentAttempt');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

/**
 * Deterministic MRR & Revenue Analytics Engine
 * Calculates normalized Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR),
 * cohort churn, and granular financial metrics from canonical active subscriptions.
 */

/**
 * Calculates normalized MRR for a single subscription object
 * @param {object} sub - Subscription document (or populated object with planId)
 * @returns {number} - Normalized monthly revenue in INR
 */
function calculateSubscriptionMRR(sub) {
  if (!sub) return 0;

  // Verify status is an active recurring state
  const activeStatuses = ['ACTIVE', 'GRACE_PERIOD', 'AUTHENTICATED'];
  const isStatusActive = activeStatuses.includes(sub.status);

  // If scheduled for cancellation at period end, it remains valid MRR until currentPeriodEnd
  const isPeriodValid = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) >= new Date() : false;
  const isCancelledAtPeriodEnd = sub.status === 'ACTIVE' && sub.cancelAtPeriodEnd && isPeriodValid;

  if (!isStatusActive && !isCancelledAtPeriodEnd) {
    return 0;
  }

  // Determine pricing from attached plan or subscription fields
  const plan = sub.planId || {};
  const quantity = Math.max(1, Number(sub.quantity) || 1);

  // Interval check
  const interval = (sub.billingCycle || plan.interval || 'monthly').toLowerCase();

  let basePrice = 0;
  if (typeof sub.amount === 'number' && sub.amount > 0) {
    basePrice = sub.amount;
  } else if (typeof sub.amountInPaise === 'number' && sub.amountInPaise > 0) {
    basePrice = sub.amountInPaise / 100;
  } else if (interval === 'yearly') {
    basePrice = Number(plan.yearlyPrice || plan.price) || 0;
  } else {
    basePrice = Number(plan.monthlyPrice || plan.price) || 0;
  }

  // Exclude free plans
  if (basePrice <= 0 || plan.code === 'FREE' || plan.tier === 0) {
    return 0;
  }

  // Monthly normalization: yearly price divided by 12, monthly price direct
  if (interval === 'yearly') {
    return Math.round((basePrice / 12) * quantity * 100) / 100;
  }

  return Math.round(basePrice * quantity * 100) / 100;
}

/**
 * Calculate comprehensive platform-wide MRR, ARR, and Revenue telemetry
 * @param {object} options - Query / Time window options
 * @returns {Promise<object>} - Granular revenue metrics
 */
async function calculatePlatformRevenueMetrics(options = {}) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 1. Fetch all subscriptions with populated plans
  const [subscriptions, plans, totalTransactions, paymentAttempts, users] = await Promise.all([
    Subscription.find({})
      .populate('planId')
      .lean(),
    Plan.find({}).lean(),
    Transaction.find({ status: { $in: ['captured', 'authorized', 'success', 'completed'] } }).lean(),
    PaymentAttempt.find({}).lean(),
    User.find({ role: { $ne: 'superadmin' } }).select('lifecycleStatus userStatus isActive plan billing planStartDate planEndDate createdAt').lean(),
  ]);

  let totalMRR = 0;
  let activeSubscriptionsCount = 0;
  let pastDueCount = 0;
  let gracePeriodCount = 0;
  let cancelledSubscriptionsCount = 0;

  // Plan-by-plan MRR breakdown
  const planMRRMap = {};
  plans.forEach((p) => {
    planMRRMap[p.code || p.name] = {
      name: p.name,
      code: p.code,
      tier: p.tier,
      accountType: p.accountType,
      activeCount: 0,
      mrr: 0,
    };
  });

  subscriptions.forEach((sub) => {
    const subMRR = calculateSubscriptionMRR(sub);
    const planKey = sub.planId?.code || sub.planId?.name;

    if (sub.status === 'ACTIVE') {
      activeSubscriptionsCount += 1;
      totalMRR += subMRR;
      if (planKey && planMRRMap[planKey]) {
        planMRRMap[planKey].activeCount += 1;
        planMRRMap[planKey].mrr += subMRR;
      }
    } else if (sub.status === 'GRACE_PERIOD') {
      gracePeriodCount += 1;
      // Include grace period MRR if within period end
      if (sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) >= now) {
        totalMRR += subMRR;
      }
    } else if (sub.status === 'PAST_DUE' || sub.status === 'PLAN_LOCKED') {
      pastDueCount += 1;
    } else if (sub.status === 'CANCELLED') {
      cancelledSubscriptionsCount += 1;
      // If cancelled at period end and still before end date, count towards MRR
      if (sub.cancelAtPeriodEnd && sub.currentPeriodEnd && new Date(sub.currentPeriodEnd) >= now) {
        totalMRR += subMRR;
      }
    }
  });

  // Fallback for standalone tenants without Subscription document
  if (totalMRR === 0 && subscriptions.length === 0) {
    users.forEach((u) => {
      if (u.lifecycleStatus === 'ACTIVE' || (!u.lifecycleStatus && u.isActive)) {
        if (u.plan === 'enterprise') totalMRR += 9999;
        else if (u.plan === 'business') totalMRR += 4999;
        else if (u.plan === 'pro') totalMRR += 1999;
        else if (u.plan === 'starter' || u.plan === 'basic_solo') totalMRR += 999;
      }
    });
  }

  totalMRR = Math.round(totalMRR * 100) / 100;
  const totalARR = Math.round(totalMRR * 12 * 100) / 100;

  // 2. Lifetime Revenue & Cash Flow Calculation from Transaction Ledger
  let lifetimeGrossRevenue = 0;
  let totalRefundsVolume = 0;

  totalTransactions.forEach((txn) => {
    const amt = Number(txn.amount) || 0;
    if (txn.status === 'refunded') {
      totalRefundsVolume += amt;
    } else {
      lifetimeGrossRevenue += amt;
    }
  });

  // Check PaymentAttempt refunds
  paymentAttempts.forEach((attempt) => {
    if (attempt.status === 'refunded' && attempt.refundAmountInPaise) {
      totalRefundsVolume += attempt.refundAmountInPaise / 100;
    }
  });

  const lifetimeNetRevenue = Math.max(0, lifetimeGrossRevenue - totalRefundsVolume);

  // 3. Lifecycle Counts from Tenants
  let trialTenantsCount = 0;
  let activeTenantsCount = 0;
  let pastDueTenantsCount = 0;
  let suspendedTenantsCount = 0;
  let cancelledTenantsCount = 0;

  users.forEach((u) => {
    const status = u.lifecycleStatus || (
      (!u.isActive || u.userStatus === 'disabled') ? 'CANCELLED' :
      (u.userStatus === 'inactive' ? 'SUSPENDED' : (u.plan === 'free' || !u.plan ? 'TRIAL' : 'ACTIVE'))
    );
    if (status === 'TRIAL') trialTenantsCount += 1;
    else if (status === 'ACTIVE') activeTenantsCount += 1;
    else if (status === 'PAST_DUE') pastDueTenantsCount += 1;
    else if (status === 'SUSPENDED') suspendedTenantsCount += 1;
    else if (status === 'CANCELLED' || status === 'ARCHIVED') cancelledTenantsCount += 1;
  });

  // 4. Churn Calculation (Last 30 Days)
  const churnedLast30Days = subscriptions.filter(
    (s) => s.status === 'CANCELLED' && s.cancelledAt && new Date(s.cancelledAt) >= thirtyDaysAgo
  ).length;

  const totalBase = Math.max(1, activeSubscriptionsCount + churnedLast30Days);
  const churnRatePercent = Math.round((churnedLast30Days / totalBase) * 100 * 10) / 10;

  // 5. Payment Gateways Performance
  const successfulPaymentsCount = totalTransactions.filter((t) => t.status !== 'failed').length;
  const failedPaymentsCount = paymentAttempts.filter((p) => p.status === 'failed').length;

  return {
    mrr: totalMRR,
    arr: totalARR,
    lifetimeRevenue: lifetimeGrossRevenue,
    grossRevenue: lifetimeGrossRevenue,
    netRevenue: lifetimeNetRevenue,
    refundsVolume: totalRefundsVolume,
    activeSubscriptionsCount: activeSubscriptionsCount || activeTenantsCount,
    totalTransactionsCount: totalTransactions.length,
    successfulPaymentsCount,
    failedPaymentsCount,
    churnRatePercent,
    churnedLast30Days,
    tenantCounts: {
      trial: trialTenantsCount,
      active: activeTenantsCount,
      pastDue: pastDueTenantsCount,
      suspended: suspendedTenantsCount,
      cancelled: cancelledTenantsCount,
    },
    planBreakdown: Object.values(planMRRMap),
  };
}

module.exports = {
  calculateSubscriptionMRR,
  calculatePlatformRevenueMetrics,
};
