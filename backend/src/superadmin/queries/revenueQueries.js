const mongoose = require('mongoose');
const Subscription = require('../../models/Subscription');
const Payment = require('../../models/Payment');
const Plan = require('../../models/Plan');
const User = require('../../models/User');

/**
 * Aggregates real revenue, MRR, ARR, and subscription distribution metrics from MongoDB
 */
async function getRevenueMetrics() {
  const [activeSubs, totalPayments, plans, orgUsers] = await Promise.all([
    Subscription.find({ status: 'ACTIVE' }).populate('planId', 'name code price monthlyPrice yearlyPrice tier').lean(),
    Payment.find({ status: { $in: ['SUCCESS', 'PAID', 'COMPLETED', 'captured'] } }).lean(),
    Plan.find({}).lean(),
    User.find({ role: { $ne: 'superadmin' } }).select('plan planEndDate billingCycle').lean(),
  ]);

  let calculatedMRR = 0;

  // Calculate MRR from active subscriptions
  activeSubs.forEach((sub) => {
    const monthlyAmt = sub.planId?.monthlyPrice || sub.planId?.price || 0;
    const quantity = sub.quantity || 1;
    calculatedMRR += monthlyAmt * quantity;
  });

  // If subscriptions collection is fresh, incorporate legacy user plan tiers
  if (calculatedMRR === 0) {
    orgUsers.forEach((u) => {
      if (u.plan === 'enterprise') calculatedMRR += 9999;
      else if (u.plan === 'business') calculatedMRR += 4999;
      else if (u.plan === 'pro') calculatedMRR += 1999;
      else if (u.plan === 'starter') calculatedMRR += 999;
    });
  }

  const calculatedARR = calculatedMRR * 12;

  // Total Lifetime Collected Revenue from Payment ledger
  const lifetimeRevenue = totalPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  // Plan Distribution Count
  const planDistribution = {};
  plans.forEach((p) => {
    planDistribution[p.name] = 0;
  });

  orgUsers.forEach((u) => {
    const pName = u.plan || 'Free Trial';
    planDistribution[pName] = (planDistribution[pName] || 0) + 1;
  });

  return {
    mrr: calculatedMRR,
    arr: calculatedARR,
    lifetimeRevenue,
    activeSubscriptionsCount: activeSubs.length || orgUsers.filter((u) => u.plan && u.plan !== 'free').length,
    totalTransactionsCount: totalPayments.length,
    planDistribution,
  };
}

module.exports = {
  getRevenueMetrics,
};
