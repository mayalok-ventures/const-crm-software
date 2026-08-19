const User = require('../models/User');
const Lead = require('../models/Lead');
const Payment = require('../models/Payment');
const FollowUp = require('../models/FollowUp');
const Offer = require('../models/Offer');
const Incentive = require('../models/Incentive');
const ActivityLog = require('../models/ActivityLog');
const Template = require('../models/Template');
const Coupon = require('../models/Coupon');
const Notification = require('../models/Notification');
const AbuseLog = require('../models/AbuseLog');
const AuditLog = require('../models/AuditLog');
const WAFingerprint = require('../models/WAFingerprint');
const Plan = require('../models/Plan');
const Subscription = require('../models/Subscription');
const Entitlement = require('../models/Entitlement');
const waSession = require('../services/waSession');
const { generateUniqueUsername } = require('../utils/generateUsername');
const { generateUniqueUsercode } = require('../utils/generateUsercode');

// Helper: Log Activity with before/after state and admin flags
const logActivity = async ({ userId, userName, role, action, targetType = 'lead', targetId, beforeState = null, afterState = null, details = '', adminFlag = false }) => {
  try {
    await ActivityLog.create({
      user_id: userId,
      userId,
      userName: userName || 'System Admin',
      role: role || 'admin',
      action,
      target_type: targetType,
      targetType,
      target_id: String(targetId || ''),
      targetId: String(targetId || ''),
      before_state: beforeState,
      beforeState,
      after_state: afterState,
      afterState,
      admin_flag: adminFlag,
      adminFlag,
      details: typeof details === 'object' ? JSON.stringify(details) : String(details),
      timestamp: new Date(),
    });
  } catch (err) {
    console.warn('[ActivityLog] Logging warning:', err.message);
  }
};

// ─────────────────────────────────────────────────────────────
// TEST VS REAL PRODUCTION DATA CLASSIFIERS
// ─────────────────────────────────────────────────────────────
const isTestEmail = (email) => {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  return (
    lower.includes('@crmtest.com') ||
    lower.includes('@edcrm.com') ||
    lower.includes('@test.com') ||
    lower.includes('@example.com') ||
    lower.includes('test_') ||
    lower.includes('dummy') ||
    lower.startsWith('test.') ||
    lower.startsWith('edu_') ||
    lower.startsWith('bob_edu_') ||
    lower.startsWith('counsellor_') ||
    lower.startsWith('salesrep_') ||
    lower.startsWith('agent_') ||
    lower.startsWith('e2e_')
  );
};

const isTestPhone = (phone) => {
  if (!phone) return false;
  const clean = String(phone).replace(/\D/g, '');
  return (
    clean.startsWith('9200') ||
    clean.startsWith('9300') ||
    clean.startsWith('000') ||
    clean.startsWith('12345') ||
    clean === '9999999999' ||
    clean === '8888888888' ||
    clean === '1111111111'
  );
};

const isTestName = (name) => {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  return (
    lower.includes('crmtest') ||
    lower.includes('test lead') ||
    lower.includes('test_') ||
    lower.includes('e2e') ||
    lower.includes('apex counsellors_') ||
    lower.includes('higher ed institute') ||
    lower.includes('nextgen edtech') ||
    lower.includes('global horizons overseas') ||
    lower.includes('apex iit-jee') ||
    lower.includes('oakridge world school') ||
    lower.includes('direct admission counsellors') ||
    lower.includes('zenith logistics')
  );
};

const isTestDataRecord = (record) => {
  if (!record) return false;
  if (record.isTestData === true) return true;
  if (isTestEmail(record.email)) return true;
  if (isTestPhone(record.phone)) return true;
  if (isTestName(record.name)) return true;
  if (isTestName(record.company)) return true;
  if (Array.isArray(record.tags) && record.tags.some(t => ['test', 'dummy', 'mock', 'e2e', 'test_data'].includes(String(t).toLowerCase()))) {
    return true;
  }
  return false;
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

// ─────────────────────────────────────────────────────────────
// GLOBAL METRICS & SAAS OVERVIEW
// ─────────────────────────────────────────────────────────────
exports.getGlobalMetrics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalCompanyOwners = await User.countDocuments({ workStatus: 'company_owner' });
    const totalSoloAgents = await User.countDocuments({ workStatus: 'independent_agent' });
    const totalLeads = await Lead.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const suspendedUsers = await User.countDocuments({ 'suspension.isSuspended': true });

    // Pipeline KPIs
    const [newLeadsCount, contactedCount, convertedCount, paymentDoneCount, notInterestedCount] = await Promise.all([
      Lead.countDocuments({ status: { $in: ['new_lead', 'new'] } }),
      Lead.countDocuments({ status: 'contacted' }),
      Lead.countDocuments({ status: { $in: ['converted', 'negotiation', 'site_visit_scheduled'] } }),
      Lead.countDocuments({ status: { $in: ['payment_done', 'closed'] } }),
      Lead.countDocuments({ status: { $in: ['not_interested', 'lost'] } }),
    ]);

    // Total Revenue from Payments
    const revenueAgg = await Payment.aggregate([
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalRevenue = revenueAgg[0]?.total || 0;

    // Plan breakdown
    const plansAgg = await User.aggregate([
      { $group: { _id: '$plan', count: { $sum: 1 } } }
    ]);
    const planBreakdown = { free: 0, starter: 0, growth: 0, pro: 0 };
    plansAgg.forEach(p => { if (p._id) planBreakdown[p._id] = p.count; });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentSignups = await User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } });

    res.json({
      success: true,
      totalUsers,
      totalCompanyOwners,
      totalSoloAgents,
      totalLeads,
      activeUsers,
      suspendedUsers,
      recentSignups,
      planBreakdown,
      pipeline: {
        newLeads: newLeadsCount,
        contacted: contactedCount,
        converted: convertedCount,
        paymentDone: paymentDoneCount,
        notInterested: notInterestedCount,
        totalRevenue,
      }
    });
  } catch (error) {
    console.error('getGlobalMetrics error:', error);
    res.status(500).json({ success: false, message: 'Failed to load global metrics' });
  }
};

// ─────────────────────────────────────────────────────────────
// LEADS: CREATE, UPDATE, STATUS & PIPELINE
// ─────────────────────────────────────────────────────────────

const { normalizePhone } = require('../utils/phoneNormalizer');

const VALID_6_SERVICES = [
  // 3 Individual Plans
  'basic_solo',
  'smart_solo',
  'power_solo',
  // 3 Organization Plans
  'team_starter',
  'business',
  'enterprise',
  // Dynamic & Backward Compatibility
  'custom_enterprise',
  'starter',
  'growth',
  'pro',
  'free',
  'digital_marketing',
  'web_development',
  'seo_optimization',
  'crm_automation',
  'branding_design',
  'cloud_infrastructure'
];

const VALID_5_STAGES = [
  'new_lead',
  'contacted',
  'not_interested',
  'converted',
  'payment_done'
];

// @desc  Create lead with strict 6-field whitelist and phone deduplication
// @route POST /api/admin/leads
// @access SuperAdmin / Admin
exports.createAdminLead = async (req, res) => {
  try {
    const allowedKeys = [
      'name', 'phone', 'email', 'company', 'service_required', 'serviceRequired',
      'monthly_spend', 'monthlySpend', 'goal_timeline', 'goalTimeline', 'source',
      'assignedTo', 'notes', 'project', 'projectId', 'budget', 'status',
      'propertyType', 'location', 'tags', 'followUpDate', 'siteVisitDate', 'customData'
    ];
    const extraKeys = Object.keys(req.body).filter(k => !allowedKeys.includes(k));
    if (extraKeys.length > 0) {
      return res.status(400).json({
        success: false,
        code: 'DISALLOWED_EXTRA_FIELDS',
        message: `Disallowed properties: ${extraKeys.join(', ')}. Only standard lead fields are accepted.`
      });
    }

    const {
      name, phone, email, company,
      service_required, serviceRequired,
      monthly_spend, monthlySpend,
      goal_timeline, goalTimeline,
      source, assignedTo, notes,
      project, projectId, budget, status,
      propertyType, location, tags, followUpDate, siteVisitDate
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, message: 'Lead name is mandatory' });
    }
    if (!phone || !String(phone).trim()) {
      return res.status(400).json({ success: false, message: 'Lead phone number is mandatory' });
    }
    if (!source || !String(source).trim()) {
      return res.status(400).json({ success: false, message: 'Lead source is mandatory' });
    }

    const cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ success: false, message: 'Valid phone number is mandatory (min 10 digits)' });
    }

    const effectiveService = service_required || serviceRequired;
    let normalizedService = 'smart_solo';
    if (effectiveService) {
      const parsedService = String(effectiveService).toLowerCase().trim();
      if (VALID_6_SERVICES.includes(parsedService) || ['basic_solo', 'smart_solo', 'power_solo', 'team_starter', 'business', 'enterprise'].includes(parsedService)) {
        normalizedService = parsedService;
      }
    }

    const spendNum = Number(monthly_spend || 0);
    if (isNaN(spendNum) || spendNum < 0) {
      return res.status(400).json({ success: false, message: 'Monthly spend must be a non-negative number' });
    }

    // Deduplication check
    const existing = await Lead.findOne({
      phone: cleanPhone,
      deletedAt: null,
      $or: [
        { userId: req.user._id },
        { companyId: req.user.companyId || req.user._id }
      ]
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_PHONE',
        message: `A lead with phone "${cleanPhone}" already exists in your pipeline (${existing.name}).`,
        lead: existing,
      });
    }

    const lead = await Lead.create({
      userId: req.user._id,
      companyId: req.user.companyId || req.user._id,
      name: String(name).trim(),
      phone: cleanPhone,
      email: email ? String(email).toLowerCase().trim() : undefined,
      company: company ? String(company).trim() : '',
      service_required: normalizedService,
      monthly_spend: spendNum,
      goal_timeline: goal_timeline ? String(goal_timeline).trim() : 'immediate',
      status: 'new_lead',
      source: source || 'agent_manual',
      assignedTo: assignedTo || null,
      followUpDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
      followUpNotified: false,
      version: 1,
      notes: notes ? [{ text: String(notes).trim(), createdBy: req.user._id, authorName: req.user.name }] : [],
      metadata: {
        offers_applied: [],
        payable_amount: 0,
        paid_amount: 0,
        agent_custom_price: false,
        admin_flag: false,
        custom_price_reason: '',
        whatsapp_connected: false,
        templates_sent: [],
      }
    });

    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role || 'admin',
      action: 'LEAD_CREATED',
      targetType: 'lead',
      targetId: lead._id,
      afterState: lead.toObject(),
      details: `Created lead "${lead.name}" (Service: ${normalizedService}, Spend: ₹${spendNum})`,
    });

    res.status(201).json({ success: true, message: `Lead "${lead.name}" created successfully`, lead });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, code: 'DUPLICATE_PHONE', message: 'A lead with this phone number already exists.' });
    }
    console.error('createAdminLead error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create lead' });
  }
};

