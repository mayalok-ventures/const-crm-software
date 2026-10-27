const AutomationRule = require('../models/AutomationRule');
const AutomationLog = require('../models/AutomationLog');
const Lead = require('../models/Lead');
const AutomationEngine = require('../services/automationEngine');
const AutomationRegistry = require('../services/automationRegistry');

function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Controller handling Automation Rules, Inbound Chatbots, and Execution Logs
 */

// @desc    Get canonical automation capabilities, triggers, actions, and fields
// @route   GET /api/automations/capabilities
// @access  Private
exports.getCapabilities = async (req, res) => {
  try {
    const capabilities = AutomationRegistry.getCapabilities();
    res.json({ success: true, capabilities });
  } catch (err) {
    console.error('[AutomationController] getCapabilities error:', err);
    res.status(500).json({ message: 'Failed to fetch automation capabilities' });
  }
};

// @desc    Get all automation rules for workspace
// @route   GET /api/automations
// @access  Private
exports.getAutomations = async (req, res) => {
  try {
    const { triggerType, category, channel, isActive, status, search } = req.query;

    const query = {
      $or: [
        { workspaceId: req.workspaceId },
        { userId: req.user._id },
        ...(req.user.companyId ? [{ companyId: req.user.companyId }] : []),
      ],
    };

    if (triggerType) {
      query.triggerType = triggerType;
    }
    if (category) {
      query.category = category;
    }
    if (channel) {
      query.channel = channel;
    }
    if (status) {
      query.status = status;
    } else if (isActive !== undefined && isActive !== '') {
      query.isActive = isActive === 'true';
    }
    if (search && search.trim()) {
      const escaped = escapeRegExp(search.trim());
      query.$and = [
        {
          $or: [
            { name: { $regex: escaped, $options: 'i' } },
            { description: { $regex: escaped, $options: 'i' } },
            { summary: { $regex: escaped, $options: 'i' } },
            { 'triggerConfig.keywords': { $in: [new RegExp(escaped, 'i')] } },
          ],
        },
      ];
    }

    const rules = await AutomationRule.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Attach dynamic summary & normalized status for display
    const enrichedRules = rules.map((r) => ({
      ...r,
      status: r.status || (r.isActive ? 'active' : 'paused'),
      summary: r.summary || AutomationRegistry.generateRuleSummary(r),
    }));

    // Real-time metrics
    const totalCount = enrichedRules.length;
    const activeCount = enrichedRules.filter((r) => r.status === 'active' || r.isActive).length;
    const pausedCount = enrichedRules.filter((r) => r.status === 'paused' || (!r.isActive && r.status !== 'draft')).length;
    const draftCount = enrichedRules.filter((r) => r.status === 'draft').length;
    const totalExecutions = enrichedRules.reduce((acc, r) => acc + (r.executionCount || 0), 0);

    // 24-hour execution & health stats from persisted AutomationLog
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const logsQuery = {
      $or: [
        { workspaceId: req.workspaceId },
        { userId: req.user._id },
        ...(req.user.companyId ? [{ companyId: req.user.companyId }] : []),
      ],
      timestamp: { $gte: startOfToday },
    };

    const [executionsToday, successfulToday, failedToday] = await Promise.all([
      AutomationLog.countDocuments(logsQuery).catch(() => 0),
      AutomationLog.countDocuments({ ...logsQuery, status: 'success' }).catch(() => 0),
      AutomationLog.countDocuments({ ...logsQuery, status: 'failed' }).catch(() => 0),
    ]);

    res.json({
      success: true,
      rules: enrichedRules,
      metrics: {
        totalCount,
        activeCount,
        pausedCount,
        draftCount,
        totalExecutions,
        executionsToday,
        successfulToday,
        failedToday,
        issuesCount: failedToday,
      },
    });
  } catch (err) {
    console.error('[AutomationController] getAutomations error:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch automation rules' });
  }
};

// @desc    Get single automation rule
// @route   GET /api/automations/:id
// @access  Private
exports.getAutomation = async (req, res) => {
  try {
    const rule = await AutomationRule.findOne({
      _id: req.params.id,
      $or: [
        { workspaceId: req.workspaceId },
        { userId: req.user._id },
        ...(req.user.companyId ? [{ companyId: req.user.companyId }] : []),
      ],
    }).lean();

    if (!rule) {
      return res.status(404).json({ message: 'Automation rule not found' });
    }

    res.json({ success: true, rule });
  } catch (err) {
    console.error('[AutomationController] getAutomation error:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch rule' });
  }
};

