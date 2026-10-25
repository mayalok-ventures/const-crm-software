const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { emitCRMEvent, CRM_EVENTS } = require('../services/automationEvents');
const { auditService } = require('../monitoring/audit/auditService');
const xlsx = require('xlsx');
const PDFDocument = require('pdfkit');
const csv = require('csv-parser');
const { Readable } = require('stream');

// Helper to construct query mathematically enforcing Strict Visibility & Privacy Rules:
// RULE 1: SuperAdmin sees all leads across the platform.
// RULE 2: Workspace Isolation - queries are strictly scoped to user's verified active workspace.
// RULE 3: Counsellor Scope - counsellors see leads assigned to/claimed by them within their workspace (or unclaimed pool).
// RULE 4: Owner/Manager/Solo - see all leads within their workspace.
// RULE 5: Legacy/Solo fallback - exclusively own their own leads.
const buildLeadPermissionQuery = async (user, isUnclaimed = false) => {
  if (!user) {
    return { _id: null };
  }

  // SuperAdmin bypass
  if (user.role === 'superadmin' || user.isAdmin) {
    return {};
  }

  const workspaceId = user.workspaceId;
  const role = user.workspaceRole || user.companyRole;

  if (workspaceId) {
    if (role === 'counsellor' || role === 'counselor') {
      if (isUnclaimed) {
        return {
          workspaceId,
          assignedTo: null,
          currentOwnerId: null,
        };
      }
      return {
        workspaceId,
        $or: [
          { assignedTo: user._id },
          { userId: user._id },
          { currentOwnerId: user._id },
        ],
      };
    }

    // Owner, Manager, Auditor, or solo consultant
    const ownerCompanyId = user.companyId || user._id;
    return {
      $or: [
        { workspaceId },
        { companyId: ownerCompanyId },
        { workspaceId: { $in: [null, undefined] }, userId: user._id },
      ],
    };
  }

  // Legacy fallback for tests or requests before workspace resolution
  const effectiveCompanyId = user.companyId || (user.companyRole === 'owner' ? user._id : null);
  if (effectiveCompanyId) {
    if (user.companyRole === 'owner' || user.companyRole === 'manager') {
      return {
        $or: [
          { companyId: effectiveCompanyId },
          { userId: effectiveCompanyId },
          { userId: user._id },
        ],
      };
    }
    return {
      companyId: effectiveCompanyId,
      $or: [
        { assignedTo: user._id },
        { userId: user._id },
      ],
    };
  }

  return {
    $or: [
      { userId: user._id },
      { assignedTo: user._id },
    ],
  };
};

// Bounded in-memory count cache for pagination (TTL 30s)
const countCache = new Map();
const COUNT_CACHE_TTL = 30000;
function getCachedCount(key) {
  const item = countCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    countCache.delete(key);
    return null;
  }
  return item.count;
}
function setCachedCount(key, count) {
  if (countCache.size > 1000) {
    const firstKey = countCache.keys().next().value;
    countCache.delete(firstKey);
  }
  countCache.set(key, { count, expiresAt: Date.now() + COUNT_CACHE_TTL });
}