// @desc  Modify lead details (Restricted strictly to the basic fields)
// @route PATCH /api/admin/leads/:id
// @access SuperAdmin / Admin
exports.updateAdminLead = async (req, res) => {
  try {
    const allowedUpdateFields = ['name', 'phone', 'email', 'company', 'service_required', 'monthly_spend', 'goal_timeline', 'assignedTo', 'version', 'notes'];
    const disallowedUpdates = Object.keys(req.body).filter(k => !allowedUpdateFields.includes(k));
    if (disallowedUpdates.length > 0) {
      return res.status(400).json({
        success: false,
        code: 'DISALLOWED_UPDATE_FIELDS',
        message: `Cannot modify restricted fields: ${disallowedUpdates.join(', ')}. Only basic lead fields can be edited.`
      });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    // Optimistic Concurrency Check
    if (req.body.version !== undefined && lead.version !== undefined) {
      if (Number(req.body.version) !== lead.version) {
        return res.status(409).json({
          success: false,
          code: 'CONCURRENCY_CONFLICT',
          message: 'Lead was modified concurrently by another user. Please refresh and retry.',
          currentVersion: lead.version
        });
      }
    }

    const beforeState = lead.toObject();

    if (req.body.name !== undefined) lead.name = String(req.body.name).trim();
    if (req.body.phone !== undefined) lead.phone = normalizePhone(req.body.phone);
    if (req.body.email !== undefined) lead.email = req.body.email ? String(req.body.email).toLowerCase().trim() : '';
    if (req.body.company !== undefined) lead.company = String(req.body.company).trim();
    if (req.body.service_required !== undefined) {
      const s = String(req.body.service_required).toLowerCase().trim();
      if (!VALID_6_SERVICES.includes(s)) {
        return res.status(400).json({ success: false, message: `Invalid service_required. Must be one of: ${VALID_6_SERVICES.join(', ')}` });
      }
      lead.service_required = s;
    }
    if (req.body.monthly_spend !== undefined) {
      const spend = Number(req.body.monthly_spend);
      if (isNaN(spend) || spend < 0) return res.status(400).json({ success: false, message: 'Monthly spend must be a non-negative number' });
      lead.monthly_spend = spend;
    }
    if (req.body.goal_timeline !== undefined) lead.goal_timeline = String(req.body.goal_timeline).trim();
    if (req.body.assignedTo !== undefined) lead.assignedTo = req.body.assignedTo || null;
    if (req.body.notes && typeof req.body.notes === 'string') {
      lead.notes.push({ text: req.body.notes.trim(), createdBy: req.user._id, authorName: req.user.name });
    }

    lead.version = (lead.version || 1) + 1;
    await lead.save();
    const afterState = lead.toObject();

    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role || 'admin',
      action: 'LEAD_UPDATED',
      targetType: 'lead',
      targetId: lead._id,
      beforeState,
      afterState,
      details: `Updated details for lead "${lead.name}"`,
    });

    res.json({ success: true, message: 'Lead updated successfully', lead });
  } catch (error) {
    console.error('updateAdminLead error:', error);
    res.status(500).json({ success: false, message: 'Failed to update lead' });
  }
};

// @desc  Change lead pipeline stage (Strict 5 stages with conversion rule)
// @route PATCH /api/admin/leads/:id/stage
// @access SuperAdmin / Admin
exports.updateLeadStage = async (req, res) => {
  try {
    const stage = req.body.stage || req.body.status;
    const { version } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    if (!stage || !VALID_5_STAGES.includes(stage)) {
      return res.status(400).json({
        success: false,
        message: `Invalid stage: "${stage}". Must be one of: ${VALID_5_STAGES.join(', ')}`
      });
    }

    // Optimistic Concurrency Check
    if (version !== undefined && lead.version !== undefined && Number(version) !== lead.version) {
      return res.status(409).json({
        success: false,
        code: 'CONCURRENCY_CONFLICT',
        message: 'Lead stage was changed concurrently by another user. Please reload state.',
        currentVersion: lead.version,
      });
    }

    // Conversion Rule: converted/payment_done requires recorded payment or paymentAmount + paymentMethod in body
    if (stage === 'converted' || stage === 'payment_done') {
      const rawAmt = req.body.paymentAmount !== undefined ? req.body.paymentAmount : (req.body.payment_amount !== undefined ? req.body.payment_amount : lead.paid_amount);
      const rawMethod = req.body.paymentMethod || req.body.payment_method || req.body.method || lead.payment_method;

      if (!lead.paid_amount || lead.paid_amount <= 0) {
        const amt = Number(rawAmt);
        if (!amt || isNaN(amt) || amt <= 0 || !rawMethod) {
          const existingPayment = await Payment.findOne({ lead_id: lead._id, status: 'completed' });
          if (!existingPayment) {
            return res.status(400).json({
              success: false,
              code: 'PAYMENT_REQUIRED_FOR_CONVERSION',
              message: 'paymentAmount (> 0) and paymentMethod are strictly mandatory to convert a lead or mark payment_done.',
            });
          }
        } else {
          // Record payment with duplicate transaction_id idempotency
          try {
            await Payment.create({
              lead_id: lead._id,
              leadId: lead._id,
              agent_id: lead.assignedTo || req.user._id,
              agentId: lead.assignedTo || req.user._id,
              amount: amt,
              method: String(rawMethod).trim(),
              transaction_id: req.body.transaction_id || `TXN-STAGE-${Date.now()}`,
              status: 'completed',
              verified_by_agent: true,
              verified_at: new Date(),
            });
          } catch (payErr) {
            if (payErr.code === 11000 && req.body.transaction_id) {
              await Payment.findOneAndUpdate(
                { transaction_id: req.body.transaction_id },
                {
                  lead_id: lead._id,
                  leadId: lead._id,
                  agent_id: lead.assignedTo || req.user._id,
                  agentId: lead.assignedTo || req.user._id,
                  amount: amt,
                  method: String(rawMethod).trim(),
                  status: 'completed',
                  verified_by_agent: true,
                  verified_at: new Date(),
                }
              );
            } else {
              throw payErr;
            }
          }
          lead.paid_amount = amt;
          lead.payable_amount = amt;
          lead.payment_method = String(rawMethod).trim();
        }
      }
    }

    const beforeState = lead.toObject();
    lead.status = stage;
    lead.version = (lead.version || 1) + 1;
    if (stage === 'contacted' && !lead.lastContactedAt) {
      lead.lastContactedAt = new Date();
    }
    await lead.save();

    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role || 'admin',
      action: 'LEAD_STAGE_CHANGED',
      targetType: 'lead',
      targetId: lead._id,
      beforeState,
      afterState: lead.toObject(),
      details: `Changed pipeline stage from "${beforeState.status}" to "${stage}"`,
    });

    res.json({ success: true, message: `Pipeline stage updated to ${stage.toUpperCase()}`, lead });
  } catch (error) {
    console.error('updateLeadStage error:', error);
    res.status(500).json({ success: false, message: 'Failed to update stage' });
  }
};

// Legacy alias route handler for status
exports.updateLeadStatus = exports.updateLeadStage;