// @desc    Create new automation rule
// @route   POST /api/automations
// @access  Private
exports.createAutomation = async (req, res) => {
  try {
    const {
      name,
      description,
      category,
      triggerType,
      triggerConfig,
      channel,
      actions,
      isActive,
      status,
      actionType,
      actionConfig,
      delayMinutes,
    } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Automation rule name is required' });
    }
    if (!triggerType) {
      return res.status(400).json({ message: 'Trigger type is required' });
    }

    const resolvedStatus = status || (isActive === false ? 'paused' : 'active');
    const isActuallyActive = resolvedStatus === 'active';

    // Build & normalize actions array
    let normalizedActions = Array.isArray(actions) && actions.length > 0 ? [...actions] : [];

    if (normalizedActions.length === 0) {
      const resolvedActionType =
        actionType || (channel === 'email' ? 'send_email' : channel === 'internal' ? 'transfer_lead' : 'send_whatsapp');

      normalizedActions.push({
        actionType: resolvedActionType,
        delayMinutes: Number(delayMinutes) || 0,
        config: {
          whatsappMessage: actionConfig?.templateText || actionConfig?.whatsappMessage || '',
          emailSubject: actionConfig?.emailSubject || '',
          emailBody: actionConfig?.templateText || actionConfig?.emailBody || '',
          interactiveType: actionConfig?.interactiveType || 'none',
          interactiveTitle: actionConfig?.interactiveTitle || '',
          interactiveOptions: actionConfig?.interactiveOptions || [],
          tagToAdd: actionConfig?.tagToAdd || actionConfig?.targetTag || '',
          assignedUserId: actionConfig?.assignedUserId || null,
          targetCampaignId: actionConfig?.targetCampaignId || null,
          newStage: actionConfig?.newStage || '',
          transferNote: actionConfig?.transferNote || '',
        },
      });
    } else {
      normalizedActions = normalizedActions.map((act, idx) => {
        let type = act.actionType || act.type || (channel === 'email' ? 'send_email' : 'send_whatsapp');
        if (type === 'send_whatsapp_template') type = 'send_whatsapp';
        if (type === 'send_email_template') type = 'send_email';

        const cfg = act.config || {};
        return {
          order: act.order || idx + 1,
          actionType: type,
          delayMinutes: Number(act.delayMinutes || delayMinutes) || 0,
          config: {
            ...cfg,
            whatsappMessage: cfg.whatsappMessage || cfg.templateText || actionConfig?.templateText || '',
            emailSubject: cfg.emailSubject || actionConfig?.emailSubject || '',
            emailBody: cfg.emailBody || cfg.templateText || actionConfig?.templateText || '',
            interactiveType: cfg.interactiveType || actionConfig?.interactiveType || 'none',
            interactiveTitle: cfg.interactiveTitle || actionConfig?.interactiveTitle || '',
            interactiveOptions: cfg.interactiveOptions || actionConfig?.interactiveOptions || [],
            tagToAdd: cfg.tagToAdd || actionConfig?.tagToAdd || '',
            assignedUserId: cfg.assignedUserId || actionConfig?.assignedUserId || null,
            targetCampaignId: cfg.targetCampaignId || actionConfig?.targetCampaignId || null,
            newStage: cfg.newStage || actionConfig?.newStage || '',
            transferNote: cfg.transferNote || actionConfig?.transferNote || '',
          },
        };
      });
    }

    // Validate keywords if triggerType is whatsapp_inbound
    let sanitizedTriggerConfig = { ...(triggerConfig || {}) };
    if (triggerType === 'whatsapp_inbound' && sanitizedTriggerConfig.keywords) {
      if (Array.isArray(sanitizedTriggerConfig.keywords)) {
        sanitizedTriggerConfig.keywords = sanitizedTriggerConfig.keywords
          .map((k) => String(k).trim().toLowerCase())
          .filter(Boolean);
      } else if (typeof sanitizedTriggerConfig.keywords === 'string') {
        sanitizedTriggerConfig.keywords = sanitizedTriggerConfig.keywords
          .split(',')
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean);
      }
    }

    // Server-side validation against Canonical Capability Registry
    if (resolvedStatus === 'active') {
      const validation = AutomationRegistry.validateRule({
        name,
        triggerType,
        triggerConfig: sanitizedTriggerConfig,
        actions: normalizedActions,
        actionType,
      });

      if (!validation.isValid) {
        return res.status(400).json({
          message: 'Validation failed for automation configuration',
          errors: validation.errors,
        });
      }
    }

    const primaryAction = normalizedActions[0] || {};
    const summary = AutomationRegistry.generateRuleSummary({
      triggerType,
      triggerConfig: sanitizedTriggerConfig,
      actions: normalizedActions,
      actionType: actionType || primaryAction.actionType,
      delayMinutes: delayMinutes || primaryAction.delayMinutes,
    });

    const rule = await AutomationRule.create({
      workspaceId: req.workspaceId,
      userId: req.user._id,
      companyId: req.user.companyId || req.user._id,
      name: name.trim(),
      description: (description || '').trim(),
      category: category || 'lead_lifecycle',
      triggerType,
      triggerConfig: sanitizedTriggerConfig,
      channel: channel || (primaryAction.actionType === 'send_email' ? 'email' : 'whatsapp'),
      actionType: actionType || primaryAction.actionType || 'send_whatsapp',
      delayMinutes: Number(delayMinutes !== undefined ? delayMinutes : primaryAction.delayMinutes) || 0,
      actionConfig: actionConfig || {
        templateText: primaryAction.config?.whatsappMessage || primaryAction.config?.emailBody || '',
        emailSubject: primaryAction.config?.emailSubject || '',
        interactiveType: primaryAction.config?.interactiveType || 'none',
        interactiveTitle: primaryAction.config?.interactiveTitle || '',
        interactiveOptions: primaryAction.config?.interactiveOptions || [],
        tagToAdd: primaryAction.config?.tagToAdd || '',
        assignedUserId: primaryAction.config?.assignedUserId || null,
        targetCampaignId: primaryAction.config?.targetCampaignId || null,
        newStage: primaryAction.config?.newStage || '',
        transferNote: primaryAction.config?.transferNote || '',
      },
      actions: normalizedActions,
      status: resolvedStatus,
      isActive: isActuallyActive,
      summary,
    });

    res.status(201).json({ success: true, rule });
  } catch (err) {
    console.error('[AutomationController] createAutomation error:', err);
    res.status(400).json({ message: err.message || 'Failed to create automation rule' });
  }
};

