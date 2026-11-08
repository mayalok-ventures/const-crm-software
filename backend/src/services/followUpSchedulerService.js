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
  const FOLLOWUP_LOOKBACK_HOURS = parseInt(process.env.FOLLOWUP_LOOKBACK_HOURS, 10) || 24;
  const minCutoff = new Date(now.getTime() - FOLLOWUP_LOOKBACK_HOURS * 60 * 60 * 1000);
  // Include follow-ups due right now or within the next 30 seconds, bounded by lookback window
  const cutoff = new Date(now.getTime() + 30000);
  let processedCount = 0;

  const CLAIM_TIMEOUT_MS = parseInt(process.env.FOLLOWUP_CLAIM_TIMEOUT_MS, 10) || 5 * 60 * 1000;
  const staleClaimThreshold = new Date(now.getTime() - CLAIM_TIMEOUT_MS);

  try {
    // ── 1. SWEEP LEADS COLLECTION ──────────────────────────────────────────
    const dueLeads = await Lead.find({
      followUpDate: { $gte: minCutoff, $lte: cutoff },
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
      $or: [
        { followUpClaimStatus: { $in: [null, undefined, 'idle', 'failed'] } },
        { followUpClaimStatus: 'processing', followUpClaimedAt: { $lt: staleClaimThreshold } },
      ],
    })
      .limit(100)
      .lean();

    for (const lead of dueLeads) {
      // Atomic compare-and-swap lock on the lead document with stale claim recovery
      const locked = await Lead.findOneAndUpdate(
        {
          _id: lead._id,
          followUpNotified: { $ne: true },
          followUpStatus: { $nin: ['completed', 'cancelled'] },
          $or: [
            { followUpClaimStatus: { $in: [null, undefined, 'idle', 'failed'] } },
            { followUpClaimStatus: 'processing', followUpClaimedAt: { $lt: staleClaimThreshold } },
          ],
        },
        {
          $set: {
            followUpClaimStatus: 'processing',
            followUpClaimedAt: now,
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

      try {
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

        await Lead.updateOne(
          { _id: lead._id },
          {
            $set: {
              followUpNotified: true,
              followUpClaimStatus: 'dispatched',
              followUpDispatchedAt: new Date(),
            },
          }
        );
        processedCount++;
      } catch (dispErr) {
        console.error(`[FollowUpScheduler] Dispatch error on lead ${lead._id}:`, dispErr.message);
        await Lead.updateOne(
          { _id: lead._id },
          { $set: { followUpClaimStatus: 'failed', followUpNotified: false } }
        );
      }
    }

    // ── 2. SWEEP FOLLOWUPS COLLECTION (Enterprise sub-record model) ─────────
    const dueFollowUps = await FollowUp.find({
      $or: [
        { scheduled_at: { $gte: minCutoff, $lte: cutoff } },
        { scheduledAt: { $gte: minCutoff, $lte: cutoff } },
      ],
      status: 'open',
      notified: { $ne: true },
      $or: [
        { claimStatus: { $in: [null, undefined, 'idle', 'failed'] } },
        { claimStatus: 'processing', claimedAt: { $lt: staleClaimThreshold } },
      ],
    })
      .populate('leadId', 'name phone workspaceId companyId')
      .limit(100)
      .lean();

    for (const fup of dueFollowUps) {
      const lockedFup = await FollowUp.findOneAndUpdate(
        {
          _id: fup._id,
          status: 'open',
          notified: { $ne: true },
          $or: [
            { claimStatus: { $in: [null, undefined, 'idle', 'failed'] } },
            { claimStatus: 'processing', claimedAt: { $lt: staleClaimThreshold } },
          ],
        },
        {
          $set: {
            claimStatus: 'processing',
            claimedAt: now,
          },
        },
        { new: true }
      );

      if (!lockedFup) continue;

      const lead = fup.leadId;
      if (!lead || !lead._id) {
        // Orphan follow-up record (lead deleted or soft-deleted)
        await FollowUp.updateOne(
          { _id: fup._id },
          { $set: { status: 'cancelled', claimStatus: 'orphaned_skipped' } }
        );
        continue;
      }

      const recipientId = fup.agent_id || fup.agentId || fup.createdBy || lead.assignedTo || lead.userId;
      if (!recipientId) continue;

      const scheduledDate = fup.scheduled_at || fup.scheduledAt || now;
      const dedupKey = `fup_doc_due_${fup._id}_${new Date(scheduledDate).getTime()}`;

      try {
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

        await FollowUp.updateOne(
          { _id: fup._id },
          { $set: { notified: true, notifiedAt: new Date(), claimStatus: 'dispatched' } }
        );
        processedCount++;
      } catch (dispErr) {
        console.error(`[FollowUpScheduler] Dispatch error on fup ${fup._id}:`, dispErr.message);
        await FollowUp.updateOne(
          { _id: fup._id },
          { $set: { claimStatus: 'failed', notified: false } }
        );
      }
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