// @desc  Get unified leads list with attached payments & followups
// @route GET /api/admin/leads
// @access SuperAdmin / Admin
exports.getAdminLeads = async (req, res) => {
  try {
    const { page = 1, limit = 200, status, search, assignedTo, source, typeFilter = 'all' } = req.query;
    
    // RULE 3: SuperAdmin only sees leads generated by their own internal team
    const adminCompanyId = req.user.companyId || (req.user.workStatus === 'company_owner' ? req.user._id : null);
    const query = {
      ...(adminCompanyId ? { $or: [{ companyId: adminCompanyId }, { userId: req.user._id }] } : { userId: req.user._id })
    };

    if (status && status !== 'all') query.status = status;
    if (assignedTo && assignedTo !== 'all') query.assignedTo = assignedTo;
    if (source && source !== 'all') query.source = source;

    if (search && search.trim()) {
      const rx = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$and = [{ $or: [{ name: rx }, { phone: rx }, { email: rx }, { project: rx }, { company: rx }] }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [leads, total] = await Promise.all([
      Lead.find(query)
        .populate('assignedTo', 'name email phone usercode companyRole incentive_pct')
        .sort({ updatedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Lead.countDocuments(query),
    ]);

    // Attach latest payments and open follow-ups
    const leadIds = leads.map(l => l._id);
    const [payments, followUps] = await Promise.all([
      Payment.find({ lead_id: { $in: leadIds } }).sort({ createdAt: -1 }).lean(),
      FollowUp.find({ lead_id: { $in: leadIds } }).sort({ scheduled_at: 1 }).lean(),
    ]);

    const paymentMap = {};
    payments.forEach(p => {
      const key = String(p.lead_id || p.leadId);
      if (!paymentMap[key]) paymentMap[key] = [];
      paymentMap[key].push(p);
    });

    const followUpMap = {};
    followUps.forEach(f => {
      const key = String(f.lead_id || f.leadId);
      if (!followUpMap[key]) followUpMap[key] = [];
      followUpMap[key].push(f);
    });

    const enrichedLeads = leads.map(l => {
      const isTest = isTestDataRecord(l);
      const canonicalStage = normalizeLeadStage(l.status);
      return {
        ...l,
        status: canonicalStage,
        originalStatus: l.status,
        isTestData: isTest,
        isRealData: !isTest,
        payments: paymentMap[String(l._id)] || [],
        followUps: followUpMap[String(l._id)] || [],
        nextFollowUp: followUpMap[String(l._id)]?.find(f => f.status === 'open') || null,
      };
    });

    const filtered = (typeFilter === 'real')
      ? enrichedLeads.filter(l => l.isRealData)
      : (typeFilter === 'test' ? enrichedLeads.filter(l => l.isTestData) : enrichedLeads);

    const realCount = enrichedLeads.filter(l => l.isRealData).length;
    const testCount = enrichedLeads.filter(l => l.isTestData).length;

    res.json({
      success: true,
      leads: filtered,
      total: filtered.length,
      realCount,
      testCount,
      page: parseInt(page),
      pages: Math.ceil(filtered.length / parseInt(limit)),
    });
  } catch (error) {
    console.error('getAdminLeads error:', error);
    res.status(500).json({ success: false, message: 'Failed to load leads' });
  }
};

// ─────────────────────────────────────────────────────────────
// FOLLOW-UPS ENGINE: SCHEDULE & POSTPONE WITH MANDATORY REMARKS
// ─────────────────────────────────────────────────────────────

// @desc  Schedule follow-up (Mandatory Note)
// @route POST /api/admin/leads/:id/followups
// @access SuperAdmin / Admin
exports.scheduleFollowUp = async (req, res) => {
  try {
    const { scheduled_at, note, scheduledAt } = req.body;
    const targetDate = scheduled_at || scheduledAt;

    if (!targetDate) {
      return res.status(400).json({ success: false, message: 'Scheduled date/time is mandatory' });
    }
    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, message: 'Follow-up note is mandatory' });
    }

    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    const followUp = await FollowUp.create({
      lead_id: lead._id,
      leadId: lead._id,
      agent_id: lead.assignedTo || req.user._id,
      agentId: lead.assignedTo || req.user._id,
      scheduled_at: new Date(targetDate),
      scheduledAt: new Date(targetDate),
      note: note.trim(),
      status: 'open',
      createdBy: req.user._id,
      creatorName: req.user.name,
    });

    // Update lead follow-up date and add to notes
    lead.followUpDate = new Date(targetDate);
    lead.followUpNotified = false;
    lead.notes.push({
      text: `[Follow-Up Scheduled for ${new Date(targetDate).toLocaleString()}]: ${note.trim()}`,
      createdBy: req.user._id,
      authorName: req.user.name,
      createdAt: new Date(),
    });
    await lead.save();

    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role || 'admin',
      action: 'FOLLOWUP_SCHEDULED',
      targetType: 'lead',
      targetId: lead._id,
      afterState: followUp.toObject(),
      details: `Scheduled follow-up for "${lead.name}" at ${new Date(targetDate).toLocaleString()}: ${note.trim()}`,
    });

    res.status(201).json({ success: true, message: 'Follow-up scheduled successfully', followUp });
  } catch (error) {
    console.error('scheduleFollowUp error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to schedule follow-up' });
  }
};

// @desc  Postpone follow-up (Mandatory Postpone Remark)
// @route PATCH /api/admin/followups/:id/postpone
// @access SuperAdmin / Admin
exports.postponeFollowUp = async (req, res) => {
  try {
    const { new_date, postpone_remark, scheduled_at, postponeRemark } = req.body;
    const nextDate = new_date || scheduled_at;
    const remark = postpone_remark || postponeRemark;

    if (!nextDate) {
      return res.status(400).json({ success: false, message: 'New postponed date/time is mandatory' });
    }
    if (!remark || !remark.trim()) {
      return res.status(400).json({ success: false, message: 'Postpone remark is mandatory explaining why the follow-up is rescheduled' });
    }

    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) return res.status(404).json({ success: false, message: 'Follow-up record not found' });

    const beforeState = followUp.toObject();

    followUp.status = 'postponed';
    followUp.postpone_remark = remark.trim();
    followUp.postponeRemark = remark.trim();
    followUp.scheduled_at = new Date(nextDate);
    followUp.scheduledAt = new Date(nextDate);
    await followUp.save();

    // Update lead follow-up date
    const lead = await Lead.findById(followUp.lead_id || followUp.leadId);
    if (lead) {
      lead.followUpDate = new Date(nextDate);
      lead.followUpNotified = false;
      lead.notes.push({
        text: `[Follow-Up Postponed to ${new Date(nextDate).toLocaleString()}]: ${remark.trim()}`,
        createdBy: req.user._id,
        authorName: req.user.name,
        createdAt: new Date(),
      });
      await lead.save();
    }

    const afterState = followUp.toObject();

    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role || 'admin',
      action: 'FOLLOWUP_POSTPONED',
      targetType: 'followup',
      targetId: followUp._id,
      beforeState,
      afterState,
      details: `Postponed follow-up to ${new Date(nextDate).toLocaleString()}. Remark: ${remark.trim()}`,
    });

    res.json({ success: true, message: 'Follow-up postponed successfully', followUp });
  } catch (error) {
    console.error('postponeFollowUp error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to postpone follow-up' });
  }
};

// @desc  Complete follow-up (Mandatory Note Required)
// @route PATCH /api/admin/followups/:id/complete
// @access SuperAdmin / Admin
exports.completeFollowUp = async (req, res) => {
  try {
    const { note, completion_note, completionNote } = req.body;
    const finalNote = (note || completion_note || completionNote || '').trim();

    if (!finalNote) {
      return res.status(400).json({
        success: false,
        code: 'COMPLETION_NOTE_REQUIRED',
        message: 'Follow-up completion requires a mandatory note explaining the outcome.',
      });
    }

    const followUp = await FollowUp.findById(req.params.id);
    if (!followUp) return res.status(404).json({ success: false, message: 'Follow-up not found' });

    const beforeState = followUp.toObject();

    followUp.status = 'done';
    followUp.completion_note = finalNote;
    followUp.completionNote = finalNote;
    followUp.completed_at = new Date();
    followUp.completedAt = new Date();
    await followUp.save();

    // Append completion note to lead and clear notification flag
    const lead = await Lead.findById(followUp.lead_id || followUp.leadId);
    if (lead) {
      lead.followUpNotified = true;
      lead.notes.push({
        text: `[Follow-Up Completed by ${req.user.name}]: ${finalNote}`,
        createdBy: req.user._id,
        authorName: req.user.name,
        createdAt: new Date(),
      });
      await lead.save();
    }

    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role || 'admin',
      action: 'FOLLOWUP_COMPLETED',
      targetType: 'followup',
      targetId: followUp._id,
      beforeState,
      afterState: followUp.toObject(),
      details: `Completed follow-up for lead "${lead?.name || 'Lead'}". Outcome Note: ${finalNote}`,
    });

    res.json({
      success: true,
      message: 'Follow-up marked as completed successfully! You can now schedule the next follow-up.',
      followUp,
      lead,
    });
  } catch (error) {
    console.error('completeFollowUp error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to complete follow-up' });
  }
};

