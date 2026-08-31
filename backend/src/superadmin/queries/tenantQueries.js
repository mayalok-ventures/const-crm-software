const mongoose = require('mongoose');
const User = require('../../models/User');
const Lead = require('../../models/Lead');
const Subscription = require('../../models/Subscription');
const Plan = require('../../models/Plan');

/**
 * High-performance aggregation query to list all multi-tenant organizations
 */
async function getOrganisationsAggregation({ search = '', status = 'all', page = 1, limit = 20 } = {}) {
  const matchOrg = {
    $or: [
      { workStatus: 'company_owner' },
      { companyRole: 'owner' },
      { role: 'admin', companyId: null },
      { 'companyInfo.companyName': { $exists: true, $ne: '' } },
    ],
    role: { $ne: 'superadmin' },
  };

  if (search) {
    const regex = new RegExp(search.trim(), 'i');
    matchOrg.$or = [
      { 'companyInfo.companyName': regex },
      { name: regex },
      { email: regex },
      { phone: regex },
    ];
  }

  if (status && status !== 'all') {
    if (status === 'ACTIVE') {
      matchOrg.isActive = true;
      matchOrg.userStatus = 'active';
    } else if (status === 'BLOCKED' || status === 'SUSPENDED') {
      matchOrg.$or = [{ isActive: false }, { userStatus: { $in: ['disabled', 'inactive'] } }];
    }
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [totalCount, rawOrgs] = await Promise.all([
    User.countDocuments(matchOrg),
    User.find(matchOrg)
      .select('name email phone companyInfo role workStatus companyRole userStatus isActive createdAt plan planEndDate billingCycle lifecycleStatus lifecycleTimestamps cancellationReason suspensionReason archivedReason')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
  ]);

  // Aggregate user counts & lead counts per organisation in batch
  const orgIds = rawOrgs.map((o) => o._id);

  const [memberCounts, leadCounts, activeSubs] = await Promise.all([
    User.aggregate([
      { $match: { companyId: { $in: orgIds } } },
      {
        $group: {
          _id: '$companyId',
          totalUsers: { $sum: 1 },
          agentsCount: {
            $sum: { $cond: [{ $eq: ['$role', 'agent'] }, 1, 0] },
          },
          managersCount: {
            $sum: { $cond: [{ $eq: ['$role', 'manager'] }, 1, 0] },
          },
        },
      },
    ]),
    Lead.aggregate([
      { $match: { companyId: { $in: orgIds } } },
      {
        $group: {
          _id: '$companyId',
          totalLeads: { $sum: 1 },
          convertedLeads: {
            $sum: { $cond: [{ $in: ['$status', ['converted', 'payment_done', 'won']] }, 1, 0] },
          },
        },
      },
    ]),
    Subscription.find({ companyId: { $in: orgIds } })
      .populate('planId', 'name code price monthlyPrice')
      .lean(),
  ]);

  const memberMap = new Map(memberCounts.map((m) => [String(m._id), m]));
  const leadMap = new Map(leadCounts.map((l) => [String(l._id), l]));
  const subMap = new Map(activeSubs.map((s) => [String(s.companyId), s]));

  const organisations = rawOrgs.map((org) => {
    const orgIdStr = String(org._id);
    const members = memberMap.get(orgIdStr) || { totalUsers: 0, agentsCount: 0, managersCount: 0 };
    const leads = leadMap.get(orgIdStr) || { totalLeads: 0, convertedLeads: 0 };
    const sub = subMap.get(orgIdStr);

    let calculatedStatus = org.lifecycleStatus;
    if (!calculatedStatus) {
      if (!org.isActive || org.userStatus === 'disabled') {
        calculatedStatus = 'BLOCKED';
      } else if (org.userStatus === 'inactive') {
        calculatedStatus = 'SUSPENDED';
      } else if (sub?.status) {
        calculatedStatus = sub.status;
      } else if (org.plan === 'free' || !org.plan) {
        calculatedStatus = 'TRIAL';
      } else {
        calculatedStatus = 'ACTIVE';
      }
    }

    const estimatedMRR = sub?.planId?.price || sub?.planId?.monthlyPrice || (org.plan === 'enterprise' ? 9999 : org.plan === 'business' ? 4999 : org.plan === 'pro' ? 1999 : 0);

    return {
      _id: org._id,
      organisationName: org.companyInfo?.companyName || `${org.name}'s Organization`,
      ownerName: org.name,
      ownerEmail: org.email,
      ownerPhone: org.phone,
      plan: sub?.planId?.name || org.plan || 'Free Trial',
      planCode: sub?.planId?.code || org.plan || 'free',
      usersCount: members.totalUsers + 1, // Include owner
      agentsCount: members.agentsCount,
      managersCount: members.managersCount,
      leadsCount: leads.totalLeads,
      convertedLeads: leads.convertedLeads,
      mrr: estimatedMRR,
      status: calculatedStatus,
      lifecycleStatus: calculatedStatus,
      lifecycleTimestamps: org.lifecycleTimestamps || {},
      createdAt: org.createdAt,
      lastActivity: org.updatedAt || org.createdAt,
      companyInfo: org.companyInfo,
    };
  });

  return {
    organisations,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: totalCount,
      pages: Math.ceil(totalCount / Number(limit)) || 1,
    },
  };
}

module.exports = {
  getOrganisationsAggregation,
};