// @desc    Update automation rule
// @route   PUT /api/automations/:id
// @access  Private
exports.updateAutomation = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      category,
      triggerType,
      triggerConfig,
      channel,
      actions,
      isActive,
      status,
      actionType,
      actionConfig,
      delayMinutes,
    } = req.body;

    const rule = await AutomationRule.findOne({
      _id: id,
      $or: [
        { workspaceId: req.workspaceId },
        { userId: req.user._id },
        ...(req.user.companyId ? [{ companyId: req.user.companyId }] : []),
      ],
    });

    if (!rule) {
      return res.status(404).json({ message: 'Automation rule not found' });
    }

    if (name) rule.name = name.trim();
    if (description !== undefined) rule.description = description.trim();
    if (category) rule.category = category;
    if (triggerType) rule.triggerType = triggerType;
    if (channel) rule.channel = channel;
    if (status) {
      rule.status = status;
      rule.isActive = status === 'active';
    } else if (isActive !== undefined) {
      rule.isActive = Boolean(isActive);
      rule.status = rule.isActive ? 'active' : 'paused';
    }
    if (actionType) rule.actionType = actionType;
    if (delayMinutes !== undefined) rule.delayMinutes = Number(delayMinutes) || 0;
    if (actionConfig) {
      rule.actionConfig = {
        ...(rule.actionConfig?.toObject?.() || rule.actionConfig || {}),
        ...actionConfig,
      };
    }

    if (actions && Array.isArray(actions) && actions.length > 0) {
      rule.actions = actions.map((act, idx) => {
        let type = act.actionType || act.type || rule.actionType || 'send_whatsapp';
        if (type === 'send_whatsapp_template') type = 'send_whatsapp';
        if (type === 'send_email_template') type = 'send_email';
        const cfg = act.config || {};
        return {
          order: act.order || idx + 1,
          actionType: type,
          delayMinutes: Number(act.delayMinutes || rule.delayMinutes) || 0,
          config: {
            ...cfg,
            whatsappMessage: cfg.whatsappMessage || cfg.templateText || rule.actionConfig?.templateText || '',
            emailSubject: cfg.emailSubject || rule.actionConfig?.emailSubject || '',
            emailBody: cfg.emailBody || cfg.templateText || rule.actionConfig?.templateText || '',
            tagToAdd: cfg.tagToAdd || rule.actionConfig?.tagToAdd || '',
            assignedUserId: cfg.assignedUserId || rule.actionConfig?.assignedUserId || null,
            targetCampaignId: cfg.targetCampaignId || rule.actionConfig?.targetCampaignId || null,
            newStage: cfg.newStage || rule.actionConfig?.newStage || '',
            transferNote: cfg.transferNote || rule.actionConfig?.transferNote || '',
          },
        };
      });
    } else if (actionType || actionConfig) {
      rule.actions = [
        {
          order: 1,
          actionType: rule.actionType || 'send_whatsapp',
          delayMinutes: rule.delayMinutes || 0,
          config: {
            whatsappMessage: rule.actionConfig?.templateText || '',
            emailSubject: rule.actionConfig?.emailSubject || '',
            emailBody: rule.actionConfig?.templateText || '',
            interactiveType: rule.actionConfig?.interactiveType || 'none',
            interactiveTitle: rule.actionConfig?.interactiveTitle || '',
            interactiveOptions: rule.actionConfig?.interactiveOptions || [],
            tagToAdd: rule.actionConfig?.tagToAdd || '',
            assignedUserId: rule.actionConfig?.assignedUserId || null,
            targetCampaignId: rule.actionConfig?.targetCampaignId || null,
            newStage: rule.actionConfig?.newStage || '',
            transferNote: rule.actionConfig?.transferNote || '',
          },
        },
      ];
    }

    if (triggerConfig) {
      let sanitized = { ...triggerConfig };
      if (sanitized.keywords) {
        if (Array.isArray(sanitized.keywords)) {
          sanitized.keywords = sanitized.keywords.map((k) => String(k).trim().toLowerCase()).filter(Boolean);
        } else if (typeof sanitized.keywords === 'string') {
          sanitized.keywords = sanitized.keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
        }
      }
      rule.triggerConfig = sanitized;
    }

    // Server-side validation against Canonical Capability Registry if activating
    if (rule.status === 'active') {
      const validation = AutomationRegistry.validateRule({
        name: rule.name,
        triggerType: rule.triggerType,
        triggerConfig: rule.triggerConfig,
        actions: rule.actions,
        actionType: rule.actionType,
      });

      if (!validation.isValid) {
        return res.status(400).json({
          message: 'Cannot save active rule: validation failed',
          errors: validation.errors,
        });
      }
    }

    rule.summary = AutomationRegistry.generateRuleSummary(rule);

    await rule.save();
    res.json({ success: true, rule });
  } catch (err) {
    console.error('[AutomationController] updateAutomation error:', err);
    res.status(400).json({ message: err.message || 'Failed to update rule' });
  }
};

