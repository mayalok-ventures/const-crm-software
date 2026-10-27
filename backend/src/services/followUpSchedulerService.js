const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const FollowUp = require('../models/FollowUp');
const { dispatchNotification } = require('./notificationService');

let isSchedulerRunning = false;
let lastSweepTimestamp = null;
let sweepStats = {
  lastRunAt: null,
  totalProcessed: 0,
  lastErrors: [],
};

/**
 * Sweep for due and overdue follow-ups across both Lead and FollowUp collections.
 * Uses atomic updates and unique dedupKeys to guarantee exactly-once dispatch
 * even under multi-instance or clustering deployments.
 */
const sweepDueFollowUps = async () => {
  if (isSchedulerRunning) return { skipped: true, reason: 'Already in progress' };
  if (mongoose.connection.readyState !== 1) return { skipped: true, reason: 'Database not ready' };

  isSchedulerRunning = true;
  const now = new Date();
  // Include follow-ups due right now or within the next 30 seconds
  const cutoff = new Date(now.getTime() + 30000);
  let processedCount = 0;

  try {
    // ── 1. SWEEP LEADS COLLECTION ──────────────────────────────────────────
    const dueLeads = await Lead.find({
      followUpDate: { $lte: cutoff, $ne: null },
      followUpNotified: { $ne: true },
      followUpStatus: { $nin: ['completed', 'cancelled'] },
      'activeFollowUp.status': { $nin: ['completed', 'cancelled'] },
      status: {
        $nin: [
          'closed', 'lost', 'Closed', 'Lost',
          'Closed / Won', 'Lost / Dropped', 'payment_done',
          'converted', 'not_interested',
        ],
      },
    })
      .limit(100)
      .lean();

    for (const lead of dueLeads) {
      // Atomic compare-and-swap lock on the lead document
      const locked = await Lead.findOneAndUpdate(
        {
          _id: lead._id,
          followUpNotified: { $ne: true },
          followUpStatus: { $nin: ['completed', 'cancelled', 'none'] },
        },
        {
          $set: {
            followUpNotified: true,
            followUpStatus: 'due',
            'activeFollowUp.status': 'due',
          },
        },
        { new: true }
      );

      if (!locked) continue; // Concurrently claimed by another worker instance

      const scheduledTime = lead.followUpDate ? new Date(lead.followUpDate).getTime() : now.getTime();
      const dedupKey = `followup_due_${lead._id}_${scheduledTime}`;
      const recipientId = lead.assignedTo || lead.userId;

      if (!recipientId) continue;

      const agendaNote = lead.followUpNote || lead.activeFollowUp?.note || 'Scheduled counseling follow-up call';
      const isOverdue = lead.followUpDate && new Date(lead.followUpDate) < new Date(now.getTime() - 15 * 60 * 1000);

      await dispatchNotification({
        userId: recipientId,
        workspaceId: lead.workspaceId || null,
        companyId: lead.companyId || null,
        leadId: lead._id,
        leadName: lead.name || 'Candidate',
        title: isOverdue ? `🚨 OVERDUE Follow-Up: ${lead.name || 'Candidate'}` : `⏰ Follow-Up Due: ${lead.name || 'Candidate'}`,
        message: `${lead.name || 'Candidate'} (${lead.phone || 'Phone'}) — Agenda: ${agendaNote}`,
        type: isOverdue ? 'follow_up_overdue' : 'follow_up',
        priority: isOverdue ? 'urgent' : 'high',
        category: 'reminder',
        entityType: 'Lead',
        entityId: lead._id,
        dueAt: lead.followUpDate || now,
        dedupKey,
        channels: ['in_app', 'push', 'sse'],
        pushPayload: {
          url: `/leads/${lead._id}`,
        },
      });

      processedCount++;
    }

    // ── 2. SWEEP FOLLOWUPS COLLECTION (Enterprise sub-record model) ─────────
    const dueFollowUps = await FollowUp.find({
      $or: [
        { scheduled_at: { $lte: cutoff, $ne: null } },
        { scheduledAt: { $lte: cutoff, $ne: null } },
      ],
      status: 'open',
      notified: { $ne: true },
    })
      .populate('leadId', 'name phone workspaceId companyId')
      .limit(100)
      .lean();

    for (const fup of dueFollowUps) {
      const lockedFup = await FollowUp.findOneAndUpdate(
        { _id: fup._id, status: 'open', notified: { $ne: true } },
        { $set: { notified: true, notifiedAt: new Date() } },
        { new: true }
      );

      if (!lockedFup) continue;

      const lead = fup.leadId || {};
      const recipientId = fup.agent_id || fup.agentId || fup.createdBy || lead.assignedTo || lead.userId;
      if (!recipientId) continue;

      const scheduledDate = fup.scheduled_at || fup.scheduledAt || now;
      const dedupKey = `fup_doc_due_${fup._id}_${new Date(scheduledDate).getTime()}`;

      await dispatchNotification({
        userId: recipientId,
        workspaceId: fup.workspaceId || lead.workspaceId || null,
        companyId: fup.companyId || lead.companyId || null,
        leadId: lead._id || fup.lead_id || null,
        leadName: lead.name || 'Candidate',
        title: `⏰ Follow-Up Reminder: ${lead.name || 'Candidate'}`,
        message: `${lead.name || 'Student'} (${lead.phone || 'Phone'}) — Note: ${fup.note || 'Follow-up call'}`,
        type: 'follow_up',
        priority: 'high',
        category: 'reminder',
        entityType: 'FollowUp',
        entityId: fup._id,
        dueAt: scheduledDate,
        dedupKey,
        channels: ['in_app', 'push', 'sse'],
        pushPayload: {
          url: lead._id ? `/leads/${lead._id}` : '/follow-ups',
        },
      });

      processedCount++;
    }

    lastSweepTimestamp = new Date();
    sweepStats.lastRunAt = lastSweepTimestamp;
    sweepStats.totalProcessed += processedCount;

    if (processedCount > 0) {
      console.log(`[FollowUpScheduler] Processed ${processedCount} due follow-up alarms with push & SSE dispatch.`);
    }

    return { success: true, processedCount };
  } catch (err) {
    console.error('[FollowUpScheduler] Sweep error:', err.message);
    sweepStats.lastErrors.unshift({ timestamp: new Date(), error: err.message });
    if (sweepStats.lastErrors.length > 5) sweepStats.lastErrors.pop();
    return { success: false, error: err.message };
  } finally {
    isSchedulerRunning = false;
  }
};

/**
 * Returns scheduler diagnostic health data
 */
const getSchedulerHealth = () => ({
  isSchedulerRunning,
  lastRunAt: sweepStats.lastRunAt,
  totalProcessed: sweepStats.totalProcessed,
  lastErrors: sweepStats.lastErrors,
});

module.exports = {
  sweepDueFollowUps,
  getSchedulerHealth,
};