// @desc  Convert Lead with selected plan or custom payment amount
// @route POST /api/admin/leads/:id/convert
// @access SuperAdmin / Admin
exports.convertLeadWithPlan = async (req, res) => {
  try {
    const {
      plan_id,
      custom_payment_amount,
      custom_price_reason,
      payment_method = 'bank_transfer',
      transaction_id,
      verify_payment = true,
      notes = ''
    } = req.body;

    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    let finalPayable = 0;
    let selectedPlan = null;
    let isCustomPrice = false;

    // Check Plan selection
    if (plan_id) {
      selectedPlan = await Plan.findOne({ code: plan_id }) || await Plan.findById(plan_id).catch(() => null);
      if (selectedPlan) {
        finalPayable = selectedPlan.priceInPaise ? selectedPlan.priceInPaise / 100 : (selectedPlan.price || 0);
      }
    }

    // Check Custom Payment Amount override
    if (custom_payment_amount !== undefined && custom_payment_amount !== null && custom_payment_amount !== '') {
      const customNum = Number(custom_payment_amount);
      if (isNaN(customNum) || customNum < 0) {
        return res.status(400).json({ success: false, message: 'Custom payment amount must be a positive number' });
      }
      finalPayable = customNum;
      isCustomPrice = true;

      if (!custom_price_reason || !String(custom_price_reason).trim()) {
        return res.status(400).json({
          success: false,
          code: 'CUSTOM_PRICE_REASON_REQUIRED',
          message: 'Reason is required when entering a custom payment amount for admin review audit.'
        });
      }
    }

    if (finalPayable <= 0 && !selectedPlan) {
      return res.status(400).json({ success: false, message: 'Please select an available plan or enter a valid payment amount' });
    }

    const beforeState = lead.toObject();
    const txnId = transaction_id || `TXN-MANUAL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Idempotency: verify transaction_id uniqueness
    const existingTxn = await Payment.findOne({ transaction_id: txnId });
    if (existingTxn) {
      return res.status(409).json({ success: false, code: 'DUPLICATE_TRANSACTION', message: 'Transaction ID already recorded.' });
    }

    // Atomic Payment Record Creation
    const payment = await Payment.create({
      lead_id: lead._id,
      leadId: lead._id,
      agent_id: lead.assignedTo || req.user._id,
      agentId: lead.assignedTo || req.user._id,
      amount: finalPayable,
      method: payment_method,
      transaction_id: txnId,
      transactionId: txnId,
      plan_id: selectedPlan?.code || plan_id || null,
      status: 'completed',
      verified_by_agent: Boolean(verify_payment),
      verifiedByAgent: Boolean(verify_payment),
      verified_at: verify_payment ? new Date() : null,
      verifiedAt: verify_payment ? new Date() : null,
      verifiedByUserId: req.user._id,
      notes: notes || `Deal converted by ${req.user.name}`,
    });

    // Update Lead State
    lead.selected_plan_id = selectedPlan?.code || plan_id || null;
    lead.selectedPlanId = lead.selected_plan_id;
    lead.payable_amount = finalPayable;
    lead.payableAmount = finalPayable;
    lead.paid_amount = finalPayable;
    lead.paidAmount = finalPayable;
    lead.closedDealAmount = finalPayable;
    lead.status = 'converted';
    lead.version = (lead.version || 1) + 1;

    lead.metadata = {
      ...(lead.metadata || {}),
      agent_custom_price: isCustomPrice,
      admin_flag: isCustomPrice,
      custom_price_reason: isCustomPrice ? String(custom_price_reason).trim() : '',
      converted_by: req.user._id,
      converted_at: new Date(),
    };

    await lead.save();

    // Calculate Agent Incentive if assigned
    let incentiveRecord = null;
    if (lead.assignedTo) {
      const agent = await User.findById(lead.assignedTo);
      if (agent && (agent.incentive_pct > 0 || agent.incentivePct > 0)) {
        const pct = agent.incentive_pct || agent.incentivePct;
        const incentiveAmount = (finalPayable * pct) / 100;
        incentiveRecord = await Incentive.create({
          agent_id: agent._id,
          agentId: agent._id,
          total_sales: finalPayable,
          incentive_pct: pct,
          incentive_amount: incentiveAmount,
          deals_count: 1,
          lead_ids: [lead._id],
        });
      }
    }

    // Activity Log with Admin Flag if custom price
    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role || 'admin',
      action: 'LEAD_CONVERTED',
      targetType: 'lead',
      targetId: lead._id,
      beforeState,
      afterState: lead.toObject(),
      adminFlag: isCustomPrice,
      details: isCustomPrice
        ? `[ADMIN REVIEW FLAGGED] Deal converted with custom price ₹${finalPayable.toLocaleString()} (Reason: ${custom_price_reason})`
        : `Deal converted with plan "${selectedPlan?.name || plan_id}" (₹${finalPayable.toLocaleString()})`,
    });

    // Explicit Anti-Fraud AbuseLog Entry for SuperAdmin Review
    if (isCustomPrice) {
      await AbuseLog.create({
        userId: req.user._id,
        type: 'price_discrepancy',
        detail: `Agent ${req.user.name} (${req.user.email}) entered custom conversion price of ₹${finalPayable.toLocaleString()} for lead "${lead.name}" (ID: ${lead._id}). Stated reason: ${custom_price_reason || 'None provided'}`,
        timestamp: new Date(),
      }).catch(err => console.warn('[AbuseLog] Failed to log custom price discrepancy:', err.message));
    }

    res.status(200).json({
      success: true,
      message: `Lead converted successfully! Payment of ₹${finalPayable.toLocaleString()} recorded.`,
      lead,
      payment,
      incentive: incentiveRecord,
      adminFlagged: isCustomPrice,
    });
  } catch (error) {
    console.error('convertLeadWithPlan error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to convert lead' });
  }
};

// @desc  Refund a recorded payment and reverse agent incentive
// @route POST /api/admin/payments/:id/refund
// @access SuperAdmin / Admin
exports.refundPayment = async (req, res) => {
  try {
    const { refund_reason } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment record not found' });
    if (payment.status === 'refunded') {
      return res.status(400).json({ success: false, message: 'Payment has already been refunded.' });
    }

    const beforePayment = payment.toObject();
    payment.status = 'refunded';
    payment.refunded_at = new Date();
    payment.refundedAt = new Date();
    payment.refund_reason = refund_reason ? String(refund_reason).trim() : 'Admin requested refund';
    payment.refundReason = payment.refund_reason;
    await payment.save();

    // Adjust lead's paid_amount
    const lead = await Lead.findById(payment.lead_id || payment.leadId);
    if (lead) {
      lead.paid_amount = Math.max(0, (lead.paid_amount || 0) - payment.amount);
      lead.paidAmount = lead.paid_amount;
      if (lead.paid_amount === 0) {
        lead.status = 'not_interested';
      }
      await lead.save();
    }

    // Revert/deduct agent incentive
    if (payment.agent_id || payment.agentId) {
      const agentId = payment.agent_id || payment.agentId;
      const agent = await User.findById(agentId);
      if (agent && (agent.incentive_pct > 0 || agent.incentivePct > 0)) {
        const pct = agent.incentive_pct || agent.incentivePct;
        const deductionAmount = (payment.amount * pct) / 100;
        await Incentive.create({
          agent_id: agent._id,
          agentId: agent._id,
          total_sales: -payment.amount,
          incentive_pct: pct,
          incentive_amount: -deductionAmount,
          deals_count: -1,
          lead_ids: lead ? [lead._id] : [],
        });
      }
    }

    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role || 'admin',
      action: 'PAYMENT_REFUNDED',
      targetType: 'payment',
      targetId: payment._id,
      beforeState: beforePayment,
      afterState: payment.toObject(),
      details: `Refunded payment of ₹${payment.amount.toLocaleString()} (Reason: ${payment.refund_reason})`,
    });

    res.json({ success: true, message: 'Payment successfully refunded and incentives adjusted.', payment, lead });
  } catch (error) {
    console.error('refundPayment error:', error);
    res.status(500).json({ success: false, message: 'Failed to process refund' });
  }
};

// @desc  Get Canonical Plans Catalog for Convert Modal
// @route GET /api/admin/plans
// @access SuperAdmin / Admin / Agent
exports.getAdminPlans = async (req, res) => {
  try {
    let plans = await Plan.find({ isActive: { $ne: false } }).sort({ tier: 1, priceInPaise: 1 }).lean();
    if (!plans || plans.length === 0) {
      plans = [
        { code: 'IND_STARTER_MONTHLY_V1', name: 'Starter Tier', price: 999, interval: 'monthly', tier: 1 },
        { code: 'IND_PRO_MONTHLY_V1', name: 'Professional Growth', price: 1999, interval: 'monthly', tier: 2 },
        { code: 'IND_SOLO_POWER_MONTHLY_V1', name: 'Solo Power Elite', price: 3999, interval: 'monthly', tier: 3 },
        { code: 'TEAM_STARTER_MONTHLY_V1', name: 'Agency Team Starter', price: 4999, interval: 'monthly', tier: 4 },
        { code: 'TEAM_BUSINESS_MONTHLY_V1', name: 'Agency Business Pro', price: 9999, interval: 'monthly', tier: 5 },
        { code: 'ENTERPRISE_CUSTOM_MONTHLY_V1', name: 'Enterprise Scale', price: 19999, interval: 'monthly', tier: 6 },
      ];
    } else {
      plans = plans.map(p => ({
        ...p,
        price: p.priceInPaise ? p.priceInPaise / 100 : (p.price || 0),
      }));
    }
    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to load plans' });
  }
};

// @desc  Get Admin Review Alerts Queue
// @route GET /api/admin/alerts-queue
// @access SuperAdmin / Admin
exports.getAdminAlerts = async (req, res) => {
  try {
    const flaggedLeads = await Lead.find({ 'metadata.admin_flag': true })
      .populate('assignedTo', 'name email phone usercode')
      .sort({ updatedAt: -1 })
      .lean();

    const overdueFollowUps = await FollowUp.find({
      status: 'open',
      scheduled_at: { $lt: new Date(Date.now() - 48 * 60 * 60 * 1000) }
    })
      .populate('lead_id', 'name phone company status')
      .populate('agent_id', 'name email usercode')
      .sort({ scheduled_at: 1 })
      .lean();

    res.json({
      success: true,
      flaggedLeads,
      overdueFollowUps,
      totalAlerts: flaggedLeads.length + overdueFollowUps.length
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch admin alerts' });
  }
};

// ─────────────────────────────────────────────────────────────
// OFFERS & DISCOUNTS ENGINE
// ─────────────────────────────────────────────────────────────

// @desc  Create Offer / Promo Discount
// @route POST /api/admin/offers
// @access SuperAdmin / Admin
exports.createAdminOffer = async (req, res) => {
  try {
    const { title, code, discount_pct, discount_fixed, valid_until, discountPct, discountFixed, validUntil } = req.body;

    if (!title) return res.status(400).json({ success: false, message: 'Offer title is required' });

    const pct = discount_pct !== undefined ? Number(discount_pct) : discountPct;
    const fixed = discount_fixed !== undefined ? Number(discount_fixed) : discountFixed;

    if (pct === undefined && fixed === undefined) {
      return res.status(400).json({ success: false, message: 'Either discount_pct or discount_fixed must be specified' });
    }

    const offer = await Offer.create({
      agent_id: req.user._id,
      title: title.trim(),
      code: code ? code.toUpperCase().trim() : undefined,
      discount_pct: pct || null,
      discountPct: pct || null,
      discount_fixed: fixed || null,
      discountFixed: fixed || null,
      valid_until: (valid_until || validUntil) ? new Date(valid_until || validUntil) : null,
      applied: false,
    });

    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role || 'admin',
      action: 'OFFER_CREATED',
      targetType: 'offer',
      targetId: offer._id,
      afterState: offer.toObject(),
      details: `Created offer "${offer.title}" (${pct ? `${pct}%` : `₹${fixed}`} discount)`,
    });

    res.status(201).json({ success: true, message: `Offer "${offer.title}" created successfully`, offer });
  } catch (error) {
    console.error('createAdminOffer error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create offer' });
  }
};

// @desc  Apply Offer to Lead & Compute Post-Discount Payable Amount
// @route POST /api/admin/leads/:id/apply-offer
// @access SuperAdmin / Admin
exports.applyOfferToLead = async (req, res) => {
  try {
    const { offer_id, offerId, discount_pct, discount_fixed } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });

    let discountPct = discount_pct;
    let discountFixed = discount_fixed;
    let offerTitle = 'Custom Special Discount';

    if (offer_id || offerId) {
      const offer = await Offer.findById(offer_id || offerId);
      if (offer) {
        discountPct = offer.discount_pct || offer.discountPct;
        discountFixed = offer.discount_fixed || offer.discountFixed;
        offerTitle = offer.title;
        offer.applied = true;
        offer.applied_at = new Date();
        offer.lead_id = lead._id;
        await offer.save();
      }
    }

    // Compute Base Amount from budget or closedDealAmount
    const rawBudget = lead.budget ? Number(String(lead.budget).replace(/[^0-9.]/g, '')) : 0;
    const baseAmount = lead.closedDealAmount || rawBudget || 100000;

    let finalAmount = baseAmount;
    if (discountPct && Number(discountPct) > 0) {
      finalAmount = baseAmount - (baseAmount * Number(discountPct)) / 100;
    } else if (discountFixed && Number(discountFixed) > 0) {
      finalAmount = Math.max(0, baseAmount - Number(discountFixed));
    }

    if (!lead.metadata) lead.metadata = {};
    if (!lead.metadata.offers_applied) lead.metadata.offers_applied = [];
    
    lead.metadata.offers_applied.push({
      title: offerTitle,
      discountPct: discountPct || null,
      discountFixed: discountFixed || null,
      appliedAt: new Date(),
      appliedBy: req.user.name,
    });
    lead.metadata.payable_amount = finalAmount;
    lead.closedDealAmount = finalAmount;

    lead.notes.push({
      text: `[Offer Applied]: "${offerTitle}" -> New Payable Amount: ₹${finalAmount.toLocaleString()}`,
      createdBy: req.user._id,
      authorName: req.user.name,
      createdAt: new Date(),
    });

    await lead.save();

    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role || 'admin',
      action: 'OFFER_APPLIED',
      targetType: 'lead',
      targetId: lead._id,
      afterState: lead.toObject(),
      details: `Applied offer "${offerTitle}" to lead "${lead.name}". Payable amount set to ₹${finalAmount.toLocaleString()}`,
    });

    res.json({
      success: true,
      message: `Offer applied! New payable amount: ₹${finalAmount.toLocaleString()}`,
      lead,
      payable_amount: finalAmount,
    });
  } catch (error) {
    console.error('applyOfferToLead error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to apply offer' });
  }
};

// ─────────────────────────────────────────────────────────────
// AGENTS & TEAM ROSTER HIERARCHY
// ─────────────────────────────────────────────────────────────

// @desc  Get all agents with performance leaderboard
// @route GET /api/admin/agents
// @access SuperAdmin / Admin
exports.getAdminAgents = async (req, res) => {
  try {
    const { search, status } = req.query;
    const query = {
      $or: [
        { role: 'agent' },
        { companyRole: { $in: ['agent', 'manager', 'sales_rep', 'telecaller'] } },
        { workStatus: { $in: ['agent', 'employee', 'independent_agent'] } },
        { companyId: req.user._id },
        { createdBy: req.user._id },
      ]
    };

    if (status === 'active') query.isActive = true;
    if (status === 'inactive') query.isActive = false;

    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$and = [{ $or: [{ name: rx }, { email: rx }, { phone: rx }, { usercode: rx }] }];
    }

    const agents = await User.find(query)
      .select('-password -twoFactorSecret -twoFactorOtp')
      .sort({ createdAt: -1 })
      .lean();

    const enriched = await Promise.all(
      agents.map(async (agent) => {
        const [totalLeads, closedLeads, paymentsAgg, incentivesAgg] = await Promise.all([
          Lead.countDocuments({ assignedTo: agent._id }),
          Lead.countDocuments({ assignedTo: agent._id, status: { $in: ['converted', 'payment_done', 'closed'] } }),
          Payment.aggregate([
            { $match: { agent_id: agent._id } },
            { $group: { _id: null, totalSales: { $sum: '$amount' } } }
          ]),
          Incentive.aggregate([
            { $match: { agent_id: agent._id } },
            { $group: { _id: null, totalIncentives: { $sum: '$incentive_amount' } } }
          ]),
        ]);

        const totalSales = paymentsAgg[0]?.totalSales || 0;
        const incentivePct = agent.incentive_pct || agent.commissionRate || 10;
        const totalIncentives = incentivesAgg[0]?.totalIncentives || (totalSales * incentivePct) / 100;
        const conversionRate = totalLeads > 0 ? Number(((closedLeads / totalLeads) * 100).toFixed(1)) : 0;

        return {
          ...agent,
          totalLeads,
          closedLeads,
          totalSales,
          incentive_pct: incentivePct,
          incentivePct,
          earnedIncentives: totalIncentives,
          conversionRate,
          whatsapp_connection: agent.whatsapp_connection || 'agent_owned',
        };
      })
    );

    res.json({ success: true, agents: enriched, count: enriched.length });
  } catch (error) {
    console.error('getAdminAgents error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch team agents' });
  }
};

// @desc  Onboard New Agent
// @route POST /api/admin/agents
// @access SuperAdmin / Admin
exports.createAdminAgent = async (req, res) => {
  try {
    const { name, email, phone, password, role = 'agent', incentive_pct = 10, incentivePct, whatsapp_connection = 'agent_owned', companyRole = 'agent' } = req.body;
    if (!name || !password) {
      return res.status(400).json({ success: false, message: 'Agent name and password are required' });
    }
    if (!email && !phone) {
      return res.status(400).json({ success: false, message: 'Email or phone is required' });
    }

    const cleanPhone = phone ? String(phone).replace(/\D/g, '') : undefined;
    if (email) {
      const exists = await User.findOne({ email: email.toLowerCase() });
      if (exists) return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const username = await generateUniqueUsername(User);
    const usercode = await generateUniqueUsercode(User, 'AGT');
    const pct = incentive_pct !== undefined ? Number(incentive_pct) : Number(incentivePct) || 10;

    const agent = await User.create({
      name: name.trim(),
      email: email ? email.toLowerCase().trim() : undefined,
      phone: cleanPhone,
      password,
      username,
      usercode,
      role: 'user',
      companyRole: companyRole || 'agent',
      workStatus: 'agent',
      companyId: req.user._id,
      createdBy: req.user._id,
      incentive_pct: pct,
      incentivePct: pct,
      commissionRate: pct,
      whatsapp_connection: whatsapp_connection || 'agent_owned',
      plan: 'pro',
      isVerified: true,
      isActive: true,
    });

    const returned = agent.toObject();
    delete returned.password;

    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role || 'admin',
      action: 'AGENT_CREATED',
      targetType: 'agent',
      targetId: agent._id,
      afterState: returned,
      details: `Onboarded agent "${agent.name}" (${usercode}) with ${pct}% incentive rate`,
    });

    res.status(201).json({
      success: true,
      message: `Agent ${agent.name} onboarded successfully (Usercode: ${usercode})`,
      agent: returned,
    });
  } catch (error) {
    console.error('createAdminAgent error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create agent' });
  }
};

// @desc  Modify Agent (Update role, incentive_pct, whatsapp_connection, status)
// @route PATCH /api/admin/agents/:id
// @access SuperAdmin / Admin
exports.updateAdminAgent = async (req, res) => {
  try {
    const { name, phone, email, companyRole, incentive_pct, incentivePct, whatsapp_connection, isActive, password } = req.body;
    const agent = await User.findById(req.params.id);
    if (!agent) return res.status(404).json({ success: false, message: 'Agent not found' });

    const beforeState = agent.toObject();
    delete beforeState.password;

    if (name) agent.name = name.trim();
    if (phone) agent.phone = String(phone).replace(/\D/g, '');
    if (email) agent.email = email.toLowerCase().trim();
    if (companyRole) agent.companyRole = companyRole;
    
    if (incentive_pct !== undefined || incentivePct !== undefined) {
      const pct = Number(incentive_pct !== undefined ? incentive_pct : incentivePct);
      agent.incentive_pct = pct;
      agent.incentivePct = pct;
      agent.commissionRate = pct;
    }

    if (whatsapp_connection) agent.whatsapp_connection = whatsapp_connection;
    if (isActive !== undefined) agent.isActive = Boolean(isActive);
    if (password && password.trim().length >= 6) agent.password = password.trim();

    await agent.save();

    const afterState = agent.toObject();
    delete afterState.password;

    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role || 'admin',
      action: 'AGENT_UPDATED',
      targetType: 'agent',
      targetId: agent._id,
      beforeState,
      afterState,
      details: `Updated settings for agent "${agent.name}"`,
    });

    res.json({ success: true, message: 'Agent details updated successfully', agent: afterState });
  } catch (error) {
    console.error('updateAdminAgent error:', error);
    res.status(500).json({ success: false, message: 'Failed to update agent' });
  }
};

// @desc  Get Agent Activity Logs
// @route GET /api/admin/agents/:id/activity-logs
// @access SuperAdmin / Admin
exports.getAgentActivityLogs = async (req, res) => {
  try {
    const logs = await ActivityLog.find({
      $or: [
        { user_id: req.params.id },
        { userId: req.params.id },
        { target_id: req.params.id },
        { targetId: req.params.id },
      ]
    }).sort({ timestamp: -1, createdAt: -1 }).limit(100).lean();

    res.json({ success: true, logs });
  } catch (error) {
    console.error('getAgentActivityLogs error:', error);
    res.status(500).json({ success: false, message: 'Failed to load activity logs' });
  }
};

// @desc  Get Agents Performance Analytics
// @route GET /api/admin/analytics/agents-performance
// @access SuperAdmin / Admin
exports.getAgentsPerformance = async (req, res) => {
  try {
    const agents = await User.find({
      $or: [
        { role: 'agent' },
        { companyRole: { $in: ['agent', 'manager', 'sales_rep', 'telecaller'] } },
        { workStatus: 'agent' },
        { companyId: req.user._id },
      ]
    }).select('name email phone usercode incentive_pct companyRole').lean();

    const performance = await Promise.all(
      agents.map(async (agent) => {
        const [totalLeads, closedLeads, paymentsAgg] = await Promise.all([
          Lead.countDocuments({ assignedTo: agent._id }),
          Lead.countDocuments({ assignedTo: agent._id, status: { $in: ['converted', 'payment_done', 'closed'] } }),
          Payment.aggregate([
            { $match: { agent_id: agent._id } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
          ]),
        ]);

        const totalSales = paymentsAgg[0]?.total || 0;
        const incentiveRate = agent.incentive_pct || 10;
        const totalIncentives = (totalSales * incentiveRate) / 100;
        const conversionRate = totalLeads > 0 ? Number(((closedLeads / totalLeads) * 100).toFixed(1)) : 0;

        return {
          agentId: agent._id,
          name: agent.name,
          usercode: agent.usercode,
          role: agent.companyRole || 'agent',
          totalLeads,
          closedLeads,
          totalSales,
          incentiveRate,
          totalIncentives,
          conversionRate,
        };
      })
    );

    // Sort by total sales descending
    performance.sort((a, b) => b.totalSales - a.totalSales);

    res.json({ success: true, performance });
  } catch (error) {
    console.error('getAgentsPerformance error:', error);
    res.status(500).json({ success: false, message: 'Failed to load agent performance analytics' });
  }
};

// @desc  Reassign all leads from one agent to another
// @route POST /api/admin/agents/reassign-leads
// @access SuperAdmin / Admin
exports.reassignAgentLeads = async (req, res) => {
  try {
    const { fromAgentId, toAgentId } = req.body;
    if (!fromAgentId) return res.status(400).json({ success: false, message: 'Source agent ID required' });

    const update = toAgentId ? { assignedTo: toAgentId } : { $unset: { assignedTo: 1 } };
    const result = await Lead.updateMany({ assignedTo: fromAgentId }, update);

    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role || 'admin',
      action: 'LEADS_REASSIGNED',
      details: `Reassigned ${result.modifiedCount} lead(s) from agent ID ${fromAgentId} to ${toAgentId || 'Unassigned pool'}`,
    });

    res.json({
      success: true,
      message: `Successfully transferred ${result.modifiedCount} lead(s)`,
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error('reassignAgentLeads error:', error);
    res.status(500).json({ success: false, message: 'Failed to reassign leads' });
  }
};

// ─────────────────────────────────────────────────────────────
// ACTIVITY LOGS & CSV EXPORT
// ─────────────────────────────────────────────────────────────

// @desc  Get activity logs with query filter & CSV export support
// @route GET /api/admin/activity-logs
// @access SuperAdmin / Admin
exports.getActivityLogs = async (req, res) => {
  try {
    const { agent_id, from, to, type, format = 'json', page = 1, limit = 100 } = req.query;
    const query = {};

    if (agent_id) {
      query.$or = [{ user_id: agent_id }, { userId: agent_id }, { target_id: agent_id }, { targetId: agent_id }];
    }
    if (type) query.action = type;
    if (from || to) {
      query.timestamp = {};
      if (from) query.timestamp.$gte = new Date(from);
      if (to) query.timestamp.$lte = new Date(to);
    }

    if (format === 'csv') {
      const logs = await ActivityLog.find(query).sort({ timestamp: -1 }).limit(1000).lean();
      
      let csv = 'Timestamp,Actor,Role,Action,TargetType,TargetID,Details\n';
      logs.forEach(l => {
        const time = `"${new Date(l.timestamp || l.createdAt).toISOString()}"`;
        const actor = `"${(l.userName || 'System').replace(/"/g, '""')}"`;
        const role = `"${(l.role || 'admin').replace(/"/g, '""')}"`;
        const action = `"${(l.action || '').replace(/"/g, '""')}"`;
        const targetType = `"${(l.target_type || l.targetType || '').replace(/"/g, '""')}"`;
        const targetId = `"${(l.target_id || l.targetId || '').replace(/"/g, '""')}"`;
        const details = `"${(l.details || '').replace(/"/g, '""')}"`;
        csv += `${time},${actor},${role},${action},${targetType},${targetId},${details}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=activity_logs_${Date.now()}.csv`);
      return res.send(csv);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [logs, total] = await Promise.all([
      ActivityLog.find(query).sort({ timestamp: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      ActivityLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      logs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (error) {
    console.error('getActivityLogs error:', error);
    res.status(500).json({ success: false, message: 'Failed to load activity logs' });
  }
};

// ─────────────────────────────────────────────────────────────
// TEMPLATES MANAGEMENT
// ─────────────────────────────────────────────────────────────
exports.getAdminTemplates = async (req, res) => {
  try {
    const templates = await Template.find().sort({ createdAt: -1 }).lean();
    res.json({ success: true, templates });
  } catch (error) {
    console.error('getAdminTemplates error:', error);
    res.status(500).json({ success: false, message: 'Failed to load templates' });
  }
};

exports.createAdminTemplate = async (req, res) => {
  try {
    const { name, title, text, body, type = 'followup', content, admin_owned = true } = req.body;
    const tName = name || title;
    const tText = text || body || '';

    if (!tName) return res.status(400).json({ success: false, message: 'Template name/title is required' });

    const template = await Template.create({
      userId: req.user._id,
      title: tName.trim(),
      name: tName.trim(),
      text: tText,
      type: type || 'followup',
      content: content || { body: tText },
      admin_owned: Boolean(admin_owned),
      adminOwned: Boolean(admin_owned),
    });

    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: req.user.role || 'admin',
      action: 'TEMPLATE_CREATED',
      targetType: 'template',
      targetId: template._id,
      afterState: template.toObject(),
      details: `Created message template "${template.title}"`,
    });

    res.status(201).json({ success: true, message: `Template "${template.title}" created`, template });
  } catch (error) {
    console.error('createAdminTemplate error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create template' });
  }
};