// @desc    Duplicate an existing automation as a draft
// @route   POST /api/automations/:id/duplicate
// @access  Private
exports.duplicateAutomation = async (req, res) => {
  try {
    const original = await AutomationRule.findOne({
      _id: req.params.id,
      $or: [
        { workspaceId: req.workspaceId },
        { userId: req.user._id },
        ...(req.user.companyId ? [{ companyId: req.user.companyId }] : []),
      ],
    }).lean();

    if (!original) {
      return res.status(404).json({ message: 'Automation rule not found' });
    }

    delete original._id;
    delete original.createdAt;
    delete original.updatedAt;

    original.name = `${original.name} (Copy)`;
    original.status = 'draft';
    original.isActive = false;
    original.executionCount = 0;
    original.lastExecutedAt = null;
    original.lastExecutionStatus = null;
    original.lastError = null;
    original.summary = AutomationRegistry.generateRuleSummary(original);

    const duplicated = await AutomationRule.create(original);
    res.status(201).json({ success: true, rule: duplicated });
  } catch (err) {
    console.error('[AutomationController] duplicateAutomation error:', err);
    res.status(500).json({ message: err.message || 'Failed to duplicate automation' });
  }
};

// @desc    Set automation status (active, paused, draft)
// @route   PATCH /api/automations/:id/status
// @access  Private
exports.setAutomationStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'paused', 'draft', 'disabled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be active, paused, or draft' });
    }

    const rule = await AutomationRule.findOne({
      _id: req.params.id,
      $or: [
        { workspaceId: req.workspaceId },
        { userId: req.user._id },
        ...(req.user.companyId ? [{ companyId: req.user.companyId }] : []),
      ],
    });

    if (!rule) {
      return res.status(404).json({ message: 'Automation rule not found' });
    }

    if (status === 'active') {
      const validation = AutomationRegistry.validateRule(rule);
      if (!validation.isValid) {
        return res.status(400).json({
          message: 'Cannot activate incomplete workflow. Please resolve configuration errors first.',
          errors: validation.errors,
        });
      }
    }

    rule.status = status;
    rule.isActive = status === 'active';
    await rule.save();

    res.json({ success: true, status: rule.status, isActive: rule.isActive, rule });
  } catch (err) {
    console.error('[AutomationController] setAutomationStatus error:', err);
    res.status(500).json({ message: err.message || 'Failed to update automation status' });
  }
};

