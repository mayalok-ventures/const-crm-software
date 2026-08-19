const Lead = require('../models/Lead');
const User = require('../models/User');
const Notification = require('../models/Notification');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');
const csv = require('csv-parser');
const { Readable } = require('stream');

// Helper to construct query respecting Company Lead Sharing Mode & Common Pool
const buildLeadPermissionQuery = async (user) => {
  if (user.role === 'superadmin' || user.isAdmin) {
    // SuperAdmin has universal master access across all platform leads
    return {};
  }

  const isOwner = user.workStatus === 'company_owner' || user.companyRole === 'owner';
  const companyId = isOwner ? user._id : user.companyId;

  if (!companyId) {
    // Platform Solo / Team Agent: Can access assigned leads, created leads, OR common pool unassigned leads
    return {
      $or: [
        { assignedTo: user._id },
        { userId: user._id },
        { assignedTo: null },
        { assignedTo: { $exists: false } }
      ]
    };
  }

  // Fetch company settings
  const company = await User.findById(companyId).select('companySettings').lean();
  const sharingMode = company?.companySettings?.leadSharingMode || 'common_pool';

  if (isOwner || sharingMode === 'common_pool') {
    // Company owner OR common pool: sees all leads across the agency
    return {
      $or: [
        { companyId },
        { userId: companyId },
        { userId: user._id },
        { assignedTo: null }
      ]
    };
  }

  // Assigned mode for sub-agents: assigned to them, created by them, OR unassigned in company pool
  return {
    $or: [
      { assignedTo: user._id },
      { userId: user._id },
      { assignedTo: null, companyId },
      { assignedTo: { $exists: false }, companyId }
    ]
  };
};

