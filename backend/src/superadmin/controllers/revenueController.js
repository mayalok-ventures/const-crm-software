const Subscription = require('../../models/Subscription');
const Payment = require('../../models/Payment');
const Plan = require('../../models/Plan');
const Coupon = require('../../models/Coupon');
const { getRevenueMetrics } = require('../queries/revenueQueries');

exports.getRevenueDashboard = async (req, res) => {
  try {
    const [metrics, subscriptions, payments, plans, coupons] = await Promise.all([
      getRevenueMetrics(),
      Subscription.find({})
        .populate('userId', 'name email companyInfo')
        .populate('planId')
        .sort({ createdAt: -1 })
        .limit(20)
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

    res.json({
      success: true,
      metrics,
      subscriptions,
      payments,
      plans,
      coupons,
    });
  } catch (error) {
    console.error('SuperAdmin Get Revenue Error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch revenue metrics' });
  }
};