// @desc  Get all leads (paginated, filtered, team-aware)
// @route GET /api/leads
// @access Private
exports.getLeads = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      tag,
      search,
      projectId,
      assignedTo,
      source,
      primarySource,
      unclaimed,
      platform,
      connectionId,
      campaignId,
      startDate,
      endDate,
      isTest,
    } = req.query;

    const isUnclaimed = unclaimed === 'true' || unclaimed === true;
    const basePermissionQuery = await buildLeadPermissionQuery(req.user, isUnclaimed);
    const query = { $and: [ basePermissionQuery ] };

    if (status && status !== 'all' && status !== 'undefined') {
      query.status = status;
    }
    if (tag && tag !== 'all' && tag !== 'undefined') {
      query.tags = tag;
    }
    if (projectId && projectId !== 'all' && projectId !== 'undefined' && projectId !== 'null') {
      if (mongoose.Types.ObjectId.isValid(projectId)) {
        query.projectId = projectId;
      }
    }
    if (assignedTo && assignedTo !== 'all' && assignedTo !== 'undefined' && assignedTo !== 'null') {
      if (mongoose.Types.ObjectId.isValid(assignedTo)) {
        query.$and.push({
          $or: [
            { assignedTo: assignedTo },
            { currentOwnerId: assignedTo }
          ]
        });
      }
    }

    // Server-side Source Hierarchy Filters
    if (platform && platform !== 'all' && platform !== 'undefined') {
      const cleanPlatform = String(platform).toLowerCase().trim();
      query.$and.push({
        $or: [
          { 'leadSource.platform': cleanPlatform },
          { 'leadSource.provider': cleanPlatform },
          { source: cleanPlatform },
        ]
      });
    }

    if (connectionId && connectionId !== 'all' && connectionId !== 'undefined') {
      query.$and.push({
        $or: [
          { 'leadSource.connectionId': String(connectionId) },
          { 'leadSource.integrationId': mongoose.Types.ObjectId.isValid(connectionId) ? connectionId : null },
        ]
      });
    }

    if (campaignId && campaignId !== 'all' && campaignId !== 'undefined') {
      query.$and.push({
        $or: [
          { 'leadSource.campaignId': String(campaignId) },
          { 'leadSource.campaignName': new RegExp(String(campaignId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
          { utmCampaign: new RegExp(String(campaignId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        ]
      });
    }

    if (isTest !== undefined && isTest !== null && isTest !== '' && isTest !== 'all') {
      const boolTest = isTest === 'true' || isTest === true;
      query.isTestLead = boolTest;
    }

    if (startDate || endDate) {
      const dateCond = {};
      if (startDate) dateCond.$gte = new Date(startDate);
      if (endDate) dateCond.$lte = new Date(new Date(endDate).setHours(23, 59, 59, 999));
      query.createdAt = dateCond;
    }

    if (source && source !== 'all' && source !== 'undefined') {
      const cleanSrc = String(source).toLowerCase().trim();
      if (cleanSrc === 'ads') {
        query.$and.push({
          $or: [
            { primarySource: { $in: ['SOURCE_C_ADS', 'ads'] } },
            { source: { $in: ['ads', 'meta', 'google', 'webhook', 'facebook', 'instagram', 'adwords'] } },
          ]
        });
      } else if (cleanSrc === 'signup') {
        query.$and.push({
          $or: [
            { primarySource: { $in: ['SOURCE_B_SIGNUP', 'signup'] } },
            { source: { $in: ['signup', 'auto-signup', 'Auto-Signup', 'platform_registration'] } },
          ]
        });
      } else if (cleanSrc === 'manual') {
        query.$and.push({
          $or: [
            { primarySource: { $in: ['SOURCE_A_MANUAL', 'manual'] } },
            { source: { $in: ['manual', 'agent_manual', 'direct', ''] } },
          ]
        });
      } else {
        query.source = new RegExp(cleanSrc, 'i');
      }
    }
    if (primarySource && primarySource !== 'all' && primarySource !== 'undefined') {
      query.primarySource = primarySource;
    }
    if (isUnclaimed) {
      query.$and.push({
        assignedTo: null,
        currentOwnerId: null,
        ownershipStatus: { $nin: ['claimed', 'assigned', 'transferred'] }
      });
    }
    if (search && search.trim()) {
      const trimmed = search.trim();
      if (trimmed.length >= 2) {
        const safeSearch = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const digitsOnly = trimmed.replace(/\D/g, '');
        const safeLower = safeSearch.toLowerCase();

        if (digitsOnly.length >= 3 && /^\d+$/.test(trimmed)) {
          // Dedicated phone search against indexed phoneDigits
          query.$and.push({
            $or: [
              { phoneDigits: new RegExp('^' + digitsOnly) },
              { phoneDigits: new RegExp(digitsOnly + '$') },
              { phone: new RegExp(safeSearch, 'i') },
            ]
          });
        } else {
          // Anchored prefix queries on indexed nameLower & companyLower with full fallback for comprehensive recall
          query.$and.push({
            $or: [
              { nameLower: new RegExp('^' + safeLower) },
              { companyLower: new RegExp('^' + safeLower) },
              { name: new RegExp(safeSearch, 'i') },
              { company: new RegExp(safeSearch, 'i') },
              { phone: new RegExp(safeSearch, 'i') },
              { project: new RegExp(safeSearch, 'i') },
              { location: new RegExp(safeSearch, 'i') },
            ]
          });
        }
      }
    }

    const parsedLimit = Math.max(1, parseInt(limit, 10) || 50);
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (parsedPage - 1) * parsedLimit;
    const cap = Math.min(parsedLimit, 250);

    const countCacheKey = `${req.workspaceId || req.tenantId || req.user?._id}_${JSON.stringify(query)}`;
    const cachedTotal = getCachedCount(countCacheKey);

    const leadsPromise = Lead.find(query)
      .select('-leadActivities -editHistory -customWebhookPayloads')
      .populate('projectId', 'name location basePrice city')
      .populate('assignedTo', 'name usercode email')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(cap)
      .lean();

    const countPromise = (cachedTotal !== null)
      ? Promise.resolve(cachedTotal)
      : Lead.countDocuments(query).then((cnt) => {
          setCachedCount(countCacheKey, cnt);
          return cnt;
        });

    const [leads, total] = await Promise.all([leadsPromise, countPromise]);

    res.json({
      leads,
      total,
      pagination: {
        total,
        page: parsedPage,
        pages: Math.ceil(total / cap),
        limit: cap,
      },
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ message: 'Invalid parameter format' });
    }
    console.error('getLeads error:', error);
    res.status(500).json({ message: 'Server error fetching leads' });
  }
};

// @desc  Get single lead with activity audit trail
// @route GET /api/leads/:id
// @access Private
exports.getLead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || id === 'undefined' || id === 'null' || id === 'placeholder' || id === '[id]' || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid lead ID format' });
    }

    const isSuperAdmin = req.user.role === 'superadmin' || req.user.isAdmin;
    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner' || req.user.role === 'admin';
    const isManager = req.user.role === 'manager' || req.user.companyRole === 'manager';
    const companyId = req.user.companyId || (isOwner ? req.user._id : null);

    let permissionQuery;
    if (req.user.workspaceId) {
      permissionQuery = await buildLeadPermissionQuery(req.user, false);
    } else if (isSuperAdmin || isOwner || isManager) {
      permissionQuery = await buildLeadPermissionQuery(req.user, false);
    } else if (companyId) {
      // Sub-agents can access their assigned leads OR unassigned leads from the common pool to view & claim
      permissionQuery = {
        $and: [
          {
            $or: [
              { companyId: companyId },
              { userId: companyId },
              { sharedWithCompanyId: companyId }
            ]
          },
          {
            $or: [
              { assignedTo: req.user._id },
              { currentOwnerId: req.user._id },
              { userId: req.user._id },
              { assignedTo: null },
              { currentOwnerId: null }
            ]
          }
        ]
      };
    } else {
      permissionQuery = { userId: req.user._id };
    }

    const lead = await Lead.findOne({ _id: id, ...permissionQuery })
      .populate('projectId')
      .populate('assignedTo', 'name usercode email phone')
      .populate({ path: 'releasedBy', select: 'name usercode email', strictPopulate: false })
      .lean();

    if (!lead) return res.status(404).json({ message: 'Lead not found or unauthorized' });
    res.json(lead);
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ message: 'Invalid lead ID format' });
    console.error('getLead error:', error);
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
    const now = new Date(Date.now() + 60000); // 1-minute buffer for clock differences

    const query = {
      $and: [
        basePermissionQuery,
        {
          $or: [
            {
              followUpDate: { $lte: now, $ne: null },
              followUpStatus: { $nin: ['completed', 'cancelled', 'none'] },
            },
            {
              'activeFollowUp.scheduledAt': { $lte: now, $ne: null },
              'activeFollowUp.status': { $nin: ['completed', 'cancelled', 'none'] },
            },
          ],
        },
        {
          followUpStatus: { $nin: ['completed', 'cancelled', 'none'] },
          'activeFollowUp.status': { $nin: ['completed', 'cancelled', 'none'] },
        },
        {
          status: {
            $nin: [
              'closed', 'lost', 'Closed', 'Lost',
              'Closed / Won', 'Lost / Dropped', 'payment_done',
              'converted', 'not_interested'
            ],
          },
        },
      ],
    };

    const leads = await Lead.find(query)
      .populate('projectId', 'name location')
      .populate('assignedTo', 'name usercode email')
      .sort({ updatedAt: -1, followUpDate: -1 })
      .lean();

    res.json(leads);
  } catch (error) {
    console.error('getDueFollowUps error:', error);
    res.status(500).json({ message: 'Server error fetching due follow-ups' });
  }
};

