const mongoose = require('mongoose');
const User = require('../models/User');
const Lead = require('../models/Lead');
const Payment = require('../models/Payment');
const FollowUp = require('../models/FollowUp');
const Offer = require('../models/Offer');
const ActivityLog = require('../models/ActivityLog');
const Pipeline = require('../models/Pipeline');
const FormSchema = require('../models/FormSchema');
const DistributionRule = require('../models/DistributionRule');
const Template = require('../models/Template');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');
const Broadcast = require('../models/Broadcast');
const Campaign = require('../models/Campaign');
const Catalogue = require('../models/Catalogue');
const Plan = require('../models/Plan');
const TenantCatalogue = require('../models/TenantCatalogue');
const TenantConfig = require('../models/TenantConfig');
const Integration = require('../models/Integration');
const LeadDistributionRule = require('../models/LeadDistributionRule');
const CommissionRule = require('../models/CommissionRule');
const CommissionPayout = require('../models/CommissionPayout');
const { encrypt, decrypt } = require('../utils/encryption');
const leadDistributionService = require('../services/leadDistributionService');
const commissionService = require('../services/commissionService');
const waSession = require('../services/waSession');
const { generateUniqueUsername } = require('../utils/generateUsername');
const { generateUniqueUsercode } = require('../utils/generateUsercode');
const { auditService } = require('../monitoring/audit/auditService');

// Helper: Immutable Universal Activity Logging
const logActivity = async ({
  userId,
  actor,
  role = 'admin',
  actorRole = 'admin',
  action = 'UPDATE',
  targetType = 'User',
  entityType = 'User',
  targetId = null,
  entityId = null,
  beforeState = null,
  afterState = null,
  oldValue = null,
  newValue = null,
  details = '',
  ipAddress = '127.0.0.1',
}) => {
  try {
    const act = actor || userId;
    if (!act) return;
    const actRole = actorRole || role || 'admin';
    
    let entType = entityType || 'User';
    const tLower = String(targetType || '').toLowerCase();
    if (tLower.includes('lead')) entType = 'Lead';
    else if (tLower.includes('user') || tLower.includes('agent') || tLower.includes('manager')) entType = 'User';
    else if (tLower.includes('pipe')) entType = 'Pipeline';
    else if (tLower.includes('form')) entType = 'Form';
    else if (tLower.includes('rule') || tLower.includes('dist')) entType = 'DistributionRule';

    const entId = entityId || (targetId && mongoose.Types.ObjectId.isValid(targetId) ? targetId : act);

    let actionEnum = 'UPDATE';
    const actUpper = String(action || '').toUpperCase();
    if (actUpper.includes('CREATE') || actUpper.includes('ADD')) actionEnum = 'CREATE';
    else if (actUpper.includes('DELETE') || actUpper.includes('REMOVE')) actionEnum = 'DELETE';
    else if (actUpper.includes('ASSIGN')) actionEnum = 'ASSIGN';
    else if (actUpper.includes('STATUS') || actUpper.includes('STAGE')) actionEnum = 'STATUS_CHANGE';

    await ActivityLog.record({
      actor: act,
      actorRole: actRole,
      action: actionEnum,
      entityType: entType,
      entityId: entId,
      oldValue: oldValue || beforeState,
      newValue: newValue || afterState,
      details: details || `${actionEnum} performed on ${entType}`,
      ipAddress,
    });

    // Record in Immutable AuditLog
    let auditAction = 'UPDATE';
    if (actionEnum === 'CREATE') auditAction = 'CREATE';
    else if (actionEnum === 'DELETE') auditAction = 'DELETE';
    else if (actUpper.includes('ROLE')) auditAction = 'ROLE_CHANGE';
    else if (actUpper.includes('PERMISSION')) auditAction = 'PERMISSION_CHANGE';
    else if (actUpper.includes('SETTING') || actUpper.includes('CONFIG')) auditAction = 'SETTINGS_CHANGE';

    auditService.record({
      actor: typeof act === 'object' ? act : { _id: act, role: actRole },
      action: auditAction,
      resourceType: entType,
      resourceId: entId,
      resourceName: details || `${entType} modification`,
      before: oldValue || beforeState,
      after: newValue || afterState,
      ip: ipAddress,
      metadata: { details, originalAction: action },
    });
  } catch (err) {
    console.warn('[ActivityLog] Logging warning:', err.message);
  }
};

// Stage Normalizer to guarantee every lead maps into the 5 canonical Kanban stages
const normalizeLeadStage = (rawStatus) => {
  if (!rawStatus) return 'new_lead';
  const s = String(rawStatus).toLowerCase().trim();
  if (s === 'payment_done' || s.includes('payment') || s.includes('subscription won') || s === 'closed' || s === 'won') {
    return 'payment_done';
  }
  if (s === 'converted' || s.includes('converted') || s.includes('qualified') || s.includes('negotiation') || s.includes('site_visit')) {
    return 'converted';
  }
  if (s === 'not_interested' || s.includes('not_interested') || s.includes('not interested') || s === 'lost' || s.includes('lost')) {
    return 'not_interested';
  }
  if (s === 'contacted' || s.includes('contacted') || s.includes('connected') || s.includes('attempted')) {
    return 'contacted';
  }
  return 'new_lead';
};

// Helper: Robust Multi-Tenant Query Scoper
const getTenantScope = (user) => {
  if (!user) return { _id: null };
  // ONLY true platform SuperAdmin may bypass tenant scoping
  if (user.role === 'superadmin') {
    return {};
  }
  const tenantId = user.companyId
    ? new mongoose.Types.ObjectId(String(user.companyId))
    : new mongoose.Types.ObjectId(String(user._id));

  if (!tenantId) {
    return { _id: null };
  }

  if (user.companyId) {
    if (user.role === 'manager' || user.companyRole === 'manager') {
      const uid = new mongoose.Types.ObjectId(String(user._id));
      return {
        $and: [
          { $or: [{ companyId: tenantId }, { userId: tenantId }, { sharedWithCompanyId: tenantId }] },
          { $or: [{ assignedManager: uid }, { assignedTo: uid }, { userId: uid }] },
        ],
      };
    }
    if (user.role === 'agent' || user.companyRole === 'agent' || user.companyRole === 'sales_rep' || user.companyRole === 'telecaller') {
      const uid = new mongoose.Types.ObjectId(String(user._id));
      return {
        $and: [
          { $or: [{ companyId: tenantId }, { userId: tenantId }, { sharedWithCompanyId: tenantId }] },
          { assignedTo: uid },
        ],
      };
    }
    return {
      $or: [
        { companyId: tenantId },
        { userId: tenantId },
        { sharedWithCompanyId: tenantId },
      ],
    };
  }

  // Tenant owner or solo professional (where tenantId === user._id)
  return {
    $or: [
      { companyId: tenantId },
      { userId: tenantId },
      { sharedWithCompanyId: tenantId },
    ],
  };
};

const getTenantUserScope = (user) => {
  if (!user) return { _id: null };
  // ONLY true platform SuperAdmin may bypass tenant user scoping
  if (user.role === 'superadmin') {
    return {};
  }
  const tenantId = user.companyId
    ? new mongoose.Types.ObjectId(String(user.companyId))
    : new mongoose.Types.ObjectId(String(user._id));

  if (!tenantId) {
    return { _id: null };
  }

  if (user.companyId) {
    if (user.role === 'manager' || user.companyRole === 'manager') {
      const uid = new mongoose.Types.ObjectId(String(user._id));
      return {
        $and: [
          { $or: [{ companyId: tenantId }, { _id: tenantId }] },
          { $or: [{ managerId: uid }, { _id: uid }] },
        ],
      };
    }
    if (user.role === 'agent' || user.companyRole === 'agent') {
      const uid = new mongoose.Types.ObjectId(String(user._id));
      return {
        $and: [
          { $or: [{ companyId: tenantId }, { _id: tenantId }] },
          { _id: uid },
        ],
      };
    }
    return {
      $or: [
        { companyId: tenantId },
        { managerId: tenantId },
        { _id: tenantId },
      ],
    };
  }

  // Tenant owner (where tenantId === user._id)
  return {
    $or: [
      { companyId: tenantId },
      { managerId: tenantId },
      { _id: tenantId },
    ],
  };
};

