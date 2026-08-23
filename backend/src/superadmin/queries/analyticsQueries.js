const mongoose = require('mongoose');
const User = require('../../models/User');
const Lead = require('../../models/Lead');
const Subscription = require('../../models/Subscription');

/**
 * Aggregates 7-day, 30-day, and 90-day growth trajectories for Organisations, Users, and Leads
 */
async function getGrowthAnalytics({ days = 30 } = {}) {
  const daysNum = Math.min(Number(days) || 30, 365);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysNum);

  const [orgGrowth, userGrowth, leadGrowth] = await Promise.all([
    User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          role: { $ne: 'superadmin' },
          $or: [
            { workStatus: 'company_owner' },
            { companyRole: 'owner' },
            { role: 'admin' },
          ],
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          role: { $ne: 'superadmin' },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Lead.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          converted: {
            $sum: {
              $cond: [{ $in: ['$status', ['converted', 'payment_done', 'won']] }, 1, 0],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return {
    timeframeDays: daysNum,
    orgGrowth,
    userGrowth,
    leadGrowth,
  };
}

module.exports = {
  getGrowthAnalytics,
};