// @desc  Schedule a follow-up with specific date/time and mandatory note
// @route POST /api/leads/:id/follow-up or POST /api/leads/:id/followups
// @access Private
exports.scheduleFollowUp = async (req, res) => {
  try {
    const { scheduledAt, scheduled_at, targetDate, note, scheduleNote, type, siteVisitDetails } = req.body;
    const rawDate = scheduledAt || scheduled_at || targetDate;
    const rawNote = note || scheduleNote;

    if (!rawDate) {
      return res.status(400).json({ success: false, message: 'Scheduled date and time are required.' });
    }

    const parsedDate = new Date(rawDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid follow-up date/time format.' });
    }

    const cleanNote = (rawNote || '').trim();
    if (!cleanNote) {
      return res.status(400).json({ success: false, message: 'Follow-up agenda note is mandatory.' });
    }

    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const lead = await Lead.findOne({ _id: req.params.id, ...basePermissionQuery });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found or unauthorized' });
    }

    const followUpType = type || 'call';
    const cleanSiteVisitDetails = (followUpType === 'site_visit' && siteVisitDetails && typeof siteVisitDetails === 'object')
      ? {
          projectId: siteVisitDetails.projectId || lead.projectId || null,
          inventoryId: siteVisitDetails.inventoryId || null,
          location: String(siteVisitDetails.location || '').trim() || lead.location || '',
          outcome: siteVisitDetails.outcome || null,
          clientFeedback: String(siteVisitDetails.clientFeedback || '').trim(),
          nextAction: String(siteVisitDetails.nextAction || '').trim(),
        }
      : undefined;

    if (followUpType === 'site_visit') {
      lead.siteVisitDate = parsedDate;
      if (cleanSiteVisitDetails?.location && !lead.location) {
        lead.location = cleanSiteVisitDetails.location;
      }
      if (cleanSiteVisitDetails?.projectId && !lead.projectId) {
        lead.projectId = cleanSiteVisitDetails.projectId;
      }
    }

    // Set active follow-up state (reset delay count to 0)
    lead.activeFollowUp = {
      scheduledAt: parsedDate,
      note: cleanNote,
      status: 'scheduled',
      delayCount: 0,
      delayHistory: [],
      lastRungAt: null,
      completedAt: null,
      completionNote: '',
      completedBy: null,
    };

    lead.followUpDate = parsedDate;
    lead.followUpNote = cleanNote;
    lead.followUpStatus = 'scheduled';
    lead.followUpDelayCount = 0;
    lead.followUpNotified = false;

    lead.leadActivities.push({
      action: followUpType === 'site_visit' ? 'site_visit_scheduled' : 'followup_scheduled',
      performedBy: req.user._id,
      performerName: req.user.name,
      details: `${followUpType === 'site_visit' ? 'Site visit' : 'Follow-up'} scheduled for ${parsedDate.toLocaleString()}: "${cleanNote}"${cleanSiteVisitDetails?.location ? ` at ${cleanSiteVisitDetails.location}` : ''}`,
      timestamp: new Date(),
    });

    await lead.save();

    // Create / update FollowUp audit record
    try {
      const FollowUp = require('../models/FollowUp');
      await FollowUp.create({
        lead_id: lead._id,
        leadId: lead._id,
        agent_id: lead.assignedTo || req.user._id,
        agentId: lead.assignedTo || req.user._id,
        scheduled_at: parsedDate,
        scheduledAt: parsedDate,
        note: cleanNote,
        delay_count: 0,
        type: followUpType,
        siteVisitDetails: cleanSiteVisitDetails,
        status: 'open',
        companyId: lead.companyId || req.user.companyId || req.user._id,
        createdBy: req.user._id,
        creatorName: req.user.name,
      });
    } catch (fuErr) {
      console.warn('[FollowUp Audit] Non-blocking audit record notice:', fuErr.message);
    }


    // Dispatched CRM event
    emitCRMEvent(CRM_EVENTS.FOLLOWUP_SCHEDULED, {
      lead,
      scheduledAt: parsedDate,
      note: cleanNote,
      user: req.user,
    });

    res.status(201).json({
      success: true,
      message: `${followUpType === 'site_visit' ? 'Site visit' : 'Follow-up'} scheduled successfully ⏰`,
      lead,
    });
  } catch (error) {
    console.error('scheduleFollowUp error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error scheduling follow-up' });
  }
};

// @desc  Apply delay / snooze to an active follow-up (5m to 60m, strictly max 2 delays)
// @route POST /api/leads/:id/follow-up/delay or POST /api/leads/:id/followups/delay
// @access Private
exports.delayFollowUp = async (req, res) => {
  try {
    const { delayMinutes, minutes, reason } = req.body;
    const delayMins = parseInt(delayMinutes || minutes || 0, 10);

    if (isNaN(delayMins) || delayMins < 5 || delayMins > 60) {
      return res.status(400).json({
        success: false,
        message: 'Delay duration must be between 5 minutes and 60 minutes (1 hour).',
      });
    }

    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const lead = await Lead.findOne({ _id: req.params.id, ...basePermissionQuery });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found or unauthorized' });
    }

    // Safely normalize maxSnoozeCount handling boundary values: 0, missing, negative, invalid
    let maxDelays = 2; // Default fallback if workspace settings are missing
    if (req.workspace?.settings?.maxSnoozeCount !== undefined && req.workspace?.settings?.maxSnoozeCount !== null) {
      const parsed = Number(req.workspace.settings.maxSnoozeCount);
      if (!isNaN(parsed) && parsed >= 0) {
        maxDelays = Math.floor(parsed);
      }
    }

    const currentDelays = lead.activeFollowUp?.delayCount ?? lead.followUpDelayCount ?? 0;
    if (currentDelays >= maxDelays) {
      return res.status(400).json({
        success: false,
        code: 'MAX_DELAYS_REACHED',
        message: maxDelays === 0
          ? 'Follow-up snoozing is disabled for this workspace. An outcome note is required to complete it.'
          : `Maximum ${maxDelays} snoozes reached for this follow-up. You must add an outcome note to complete it.`,
        currentDelays,
        maxDelays,
      });
    }

    const newDelayCount = currentDelays + 1;
    const newScheduledAt = new Date(Date.now() + delayMins * 60 * 1000);

    if (!lead.activeFollowUp) {
      lead.activeFollowUp = {
        scheduledAt: newScheduledAt,
        note: lead.followUpNote || 'Follow-Up',
        status: 'scheduled',
        delayCount: newDelayCount,
        delayHistory: [],
      };
    } else {
      lead.activeFollowUp.scheduledAt = newScheduledAt;
      lead.activeFollowUp.delayCount = newDelayCount;
      lead.activeFollowUp.status = 'scheduled';
    }

    lead.activeFollowUp.delayHistory.push({
      delayedAt: new Date(),
      delayedUntil: newScheduledAt,
      delayMinutes: delayMins,
      reason: (reason || '').trim(),
      performedBy: req.user._id,
    });

    lead.followUpDate = newScheduledAt;
    lead.followUpDelayCount = newDelayCount;
    lead.followUpStatus = 'scheduled';
    lead.followUpNotified = false;

    lead.leadActivities.push({
      action: 'followup_postponed',
      performedBy: req.user._id,
      performerName: req.user.name,
      details: `Follow-up delayed by ${delayMins} mins (Delay ${newDelayCount}/${maxDelays}). Rescheduled to ${newScheduledAt.toLocaleString()}${reason ? ': "' + reason.trim() + '"' : ''}`,
      timestamp: new Date(),
    });

    await lead.save();

    // Update FollowUp audit record
    try {
      const FollowUp = require('../models/FollowUp');
      const latestFu = await FollowUp.findOne({ lead_id: lead._id, status: { $in: ['open', 'postponed'] } }).sort({ createdAt: -1 });
      if (latestFu) {
        latestFu.scheduled_at = newScheduledAt;
        latestFu.scheduledAt = newScheduledAt;
        latestFu.delay_count = newDelayCount;
        latestFu.delayCount = newDelayCount;
        latestFu.postpone_remark = reason ? reason.trim() : `Delayed by ${delayMins}m (${newDelayCount}/${maxDelays})`;
        latestFu.status = 'postponed';
        await latestFu.save();
      }
    } catch (e) {}

    res.json({
      success: true,
      message: `Follow-up delayed by ${delayMins} minutes (${newDelayCount}/${maxDelays} used) ⏰`,
      lead,
      delayCount: newDelayCount,
      remainingDelays: Math.max(0, maxDelays - newDelayCount),
      newScheduledAt,
    });
  } catch (error) {
    console.error('delayFollowUp error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error delaying follow-up' });
  }
};

