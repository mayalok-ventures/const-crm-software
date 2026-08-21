const mongoose = require('mongoose');
const Role = require('../models/Role');
const User = require('../models/User');
const Lead = require('../models/Lead');
const LeadOwnership = require('../models/LeadOwnership');
const LeadTransferRequest = require('../models/LeadTransferRequest');
const LeadContribution = require('../models/LeadContribution');
const IncentivePolicy = require('../models/IncentivePolicy');
const Incentive = require('../models/Incentive');
const ActivityLog = require('../models/ActivityLog');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const { PERMISSIONS, resolveTenantId } = require('../middleware/permission');

const runInTransaction = async (workFn) => {
  let session = null;
  try {
    session = await mongoose.startSession();
    session.startTransaction();
    const result = await workFn(session);
    await session.commitTransaction();
    session.endSession();
    return result;
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (abortErr) {
        // ignore
      }
      session.endSession();
    }
    const isStandaloneError = 
      error.message.includes('replica set') || 
      error.message.includes('Transaction numbers') || 
      error.message.includes('session');
    if (isStandaloneError) {
      console.warn('[Mongoose Transaction Fallback]: Running without transaction since MongoDB is Standalone.');
      return await workFn(null);
    }
    throw error;
  }
};

// Helper to log user activities
const logActivity = async ({ tenantId, actorUserId, action, targetType, targetId, details, visibility, beforeState, afterState }) => {
  try {
    const actor = await User.findById(actorUserId).select('name role').lean();
    await ActivityLog.create({
      tenantId,
      userId: actorUserId,
      userName: actor ? actor.name : 'System',
      role: actor ? actor.role : 'user',
      action,
      eventType: action,
      targetType,
      targetId: String(targetId),
      details,
      visibility: visibility || 'PRIVATE',
      beforeState,
      afterState,
    });
  } catch (err) {
    console.error('[ActivityLog Error]:', err.message);
  }
};

// Helper to log system/security audits
const logAudit = async ({ actorId, actorRole, targetUserId, targetCompanyId, action, beforeState, afterState, reason, metadata }) => {
  try {
    await AuditLog.create({
      actorId,
      actorRole: actorRole || 'user',
      targetUserId,
      targetCompanyId,
      action,
      beforeState,
      afterState,
      reason,
      metadata: metadata || {},
    });
  } catch (err) {
    console.error('[AuditLog Error]:', err.message);
  }
};