// @desc    Toggle rule active status
// @route   PATCH /api/automations/:id/toggle
// @access  Private
exports.toggleAutomation = async (req, res) => {
  try {
    const rule = await AutomationRule.findOne({
      _id: req.params.id,
      $or: [
        { workspaceId: req.workspaceId },
        { userId: req.user._id },
        ...(req.user.companyId ? [{ companyId: req.user.companyId }] : []),
      ],
    });

    if (!rule) {
      return res.status(404).json({ message: 'Automation rule not found' });
    }

    rule.isActive = !rule.isActive;
    rule.status = rule.isActive ? 'active' : 'paused';
    await rule.save();

    res.json({ success: true, isActive: rule.isActive, status: rule.status, rule });
  } catch (err) {
    console.error('[AutomationController] toggleAutomation error:', err);
    res.status(500).json({ message: err.message || 'Failed to toggle rule' });
  }
};

// @desc    Delete automation rule
// @route   DELETE /api/automations/:id
// @access  Private
exports.deleteAutomation = async (req, res) => {
  try {
    const rule = await AutomationRule.findOneAndDelete({
      _id: req.params.id,
      $or: [
        { workspaceId: req.workspaceId },
        { userId: req.user._id },
        ...(req.user.companyId ? [{ companyId: req.user.companyId }] : []),
      ],
    });

    if (!rule) {
      return res.status(404).json({ message: 'Automation rule not found' });
    }

    // Clean up execution logs
    await AutomationLog.deleteMany({ ruleId: req.params.id }).catch(() => null);

    res.json({ success: true, message: 'Automation rule deleted successfully' });
  } catch (err) {
    console.error('[AutomationController] deleteAutomation error:', err);
    res.status(500).json({ message: err.message || 'Failed to delete rule' });
  }
};

// @desc    Get execution audit logs
// @route   GET /api/automations/:id/logs or GET /api/automations/logs
// @access  Private
exports.getAutomationLogs = async (req, res) => {
  try {
    const ruleId = req.params.id || req.query.ruleId;
    const { page = 1, limit = 50, status } = req.query;

    const query = {
      $or: [
        { workspaceId: req.workspaceId },
        { userId: req.user._id },
        ...(req.user.companyId ? [{ companyId: req.user.companyId }] : []),
      ],
    };

    if (ruleId) {
      // Security: verify rule belongs to this tenant
      const verifiedRule = await AutomationRule.findOne({
        _id: ruleId,
        $or: [
          { workspaceId: req.workspaceId },
          { userId: req.user._id },
          ...(req.user.companyId ? [{ companyId: req.user.companyId }] : []),
        ],
      }).select('_id name');

      if (!verifiedRule) {
        return res.status(404).json({ message: 'Automation rule not found in this workspace' });
      }

      query.ruleId = ruleId;
    }

    if (status) {
      query.status = status;
    }

    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const skip = (parsedPage - 1) * parsedLimit;

    const logs = await AutomationLog.find(query)
      .populate('ruleId', 'name channel triggerType')
      .populate('leadId', 'name phone email course status')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    const total = await AutomationLog.countDocuments(query);
    const totalPages = Math.ceil(total / parsedLimit);

    res.json({
      success: true,
      logs,
      total,
      page: parsedPage,
      pages: totalPages,
      pagination: {
        page: parsedPage,
        pages: totalPages,
        total,
        limit: parsedLimit,
      },
    });
  } catch (err) {
    console.error('[AutomationController] getAutomationLogs error:', err);
    res.status(500).json({ message: err.message || 'Failed to fetch logs' });
  }
};