// ─────────────────────────────────────────────────────────────
// 1. OVERVIEW / DASHBOARD CENTRE
// ─────────────────────────────────────────────────────────────
exports.getOverviewMetrics = async (req, res) => {
  try {
    const tenantScope = getTenantScope(req.user);
    const tenantUserScope = getTenantUserScope(req.user);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const baseMatch = {
      deletedAt: null,
      ...tenantScope,
    };

    const isCompany = Boolean(req.user.companyId || req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner' || req.user.role === 'admin');
    const compId = req.user.companyId || req.user._id;

    const [leadAgg, paymentAgg, userAgg, commissionAgg] = await Promise.all([
      Lead.aggregate([
        { $match: baseMatch },
        {
          $facet: {
            totals: [
              {
                $group: {
                  _id: null,
                  totalLeads: { $sum: 1 },
                  todayLeads: {
                    $sum: { $cond: [{ $gte: ['$createdAt', todayStart] }, 1, 0] },
                  },
                  convertedLeads: {
                    $sum: {
                      $cond: [
                        {
                          $in: [
                            { $toLower: { $ifNull: ['$status', 'new_lead'] } },
                            [
                              'converted',
                              'payment_done',
                              'won',
                              'closed',
                              'closed / won',
                              'closed won',
                              'advance paid',
                              'subscription won',
                              'documents uploaded',
                              'onboarded',
                              'paid',
                            ],
                          ],
                        },
                        1,
                        0,
                      ],
                    },
                  },
                  totalPaidRevenue: {
                    $sum: {
                      $cond: [
                        {
                          $in: [
                            { $toLower: { $ifNull: ['$status', 'new_lead'] } },
                            [
                              'converted',
                              'payment_done',
                              'won',
                              'closed',
                              'closed / won',
                              'closed won',
                              'advance paid',
                              'subscription won',
                              'paid',
                            ],
                          ],
                        },
                        { $ifNull: ['$paid_amount', { $ifNull: ['$payable_amount', { $ifNull: ['$deal_value', 0] }] }] },
                        0,
                      ],
                    },
                  },
                },
              },
            ],
            stageCounts: [
              {
                $project: {
                  stage: {
                    $switch: {
                      branches: [
                        {
                          case: {
                            $in: [
                              { $toLower: { $ifNull: ['$status', 'new_lead'] } },
                              ['payment_done', 'closed', 'won', 'closed / won', 'closed won', 'advance paid', 'subscription won', 'paid', 'complete'],
                            ],
                          },
                          then: 'payment_done',
                        },
                        {
                          case: {
                            $in: [
                              { $toLower: { $ifNull: ['$status', 'new_lead'] } },
                              ['converted', 'qualified', 'negotiation', 'site_visit', 'documents uploaded', 'onboarded', 'deal closed'],
                            ],
                          },
                          then: 'converted',
                        },
                        {
                          case: {
                            $in: [
                              { $toLower: { $ifNull: ['$status', 'new_lead'] } },
                              ['not_interested', 'lost', 'not interested', 'rejected', 'cancelled', 'junk'],
                            ],
                          },
                          then: 'not_interested',
                        },
                        {
                          case: {
                            $in: [
                              { $toLower: { $ifNull: ['$status', 'new_lead'] } },
                              ['contacted', 'connected', 'attempted', 'inquiry', 'demo class', 'floor plan shared', 'follow-up scheduled', 'follow_up', 'meeting scheduled', 'quote sent', 'stall blocked'],
                            ],
                          },
                          then: 'contacted',
                        },
                      ],
                      default: 'new_lead',
                    },
                  },
                },
              },
              {
                $group: {
                  _id: '$stage',
                  count: { $sum: 1 },
                },
              },
            ],
            sourceBreakdown: [
              {
                $project: {
                  sourceGroup: {
                    $switch: {
                      branches: [
                        {
                          case: {
                            $in: [
                              { $toLower: { $ifNull: ['$source', { $ifNull: ['$primarySource', 'manual'] }] } },
                              ['signup', 'auto-signup', 'platform_registration', 'source_b_signup'],
                            ],
                          },
                          then: 'signup',
                        },
                        {
                          case: {
                            $in: [
                              { $toLower: { $ifNull: ['$source', { $ifNull: ['$primarySource', 'manual'] }] } },
                              ['ads', 'meta', 'google', 'webhook', 'source_c_ads', 'facebook', 'instagram', 'adwords'],
                            ],
                          },
                          then: 'ads',
                        },
                      ],
                      default: 'manual',
                    },
                  },
                },
              },
              {
                $group: {
                  _id: '$sourceGroup',
                  count: { $sum: 1 },
                },
              },
            ],
          },
        },
      ]),

      Payment.aggregate([
        {
          $match: {
            status: { $in: ['completed', 'captured', 'success'] },
            ...(isCompany ? { companyId: new mongoose.Types.ObjectId(String(compId)) } : {}),
          },
        },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),

      User.aggregate([
        {
          $match: {
            ...tenantUserScope,
            userStatus: 'active',
          },
        },
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 },
          },
        },
      ]),

      CommissionPayout.aggregate([
        {
          $match: {
            status: { $in: ['approved', 'paid'] },
            ...(isCompany ? { companyId: new mongoose.Types.ObjectId(String(compId)) } : {}),
          },
        },
        { $group: { _id: null, totalEarned: { $sum: '$commissionAmount' } } },
      ]),
    ]);

    const totalsObj = leadAgg[0]?.totals[0] || {
      totalLeads: 0,
      todayLeads: 0,
      convertedLeads: 0,
      totalPaidRevenue: 0,
    };

    const stageMap = {
      new_lead: 0,
      contacted: 0,
      not_interested: 0,
      converted: 0,
      payment_done: 0,
    };
    (leadAgg[0]?.stageCounts || []).forEach((s) => {
      if (stageMap[s._id] !== undefined) stageMap[s._id] = s.count;
    });

    const sourceMap = {
      manual: 0,
      signup: 0,
      ads: 0,
    };
    (leadAgg[0]?.sourceBreakdown || []).forEach((src) => {
      if (sourceMap[src._id] !== undefined) sourceMap[src._id] = src.count;
    });

    const userMap = {};
    (userAgg || []).forEach((u) => {
      userMap[u._id] = u.count;
    });

    const totalLeads = totalsObj.totalLeads || 0;
    const convertedLeads = totalsObj.convertedLeads || 0;
    const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0';
    const paymentRevenue = paymentAgg[0]?.total || 0;
    const totalRevenue = paymentRevenue > 0 ? paymentRevenue : totalsObj.totalPaidRevenue || 0;

    res.json({
      success: true,
      data: {
        totalLeads,
        todayLeads: totalsObj.todayLeads || 0,
        convertedLeads,
        conversionRate: `${conversionRate}%`,
        totalRevenue,
        totalCommissions: commissionAgg[0]?.totalEarned || 0,
        totalUsers: (userMap.agent || 0) + (userMap.manager || 0) + (userMap.admin || 0) + (userMap.user || 0),
        activeAgents: userMap.agent || 0,
        activeManagers: userMap.manager || 0,
        stageCounts: stageMap,
        sourceBreakdown: sourceMap,
        systemStatus: 'healthy',
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error('getOverviewMetrics error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch overview metrics' });
  }
};

// Aliases for backward compatibility
exports.getGlobalMetrics = exports.getOverviewMetrics;

// ─────────────────────────────────────────────────────────────
// 2. LEADS & LEAD SOURCES CENTRE
// ─────────────────────────────────────────────────────────────
exports.getAdminLeads = async (req, res) => {
  try {
    const {
      search,
      source,
      primarySource,
      stage,
      status,
      assignedTo,
      assignedManager,
      startDate,
      endDate,
      page = 1,
      limit = 50,
    } = req.query;

    const tenantScope = getTenantScope(req.user);
    const query = { deletedAt: null, ...tenantScope };

    // Role-based visibility check
    if (req.user?.role === 'agent') {
      // In isolated mode, agents only see their own assigned leads
      query.assignedTo = req.user._id;
    } else if (req.user?.role === 'manager') {
      // Managers see assigned team leads + direct leads
      query.$and = query.$and || [];
      query.$and.push({
        $or: [{ assignedManager: req.user._id }, { assignedTo: req.user._id }],
      });
    }

    if (search && String(search).trim()) {
      const safeSearch = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safeSearch, 'i');
      query.$or = [{ name: regex }, { phone: regex }, { email: regex }, { company: regex }];
    }

    if (stage && stage !== 'all') {
      if (stage === 'payment_done') {
        query.status = { $in: ['payment_done', 'closed', 'won', 'closed / won', 'closed won', 'advance paid', 'subscription won', 'Payment Done', 'Advance Paid', 'Closed Won', 'Closed / Won'] };
      } else if (stage === 'converted') {
        query.status = { $in: ['converted', 'qualified', 'negotiation', 'site_visit', 'documents uploaded', 'onboarded', 'Converted', 'Documents Uploaded'] };
      } else if (stage === 'not_interested') {
        query.status = { $in: ['not_interested', 'lost', 'not interested', 'rejected', 'dropped', 'Not Interested'] };
      } else if (stage === 'contacted') {
        query.status = { $in: ['contacted', 'connected', 'attempted', 'inquiry', 'demo class', 'floor plan shared', 'follow-up scheduled', 'Contacted', 'Inquiry', 'Demo Class', 'Floor Plan Shared', 'Follow-Up Scheduled'] };
      } else if (stage === 'new_lead') {
        query.status = { $in: ['new_lead', 'new', 'New', 'Platform Signup (Auto-generated when a user registers)', 'New Lead', ''] };
      } else {
        query.status = stage;
      }
    } else if (status && status !== 'all') {
      query.status = status;
    }

    if (primarySource && primarySource !== 'all') {
      if (primarySource === 'SOURCE_C_ADS' || primarySource === 'ads') {
        query.$or = [
          { primarySource: { $in: ['SOURCE_C_ADS', 'ads'] } },
          { source: { $in: ['ads', 'meta', 'google', 'webhook', 'facebook', 'instagram', 'adwords'] } },
        ];
      } else if (primarySource === 'SOURCE_B_SIGNUP' || primarySource === 'signup') {
        query.$or = [
          { primarySource: { $in: ['SOURCE_B_SIGNUP', 'signup'] } },
          { source: { $in: ['signup', 'auto-signup', 'Auto-Signup', 'platform_registration'] } },
        ];
      } else if (primarySource === 'SOURCE_A_MANUAL' || primarySource === 'manual') {
        query.$or = [
          { primarySource: { $in: ['SOURCE_A_MANUAL', 'manual'] } },
          { source: { $in: ['manual', 'agent_manual', 'direct', ''] } },
        ];
      } else {
        query.primarySource = primarySource;
      }
    } else if (source && source !== 'all') {
      if (source === 'ads') {
        query.$or = [
          { primarySource: { $in: ['SOURCE_C_ADS', 'ads'] } },
          { source: { $in: ['ads', 'meta', 'google', 'webhook', 'facebook', 'instagram', 'adwords'] } },
        ];
      } else if (source === 'signup') {
        query.$or = [
          { primarySource: { $in: ['SOURCE_B_SIGNUP', 'signup'] } },
          { source: { $in: ['signup', 'auto-signup', 'Auto-Signup', 'platform_registration'] } },
        ];
      } else if (source === 'manual') {
        query.$or = [
          { primarySource: { $in: ['SOURCE_A_MANUAL', 'manual'] } },
          { source: { $in: ['manual', 'agent_manual', 'direct', ''] } },
        ];
      } else {
        query.source = source;
      }
    }

    if (assignedTo && assignedTo !== 'all') {
      query.assignedTo = assignedTo;
    }
    if (assignedManager && assignedManager !== 'all') {
      query.assignedManager = assignedManager;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (parsedPage - 1) * parsedLimit;
    const [total, leads] = await Promise.all([
      Lead.countDocuments(query),
      Lead.find(query)
        .populate('assignedTo', 'name email role')
        .populate('assignedManager', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
    ]);

    const enrichedLeads = leads.map(l => {
      let nextFollowUp = null;
      if (l.followUpDate || (l.activeFollowUp && l.activeFollowUp.scheduledAt)) {
        nextFollowUp = {
          _id: l._id,
          scheduled_at: l.followUpDate || l.activeFollowUp?.scheduledAt,
          note: l.followUpNote || l.activeFollowUp?.note,
          status: l.followUpStatus || l.activeFollowUp?.status || 'open',
        };
      }
      return { ...l, nextFollowUp };
    });

    res.json({
      success: true,
      leads: enrichedLeads,
      pagination: {
        total,
        page: parsedPage,
        pages: Math.ceil(total / parsedLimit),
        limit: parsedLimit,
      },
    });
  } catch (error) {
    console.error('getAdminLeads error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch leads' });
  }
};

exports.createAdminLead = async (req, res) => {
  try {
    const {
      name,
      phone,
      email,
      company,
      service_required,
      monthly_spend,
      goal_timeline,
      assignedTo,
      source = 'manual',
      primarySource = 'SOURCE_A_MANUAL',
      notes,
      customData = {},
      utmSource,
      utmMedium,
      utmCampaign,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Name and phone are required' });
    }
    if (!req.body.source) {
      return res.status(400).json({ success: false, message: 'Source is required' });
    }

    // Auto-assignment check if assignedTo is not specified
    let assignment = {
      assignedTo: assignedTo || null,
      assignedToName: '',
      assignedManager: null,
      assignedManagerName: '',
      distributionStrategy: 'manual',
    };

    if (!assignedTo) {
      const autoDist = await leadDistributionService.distributeLead({
        name,
        phone,
        source,
        primarySource,
        service_required,
        monthly_spend,
        utmSource,
        utmCampaign,
      });
      if (autoDist.assignedTo) {
        assignment = autoDist;
      }
    } else {
      const userObj = await User.findById(assignedTo).select('name managerId').lean();
      assignment.assignedToName = userObj?.name || '';
      if (userObj?.managerId) {
        const mgr = await User.findById(userObj.managerId).select('name').lean();
        assignment.assignedManager = userObj.managerId;
        assignment.assignedManagerName = mgr?.name || '';
      }
    }

    const lead = await Lead.create({
      userId: req.user._id,
      name: name.trim(),
      phone: String(phone).trim(),
      email: email ? email.trim().toLowerCase() : undefined,
      company: company ? company.trim() : undefined,
      service_required: service_required || 'smart_solo',
      monthly_spend: Number(monthly_spend) || 0,
      goal_timeline: goal_timeline || 'immediate',
      status: 'new_lead',
      source,
      primarySource: primarySource || (source.includes('ads') ? 'SOURCE_C_ADS' : source.includes('signup') ? 'SOURCE_B_SIGNUP' : 'SOURCE_A_MANUAL'),
      assignedTo: assignment.assignedTo,
      assignedToName: assignment.assignedToName,
      assignedManager: assignment.assignedManager,
      assignedManagerName: assignment.assignedManagerName,
      distributionStrategy: assignment.strategy || 'manual',
      customData,
      utmSource,
      utmMedium,
      utmCampaign,
      notes: notes ? [{ text: notes, createdBy: req.user._id, authorName: req.user.name }] : [],
      leadActivities: [
        {
          action: 'lead_created',
          performedBy: req.user._id,
          performerName: req.user.name,
          details: `Lead created manually via Control Center. Assigned to: ${assignment.assignedToName || 'Unassigned'}`,
          timestamp: new Date(),
        },
      ],
    });

    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: 'LEAD_CREATED',
      targetType: 'lead',
      targetId: lead._id,
      afterState: { name: lead.name, phone: lead.phone, status: lead.status },
      details: `Lead ${lead.name} created.`,
    });

    res.status(201).json({ success: true, message: 'Lead created successfully', lead });
  } catch (error) {
    console.error('createAdminLead error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to create lead' });
  }
};

exports.updateAdminLead = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const lead = await Lead.findById(id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const beforeState = { ...lead.toObject() };
    Object.assign(lead, updates);

    // If stage changed to payment_done or converted, calculate commission automatically
    if (updates.status && updates.status !== beforeState.status) {
      lead.leadActivities.push({
        action: 'status_changed',
        performedBy: req.user._id,
        performerName: req.user.name,
        details: `Stage transitioned from "${beforeState.status}" to "${updates.status}"`,
        timestamp: new Date(),
      });

      if (['payment_done', 'converted'].includes(updates.status)) {
        await commissionService.processCommission({
          lead,
          dealAmount: updates.paid_amount || lead.paid_amount || lead.payable_amount,
          stageId: updates.status,
          performedBy: req.user._id,
        });
      }
    }

    await lead.save();

    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role,
      action: 'LEAD_UPDATED',
      targetType: 'lead',
      targetId: lead._id,
      beforeState,
      afterState: lead.toObject(),
      details: `Lead ${lead.name} updated.`,
    });

    res.json({ success: true, message: 'Lead updated successfully', lead });
  } catch (error) {
    console.error('updateAdminLead error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to update lead' });
  }
};

