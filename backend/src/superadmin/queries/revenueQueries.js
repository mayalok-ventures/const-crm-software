const { calculatePlatformRevenueMetrics } = require('../../services/mrrService');
const Plan = require('../../models/Plan');
const User = require('../../models/User');

/**
 * Aggregates real revenue, MRR, ARR, and subscription distribution metrics from MongoDB
 */
async function getRevenueMetrics() {
  const [metrics, plans, orgUsers] = await Promise.all([
    calculatePlatformRevenueMetrics(),
    Plan.find({}).lean(),
    User.find({ role: { $ne: 'superadmin' } }).select('plan planEndDate billingCycle').lean(),
  ]);

  // Plan Distribution Count for legacy chart compatibility
  const planDistribution = {};
  plans.forEach((p) => {
    planDistribution[p.name] = 0;
  });

  orgUsers.forEach((u) => {
    const pName = u.plan || 'Free Trial';
    planDistribution[pName] = (planDistribution[pName] || 0) + 1;
  });

  return {
    ...metrics,
    planDistribution,
  };
}

module.exports = {
  getRevenueMetrics,
};
