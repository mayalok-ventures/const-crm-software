const mongoose = require('mongoose');
const FollowUp = require('../models/FollowUp');
const Lead = require('../models/Lead');
const Workspace = require('../models/Workspace');
const AuditLog = require('../models/AuditLog');
const {
  verifyQuickActionTokenReadOnly,
  verifyAndConsumeQuickActionToken,
} = require('../utils/quickActionToken');
const { maskPhoneNumber } = require('../utils/phoneMasking');
const { emitCRMEvent, CRM_EVENTS } = require('../services/automationEvents');

/**
 * GET /api/leads/follow-ups/quick-action/verify?token=...
 * Verify token validity and fetch follow-up metadata for the minimal quick-action UI.
 */
exports.verifyQuickAction = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Quick-action token is required' });
    }

    const decoded = await verifyQuickActionTokenReadOnly(token);

    const [followUp, lead, workspace] = await Promise.all([
      FollowUp.findOne({
        _id: decoded.followUpId,
        ...(decoded.workspaceId ? { workspaceId: decoded.workspaceId } : {}),
      }).lean(),
      decoded.leadId
        ? Lead.findOne({
            _id: decoded.leadId,
            ...(decoded.workspaceId ? { workspaceId: decoded.workspaceId } : {}),
            isDeleted: { $ne: true },
            deletedAt: null,
          }).lean()
        : null,
      decoded.workspaceId ? Workspace.findById(decoded.workspaceId).lean() : null,
    ]);

    if (!followUp) {
      return res.status(404).json({ success: false, message: 'Follow-up not found or unauthorized' });
    }

    const shouldMask = workspace?.settings?.maskLeadPhones ?? false;
    let safeLead = null;
    if (lead) {
      safeLead = {
        _id: lead._id,
        name: lead.name || 'Candidate',
        phone: shouldMask ? maskPhoneNumber(lead.phone) : lead.phone,
        status: lead.status,
      };
    }

    res.json({
      success: true,
      valid: true,
      followUp: {
        _id: followUp._id,
        note: followUp.note,
        status: followUp.status,
        scheduledAt: followUp.scheduled_at || followUp.scheduledAt,
        delayCount: followUp.delay_count || followUp.delayCount || 0,
        type: followUp.type || 'call',
      },
      lead: safeLead,
      action: decoded.action,
      expiresAt: new Date(decoded.exp),
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      valid: false,
      message: err.message || 'Invalid or expired quick-action token',
    });
  }
};

/**
 * POST /api/leads/follow-ups/quick-action
 * Execute complete, snooze, or reschedule with mandatory outcome note.
 * Single-use token enforcement prevents replay.
 */
