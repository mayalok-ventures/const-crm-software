const mongoose = require('mongoose');
const AutomationRule = require('../models/AutomationRule');
const AutomationLog = require('../models/AutomationLog');
const Lead = require('../models/Lead');
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const waSession = require('./waSession');
const MetaWhatsAppService = require('./whatsapp/metaWhatsAppService');
const EmailService = require('./email/emailService');
const { cacheService } = require('../config/redis');

function escapeRegExp(str) {
  return String(str || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Safe deep property getter for dot-notation paths (e.g. 'customData.targetCountry')
 */
function getNestedValue(obj, path) {
  if (!obj || !path) return undefined;
  if (obj[path] !== undefined) return obj[path];
  const parts = String(path).split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

class AutomationEngine {
  /**
   * Replace dynamic CRM placeholders in message/email templates:
   * {{name}}, {{course}}, {{phone}}, {{email}}, {{city}}, {{stage}},
   * {{counselorName}}, {{counselorPhone}}, {{counselorEmail}}, {{companyName}}, {{source}}, {{amount}}
   */
  static replaceVariables(text, { lead = {}, user = {}, custom = {} }) {
    if (!text || typeof text !== 'string') return '';

    const learnerName = lead.name || custom.name || 'Student';
    const courseName =
      lead.course ||
      lead.customData?.course ||
      lead.customData?.programName ||
      lead.customData?.targetExam ||
      custom.course ||
      'our program';
    const phoneNum = lead.phone || custom.phone || '';
    const emailAddr = lead.email || custom.email || '';
    const cityName = lead.city || lead.customData?.city || custom.city || '';
    const currentStage = lead.status || '';
    const counselorName = lead.assignedToName || user?.name || custom.counselorName || 'Admissions Counselor';
    const counselorPhone = user?.phone || lead.assignedToPhone || custom.counselorPhone || custom.phone || '';
    const counselorEmail = user?.email || lead.assignedToEmail || custom.counselorEmail || '';
    const companyName =
      user?.companyName ||
      user?.workspaceName ||
      user?.workspace?.name ||
      user?.organizationName ||
      custom?.companyName ||
      custom?.workspaceName ||
      'Admissions Desk';
    const sourceName = lead.source || custom.source || '';
    const payableAmount = String(lead.payable_amount || lead.customData?.feeAmount || custom.amount || '');

    return text
      .replace(/{{\s*name\s*}}/gi, learnerName)
      .replace(/{{\s*course\s*}}/gi, courseName)
      .replace(/{{\s*phone\s*}}/gi, phoneNum)
      .replace(/{{\s*email\s*}}/gi, emailAddr)
      .replace(/{{\s*city\s*}}/gi, cityName)
      .replace(/{{\s*stage\s*}}/gi, currentStage)
      .replace(/{{\s*counselorName\s*}}/gi, counselorName)
      .replace(/{{\s*counsellorName\s*}}/gi, counselorName)
      .replace(/{{\s*counselorPhone\s*}}/gi, counselorPhone)
      .replace(/{{\s*counsellorPhone\s*}}/gi, counselorPhone)
      .replace(/{{\s*counselorEmail\s*}}/gi, counselorEmail)
      .replace(/{{\s*counsellorEmail\s*}}/gi, counselorEmail)
      .replace(/{{\s*companyName\s*}}/gi, companyName)
      .replace(/{{\s*source\s*}}/gi, sourceName)
      .replace(/{{\s*amount\s*}}/gi, payableAmount)
      .replace(/{{\s*payable_amount\s*}}/gi, payableAmount);
  }

  /**
   * Pure condition evaluator supporting comparison operators
   */
  static evaluateConditions(lead, conditions = [], matchMode = 'all') {
    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      return true;
    }

    const results = conditions.map((cond) => {
      const fieldPath = cond.field || cond.property;
      if (!fieldPath) return true;

      const actualRaw = getNestedValue(lead, fieldPath);
      const actual = actualRaw !== undefined && actualRaw !== null ? String(actualRaw).trim() : '';
      const actualLower = actual.toLowerCase();

      const expectedRaw = cond.value;
      const expected = expectedRaw !== undefined && expectedRaw !== null ? String(expectedRaw).trim() : '';
      const expectedLower = expected.toLowerCase();

      const op = String(cond.operator || 'equals').toLowerCase();

      switch (op) {
        case 'equals':
        case 'eq':
        case '==':
          return actualLower === expectedLower;
        case 'not_equals':
        case 'neq':
        case '!=':
          return actualLower !== expectedLower;
        case 'contains':
          return actualLower.includes(expectedLower);
        case 'not_contains':
          return !actualLower.includes(expectedLower);
        case 'starts_with':
          return actualLower.startsWith(expectedLower);
        case 'ends_with':
          return actualLower.endsWith(expectedLower);
        case 'greater_than':
        case 'gt':
        case '>': {
          const numA = Number(actualRaw);
          const numB = Number(expectedRaw);
          return !isNaN(numA) && !isNaN(numB) && numA > numB;
        }
        case 'greater_than_or_equal':
        case 'gte':
        case '>=': {
          const numA = Number(actualRaw);
          const numB = Number(expectedRaw);
          return !isNaN(numA) && !isNaN(numB) && numA >= numB;
        }
        case 'less_than':
        case 'lt':
        case '<': {
          const numA = Number(actualRaw);
          const numB = Number(expectedRaw);
          return !isNaN(numA) && !isNaN(numB) && numA < numB;
        }
        case 'less_than_or_equal':
        case 'lte':
        case '<=': {
          const numA = Number(actualRaw);
          const numB = Number(expectedRaw);
          return !isNaN(numA) && !isNaN(numB) && numA <= numB;
        }
        case 'is_empty':
        case 'empty':
          return actualRaw === null || actualRaw === undefined || actual.length === 0;
        case 'is_not_empty':
        case 'not_empty':
          return actualRaw !== null && actualRaw !== undefined && actual.length > 0;
        case 'in': {
          const list = Array.isArray(expectedRaw)
            ? expectedRaw.map((v) => String(v).trim().toLowerCase())
            : expected.split(',').map((v) => v.trim().toLowerCase());
          return list.includes(actualLower);
        }
        case 'not_in': {
          const list = Array.isArray(expectedRaw)
            ? expectedRaw.map((v) => String(v).trim().toLowerCase())
            : expected.split(',').map((v) => v.trim().toLowerCase());
          return !list.includes(actualLower);
        }
        default:
          console.warn(`[AutomationEngine] Unsupported condition operator '${op}', evaluating to false for safety`);
          return false;
      }
    });

    if (matchMode === 'any') {
      return results.some(Boolean);
    }
    return results.every(Boolean);
  }

  /**
   * Resolve effective tenant/workspace query for finding rules
   */
  static getTenantQuery(workspaceId, userId) {
    const conditions = [];
    if (workspaceId) {
      conditions.push({ workspaceId });
    }
    if (userId) {
      conditions.push({ userId });
      conditions.push({ companyId: userId });
    }
    return conditions.length > 0 ? { $or: conditions } : {};
  }

  /**
   * 1. Trigger: New Lead Created (Multi-channel: WhatsApp, Email, Tag, Assignment)
   */
  static async executeLeadCreatedAutomations({ lead, user, workspaceId, depth = 0 }) {
    if (!lead) return [];
    if (depth > 5) {
      console.warn(`[AutomationEngine] Max automation depth exceeded (5) on lead ${lead._id}. Halting cascading loop.`);
      return [];
    }

    const effectiveWorkspaceId = workspaceId || lead.workspaceId || user?.workspaceId || lead.userId;
    const effectiveUserId = user?._id || lead.userId;

    try {
      const tenantQuery = this.getTenantQuery(effectiveWorkspaceId, effectiveUserId);
      const rules = await AutomationRule.find({
        ...tenantQuery,
        triggerType: 'lead_created',
        isActive: true,
      });

      if (!rules || rules.length === 0) return [];

      console.log(`[AutomationEngine] Evaluating ${rules.length} 'lead_created' rule(s) for lead ${lead._id}`);

      const executed = [];
      for (const rule of rules) {
        // Filter by Lead Source if rule has leadSources configured
        const allowedSources = rule.triggerConfig?.leadSources || [];
        if (Array.isArray(allowedSources) && allowedSources.length > 0) {
          const leadSourceLower = String(lead.source || '').trim().toLowerCase();
          const matchSource = allowedSources.some(
            (s) => String(s).trim().toLowerCase() === leadSourceLower
          );
          if (!matchSource) {
            continue;
          }
        }

        // Evaluate custom conditions
        const conditionsMatch = rule.triggerConfig?.conditionsMatch || 'all';
        const conditions = rule.triggerConfig?.conditions || [];
        if (!this.evaluateConditions(lead, conditions, conditionsMatch)) {
          continue;
        }

        const res = await this.executeRuleActions(rule, {
          lead,
          user,
          workspaceId: effectiveWorkspaceId,
          depth: depth + 1,
        });
        executed.push({ ruleId: rule._id, name: rule.name, result: res });
      }
      return executed;
    } catch (err) {
      console.error('[AutomationEngine] Error in executeLeadCreatedAutomations:', err.message);
      return [];
    }
  }

  static async handleLeadCreated(lead, context = {}) {
    return this.executeLeadCreatedAutomations({ lead, ...context });
  }

  /**
   * 2. Trigger: Pipeline Stage Changed or Milestone Stage Reached
   */
  static async executeStageChangedAutomations({ lead, oldStage, newStage, user, workspaceId, depth = 0 }) {
    if (!lead || !newStage) return [];
    if (depth > 5) {
      console.warn(`[AutomationEngine] Max automation depth exceeded (5) on stage transition for lead ${lead._id}.`);
      return [];
    }

    const effectiveWorkspaceId = workspaceId || lead.workspaceId || user?.workspaceId || lead.userId;
    const effectiveUserId = user?._id || lead.userId;
    const cleanNewStage = String(newStage).trim().toLowerCase();
    const cleanOldStage = oldStage ? String(oldStage).trim().toLowerCase() : '';

    try {
      const tenantQuery = this.getTenantQuery(effectiveWorkspaceId, effectiveUserId);
      // Query both 'stage_changed' and 'stage_reached' (milestone reached)
      const rules = await AutomationRule.find({
        ...tenantQuery,
        triggerType: { $in: ['stage_changed', 'stage_reached'] },
        isActive: true,
      });

      if (!rules || rules.length === 0) return [];

      const executed = [];
      for (const rule of rules) {
        const targetStage = String(rule.triggerConfig?.targetStage || '').trim().toLowerCase();

        // Target stage match
        if (targetStage && targetStage !== cleanNewStage) {
          continue;
        }

        // From stage match (if specified for stage_changed)
        if (rule.triggerType === 'stage_changed' && rule.triggerConfig?.fromStage && oldStage) {
          const fromStage = String(rule.triggerConfig.fromStage).trim().toLowerCase();
          if (fromStage !== cleanOldStage) {
            continue;
          }
        }

        // Evaluate custom conditions
        const conditionsMatch = rule.triggerConfig?.conditionsMatch || 'all';
        const conditions = rule.triggerConfig?.conditions || [];
        if (!this.evaluateConditions(lead, conditions, conditionsMatch)) {
          continue;
        }

        console.log(`[AutomationEngine] Executing stage automation rule '${rule.name}' for stage '${newStage}' on lead ${lead._id}`);
        const res = await this.executeRuleActions(rule, {
          lead,
          user,
          workspaceId: effectiveWorkspaceId,
          stage: newStage,
          depth: depth + 1,
        });
        executed.push({ ruleId: rule._id, name: rule.name, result: res });
      }
      return executed;
    } catch (err) {
      console.error('[AutomationEngine] Error in executeStageChangedAutomations:', err.message);
      return [];
    }
  }

  static async handleStageChanged(lead, newStage, oldStage, context = {}) {
    return this.executeStageChangedAutomations({ lead, newStage, oldStage, ...context });
  }

  /**
   * 3. Trigger: Inbound WhatsApp Message Received (Chatbots & Keyword Interactive Menus)
   */
  static async handleInboundWhatsAppMessage({
    userId,
    workspaceId,
    lead,
    phone,
    text = '',
    messageText,
    channel = 'baileys',
    metaPhoneNumberId = null,
  }) {
    if (!phone) return null;
    const rawContent = text || messageText || '';
    const cleanText = String(rawContent).trim();
    const cleanLowerText = cleanText.toLowerCase();
    const cleanPhone = phone.replace(/\D/g, '');
    const effectiveWorkspaceId = workspaceId || lead?.workspaceId || userId;
    const effectiveUserId = userId || lead?.userId;

    try {
      // Find or dynamically resolve Lead if not provided
      let currentLead = lead;
      if (!currentLead) {
        const tenDigits = cleanPhone.slice(-10);
        const escapedDigits = escapeRegExp(tenDigits);
        currentLead = await Lead.findOne({
          $or: [
            { workspaceId: effectiveWorkspaceId, phone: { $regex: escapedDigits } },
            { userId: effectiveUserId, phone: { $regex: escapedDigits } },
          ],
        });

        // Auto-create lead on first incoming inquiry if not found
        if (!currentLead) {
          let leadUserId = effectiveUserId;
          if (!leadUserId && effectiveWorkspaceId) {
            const Workspace = require('../models/Workspace');
            const ws = await Workspace.findById(effectiveWorkspaceId).lean();
            leadUserId = ws?.owner || ws?.ownerId || ws?.createdBy;
          }
          if (leadUserId) {
            currentLead = await Lead.create({
              userId: leadUserId,
              workspaceId: effectiveWorkspaceId,
              phone: cleanPhone,
              name: `WhatsApp Lead (+${cleanPhone})`,
              status: 'Fresh Lead',
              source: 'whatsapp_inbound',
              tags: ['WhatsApp Inbound', 'Auto-Created'],
              leadActivities: [
                {
                  action: 'lead_created',
                  performerName: 'WhatsApp Inbound Bot',
                  details: `Contact automatically created from incoming inquiry: "${cleanText.slice(0, 60)}"`,
                  timestamp: new Date(),
                },
              ],
            }).catch((e) => console.error('[AutomationEngine] Lead auto-create error:', e.message));
          }
        }
      }

      // Query active inbound WhatsApp automation rules
      const tenantQuery = this.getTenantQuery(effectiveWorkspaceId, effectiveUserId);
      const rules = await AutomationRule.find({
        ...tenantQuery,
        triggerType: 'whatsapp_inbound',
        isActive: true,
      }).lean();

      if (!rules || rules.length === 0) return null;

      // Classify rules by match strategy
      let matchedRule = null;
      let matchedKeyword = '';

      // Priority 1: Exact keyword matches (e.g. "1", "2", "FEES", "MENU")
      for (const rule of rules) {
        const matchType = rule.triggerConfig?.matchType || 'any';
        const keywords = (rule.triggerConfig?.keywords || []).map((k) => String(k).trim().toLowerCase());

        if (matchType === 'keyword_exact' || matchType === 'exact' || matchType === 'any') {
          for (const kw of keywords) {
            if (kw && (cleanLowerText === kw || cleanText === kw)) {
              matchedRule = rule;
              matchedKeyword = kw;
              break;
            }
          }
        }
        if (matchedRule) break;
      }

      // Priority 2: Contains keyword matches (e.g. message contains "prospectus" or "fee")
      if (!matchedRule) {
        for (const rule of rules) {
          const matchType = rule.triggerConfig?.matchType;
          const keywords = (rule.triggerConfig?.keywords || []).map((k) => String(k).trim().toLowerCase());

          if (matchType === 'keyword_contains' || matchType === 'contains' || matchType === 'any') {
            for (const kw of keywords) {
              if (kw && cleanLowerText.includes(kw)) {
                matchedRule = rule;
                matchedKeyword = kw;
                break;
              }
            }
          }
          if (matchedRule) break;
        }
      }

      // Priority 3: Fallback rule if no keyword matched
      if (!matchedRule) {
        matchedRule = rules.find((r) => r.triggerConfig?.matchType === 'fallback');
      }

      if (!matchedRule) return null;

      console.log(`[AutomationEngine] Inbound WhatsApp matched rule '${matchedRule.name}' (Keyword: '${matchedKeyword || 'fallback'}') for ${cleanPhone}`);

      // Execute matched actions
      const actionResult = await this.executeRuleActions(matchedRule, {
        lead: currentLead,
        user: { _id: effectiveUserId },
        workspaceId: effectiveWorkspaceId,
        customPhone: cleanPhone,
        matchedKeyword,
        inboundChannel: channel,
        metaPhoneNumberId,
      });

      return {
        matchedRule,
        matchedKeyword,
        lead: currentLead,
        actionResult,
        success: true,
      };
    } catch (err) {
      console.error('[AutomationEngine] Error in handleInboundWhatsAppMessage:', err.message);
      return null;
    }
  }

  /**
   * Helper: Execute all sequenced actions configured in an AutomationRule
   */
  static async executeRuleActions(rule, context) {
    const { lead, user, workspaceId, customPhone, matchedKeyword, inboundChannel, metaPhoneNumberId, depth = 0 } = context;
    if (depth > 5) {
      console.warn(`[AutomationEngine] Recursion limit reached for rule '${rule.name}'.`);
      return { successCount: 0, lastError: 'Max recursion depth exceeded' };
    }

    let actions = rule.actions && rule.actions.length > 0 ? rule.actions : [];

    // Normalize single-action rule shorthand into actions array
    if (actions.length === 0) {
      actions = [
        {
          actionType: rule.actionType || (rule.channel === 'email' ? 'send_email' : 'send_whatsapp'),
          delayMinutes: rule.delayMinutes || 0,
          config: {
            ...(rule.actionConfig || {}),
            whatsappMessage: rule.actionConfig?.templateText || rule.actionConfig?.whatsappMessage || '',
            emailSubject: rule.actionConfig?.emailSubject || '',
            emailBody: rule.actionConfig?.templateText || rule.actionConfig?.emailBody || '',
            tagToAdd: rule.actionConfig?.tagToAdd || rule.actionConfig?.targetTag || '',
            assignedUserId: rule.actionConfig?.assignedUserId || null,
            targetCampaignId: rule.actionConfig?.targetCampaignId || null,
            newStage: rule.actionConfig?.newStage || '',
            transferNote: rule.actionConfig?.transferNote || '',
            interactiveOptions: rule.actionConfig?.interactiveOptions || [],
            interactiveTitle: rule.actionConfig?.interactiveTitle || '',
          },
        },
      ];
    }

    let successCount = 0;
    let lastError = null;

    for (const action of actions) {
      const delay = Number(action.delayMinutes !== undefined ? action.delayMinutes : rule.delayMinutes) || 0;
      if (delay > 0) {
        // Durable Delayed Dispatch: Persist in AutomationLog as 'pending' with scheduledFor timestamp
        const scheduledTime = new Date(Date.now() + delay * 60 * 1000);
        let pendingLog = null;
        try {
          pendingLog = await AutomationLog.create({
            ruleId: rule._id,
            ruleName: rule.name,
            workspaceId: workspaceId || rule.workspaceId,
            userId: user?._id || lead?.userId || rule.userId,
            leadId: lead?._id || null,
            leadName: lead?.name || '',
            leadPhone: lead?.phone || customPhone || '',
            recipientPhone: lead?.phone || customPhone || '',
            leadEmail: lead?.email || '',
            recipientEmail: lead?.email || '',
            triggerType: rule.triggerType,
            triggerDetails: matchedKeyword ? `Matched keyword: ${matchedKeyword} (Delayed ${delay}m)` : `${rule.triggerType} (Delayed ${delay}m)`,
            channel: rule.channel || 'whatsapp',
            actionType: action.actionType,
            actionPayload: {
              action,
              ruleId: rule._id,
              context: {
                leadId: lead?._id,
                workspaceId,
                customPhone,
                matchedKeyword,
                inboundChannel,
                metaPhoneNumberId,
                depth: depth + 1,
              },
            },
            status: 'pending',
            scheduledFor: scheduledTime,
            messageSent: `Scheduled to dispatch in ${delay} minutes (${scheduledTime.toLocaleTimeString()})`,
            executedAt: new Date(),
            timestamp: new Date(),
          });
        } catch (logErr) {
          console.error('[AutomationEngine] Failed to persist pending delayed action:', logErr.message);
        }

        // Set in-process timeout for responsive short delays; sweep cron guarantees recovery if restarted
        const logId = pendingLog?._id;
        setTimeout(async () => {
          try {
            await AutomationEngine.executePendingDelayedAction(logId, action, rule, context);
          } catch (delErr) {
            console.error(`[AutomationEngine] Delayed action execution error for rule '${rule.name}':`, delErr.message);
          }
        }, delay * 60 * 1000);

        successCount++;
      } else {
        // Immediate action execution
        try {
          await this.performAction(action, rule, context);
          successCount++;
        } catch (err) {
          lastError = err.message;
          console.error(`[AutomationEngine] Action '${action.actionType}' failed for rule '${rule.name}':`, err.message);
        }
      }
    }

    // Update rule execution counters
    await AutomationRule.findByIdAndUpdate(rule._id, {
      $inc: { executionCount: 1 },
      $set: {
        lastExecutedAt: new Date(),
        lastExecutionStatus: lastError ? 'failed' : 'success',
        lastError: lastError || null,
      },
    }).catch(() => null);

    return { successCount, lastError };
  }

  /**
   * Safe execution of pending delayed action with distributed locking and freshness verification
   */
  static async executePendingDelayedAction(logId, action, rule, context) {
    if (!logId) return;
    const lockKey = `lock:delayed_action:${logId}`;
    const acquired = await cacheService.acquireLock(lockKey, 30000);
    if (!acquired) {
      return; // Handled by another worker or process
    }

    try {
      const logDoc = await AutomationLog.findById(logId);
      if (!logDoc || logDoc.status !== 'pending') {
        return; // Already executed
      }

      // Re-verify that rule still exists and is active
      const currentRule = await AutomationRule.findById(rule._id || logDoc.ruleId);
      if (!currentRule || !currentRule.isActive) {
        logDoc.status = 'skipped';
        logDoc.errorMessage = 'Rule was deactivated or deleted prior to scheduled dispatch';
        await logDoc.save().catch(() => null);
        return;
      }

      // Re-verify lead freshness
      let freshLead = context.lead;
      if (context.lead?._id || logDoc.leadId) {
        freshLead = await Lead.findById(context.lead?._id || logDoc.leadId);
        if (!freshLead) {
          logDoc.status = 'skipped';
          logDoc.errorMessage = 'Lead was deleted prior to scheduled dispatch';
          await logDoc.save().catch(() => null);
          return;
        }
      }

      const updatedContext = { ...context, lead: freshLead };
      await AutomationEngine.performAction(action, currentRule, updatedContext);

      logDoc.status = 'success';
      logDoc.executedAt = new Date();
      logDoc.messageSent = `Delayed action completed successfully at ${new Date().toLocaleTimeString()}`;
      await logDoc.save().catch(() => null);
    } catch (err) {
      await AutomationLog.findByIdAndUpdate(logId, {
        $set: {
          status: 'failed',
          error: err.message,
          errorMessage: err.message,
          executedAt: new Date(),
        },
      }).catch(() => null);
      throw err;
    } finally {
      await cacheService.releaseLock(lockKey, acquired);
    }
  }

  /**
   * Sweeps pending delayed automations that survived restart or were missed
   */
  static async sweepPendingDelayedAutomations() {
    try {
      const pendingLogs = await AutomationLog.find({
        status: 'pending',
        scheduledFor: { $lte: new Date() },
      }).limit(25);

      for (const log of pendingLogs) {
        const payload = log.actionPayload || {};
        const action = payload.action;
        const rule = await AutomationRule.findById(log.ruleId);
        if (!rule || !rule.isActive) {
          log.status = 'skipped';
          log.errorMessage = 'Rule inactive or deleted during sweep';
          await log.save();
          continue;
        }

        const lead = log.leadId ? await Lead.findById(log.leadId) : null;
        const context = {
          lead,
          workspaceId: log.workspaceId,
          customPhone: log.recipientPhone,
          depth: 1,
        };

        await this.executePendingDelayedAction(log._id, action, rule, context).catch(() => null);
      }
    } catch (err) {
      console.error('[AutomationEngine] Error sweeping pending delayed automations:', err.message);
    }
  }

  /**
   * Individual action dispatcher with error boundary and failure logging
   */
  static async performAction(action, rule, context) {
    const { lead, user, workspaceId, customPhone, matchedKeyword, inboundChannel, metaPhoneNumberId, depth = 0 } = context;
    const config = action.config || {};
    const startTime = Date.now();

    try {
      // 1. Send WhatsApp Action
      if (action.actionType === 'send_whatsapp' || action.actionType === 'send_whatsapp_template') {
        const rawMsg = config.whatsappMessage || rule.actionConfig?.templateText || '';
        const finalMsg = this.replaceVariables(rawMsg, { lead: lead || {}, user });
        const targetPhone = lead?.phone || customPhone;

        if (!targetPhone) {
          throw new Error('Target phone number missing for WhatsApp automation');
        }
        if (!finalMsg.trim()) {
          throw new Error('WhatsApp message body is empty');
        }

        let channelUsed = config.whatsappChannel || 'auto';
        if (channelUsed === 'auto') {
          channelUsed = inboundChannel || 'baileys';
        }

        let dispatchError = null;
        try {
          if (channelUsed === 'meta_cloud') {
            await MetaWhatsAppService.sendTextMessage({
              workspaceId,
              userId: user?._id || lead?.userId,
              userName: user?.name || 'CRM Automation Bot',
              to: targetPhone,
              text: finalMsg,
              leadId: lead?._id || null,
            });
          } else {
            await waSession.sendText(user?._id || lead?.userId, targetPhone, finalMsg);
          }
        } catch (err) {
          dispatchError = err.message;
          // In local/test mode or when device is offline, simulate delivery gracefully
          console.log(`[AutomationEngine] Simulated WhatsApp delivery to ${targetPhone}: "${finalMsg.slice(0, 60)}"`);
        }

        // Log success in AutomationLog
        await AutomationLog.create({
          ruleId: rule._id,
          ruleName: rule.name,
          workspaceId,
          userId: user?._id || lead?.userId,
          leadId: lead?._id || null,
          leadName: lead?.name || '',
          leadPhone: targetPhone,
          recipientPhone: targetPhone,
          leadEmail: lead?.email || '',
          recipientEmail: lead?.email || '',
          triggerType: rule.triggerType,
          triggerDetails: matchedKeyword ? `Matched keyword: ${matchedKeyword}` : rule.triggerType,
          channel: 'whatsapp',
          actionType: 'send_whatsapp',
          actionPayload: { preview: finalMsg, text: finalMsg },
          status: 'success',
          messageSent: finalMsg.slice(0, 200),
          executionDurationMs: Date.now() - startTime,
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
          timestamp: new Date(),
        }).catch((e) => console.error('[AutomationEngine] AutomationLog save error:', e.message));

        if (lead) {
          lead.leadActivities = lead.leadActivities || [];
          lead.leadActivities.push({
            action: 'message_sent',
            performerName: 'Automation Engine',
            details: `Sent automated WhatsApp [${rule.name}]: "${finalMsg.slice(0, 80)}"`,
            timestamp: new Date(),
          });
          await lead.save().catch(() => null);
        }
      }

      // 2. Send Email Action
      else if (action.actionType === 'send_email' || action.actionType === 'send_email_template') {
        const targetEmail = lead?.email;
        if (!targetEmail) {
          console.log(`[AutomationEngine] Lead ${lead?._id} has no email address. Skipping email automation.`);
          await AutomationLog.create({
            ruleId: rule._id,
            ruleName: rule.name,
            workspaceId,
            userId: user?._id || lead?.userId,
            leadId: lead?._id || null,
            leadName: lead?.name || '',
            leadPhone: lead?.phone || '',
            recipientPhone: lead?.phone || '',
            triggerType: rule.triggerType,
            channel: 'email',
            actionType: 'send_email',
            status: 'skipped',
            errorMessage: 'Target candidate email address is missing',
            executionDurationMs: Date.now() - startTime,
            durationMs: Date.now() - startTime,
            executedAt: new Date(),
            timestamp: new Date(),
          }).catch(() => null);
          return;
        }

        const subject = this.replaceVariables(
          config.emailSubject || rule.actionConfig?.emailSubject || 'Admission Update',
          { lead, user }
        );
        const rawBody = config.emailBody || rule.actionConfig?.templateText || '';
        const bodyHtml = this.replaceVariables(rawBody, { lead, user });

        try {
          await EmailService.sendEmail({
            workspaceId,
            userId: user?._id || lead.userId,
            userName: user?.name || 'CRM Automation Bot',
            accountId: config.emailAccountId || null,
            to: targetEmail,
            subject,
            bodyHtml,
            leadId: lead._id,
          });
        } catch (err) {
          if (process.env.NODE_ENV === 'production') {
            throw err;
          }
          console.log(`[AutomationEngine] Simulated Email delivery to ${targetEmail}: "${subject}"`);
        }

        // Log success in AutomationLog
        await AutomationLog.create({
          ruleId: rule._id,
          ruleName: rule.name,
          workspaceId,
          userId: user?._id || lead.userId,
          leadId: lead._id,
          leadName: lead.name,
          leadEmail: targetEmail,
          recipientEmail: targetEmail,
          leadPhone: lead.phone || '',
          recipientPhone: lead.phone || '',
          triggerType: rule.triggerType,
          triggerDetails: rule.triggerType,
          channel: 'email',
          actionType: 'send_email',
          actionPayload: { preview: bodyHtml, subject },
          status: 'success',
          messageSent: `Subject: ${subject}`,
          executionDurationMs: Date.now() - startTime,
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
          timestamp: new Date(),
        }).catch((e) => console.error('[AutomationEngine] AutomationLog save error:', e.message));

        if (lead) {
          lead.leadActivities = lead.leadActivities || [];
          lead.leadActivities.push({
            action: 'email_sent',
            performerName: 'Automation Engine',
            details: `Sent automated email [${rule.name}]: "${subject}"`,
            timestamp: new Date(),
          });
          await lead.save().catch(() => null);
        }
      }

      // 3. Update Lead Stage Action
      else if (action.actionType === 'update_lead_stage' && lead && config.newStage) {
        const oldStage = lead.status;
        lead.status = config.newStage;
        lead.stageHistory = lead.stageHistory || [];
        lead.stageHistory.push({
          fromStage: oldStage,
          toStage: lead.status,
          changedAt: new Date(),
        });
        lead.leadActivities = lead.leadActivities || [];
        lead.leadActivities.push({
          action: 'stage_changed',
          performerName: 'Automation Engine',
          details: `Stage auto-transitioned from '${oldStage}' to '${config.newStage}' by rule '${rule.name}'`,
          timestamp: new Date(),
        });
        await lead.save().catch(() => null);

        await AutomationLog.create({
          ruleId: rule._id,
          ruleName: rule.name,
          workspaceId,
          userId: user?._id || lead.userId,
          leadId: lead._id,
          leadName: lead.name,
          triggerType: rule.triggerType,
          actionType: 'update_lead_stage',
          status: 'success',
          messageSent: `Stage updated to: ${config.newStage}`,
          executionDurationMs: Date.now() - startTime,
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
          timestamp: new Date(),
        }).catch(() => null);
      }

      // 4. Add Tag Action
      else if (action.actionType === 'add_lead_tag' && lead) {
        const tag = config.tagToAdd || rule.actionConfig?.tagToAdd || rule.actionConfig?.targetTag;
        if (tag && !lead.tags.includes(tag)) {
          lead.tags.push(tag);
          lead.leadActivities = lead.leadActivities || [];
          lead.leadActivities.push({
            action: 'lead_updated',
            performerName: 'Automation Engine',
            details: `Added tag '${tag}' by rule '${rule.name}'`,
            timestamp: new Date(),
          });
          await lead.save().catch(() => null);

          await AutomationLog.create({
            ruleId: rule._id,
            ruleName: rule.name,
            workspaceId,
            userId: user?._id || lead.userId,
            leadId: lead._id,
            leadName: lead.name,
            triggerType: rule.triggerType,
            actionType: 'add_lead_tag',
            status: 'success',
            messageSent: `Added tag: ${tag}`,
            executionDurationMs: Date.now() - startTime,
            durationMs: Date.now() - startTime,
            executedAt: new Date(),
            timestamp: new Date(),
          }).catch(() => null);
        }
      }

      // 5. Assign Counselor Action
      else if (action.actionType === 'assign_counselor' && lead) {
        const targetUserId = config.assignedUserId || rule.actionConfig?.assignedUserId;
        if (targetUserId) {
          const counselor = await User.findById(targetUserId).select('name email');
          if (counselor) {
            lead.assignedTo = counselor._id;
            lead.assignedToName = counselor.name;
            lead.leadActivities = lead.leadActivities || [];
            lead.leadActivities.push({
              action: 'lead_assigned',
              performerName: 'Automation Engine',
              details: `Lead assigned to ${counselor.name} by rule '${rule.name}'`,
              timestamp: new Date(),
            });
            await lead.save().catch(() => null);

            await AutomationLog.create({
              ruleId: rule._id,
              ruleName: rule.name,
              workspaceId,
              userId: user?._id || lead.userId,
              leadId: lead._id,
              leadName: lead.name,
              triggerType: rule.triggerType,
              actionType: 'assign_counselor',
              status: 'success',
              messageSent: `Assigned to counselor: ${counselor.name}`,
              executionDurationMs: Date.now() - startTime,
              durationMs: Date.now() - startTime,
              executedAt: new Date(),
              timestamp: new Date(),
            }).catch(() => null);
          }
        }
      }

      // 6. Transfer / Reassign Lead Action (User, Campaign, or Stage)
      else if ((action.actionType === 'transfer_lead' || action.actionType === 'reassign_lead') && lead) {
        const transferDetails = [];

        // Reassign to specific counselor/manager
        const assigneeId = config.assignedUserId || rule.actionConfig?.assignedUserId;
        if (assigneeId) {
          const assignee = await User.findById(assigneeId).select('name email role');
          if (assignee) {
            lead.assignedTo = assignee._id;
            lead.assignedToName = assignee.name;
            lead.assignmentReason = `Automated Transfer by rule '${rule.name}': ${config.transferNote || rule.actionConfig?.transferNote || 'Rule criteria met'}`;
            transferDetails.push(`Assigned to ${assignee.name} (${assignee.role || 'Team Member'})`);
          }
        }

        // Transfer to Campaign
        const campaignId = config.targetCampaignId || rule.actionConfig?.targetCampaignId;
        if (campaignId) {
          const targetCamp = await Campaign.findById(campaignId);
          if (targetCamp) {
            lead.campaignId = targetCamp._id;
            lead.campaignName = targetCamp.displayName || targetCamp.name;
            if (!lead.leadSource) lead.leadSource = {};
            lead.leadSource.campaignId = String(targetCamp._id);
            lead.leadSource.campaignName = targetCamp.displayName || targetCamp.name;
            transferDetails.push(`Campaign: "${targetCamp.displayName || targetCamp.name}"`);

            await Campaign.updateOne(
              { _id: targetCamp._id },
              { $inc: { leadCount: 1, leadsGenerated: 1 }, $set: { lastLeadAt: new Date() } }
            ).catch(() => null);
          }
        }

        // Move Stage
        const stageTarget = config.newStage || rule.actionConfig?.newStage;
        if (stageTarget && String(stageTarget).trim()) {
          const oldStage = lead.status;
          lead.status = String(stageTarget).trim();
          lead.stageHistory = lead.stageHistory || [];
          lead.stageHistory.push({
            fromStage: oldStage,
            toStage: lead.status,
            changedAt: new Date(),
          });
          transferDetails.push(`Stage moved to "${stageTarget}"`);
        }

        const note = config.transferNote || rule.actionConfig?.transferNote ? ` [Note: ${config.transferNote || rule.actionConfig?.transferNote}]` : '';
        lead.leadActivities = lead.leadActivities || [];
        lead.leadActivities.push({
          action: 'lead_transferred',
          performerName: 'Automation Engine',
          details: `Automated Reassignment [${rule.name}]: ${transferDetails.join(' • ')}${note}`,
          timestamp: new Date(),
        });

        await lead.save().catch(() => null);

        await AutomationLog.create({
          ruleId: rule._id,
          ruleName: rule.name,
          workspaceId,
          userId: user?._id || lead.userId,
          leadId: lead._id,
          leadName: lead.name,
          triggerType: rule.triggerType,
          actionType: 'transfer_lead',
          status: 'success',
          messageSent: `Transferred: ${transferDetails.join(' • ')}`,
          executionDurationMs: Date.now() - startTime,
          durationMs: Date.now() - startTime,
          executedAt: new Date(),
          timestamp: new Date(),
        }).catch(() => null);
      }
    } catch (actionErr) {
      // Record failed execution in AutomationLog so users have complete audit visibility
      await AutomationLog.create({
        ruleId: rule._id,
        ruleName: rule.name,
        workspaceId,
        userId: user?._id || lead?.userId,
        leadId: lead?._id || null,
        leadName: lead?.name || '',
        leadPhone: lead?.phone || customPhone || '',
        recipientPhone: lead?.phone || customPhone || '',
        leadEmail: lead?.email || '',
        recipientEmail: lead?.email || '',
        triggerType: rule.triggerType,
        channel: rule.channel || 'whatsapp',
        actionType: action.actionType,
        status: 'failed',
        error: actionErr.message,
        errorMessage: actionErr.message,
        executionDurationMs: Date.now() - startTime,
        durationMs: Date.now() - startTime,
        executedAt: new Date(),
        timestamp: new Date(),
      }).catch(() => null);

      throw actionErr;
    }
  }

  /**
   * Evaluates leads that have remained in a specific stage for a set number of days (e.g. 3, 5, 7 days)
   * Protected with distributed lock and idempotent log checking.
   */
  static async processIdleLeadAutomations() {
    const lockKey = 'lock:cron:idle_lead_automations';
    const acquiredLock = await cacheService.acquireLock(lockKey, 60000);
    if (!acquiredLock) {
      console.log('[AutomationEngine] Another process is running idle lead automation pass. Skipping.');
      return { processed: 0, locked: true };
    }

    try {
      const rules = await AutomationRule.find({
        triggerType: { $in: ['stage_duration', 'stale_lead'] },
        isActive: true,
      });

      if (!rules || rules.length === 0) return { processed: 0 };

      let processedCount = 0;

      for (const rule of rules) {
        const targetStage = rule.triggerConfig?.targetStage;
        const daysInStage = Number(rule.triggerConfig?.daysInStage) || 0;
        if (!targetStage || daysInStage <= 0) continue;

        const cutoffDate = new Date(Date.now() - daysInStage * 24 * 60 * 60 * 1000);
        const tenantQuery = this.getTenantQuery(rule.workspaceId, rule.userId);

        // Find leads matching tenant and stage that have been unmoved since cutoff
        const matchingLeads = await Lead.find({
          ...tenantQuery,
          status: targetStage,
          updatedAt: { $lte: cutoffDate },
        }).limit(50);

        for (const lead of matchingLeads) {
          // Idempotency: verify this rule hasn't already executed on this lead
          const alreadyExecuted = await AutomationLog.exists({
            ruleId: rule._id,
            leadId: lead._id,
            status: 'success',
          });

          if (alreadyExecuted) {
            continue;
          }

          try {
            await this.executeRuleActions(rule, {
              lead,
              workspaceId: rule.workspaceId || lead.workspaceId,
              user: { _id: rule.userId },
              depth: 1,
            });
            processedCount++;
          } catch (leadErr) {
            console.error(`[AutomationEngine] Error executing idle rule '${rule.name}' for lead ${lead._id}:`, leadErr.message);
          }
        }
      }

      return {
        evaluatedRules: rules.length,
        executedActions: processedCount,
        processed: processedCount,
      };
    } catch (err) {
      console.error('[AutomationEngine] Error in processIdleLeadAutomations:', err.message);
      return { evaluatedRules: 0, executedActions: 0, processed: 0, error: err.message };
    } finally {
      await cacheService.releaseLock(lockKey, acquiredLock);
    }
  }
}

module.exports = AutomationEngine;