// @desc  Reschedule a follow-up appointment with mandatory reason (new scheduled date/time and resets snooze limit)
// @route POST /api/leads/:id/follow-up/reschedule or POST /api/leads/:id/followups/reschedule
// @access Private
exports.rescheduleFollowUp = async (req, res) => {
  try {
    const { scheduledAt, scheduled_at, newDate, reason, note } = req.body;
    const rawDate = scheduledAt || scheduled_at || newDate;
    const rawReason = reason || note;

    if (!rawDate) {
      return res.status(400).json({ success: false, message: 'New scheduled date and time are required.' });
    }
    const parsedDate = new Date(rawDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid date/time format.' });
    }
    const cleanReason = (rawReason || '').trim();
    if (!cleanReason) {
      return res.status(400).json({ success: false, message: 'A reason for rescheduling is mandatory.' });
    }

    const basePermissionQuery = await buildLeadPermissionQuery(req.user, false);
    const lead = await Lead.findOne({ _id: req.params.id, ...basePermissionQuery });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found or unauthorized' });
    }

    const previousDate = lead.activeFollowUp?.scheduledAt || lead.followUpDate;

    // Rescheduling resets the delay count because it is a new planned appointment
    lead.activeFollowUp = {
      scheduledAt: parsedDate,
      note: cleanReason,
      status: 'scheduled',
      delayCount: 0,
      delayHistory: [],
      lastRungAt: null,
      completedAt: null,
      completionNote: '',
      completedBy: null,
    };

    lead.followUpDate = parsedDate;
    lead.followUpNote = cleanReason;
    lead.followUpStatus = 'scheduled';
    lead.followUpDelayCount = 0;
    lead.followUpNotified = false;

    lead.leadActivities.push({
      action: 'followup_rescheduled',
      performedBy: req.user._id,
      performerName: req.user.name,
      details: `Follow-up rescheduled from ${previousDate ? new Date(previousDate).toLocaleString() : 'N/A'} to ${parsedDate.toLocaleString()}. Reason: "${cleanReason}"`,
      timestamp: new Date(),
    });

    await lead.save();

    // Mark previous open FollowUp model as rescheduled and insert new one
    try {
      const FollowUp = require('../models/FollowUp');
      await FollowUp.updateMany(
        { lead_id: lead._id, status: { $in: ['open', 'postponed'] } },
        { $set: { status: 'rescheduled', completed_at: new Date(), completed_note: `Rescheduled: ${cleanReason}` } }
      );
      await FollowUp.create({
        lead_id: lead._id,
        leadId: lead._id,
        workspaceId: lead.workspaceId || req.workspaceId,
        agent_id: lead.assignedTo || req.user._id,
        agentId: lead.assignedTo || req.user._id,
        scheduled_at: parsedDate,
        scheduledAt: parsedDate,
        note: cleanReason,
        delay_count: 0,
        type: 'call',
        status: 'open',
        companyId: lead.companyId || req.user.companyId || req.user._id,
        createdBy: req.user._id,
        creatorName: req.user.name,
      });
    } catch (fuErr) {
      console.warn('[FollowUp Reschedule Audit] Non-blocking notice:', fuErr.message);
    }

    emitCRMEvent(CRM_EVENTS.FOLLOWUP_SCHEDULED, {
      lead,
      scheduledAt: parsedDate,
      note: cleanReason,
      user: req.user,
    });

    res.json({
      success: true,
      message: `Follow-up rescheduled successfully to ${parsedDate.toLocaleString()} 📅`,
      lead,
    });
  } catch (error) {
    console.error('rescheduleFollowUp error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error rescheduling follow-up' });
  }
};

// @desc  Complete follow-up with mandatory outcome note (permanently stops alarm & optionally sets next follow-up)
// @route POST /api/leads/:id/follow-up/complete or POST /api/leads/:id/followups/complete
// @access Private
exports.completeFollowUp = async (req, res) => {
  try {
    const { outcomeNote, note, completionNote, nextFollowUp, siteVisitOutcome, outcome, clientFeedback, nextAction } = req.body;
    const cleanNote = (outcomeNote || note || completionNote || '').trim();
    const resolvedOutcome = siteVisitOutcome || outcome || null;

    if (!cleanNote) {
      return res.status(400).json({
        success: false,
        message: 'Mandatory outcome note is required to complete follow-up and stop the alarm.',
      });
    }

    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const lead = await Lead.findOne({ _id: req.params.id, ...basePermissionQuery });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found or unauthorized' });
    }

    // 1. Mark active follow-up completed
    if (!lead.activeFollowUp) {
      lead.activeFollowUp = {
        scheduledAt: lead.followUpDate,
        note: lead.followUpNote || '',
        status: 'completed',
        delayCount: lead.followUpDelayCount || 0,
        completedAt: new Date(),
        completionNote: cleanNote,
        completedBy: req.user._id,
      };
    } else {
      lead.activeFollowUp.status = 'completed';
      lead.activeFollowUp.completedAt = new Date();
      lead.activeFollowUp.completionNote = cleanNote;
      lead.activeFollowUp.completedBy = req.user._id;
    }

    // 2. Append outcome note to lead notes
    lead.notes.push({
      text: `[Follow-Up Completed]: ${cleanNote}${resolvedOutcome ? ` (Outcome: ${resolvedOutcome})` : ''}`,
      createdBy: req.user._id,
      authorName: req.user.name || 'Agent',
      createdAt: new Date(),
    });

    lead.leadActivities.push({
      action: 'followup_completed',
      performedBy: req.user._id,
      performerName: req.user.name,
      details: `Follow-up completed & alarm silenced. Outcome: "${cleanNote}"${resolvedOutcome ? ` [Result: ${resolvedOutcome}]` : ''}`,
      timestamp: new Date(),
    });

    // 3. Update FollowUp collection record
    try {
      const FollowUp = require('../models/FollowUp');
      await FollowUp.updateMany(
        { lead_id: lead._id, status: { $in: ['open', 'postponed'] } },
        {
          $set: {
            status: 'completed',
            completed_at: new Date(),
            completedAt: new Date(),
            completion_note: cleanNote,
            completionNote: cleanNote,
            ...(resolvedOutcome ? { 'siteVisitDetails.outcome': resolvedOutcome } : {}),
            ...(clientFeedback ? { 'siteVisitDetails.clientFeedback': String(clientFeedback).trim() } : {}),
            ...(nextAction ? { 'siteVisitDetails.nextAction': String(nextAction).trim() } : {}),
          },
        }
      );
    } catch (e) {}

    // 4. Handle Next-Day / Future Follow-Up (if provided)
    let nextScheduledMessage = '';
    if (nextFollowUp && (nextFollowUp.scheduledAt || nextFollowUp.scheduled_at || nextFollowUp.targetDate)) {
      const rawNextDate = nextFollowUp.scheduledAt || nextFollowUp.scheduled_at || nextFollowUp.targetDate;
      const nextDate = new Date(rawNextDate);
      if (!isNaN(nextDate.getTime())) {
        const nextAgenda = (nextFollowUp.note || nextFollowUp.scheduleNote || '').trim() || `Next step after: ${cleanNote}`;
        const nextType = nextFollowUp.type || 'call';

        // Reset follow-up cycle with delayCount = 0
        lead.activeFollowUp = {
          scheduledAt: nextDate,
          note: nextAgenda,
          status: 'scheduled',
          delayCount: 0,
          delayHistory: [],
          lastRungAt: null,
          completedAt: null,
          completionNote: '',
          completedBy: null,
        };
        lead.followUpDate = nextDate;
        lead.followUpNote = nextAgenda;
        lead.followUpStatus = 'scheduled';
        lead.followUpDelayCount = 0;
        lead.followUpNotified = false;

        lead.leadActivities.push({
          action: 'followup_scheduled',
          performedBy: req.user._id,
          performerName: req.user.name,
          details: `Next follow-up scheduled for ${nextDate.toLocaleString()}: "${nextAgenda}"`,
          timestamp: new Date(),
        });

        try {
          const FollowUp = require('../models/FollowUp');
          await FollowUp.create({
            lead_id: lead._id,
            leadId: lead._id,
            agent_id: lead.assignedTo || req.user._id,
            agentId: lead.assignedTo || req.user._id,
            scheduled_at: nextDate,
            scheduledAt: nextDate,
            note: nextAgenda,
            delay_count: 0,
            type: nextType,
            status: 'open',
            companyId: lead.companyId || req.user.companyId || req.user._id,
            createdBy: req.user._id,
            creatorName: req.user.name,
          });
        } catch (e) {}

        nextScheduledMessage = ` and next follow-up scheduled for ${nextDate.toLocaleDateString()}`;
      }
    } else {
      // Clear follow-up date and scheduledAt so alarm stops permanently
      if (lead.activeFollowUp) {
        lead.activeFollowUp.scheduledAt = null;
        lead.activeFollowUp.status = 'completed';
      }
      lead.followUpDate = null;
      lead.followUpNote = '';
      lead.followUpStatus = 'completed';
      lead.followUpDelayCount = 0;
      lead.followUpNotified = true;
    }

    await lead.save();

    res.json({
      success: true,
      message: `Follow-up completed & alarm silenced permanently${nextScheduledMessage} ✅`,
      lead,
    });
  } catch (error) {
    console.error('completeFollowUp error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error completing follow-up' });
  }
};