exports.executeQuickAction = async (req, res) => {
  try {
    const { token, action, note, scheduledAt, delayMinutes = 15, idempotencyKey } = req.body;

    if (!token) {
      return res.status(400).json({ success: false, message: 'Quick-action token is required' });
    }

    const cleanNote = (note || '').trim();
    if (!cleanNote) {
      return res.status(400).json({
        success: false,
        message: 'A non-empty outcome note is mandatory to complete, reschedule, or snooze this follow-up.',
      });
    }

    const targetAction = (action || 'complete').toLowerCase();
    if (!['complete', 'snooze', 'reschedule'].includes(targetAction)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Must be complete, snooze, or reschedule.',
      });
    }

    // Verify & atomically consume token (throws if replayed or expired)
    let decoded;
    try {
      decoded = await verifyAndConsumeQuickActionToken(token);
    } catch (consumeErr) {
      return res.status(409).json({
        success: false,
        code: 'TOKEN_CONSUMED_OR_EXPIRED',
        message: consumeErr.message,
      });
    }

    const followUp = await FollowUp.findOne({
      _id: decoded.followUpId,
      ...(decoded.workspaceId ? { workspaceId: decoded.workspaceId } : {}),
    });

    if (!followUp) {
      return res.status(404).json({ success: false, message: 'Follow-up not found or unauthorized' });
    }

    const lead = decoded.leadId
      ? await Lead.findOne({
          _id: decoded.leadId,
          ...(decoded.workspaceId ? { workspaceId: decoded.workspaceId } : {}),
          isDeleted: { $ne: true },
          deletedAt: null,
        })
      : null;

    const actorId = decoded.userId ? new mongoose.Types.ObjectId(decoded.userId) : null;
    const now = new Date();

    if (targetAction === 'complete') {
      followUp.status = 'completed';
      followUp.completed_at = now;
      followUp.completedAt = now;
      followUp.completion_note = cleanNote;
      followUp.completionNote = cleanNote;
      followUp.acknowledged = true;
      followUp.acknowledgedAt = now;
      if (actorId) followUp.agent_id = actorId;
      await followUp.save();

      if (lead) {
        if (!lead.activeFollowUp) {
          lead.activeFollowUp = {
            scheduledAt: followUp.scheduled_at,
            note: followUp.note,
            status: 'completed',
            completedAt: now,
            completionNote: cleanNote,
            completedBy: actorId,
          };
        } else {
          lead.activeFollowUp.status = 'completed';
          lead.activeFollowUp.completedAt = now;
          lead.activeFollowUp.completionNote = cleanNote;
          lead.activeFollowUp.completedBy = actorId;
        }

        lead.notes.push({
          text: `[Follow-Up Completed via Quick-Action]: ${cleanNote}`,
          createdBy: actorId,
          authorName: 'Agent (Mobile Push)',
          createdAt: now,
        });

        lead.leadActivities.push({
          action: 'followup_completed',
          performedBy: actorId,
          performerName: 'Agent (Mobile Push)',
          details: `Follow-up completed via Quick-Action. Outcome: "${cleanNote}"`,
          timestamp: now,
        });

        await lead.save();
      }

      emitCRMEvent(CRM_EVENTS.FOLLOWUP_COMPLETED, {
        followUp,
        lead,
        note: cleanNote,
        completedAt: now,
      });
    } else if (targetAction === 'snooze') {
      const currentDelays = followUp.delay_count || followUp.delayCount || 0;
      if (currentDelays >= 2) {
        return res.status(400).json({
          success: false,
          code: 'MAX_DELAYS_REACHED',
          message: 'Maximum 2 snoozes reached for this follow-up. An outcome note is required to complete it.',
        });
      }

      const snoozeMins = Math.max(5, Math.min(120, parseInt(delayMinutes, 10) || 15));
      const newScheduledAt = new Date(Date.now() + snoozeMins * 60 * 1000);

      followUp.scheduled_at = newScheduledAt;
      followUp.scheduledAt = newScheduledAt;
      followUp.delay_count = currentDelays + 1;
      followUp.delayCount = currentDelays + 1;
      followUp.notified = false;
      followUp.claimStatus = 'idle';
      followUp.acknowledged = true;
      followUp.acknowledgedAt = now;
      followUp.delay_history.push({
        delayed_at: now,
        delayed_until: newScheduledAt,
        delay_minutes: snoozeMins,
        reason: cleanNote,
        performed_by: actorId,
      });
      await followUp.save();

      if (lead) {
        lead.followUpDate = newScheduledAt;
        lead.followUpDelayCount = currentDelays + 1;
        lead.followUpNotified = false;
        if (lead.activeFollowUp) {
          lead.activeFollowUp.scheduledAt = newScheduledAt;
          lead.activeFollowUp.delayCount = currentDelays + 1;
        }

        lead.leadActivities.push({
          action: 'followup_postponed',
          performedBy: actorId,
          performerName: 'Agent (Mobile Push)',
          details: `Follow-up snoozed by ${snoozeMins} mins via Quick-Action. Reason: "${cleanNote}"`,
          timestamp: now,
        });
        await lead.save();
      }
    } else if (targetAction === 'reschedule') {
      const parsedDate = new Date(scheduledAt);
      if (isNaN(parsedDate.getTime()) || parsedDate.getTime() <= Date.now()) {
        return res.status(400).json({
          success: false,
          message: 'A valid future date/time is required to reschedule.',
        });
      }

      followUp.status = 'rescheduled';
      followUp.completed_at = now;
      followUp.completion_note = `Rescheduled: ${cleanNote}`;
      followUp.acknowledged = true;
      followUp.acknowledgedAt = now;
      await followUp.save();

      const newFollowUp = await FollowUp.create({
        workspaceId: decoded.workspaceId,
        lead_id: followUp.lead_id || followUp.leadId,
        leadId: followUp.lead_id || followUp.leadId,
        agent_id: actorId || followUp.agent_id,
        agentId: actorId || followUp.agent_id,
        scheduled_at: parsedDate,
        scheduledAt: parsedDate,
        note: cleanNote,
        delay_count: 0,
        type: followUp.type || 'call',
        status: 'open',
        companyId: followUp.companyId,
        createdBy: actorId,
        creatorName: 'Agent (Mobile Push)',
      });

      if (lead) {
        lead.followUpDate = parsedDate;
        lead.followUpNote = cleanNote;
        lead.followUpStatus = 'scheduled';
        lead.followUpDelayCount = 0;
        lead.followUpNotified = false;
        lead.activeFollowUp = {
          scheduledAt: parsedDate,
          note: cleanNote,
          status: 'scheduled',
          delayCount: 0,
        };

        lead.leadActivities.push({
          action: 'followup_rescheduled',
          performedBy: actorId,
          performerName: 'Agent (Mobile Push)',
          details: `Follow-up rescheduled to ${parsedDate.toLocaleString()} via Quick-Action. Reason: "${cleanNote}"`,
          timestamp: now,
        });
        await lead.save();
      }

      emitCRMEvent(CRM_EVENTS.FOLLOWUP_SCHEDULED, {
        lead,
        scheduledAt: parsedDate,
        note: cleanNote,
      });
    }

    // Async Audit Logging
    AuditLog.create({
      actorId,
      actorName: 'Agent (Quick Action)',
      actorRole: 'agent',
      workspaceId: decoded.workspaceId,
      action: `FOLLOWUP_${targetAction.toUpperCase()}`,
      resourceType: 'FollowUp',
      resourceId: decoded.followUpId,
      metadata: { note: cleanNote, action: targetAction, idempotencyKey },
      timestamp: now,
    }).catch(() => {});

    res.json({
      success: true,
      message: `Follow-up ${targetAction} successfully recorded ✅`,
      followUpId: followUp._id,
      leadId: lead?._id || null,
      action: targetAction,
    });
  } catch (err) {
    console.error('[QuickAction] Execution error:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error executing quick action' });
  }
};