// Helper to calculate and distribute incentives based on policy
const calculateIncentives = async (leadId, tenantId, session = null) => {
  const lead = await Lead.findOne({ _id: leadId, companyId: tenantId }).session(session);
  if (!lead) return;

  // Retrieve active policy
  const policy = await IncentivePolicy.findOne({ tenantId, isActive: true })
    .sort({ priority: -1 })
    .session(session)
    .lean();

  const totalSales = lead.closedDealAmount || lead.paid_amount || 0;
  if (totalSales <= 0) return;

  const baseIncentivePct = lead.incentivePct || 10; // default 10%
  const totalIncentiveAmount = (totalSales * baseIncentivePct) / 100;

  // Get active contributors/handlers
  const ownerships = await LeadOwnership.find({ leadId, tenantId })
    .sort({ startedAt: 1 })
    .session(session)
    .lean();

  if (ownerships.length === 0) {
    // Fallback: Current assigned user gets 100%
    const beneficiaryId = lead.currentOwnerId || lead.assignedTo || lead.userId;
    await saveIncentiveRecord({
      tenantId,
      leadId,
      agentId: beneficiaryId,
      totalSales,
      incentivePct: baseIncentivePct,
      incentiveAmount: totalIncentiveAmount,
      policySnapshot: { type: 'DEFAULT_FINAL_OWNER', beneficiaryId },
    }, session);
    return;
  }

  const firstHandlerId = ownerships[0].ownerUserId;
  const currentOwner = ownerships.find(o => o.isCurrent);
  const finalOwnerId = currentOwner ? currentOwner.ownerUserId : ownerships[ownerships.length - 1].ownerUserId;

  const policyType = policy ? policy.calculationType : 'FINAL_OWNER';

  if (policyType === 'FINAL_OWNER') {
    await saveIncentiveRecord({
      tenantId,
      leadId,
      agentId: finalOwnerId,
      totalSales,
      incentivePct: baseIncentivePct,
      incentiveAmount: totalIncentiveAmount,
      policySnapshot: policy || { type: 'FINAL_OWNER' },
    }, session);
  } else if (policyType === 'FIRST_HANDLER') {
    await saveIncentiveRecord({
      tenantId,
      leadId,
      agentId: firstHandlerId,
      totalSales,
      incentivePct: baseIncentivePct,
      incentiveAmount: totalIncentiveAmount,
      policySnapshot: policy || { type: 'FIRST_HANDLER' },
    }, session);
  } else if (policyType === 'SPLIT') {
    const firstPct = policy ? (policy.firstHandlerPercentage || 40) : 40;
    const finalPct = policy ? (policy.closerPercentage || 60) : 60;

    const firstAmt = (totalIncentiveAmount * firstPct) / 100;
    const finalAmt = (totalIncentiveAmount * finalPct) / 100;

    // Distribute to First Handler
    await saveIncentiveRecord({
      tenantId,
      leadId,
      agentId: firstHandlerId,
      totalSales,
      incentivePct: (baseIncentivePct * firstPct) / 100,
      incentiveAmount: firstAmt,
      policySnapshot: policy,
    }, session);

    // Distribute to Final Owner
    await saveIncentiveRecord({
      tenantId,
      leadId,
      agentId: finalOwnerId,
      totalSales,
      incentivePct: (baseIncentivePct * finalPct) / 100,
      incentiveAmount: finalAmt,
      policySnapshot: policy,
    }, session);
  } else {
    // Default fallback to final owner
    await saveIncentiveRecord({
      tenantId,
      leadId,
      agentId: finalOwnerId,
      totalSales,
      incentivePct: baseIncentivePct,
      incentiveAmount: totalIncentiveAmount,
      policySnapshot: policy || { type: 'FINAL_OWNER_FALLBACK' },
    }, session);
  }
};

const saveIncentiveRecord = async (data, session) => {
  try {
    const version = 1;
    // Enforce idempotency key check (unique compound index prevents duplication)
    await Incentive.findOneAndUpdate(
      {
        tenantId: data.tenantId,
        leadId: data.leadId,
        agentId: data.agentId,
        agent_id: data.agentId,
        incentiveVersion: version,
      },
      {
        $set: {
          agentId: data.agentId,
          agent_id: data.agentId,
          totalSales: data.totalSales,
          incentivePct: data.incentivePct,
          incentiveAmount: data.incentiveAmount,
          policySnapshot: data.policySnapshot,
          status: 'PENDING',
          dealsCount: 1,
        },
      },
      { upsert: true, new: true, session }
    );
  } catch (err) {
    console.error('[saveIncentiveRecord Error]:', err.message);
  }
};