// ─────────────────────────────────────────────────────────────
// CAPTURED LEADS (INBOUND SAAS REGISTRATIONS)
// ─────────────────────────────────────────────────────────────
exports.getCapturedLeads = async (req, res) => {
  try {
    const { search, status, typeFilter = 'all', page = 1, limit = 100 } = req.query;
    const query = {
      $or: [
        { userId: req.user._id },
        { source: 'signup' },
        { source: 'platform_registration' },
        { source: 'Auto-Signup' },
        { tags: 'platform_signup' },
        { tags: 'saas_lead' }
      ]
    };

    if (status && status !== 'all') query.status = status;

    if (search) {
      const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$and = [{ $or: [{ name: rx }, { email: rx }, { phone: rx }, { company: rx }] }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [leads, total] = await Promise.all([
      Lead.find(query).sort({ updatedAt: -1, createdAt: -1 }).skip(skip).limit(parseInt(limit)).lean(),
      Lead.countDocuments(query),
    ]);

    const enriched = leads.map(l => {
      const isTest = isTestDataRecord(l);
      return {
        ...l,
        status: normalizeLeadStage(l.status),
        originalStatus: l.status,
        isTestData: isTest,
        isRealData: !isTest,
      };
    });

    const filtered = (typeFilter === 'real')
      ? enriched.filter(l => l.isRealData)
      : (typeFilter === 'test' ? enriched.filter(l => l.isTestData) : enriched);

    res.json({
      success: true,
      leads: filtered,
      total: filtered.length,
      realCount: enriched.filter(l => l.isRealData).length,
      testCount: enriched.filter(l => l.isTestData).length,
      page: parseInt(page),
      pages: Math.ceil(filtered.length / parseInt(limit)),
    });
  } catch (error) {
    console.error('getCapturedLeads error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch captured leads' });
  }
};

// ─────────────────────────────────────────────────────────────
// USER MANAGEMENT & SUBSCRIPTION OVERRIDES
// ─────────────────────────────────────────────────────────────
exports.getUsers = async (req, res) => {
  try {
    const { search, plan, workStatus, typeFilter = 'all', page = 1, limit = 100 } = req.query;
    const query = {};
    if (plan) query.plan = plan;
    if (workStatus) query.workStatus = workStatus;
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(escaped, 'i');
      query.$or = [{ email: rx }, { phone: rx }, { name: rx }, { usercode: rx }, { username: rx }];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(query)
        .select('-password')
        .populate('companyId', 'name usercode companyInfo companySettings')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      User.countDocuments(query),
    ]);

    const userIds = users.map((u) => u._id);
    const leadCounts = await Lead.aggregate([
      { $match: { userId: { $in: userIds } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
    ]);
    const leadMap = {};
    leadCounts.forEach((l) => { leadMap[l._id.toString()] = l.count; });

    const enriched = users.map((u) => {
      const isOrgAgent = (u.companyRole === 'agent' || u.workStatus === 'agent') && Boolean(u.companyId);
      const isOrgOwner = u.workStatus === 'company_owner' || u.companyRole === 'owner';
      const orgName = u.companyId?.companyInfo?.companyName || u.companyId?.name || (isOrgOwner ? (u.companyInfo?.companyName || u.name) : null);
      const orgCode = u.companyId?.usercode || (isOrgOwner ? u.usercode : null);

      let orgTag = null;
      if (isOrgAgent) {
        orgTag = orgName ? `Org: ${orgName} (${orgCode || 'AGENT'})` : 'Organization Sub-Agent';
      } else if (isOrgOwner) {
        orgTag = `Organization Owner (${u.companyInfo?.companyName || u.name})`;
      } else {
        orgTag = 'Single / Independent User';
      }

      const isTest = isTestDataRecord(u);

      return {
        ...u,
        isTestData: isTest,
        isRealData: !isTest,
        leadCount: leadMap[u._id.toString()] || 0,
        organizationTag: orgTag,
        organizationName: orgName,
        organizationCode: orgCode,
        isOrgAgent,
        isOrgOwner,
        isSingleUser: !isOrgAgent && !isOrgOwner,
      };
    });

    const filtered = (typeFilter === 'real')
      ? enriched.filter(u => u.isRealData)
      : (typeFilter === 'test' ? enriched.filter(u => u.isTestData) : enriched);

    const realUsersCount = enriched.filter(u => u.isRealData).length;
    const testUsersCount = enriched.filter(u => u.isTestData).length;

    res.json({
      success: true,
      users: filtered,
      total: filtered.length,
      realUsersCount,
      testUsersCount,
      page: parseInt(page),
      pages: Math.ceil(filtered.length / parseInt(limit)),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.assignPlan = async (req, res) => {
  try {
    const { plan, cycle, expiryDate, durationDays } = req.body;
    if (!plan) return res.status(400).json({ success: false, message: 'Plan identifier is required' });

    const { updateUserPlan } = require('../utils/subscriptionManager');
    const result = await updateUserPlan(req.params.id, plan, cycle || 'monthly', true, {
      expiryDate,
      durationDays,
      adminId: req.user._id,
      adminName: req.user.name,
      paymentMethod: 'admin_override',
    });

    const returnedUser = result.user.toObject ? result.user.toObject() : { ...result.user };
    delete returnedUser.password;
    delete returnedUser.twoFactorSecret;
    delete returnedUser.twoFactorOtp;

    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: 'superadmin',
      action: 'PLAN_ASSIGNED',
      targetType: 'user',
      targetId: req.params.id,
      details: `Assigned plan ${plan.toUpperCase()} to user ${returnedUser.name || returnedUser.email}`,
    });

    res.json({
      success: true,
      message: `Plan updated to ${plan.toUpperCase()} successfully`,
      user: returnedUser,
      subscriptionLifecycle: result.subscriptionLifecycle,
    });
  } catch (error) {
    console.error('assignPlan error:', error);
    res.status(400).json({ success: false, message: error.message || 'Failed to update plan' });
  }
};

exports.toggleUserStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.isActive = !user.isActive;
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, message: `User account ${user.isActive ? 'activated' : 'deactivated'}`, isActive: user.isActive });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.role === 'superadmin' || user.isAdmin || user.email === 'admin@crm.com') {
      return res.status(403).json({ success: false, message: 'Super Admin accounts are protected and cannot be deleted.' });
    }

    await User.findByIdAndDelete(req.params.id);
    await Lead.deleteMany({ userId: req.params.id });

    res.json({ success: true, message: 'User and associated data permanently deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.suspendUser = async (req, res) => {
  try {
    const { level, reason, unsuspend } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    if (user.role === 'superadmin' || user.isAdmin || user.email === 'admin@crm.com') {
      return res.status(403).json({ success: false, message: 'Super Admin accounts cannot be suspended.' });
    }

    if (unsuspend) {
      user.suspension = { isSuspended: false, level: 0, reason: '', suspendedAt: null, suspendedBy: null };
      await user.save({ validateBeforeSave: false });
      return res.json({ success: true, message: 'User suspension lifted successfully', isSuspended: false });
    }

    user.suspension = {
      isSuspended: true,
      level: Number(level) || 1,
      reason: reason || 'Violation of terms of service',
      suspendedAt: new Date(),
      suspendedBy: req.user._id,
    };
    await user.save({ validateBeforeSave: false });

    res.json({ success: true, message: `User suspended at Level ${level}`, suspension: user.suspension });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.overrideSubscription = async (req, res) => {
  try {
    const { targetUserId, planCode, isLifetimeFree = false, overrideDays = 365, bypassExportGate = false, customSeats, customLeads, reason = 'SuperAdmin Override' } = req.body;

    if (!targetUserId) return res.status(400).json({ success: false, message: 'targetUserId is required' });

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) return res.status(404).json({ success: false, message: 'Target user not found' });

    targetUser.isLifetimeFree = Boolean(isLifetimeFree);
    if (planCode) targetUser.plan = planCode;
    targetUser.subscriptionStatus = 'active';
    await targetUser.save({ validateBeforeSave: false });

    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: 'superadmin',
      action: isLifetimeFree ? 'SUPERADMIN_LIFETIME_GRANT' : 'SUPERADMIN_SUBSCRIPTION_OVERRIDE',
      targetType: 'user',
      targetId: targetUser._id,
      details: `${isLifetimeFree ? 'Granted Lifetime Free' : 'Applied subscription override'}: ${reason}`,
    });

    res.json({ success: true, message: `Successfully applied override for ${targetUser.name || targetUser.email}` });
  } catch (error) {
    console.error('SuperAdmin override error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error' });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const { page = 1, limit = 50, action, targetUserId } = req.query;
    const query = {};
    if (action) query.action = action;
    if (targetUserId) query.targetUserId = targetUserId;

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const [logs, total] = await Promise.all([
      AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)).lean(),
      AuditLog.countDocuments(query),
    ]);

    res.json({ success: true, logs, total, page: parseInt(page, 10), pages: Math.ceil(total / parseInt(limit, 10)) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error loading audit logs' });
  }
};