// @desc    Retry a failed automation execution log
// @route   POST /api/automations/logs/:logId/retry
// @access  Private (automations.manage)
exports.retryAutomationLog = async (req, res) => {
  try {
    const { logId } = req.params;
    const log = await AutomationLog.findOne({
      _id: logId,
      $or: [
        { workspaceId: req.workspaceId },
        { userId: req.user._id },
        ...(req.user.companyId ? [{ companyId: req.user.companyId }] : []),
      ],
    });

    if (!log) {
      return res.status(404).json({ message: 'Execution log not found' });
    }

    const rule = await AutomationRule.findById(log.ruleId);
    if (!rule || !rule.isActive) {
      return res.status(400).json({ message: 'Associated automation rule is inactive or deleted' });
    }

    const lead = log.leadId ? await Lead.findById(log.leadId) : null;
    const action = {
      actionType: log.actionType,
      config: log.actionPayload?.action?.config || log.actionPayload || {},
    };

    const startTime = Date.now();
    try {
      await AutomationEngine.performAction(action, rule, {
        lead,
        user: req.user,
        workspaceId: req.workspaceId,
        customPhone: log.recipientPhone,
        depth: 1,
      });

      log.status = 'success';
      log.error = null;
      log.errorMessage = null;
      log.retryCount = (log.retryCount || 0) + 1;
      log.executedAt = new Date();
      log.durationMs = Date.now() - startTime;
      await log.save();

      res.json({ success: true, message: 'Automation action retried successfully', log });
    } catch (retryErr) {
      log.status = 'failed';
      log.error = retryErr.message;
      log.errorMessage = retryErr.message;
      log.retryCount = (log.retryCount || 0) + 1;
      log.executedAt = new Date();
      log.durationMs = Date.now() - startTime;
      await log.save();

      res.status(400).json({ success: false, message: retryErr.message, log });
    }
  } catch (err) {
    console.error('[AutomationController] retryAutomationLog error:', err);
    res.status(500).json({ message: err.message || 'Failed to retry automation' });
  }
};

// @desc    Test-dry-run an automation action against a sample or existing lead
// @route   POST /api/automations/test
// @access  Private (automations.manage)
exports.testAutomation = async (req, res) => {
  try {
    const { templateText, leadId, sampleData, actionConfig, leadData } = req.body;

    const rawText = templateText || actionConfig?.templateText || req.body.template || '';

    let lead = null;
    if (leadId) {
      // Security: Strictly enforce multi-tenant authorization
      lead = await Lead.findOne({
        _id: leadId,
        $or: [
          { workspaceId: req.workspaceId },
          { userId: req.user._id },
          ...(req.user.companyId ? [{ companyId: req.user.companyId }] : []),
        ],
      }).lean();

      if (!lead) {
        return res.status(404).json({ message: 'Target lead not found in this workspace' });
      }
    }
    const sample = sampleData || leadData || {};
    if (!lead) {
      lead = {
        name: sample.name || 'Aarav Sharma',
        course: sample.course || 'B.Tech Computer Science',
        phone: sample.phone || '9876543210',
        email: sample.email || 'aarav.sharma@example.com',
        city: sample.city || 'Delhi',
        status: sample.status || 'Fresh Lead',
        assignedToName: req.user.name || 'Admissions Counselor',
      };
    }

    const preview = AutomationEngine.replaceVariables(rawText, {
      lead,
      user: req.user,
    });

    res.json({
      success: true,
      leadUsed: lead,
      preview,
      renderedPreview: preview,
    });
  } catch (err) {
    console.error('[AutomationController] testAutomation error:', err);
    res.status(500).json({ message: err.message || 'Failed to test automation' });
  }
};
