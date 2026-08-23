const mongoose = require('mongoose');
const User = require('../../models/User');
const Lead = require('../../models/Lead');
const Pipeline = require('../../models/Pipeline');
const FormSchema = require('../../models/FormSchema');
const Campaign = require('../../models/Campaign');
const Subscription = require('../../models/Subscription');
const Integration = require('../../models/Integration');
const AuditLog = require('../../models/AuditLog');
const { getOrganisationsAggregation } = require('../queries/tenantQueries');

/**
 * List all organisations with pagination and search
 */
async function listOrganisations(params) {
  return await getOrganisationsAggregation(params);
}

/**
 * Deep inspection of a single tenant
 */
async function getTenantDetails(tenantId) {
  if (!mongoose.Types.ObjectId.isValid(tenantId)) {
    throw new Error('Invalid Organisation ID');
  }

  const orgId = new mongoose.Types.ObjectId(tenantId);

  const orgOwner = await User.findById(orgId)
    .select('-password')
    .lean();

  if (!orgOwner) {
    throw new Error('Organisation not found');
  }

  // Fetch all related entities in parallel
  const [
    users,
    leads,
    pipelines,
    forms,
    campaigns,
    subscription,
    integrations,
    auditTrail,
  ] = await Promise.all([
    User.find({ companyId: orgId }).select('-password').sort({ createdAt: -1 }).lean(),
    Lead.find({ companyId: orgId }).sort({ createdAt: -1 }).limit(50).lean(),
    Pipeline.find({ companyId: orgId }).lean(),
    FormSchema.find({ companyId: orgId }).lean(),
    Campaign.find({ companyId: orgId }).lean(),
    Subscription.findOne({ companyId: orgId }).populate('planId').lean(),
    Integration.find({ companyId: orgId }).select('-accessToken -appSecret').lean(),
    AuditLog.find({ organizationId: orgId }).sort({ timestamp: -1 }).limit(50).lean(),
  ]);

  const agents = users.filter((u) => u.role === 'agent');
  const managers = users.filter((u) => u.role === 'manager');

  // Group leads by canonical stages
  const stageCounts = {
    new_lead: 0,
    contacted: 0,
    not_interested: 0,
    converted: 0,
    payment_done: 0,
  };

  leads.forEach((l) => {
    const s = String(l.status || '').toLowerCase();
    if (['payment_done', 'won', 'advance paid', 'closed won', 'closed / won', 'closed'].includes(s)) stageCounts.payment_done++;
    else if (['converted', 'qualified', 'documents uploaded'].includes(s)) stageCounts.converted++;
    else if (['not_interested', 'not interested', 'lost', 'rejected', 'dropped'].includes(s)) stageCounts.not_interested++;
    else if (['contacted', 'inquiry', 'demo class', 'floor plan shared'].includes(s)) stageCounts.contacted++;
    else stageCounts.new_lead++;
  });

  return {
    organisation: {
      _id: orgOwner._id,
      name: orgOwner.companyInfo?.companyName || orgOwner.name,
      owner: orgOwner,
      companyInfo: orgOwner.companyInfo,
      status: orgOwner.isActive ? (orgOwner.userStatus === 'active' ? 'ACTIVE' : 'SUSPENDED') : 'BLOCKED',
      createdAt: orgOwner.createdAt,
    },
    users: {
      total: users.length + 1,
      agents,
      managers,
      all: [orgOwner, ...users],
    },
    leads: {
      total: leads.length,
      stageCounts,
      recent: leads,
    },
    pipelines,
    forms,
    campaigns,
    subscription,
    integrations,
    auditTrail,
  };
}

/**
 * Update tenant account status (BLOCK, UNBLOCK, SUSPEND, ACTIVATE)
 */
async function updateTenantStatus(tenantId, { status, reason = '' }, adminUser) {
  const user = await User.findById(tenantId);
  if (!user) throw new Error('Tenant not found');

  const prevStatus = user.userStatus;
  const prevActive = user.isActive;

  if (status === 'BLOCKED') {
    user.isActive = false;
    user.userStatus = 'disabled';
  } else if (status === 'SUSPENDED') {
    user.isActive = true;
    user.userStatus = 'inactive';
  } else if (status === 'ACTIVE') {
    user.isActive = true;
    user.userStatus = 'active';
  }

  await user.save();

  // Record Immutable Audit Log
  await AuditLog.create({
    actorId: adminUser._id,
    actorName: adminUser.name,
    actorEmail: adminUser.email,
    actorRole: 'superadmin',
    organizationId: user._id,
    action: status === 'BLOCKED' ? 'TENANT_BLOCK' : 'TENANT_UNBLOCK',
    resourceType: 'User',
    resourceId: user._id.toString(),
    resourceName: user.companyInfo?.companyName || user.name,
    before: { status: prevStatus, isActive: prevActive },
    after: { status: user.userStatus, isActive: user.isActive },
    metadata: { reason, updatedBy: 'superadmin' },
    timestamp: new Date(),
  });

  return user;
}

/**
 * Update tenant subscription plan
 */
async function updateTenantPlan(tenantId, { planCode, reason = '' }, adminUser) {
  const user = await User.findById(tenantId);
  if (!user) throw new Error('Tenant not found');

  const prevPlan = user.plan;
  user.plan = planCode;
  await user.save();

  await AuditLog.create({
    actorId: adminUser._id,
    actorName: adminUser.name,
    actorEmail: adminUser.email,
    actorRole: 'superadmin',
    organizationId: user._id,
    action: 'PLAN_CHANGE',
    resourceType: 'User',
    resourceId: user._id.toString(),
    resourceName: user.companyInfo?.companyName || user.name,
    before: { plan: prevPlan },
    after: { plan: planCode },
    metadata: { reason, updatedBy: 'superadmin' },
    timestamp: new Date(),
  });

  return user;
}

module.exports = {
  listOrganisations,
  getTenantDetails,
  updateTenantStatus,
  updateTenantPlan,
};