// @desc  Cancel / Stop a follow-up and permanently silence alarm
// @route POST /api/leads/:id/follow-up/cancel or POST /api/leads/:id/followups/cancel
// @access Private
exports.cancelFollowUp = async (req, res) => {
  try {
    const { reason, note } = req.body;
    const cleanReason = (reason || note || 'Follow-up cancelled by user').trim();

    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const lead = await Lead.findOne({ _id: req.params.id, ...basePermissionQuery });
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found or unauthorized' });
    }

    if (!lead.activeFollowUp) {
      lead.activeFollowUp = {
        scheduledAt: null,
        note: '',
        status: 'cancelled',
        delayCount: 0,
        completedAt: new Date(),
        completionNote: `[Cancelled]: ${cleanReason}`,
        completedBy: req.user._id,
      };
    } else {
      lead.activeFollowUp.scheduledAt = null;
      lead.activeFollowUp.status = 'cancelled';
      lead.activeFollowUp.completedAt = new Date();
      lead.activeFollowUp.completionNote = `[Cancelled]: ${cleanReason}`;
      lead.activeFollowUp.completedBy = req.user._id;
    }

    lead.followUpDate = null;
    lead.followUpNote = '';
    lead.followUpStatus = 'cancelled';
    lead.followUpDelayCount = 0;
    lead.followUpNotified = true;

    lead.notes.push({
      text: `[Follow-Up Stopped]: ${cleanReason}`,
      createdBy: req.user._id,
      authorName: req.user.name || 'Agent',
      createdAt: new Date(),
    });

    lead.leadActivities.push({
      action: 'followup_cancelled',
      performedBy: req.user._id,
      performerName: req.user.name,
      details: `Follow-up stopped and alarm permanently silenced. Reason: "${cleanReason}"`,
      timestamp: new Date(),
    });

    // Also cancel any open or postponed records in FollowUp collection
    try {
      const FollowUp = require('../models/FollowUp');
      await FollowUp.updateMany(
        { lead_id: lead._id, status: { $in: ['open', 'postponed'] } },
        {
          $set: {
            status: 'cancelled',
            completed_at: new Date(),
            completedAt: new Date(),
            completion_note: cleanReason,
            completionNote: cleanReason,
          },
        }
      );
    } catch (e) {}

    await lead.save();

    // Log global activity
    try {
      const ActivityLog = require('../models/ActivityLog');
      await ActivityLog.create({
        user_id: req.user._id,
        userId: req.user._id,
        userName: req.user.name,
        role: req.user.role || 'agent',
        action: 'FOLLOWUP_CANCELLED',
        target_type: 'lead',
        targetType: 'lead',
        target_id: String(lead._id),
        targetId: String(lead._id),
        details: `Follow-up stopped for ${lead.name} (${lead.phone}). Reason: ${cleanReason}`,
      });
    } catch (e) {}

    res.json({
      success: true,
      message: 'Follow-up stopped & alarm silenced permanently ✅',
      lead,
    });
  } catch (error) {
    console.error('cancelFollowUp error:', error);
    res.status(500).json({ success: false, message: 'Server error cancelling follow-up' });
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

// @desc  Create candidate admission lead with activity logging
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

    // Dynamic Form Schema Backend Validation (Conditional & Custom Fields)
    const { validateFormData } = require('../utils/formValidator');
    const { getIndustryDefaults } = require('../utils/industryTemplates');
    
    let activeLeadSchema = req.user?.leadFormSchema;
    if ((!activeLeadSchema || activeLeadSchema.length === 0) && req.user.companyId) {
      const companyOwner = await User.findById(req.user.companyId).lean();
      if (companyOwner && Array.isArray(companyOwner.leadFormSchema) && companyOwner.leadFormSchema.length > 0) {
        activeLeadSchema = companyOwner.leadFormSchema;
      }
    }
    if (!activeLeadSchema || activeLeadSchema.length === 0) {
      activeLeadSchema = getIndustryDefaults(req.user?.industryType, req.user?.educationSubProfile).leadFormSchema;
    }

    const validationResult = validateFormData(activeLeadSchema, req.body);
    if (!validationResult.isValid) {
      const firstError = Object.values(validationResult.errors)[0] || 'Validation failed';
      return res.status(400).json({
        message: firstError,
        errors: validationResult.errors,
      });
    }

    const parsedFollowUpDate = (followUpDate && String(followUpDate).trim() !== '') ? new Date(followUpDate) : null;
    const cleanPhone = phone ? String(phone).replace(/\D/g, '') : '';
    const resolvedName = (name && String(name).trim()) || (cleanPhone ? `Lead (${cleanPhone})` : `Lead #${Date.now().toString().slice(-4)}`);

    const isOwner = req.user.workStatus === 'company_owner' || req.user.companyRole === 'owner';
    const companyId = req.user.companyId || (isOwner ? req.user._id : null);

    // Multi-tenant Phone duplicate check (Company level when attached, or solo user level) - only when phone is provided
    if (cleanPhone) {
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
    }

    // Centralized Plan Entitlements & Resource Cap Enforcement
    const isSuperAdminUser = req.user.role === 'superadmin' || req.user.isAdmin;
    if (!isSuperAdminUser) {
      try {
        const { assertLimit } = require('../services/entitlementService');
        await assertLimit(companyId || req.user._id, 'leads', 1);
      } catch (limitErr) {
        return res.status(limitErr.statusCode || 403).json({
          success: false,
          code: limitErr.code || 'PLAN_LIMIT_EXCEEDED',
          message: limitErr.message,
          resource: 'leads',
          limit: limitErr.limit,
          currentUsage: limitErr.currentUsage,
          upgradeRequired: true,
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

    // RULE 4: Single User to Organization Collaboration
    const isSingleUserShared = !companyId && Boolean(req.user.connectedCompanyId && req.user.shareLeadsWithCompany);
    const sharedWithCompanyId = isSingleUserShared ? req.user.connectedCompanyId : (req.body.sharedWithCompanyId || null);
    const isSharedFromSingleUser = Boolean(sharedWithCompanyId && !companyId);
    const sharedByUserName = isSharedFromSingleUser ? req.user.name : '';

    let leadTags = Array.isArray(tags) ? [...tags] : (tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []);
    if (!leadTags.some(t => ['manual', 'manual entry', 'self created', 'direct outreach', 'ads lead', 'bulk import'].includes(t.toLowerCase()))) {
      leadTags.unshift('Manual Entry');
    }
    if (isSharedFromSingleUser && !leadTags.some(t => t.toLowerCase().includes('shared by'))) {
      leadTags.push(`Shared by ${req.user.name}`);
    }

    const initialFollowUpNote = req.body.followUpNote || req.body.scheduleNote || '';
    const initialActiveFollowUp = parsedFollowUpDate ? {
      scheduledAt: parsedFollowUpDate,
      note: initialFollowUpNote.trim() || 'Initial Follow-Up Scheduled on Creation',
      status: 'scheduled',
      delayCount: 0,
      delayHistory: [],
    } : { status: 'none', delayCount: 0, delayHistory: [] };

    const resolvedCompanyId = companyId || (req.workspace && req.workspace.ownerId) || req.user.companyId || (req.user.companyRole === 'owner' ? req.user._id : req.user._id);
    const resolvedWorkspaceId = req.workspaceId || req.user.workspaceId || (req.workspace && req.workspace._id) || null;

    let targetAssignedTo = req.user._id;
    let targetAssignedToName = req.user.name;

    if (req.body.assignedTo && mongoose.Types.ObjectId.isValid(req.body.assignedTo)) {
      const isPrivileged = req.user.role === 'superadmin' || 
                           req.user.role === 'admin' || 
                           req.user.companyRole === 'owner' || 
                           req.user.companyRole === 'manager' ||
                           req.membership?.role === 'owner' ||
                           req.membership?.role === 'manager';
      if (isPrivileged || String(req.body.assignedTo) === String(req.user._id)) {
        const assignee = await User.findById(req.body.assignedTo).select('name');
        if (assignee) {
          targetAssignedTo = assignee._id;
          targetAssignedToName = assignee.name;
        }
      }
    }

    const lead = await Lead.create({
      userId: req.user._id,
      companyId: resolvedCompanyId,
      workspaceId: resolvedWorkspaceId,
      assignedTo: targetAssignedTo,
      assignedToName: targetAssignedToName,
      name: resolvedName,
      phone: cleanPhone,
      email: email ? email.toLowerCase().trim() : undefined,
      company: company || undefined,
      tags: leadTags,
      status: status || firstStage,
      propertyType: propertyType || '',
      budget: budget || '',
      location: location || '',
      profession: profession || '',
      project: project || '',
      projectId: projectId || null,
      siteVisitDate: siteVisitDate ? new Date(siteVisitDate) : null,
      areasOfInterest: Array.isArray(areasOfInterest) ? areasOfInterest : (areasOfInterest ? areasOfInterest.split(',').map(a => a.trim()).filter(Boolean) : []),
      activeFollowUp: initialActiveFollowUp,
      followUpDate: parsedFollowUpDate,
      followUpNote: initialFollowUpNote.trim(),
      followUpStatus: parsedFollowUpDate ? 'scheduled' : 'none',
      followUpDelayCount: 0,
      followUpNotified: parsedFollowUpDate ? false : true,
      customData: finalCustomData,
      source: source || 'agent_manual',
      utmCampaign: utmCampaign || '',
      utmMedium: utmMedium || '',
      utmSource: utmSource || '',
      lostReason: lostReason || '',
      lostReasonDetail: lostReasonDetail || '',
      leadActivities: [{
        action: 'lead_created',
        performedBy: req.user._id,
        performerName: req.user.name,
        details: `Lead created in CRM pipeline by ${req.user.name}${isSharedFromSingleUser ? ' (Shared with Organization)' : ''}`,
        timestamp: new Date(),
      }],
    });

    emitCRMEvent(CRM_EVENTS.LEAD_CREATED, { lead, user: req.user });
    if (lead.customData?.targetCountry) {
      emitCRMEvent(CRM_EVENTS.LEAD_FIELD_UPDATED, {
        lead,
        updatedFields: { targetCountry: lead.customData.targetCountry },
        user: req.user
      });
    }

    // Record Immutable Audit Log
    auditService.record({
      actor: req.user,
      organizationId: lead.companyId || req.user.companyId,
      action: 'CREATE',
      resourceType: 'Lead',
      resourceId: lead._id,
      resourceName: lead.name,
      after: {
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
        company: lead.company,
        budget: lead.budget,
        assignedTo: lead.assignedToName || 'Unassigned',
      },
      req,
      metadata: { source: lead.source, status: lead.status },
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

      // Trigger split incentive calculation dynamically on WON status conversion
      const { triggerWonIncentiveCalculation } = require('./agencyController');
      triggerWonIncentiveCalculation(lead._id, lead.companyId).catch(err => console.error('[Incentive Calculation Hook Error]:', err.message));
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

    if (req.body.pipeline_stage !== undefined && req.body.pipelineStage === undefined) {
      req.body.pipelineStage = req.body.pipeline_stage;
    }
    if (req.body.pipelineStage !== undefined && req.body.status === undefined) {
      req.body.status = req.body.pipelineStage;
    }
    if (req.body.status !== undefined && req.body.pipelineStage === undefined) {
      req.body.pipelineStage = req.body.status;
    }

    const allowedFields = [
      'name', 'phone', 'email', 'company', 'tags', 'status', 'followUpDate',
      'location', 'profession', 'budget', 'closedDealAmount', 'areasOfInterest', 'project',
      'projectId', 'propertyType', 'siteVisitDate', 'assignedTo', 'customData',
      'utmCampaign', 'utmMedium', 'utmSource', 'lostReason', 'lostReasonDetail',
      'service_required', 'monthly_spend', 'goal_timeline', 'paid_amount', 'payable_amount', 'payment_method',
      'budgetMin', 'budgetMax', 'possessionTimeline', 'purchasePurpose', 'preferredConfigurations',
      'pipelineId', 'pipelineStage', 'temperature', 'score'
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

    // Event-Driven Automations Dispatch
    if (changes.status) {
      emitCRMEvent(CRM_EVENTS.LEAD_STAGE_CHANGED, {
        lead,
        oldStage: changes.status.from,
        newStage: changes.status.to,
        user: req.user,
      });
    }
    if (req.body.targetCountry || req.body['customData.targetCountry'] || req.body.customData?.targetCountry) {
      emitCRMEvent(CRM_EVENTS.LEAD_FIELD_UPDATED, {
        lead,
        updatedFields: {
          targetCountry: req.body.targetCountry || req.body['customData.targetCountry'] || req.body.customData?.targetCountry,
        },
        user: req.user,
      });
    }


    // Record Immutable Audit Log if changes occurred
    if (Object.keys(changes).length > 0) {
      const formattedDeltas = {};
      for (const [k, chg] of Object.entries(changes)) {
        formattedDeltas[k] = { from: chg.old, to: chg.new };
      }
      auditService.record({
        actor: req.user,
        organizationId: lead.companyId || req.user.companyId,
        action: 'UPDATE',
        resourceType: 'Lead',
        resourceId: lead._id,
        resourceName: lead.name,
        changes: formattedDeltas,
        req,
      });
    }

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

    // Record Immutable Audit Log
    auditService.record({
      actor: req.user,
      organizationId: lead.companyId || req.user.companyId,
      action: 'DELETE',
      resourceType: 'Lead',
      resourceId: lead._id,
      resourceName: lead.name,
      before: {
        name: lead.name,
        phone: lead.phone,
        status: lead.status,
        company: lead.company,
        budget: lead.budget,
      },
      req,
    });

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

    // Explicit automation invariant (Spec Section 5 & Security Hardening):
    // Client-supplied req.body.autoAdvance must NOT bypass workspace policy or server authorization.
    // Stage auto-advance on note is strictly governed by verified server-side workspace policy.
    const isAdmissionPipeline = ['Lead Received', 'Campus Visit Scheduled', 'Application Submitted', 'Admission Confirmed'].includes(lead.status);
    const hasLegacyCustomStages = Boolean(req.user?.pipelineStages?.length > 1 && req.user.pipelineStages[0] === lead.status);
    
    // Server-enforced authorization: Workspace policy is authoritative.
    const workspacePolicyAllows = req.workspace?.settings?.autoAdvanceStageOnNote === true;
    const legacyAllows = !isAdmissionPipeline && hasLegacyCustomStages && /discovery call completed|call completed|connected with client/i.test(text);

    // Client can never force auto-advance if workspace policy does not allow it
    const shouldAutoAdvance = Boolean(workspacePolicyAllows || legacyAllows);

    const beforeStatus = lead.status;
    if (shouldAutoAdvance) {
      const userStages = req.user.pipelineStages || req.user.customPipelineStages || [];
      const firstStage = userStages[0];
      const secondStage = userStages[1] || 'contacted';

      if (lead.status === 'new_lead') {
        lead.status = 'contacted';
      } else if (['new', 'New Lead', firstStage].includes(lead.status)) {
        lead.status = secondStage;
      }
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

    // Optional explicit follow-up cancellation combined with note
    if (req.body.stopFollowUp || req.body.cancelFollowUp) {
      if (lead.activeFollowUp) {
        lead.activeFollowUp.scheduledAt = null;
        lead.activeFollowUp.status = 'cancelled';
        lead.activeFollowUp.completedAt = new Date();
        lead.activeFollowUp.completionNote = `[Stopped with Note]: ${text.trim()}`;
        lead.activeFollowUp.completedBy = req.user._id;
      }
      lead.followUpDate = null;
      lead.followUpNote = '';
      lead.followUpStatus = 'cancelled';
      lead.followUpDelayCount = 0;
      lead.followUpNotified = true;

      lead.leadActivities.push({
        action: 'followup_cancelled',
        performedBy: req.user._id,
        performerName: req.user.name,
        details: `Active follow-up stopped upon adding note: "${text.trim().slice(0, 50)}${text.length > 50 ? '...' : ''}"`,
        timestamp: new Date(),
      });

      try {
        const FollowUp = require('../models/FollowUp');
        await FollowUp.updateMany(
          { lead_id: lead._id, status: { $in: ['open', 'postponed'] } },
          {
            $set: {
              status: 'cancelled',
              completed_at: new Date(),
              completedAt: new Date(),
              completion_note: text.trim(),
              completionNote: text.trim(),
            },
          }
        );
      } catch (e) {}
    }

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
    const lead = await Lead.findOne({ _id: req.params.id, userId: req.user._id });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found or unauthorized' });

    lead.assignedTo = req.user._id;
    lead.assignedToName = req.user.name;
    await lead.save();

    res.json({
      success: true,
      message: 'Lead verified in your candidate pipeline.',
      lead,
    });
  } catch (error) {
    console.error('reassignLead error:', error);
    res.status(500).json({ success: false, message: 'Server error updating lead' });
  }
};

// @desc  Release / drop lead no-op for single-user system
// @route PUT /api/leads/:id/release or POST /api/leads/:id/release
// @access Private
exports.releaseLead = async (req, res) => {
  try {
    const lead = await Lead.findOne({ _id: req.params.id, userId: req.user._id });
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' });
    res.json({
      success: true,
      message: 'Lead confirmed in your candidate pipeline.',
      lead,
    });
  } catch (error) {
    console.error('releaseLead error:', error);
    res.status(500).json({ success: false, message: 'Server error releasing lead' });
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

    if (req.user.role !== 'superadmin' && !req.user.isAdmin) {
      try {
        const { assertFeature } = require('../services/entitlementService');
        await assertFeature(companyId || req.user._id, 'leadExport');
      } catch (featErr) {
        return res.status(featErr.statusCode || 403).json({
          success: false,
          code: featErr.code || 'FEATURE_NOT_AVAILABLE',
          feature: 'leadExport',
          message: featErr.message,
          upgradeRequired: true,
        });
      }
    }

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

    // Record Immutable Audit Log for Data Export
    auditService.record({
      actor: req.user,
      organizationId: req.user.companyId,
      action: 'EXPORT',
      resourceType: 'Lead',
      resourceName: `Leads Export (${format.toUpperCase()})`,
      req,
      metadata: { format, queryStatus: status || statuses || 'all' },
    });

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
    const { getLimit, getUsage, isUnlimited } = require('../services/entitlementService');
    const targetTenantId = companyId || req.user._id;
    const maxLeadsLimit = req.user.role === 'superadmin' ? -1 : await getLimit(targetTenantId, 'leads');
    const currentCount = await getUsage(targetTenantId, 'leads');

    // Anti-Fraud Daily Import Velocity Enforcement
    const { checkImportVelocity } = require('../middleware/antiFraud');
    const velocityCheck = await checkImportVelocity(targetTenantId, 1);
    if (!velocityCheck.allowed) {
      return res.status(429).json({
        success: false,
        code: velocityCheck.code,
        message: velocityCheck.message,
        dailyLimit: velocityCheck.dailyLimit,
        importedToday: velocityCheck.importedToday,
      });
    }

    if (maxLeadsLimit !== -1 && currentCount >= maxLeadsLimit) {
      return res.status(403).json({
        success: false,
        code: 'PLAN_LIMIT_EXCEEDED',
        message: `You have reached the maximum limit of ${maxLeadsLimit} leads on your active plan. Please upgrade your subscription to import more leads.`,
        resource: 'leads',
        currentUsage: currentCount,
        limit: maxLeadsLimit,
        upgradeRequired: true,
      });
    }

    const maxAllowedNew = maxLeadsLimit === -1 ? Infinity : Math.max(0, maxLeadsLimit - currentCount);
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
        workspaceId: req.user.workspaceId || req.workspaceId,
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
        tags: tagsStr ? (tagsStr.toLowerCase().includes('bulk import') ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : ['Bulk Import', ...tagsStr.split(',').map(t => t.trim()).filter(Boolean)]) : ['Bulk Import'],
        activeFollowUp: followUpDate ? {
          scheduledAt: followUpDate,
          note: 'Bulk Import Follow-Up Scheduled',
          status: 'scheduled',
          delayCount: 0,
          delayHistory: [],
        } : { status: 'none', delayCount: 0, delayHistory: [] },
        followUpDate,
        followUpNote: followUpDate ? 'Bulk Import Follow-Up Scheduled' : '',
        followUpStatus: followUpDate ? 'scheduled' : 'none',
        followUpDelayCount: 0,
        followUpNotified: false,
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

// @desc  Single user toggles sharing lead with an organization (RULE 4)
// @route PUT /api/leads/:id/share-organization
// @access Private (Single User / Creator)
exports.toggleLeadOrgSharing = async (req, res) => {
  return res.json({ success: true, message: 'CRM is operating in exclusive single-user mode.' });
};

// ─────────────────────────────────────────────────────────────
// PHASE 3: K-12 PARENT-CHILD MULTI-INQUIRY CONTROLLERS
// Allows one parent lead to hold multiple child inquiries under 1 phone
// ─────────────────────────────────────────────────────────────

// @desc  Add child inquiry under parent lead (K-12 School Architecture)
// @route POST /api/leads/:id/children
// @access Private
exports.addChildInquiry = async (req, res) => {
  try {
    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const lead = await Lead.findOne({ _id: req.params.id, ...basePermissionQuery });
    if (!lead) return res.status(404).json({ message: 'Lead not found or unauthorized' });

    const { childName, age, dob, gender, gradeApplied, previousSchool, transportRequired, status, notes, customData } = req.body;
    if (!childName || !String(childName).trim()) {
      return res.status(400).json({ message: 'Child name is required' });
    }

    const newChild = {
      childName: String(childName).trim(),
      age: age ? Number(age) : null,
      dob: dob ? new Date(dob) : null,
      gender: gender || null,
      gradeApplied: gradeApplied ? String(gradeApplied).trim() : '',
      previousSchool: previousSchool ? String(previousSchool).trim() : '',
      transportRequired: Boolean(transportRequired),
      status: status ? String(status).trim() : 'Inquiry',
      notes: notes ? String(notes).trim() : '',
      customData: typeof customData === 'object' ? customData : {},
      createdAt: new Date(),
    };

    lead.children.push(newChild);
    lead.leadActivities.push({
      action: 'lead_updated',
      performedBy: req.user._id,
      performerName: req.user.name,
      details: `Added child inquiry: ${newChild.childName} (Grade: ${newChild.gradeApplied || 'N/A'}, Transport: ${newChild.transportRequired ? 'Yes' : 'No'})`,
      timestamp: new Date(),
    });

    await lead.save();
    const createdChild = lead.children[lead.children.length - 1];
    res.status(201).json({ success: true, child: createdChild, lead });
  } catch (error) {
    console.error('addChildInquiry error:', error);
    res.status(500).json({ message: error.message || 'Failed to add child inquiry' });
  }
};

// @desc  Update child inquiry details
// @route PUT /api/leads/:id/children/:childId
// @access Private
exports.updateChildInquiry = async (req, res) => {
  try {
    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const lead = await Lead.findOne({ _id: req.params.id, ...basePermissionQuery });
    if (!lead) return res.status(404).json({ message: 'Lead not found or unauthorized' });

    const child = lead.children.id(req.params.childId);
    if (!child) return res.status(404).json({ message: 'Child inquiry not found' });

    const fields = ['childName', 'age', 'dob', 'gender', 'gradeApplied', 'previousSchool', 'transportRequired', 'status', 'notes', 'customData'];
    fields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'dob' && req.body[field]) child[field] = new Date(req.body[field]);
        else if (field === 'age' && req.body[field] !== null) child[field] = Number(req.body[field]);
        else if (field === 'transportRequired') child[field] = Boolean(req.body[field]);
        else child[field] = req.body[field];
      }
    });

    lead.leadActivities.push({
      action: 'lead_updated',
      performedBy: req.user._id,
      performerName: req.user.name,
      details: `Updated child inquiry: ${child.childName} (Status: ${child.status})`,
      timestamp: new Date(),
    });

    await lead.save();
    res.json({ success: true, child, lead });
  } catch (error) {
    console.error('updateChildInquiry error:', error);
    res.status(500).json({ message: error.message || 'Failed to update child inquiry' });
  }
};

// @desc  Delete child inquiry from parent lead
// @route DELETE /api/leads/:id/children/:childId
// @access Private
exports.deleteChildInquiry = async (req, res) => {
  try {
    const basePermissionQuery = await buildLeadPermissionQuery(req.user);
    const lead = await Lead.findOne({ _id: req.params.id, ...basePermissionQuery });
    if (!lead) return res.status(404).json({ message: 'Lead not found or unauthorized' });

    const child = lead.children.id(req.params.childId);
    if (!child) return res.status(404).json({ message: 'Child inquiry not found' });

    const deletedName = child.childName;
    child.deleteOne();

    lead.leadActivities.push({
      action: 'lead_updated',
      performedBy: req.user._id,
      performerName: req.user.name,
      details: `Removed child inquiry: ${deletedName}`,
      timestamp: new Date(),
    });

    await lead.save();
    res.json({ success: true, message: `Child inquiry for ${deletedName} deleted successfully`, lead });
  } catch (error) {
    console.error('deleteChildInquiry error:', error);
    res.status(500).json({ message: error.message || 'Failed to delete child inquiry' });
  }
};

exports.buildLeadPermissionQuery = buildLeadPermissionQuery;

