const mongoose = require('mongoose');
const Lead = require('../models/Lead');
const { buildLeadPermissionQuery } = require('./leadsController');
const { shouldMaskPhoneForUser, maskPhoneNumber } = require('../utils/phoneMasking');

/**
 * @desc  Find candidate duplicate leads by phone, phoneDigits, email, or exact name+location
 * @route GET /api/leads/:id/duplicate-candidates
 * @access Private
 */
exports.getDuplicateCandidates = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid lead ID format' });
    }

    const permissionQuery = await buildLeadPermissionQuery(req.user, false);
    const lead = await Lead.findOne({ _id: id, ...permissionQuery })
      .select('name phone phoneDigits email location workspaceId')
      .lean();

    if (!lead) {
      return res.status(404).json({ message: 'Lead not found or unauthorized' });
    }

    const wsId = req.workspaceId || lead.workspaceId;
    const matchConditions = [];

    // 1. Phone number match
    if (lead.phoneDigits && lead.phoneDigits.length >= 7) {
      matchConditions.push({ phoneDigits: lead.phoneDigits });
    } else if (lead.phone && lead.phone.trim().length >= 7) {
      matchConditions.push({ phone: lead.phone.trim() });
    }

    // 2. Email address match
    if (lead.email && lead.email.trim().length > 0) {
      matchConditions.push({ email: lead.email.trim().toLowerCase() });
    }

    // 3. Exact Name + Location similarity match
    if (
      lead.name &&
      lead.name.trim().length > 3 &&
      lead.location &&
      lead.location.trim().length > 2
    ) {
      matchConditions.push({
        name: new RegExp(`^${lead.name.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        location: new RegExp(`^${lead.location.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      });
    }

    if (matchConditions.length === 0) {
      return res.json({
        success: true,
        leadId: lead._id,
        leadName: lead.name,
        count: 0,
        candidates: [],
      });
    }

    const query = {
      _id: { $ne: lead._id },
      deletedAt: null,
      ...(wsId ? { workspaceId: wsId } : {}),
      $or: matchConditions,
    };

    const candidates = await Lead.find(query)
      .select('name phone phoneDigits email status stage pipelineStage score createdAt updatedAt assignedTo location budget')
      .populate('assignedTo', 'name email usercode')
      .limit(25)
      .lean();

    const scoredCandidates = candidates.map((cand) => {
      let matchType = 'unknown';
      let confidence = 0.5;

      const phoneMatch = Boolean(
        (lead.phoneDigits && cand.phoneDigits && lead.phoneDigits === cand.phoneDigits) ||
        (lead.phone && cand.phone && lead.phone.trim() === cand.phone.trim())
      );
      const emailMatch = Boolean(
        lead.email &&
        cand.email &&
        lead.email.trim().toLowerCase() === cand.email.trim().toLowerCase()
      );
      const nameLocMatch = Boolean(
        lead.name &&
        cand.name &&
        lead.name.trim().toLowerCase() === cand.name.trim().toLowerCase() &&
        lead.location &&
        cand.location &&
        lead.location.trim().toLowerCase() === cand.location.trim().toLowerCase()
      );

      if (phoneMatch && emailMatch) {
        matchType = 'phone_and_email';
        confidence = 0.99;
      } else if (phoneMatch) {
        matchType = 'phone';
        confidence = 0.95;
      } else if (emailMatch) {
        matchType = 'email';
        confidence = 0.9;
      } else if (nameLocMatch) {
        matchType = 'name_and_location';
        confidence = 0.7;
      }

      return {
        ...cand,
        matchType,
        confidence,
      };
    });

    scoredCandidates.sort((a, b) => b.confidence - a.confidence);

    const shouldMask = await shouldMaskPhoneForUser(req.user, req.membership, req.workspace);
    if (shouldMask) {
      scoredCandidates.forEach((cand) => {
        if (cand.phone) cand.phone = maskPhoneNumber(cand.phone);
        if (cand.phoneDigits) cand.phoneDigits = maskPhoneNumber(cand.phoneDigits);
      });
    }

    res.json({
      success: true,
      leadId: lead._id,
      leadName: lead.name,
      count: scoredCandidates.length,
      candidates: scoredCandidates,
    });
  } catch (error) {
    console.error('getDuplicateCandidates error:', error);
    res.status(500).json({ message: 'Server error retrieving duplicate candidates' });
  }
};

/**
 * @desc  Atomic merge of secondary lead into primary lead with entity reassignment and soft delete
 * @route POST /api/leads/merge
 * @access Private
 */