exports.unbanWhatsAppFingerprint = async (req, res) => {
  try {
    const { phone, reason = 'SuperAdmin manual unban' } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'phone number is required' });

    const cleanPhone = String(phone).replace(/\D/g, '');
    const fingerprint = await WAFingerprint.findOne({ phone: cleanPhone });
    if (!fingerprint) return res.status(404).json({ success: false, message: 'No active WhatsApp cooldown record found' });

    fingerprint.unbannedAt = new Date();
    fingerprint.unbannedBy = req.user._id;
    fingerprint.cooldownUntil = new Date(0);
    await fingerprint.save();

    res.json({ success: true, message: `Successfully unbanned WhatsApp number +${cleanPhone}` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
    res.json(coupons);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createCoupon = async (req, res) => {
  try {
    const { code, discountPercent, planGranted, durationDays, maxUses, validUntil } = req.body;
    if (!code) return res.status(400).json({ message: 'Coupon code is required' });

    const exists = await Coupon.findOne({ code: code.toUpperCase().trim() });
    if (exists) return res.status(400).json({ message: 'Coupon code already exists' });

    const coupon = await Coupon.create({
      code: code.toUpperCase().trim(),
      discountPercent: Number(discountPercent) || 0,
      planGranted: planGranted || 'pro',
      durationDays: Number(durationDays) || 30,
      maxUses: maxUses ? Number(maxUses) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      isActive: true,
    });

    res.status(201).json(coupon);
  } catch (error) {
    res.status(500).json({ message: error.message || 'Server error' });
  }
};

exports.deleteCoupon = async (req, res) => {
  try {
    await Coupon.findByIdAndDelete(req.params.id);
    res.json({ message: 'Coupon deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.sendCustomAlert = async (req, res) => {
  try {
    const { userId, title, message, type = 'system_alert' } = req.body;
    if (!title || !message) return res.status(400).json({ message: 'Title and message are required' });

    if (userId === 'all') {
      const users = await User.find({ isActive: true }).select('_id');
      const notifications = users.map((u) => ({
        userId: u._id,
        title,
        message,
        type,
      }));
      await Notification.insertMany(notifications);
      res.json({ message: `Alert dispatched to ${users.length} active users` });
    } else {
      await Notification.create({ userId, title, message, type });
      res.json({ message: 'Alert dispatched to user' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getAbuseLogs = async (req, res) => {
  try {
    const logs = await AbuseLog.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc Purge all fake/test data, accounts, and leads, preserving ONLY SuperAdmin
// @route POST /api/admin/clean-slate
// @access SuperAdmin
exports.purgeFakeDataAndCleanSlate = async (req, res) => {
  try {
    console.log('[Clean Slate] Purging all non-admin data, organizations, agents, and leads...');

    // Load additional models
    const Campaign = require('../models/Campaign');
    const CampaignLog = require('../models/CampaignLog');
    const Group = require('../models/Group');
    const Project = require('../models/Project');
    const ChatMessage = require('../models/ChatMessage');
    const Recording = require('../models/Recording');
    const Transaction = require('../models/Transaction');
    const PaymentAttempt = require('../models/PaymentAttempt');
    const PaymentRequest = require('../models/PaymentRequest');
    const Integration = require('../models/Integration');
    const WhatsAppAuth = require('../models/WhatsAppAuth');

    // 1. Delete all non-admin users (tenants, solo users, company owners, organization agents, sub-agents)
    const userDeleteResult = await User.deleteMany({
      email: { $ne: 'admin@crm.com' },
      isAdmin: { $ne: true },
      role: { $ne: 'superadmin' }
    });

    // 2. Delete all leads
    const leadDeleteResult = await Lead.deleteMany({});

    // 3. Delete all followups
    const followUpDeleteResult = await FollowUp.deleteMany({});

    // 4. Delete all payments, subscriptions, transactions, entitlements
    const paymentDeleteResult = await Payment.deleteMany({});
    await PaymentAttempt.deleteMany({});
    await PaymentRequest.deleteMany({});
    await Subscription.deleteMany({});
    await Entitlement.deleteMany({});
    await Transaction.deleteMany({});
    await Incentive.deleteMany({});

    // 5. Delete all offers & templates
    const offerDeleteResult = await Offer.deleteMany({});
    await Template.deleteMany({});

    // 6. Delete all activity logs, audit logs, abuse logs, notifications
    const activityLogDeleteResult = await ActivityLog.deleteMany({});
    await AuditLog.deleteMany({});
    await AbuseLog.deleteMany({});
    await Notification.deleteMany({});

    // 7. Delete campaigns, groups, projects, chats, recordings, integrations
    await Campaign.deleteMany({});
    await CampaignLog.deleteMany({});
    await Group.deleteMany({});
    await Project.deleteMany({});
    await ChatMessage.deleteMany({});
    await Recording.deleteMany({});
    await Integration.deleteMany({});
    await WAFingerprint.deleteMany({});
    await WhatsAppAuth.deleteMany({});

    // 8. Ensure Super Admin account is 100% healthy, reset 2FA, reset company/agent bindings, and active
    let superAdmin = await User.findOne({
      $or: [
        { email: 'admin@crm.com' },
        { role: 'superadmin' },
        { isAdmin: true }
      ]
    });

    if (!superAdmin) {
      superAdmin = await User.create({
        name: 'Super Admin',
        email: 'admin@crm.com',
        password: process.env.ADMIN_PASSWORD || 'Admin@123',
        username: 'ADMIN77',
        isAdmin: true,
        role: 'superadmin',
        plan: 'pro',
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorRecoveryCodes: [],
      });
    } else {
      superAdmin.twoFactorEnabled = false;
      superAdmin.twoFactorSecret = null;
      superAdmin.twoFactorRecoveryCodes = [];
      superAdmin.twoFactorOtp = null;
      superAdmin.twoFactorOtpExpires = null;
      superAdmin.role = 'superadmin';
      superAdmin.isAdmin = true;
      superAdmin.companyId = null;
      superAdmin.companyRole = null;
      superAdmin.companyInfo = {};
      superAdmin.companySettings = {
        leadSharingMode: 'common_pool',
        allowAgentLeadCreation: true,
        allowAgentExports: false,
        allowAgentBulkDelete: false,
        require2FAForAgents: false,
        incentivePerConversion: 0,
      };
      superAdmin.assignedAgents = [];
      await superAdmin.save();
    }

    console.log(`[Clean Slate] Successfully purged:
      - Users deleted: ${userDeleteResult.deletedCount}
      - Leads deleted: ${leadDeleteResult.deletedCount}
      - Payments deleted: ${paymentDeleteResult.deletedCount}
      - Follow-ups deleted: ${followUpDeleteResult.deletedCount}
      - Offers deleted: ${offerDeleteResult.deletedCount}
      - Activity Logs deleted: ${activityLogDeleteResult.deletedCount}
    `);

    res.json({
      message: 'Database successfully wiped clean! Super Admin preserved in clean state.',
      summary: {
        deletedUsers: userDeleteResult.deletedCount,
        deletedLeads: leadDeleteResult.deletedCount,
        deletedPayments: paymentDeleteResult.deletedCount,
        deletedFollowUps: followUpDeleteResult.deletedCount,
        deletedOffers: offerDeleteResult.deletedCount,
        deletedActivityLogs: activityLogDeleteResult.deletedCount,
        superAdmin: {
          email: superAdmin.email,
          username: superAdmin.username,
          role: superAdmin.role,
          twoFactorEnabled: superAdmin.twoFactorEnabled,
        }
      }
    });
  } catch (error) {
    console.error('purgeFakeDataAndCleanSlate error:', error);
    res.status(500).json({ message: 'Failed to purge database data' });
  }
};

// @desc  Surgically purge ONLY test/fake/dummy generated leads and test accounts, preserving 100% of real users & real leads
// @route POST /api/admin/purge-test-data
// @access SuperAdmin
exports.purgeTestDataOnly = async (req, res) => {
  try {
    // 1. Find all test users (exclude SuperAdmin & real accounts)
    const allUsers = await User.find({ role: { $ne: 'superadmin' }, email: { $ne: 'admin@crm.com' } });
    const testUserIds = allUsers.filter(u => isTestDataRecord(u)).map(u => u._id);

    // 2. Delete test users
    const userDeleteResult = await User.deleteMany({ _id: { $in: testUserIds } });

    // 3. Find and delete test leads
    const allLeads = await Lead.find();
    const testLeadIds = allLeads.filter(l => isTestDataRecord(l) || testUserIds.some(uid => String(uid) === String(l.userId))).map(l => l._id);
    const leadDeleteResult = await Lead.deleteMany({ _id: { $in: testLeadIds } });

    // 4. Delete related follow-ups, payments for test leads
    const [fuResult, payResult] = await Promise.all([
      FollowUp.deleteMany({ lead_id: { $in: testLeadIds } }),
      Payment.deleteMany({ lead_id: { $in: testLeadIds } }),
    ]);

    // 5. Activity log
    await logActivity({
      userId: req.user._id,
      userName: req.user.name,
      role: 'superadmin',
      action: 'PURGE_TEST_DATA',
      details: `Cleaned ${leadDeleteResult.deletedCount} test lead(s) and ${userDeleteResult.deletedCount} test user(s). All real production signups preserved intact.`,
      adminFlag: true,
    });

    res.json({
      success: true,
      message: `🎉 Purged ${leadDeleteResult.deletedCount} test leads and ${userDeleteResult.deletedCount} test user accounts. All real production users and real leads are 100% preserved.`,
      deletedTestLeads: leadDeleteResult.deletedCount,
      deletedTestUsers: userDeleteResult.deletedCount,
      deletedFollowUps: fuResult.deletedCount,
      deletedPayments: payResult.deletedCount,
    });
  } catch (error) {
    console.error('purgeTestDataOnly error:', error);
    res.status(500).json({ success: false, message: 'Failed to purge test data' });
  }
};