// @desc  Get all leads (paginated, filtered, team-aware)
// @route GET /api/leads
// @access Private
exports.getLeads = async (req, res) => {
  try {
    const { page = 1, limit = 50, status, tag, search, projectId, assignedTo } = req.query;

    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const query = { $and: [ basePermissionQuery ] };

    if (status) query.status = status;
    if (tag) query.tags = tag;
    if (projectId) query.projectId = projectId;
    if (assignedTo) query.assignedTo = assignedTo;
    if (search && search.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$and.push({
        $or: [
          { name: new RegExp(safeSearch, 'i') },
          { phone: new RegExp(safeSearch, 'i') },
          { company: new RegExp(safeSearch, 'i') },
          { project: new RegExp(safeSearch, 'i') },
          { location: new RegExp(safeSearch, 'i') },
        ]
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const cap = Math.min(parseInt(limit), 100);

    const [leads, total] = await Promise.all([
      Lead.find(query)
        .populate('projectId', 'name location basePrice city')
        .populate('assignedTo', 'name usercode email')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(cap)
        .lean(),
      Lead.countDocuments(query),
    ]);

    res.json({
      leads,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / cap),
        limit: cap,
      },
    });
  } catch (error) {
    console.error('getLeads error:', error);
    res.status(500).json({ message: 'Server error fetching leads' });
  }
};

// @desc  Get single lead with activity audit trail
// @route GET /api/leads/:id
// @access Private
exports.getLead = async (req, res) => {
  try {
    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const lead = await Lead.findOne({ _id: req.params.id, ...basePermissionQuery })
      .populate('projectId')
      .populate('assignedTo', 'name usercode email')
      .lean();

    if (!lead) return res.status(404).json({ message: 'Lead not found or unauthorized' });
    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get leads with follow-up today
// @route GET /api/leads/follow-ups/today
// @access Private
exports.getTodayFollowUps = async (req, res) => {
  try {
    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const leads = await Lead.find({
      ...basePermissionQuery,
      followUpDate: { $gte: start, $lte: end },
    })
    .populate('projectId', 'name location')
    .sort({ followUpDate: 1 })
    .lean();

    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Get due / overdue follow-ups (followUpDate <= now and status not closed/lost)
// @route GET /api/leads/follow-ups/due
// @access Private
exports.getDueFollowUps = async (req, res) => {
  try {
    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const now = new Date();

    const leads = await Lead.find({
      ...basePermissionQuery,
      followUpDate: { $lte: now },
      status: {
        $nin: [
          'closed', 'lost', 'Closed', 'Lost',
          'Closed / Won', 'Lost / Dropped', 'payment_done'
        ]
      },
    })
    .populate('projectId', 'name location')
    .populate('assignedTo', 'name usercode email')
    .sort({ followUpDate: 1 })
    .limit(50)
    .lean();

    res.json(leads);
  } catch (error) {
    console.error('getDueFollowUps error:', error);
    res.status(500).json({ message: 'Server error fetching due follow-ups' });
  }
};

// @desc  Get unique tags
// @route GET /api/leads/tags
// @access Private
exports.getTags = async (req, res) => {
  try {
    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const leads = await Lead.find(basePermissionQuery).select('tags').lean();
    const tagSet = new Set();
    leads.forEach(l => (l.tags || []).forEach(t => tagSet.add(t)));
    res.json([...tagSet]);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Create real estate lead with activity logging
// @route POST /api/leads
// @access Private
exports.createLead = async (req, res) => {
  try {
    const {
      name, phone, email, company, tags, status, source, followUpDate,
      location, profession, budget, areasOfInterest, project, projectId,
      propertyType, siteVisitDate, assignedTo,
      utmCampaign, utmMedium, utmSource, lostReason, lostReasonDetail
    } = req.body;

    if (!name || !phone) return res.status(400).json({ message: 'Name and phone are required' });

    const isFollowUpMandatory = req.user.showFollowUpOnCreate !== false && req.user.preferences?.showFollowUpOnCreate !== false;
    if (isFollowUpMandatory && !followUpDate) {
      return res.status(400).json({ message: 'Next follow-up date is mandatory' });
    }

    const cleanPhone = phone.replace(/\D/g, '');

    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    const companyId = req.user.companyId || (isOwner ? req.user._id : null);

    // Multi-tenant Phone duplicate check (Company level when attached, or solo user level)
    const duplicateQuery = companyId
      ? { companyId, phone: cleanPhone }
      : { userId: req.user._id, phone: cleanPhone };

    const phoneExists = await Lead.findOne(duplicateQuery);
    if (phoneExists) {
      return res.status(409).json({
        message: companyId
          ? "This phone number already exists in your company's database."
          : "A lead with this phone number already exists in your pipeline.",
        code: 'DUPLICATE_PHONE',
      });
    }

    // Plan limits check (Handles Solo, Organization, and Free tiers)
    const { PLAN_LIMITS } = require('../utils/planLimits');
    const lifecycle = req.user.subscriptionLifecycle;
    const effectivePlan = lifecycle?.effectivePlan || req.user.plan || 'free';
    const limits = PLAN_LIMITS[effectivePlan];
    const maxLeads = limits?.maxLeads ?? 10;

    if (maxLeads !== Infinity) {
      const query = isOwner
        ? { companyId: req.user._id }
        : (req.user.companyRole === 'agent' && req.user.companyId
          ? { companyId: req.user.companyId }
          : { userId: req.user._id });

      const count = await Lead.countDocuments(query);
      if (count >= maxLeads) {
        return res.status(403).json({
          code: 'LIMIT_REACHED',
          message: `You have reached the maximum limit of ${maxLeads} leads on the ${limits?.name || effectivePlan} plan. Please upgrade to add more leads.`,
          currentCount: count,
          maxLeads,
        });
      }
    }

    let assignedAgentName = '';
    if (assignedTo) {
      const assignedUser = await User.findById(assignedTo).select('name');
      if (assignedUser) assignedAgentName = assignedUser.name;
    }

    const systemKeys = new Set([
      'name', 'phone', 'email', 'company', 'tags', 'status', 'source', 'followUpDate',
      'location', 'profession', 'budget', 'areasOfInterest', 'project', 'projectId',
      'propertyType', 'siteVisitDate', 'assignedTo', 'customData', 'closedDealAmount',
      'utmCampaign', 'utmMedium', 'utmSource', 'lostReason', 'lostReasonDetail'
    ]);

    const extraCustomData = {};
    for (const key of Object.keys(req.body)) {
      if (!systemKeys.has(key)) {
        extraCustomData[key] = req.body[key];
      }
    }

    const finalCustomData = {
      ...(typeof req.body.customData === 'object' ? req.body.customData : {}),
      ...extraCustomData,
    };

    const firstStage = (req.user.pipelineStages && req.user.pipelineStages[0]) || (req.user.customPipelineStages && req.user.customPipelineStages[0]) || 'new_lead';

    const lead = await Lead.create({
      userId: req.user._id,
      companyId,
      assignedTo: assignedTo || (req.user.companyRole === 'agent' ? req.user._id : null),
      assignedToName: assignedAgentName || (req.user.companyRole === 'agent' ? req.user.name : ''),
      name: name.trim(),
      phone: cleanPhone,
      email: email ? email.toLowerCase().trim() : undefined,
      company: company || undefined,
      tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []),
      status: status || firstStage,
      propertyType: propertyType || '',
      budget: budget || '',
      location: location || '',
      profession: profession || '',
      project: project || '',
      projectId: projectId || null,
      siteVisitDate: siteVisitDate ? new Date(siteVisitDate) : null,
      areasOfInterest: Array.isArray(areasOfInterest) ? areasOfInterest : (areasOfInterest ? areasOfInterest.split(',').map(a => a.trim()).filter(Boolean) : []),
      followUpDate: followUpDate ? new Date(followUpDate) : null,
      customData: finalCustomData,
      source: source || 'manual',
      utmCampaign: utmCampaign || '',
      utmMedium: utmMedium || '',
      utmSource: utmSource || '',
      lostReason: lostReason || '',
      lostReasonDetail: lostReasonDetail || '',
      leadActivities: [{
        action: 'lead_created',
        performedBy: req.user._id,
        performerName: req.user.name,
        details: `Lead created in CRM pipeline by ${req.user.name}`,
        timestamp: new Date(),
      }],
    });

    res.status(201).json(lead);
  } catch (error) {
    console.error('createLead error:', error);
    if (error.code === 11000 || error.message?.includes('E11000')) {
      return res.status(409).json({
        message: "This phone number already exists in your company's database.",
        code: 'DUPLICATE_PHONE',
      });
    }
    res.status(500).json({ message: error.message || 'Failed to create lead' });
  }
};

// @desc  Update lead & log immutable audit activities
// @route PUT /api/leads/:id
// @access Private
exports.updateLead = async (req, res) => {
  try {
    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const lead = await Lead.findOne({ _id: req.params.id, ...basePermissionQuery });

    if (!lead) return res.status(404).json({ message: 'Lead not found or unauthorized' });

    const changes = {};
    const activitiesToAdd = [];

    // Enforce Mandatory Payment Amount and Payment Method when moving to converted or payment_done
    const incomingStatus = req.body.status !== undefined ? req.body.status : lead.status;
    const isConverting = ['converted', 'payment_done', 'closed', 'Closed', 'Closed / Won'].includes(incomingStatus);
    if (isConverting) {
      const rawAmt = req.body.paymentAmount !== undefined ? req.body.paymentAmount : (req.body.payment_amount !== undefined ? req.body.payment_amount : (req.body.closedDealAmount !== undefined ? req.body.closedDealAmount : lead.paid_amount));
      const rawMethod = req.body.paymentMethod || req.body.payment_method || lead.payment_method;

      const paymentAmount = Number(rawAmt);
      if (!paymentAmount || isNaN(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({
          success: false,
          code: 'PAYMENT_AMOUNT_REQUIRED',
          message: 'paymentAmount is strictly mandatory and must be greater than 0 when moving to converted / payment_done.',
        });
      }

      if (!rawMethod || !String(rawMethod).trim()) {
        return res.status(400).json({
          success: false,
          code: 'PAYMENT_METHOD_REQUIRED',
          message: 'paymentMethod is strictly mandatory when moving to converted / payment_done.',
        });
      }

      req.body.paid_amount = paymentAmount;
      req.body.payable_amount = paymentAmount;
      req.body.closedDealAmount = paymentAmount;
      req.body.payment_method = String(rawMethod).trim();

      // Atomically create Payment record
      const Payment = require('../models/Payment');
      const existingPayment = await Payment.findOne({ lead_id: lead._id, amount: paymentAmount, status: 'completed' });
      if (!existingPayment) {
        await Payment.create({
          lead_id: lead._id,
          leadId: lead._id,
          agent_id: lead.assignedTo || req.user._id,
          agentId: lead.assignedTo || req.user._id,
          amount: paymentAmount,
          method: String(rawMethod).trim(),
          transaction_id: req.body.transaction_id || `TXN-MANUAL-${Date.now()}`,
          status: 'completed',
          verified_by_agent: true,
          verified_at: new Date(),
        }).catch(err => console.warn('[Payment] Manual payment record warning:', err.message));
      }
    }

    // Enforce Mandatory Postpone Remark when delaying/postponing an existing follow-up
    if (req.body.followUpDate) {
      const newFollowUpDate = new Date(req.body.followUpDate);
      if (lead.followUpDate && newFollowUpDate.getTime() > new Date(lead.followUpDate).getTime()) {
        const postponeRemark = req.body.postponeRemark || req.body.postpone_remark || req.body.remark;
        if (!postponeRemark || !String(postponeRemark).trim()) {
          return res.status(400).json({
            success: false,
            code: 'POSTPONE_REMARK_REQUIRED',
            message: 'postponeRemark is strictly required explaining why the follow-up is postponed.',
          });
        }
        lead.notes.push({
          text: `[Follow-Up Postponed to ${newFollowUpDate.toLocaleString()}]: ${String(postponeRemark).trim()}`,
          createdBy: req.user._id,
          authorName: req.user.name || 'Agent',
          createdAt: new Date(),
        });
      }
    }

    // Enforce Mandatory Lost Reason when moving to Lost/Dropped
    const isLost = ['lost', 'dead', 'not converted', 'dropped', 'closed lost', 'not_interested'].includes(String(incomingStatus).toLowerCase());
    if (isLost) {
      const lostReason = req.body.lostReason !== undefined ? req.body.lostReason : lead.lostReason;
      if (!lostReason || !String(lostReason).trim()) {
        return res.status(400).json({ message: 'Lost reason is required when marking a lead as lost / not interested.' });
      }
    } else if (req.body.status !== undefined && req.body.status !== lead.status) {
      // Clean up stale lost info if moving to an active/won stage
      lead.lostReason = '';
      lead.lostReasonDetail = '';
    }

    const allowedFields = [
      'name', 'phone', 'email', 'company', 'tags', 'status', 'followUpDate',
      'location', 'profession', 'budget', 'closedDealAmount', 'areasOfInterest', 'project',
      'projectId', 'propertyType', 'siteVisitDate', 'assignedTo', 'customData',
      'utmCampaign', 'utmMedium', 'utmSource', 'lostReason', 'lostReasonDetail',
      'service_required', 'monthly_spend', 'goal_timeline', 'paid_amount', 'payable_amount', 'payment_method'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        let val = req.body[field];

        if (field === 'phone') val = val.replace(/\D/g, '');
        if (field === 'followUpDate' || field === 'siteVisitDate') val = val ? new Date(val) : null;

        const oldVal = lead[field];
        const hasChanged = String(oldVal) !== String(val);

        if (hasChanged) {
          changes[field] = { old: oldVal, new: val };

          if (field === 'status') {
            const isLost = String(val).toLowerCase().includes('lost') || String(val).toLowerCase().includes('not converted') || String(val).toLowerCase().includes('dropped');
            const lostInfo = req.body.lostReason ? ` [Reason: ${req.body.lostReason}${req.body.lostReasonDetail ? ` - ${req.body.lostReasonDetail}` : ''}]` : '';
            activitiesToAdd.push({
              action: 'status_changed',
              performedBy: req.user._id,
              performerName: req.user.name,
              details: `Pipeline stage moved from "${oldVal}" to "${val}"${isLost ? lostInfo : ''}`,
              timestamp: new Date(),
            });
          } else if (field === 'siteVisitDate') {
            activitiesToAdd.push({
              action: 'site_visit_scheduled',
              performedBy: req.user._id,
              performerName: req.user.name,
              details: val ? `Site visit scheduled for ${new Date(val).toLocaleString()}` : 'Site visit cancelled',
              timestamp: new Date(),
            });
          } else if (field === 'assignedTo') {
            let assignedName = 'Unassigned';
            if (val) {
              const u = await User.findById(val).select('name');
              if (u) {
                assignedName = u.name;
                lead.assignedToName = u.name;
              }
            } else {
              lead.assignedToName = '';
            }
            activitiesToAdd.push({
              action: 'assigned_agent',
              performedBy: req.user._id,
              performerName: req.user.name,
              details: `Assigned to ${assignedName}`,
              timestamp: new Date(),
            });
          } else if (field === 'projectId') {
            activitiesToAdd.push({
              action: 'project_linked',
              performedBy: req.user._id,
              performerName: req.user.name,
              details: `Real Estate project updated`,
              timestamp: new Date(),
            });
          }

          lead[field] = val;
        }
      }
    }

    // Merge customData & dynamic form fields
    const extraCustomData = {};
    for (const key of Object.keys(req.body)) {
      if (!allowedFields.includes(key) && key !== '_id' && key !== 'createdAt' && key !== 'updatedAt') {
        extraCustomData[key] = req.body[key];
      }
    }
    if (req.body.customData || Object.keys(extraCustomData).length > 0) {
      const mergedCustom = {
        ...(lead.customData || {}),
        ...(typeof req.body.customData === 'object' ? req.body.customData : {}),
        ...extraCustomData,
      };
      lead.customData = mergedCustom;
      lead.markModified('customData');
    }

    if (Object.keys(changes).length > 0) {
      lead.editHistory.push({
        updatedAt: new Date(),
        updatedBy: req.user._id,
        changes,
      });

      activitiesToAdd.forEach(act => lead.leadActivities.push(act));

      if (activitiesToAdd.length === 0) {
        lead.leadActivities.push({
          action: 'lead_updated',
          performedBy: req.user._id,
          performerName: req.user.name,
          details: `Updated details: ${Object.keys(changes).join(', ')}`,
          timestamp: new Date(),
        });
      }
    }

    await lead.save();
    res.json(lead);
  } catch (error) {
    console.error('updateLead error:', error);
    res.status(500).json({ message: error.message || 'Failed to update lead' });
  }
};

// @desc  Delete lead
// @route DELETE /api/leads/:id
// @access Private
exports.deleteLead = async (req, res) => {
  try {
    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const lead = await Lead.findOneAndDelete({ _id: req.params.id, ...basePermissionQuery });

    if (!lead) return res.status(404).json({ message: 'Lead not found or unauthorized' });

    res.json({ message: 'Lead deleted successfully', id: req.params.id });
  } catch (error) {
    console.error('deleteLead error:', error);
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

// @desc  Add note to lead (First-Touch auto-assignment & Stage Auto-Transition enabled)
// @route POST /api/leads/:id/notes
// @access Private
exports.addNote = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ message: 'Note text is required' });

    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const lead = await Lead.findOne({ _id: req.params.id, ...basePermissionQuery });

    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    // First-Touch Assignment: Automatically claim unassigned lead for the interacting agent
    if (!lead.assignedTo && req.user.role !== 'superadmin') {
      lead.assignedTo = req.user._id;
      lead.assignedToName = req.user.name || 'Agent';
      lead.leadActivities.push({
        action: 'assigned_agent',
        performedBy: req.user._id,
        performerName: req.user.name,
        details: `Lead claimed and assigned to ${req.user.name} via first-touch note`,
        timestamp: new Date(),
      });
    }

    const beforeStatus = lead.status;
    const userStages = req.user.pipelineStages || req.user.customPipelineStages || [];
    const firstStage = userStages[0];
    const secondStage = userStages[1] || 'contacted';

    if (lead.status === 'new_lead') {
      lead.status = 'contacted';
    } else if (['new', 'New Lead', firstStage].includes(lead.status)) {
      lead.status = secondStage;
    }

    lead.notes.push({
      text: text.trim(),
      createdBy: req.user._id,
      authorName: req.user.name || 'Agent',
      createdAt: new Date(),
    });

    lead.leadActivities.push({
      action: 'note_added',
      performedBy: req.user._id,
      performerName: req.user.name,
      details: beforeStatus !== lead.status
        ? `Added note: "${text.trim().slice(0, 50)}${text.length > 50 ? '...' : ''}". Stage auto-updated to "${lead.status}"`
        : `Added note: "${text.trim().slice(0, 50)}${text.length > 50 ? '...' : ''}"`,
      timestamp: new Date(),
    });

    await lead.save();

    // Log global activity
    try {
      const ActivityLog = require('../models/ActivityLog');
      await ActivityLog.create({
        user_id: req.user._id,
        userId: req.user._id,
        userName: req.user.name,
        role: req.user.role || 'agent',
        action: 'NOTE_ADDED',
        target_type: 'lead',
        targetType: 'lead',
        target_id: String(lead._id),
        targetId: String(lead._id),
        details: `Note added to ${lead.name} (${lead.phone}). Stage: ${lead.status}`,
        before_state: { status: beforeStatus },
        after_state: { status: lead.status },
      });
    } catch (e) {}

    res.status(201).json(lead);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Track sent message (First-Touch auto-assignment & Stage Auto-Transition enabled)
// @route POST /api/leads/:id/track-message
// @access Private
exports.trackMessage = async (req, res) => {
  try {
    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const lead = await Lead.findOne({ _id: req.params.id, ...basePermissionQuery });

    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    // First-Touch Assignment: Automatically claim unassigned lead for the interacting agent
    if (!lead.assignedTo && req.user.role !== 'superadmin') {
      lead.assignedTo = req.user._id;
      lead.assignedToName = req.user.name || 'Agent';
      lead.leadActivities.push({
        action: 'assigned_agent',
        performedBy: req.user._id,
        performerName: req.user.name,
        details: `Lead claimed and assigned to ${req.user.name} via first-touch WhatsApp outreach`,
        timestamp: new Date(),
      });
    }

    const beforeStatus = lead.status;
    lead.messageSentCount = (lead.messageSentCount || 0) + 1;
    lead.templateUsageCount = (lead.templateUsageCount || 0) + 1;
    lead.lastContactedAt = new Date();

    const userStages = req.user.pipelineStages || req.user.customPipelineStages || [];
    const firstStage = userStages[0];
    const secondStage = userStages[1] || 'contacted';

    if (lead.status === 'new_lead') {
      lead.status = 'contacted';
    } else if (['new', 'New Lead', firstStage].includes(lead.status)) {
      lead.status = secondStage;
    }

    lead.leadActivities.push({
      action: 'message_sent',
      performedBy: req.user._id,
      performerName: req.user.name,
      details: `WhatsApp message dispatched by ${req.user.name}. Status: ${lead.status}`,
      timestamp: new Date(),
    });

    await lead.save();

    // Log global activity
    try {
      const ActivityLog = require('../models/ActivityLog');
      await ActivityLog.create({
        user_id: req.user._id,
        userId: req.user._id,
        userName: req.user.name,
        role: req.user.role || 'agent',
        action: 'MESSAGE_DISPATCHED',
        target_type: 'lead',
        targetType: 'lead',
        target_id: String(lead._id),
        targetId: String(lead._id),
        details: `Sent WhatsApp message to ${lead.name} (${lead.phone}). Stage auto-updated to ${lead.status}`,
        before_state: { status: beforeStatus },
        after_state: { status: lead.status },
      });
    } catch (e) {
      // non-blocking
    }

    res.json({ message: 'Message tracked successfully', status: lead.status, assignedTo: lead.assignedTo, assignedToName: lead.assignedToName });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc  Track call & auto-transition to contacted (First-Touch auto-assignment & Stage Auto-Transition enabled)
// @route POST /api/leads/:id/track-call
// @access Private
exports.trackCall = async (req, res) => {
  try {
    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const lead = await Lead.findOne({ _id: req.params.id, ...basePermissionQuery });

    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    // First-Touch Assignment: Automatically claim unassigned lead for the interacting agent
    if (!lead.assignedTo && req.user.role !== 'superadmin') {
      lead.assignedTo = req.user._id;
      lead.assignedToName = req.user.name || 'Agent';
      lead.leadActivities.push({
        action: 'assigned_agent',
        performedBy: req.user._id,
        performerName: req.user.name,
        details: `Lead claimed and assigned to ${req.user.name} via first-touch call`,
        timestamp: new Date(),
      });
    }

    const beforeStatus = lead.status;
    lead.lastContactedAt = new Date();

    const userStages = req.user.pipelineStages || req.user.customPipelineStages || [];
    const firstStage = userStages[0];
    const secondStage = userStages[1] || 'contacted';

    if (lead.status === 'new_lead') {
      lead.status = 'contacted';
    } else if (['new', 'New Lead', firstStage].includes(lead.status)) {
      lead.status = secondStage;
    }

    lead.leadActivities.push({
      action: 'call_initiated',
      performedBy: req.user._id,
      performerName: req.user.name,
      details: `Call placed by ${req.user.name}. Status: ${lead.status}`,
      timestamp: new Date(),
    });

    await lead.save();

    // Log global activity
    try {
      const ActivityLog = require('../models/ActivityLog');
      await ActivityLog.create({
        user_id: req.user._id,
        userId: req.user._id,
        userName: req.user.name,
        role: req.user.role || 'agent',
        action: 'CALL_INITIATED',
        target_type: 'lead',
        targetType: 'lead',
        target_id: String(lead._id),
        targetId: String(lead._id),
        details: `Called ${lead.name} (${lead.phone}). Stage auto-updated to ${lead.status}`,
        before_state: { status: beforeStatus },
        after_state: { status: lead.status },
      });
    } catch (e) {
      // non-blocking
    }

    res.json({ message: 'Call tracked successfully', status: lead.status, assignedTo: lead.assignedTo, assignedToName: lead.assignedToName });
  } catch (error) {
    res.status(500).json({ message: 'Server error tracking call' });
  }
};

// @desc  Reassign a lead to another agent
// @route PUT /api/leads/:id/reassign
// @access Private
exports.reassignLead = async (req, res) => {
  try {
    const { toAgentId, reason } = req.body;
    if (!toAgentId) return res.status(400).json({ success: false, message: 'Target agent ID (toAgentId) is required' });

    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const lead = await Lead.findOne({ _id: req.params.id, ...basePermissionQuery });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found or unauthorized' });

    const targetAgent = await User.findById(toAgentId).select('name email usercode');
    if (!targetAgent) return res.status(404).json({ success: false, message: 'Target agent not found' });

    const prevAgentName = lead.assignedToName || 'Unassigned (Common Pool)';
    lead.assignedTo = targetAgent._id;
    lead.assignedToName = targetAgent.name;

    const reasonText = reason && String(reason).trim() ? ` Reason: "${String(reason).trim()}"` : '';
    lead.leadActivities.push({
      action: 'assigned_agent',
      performedBy: req.user._id,
      performerName: req.user.name,
      details: `Reassigned from ${prevAgentName} to ${targetAgent.name} by ${req.user.name}.${reasonText}`,
      timestamp: new Date(),
    });

    if (reason && String(reason).trim()) {
      lead.notes.push({
        text: `[Lead Reassigned to ${targetAgent.name}]: ${String(reason).trim()}`,
        createdBy: req.user._id,
        authorName: req.user.name,
        createdAt: new Date(),
      });
    }

    await lead.save();

    try {
      const ActivityLog = require('../models/ActivityLog');
      await ActivityLog.create({
        user_id: req.user._id,
        userId: req.user._id,
        userName: req.user.name,
        role: req.user.role || 'agent',
        action: 'LEAD_REASSIGNED',
        target_type: 'lead',
        targetType: 'lead',
        target_id: String(lead._id),
        targetId: String(lead._id),
        details: `Reassigned lead ${lead.name} to ${targetAgent.name}.${reasonText}`,
      });
    } catch (e) {}

    res.json({
      success: true,
      message: `Lead successfully reassigned to ${targetAgent.name}`,
      lead,
    });
  } catch (error) {
    console.error('reassignLead error:', error);
    res.status(500).json({ success: false, message: 'Server error reassigning lead' });
  }
};

// @desc  Export leads in Excel (.xlsx), CSV, or PDF format (Cursor-based HTTP streaming)
// @route GET /api/leads/export
// @access Private
exports.exportLeads = async (req, res) => {
  try {
    const { format = 'xlsx', status, statuses, tag, search, projectId, assignedTo } = req.query;

    // ── Export Permission & Admin Notification Guard ──
    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    const companyId = isOwner ? req.user._id : req.user.companyId;

    if (!isOwner && req.user.companyId) {
      const agentExportStatus = req.user.exportPermissionStatus;
      const companyOwner = await User.findById(companyId).select('companySettings').lean();
      const companyDefaultStatus = companyOwner?.companySettings?.exportPermissionStatus || 'allowed';

      const effectiveStatus = (agentExportStatus && agentExportStatus !== 'allowed')
        ? agentExportStatus
        : companyDefaultStatus;

      if (effectiveStatus === 'restricted' || (req.user.companyJoinMethod === 'created_by_company' && effectiveStatus !== 'allowed')) {
        await Notification.create({
          userId: companyId,
          title: '⚠️ Unauthorized Lead Export Attempt',
          message: `${req.user.name} (${req.user.usercode}) attempted to export pipeline leads without authorization.`,
          type: 'system_alert',
        });

        return res.status(403).json({
          message: 'Lead export restricted by your Organization Admin. An alert notification has been sent to your Admin.',
          code: 'EXPORT_RESTRICTED',
        });
      }

      await Notification.create({
        userId: companyId,
        title: '📥 Lead Data Exported by Team Member',
        message: `${req.user.name} (${req.user.usercode}) exported pipeline leads (${format.toUpperCase()} format).`,
        type: 'system_alert',
      });
    }

    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const query = { $and: [ basePermissionQuery ] };

    if (statuses) {
      const statusList = (Array.isArray(statuses) ? statuses : statuses.split(','))
        .map(s => s.trim())
        .filter(Boolean);
      if (statusList.length > 0) {
        query.status = { $in: statusList };
      }
    } else if (status) {
      query.status = status;
    }

    if (tag) query.tags = tag;
    if (projectId) query.projectId = projectId;
    if (assignedTo) query.assignedTo = assignedTo;
    if (search && search.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$and.push({
        $or: [
          { name: new RegExp(safeSearch, 'i') },
          { phone: new RegExp(safeSearch, 'i') },
          { company: new RegExp(safeSearch, 'i') },
          { project: new RegExp(safeSearch, 'i') },
          { location: new RegExp(safeSearch, 'i') },
        ]
      });
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const userCurrency = req.user.localization?.currencySymbol || '₹';

    // ── 1. STREAMING CSV EXPORT (Zero-Memory Pipeline) ──
    if (format.toLowerCase() === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="leads_export_${timestamp}.csv"`);

      const cursor = Lead.find(query)
        .populate('projectId', 'name location basePrice')
        .populate('assignedTo', 'name usercode email')
        .sort({ createdAt: -1 })
        .cursor();

      // Write CSV Header
      const baseHeaders = [
        '#', 'Name', 'Phone', 'Email', 'Company', 'Status', 'Next Follow-Up',
        'Offering / Project', 'Tier / Variant', 'Budget', `Closed Deal Amount (${userCurrency})`,
        'Location', 'Scheduled Meeting / Demo', 'Assigned Rep', 'Tags', 'Created At',
        'Source', 'UTM Campaign', 'UTM Medium', 'UTM Source', 'Lost Reason', 'Lost Details'
      ];
      res.write(baseHeaders.map(h => `"${h}"`).join(',') + '\n');

      let idx = 0;
      for await (const l of cursor) {
        idx++;
        const row = [
          idx,
          l.name || '',
          l.phone || '',
          l.email || '',
          l.company || '',
          l.status || '',
          l.followUpDate ? new Date(l.followUpDate).toISOString().slice(0, 10) : '',
          l.projectId?.name || l.project || '',
          l.propertyType || '',
          l.budget || '',
          l.closedDealAmount ? `${userCurrency}${Number(l.closedDealAmount).toLocaleString()}` : '',
          l.location || '',
          l.siteVisitDate ? new Date(l.siteVisitDate).toISOString().slice(0, 16) : '',
          l.assignedToName || l.assignedTo?.name || 'Common Pool',
          Array.isArray(l.tags) ? l.tags.join('; ') : '',
          l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 10) : '',
          l.source || '',
          l.utmCampaign || '',
          l.utmMedium || '',
          l.utmSource || '',
          l.lostReason || '',
          l.lostReasonDetail || '',
        ];

        res.write(row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',') + '\n');
      }

      return res.end();
    }

    // ── 2. STREAMING PDF EXPORT (HTTP Piped Cursor) ──
    if (format.toLowerCase() === 'pdf') {
      const doc = new PDFDocument({ margin: 30, size: 'A4' });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="leads_pipeline_report_${timestamp}.pdf"`);

      doc.pipe(res);

      // PDF Header
      doc.fontSize(18).font('Helvetica-Bold').text('Client Prospects & Pipeline Report', { align: 'center' });
      doc.moveDown(0.4);
      doc.fontSize(9).font('Helvetica').fillColor('#666666').text(`Generated: ${new Date().toLocaleString()} | Account: ${req.user.name} (${req.user.email || req.user.phone || ''})`, { align: 'center' });
      doc.moveDown(0.8);

      // Table Header
      const tableTop = doc.y;
      const colX = [25, 45, 135, 205, 275, 345, 425, 495];
      const headers = ['#', 'Name', 'Phone', 'Stage', 'Budget', `Closed (${userCurrency})`, 'Follow-up', 'Assigned'];

      doc.fontSize(8).font('Helvetica-Bold').fillColor('#4f46e5');
      headers.forEach((h, i) => doc.text(h, colX[i], tableTop));

      doc.moveTo(25, tableTop + 14).lineTo(570, tableTop + 14).strokeColor('#e5e7eb').lineWidth(1).stroke();

      let currentY = tableTop + 20;
      let idx = 0;

      const cursor = Lead.find(query)
        .populate('projectId', 'name location basePrice')
        .populate('assignedTo', 'name usercode email')
        .sort({ createdAt: -1 })
        .cursor();

      for await (const lead of cursor) {
        idx++;
        if (currentY > 740) {
          doc.addPage();
          currentY = 40;
        }

        doc.fontSize(8).font('Helvetica').fillColor('#1f2937');
        doc.text(String(idx), colX[0], currentY);
        doc.text(lead.name || '—', colX[1], currentY, { width: 85, truncate: true });
        doc.text(lead.phone ? `+${lead.phone}` : '—', colX[2], currentY, { width: 65, truncate: true });
        doc.text(lead.status || '—', colX[3], currentY, { width: 65, truncate: true });
        doc.text(lead.budget || '—', colX[4], currentY, { width: 65, truncate: true });
        doc.text(lead.closedDealAmount ? `${userCurrency}${Number(lead.closedDealAmount).toLocaleString()}` : '—', colX[5], currentY, { width: 75, truncate: true });
        doc.text(lead.followUpDate ? new Date(lead.followUpDate).toISOString().slice(0, 10) : '—', colX[6], currentY, { width: 65, truncate: true });
        doc.text(lead.assignedToName || lead.assignedTo?.name || 'Pool', colX[7], currentY, { width: 65, truncate: true });

        currentY += 15;

        // Dynamic Custom Fields & Lost Reason sub-row in PDF
        const customEntries = (lead.customData && typeof lead.customData === 'object')
          ? Object.entries(lead.customData).filter(([_, v]) => v !== undefined && v !== '')
          : [];

        if (lead.lostReason) {
          customEntries.push(['Lost Reason', `${lead.lostReason}${lead.lostReasonDetail ? ` (${lead.lostReasonDetail})` : ''}`]);
        }

        if (customEntries.length > 0) {
          if (currentY > 755) {
            doc.addPage();
            currentY = 40;
          }
          doc.fontSize(7).font('Helvetica-Oblique').fillColor('#6366f1');
          const customText = 'Details: ' + customEntries.map(([k, v]) => `${k}: ${v}`).join('  |  ');
          doc.text(customText, colX[1], currentY, { width: 495 });
          currentY += 13;
        }

        currentY += 3;
      }

      doc.end();
      return;
    }

    // ── 3. CHUNKED EXCEL EXPORT (.xlsx) ──
    const cursor = Lead.find(query)
      .populate('projectId', 'name location basePrice')
      .populate('assignedTo', 'name usercode email')
      .sort({ createdAt: -1 })
      .cursor();

    const rows = [];
    let index = 0;

    for await (const l of cursor) {
      index++;
      const customFields = {};
      if (l.customData && typeof l.customData === 'object') {
        for (const [k, v] of Object.entries(l.customData)) {
          customFields[`Custom: ${k}`] = v;
        }
      }

      rows.push({
        '#': index,
        'Name': l.name || '',
        'Phone': l.phone || '',
        'Email': l.email || '',
        'Company': l.company || '',
        'Status / Stage': l.status || '',
        'Next Follow-Up': l.followUpDate ? new Date(l.followUpDate).toISOString().slice(0, 10) : '',
        'Offering / Project': l.projectId?.name || l.project || '',
        'Tier / Variant': l.propertyType || '',
        'Deal Value / Budget': l.budget || '',
        [`Closed Deal Amount (${userCurrency})`]: l.closedDealAmount ? `${userCurrency}${Number(l.closedDealAmount).toLocaleString()}` : '',
        'Location / Market': l.location || '',
        'Scheduled Demo / Meeting': l.siteVisitDate ? new Date(l.siteVisitDate).toISOString().slice(0, 16) : '',
        'Assigned Representative': l.assignedToName || l.assignedTo?.name || 'Common Pool',
        'Tags': Array.isArray(l.tags) ? l.tags.join(', ') : '',
        'Created At': l.createdAt ? new Date(l.createdAt).toISOString().slice(0, 10) : '',
        'Source': l.source || '',
        'UTM Campaign': l.utmCampaign || '',
        'UTM Medium': l.utmMedium || '',
        'UTM Source': l.utmSource || '',
        'Lost Reason': l.lostReason || '',
        'Lost Details': l.lostReasonDetail || '',
        ...customFields,
      });
    }

    const worksheet = xlsx.utils.json_to_sheet(rows);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Prospects');

    const xlsxBuffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="leads_export_${timestamp}.xlsx"`);
    return res.send(xlsxBuffer);

  } catch (error) {
    console.error('exportLeads streaming error:', error);
    res.status(500).json({ message: 'Failed to export leads' });
  }
};

// @desc  Crash-Proof Streaming & Chunked Bulk Lead Import (1,000 items/batch)
// @route POST /api/leads/import
// @access Private
exports.importLeads = async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ message: 'Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file' });
    }

    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    const companyId = req.user.companyId || (isOwner ? req.user._id : null);
    const userCustomFields = req.user.customLeadFields || [];
    const isCSV = req.file.originalname?.toLowerCase().endsWith('.csv') || req.file.mimetype === 'text/csv';

    // ─────────────────────────────────────────────────────────────
    // PLAN LIMITS & REMAINING QUOTA ENFORCEMENT
    // ─────────────────────────────────────────────────────────────
    const { PLAN_LIMITS } = require('../utils/planLimits');
    const lifecycle = req.user.subscriptionLifecycle;
    const effectivePlan = lifecycle?.effectivePlan || req.user.plan || 'free';
    const limits = PLAN_LIMITS[effectivePlan];
    const maxLeads = limits?.maxLeads ?? 10;

    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const currentCount = await Lead.countDocuments(basePermissionQuery);

    // Anti-Fraud Daily Import Velocity Enforcement
    const { checkImportVelocity } = require('../middleware/antiFraud');
    const tenantId = companyId || req.user._id;
    const velocityCheck = await checkImportVelocity(tenantId, 1);
    if (!velocityCheck.allowed) {
      return res.status(429).json({
        success: false,
        code: velocityCheck.code,
        message: velocityCheck.message,
        dailyLimit: velocityCheck.dailyLimit,
        importedToday: velocityCheck.importedToday,
      });
    }

    if (maxLeads !== Infinity && currentCount >= maxLeads) {
      return res.status(403).json({
        code: 'LIMIT_REACHED',
        message: `You have reached the maximum limit of ${maxLeads} leads on the ${limits?.name || effectivePlan} plan. Please upgrade your subscription to import more leads.`,
        currentCount,
        maxLeads,
      });
    }

    const maxAllowedNew = maxLeads === Infinity ? Infinity : Math.max(0, maxLeads - currentCount);
    let totalImported = 0;
    let skippedCount = 0;
    let quotaReached = false;
    let chunk = [];
    const CHUNK_SIZE = 1000;

    const processRow = async (row) => {
      if (maxLeads !== Infinity && (totalImported + chunk.length) >= maxAllowedNew) {
        quotaReached = true;
        return;
      }

      const normalizedRow = {};
      for (const [key, val] of Object.entries(row)) {
        normalizedRow[String(key).trim().toLowerCase().replace(/[\s_-]+/g, '')] = String(val).trim();
      }

      const getVal = (aliases) => {
        for (const alias of aliases) {
          const normAlias = alias.toLowerCase().replace(/[\s_-]+/g, '');
          if (normalizedRow[normAlias] !== undefined && normalizedRow[normAlias] !== '') {
            return normalizedRow[normAlias];
          }
        }
        return '';
      };

      const rawPhone = getVal(['phone', 'mobile', 'contact', 'phonenumber', 'mobilenumber', 'whatsapp', 'cell', 'tel', 'phone no']);
      const cleanPhone = String(rawPhone).replace(/\D/g, '');

      if (!cleanPhone || cleanPhone.length < 7) {
        skippedCount++;
        return;
      }

      const name = getVal(['name', 'clientname', 'fullname', 'contactname', 'leadname', 'customer', 'customername']) || `Lead #${cleanPhone.slice(-4)}`;
      const email = getVal(['email', 'emailaddress', 'e-mail', 'mail']);
      const company = getVal(['company', 'companyname', 'organization', 'business']);
      const budget = getVal(['budget', 'dealvalue', 'price', 'amount', 'value']);
      const location = getVal(['location', 'city', 'market', 'region', 'address']);
      const propertyType = getVal(['propertytype', 'tier', 'category', 'productcategory', 'variant', 'package']);
      const status = getVal(['status', 'stage', 'pipelinestage', 'dealstage']) || (req.user.customPipelineStages?.[0] || 'new');
      const project = getVal(['project', 'offering', 'package', 'offeringname']);
      const tagsStr = getVal(['tags', 'tag', 'labels', 'keywords']);

      const rawFollowUp = getVal(['followupdate', 'followup', 'nextaction', 'nextfollowup', 'nextfollowupdate']);
      let followUpDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      if (rawFollowUp) {
        const parsedDate = new Date(rawFollowUp);
        if (!isNaN(parsedDate.getTime())) {
          followUpDate = parsedDate;
        }
      }

      const customData = {};
      for (const field of userCustomFields) {
        const matchVal = getVal([field.label, field.fieldId, `custom:${field.label}`, `custom_${field.fieldId}`]);
        if (matchVal !== '') {
          customData[field.fieldId] = matchVal;
        }
      }

      for (const [origKey, origVal] of Object.entries(row)) {
        if (origKey.toLowerCase().startsWith('custom:') || origKey.toLowerCase().startsWith('custom_')) {
          const cleanKey = origKey.replace(/^custom[:_]\s*/i, '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
          if (cleanKey && origVal) {
            customData[cleanKey] = String(origVal).trim();
          }
        }
      }

      chunk.push({
        userId: req.user._id,
        companyId,
        assignedTo: req.user.companyRole === 'agent' ? req.user._id : null,
        assignedToName: req.user.companyRole === 'agent' ? req.user.name : '',
        name: name.trim(),
        phone: cleanPhone,
        email: email ? email.toLowerCase().trim() : undefined,
        company: company || undefined,
        status,
        budget,
        location,
        propertyType,
        project,
        tags: tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : ['imported'],
        followUpDate,
        customData,
        source: 'bulk_import',
        leadActivities: [{
          action: 'lead_created',
          performedBy: req.user._id,
          performerName: req.user.name,
          details: `Imported via Smart Streaming Bulk Uploader by ${req.user.name}`,
          timestamp: new Date(),
        }],
      });

      if (chunk.length >= CHUNK_SIZE) {
        await flushChunk();
      }
    };

    const flushChunk = async () => {
      if (chunk.length === 0) return;
      let currentBatch = [...chunk];
      chunk = [];

      if (maxLeads !== Infinity) {
        const remainingSpace = maxAllowedNew - totalImported;
        if (remainingSpace <= 0) {
          quotaReached = true;
          return;
        }
        if (currentBatch.length > remainingSpace) {
          skippedCount += (currentBatch.length - remainingSpace);
          currentBatch = currentBatch.slice(0, remainingSpace);
          quotaReached = true;
        }
      }

      try {
        const inserted = await Lead.insertMany(currentBatch, { ordered: false });
        totalImported += inserted.length;
      } catch (err) {
        if (err.insertedDocs) {
          totalImported += err.insertedDocs.length;
          skippedCount += (currentBatch.length - err.insertedDocs.length);
        } else if (err.writeErrors) {
          const insertedCount = currentBatch.length - err.writeErrors.length;
          totalImported += Math.max(0, insertedCount);
          skippedCount += err.writeErrors.length;
        } else {
          skippedCount += currentBatch.length;
        }
      }
    };

    if (isCSV) {
      const bufferStream = Readable.from(req.file.buffer);
      await new Promise((resolve, reject) => {
        bufferStream
          .pipe(csv())
          .on('data', async (row) => {
            bufferStream.pause();
            await processRow(row);
            bufferStream.resume();
          })
          .on('end', async () => {
            await flushChunk();
            resolve();
          })
          .on('error', reject);
      });
    } else {
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) return res.status(400).json({ message: 'Uploaded file contains no worksheets' });

      const rawRows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
      for (const row of rawRows) {
        await processRow(row);
      }
      await flushChunk();
    }

    if (totalImported === 0) {
      return res.status(400).json({
        message: `No new leads imported (${skippedCount} rows skipped due to invalid data or duplicate phones).`,
        importedCount: 0,
        skippedCount,
      });
    }

    if (quotaReached) {
      return res.status(200).json({
        message: `⚠️ Imported ${totalImported} leads. Import capped because your ${limits?.name || effectivePlan} plan limit (${maxLeads} leads) was reached. Upgrade to import more.`,
        importedCount: totalImported,
        skippedCount,
        quotaReached: true,
        maxLeads,
      });
    }

    res.status(201).json({
      message: `🎉 Successfully imported ${totalImported} leads! (${skippedCount} duplicates/invalid rows skipped)`,
      importedCount: totalImported,
      skippedCount,
    });
  } catch (error) {
    console.error('importLeads streaming error:', error);
    res.status(500).json({ message: error.message || 'Failed to stream import leads' });
  }
};