exports.mergeLeads = async (req, res) => {
  try {
    const { primaryLeadId, secondaryLeadId, fieldOverrides = {} } = req.body;

    if (
      !primaryLeadId ||
      !secondaryLeadId ||
      !mongoose.Types.ObjectId.isValid(primaryLeadId) ||
      !mongoose.Types.ObjectId.isValid(secondaryLeadId)
    ) {
      return res.status(400).json({ message: 'Valid primaryLeadId and secondaryLeadId are required' });
    }

    if (String(primaryLeadId) === String(secondaryLeadId)) {
      return res.status(400).json({ message: 'Cannot merge a lead into itself' });
    }

    const permissionQuery = await buildLeadPermissionQuery(req.user, false);
    const [primaryLead, secondaryLead] = await Promise.all([
      Lead.findOne({ _id: primaryLeadId, ...permissionQuery }),
      Lead.findOne({ _id: secondaryLeadId, ...permissionQuery }),
    ]);

    if (!primaryLead || !secondaryLead) {
      return res.status(404).json({ message: 'One or both leads not found or unauthorized' });
    }

    if (secondaryLead.deletedAt) {
      return res.status(400).json({ message: 'Secondary lead is already deleted or merged' });
    }

    // Lazy load models for relational entity reassignment
    const FollowUp = mongoose.models.FollowUp || require('../models/FollowUp');
    const ChatMessage = mongoose.models.ChatMessage || require('../models/ChatMessage');
    const EmailMessage = mongoose.models.EmailMessage || require('../models/EmailMessage');
    const Payment = mongoose.models.Payment || require('../models/Payment');
    const FeeInstallment = mongoose.models.FeeInstallment || require('../models/FeeInstallment');
    const Recording = mongoose.models.Recording || require('../models/Recording');

    // 1. Reassign all child/relational entities
    await Promise.all([
      FollowUp.updateMany(
        { $or: [{ lead_id: secondaryLead._id }, { leadId: secondaryLead._id }] },
        { $set: { lead_id: primaryLead._id, leadId: primaryLead._id } }
      ),
      ChatMessage.updateMany(
        { leadId: secondaryLead._id },
        { $set: { leadId: primaryLead._id } }
      ),
      EmailMessage.updateMany(
        { leadId: secondaryLead._id },
        { $set: { leadId: primaryLead._id } }
      ),
      Payment.updateMany(
        { $or: [{ lead_id: secondaryLead._id }, { leadId: secondaryLead._id }] },
        { $set: { lead_id: primaryLead._id, leadId: primaryLead._id } }
      ),
      FeeInstallment.updateMany(
        { leadId: secondaryLead._id },
        { $set: { leadId: primaryLead._id } }
      ),
      Recording.updateMany(
        { leadId: secondaryLead._id },
        { $set: { leadId: primaryLead._id } }
      ),
    ]);

    // 2. Append history and notes to primary lead
    if (Array.isArray(secondaryLead.leadActivities) && secondaryLead.leadActivities.length > 0) {
      for (const act of secondaryLead.leadActivities) {
        primaryLead.leadActivities.push({
          action: act.action,
          performedBy: act.performedBy,
          performerName: act.performerName,
          details: `[From merged lead ${secondaryLead._id}] ${act.details || ''}`,
          timestamp: act.timestamp,
        });
      }
    }

    primaryLead.leadActivities.push({
      action: 'lead_merged',
      performedBy: req.user._id,
      performerName: req.user.name || 'Agent',
      details: `Merged duplicate record '${secondaryLead.name}' (${secondaryLead._id}) into this lead. Reassigned all communications, follow-ups, and payments.`,
      timestamp: new Date(),
    });

    if (Array.isArray(secondaryLead.notes) && secondaryLead.notes.length > 0) {
      if (!Array.isArray(primaryLead.notes)) primaryLead.notes = [];
      for (const n of secondaryLead.notes) {
        primaryLead.notes.push({
          text: `[From merged lead ${secondaryLead._id}]: ${n.text || ''}`,
          createdBy: n.createdBy || req.user._id,
          authorName: n.authorName || 'Agent',
          createdAt: n.createdAt || new Date(),
        });
      }
    }

    // Apply allowed field overrides
    const allowedOverrides = [
      'name',
      'email',
      'phone',
      'alternatePhone',
      'targetCourse',
      'courseInterest',
      'budget',
      'location',
      'source',
      'status',
    ];
    for (const key of allowedOverrides) {
      if (fieldOverrides[key] !== undefined && fieldOverrides[key] !== null) {
        if (key === 'courseInterest') {
          primaryLead.targetCourse = fieldOverrides[key];
        } else {
          primaryLead[key] = fieldOverrides[key];
        }
      }
    }

    await primaryLead.save();

    // 3. Soft-delete and archive secondary lead
    secondaryLead.deletedAt = new Date();
    secondaryLead.deletedBy = req.user._id;
    secondaryLead.status = 'merged';
    secondaryLead.mergedInto = primaryLead._id;
    if (!Array.isArray(secondaryLead.notes)) secondaryLead.notes = [];
    secondaryLead.notes.push({
      text: `[MERGED INTO LEAD ${primaryLead._id} on ${new Date().toISOString()} by ${req.user.name || 'User'}]`,
      createdBy: req.user._id,
      authorName: req.user.name || 'User',
      createdAt: new Date(),
    });

    await secondaryLead.save();

    // 4. Audit Log
    try {
      const AuditLog = mongoose.models.AuditLog || require('../models/AuditLog');
      await AuditLog.create({
        actorId: req.user._id,
        actorName: req.user.name || 'User',
        actorEmail: req.user.email || null,
        actorRole: req.membership?.role || req.user.role || 'user',
        organizationId: req.workspaceId || primaryLead.workspaceId || null,
        action: 'LEAD_MERGED',
        resourceType: 'Lead',
        resourceId: String(primaryLead._id),
        resourceName: primaryLead.name,
        metadata: {
          primaryLeadId: String(primaryLead._id),
          secondaryLeadId: String(secondaryLead._id),
          secondaryLeadName: secondaryLead.name,
          fieldOverrides,
        },
        timestamp: new Date(),
      });
    } catch (auditErr) {
      console.warn('[AuditLog] Lead merge audit log note:', auditErr.message);
    }

    res.json({
      success: true,
      message: `Successfully merged lead '${secondaryLead.name}' into '${primaryLead.name}'`,
      primaryLeadId: primaryLead._id,
      secondaryLeadId: secondaryLead._id,
      primaryLead,
    });
  } catch (error) {
    console.error('mergeLeads error:', error);
    res.status(500).json({ message: 'Server error merging leads' });
  }
};