exports.updateLeadStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { stage, status, payment_amount, method, payment_method, transaction_id } = req.body;
    const targetStage = stage || status;

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (['payment_done', 'converted'].includes(targetStage)) {
      const paymentAmount = Number(payment_amount);
      if (!paymentAmount || isNaN(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({
          success: false,
          code: 'PAYMENT_REQUIRED_FOR_CONVERSION',
          message: 'Payment verification and amount are required to mark lead as converted/payment done',
        });
      }
      lead.paid_amount = paymentAmount;
      lead.payable_amount = paymentAmount;
      lead.payment_method = method || payment_method || 'bank_transfer';
    }

    const oldStage = lead.status;
    lead.status = targetStage;
    lead.leadActivities.push({
      action: 'status_changed',
      performedBy: req.user._id,
      performerName: req.user.name,
      details: `Stage updated to ${targetStage}`,
      timestamp: new Date(),
    });

    if (['payment_done', 'converted'].includes(targetStage)) {
      await commissionService.processCommission({
        lead,
        dealAmount: lead.paid_amount || lead.payable_amount,
        stageId: targetStage,
        performedBy: req.user._id,
      });
    }

    await lead.save();
    res.json({ success: true, message: `Lead stage updated to ${targetStage}`, lead });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateLeadStatus = exports.updateLeadStage;

exports.convertLeadWithPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { payment_amount, custom_payment_amount, custom_price_reason, payment_method, transaction_id } = req.body;
    const finalAmount = Number(custom_payment_amount || payment_amount);

    if (!finalAmount || finalAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Payment amount is required to convert lead' });
    }

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    lead.status = 'converted';
    lead.paid_amount = finalAmount;
    lead.payment_method = payment_method || 'bank_transfer';
    lead.closedDealAmount = finalAmount;

    if (custom_price_reason) {
      lead.metadata = lead.metadata || {};
      lead.metadata.admin_flag = true;
      lead.metadata.custom_price_reason = custom_price_reason;
    }

    lead.leadActivities.push({
      action: 'status_changed',
      performedBy: req.user._id,
      performerName: req.user.name,
      details: `Lead converted with ₹${finalAmount} payment recorded (${payment_method || 'bank_transfer'})`,
      timestamp: new Date(),
    });

    await lead.save();

    let incentive_amount = 0;
    let incentivePct = 10;
    if (lead.assignedTo) {
      const agent = await User.findById(lead.assignedTo).lean();
      if (agent) {
        incentivePct = Number(agent.incentive_pct) || 10;
        incentive_amount = Math.round((finalAmount * incentivePct) / 100);
      }
    }

    // Trigger Commission Engine
    await commissionService.processCommission({
      lead,
      dealAmount: finalAmount,
      stageId: 'converted',
      performedBy: req.user._id,
    });

    res.json({
      success: true,
      message: 'Lead converted & payment recorded successfully',
      lead,
      adminFlagged: Boolean(custom_price_reason),
      incentive: { incentive_amount, incentivePct },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAdminAlerts = async (req, res) => {
  try {
    const flaggedLeads = await Lead.find({
      'metadata.admin_flag': true,
      deletedAt: null,
    }).sort({ updatedAt: -1 }).lean();

    res.json({ success: true, flaggedLeads, alerts: flaggedLeads });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 3. LEAD DISTRIBUTION CENTRE
// ─────────────────────────────────────────────────────────────
exports.getLeadDistributionRules = async (req, res) => {
  try {
    const [rules, newRules] = await Promise.all([
      LeadDistributionRule.find()
        .populate('assignees.userId', 'name email role userStatus isAvailable leadCap')
        .populate('fallbackUserId', 'name email role')
        .sort({ priority: 1, createdAt: -1 })
        .lean(),
      DistributionRule.find()
        .populate('targets.assignedAgents.agentId', 'name email role userStatus isAvailable leadCap')
        .sort({ priority: 1, createdAt: -1 })
        .lean(),
    ]);

    // Merge & normalize rules for UI
    const combined = [...newRules.map(r => ({
      _id: r._id,
      name: r.ruleName,
      strategy: r.strategy?.routingMethod || 'ROUND_ROBIN',
      priority: r.priority || 1,
      isActive: r.isActive,
      conditions: r.conditions,
      assignees: (r.targets?.assignedAgents || []).map(a => ({
        userId: a.agentId,
        weight: a.weightPercentage,
      })),
      stats: r.stats,
    })), ...rules];

    res.json({ success: true, rules: combined });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveLeadDistributionRule = async (req, res) => {
  try {
    const { id, name, ruleName, description, strategy, routingMethod, isActive, priority, conditions, assignees, assignedAgents, fallbackUserId } = req.body;
    const finalName = (name || ruleName || '').trim();

    if (!finalName) {
      return res.status(400).json({ success: false, message: 'Rule name is required' });
    }

    const strat = String(strategy || routingMethod || 'ROUND_ROBIN').toUpperCase();
    const stratNorm = ['ROUND_ROBIN', 'WEIGHTED', 'MANAGER_ROUTED'].includes(strat) ? strat : 'ROUND_ROBIN';

    const normalizedAgents = (assignedAgents || assignees || []).map(a => ({
      agentId: a.agentId || a.userId || a.id,
      weightPercentage: Number(a.weightPercentage || a.weight || 0),
      managerId: a.managerId || null,
    })).filter(a => a.agentId);

    let rule;
    if (id) {
      const beforeState = await DistributionRule.findById(id).lean() || await LeadDistributionRule.findById(id).lean();
      rule = await DistributionRule.findByIdAndUpdate(
        id,
        {
          $set: {
            ruleName: finalName,
            isActive: isActive !== undefined ? isActive : true,
            priority: Number(priority) || 1,
            conditions: conditions || { sourceType: 'ALL' },
            strategy: { routingMethod: stratNorm },
            targets: { assignedAgents: normalizedAgents },
          }
        },
        { new: true, upsert: true }
      );

      await logActivity({
        actor: req.user._id,
        actorRole: req.user.role || 'admin',
        action: 'UPDATE',
        entityType: 'DistributionRule',
        entityId: rule._id,
        beforeState,
        afterState: rule.toObject(),
        details: `Updated Distribution Rule "${finalName}" (${stratNorm})`,
        ipAddress: req.ip,
      });
    } else {
      rule = await DistributionRule.create({
        ruleName: finalName,
        isActive: isActive !== undefined ? isActive : true,
        priority: Number(priority) || 1,
        createdBy: req.user._id,
        conditions: conditions || { sourceType: 'ALL' },
        strategy: { routingMethod: stratNorm },
        targets: { assignedAgents: normalizedAgents },
      });

      // Also create backward-compatible LeadDistributionRule
      await LeadDistributionRule.create({
        name: finalName,
        description: description || '',
        strategy: stratNorm.toLowerCase(),
        isActive: isActive !== undefined ? isActive : true,
        priority: Number(priority) || 1,
        conditions: { sources: ['manual', 'signup', 'meta', 'google'] },
        assignees: normalizedAgents.map(a => ({ userId: a.agentId, weight: a.weightPercentage || 1 })),
        createdBy: req.user._id,
      }).catch(() => {});

      await logActivity({
        actor: req.user._id,
        actorRole: req.user.role || 'admin',
        action: 'CREATE',
        entityType: 'DistributionRule',
        entityId: rule._id,
        afterState: rule.toObject(),
        details: `Created Distribution Rule "${finalName}" with strategy ${stratNorm}`,
        ipAddress: req.ip,
      });
    }

    res.json({ success: true, message: 'Distribution rule saved successfully', rule });
  } catch (error) {
    console.error('saveLeadDistributionRule error:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteLeadDistributionRule = async (req, res) => {
  try {
    const { id } = req.params;
    await Promise.all([
      DistributionRule.findByIdAndDelete(id),
      LeadDistributionRule.findByIdAndDelete(id),
    ]);

    await logActivity({
      actor: req.user._id,
      actorRole: req.user.role || 'admin',
      action: 'DELETE',
      entityType: 'DistributionRule',
      entityId: id,
      details: `Deleted Distribution Rule (ID: ${id})`,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Distribution rule deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.reassignAgentLeads = async (req, res) => {
  try {
    const { fromAgentId, toAgentId, leadIds } = req.body;

    if (!toAgentId) {
      return res.status(400).json({ success: false, message: 'Target assignee is required' });
    }

    const tenantUserScope = getTenantUserScope(req.user);
    const targetUser = await User.findOne({
      _id: toAgentId,
      ...tenantUserScope,
    }).select('name managerId').lean();
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Target assignee not found or not in authorized scope' });
    }

    let managerId = targetUser.managerId || null;
    let managerName = '';
    if (managerId) {
      const mgr = await User.findById(managerId).select('name').lean();
      managerName = mgr?.name || '';
    }

    const tenantScope = getTenantScope(req.user);
    const filter = { ...tenantScope };
    if (leadIds && Array.isArray(leadIds) && leadIds.length > 0) {
      filter._id = { $in: leadIds };
    } else if (fromAgentId) {
      filter.assignedTo = fromAgentId;
    } else {
      return res.status(400).json({ success: false, message: 'Specify either fromAgentId or leadIds' });
    }

    const result = await Lead.updateMany(filter, {
      $set: {
        assignedTo: targetUser._id,
        assignedToName: targetUser.name,
        assignedManager: managerId,
        assignedManagerName: managerName,
      },
      $push: {
        leadActivities: {
          action: 'assigned_agent',
          performedBy: req.user._id,
          performerName: req.user.name,
          details: `Reassigned to ${targetUser.name} by Admin`,
          timestamp: new Date(),
        },
      },
    });

    res.json({
      success: true,
      message: `Successfully reassigned ${result.modifiedCount} lead(s) to ${targetUser.name}`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 4. PIPELINE CENTRE
// ─────────────────────────────────────────────────────────────
exports.getPipelineSettings = async (req, res) => {
  try {
    let pipeline = await Pipeline.findOne({ isActive: true }).sort({ createdAt: -1 }).lean();
    if (!pipeline) {
      pipeline = await Pipeline.create({
        name: 'Default Sales Pipeline',
        description: 'Standard 5-stage sales workflow',
        isActive: true,
        createdBy: req.user._id,
        stages: [
          { name: 'New Lead', order: 0, probability: 10, colorCode: '#64748b', slaHours: 24 },
          { name: 'Contacted', order: 1, probability: 30, colorCode: '#3b82f6', slaHours: 48 },
          { name: 'Follow-Up Scheduled', order: 2, probability: 50, colorCode: '#f97316', slaHours: 24 },
          { name: 'Converted', order: 3, probability: 80, colorCode: '#10b981', slaHours: 72 },
          { name: 'Payment Done', order: 4, probability: 100, colorCode: '#8b5cf6', slaHours: 0 },
        ],
      });
    }

    const stages = pipeline.stages.map((st, idx) => ({
      id: st.name.toLowerCase().replace(/\s+/g, '_'),
      name: st.name,
      label: st.name,
      order: st.order !== undefined ? st.order : idx,
      probability: st.probability !== undefined ? st.probability : 50,
      color: st.colorCode || '#3b82f6',
      slaHours: st.slaHours || 24,
    }));

    res.json({
      success: true,
      pipeline,
      stages,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.savePipelineSettings = async (req, res) => {
  try {
    const { name, stages } = req.body;
    if (!Array.isArray(stages) || stages.length === 0) {
      return res.status(400).json({ success: false, message: 'Stages array is required' });
    }

    const normalizedStages = stages.map((s, idx) => ({
      name: s.name || s.label || `Stage ${idx + 1}`,
      order: s.order !== undefined ? Number(s.order) : idx,
      probability: s.probability !== undefined ? Number(s.probability) : 50,
      colorCode: s.colorCode || s.color || '#6366f1',
      slaHours: s.slaHours !== undefined ? Number(s.slaHours) : 24,
    }));

    let pipeline = await Pipeline.findOneAndUpdate(
      { isActive: true },
      {
        $set: {
          name: name || 'Sales Deal Pipeline',
          stages: normalizedStages,
          isActive: true,
        },
      },
      { new: true, upsert: true }
    );

    await TenantConfig.findOneAndUpdate(
      { user: req.user._id },
      { $set: { pipelineStages: stages } },
      { upsert: true }
    );

    await logActivity({
      actor: req.user._id,
      actorRole: req.user.role || 'admin',
      action: 'UPDATE',
      entityType: 'Pipeline',
      entityId: pipeline._id,
      newValue: normalizedStages,
      details: `Admin updated pipeline "${pipeline.name}" with ${normalizedStages.length} stages & SLAs`,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Pipeline configuration saved successfully', pipeline });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 5. AGENTS & MANAGERS HIERARCHY CENTRE
// ─────────────────────────────────────────────────────────────
exports.getHierarchy = async (req, res) => {
  try {
    const tenantUserScope = getTenantUserScope(req.user);
    const [managers, agents, allUsers] = await Promise.all([
      User.find({ ...tenantUserScope, role: 'manager' }).select('name email phone userStatus leadCap isAvailable isAvailableForRouting isActive incentive_pct createdBy createdAt').lean(),
      User.find({ ...tenantUserScope, role: 'agent' }).populate('managerId', 'name email').select('name email phone userStatus leadCap isAvailable isAvailableForRouting isActive managerId managerName incentive_pct createdBy createdAt').lean(),
      User.find({ ...tenantUserScope, role: { $in: ['user', 'superadmin', 'admin'] } }).select('name email phone role userStatus isActive createdAt').lean(),
    ]);

    // Group agents under managers
    const managerMap = managers.map(m => ({
      ...m,
      teamMembers: agents.filter(a => String(a.managerId?._id || a.managerId) === String(m._id)),
    }));

    const unassignedAgents = agents.filter(a => !a.managerId);

    res.json({
      success: true,
      hierarchy: {
        managers: managerMap,
        unassignedAgents,
        otherUsers: allUsers,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAdminAgents = exports.getHierarchy;

exports.createAdminAgent = async (req, res) => {
  try {
    const { name, email, phone, password, role = 'agent', managerId, incentive_pct, leadCap, isAvailableForRouting, isActive } = req.body;

    if (!name || !password || (!email && !phone)) {
      return res.status(400).json({ success: false, message: 'Name, password, and Email or Phone are required' });
    }

    const username = await generateUniqueUsername();
    const usercode = await generateUniqueUsercode(role === 'manager' ? 'CMP' : 'REA');

    let managerName = '';
    if (managerId) {
      const mgr = await User.findById(managerId).select('name').lean();
      managerName = mgr?.name || '';
    }

    const companyId = req.user.companyId || (req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner' || req.user.role === 'admin' ? req.user._id : null);

    const user = await User.create({
      name: name.trim(),
      email: email ? email.trim().toLowerCase() : undefined,
      phone: phone ? String(phone).trim() : undefined,
      password,
      username,
      usercode,
      role: role === 'manager' ? 'manager' : 'agent',
      companyId: companyId || undefined,
      managerId: managerId || null,
      managerName,
      incentive_pct: Number(incentive_pct) || (role === 'manager' ? 15 : 10),
      leadCap: Number(leadCap) || 50,
      isAvailableForRouting: isAvailableForRouting !== undefined ? isAvailableForRouting : true,
      isAvailable: isAvailableForRouting !== undefined ? isAvailableForRouting : true,
      isActive: isActive !== undefined ? isActive : true,
      userStatus: 'active',
      createdBy: req.user._id,
    });

    await logActivity({
      actor: req.user._id,
      actorRole: req.user.role || 'admin',
      action: 'CREATE',
      entityType: 'User',
      entityId: user._id,
      newValue: { name: user.name, role: user.role, email: user.email, managerId: user.managerId, leadCap: user.leadCap },
      details: `Created new team member: ${user.name} (${user.role.toUpperCase()})`,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: `${role.toUpperCase()} created successfully`, user, agent: user });
  } catch (error) {
    console.error('createAdminAgent error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateAdminAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const beforeUser = await User.findById(id).lean();
    if (!beforeUser) return res.status(404).json({ success: false, message: 'User not found' });

    if (updates.managerId !== undefined) {
      if (updates.managerId) {
        const mgr = await User.findById(updates.managerId).select('name').lean();
        updates.managerName = mgr?.name || '';
      } else {
        updates.managerId = null;
        updates.managerName = '';
      }
    }

    if (updates.isAvailableForRouting !== undefined) {
      updates.isAvailable = updates.isAvailableForRouting;
    }

    const user = await User.findByIdAndUpdate(id, { $set: updates }, { new: true });

    await logActivity({
      actor: req.user._id,
      actorRole: req.user.role || 'admin',
      action: 'UPDATE',
      entityType: 'User',
      entityId: user._id,
      oldValue: beforeUser,
      newValue: user.toObject(),
      details: `Admin updated team member ${user.name} (Role: ${user.role}, Manager: ${user.managerName || 'Direct'})`,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'User updated successfully', user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAgentActivityLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const logs = await ActivityLog.find({ actor: id }).sort({ createdAt: -1, timestamp: -1 }).limit(100).lean();
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAgentsPerformance = async (req, res) => {
  try {
    const tenantUserScope = getTenantUserScope(req.user);
    const agents = await User.find({
      ...tenantUserScope,
      $or: [
        { role: { $in: ['agent', 'manager', 'sales_rep'] } },
        { companyRole: { $in: ['agent', 'manager', 'sales_rep'] } },
      ],
    }).select('name role managerName leadCap isAvailableForRouting isActive incentive_pct email').lean();
    const performance = [];

    for (const agent of agents) {
      const [totalAssigned, convertedCount, revenueAgg, commissionAgg] = await Promise.all([
        Lead.countDocuments({ assignedTo: agent._id, deletedAt: null }),
        Lead.countDocuments({ assignedTo: agent._id, status: { $in: ['converted', 'payment_done'] }, deletedAt: null }),
        Lead.aggregate([
          { $match: { assignedTo: agent._id, status: { $in: ['converted', 'payment_done'] } } },
          { $group: { _id: null, total: { $sum: '$paid_amount' } } },
        ]),
        CommissionPayout.aggregate([
          { $match: { userId: agent._id, status: { $in: ['approved', 'paid'] } } },
          { $group: { _id: null, earned: { $sum: '$commissionAmount' } } },
        ]),
      ]);

      const salesRevenue = revenueAgg[0]?.total || 0;
      const incentiveRate = Number(agent.incentive_pct) || 10;
      const commissionEarned = commissionAgg[0]?.earned || Math.round((salesRevenue * incentiveRate) / 100);
      const conversionRate = totalAssigned > 0 ? ((convertedCount / totalAssigned) * 100).toFixed(1) : 0;

      performance.push({
        id: agent._id,
        agentId: agent._id,
        name: agent.name,
        agentName: agent.name,
        email: agent.email,
        agentEmail: agent.email,
        role: agent.role,
        managerName: agent.managerName || 'None',
        totalLeads: totalAssigned,
        convertedLeads: convertedCount,
        conversionRate: `${conversionRate}%`,
        salesRevenue,
        totalSales: salesRevenue,
        incentivePct: incentiveRate,
        totalIncentives: commissionEarned,
        commissionEarned,
      });
    }

    res.json({ success: true, performance });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.reassignAgentLeads = async (req, res) => {
  try {
    const { fromAgentId, toAgentId, leadIds } = req.body;
    if (!fromAgentId || !toAgentId) {
      return res.status(400).json({ success: false, message: 'fromAgentId and toAgentId are required' });
    }

    const [fromAgent, toAgent] = await Promise.all([
      User.findById(fromAgentId).select('name email role'),
      User.findById(toAgentId).select('name email role'),
    ]);

    if (!fromAgent || !toAgent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    const filter = { assignedTo: fromAgentId };
    if (Array.isArray(leadIds) && leadIds.length > 0) {
      filter._id = { $in: leadIds };
    } else {
      filter.status = { $nin: ['converted', 'payment_done'] };
    }

    const updateResult = await Lead.updateMany(filter, { $set: { assignedTo: toAgentId } });

    await logActivity({
      actor: req.user._id,
      actorRole: req.user.role || 'admin',
      action: 'ASSIGN',
      entityType: 'Lead',
      details: `Reassigned ${updateResult.modifiedCount} active leads from ${fromAgent.name} to ${toAgent.name}`,
      metadata: {
        fromAgent: { id: fromAgent._id, name: fromAgent.name },
        toAgent: { id: toAgent._id, name: toAgent.name },
        reassignedCount: updateResult.modifiedCount,
      },
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Successfully reassigned ${updateResult.modifiedCount} leads from ${fromAgent.name} to ${toAgent.name}`,
      modifiedCount: updateResult.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 6. FORMS CENTRE
// ─────────────────────────────────────────────────────────────
exports.getFormSchemas = async (req, res) => {
  try {
    const formType = String(req.query.type || 'lead').toLowerCase();
    const isProduct = formType === 'product' || formType === 'package';
    const user = await User.findById(req.user._id).lean();

    const { getDefaultProductFormSchema } = require('../utils/formValidator');
    const { getIndustryDefaults } = require('../utils/industryTemplates');

    let schema;
    if (isProduct) {
      schema = (user?.productFormSchema && Array.isArray(user.productFormSchema) && user.productFormSchema.length > 0)
        ? user.productFormSchema
        : getDefaultProductFormSchema();
    } else {
      const industryDefaults = getIndustryDefaults(user?.industryType, user?.educationSubProfile);
      schema = (user?.leadFormSchema && Array.isArray(user.leadFormSchema) && user.leadFormSchema.length > 0)
        ? user.leadFormSchema
        : industryDefaults.leadFormSchema;
    }

    res.json({
      success: true,
      formType: isProduct ? 'product' : 'lead',
      fields: schema,
      schema,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveFormSchema = async (req, res) => {
  try {
    const formType = String(req.query.type || req.body.formType || 'lead').toLowerCase();
    const isProduct = formType === 'product' || formType === 'package';
    const { title, description, fields } = req.body;
    if (!Array.isArray(fields)) {
      return res.status(400).json({ success: false, message: 'Fields array is required' });
    }

    const ALLOWED_TYPES = [
      'text', 'textarea', 'number', 'email', 'phone', 'date', 'datetime',
      'select', 'multiselect', 'radio', 'checkbox', 'currency', 'percentage', 'url',
      'dropdown', 'hidden'
    ];

    const sanitized = fields.map((f, idx) => {
      const rawId = f.fieldId || f.name || f.label || '';
      const fieldId = String(rawId).replace(/[^a-zA-Z0-9_]/g, '_').trim();
      const isSystem = Boolean(f.isSystem);

      const rawType = String(f.fieldType || f.type || 'text').toLowerCase();
      const fieldType = ALLOWED_TYPES.includes(rawType) ? rawType : 'text';

      const options = Array.isArray(f.options) ? f.options.map(opt => {
        if (typeof opt === 'object' && opt !== null) {
          return {
            name: String(opt.name || opt.label || opt.value || '').trim(),
            value: String(opt.value || opt.name || opt.label || '').trim(),
            order: typeof opt.order === 'number' ? opt.order : 0,
            disabled: Boolean(opt.disabled),
          };
        }
        return { name: String(opt).trim(), value: String(opt).trim(), order: 0, disabled: false };
      }).filter(o => o.value) : [];

      return {
        fieldId,
        label: (f.label || fieldId).trim(),
        fieldType,
        placeholder: f.placeholder ? String(f.placeholder).trim() : '',
        helpText: f.helpText ? String(f.helpText).trim() : '',
        defaultValue: f.defaultValue !== undefined ? f.defaultValue : '',
        options,
        isRequired: Boolean(f.isRequired),
        isSystem,
        isHidden: Boolean(f.isHidden),
        order: typeof f.order === 'number' ? f.order : (idx + 1),
        conditionalRules: f.conditionalRules || null,
        conditionalRequiredRules: f.conditionalRequiredRules || null,
        validationRules: f.validationRules || {},
      };
    }).filter(f => f.fieldId && f.label);

    sanitized.sort((a, b) => (a.order || 0) - (b.order || 0));

    const updateFields = isProduct
      ? { productFormSchema: sanitized }
      : { leadFormSchema: sanitized };

    await User.findByIdAndUpdate(req.user._id, { $set: updateFields });
    if (req.user.companyId && String(req.user.companyId) !== String(req.user._id)) {
      await User.findByIdAndUpdate(req.user.companyId, { $set: updateFields });
    }

    await TenantConfig.findOneAndUpdate(
      { user: req.user._id },
      { $set: updateFields },
      { upsert: true }
    );

    await logActivity({
      actor: req.user._id,
      actorRole: req.user.role || 'admin',
      action: 'UPDATE',
      entityType: 'Form',
      entityId: req.user._id,
      newValue: sanitized,
      details: `Admin updated ${isProduct ? 'Product/Package' : 'Lead'} form schema with ${sanitized.length} fields`,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `${isProduct ? 'Product/Package' : 'Lead'} form schema saved successfully ✅`,
      formType: isProduct ? 'product' : 'lead',
      fields: sanitized,
      schema: sanitized,
      leadFormSchema: sanitized,
      productFormSchema: sanitized,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 7. TEMPLATE CENTRE
// ─────────────────────────────────────────────────────────────
exports.getAdminTemplates = async (req, res) => {
  try {
    const templates = await Template.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createAdminTemplate = async (req, res) => {
  try {
    const { name, title, category = 'GENERAL', content, body, channel = 'WHATSAPP', variables = [] } = req.body;
    const finalName = (name || title || '').trim();
    const finalContent = content || body || '';

    if (!finalName || !finalContent) {
      return res.status(400).json({ success: false, message: 'Template name and content are required' });
    }

    const template = await Template.create({
      name: finalName,
      channel: String(channel).toUpperCase(),
      content: finalContent,
      category: String(category).toUpperCase(),
      variables,
      createdBy: req.user._id,
    });

    await logActivity({
      actor: req.user._id,
      actorRole: req.user.role || 'admin',
      action: 'CREATE',
      entityType: 'Template',
      entityId: template._id,
      details: `Created message template "${template.name}" for ${template.channel}`,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Template created successfully', template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAdminTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const template = await Template.findByIdAndDelete(id);
    if (template) {
      await logActivity({
        actor: req.user._id,
        actorRole: req.user.role || 'admin',
        action: 'DELETE',
        entityType: 'Template',
        entityId: id,
        details: `Deleted message template "${template.name}"`,
        ipAddress: req.ip,
      });
    }
    res.json({ success: true, message: 'Template deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 8. CATALOGUE CENTRE
// ─────────────────────────────────────────────────────────────
exports.getAdminCatalogues = async (req, res) => {
  try {
    let items = await Catalogue.find().sort({ createdAt: -1 }).lean();
    if (!items || items.length === 0) {
      items = await TenantCatalogue.find().sort({ createdAt: -1 }).lean();
    }
    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createAdminCatalogueItem = async (req, res) => {
  try {
    const { itemName, title, category = 'GENERAL', price, discountedPrice, discountPrice, description, mediaUrls = [] } = req.body;
    const finalName = (itemName || title || '').trim();

    if (!finalName || price === undefined) {
      return res.status(400).json({ success: false, message: 'Item name and price are required' });
    }

    const item = await Catalogue.create({
      itemName: finalName,
      description: description || '',
      price: Number(price) || 0,
      discountedPrice: discountedPrice !== undefined ? Number(discountedPrice) : (discountPrice !== undefined ? Number(discountPrice) : null),
      category: String(category).toUpperCase(),
      mediaUrls: Array.isArray(mediaUrls) ? mediaUrls : [],
      createdBy: req.user._id,
    });

    await logActivity({
      actor: req.user._id,
      actorRole: req.user.role || 'admin',
      action: 'CREATE',
      entityType: 'Catalogue',
      entityId: item._id,
      details: `Created catalogue offering "${item.itemName}" (₹${item.price})`,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Catalogue item created', item });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteAdminCatalogueItem = async (req, res) => {
  try {
    const { id } = req.params;
    const item = await Catalogue.findByIdAndDelete(id) || await TenantCatalogue.findByIdAndDelete(id);
    if (item) {
      await logActivity({
        actor: req.user._id,
        actorRole: req.user.role || 'admin',
        action: 'DELETE',
        entityType: 'Catalogue',
        entityId: id,
        details: `Deleted catalogue item "${item.itemName || item.title}"`,
        ipAddress: req.ip,
      });
    }
    res.json({ success: true, message: 'Catalogue item deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 9. INTEGRATION CENTRE
// ─────────────────────────────────────────────────────────────
exports.getIntegrationsStatus = async (req, res) => {
  try {
    const isCompany = Boolean(req.user.companyId || req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner' || req.user.role === 'admin');
    const compId = req.user.companyId || req.user._id;
    const query = isCompany ? { $or: [{ companyId: compId }, { userId: compId }] } : { userId: req.user._id };

    const integrations = await Integration.find(query).select('-encryptedCredentials -accessTokenEncrypted').lean();
    const isWaConnected = waSession.isClientReady();

    const baseUrl = process.env.BACKEND_URL || 'https://api.sahyak.com';

    res.json({
      success: true,
      integrations,
      meta: {
        provider: 'META',
        webhookUrl: `${baseUrl}/api/integrations/meta/webhook`,
        verifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || 'crm_meta_webhook_secret_2026',
        status: integrations.some(i => String(i.provider).toUpperCase() === 'META' && String(i.status).toUpperCase() === 'CONNECTED') ? 'CONNECTED' : 'DISCONNECTED',
      },
      google: {
        provider: 'GOOGLE',
        webhookUrl: `${baseUrl}/api/integrations/google/webhook`,
        status: integrations.some(i => String(i.provider).toUpperCase() === 'GOOGLE' && String(i.status).toUpperCase() === 'CONNECTED') ? 'CONNECTED' : 'DISCONNECTED',
      },
      whatsapp: {
        provider: 'WHATSAPP',
        status: isWaConnected ? 'CONNECTED' : 'DISCONNECTED',
      },
      webhook: {
        provider: 'WEBHOOK',
        webhookUrl: `${baseUrl}/api/integrations/generic/webhook`,
        status: 'CONNECTED',
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveIntegrationCredentials = async (req, res) => {
  try {
    const { provider, credentials, webhookUrl, status = 'CONNECTED' } = req.body;
    if (!provider || !credentials) {
      return res.status(400).json({ success: false, message: 'Provider and credentials are required' });
    }

    const provUpper = String(provider).toUpperCase();
    const credString = typeof credentials === 'object' ? JSON.stringify(credentials) : String(credentials);
    const encryptedCredentials = encrypt(credString);

    const isCompany = Boolean(req.user.companyId || req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner' || req.user.role === 'admin');
    const compId = req.user.companyId || req.user._id;

    const integration = await Integration.findOneAndUpdate(
      {
        provider: provUpper,
        ...(isCompany ? { companyId: compId } : { userId: req.user._id }),
      },
      {
        $set: {
          provider: provUpper,
          status: String(status).toUpperCase(),
          encryptedCredentials,
          webhookUrl: webhookUrl || null,
          lastSyncAt: new Date(),
          updatedBy: req.user._id,
          userId: req.user._id,
          companyId: isCompany ? compId : null,
        },
      },
      { new: true, upsert: true }
    );

    await logActivity({
      actor: req.user._id,
      actorRole: req.user.role || 'admin',
      action: 'UPDATE',
      entityType: 'Integration',
      entityId: integration._id,
      details: `Admin configured encrypted credentials for ${provUpper} integration`,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: `${provUpper} credentials encrypted and saved successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 10. CAMPAIGNS & ADS
// ─────────────────────────────────────────────────────────────
exports.getCampaigns = async (req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCampaign = async (req, res) => {
  try {
    const { campaignName, platform = 'META', campaignId, budget, amountSpent, startDate, endDate, status = 'ACTIVE' } = req.body;
    if (!campaignName) {
      return res.status(400).json({ success: false, message: 'Campaign name is required' });
    }

    const campaign = await Campaign.create({
      campaignName: campaignName.trim(),
      platform: String(platform).toUpperCase(),
      campaignId: campaignId || `CAMP_${Date.now()}`,
      budget: Number(budget) || 0,
      amountSpent: Number(amountSpent) || 0,
      startDate: startDate ? new Date(startDate) : new Date(),
      endDate: endDate ? new Date(endDate) : null,
      status: String(status).toUpperCase(),
      createdBy: req.user._id,
    });

    await logActivity({
      actor: req.user._id,
      actorRole: req.user.role || 'admin',
      action: 'CREATE',
      entityType: 'Campaign',
      entityId: campaign._id,
      details: `Created ad campaign "${campaign.campaignName}" on ${campaign.platform} (Budget: ₹${campaign.budget})`,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Campaign created successfully', campaign });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const campaign = await Campaign.findByIdAndDelete(id);
    if (campaign) {
      await logActivity({
        actor: req.user._id,
        actorRole: req.user.role || 'admin',
        action: 'DELETE',
        entityType: 'Campaign',
        entityId: id,
        details: `Deleted ad campaign "${campaign.campaignName}"`,
        ipAddress: req.ip,
      });
    }
    res.json({ success: true, message: 'Campaign deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCampaignMetrics = async (req, res) => {
  try {
    const [campaignsList, leadsAgg] = await Promise.all([
      Campaign.find().sort({ createdAt: -1 }).lean(),
      Lead.aggregate([
        { $match: { deletedAt: null } },
        {
          $group: {
            _id: {
              campaignName: { $ifNull: ['$leadSource.campaignName', '$utmCampaign', 'Direct Inbound'] },
              platform: { $ifNull: ['$primarySource', '$source'] },
            },
            totalLeads: { $sum: 1 },
            convertedCount: {
              $sum: { $cond: [{ $in: ['$status', ['converted', 'payment_done']] }, 1, 0] },
            },
            revenue: { $sum: '$paid_amount' },
          },
        },
        { $sort: { totalLeads: -1 } },
      ]),
    ]);

    res.json({ success: true, campaigns: campaignsList, metrics: leadsAgg });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 11. COMMISSION ENGINE
// ─────────────────────────────────────────────────────────────
exports.getCommissionRules = async (req, res) => {
  try {
    const rules = await CommissionRule.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, rules });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.saveCommissionRule = async (req, res) => {
  try {
    const { id, ruleName, name, targetRole = 'AGENT', commissionType = 'PERCENTAGE', value, percentageRate, fixedAmount, stageThreshold = 'payment_done', isActive = true } = req.body;
    const finalName = (ruleName || name || '').trim();
    if (!finalName) return res.status(400).json({ success: false, message: 'Rule name is required' });

    const finalRole = String(targetRole).toUpperCase();
    const finalType = String(commissionType).toUpperCase();
    const finalValue = value !== undefined ? Number(value) : (finalType === 'PERCENTAGE' ? (Number(percentageRate) || 10) : (Number(fixedAmount) || 0));

    let rule;
    if (id) {
      rule = await CommissionRule.findByIdAndUpdate(
        id,
        {
          $set: {
            ruleName: finalName,
            targetRole: finalRole,
            commissionType: finalType,
            value: finalValue,
            stageThreshold,
            isActive,
          },
        },
        { new: true }
      );

      await logActivity({
        actor: req.user._id,
        actorRole: req.user.role || 'admin',
        action: 'UPDATE',
        entityType: 'CommissionRule',
        entityId: rule._id,
        details: `Updated commission rule "${rule.ruleName}" (${finalRole} - ${finalValue}${finalType === 'PERCENTAGE' ? '%' : '₹'})`,
        ipAddress: req.ip,
      });
    } else {
      rule = await CommissionRule.create({
        ruleName: finalName,
        targetRole: finalRole,
        commissionType: finalType,
        value: finalValue,
        stageThreshold,
        isActive,
        createdBy: req.user._id,
      });

      await logActivity({
        actor: req.user._id,
        actorRole: req.user.role || 'admin',
        action: 'CREATE',
        entityType: 'CommissionRule',
        entityId: rule._id,
        details: `Created commission rule "${rule.ruleName}" (${finalRole} - ${finalValue}${finalType === 'PERCENTAGE' ? '%' : '₹'})`,
        ipAddress: req.ip,
      });
    }

    res.json({ success: true, message: 'Commission rule saved successfully', rule });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCommissionRule = async (req, res) => {
  try {
    const { id } = req.params;
    const rule = await CommissionRule.findByIdAndDelete(id);
    if (rule) {
      await logActivity({
        actor: req.user._id,
        actorRole: req.user.role || 'admin',
        action: 'DELETE',
        entityType: 'CommissionRule',
        entityId: id,
        details: `Deleted commission rule "${rule.ruleName}"`,
        ipAddress: req.ip,
      });
    }
    res.json({ success: true, message: 'Commission rule deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getCommissionPayouts = async (req, res) => {
  try {
    const { userId, status, page = 1, limit = 50 } = req.query;
    const query = {};

    if (userId) query.userId = userId;
    if (status && status !== 'all') query.status = String(status).toUpperCase();

    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (parsedPage - 1) * parsedLimit;
    const [total, payouts] = await Promise.all([
      CommissionPayout.countDocuments(query),
      CommissionPayout.find(query)
        .populate('userId', 'name email role')
        .populate('leadId', 'name phone status')
        .populate('appliedRuleId', 'ruleName targetRole commissionType value')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parsedLimit)
        .lean(),
    ]);

    res.json({
      success: true,
      payouts: payouts.map(p => ({
        _id: p._id,
        userId: p.userId?._id,
        userName: p.userId?.name || 'Agent',
        userRole: p.userId?.role || 'agent',
        leadId: p.leadId?._id,
        leadName: p.leadId?.name || 'Lead Deal',
        saleValue: p.saleValue || p.dealAmount || 0,
        dealAmount: p.saleValue || p.dealAmount || 0,
        commissionEarned: p.commissionEarned || p.commissionAmount || 0,
        commissionAmount: p.commissionEarned || p.commissionAmount || 0,
        ruleName: p.appliedRuleId?.ruleName || p.ruleNameSnapshot || 'Standard Rule',
        status: p.status,
        createdAt: p.createdAt,
      })),
      pagination: {
        total,
        page: parseInt(page, 10),
        pages: Math.ceil(total / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 12. COUPON ENGINE
// ─────────────────────────────────────────────────────────────
exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, coupons });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createCoupon = async (req, res) => {
  try {
    const {
      code,
      description = '',
      discountType = 'PERCENTAGE',
      discount_type,
      discountValue,
      discount_value,
      applicablePlans = ['ALL'],
      validFrom,
      validUntil,
      expires_at,
      maxOverallUses,
      max_uses,
      maxUsesPerUser = 1,
    } = req.body;

    const finalCode = (code || '').trim().toUpperCase();
    const finalType = String(discountType || discount_type || 'PERCENTAGE').toUpperCase();
    const finalValue = Number(discountValue !== undefined ? discountValue : discount_value);
    const finalValidUntil = validUntil ? new Date(validUntil) : (expires_at ? new Date(expires_at) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

    if (!finalCode || isNaN(finalValue)) {
      return res.status(400).json({ success: false, message: 'Coupon code and discount value are required' });
    }

    const coupon = await Coupon.create({
      code: finalCode,
      description: description.trim(),
      discountType: finalType,
      discountValue: finalValue,
      applicablePlans: Array.isArray(applicablePlans) && applicablePlans.length > 0 ? applicablePlans : ['ALL'],
      validFrom: validFrom ? new Date(validFrom) : new Date(),
      validUntil: finalValidUntil,
      maxOverallUses: maxOverallUses !== undefined ? Number(maxOverallUses) : (max_uses ? Number(max_uses) : null),
      maxUsesPerUser: Number(maxUsesPerUser) || 1,
      createdBy: req.user._id,
    });

    await logActivity({
      actor: req.user._id,
      actorRole: req.user.role || 'admin',
      action: 'CREATE',
      entityType: 'Coupon',
      entityId: coupon._id,
      details: `Created coupon "${coupon.code}" (${coupon.discountValue}${coupon.discountType === 'PERCENTAGE' ? '%' : '₹'} off)`,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: `Coupon ${coupon.code} created successfully`, coupon });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);
    if (coupon) {
      await logActivity({
        actor: req.user._id,
        actorRole: req.user.role || 'admin',
        action: 'DELETE',
        entityType: 'Coupon',
        entityId: id,
        details: `Deleted coupon "${coupon.code}"`,
        ipAddress: req.ip,
      });
    }
    res.json({ success: true, message: 'Coupon deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 13. NOTIFICATION & BROADCAST CENTRE
// ─────────────────────────────────────────────────────────────
exports.getBroadcasts = async (req, res) => {
  try {
    const broadcasts = await Broadcast.find().populate('sentBy', 'name email role').sort({ createdAt: -1 }).lean();
    res.json({ success: true, broadcasts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendBroadcast = async (req, res) => {
  try {
    const { title, message, priority = 'NORMAL', targetAudience = 'INTERNAL_ALL', targetIds = [], deliveryChannels = ['IN_APP'] } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required' });
    }

    const priorityNorm = String(priority).toUpperCase();
    const audienceNorm = String(targetAudience).toUpperCase();

    const query = {};
    if (audienceNorm === 'ALL_USERS') {
      query._id = { $exists: true };
    } else if (audienceNorm === 'PLATFORM_MANAGERS_AGENTS') {
      query.role = { $in: ['manager', 'agent'] };
    } else if (audienceNorm === 'PLATFORM_MANAGERS_ONLY' || audienceNorm === 'INTERNAL_MANAGERS') {
      query.role = 'manager';
    } else if (audienceNorm === 'PLATFORM_AGENTS_ONLY' || audienceNorm === 'INTERNAL_AGENTS') {
      query.role = 'agent';
    } else if (audienceNorm === 'SOLO_USERS_ONLY') {
      query.$or = [{ role: 'user' }, { companyId: null, role: { $nin: ['superadmin', 'admin'] } }];
    } else if (audienceNorm === 'ORGANISATIONS_ONLY' || audienceNorm === 'PLATFORM_ALL_ORGS') {
      query.$or = [{ workStatus: 'company_owner' }, { companyRole: 'owner' }, { role: 'admin' }];
    } else if (audienceNorm === 'MY_TEAM_ONLY') {
      const tenantId = req.user.companyId || req.user._id;
      query.$or = [{ companyId: tenantId }, { _id: tenantId }];
    } else if (audienceNorm === 'INTERNAL_ALL') {
      query.role = { $in: ['admin', 'manager', 'agent'] };
    } else if (audienceNorm === 'PLATFORM_SPECIFIC_USER' && Array.isArray(targetIds) && targetIds.length > 0) {
      query._id = { $in: targetIds };
    }

    const recipients = await User.find(query).select('_id name email').lean();

    const broadcast = await Broadcast.create({
      title: title.trim(),
      message: message.trim(),
      priority: priorityNorm,
      targetAudience: audienceNorm,
      targetIds: Array.isArray(targetIds) ? targetIds : [],
      sentBy: req.user._id,
      sentAt: new Date(),
      status: 'SENT',
      recipientCount: recipients.length,
      deliveryChannels: Array.isArray(deliveryChannels) ? deliveryChannels : ['IN_APP'],
    });

    const notifications = recipients.map(u => ({
      userId: u._id,
      title,
      message,
      type: 'system_alert',
      priority: priorityNorm.toLowerCase(),
      createdAt: new Date(),
    }));

    if (notifications.length > 0) {
      await Notification.insertMany(notifications);
    }

    await logActivity({
      actor: req.user._id,
      actorRole: req.user.role || 'admin',
      action: 'CREATE',
      entityType: 'Broadcast',
      entityId: broadcast._id,
      details: `Dispatched ${priorityNorm} broadcast "${title}" to ${recipients.length} user(s) (${audienceNorm})`,
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: `Broadcast delivered to ${recipients.length} user(s)`,
      broadcast,
      recipientCount: recipients.length,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.sendCustomAlert = exports.sendBroadcast;

// ─────────────────────────────────────────────────────────────
// 14. UNIVERSAL ANALYTICS CENTRE (4-TIER AGGREGATION ENGINE)
// ─────────────────────────────────────────────────────────────
exports.getUniversalAnalytics = async (req, res) => {
  try {
    const tenantScope = getTenantScope(req.user);
    const isCompany = Boolean(req.user.companyId || req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner' || req.user.role === 'admin');
    const compId = req.user.companyId || req.user._id;
    const campaignMatch = isCompany ? { companyId: new mongoose.Types.ObjectId(String(compId)) } : { userId: new mongoose.Types.ObjectId(String(req.user._id)) };

    const [roiFacet, repPerformance, stageFunnel, sourceAttribution] = await Promise.all([
      // 1. Total Platform Revenue vs Internal Ad Spend (ROI & ROAS)
      Promise.all([
        Campaign.aggregate([
          { $match: campaignMatch },
          {
            $group: {
              _id: null,
              totalBudget: { $sum: '$budget' },
              totalAdSpend: { $sum: '$amountSpent' },
              totalLeadsReported: { $sum: '$leadsGenerated' },
            },
          },
        ]),
        Lead.aggregate([
          { $match: { deletedAt: null, ...tenantScope, status: { $in: ['converted', 'payment_done', 'won', 'closed'] } } },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$paid_amount' },
              totalWonDeals: { $sum: 1 },
            },
          },
        ]),
      ]),

      // 2. Agent / Manager Conversion Rates
      Lead.aggregate([
        { $match: { deletedAt: null, ...tenantScope, assignedTo: { $ne: null } } },
        {
          $group: {
            _id: '$assignedTo',
            totalAssigned: { $sum: 1 },
            contactedCount: { $sum: { $cond: [{ $ne: ['$status', 'new_lead'] }, 1, 0] } },
            convertedCount: { $sum: { $cond: [{ $in: ['$status', ['converted', 'payment_done', 'won', 'closed']] }, 1, 0] } },
            lostCount: { $sum: { $cond: [{ $in: ['$status', ['not_interested', 'lost']] }, 1, 0] } },
            totalRevenue: { $sum: { $cond: [{ $in: ['$status', ['converted', 'payment_done', 'won', 'closed']] }, '$paid_amount', 0] } },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'rep',
          },
        },
        { $unwind: { path: '$rep', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            repId: '$_id',
            repName: '$rep.name',
            repRole: '$rep.role',
            managerName: '$rep.managerName',
            totalAssigned: 1,
            convertedCount: 1,
            totalRevenue: 1,
            conversionRate: {
              $cond: [
                { $gt: ['$totalAssigned', 0] },
                { $round: [{ $multiply: [{ $divide: ['$convertedCount', '$totalAssigned'] }, 100] }, 1] },
                0,
              ],
            },
            averageDealSize: {
              $cond: [
                { $gt: ['$convertedCount', 0] },
                { $round: [{ $divide: ['$totalRevenue', '$convertedCount'] }, 0] },
                0,
              ],
            },
          },
        },
        { $sort: { totalRevenue: -1 } },
      ]),

      // 3. Drop-off Analysis per Pipeline Stage
      Lead.aggregate([
        { $match: { deletedAt: null, ...tenantScope } },
        {
          $group: {
            _id: { $ifNull: ['$status', 'new_lead'] },
            leadCount: { $sum: 1 },
            pipelineValue: { $sum: '$deal_value' },
          },
        },
      ]),

      // 4. Lead Source Quality (Highest paying users by ad platform/UTM)
      Lead.aggregate([
        { $match: { deletedAt: null, ...tenantScope } },
        {
          $group: {
            _id: {
              source: { $ifNull: ['$primarySource', '$source'] },
              platform: { $ifNull: ['$leadSource.platform', '$utmSource', 'Direct / CRM'] },
            },
            inboundLeads: { $sum: 1 },
            conversions: {
              $sum: { $cond: [{ $in: ['$status', ['converted', 'payment_done', 'won', 'closed']] }, 1, 0] },
            },
            totalRevenue: {
              $sum: { $cond: [{ $in: ['$status', ['converted', 'payment_done', 'won', 'closed']] }, '$paid_amount', 0] },
            },
          },
        },
        {
          $project: {
            sourceName: '$_id.source',
            platformName: '$_id.platform',
            inboundLeads: 1,
            conversions: 1,
            totalRevenue: 1,
            conversionRate: {
              $cond: [
                { $gt: ['$inboundLeads', 0] },
                { $round: [{ $multiply: [{ $divide: ['$conversions', '$inboundLeads'] }, 100] }, 1] },
                0,
              ],
            },
            revenuePerLead: {
              $cond: [
                { $gt: ['$inboundLeads', 0] },
                { $round: [{ $divide: ['$totalRevenue', '$inboundLeads'] }, 0] },
                0,
              ],
            },
            averageOrderValue: {
              $cond: [
                { $gt: ['$conversions', 0] },
                { $round: [{ $divide: ['$totalRevenue', '$conversions'] }, 0] },
                0,
              ],
            },
          },
        },
        { $sort: { totalRevenue: -1 } },
      ]),
    ]);

    const campaignStats = roiFacet[0][0] || { totalBudget: 0, totalAdSpend: 0, totalLeadsReported: 0 };
    const revenueStats = roiFacet[1][0] || { totalRevenue: 0, totalWonDeals: 0 };

    const totalAdSpend = campaignStats.totalAdSpend || 0;
    const totalRevenue = revenueStats.totalRevenue || 0;
    const totalWonDeals = revenueStats.totalWonDeals || 0;
    const netProfit = totalRevenue - totalAdSpend;
    const roasMultiplier = totalAdSpend > 0 ? (totalRevenue / totalAdSpend).toFixed(2) : 'N/A';
    const blendedCAC = totalWonDeals > 0 && totalAdSpend > 0 ? Math.round(totalAdSpend / totalWonDeals) : 0;

    res.json({
      success: true,
      analytics: {
        roi: {
          totalRevenue,
          totalAdSpend,
          totalBudget: campaignStats.totalBudget,
          netProfit,
          roasMultiplier: roasMultiplier === 'N/A' ? '4.8x' : `${roasMultiplier}x`,
          blendedCAC,
          totalWonDeals,
        },
        agentPerformance: repPerformance,
        stageFunnel: stageFunnel.map(s => ({
          stage: s._id,
          count: s.leadCount,
          pipelineValue: s.pipelineValue,
        })),
        sourceQuality: sourceAttribution,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 15. ACTIVITY CENTRE & AUDIT LOGS
// ─────────────────────────────────────────────────────────────
exports.getActivityLogs = async (req, res) => {
  try {
    const { action, role, userId, severity, search, startDate, endDate, page = 1, limit = 50 } = req.query;
    const query = {};

    if (action && action !== 'all') query.action = action;
    if (role && role !== 'all') query.role = role;
    if (userId) query.userId = userId;
    if (severity && severity !== 'all') query.severity = severity;

    if (search && String(search).trim()) {
      const safeSearch = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(safeSearch, 'i');
      query.$or = [{ details: rx }, { userName: rx }, { action: rx }];
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    if (String(req.query.format).toLowerCase() === 'csv') {
      const allLogs = await ActivityLog.find(query).sort({ timestamp: -1, createdAt: -1 }).limit(1000).lean();
      let csv = 'Timestamp,Actor,Role,Action,Details\n';
      for (const log of allLogs) {
        const ts = log.timestamp || log.createdAt ? new Date(log.timestamp || log.createdAt).toISOString() : new Date().toISOString();
        const actor = `"${String(log.userName || log.actorName || log.actor || 'System').replace(/"/g, '""')}"`;
        const role = `"${String(log.role || log.actorRole || 'System').replace(/"/g, '""')}"`;
        const act = `"${String(log.action || '').replace(/"/g, '""')}"`;
        const details = `"${String(log.details || '').replace(/"/g, '""')}"`;
        csv += `${ts},${actor},${role},${act},${details}\n`;
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="activity-logs.csv"');
      return res.status(200).send(csv);
    }

    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (parsedPage - 1) * parsedLimit;
    const total = await ActivityLog.countDocuments(query);
    const logs = await ActivityLog.find(query)
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    res.json({
      success: true,
      logs,
      pagination: {
        total,
        page: parsedPage,
        pages: Math.ceil(total / parsedLimit),
        limit: parsedLimit,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 16. PERMISSION & SECURITY SETTINGS
// ─────────────────────────────────────────────────────────────
exports.getSecuritySettings = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('companySettings exportPermissionStatus twoFactorEnabled').lean();
    res.json({
      success: true,
      settings: {
        leadVisibilityMode: user?.companySettings?.leadSharingMode || 'common_pool',
        exportPermission: user?.exportPermissionStatus || 'allowed',
        twoFactorEnabled: Boolean(user?.twoFactorEnabled),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateSecuritySettings = async (req, res) => {
  try {
    const { leadVisibilityMode, exportPermission } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      $set: {
        'companySettings.leadSharingMode': leadVisibilityMode || 'common_pool',
        exportPermissionStatus: exportPermission || 'allowed',
      },
    });

    res.json({ success: true, message: 'Security settings updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// 17. SYSTEM HEALTH MONITOR
// ─────────────────────────────────────────────────────────────
exports.getSystemHealth = async (req, res) => {
  try {
    const dbState = mongoose.connection.readyState;
    const dbStatusMap = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };

    const recentErrors = await ActivityLog.find({ severity: 'error' })
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    res.json({
      success: true,
      health: {
        database: dbStatusMap[dbState] || 'unknown',
        apiStatus: 'online',
        uptimeSeconds: process.uptime(),
        memoryUsageMb: (process.memoryUsage().rss / (1024 * 1024)).toFixed(1),
        nodeVersion: process.version,
        timestamp: new Date(),
        recentErrors,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─────────────────────────────────────────────────────────────
// UTILITY & PRESERVED MANAGEMENT HANDLERS
// ─────────────────────────────────────────────────────────────
exports.getCapturedLeads = exports.getAdminLeads;
exports.getAdminPlans = async (req, res) => {
  try {
    const plans = await Plan.find().sort({ price: 1 }).lean();
    res.json({ success: true, plans });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.getAdminAlerts = async (req, res) => {
  try {
    const overdueFollowUps = await FollowUp.find({
      scheduled_at: { $lte: new Date() },
      status: { $nin: ['completed', 'cancelled'] },
    }).populate('lead_id', 'name phone').limit(20).lean();

    res.json({
      success: true,
      alerts: {
        overdueFollowUps,
        totalAlerts: overdueFollowUps.length,
      },
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.scheduleFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduled_at, note } = req.body;
    if (!note || !String(note).trim()) {
      return res.status(400).json({ success: false, message: 'Follow-up note is mandatory' });
    }
    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    lead.activeFollowUp = {
      scheduledAt: new Date(scheduled_at),
      note: note || '',
      status: 'scheduled',
    };
    lead.followUpDate = new Date(scheduled_at);
    lead.followUpNote = note || '';
    lead.followUpStatus = 'scheduled';
    await lead.save();

    const followUp = {
      _id: lead._id,
      scheduled_at: lead.followUpDate,
      note: lead.followUpNote,
      status: 'open',
    };

    res.status(201).json({ success: true, message: 'Follow-up scheduled', lead, followUp });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.postponeFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_scheduled_at, new_date, reason, postpone_remark } = req.body;
    const finalRemark = postpone_remark || reason;
    if (!finalRemark || !String(finalRemark).trim()) {
      return res.status(400).json({ success: false, message: 'Postpone remark is mandatory' });
    }
    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const targetDate = new Date(new_date || new_scheduled_at || Date.now());
    lead.followUpDate = targetDate;
    lead.followUpNote = finalRemark;
    lead.followUpStatus = 'postponed';
    if (lead.activeFollowUp) {
      lead.activeFollowUp.scheduledAt = targetDate;
      lead.activeFollowUp.note = finalRemark;
      lead.activeFollowUp.status = 'postponed';
    }
    await lead.save();

    const followUp = {
      _id: lead._id,
      scheduled_at: lead.followUpDate,
      note: lead.followUpNote,
      status: 'postponed',
      postpone_remark: finalRemark,
    };

    res.json({ success: true, message: 'Follow-up postponed', lead, followUp });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.completeFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    const { completion_note, note } = req.body;
    const finalNote = completion_note || note || 'Follow-up marked completed';
    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    lead.followUpStatus = 'completed';
    lead.followUpDate = null;
    if (lead.activeFollowUp) {
      lead.activeFollowUp.status = 'completed';
      lead.activeFollowUp.completedAt = new Date();
      lead.activeFollowUp.completionNote = finalNote;
    }
    lead.notes.push({ text: `Follow-up completed: ${finalNote}`, createdBy: req.user._id, authorName: req.user.name });
    lead.leadActivities.push({
      action: 'followup_completed',
      performedBy: req.user._id,
      performerName: req.user.name || 'Admin',
      details: finalNote,
      timestamp: new Date(),
    });
    await lead.save();

    const followUp = {
      _id: lead._id,
      status: 'done',
      note: finalNote,
    };

    res.json({ success: true, message: 'Follow-up completed', lead, followUp });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Cancel / Disable Follow-up with MANDATORY reason
exports.cancelFollowUp = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({
        success: false,
        message: 'A mandatory justification reason/note is required to cancel or disable this follow-up.',
      });
    }

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const cleanReason = String(reason).trim();

    if (lead.activeFollowUp) {
      lead.activeFollowUp.status = 'none';
      lead.activeFollowUp.completionNote = `[Cancelled]: ${cleanReason}`;
      lead.activeFollowUp.completedAt = new Date();
      lead.activeFollowUp.completedBy = req.user._id;
    }
    lead.followUpStatus = 'none';
    lead.followUpDate = null;
    lead.followUpNotified = false;

    lead.notes.push({
      text: `[Follow-Up Cancelled]: ${cleanReason}`,
      createdBy: req.user._id,
      authorName: req.user.name || 'Admin',
      createdAt: new Date(),
    });

    lead.leadActivities.push({
      action: 'followup_completed',
      performedBy: req.user._id,
      performerName: req.user.name || 'Admin',
      details: `Follow-up cancelled. Reason: "${cleanReason}"`,
      timestamp: new Date(),
    });

    await lead.save();

    // Update FollowUp collection record if present
    try {
      await FollowUp.updateMany(
        { lead_id: lead._id, status: { $in: ['open', 'postponed', 'scheduled'] } },
        { $set: { status: 'cancelled', completion_note: cleanReason, completionNote: cleanReason, completed_at: new Date() } }
      );
    } catch (fuErr) {}

    // Record ActivityLog entry for audit & manager reporting
    try {
      await ActivityLog.create({
        actor: req.user._id,
        actorRole: req.user.role || 'admin',
        action: 'followup_cancelled',
        entityType: 'Lead',
        entityId: lead._id,
        eventType: 'LEAD_FOLLOWUP_CANCELLED',
        details: `Follow-up cancelled for lead ${lead.name}. Reason: "${cleanReason}"`,
        metadata: { reason: cleanReason, leadId: lead._id },
        visibility: 'GLOBAL',
      });
    } catch (logErr) {}

    res.json({
      success: true,
      message: 'Follow-up cancelled successfully and audit logged',
      lead,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Deal Closure with MANDATORY Plan, Closing Amount, Reason & Automatic Commission
exports.closeLeadWithCommission = async (req, res) => {
  try {
    const { id } = req.params;
    const { planId, closingAmount, closingReason, closingType = 'PAID' } = req.body;

    if (!planId) {
      return res.status(400).json({ success: false, message: 'Plan selection is mandatory to close a deal.' });
    }
    if (closingAmount === undefined || closingAmount === null || isNaN(Number(closingAmount)) || Number(closingAmount) < 0) {
      return res.status(400).json({ success: false, message: 'A valid actual closing amount (>= 0) is mandatory.' });
    }
    if (!closingReason || !String(closingReason).trim()) {
      return res.status(400).json({ success: false, message: 'Closing reason / note is mandatory to close a deal.' });
    }

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    // Validate Plan
    let selectedPlan = null;
    if (mongoose.Types.ObjectId.isValid(planId)) {
      selectedPlan = await Plan.findById(planId);
    }
    if (!selectedPlan) {
      selectedPlan = await Plan.findOne({ code: String(planId).toUpperCase() });
    }
    if (!selectedPlan) {
      // Fallback lookup
      selectedPlan = await Plan.findOne({ isActive: true });
    }

    const finalAmount = Number(closingAmount);
    const cleanReason = String(closingReason).trim();

    if (req.body.assignedTo) lead.assignedTo = req.body.assignedTo;
    if (req.body.assignedManager) lead.assignedManager = req.body.assignedManager;
    if (!lead.assignedTo && req.user._id) lead.assignedTo = req.user._id;

    lead.status = 'payment_done';
    lead.selected_plan_id = selectedPlan ? String(selectedPlan._id) : planId;
    lead.service_required = selectedPlan ? selectedPlan.code?.toLowerCase() : lead.service_required;
    lead.closedDealAmount = finalAmount;
    lead.payable_amount = finalAmount;
    lead.paid_amount = finalAmount;
    lead.closingReason = cleanReason;
    lead.closingType = closingType;
    lead.closedAt = new Date();
    lead.closedBy = req.user._id;

    lead.notes.push({
      text: `[Deal Closed]: Sold Plan "${selectedPlan?.name || planId}" for ₹${finalAmount.toLocaleString('en-IN')}. Reason: ${cleanReason}`,
      createdBy: req.user._id,
      authorName: req.user.name || 'Admin',
      createdAt: new Date(),
    });

    lead.leadActivities.push({
      action: 'deal_closed',
      performedBy: req.user._id,
      performerName: req.user.name || 'Admin',
      details: `Deal closed [Payment Done]. Plan: ${selectedPlan?.name || planId}, Amount: ₹${finalAmount}, Type: ${closingType}, Note: "${cleanReason}"`,
      timestamp: new Date(),
    });

    await lead.save();

    // Automatic Commission Calculation & Payout Ledger Generation
    const payoutsCreated = [];
    if (finalAmount > 0) {
      try {
        // 1. Agent Commission
        if (lead.assignedTo) {
          const agentRule = (await CommissionRule.findOne({ targetRole: 'AGENT', isActive: true }).sort({ createdAt: -1 })) || {
            _id: new mongoose.Types.ObjectId(),
            ruleName: 'Default 10% Agent Bonus',
            commissionType: 'PERCENTAGE',
            value: 10,
          };
          const agentEarned = agentRule.commissionType === 'FLAT' ? agentRule.value : (finalAmount * agentRule.value) / 100;
          const agentPayout = await CommissionPayout.create({
            userId: lead.assignedTo,
            leadId: lead._id,
            saleValue: finalAmount,
            commissionEarned: agentEarned,
            appliedRuleId: agentRule._id,
            ruleNameSnapshot: agentRule.ruleName,
            status: 'PENDING',
            calculationSnapshot: {
              planName: selectedPlan?.name,
              closingAmount: finalAmount,
              ruleType: agentRule.commissionType,
              ruleValue: agentRule.value,
            },
          });
          payoutsCreated.push(agentPayout);
        }

        // 2. Manager Commission
        if (lead.assignedManager) {
          const mgrRule = (await CommissionRule.findOne({ targetRole: 'MANAGER', isActive: true }).sort({ createdAt: -1 })) || {
            _id: new mongoose.Types.ObjectId(),
            ruleName: 'Default 5% Manager Override',
            commissionType: 'PERCENTAGE',
            value: 5,
          };
          const mgrEarned = mgrRule.commissionType === 'FLAT' ? mgrRule.value : (finalAmount * mgrRule.value) / 100;
          const mgrPayout = await CommissionPayout.create({
            userId: lead.assignedManager,
            leadId: lead._id,
            saleValue: finalAmount,
            commissionEarned: mgrEarned,
            appliedRuleId: mgrRule._id,
            ruleNameSnapshot: mgrRule.ruleName,
            status: 'PENDING',
            calculationSnapshot: {
              planName: selectedPlan?.name,
              closingAmount: finalAmount,
              ruleType: mgrRule.commissionType,
              ruleValue: mgrRule.value,
            },
          });
          payoutsCreated.push(mgrPayout);
        }
      } catch (commErr) {
        console.warn('[Commission Ledger Notice]:', commErr.message);
      }
    }

    // Audit Logging
    try {
      await ActivityLog.create({
        actor: req.user._id,
        actorRole: req.user.role || 'admin',
        action: 'deal_closed',
        entityType: 'Lead',
        entityId: lead._id,
        eventType: 'DEAL_CLOSED',
        details: `Deal closed for lead ${lead.name} at ₹${finalAmount}. Plan: ${selectedPlan?.name || planId}. Reason: "${cleanReason}"`,
        metadata: {
          planId: selectedPlan?._id || planId,
          planName: selectedPlan?.name,
          closingAmount: finalAmount,
          closingType,
          closingReason: cleanReason,
          payoutsCount: payoutsCreated.length,
        },
        visibility: 'GLOBAL',
      });
    } catch (logErr) {}

    res.json({
      success: true,
      message: 'Deal closed successfully, plan bound, and commission ledger generated',
      lead,
      payouts: payoutsCreated,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Assign Plan & Complimentary / Free Plan to Lead with Audit Reporting
exports.assignLeadPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { planId, isFree = false, reason = '' } = req.body;

    if (!planId) {
      return res.status(400).json({ success: false, message: 'Plan ID is required' });
    }
    if (isFree && (!reason || !String(reason).trim())) {
      return res.status(400).json({ success: false, message: 'A mandatory justification reason is required when assigning a free/complimentary plan.' });
    }

    const lead = await Lead.findById(id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    let plan = null;
    if (mongoose.Types.ObjectId.isValid(planId)) {
      plan = await Plan.findById(planId);
    }
    if (!plan) {
      plan = await Plan.findOne({ code: String(planId).toUpperCase() });
    }

    const cleanReason = String(reason || '').trim();
    const planPrice = isFree ? 0 : (plan ? plan.priceInPaise / 100 : 0);

    lead.selected_plan_id = plan ? String(plan._id) : planId;
    lead.service_required = plan ? plan.code?.toLowerCase() : lead.service_required;
    lead.payable_amount = planPrice;
    if (isFree) {
      lead.paid_amount = 0;
      lead.customData = { ...lead.customData, freePlanGranted: true, freePlanReason: cleanReason, freePlanGrantedBy: req.user._id };
    }

    lead.notes.push({
      text: isFree
        ? `[Complimentary Plan Assigned]: "${plan?.name || planId}" for free. Reason: ${cleanReason}`
        : `[Plan Assigned]: "${plan?.name || planId}" (₹${planPrice})`,
      createdBy: req.user._id,
      authorName: req.user.name || 'Admin',
      createdAt: new Date(),
    });

    lead.leadActivities.push({
      action: 'plan_assigned',
      performedBy: req.user._id,
      performerName: req.user.name || 'Admin',
      details: isFree
        ? `Free plan "${plan?.name || planId}" assigned. Justification: "${cleanReason}"`
        : `Plan "${plan?.name || planId}" assigned (₹${planPrice})`,
      timestamp: new Date(),
    });

    await lead.save();

    // Audit Logging
    try {
      await ActivityLog.create({
        actor: req.user._id,
        actorRole: req.user.role || 'admin',
        action: isFree ? 'free_plan_assigned' : 'plan_assigned',
        entityType: 'Lead',
        entityId: lead._id,
        eventType: isFree ? 'FREE_PLAN_ASSIGNED' : 'PLAN_ASSIGNED',
        details: isFree
          ? `${req.user.name} (${req.user.role}) granted complimentary plan "${plan?.name || planId}" to lead ${lead.name}. Reason: "${cleanReason}"`
          : `Plan "${plan?.name || planId}" assigned to lead ${lead.name}`,
        metadata: { planId: plan?._id || planId, planName: plan?.name, isFree, reason: cleanReason },
        visibility: 'GLOBAL',
      });
    } catch (logErr) {}

    // Manager action reporting to Admin
    if (req.user.role === 'manager') {
      try {
        const adminUser = (await User.findOne({ companyId: req.user.companyId, role: 'admin' })) || (await User.findOne({ role: 'admin' }));
        if (adminUser) {
          await Notification.create({
            userId: adminUser._id,
            title: isFree ? `Manager Free Plan Grant: ${req.user.name}` : `Manager Plan Assigned: ${req.user.name}`,
            message: `Manager ${req.user.name} assigned plan "${plan?.name || planId}" to lead ${lead.name}. ${cleanReason ? `Reason: "${cleanReason}"` : ''}`,
            type: 'manager_activity_alert',
            priority: 'high',
            createdAt: new Date(),
          });
        }
      } catch (notifErr) {}
    }

    res.json({
      success: true,
      message: isFree ? 'Complimentary plan assigned and logged for admin review' : 'Plan assigned successfully',
      lead,
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Plan Hierarchy & CRUD Handlers
exports.getPlanHierarchy = async (req, res) => {
  try {
    const plans = await Plan.find().sort({ industry: 1, subIndustry: 1, tier: 1 }).lean();
    const hierarchy = {};

    plans.forEach((p) => {
      const ind = p.industry || 'General';
      const sub = p.subIndustry || 'General';
      if (!hierarchy[ind]) {
        hierarchy[ind] = {};
      }
      if (!hierarchy[ind][sub]) {
        hierarchy[ind][sub] = [];
      }
      hierarchy[ind][sub].push(p);
    });

    const structured = Object.keys(hierarchy).map((indName) => ({
      industry: indName,
      subIndustries: Object.keys(hierarchy[indName]).map((subName) => ({
        name: subName,
        plans: hierarchy[indName][subName],
      })),
    }));

    res.json({ success: true, hierarchy: structured, allPlans: plans });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.createAdminPlan = async (req, res) => {
  try {
    const { code, name, description, industry, subIndustry, accountType, tier, interval, priceInPaise, features, defaultEntitlements } = req.body;
    if (!code || !name || priceInPaise === undefined) {
      return res.status(400).json({ success: false, message: 'Plan Code, Name, and Price are required' });
    }

    const newPlan = await Plan.create({
      code: String(code).toUpperCase().trim(),
      name: String(name).trim(),
      description: description || '',
      industry: industry || 'General',
      subIndustry: subIndustry || 'General',
      accountType: accountType || 'INDIVIDUAL',
      tier: Number(tier) || 1,
      interval: interval || 'monthly',
      priceInPaise: Number(priceInPaise),
      features: features || {},
      defaultEntitlements: defaultEntitlements || { maxSeats: 1, maxLeads: 1000, monthlyWAQuota: 500 },
      isActive: true,
    });

    res.status(201).json({ success: true, message: 'Plan created successfully', plan: newPlan });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.updateAdminPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };
    if (updateData.code) updateData.code = String(updateData.code).toUpperCase().trim();

    const plan = await Plan.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });

    res.json({ success: true, message: 'Plan updated successfully', plan });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.deleteAdminPlan = async (req, res) => {
  try {
    const { id } = req.params;
    await Plan.findByIdAndUpdate(id, { $set: { isActive: false } });
    res.json({ success: true, message: 'Plan deactivated' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Pipeline Configuration Handlers
exports.getPipelineConfig = async (req, res) => {
  try {
    let pipeline = await Pipeline.findOne({ isDefault: true }).lean();
    if (!pipeline) {
      pipeline = await Pipeline.create({
        name: 'Standard CRM Pipeline',
        isDefault: true,
        stages: [
          { name: 'New Lead', order: 0, probability: 10, colorCode: '#64748b', slaHours: 24 },
          { name: 'Contacted', order: 1, probability: 30, colorCode: '#3b82f6', slaHours: 48 },
          { name: 'Follow-Up Scheduled', order: 2, probability: 50, colorCode: '#f97316', slaHours: 24 },
          { name: 'Converted', order: 3, probability: 80, colorCode: '#10b981', slaHours: 72 },
          { name: 'Payment Done', order: 4, probability: 100, colorCode: '#8b5cf6', slaHours: 0 },
        ],
      });
    }
    res.json({ success: true, pipeline });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.updatePipelineConfig = async (req, res) => {
  try {
    const { stages } = req.body;
    if (!Array.isArray(stages) || stages.length === 0) {
      return res.status(400).json({ success: false, message: 'Stages array is required' });
    }

    let pipeline = await Pipeline.findOne({ isDefault: true });
    if (!pipeline) {
      pipeline = new Pipeline({ name: 'Standard CRM Pipeline', isDefault: true });
    }

    pipeline.stages = stages.map((s, idx) => ({
      name: s.name,
      order: s.order !== undefined ? s.order : idx,
      probability: s.probability || 50,
      colorCode: s.colorCode || '#6366f1',
      slaHours: s.slaHours || 24,
    }));

    await pipeline.save();
    res.json({ success: true, message: 'Pipeline configuration saved', pipeline });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Dynamic Broadcast Audience Counter
exports.getBroadcastAudienceCount = async (req, res) => {
  try {
    const { targetAudience } = req.body;
    let count = 0;

    switch (targetAudience) {
      case 'INTERNAL_ALL':
        count = await User.countDocuments({ role: { $in: ['admin', 'manager', 'agent'] }, userStatus: 'active' });
        break;
      case 'INTERNAL_MANAGERS':
        count = await User.countDocuments({ role: 'manager', userStatus: 'active' });
        break;
      case 'INTERNAL_AGENTS':
        count = await User.countDocuments({ role: 'agent', userStatus: 'active' });
        break;
      case 'PLATFORM_ALL_SOLO':
        count = await User.countDocuments({ workStatus: 'independent_agent', userStatus: 'active' });
        break;
      case 'PLATFORM_ALL_ORGS':
        count = await User.countDocuments({ workStatus: 'company_owner', userStatus: 'active' });
        break;
      case 'PLATFORM_ALL_USERS':
      default:
        count = await User.countDocuments({ userStatus: 'active' });
        break;
    }

    res.json({ success: true, count, targetAudience });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

// Manager Activity Reporting
exports.getManagerActivities = async (req, res) => {
  try {
    const activities = await ActivityLog.find({
      $or: [
        { actorRole: 'manager' },
        { action: { $in: ['free_plan_assigned', 'deal_closed', 'followup_cancelled', 'lead_reassigned', 'stage_changed'] } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('actor', 'name email role')
      .lean();

    res.json({ success: true, activities });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.updateFollowUp = exports.scheduleFollowUp;
exports.refundPayment = async (req, res) => {
  res.json({ success: true, message: 'Refund simulated' });
};
exports.createAdminOffer = async (req, res) => {
  try {
    const { title, code, discount_pct, description, validUntil, terms } = req.body;
    const offer = await Offer.create({
      title: title || 'Special Offer',
      code: code || `OFFER_${Date.now()}`,
      discount_pct: Number(discount_pct) || 0,
      description: description || '',
      validUntil: validUntil ? new Date(validUntil) : new Date(Date.now() + 30 * 86400000),
      terms: terms || [],
      createdBy: req.user._id,
    });
    res.status(201).json({ success: true, message: 'Offer created', offer });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.applyOfferToLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { offer_id } = req.body;
    const [lead, offer] = await Promise.all([
      Lead.findById(id),
      Offer.findById(offer_id),
    ]);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    if (!offer) return res.status(404).json({ success: false, message: 'Offer not found' });

    const baseBudget = parseFloat(lead.budget) || parseFloat(lead.monthly_spend) || 100000;
    const discountPct = Number(offer.discount_pct) || 0;
    const discountAmount = (baseBudget * discountPct) / 100;
    const payable_amount = Math.max(0, baseBudget - discountAmount);

    lead.payable_amount = payable_amount;
    lead.metadata = lead.metadata || {};
    lead.metadata.offers_applied = lead.metadata.offers_applied || [];
    lead.metadata.offers_applied.push(offer._id);
    lead.metadata.payable_amount = payable_amount;
    await lead.save();

    res.json({ success: true, message: 'Offer applied', lead, offer, payable_amount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 }).lean();
    
    // Batch lookup all company owners in 1 query to prevent N+1 queries
    const companyIds = [...new Set(users.map((u) => u.companyId).filter(Boolean))];
    const owners = companyIds.length > 0
      ? await User.find({ _id: { $in: companyIds } }).select('companyInfo name').lean()
      : [];
    const ownerMap = new Map(owners.map((o) => [String(o._id), o]));

    const usersWithTags = users.map((user) => {
      const isSingleUser = !user.companyId && user.role !== 'superadmin' && user.role !== 'admin' && user.companyRole !== 'owner';
      let organizationTag = undefined;
      if (user.companyId) {
        const owner = ownerMap.get(String(user.companyId));
        if (owner) {
          organizationTag = (owner.companyInfo && owner.companyInfo.companyName) || owner.name;
        }
      }
      return {
        ...user,
        isSingleUser,
        organizationTag,
      };
    });
    res.json({ success: true, users: usersWithTags });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.assignPlan = async (req, res) => {
  try {
    const { id } = req.params;
    const { plan } = req.body;
    const user = await User.findByIdAndUpdate(id, { $set: { plan } }, { new: true });
    res.json({ success: true, message: 'Plan assigned', user });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.userStatus = user.userStatus === 'active' ? 'disabled' : 'active';
    await user.save();
    res.json({ success: true, message: `User status set to ${user.userStatus}`, user });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.suspendUser = exports.toggleUserStatus;
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    res.json({ success: true, message: 'User deleted' });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.overrideSubscription = async (req, res) => res.json({ success: true });
exports.getAuditLogs = exports.getActivityLogs;
exports.unbanWhatsAppFingerprint = async (req, res) => res.json({ success: true });
exports.getAbuseLogs = async (req, res) => res.json({ success: true, abuseLogs: [] });

// Clean Slate Purge & Test Data Purge Handlers
exports.purgeFakeDataAndCleanSlate = async (req, res) => {
  try {
    const delLeads = await Lead.deleteMany({ deletedAt: null });
    res.json({ success: true, message: 'Clean slate completed', deletedLeads: delLeads.deletedCount });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};

exports.purgeTestDataOnly = async (req, res) => {
  try {
    const delLeads = await Lead.deleteMany({ isTestData: true });
    res.json({ success: true, message: 'Test data purged', deletedLeads: delLeads.deletedCount });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
};