// 1. Roles Management Controllers
exports.createRole = async (req, res) => {
  try {
    const { name, description, roleType, permissions } = req.body;
    if (!name) return res.status(400).json({ message: 'Role name is required' });

    // Enforce Permission Ceiling: Cannot grant permissions the creator does not possess
    if (permissions && permissions.length > 0) {
      const creatorPermissions = req.user.role === 'superadmin' || req.user.isAdmin
        ? Object.values(PERMISSIONS)
        : (req.user.roleId 
            ? (await Role.findOne({ _id: req.user.roleId, tenantId: req.tenantId }).lean())?.permissions || []
            : (req.user.companyRole === 'owner' || req.user.workStatus === 'company_owner' ? Object.values(PERMISSIONS) : [])
          );

      const invalidPermissions = permissions.filter(p => !creatorPermissions.includes(p));
      if (invalidPermissions.length > 0) {
        return res.status(403).json({
          message: 'Permission ceiling violation: cannot grant permissions you do not possess',
          invalidPermissions,
        });
      }
    }

    const role = await Role.create({
      tenantId: req.tenantId,
      name,
      description,
      roleType: roleType || 'CUSTOM',
      permissions: permissions || [],
      createdBy: req.user._id,
    });

    await logAudit({
      actorId: req.user._id,
      actorRole: req.user.role,
      targetUserId: req.user._id,
      targetCompanyId: req.tenantId,
      action: 'OWNER_CHANGED_ROLE',
      afterState: role.toObject(),
      reason: `Created custom role ${name}`,
    });

    res.status(201).json({ success: true, role });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRoles = async (req, res) => {
  try {
    const roles = await Role.find({ tenantId: req.tenantId }).lean();
    res.json({ success: true, roles });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissions, isActive } = req.body;

    const role = await Role.findOne({ _id: id, tenantId: req.tenantId });
    if (!role) return res.status(404).json({ message: 'Role not found' });

    // Protect OWNER system role
    if (role.roleType === 'OWNER') {
      return res.status(403).json({ message: 'Cannot modify system OWNER role configurations' });
    }

    // Enforce Permission Ceiling on modifications
    if (permissions) {
      const creatorPermissions = req.user.role === 'superadmin' || req.user.isAdmin
        ? Object.values(PERMISSIONS)
        : (req.user.roleId 
            ? (await Role.findOne({ _id: req.user.roleId, tenantId: req.tenantId }).lean())?.permissions || []
            : (req.user.companyRole === 'owner' || req.user.workStatus === 'company_owner' ? Object.values(PERMISSIONS) : [])
          );

      const invalidPermissions = permissions.filter(p => !creatorPermissions.includes(p));
      if (invalidPermissions.length > 0) {
        return res.status(403).json({
          message: 'Permission ceiling violation: cannot grant permissions you do not possess',
          invalidPermissions,
        });
      }
    }

    const beforeState = role.toObject();
    if (name !== undefined) role.name = name;
    if (description !== undefined) role.description = description;
    if (permissions !== undefined) role.permissions = permissions;
    if (isActive !== undefined) role.isActive = isActive;
    role.updatedBy = req.user._id;

    await role.save();

    await logAudit({
      actorId: req.user._id,
      actorRole: req.user.role,
      targetUserId: req.user._id,
      targetCompanyId: req.tenantId,
      action: 'OWNER_CHANGED_ROLE',
      beforeState,
      afterState: role.toObject(),
      reason: `Updated role ${role.name}`,
    });

    res.json({ success: true, role });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await Role.findOne({ _id: id, tenantId: req.tenantId });
    if (!role) return res.status(404).json({ message: 'Role not found' });

    // System roles protection
    if (role.isSystemRole || role.roleType === 'OWNER') {
      return res.status(403).json({ message: 'System protected roles cannot be deleted' });
    }

    // Role Deletion Protection: Cannot delete if assigned to active users
    const usersAssigned = await User.countDocuments({ roleId: id, employeeStatus: 'active' });
    if (usersAssigned > 0) {
      return res.status(400).json({
        message: `Cannot delete role. It is currently assigned to ${usersAssigned} active employees. Please reassign them first.`,
      });
    }

    await Role.deleteOne({ _id: id });

    await logAudit({
      actorId: req.user._id,
      actorRole: req.user.role,
      targetUserId: req.user._id,
      targetCompanyId: req.tenantId,
      action: 'OWNER_CHANGED_ROLE',
      beforeState: role.toObject(),
      reason: `Deleted custom role: ${role.name}`,
    });

    res.json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 2. Lead Claiming Systems
exports.claimLead = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await runInTransaction(async (session) => {
      // Atomic execution check: fetch and lock/update lead only if unclaimed
      const lead = await Lead.findOneAndUpdate(
        {
          _id: id,
          companyId: req.tenantId,
          $or: [
            { currentOwnerId: null },
            { ownershipStatus: 'unclaimed' },
          ],
        },
        {
          $set: {
            currentOwnerId: req.user._id,
            claimedAt: new Date(),
            ownershipStatus: 'claimed',
            assignedTo: req.user._id,
            assignedToName: req.user.name,
          },
        },
        { new: true, session }
      );

      if (!lead) {
        // Fetch current owner to display conflict info
        const conflictLead = await Lead.findOne({ _id: id, companyId: req.tenantId }).populate('currentOwnerId', 'name email').session(session);
        return { success: false, conflict: true, currentOwner: conflictLead ? conflictLead.currentOwnerId : null };
      }

      // Deactivate previous active ownership records
      await LeadOwnership.updateMany(
        { leadId: id, tenantId: req.tenantId, isCurrent: true },
        { $set: { isCurrent: false, endedAt: new Date() } },
        { session }
      );

      // Create new Ownership Record
      const ownership = await LeadOwnership.create([{
        tenantId: req.tenantId,
        leadId: id,
        ownerUserId: req.user._id,
        ownershipType: 'CLAIM',
        startedAt: new Date(),
        isCurrent: true,
        source: 'claim',
      }], { session });

      // Track contribution record
      await LeadContribution.create([{
        tenantId: req.tenantId,
        leadId: id,
        userId: req.user._id,
        ownershipId: ownership[0]._id,
        startAt: new Date(),
      }], { session });

      return { success: true, lead };
    });

    if (!result.success) {
      return res.status(409).json({
        message: 'This lead is currently being handled by another employee.',
        code: 'LEAD_ALREADY_CLAIMED',
        currentOwner: result.currentOwner,
      });
    }

    // Log Activity (Global Visibility)
    await logActivity({
      tenantId: req.tenantId,
      actorUserId: req.user._id,
      action: 'LEAD_CLAIMED',
      targetType: 'lead',
      targetId: id,
      details: `${req.user.name} claimed Lead ${result.lead.name}`,
      visibility: 'GLOBAL',
      afterState: result.lead.toObject(),
    });

    res.json({ success: true, lead: result.lead });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. Lead Transfer Request Systems
exports.requestTransfer = async (req, res) => {
  try {
    const { id } = req.params; // lead ID
    const { requestedToUserId, reason } = req.body;

    if (!requestedToUserId || !reason) {
      return res.status(400).json({ message: 'Target user and reason are required' });
    }

    const lead = await Lead.findOne({ _id: id, companyId: req.tenantId });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    // Ensure the lead currently has an owner
    if (!lead.currentOwnerId) {
      return res.status(400).json({ message: 'Cannot request transfer for an unclaimed lead. Claim it first.' });
    }

    // Expiry date (e.g. 48 hours SLA)
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const request = await LeadTransferRequest.create({
      tenantId: req.tenantId,
      leadId: id,
      requestedBy: req.user._id,
      currentOwnerId: lead.currentOwnerId,
      requestedTo: requestedToUserId,
      requestType: 'NORMAL',
      status: 'PENDING',
      reason,
      expiresAt,
    });

    // Create Notification for recipient
    await Notification.create({
      userId: requestedToUserId,
      title: '🔄 Lead Transfer Request',
      message: `${req.user.name} wants to transfer lead ${lead.name} to you. Reason: ${reason}`,
      type: 'transfer_request',
    });

    await logActivity({
      tenantId: req.tenantId,
      actorUserId: req.user._id,
      action: 'TRANSFER_REQUESTED',
      targetType: 'lead',
      targetId: id,
      details: `${req.user.name} requested lead transfer to recipient`,
      visibility: 'GLOBAL',
    });

    res.status(201).json({ success: true, request });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.acceptTransfer = async (req, res) => {
  try {
    const { id } = req.params; // request ID
    req.tenantId = resolveTenantId(req.user);

    const result = await runInTransaction(async (session) => {
      const request = await LeadTransferRequest.findOne({ _id: id, tenantId: req.tenantId }).session(session);
      if (!request) return { success: false, code: 404, message: 'Transfer request not found' };

      // Contextual Authorization Check
      const isRecipient = String(request.requestedTo) === String(req.user._id);
      let hasApprovePermission = false;
      if (req.user.isAdmin || req.user.role === 'superadmin' || req.user.companyRole === 'owner' || req.user.workStatus === 'company_owner') {
        hasApprovePermission = true;
      } else if (req.user.roleId) {
        const role = await Role.findOne({ _id: req.user.roleId, tenantId: req.tenantId }).session(session).lean();
        if (role && (role.permissions.includes(PERMISSIONS.LEAD_TRANSFER_APPROVE) || role.roleType === 'OWNER')) {
          hasApprovePermission = true;
        }
      }
      if (!isRecipient && !hasApprovePermission) {
        return { success: false, code: 403, message: "Access denied: missing permission 'LEAD_TRANSFER_APPROVE'" };
      }

      // Concurrency verification: must be PENDING and not expired
      if (request.status !== 'PENDING') {
        return { success: false, code: 400, message: 'Transfer request is no longer pending' };
      }
      if (new Date() > new Date(request.expiresAt)) {
        request.status = 'EXPIRED';
        await request.save({ session });
        return { success: false, code: 400, message: 'Transfer request has expired' };
      }

      const lead = await Lead.findOne({ _id: request.leadId, companyId: req.tenantId }).session(session);
      if (!lead) return { success: false, code: 404, message: 'Lead not found' };

      // Ensure current owner matches expected current owner in the request to prevent race conditions
      if (String(lead.currentOwnerId) !== String(request.currentOwnerId)) {
        request.status = 'CANCELLED';
        await request.save({ session });
        return { success: false, code: 409, message: 'Lead ownership has changed since this request was created' };
      }

      const beforeState = lead.toObject();

      // Perform atomic ownership updates on Lead
      lead.currentOwnerId = request.requestedTo;
      lead.ownershipStatus = 'transferred';
      lead.assignedTo = request.requestedTo;
      const recipient = await User.findById(request.requestedTo).session(session).lean();
      lead.assignedToName = recipient ? recipient.name : '';
      await lead.save({ session });

      // Close previous active LeadOwnership
      await LeadOwnership.findOneAndUpdate(
        { leadId: lead._id, tenantId: req.tenantId, isCurrent: true },
        { $set: { isCurrent: false, endedAt: new Date() } },
        { session }
      );

      // Create new LeadOwnership
      const newOwnership = await LeadOwnership.create([{
        tenantId: req.tenantId,
        leadId: lead._id,
        ownerUserId: request.requestedTo,
        ownershipType: 'TRANSFER',
        startedAt: new Date(),
        isCurrent: true,
        transferRequestId: request._id,
      }], { session });

      // Close previous Contribution and calculate scores
      await LeadContribution.findOneAndUpdate(
        { leadId: lead._id, tenantId: req.tenantId, userId: request.currentOwnerId, endAt: null },
        { $set: { endAt: new Date() } },
        { session }
      );

      // Create new Contribution record
      await LeadContribution.create([{
        tenantId: req.tenantId,
        leadId: lead._id,
        userId: request.requestedTo,
        ownershipId: newOwnership[0]._id,
        startAt: new Date(),
      }], { session });

      // Close request status
      request.status = 'ACCEPTED';
      request.respondedBy = req.user._id;
      request.respondedAt = new Date();
      await request.save({ session });

      return { success: true, lead, request, beforeState };
    });

    if (!result.success) {
      return res.status(result.code).json({ message: result.message });
    }

    // Create Notification
    await Notification.create({
      userId: result.request.requestedBy,
      title: '✅ Lead Transfer Accepted',
      message: `Your transfer request for ${result.lead.name} has been accepted.`,
      type: 'transfer_accepted',
    });

    await logActivity({
      tenantId: req.tenantId,
      actorUserId: req.user._id,
      action: 'TRANSFER_ACCEPTED',
      targetType: 'lead',
      targetId: result.lead._id,
      details: `${req.user.name} accepted lead transfer of ${result.lead.name}`,
      visibility: 'GLOBAL',
      beforeState: result.beforeState,
      afterState: result.lead.toObject(),
    });

    res.json({ success: true, lead: result.lead });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.rejectTransfer = async (req, res) => {
  try {
    const { id } = req.params;
    req.tenantId = resolveTenantId(req.user);
    const request = await LeadTransferRequest.findOne({ _id: id, tenantId: req.tenantId });
    if (!request) return res.status(404).json({ message: 'Transfer request not found' });

    // Contextual Authorization Check
    const isRecipient = String(request.requestedTo) === String(req.user._id);
    let hasApprovePermission = false;
    if (req.user.isAdmin || req.user.role === 'superadmin' || req.user.companyRole === 'owner' || req.user.workStatus === 'company_owner') {
      hasApprovePermission = true;
    } else if (req.user.roleId) {
      const role = await Role.findOne({ _id: req.user.roleId, tenantId: req.tenantId }).lean();
      if (role && (role.permissions.includes(PERMISSIONS.LEAD_TRANSFER_APPROVE) || role.roleType === 'OWNER')) {
        hasApprovePermission = true;
      }
    }
    if (!isRecipient && !hasApprovePermission) {
      return res.status(403).json({ message: "Access denied: missing permission 'LEAD_TRANSFER_APPROVE'" });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ message: 'Request is no longer pending' });
    }

    request.status = 'REJECTED';
    request.respondedBy = req.user._id;
    request.respondedAt = new Date();
    await request.save();

    await Notification.create({
      userId: request.requestedBy,
      title: '❌ Lead Transfer Rejected',
      message: `Your transfer request for lead ID ${request.leadId} has been rejected.`,
      type: 'transfer_rejected',
    });

    await logActivity({
      tenantId: req.tenantId,
      actorUserId: req.user._id,
      action: 'TRANSFER_REJECTED',
      targetType: 'lead',
      targetId: request.leadId,
      details: `${req.user.name} rejected lead transfer`,
      visibility: 'GLOBAL',
    });

    res.json({ success: true, message: 'Transfer request rejected' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.forceTransfer = async (req, res) => {
  try {
    const { id } = req.params; // lead ID
    const { targetUserId, reason } = req.body;

    if (!targetUserId || !reason) {
      return res.status(400).json({ message: 'Target user and reason are required for force transfer' });
    }

    const result = await runInTransaction(async (session) => {
      const lead = await Lead.findOne({ _id: id, companyId: req.tenantId }).session(session);
      if (!lead) return { success: false, code: 404, message: 'Lead not found' };

      const beforeState = lead.toObject();
      const oldOwnerId = lead.currentOwnerId;

      // Apply atomic updates
      lead.currentOwnerId = targetUserId;
      lead.ownershipStatus = 'assigned';
      lead.assignedTo = targetUserId;
      const recipient = await User.findById(targetUserId).session(session).lean();
      lead.assignedToName = recipient ? recipient.name : '';
      await lead.save({ session });

      // Close previous active LeadOwnership
      if (oldOwnerId) {
        await LeadOwnership.findOneAndUpdate(
          { leadId: lead._id, tenantId: req.tenantId, isCurrent: true },
          { $set: { isCurrent: false, endedAt: new Date() } },
          { session }
        );
        await LeadContribution.findOneAndUpdate(
          { leadId: lead._id, tenantId: req.tenantId, userId: oldOwnerId, endAt: null },
          { $set: { endAt: new Date() } },
          { session }
        );
      }

      // Create new LeadOwnership
      const newOwnership = await LeadOwnership.create([{
        tenantId: req.tenantId,
        leadId: lead._id,
        ownerUserId: targetUserId,
        ownershipType: 'FORCE_TRANSFER',
        startedAt: new Date(),
        isCurrent: true,
        assignedBy: req.user._id,
        releaseReason: reason,
      }], { session });

      // Create new Contribution record
      await LeadContribution.create([{
        tenantId: req.tenantId,
        leadId: lead._id,
        userId: targetUserId,
        ownershipId: newOwnership[0]._id,
        startAt: new Date(),
      }], { session });

      // Save executed transfer request snapshot
      await LeadTransferRequest.create([{
        tenantId: req.tenantId,
        leadId: lead._id,
        requestedBy: req.user._id,
        currentOwnerId: oldOwnerId || req.user._id,
        requestedTo: targetUserId,
        managerId: req.user._id,
        requestType: 'FORCE_TRANSFER',
        status: 'EXECUTED',
        reason,
        respondedBy: req.user._id,
        respondedAt: new Date(),
        expiresAt: new Date(),
      }], { session });

      return { success: true, lead, oldOwnerId, beforeState };
    });

    if (!result.success) {
      return res.status(result.code).json({ message: result.message });
    }

    // Trigger Notifications & Audits
    if (result.oldOwnerId) {
      await Notification.create({
        userId: result.oldOwnerId,
        title: '⚡ Lead Force Transferred',
        message: `Lead ${result.lead.name} has been force transferred from you by Manager. Reason: ${reason}`,
        type: 'force_transfer',
      });
    }

    await Notification.create({
      userId: targetUserId,
      title: '⚡ New Lead Assigned (Force)',
      message: `Lead ${result.lead.name} has been force transferred to you. Reason: ${reason}`,
      type: 'lead_assigned',
    });

    // Write to AuditLog (Mandatory for Force Transfer)
    await logAudit({
      actorId: req.user._id,
      actorRole: req.user.role,
      targetUserId: targetUserId,
      targetCompanyId: req.tenantId,
      action: 'OWNER_FORCE_TRANSFER',
      beforeState: result.beforeState,
      afterState: result.lead.toObject(),
      reason,
    });

    await logActivity({
      tenantId: req.tenantId,
      actorUserId: req.user._id,
      action: 'FORCE_TRANSFERRED',
      targetType: 'lead',
      targetId: result.lead._id,
      details: `${req.user.name} force transferred ${result.lead.name} to recipient. Reason: ${reason}`,
      visibility: 'GLOBAL',
      beforeState: result.beforeState,
      afterState: result.lead.toObject(),
    });

    res.json({ success: true, lead: result.lead });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. Global Activity Feed Controllers
exports.getGlobalActivity = async (req, res) => {
  try {
    // Filter strictly by tenantId isolation and global visibility rules
    const activities = await ActivityLog.find({
      tenantId: req.tenantId,
      visibility: 'GLOBAL',
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ success: true, activities });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 5. Incentive Policies & Management
exports.createIncentivePolicy = async (req, res) => {
  try {
    const { name, priority, calculationType, firstHandlerPercentage, closerPercentage, finalOwnerPercentage, conditions } = req.body;
    if (!name) return res.status(400).json({ message: 'Policy name is required' });

    // Deactivate previous active policies if setting this new one active
    await IncentivePolicy.updateMany(
      { tenantId: req.tenantId, isActive: true },
      { $set: { isActive: false } }
    );

    const policy = await IncentivePolicy.create({
      tenantId: req.tenantId,
      name,
      priority: priority || 0,
      calculationType: calculationType || 'FINAL_OWNER',
      firstHandlerPercentage: firstHandlerPercentage || 0,
      closerPercentage: closerPercentage || 0,
      finalOwnerPercentage: finalOwnerPercentage || 0,
      conditions: conditions || {},
      createdBy: req.user._id,
    });

    await logAudit({
      actorId: req.user._id,
      actorRole: req.user.role,
      targetUserId: req.user._id,
      targetCompanyId: req.tenantId,
      action: 'OWNER_CHANGED_POLICY',
      afterState: policy.toObject(),
      reason: `Created incentive policy ${name}`,
    });

    res.status(201).json({ success: true, policy });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getIncentives = async (req, res) => {
  try {
    // Filter strictly by tenantId isolation
    const query = { tenantId: req.tenantId };
    
    // Non-owner role visibility limits
    const isOwner = req.user.companyRole === 'owner' || req.user.workStatus === 'company_owner' || req.user.role === 'superadmin';
    if (!isOwner) {
      const managerRole = req.user.roleId ? (await Role.findById(req.user.roleId).lean()) : null;
      const isManager = managerRole && managerRole.roleType === 'MANAGER';

      if (isManager) {
        // Manager views team incentives (where agent is managed by the manager)
        const teamAgentIds = (await User.find({ managerId: req.user._id }).select('_id').lean()).map(u => u._id);
        query.agentId = { $in: [...teamAgentIds, req.user._id] };
      } else {
        // Normal Agent views only self incentives
        query.agentId = req.user._id;
      }
    }

    const incentives = await Incentive.find(query)
      .populate('agentId', 'name email usercode')
      .populate('leadId', 'name phone status payable_amount paid_amount')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, incentives });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateIncentiveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    if (!status || !['PENDING', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED'].includes(status)) {
      return res.status(400).json({ message: 'A valid status is required' });
    }

    const incentive = await Incentive.findOne({ _id: id, tenantId: req.tenantId });
    if (!incentive) return res.status(404).json({ message: 'Incentive not found' });

    const beforeState = incentive.toObject();
    incentive.status = status;

    if (reason) {
      incentive.modificationHistory.push({
        modifiedBy: req.user._id,
        modifiedAt: new Date(),
        oldValue: beforeState.incentiveAmount,
        newValue: beforeState.incentiveAmount,
        reason,
      });
    }

    await incentive.save();

    await logAudit({
      actorId: req.user._id,
      actorRole: req.user.role,
      targetUserId: incentive.agentId,
      targetCompanyId: req.tenantId,
      action: 'OWNER_MODIFIED_INCENTIVE',
      beforeState,
      afterState: incentive.toObject(),
      reason: reason || `Updated incentive status to ${status}`,
    });

    res.json({ success: true, incentive });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 6. Dashboards Implementation
exports.getDashboard = async (req, res) => {
  try {
    const isOwner = req.user.companyRole === 'owner' || req.user.workStatus === 'company_owner' || req.user.role === 'superadmin';
    const managerRole = req.user.roleId ? (await Role.findById(req.user.roleId).lean()) : null;
    const isManager = managerRole && managerRole.roleType === 'MANAGER';

    // Define context-level employee filters
    let targetAgentIds = [req.user._id];
    if (isOwner) {
      targetAgentIds = (await User.find({ $or: [{ companyId: req.tenantId }, { _id: req.tenantId }] }).select('_id').lean()).map(u => u._id);
    } else if (isManager) {
      const teamAgentIds = (await User.find({ managerId: req.user._id }).select('_id').lean()).map(u => u._id);
      targetAgentIds = [...teamAgentIds, req.user._id];
    }

    // Lead metrics
    const totalLeads = await Lead.countDocuments({ companyId: req.tenantId, currentOwnerId: { $in: targetAgentIds } });
    const wonLeads = await Lead.countDocuments({ companyId: req.tenantId, currentOwnerId: { $in: targetAgentIds }, status: { $in: ['converted', 'payment_done', 'closed', 'Closed', 'Closed / Won'] } });
    const lostLeads = await Lead.countDocuments({ companyId: req.tenantId, currentOwnerId: { $in: targetAgentIds }, status: 'lost' });
    const conversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

    // Incentive metrics
    const incentives = await Incentive.find({ tenantId: req.tenantId, agentId: { $in: targetAgentIds } }).lean();
    const incentiveGenerated = incentives.reduce((acc, cur) => acc + cur.incentiveAmount, 0);
    const incentivePending = incentives.filter(i => i.status === 'PENDING').reduce((acc, cur) => acc + cur.incentiveAmount, 0);
    const incentiveApproved = incentives.filter(i => i.status === 'APPROVED' || i.status === 'PAID').reduce((acc, cur) => acc + cur.incentiveAmount, 0);

    // Dynamic audit history & logs
    const auditLogs = isOwner 
      ? await AuditLog.find({ targetCompanyId: req.tenantId }).sort({ createdAt: -1 }).limit(10).lean()
      : [];

    res.json({
      success: true,
      role: isOwner ? 'OWNER' : (isManager ? 'MANAGER' : 'AGENT'),
      metrics: {
        totalLeads,
        wonLeads,
        lostLeads,
        conversionRate,
        incentiveGenerated,
        incentivePending,
        incentiveApproved,
      },
      auditLogs,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Hook trigger for split calculation on WON
exports.triggerWonIncentiveCalculation = async (leadId, tenantId) => {
  return await calculateIncentives(leadId, tenantId);
};
