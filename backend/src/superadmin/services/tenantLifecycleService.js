const mongoose = require('mongoose');
const User = require('../../models/User');
const Subscription = require('../../models/Subscription');
const AuditLog = require('../../models/AuditLog');
const ActivityLog = require('../../models/ActivityLog');
const Notification = require('../../models/Notification');

/**
 * TENANT LIFECYCLE STATE CONSTANTS
 */
const TENANT_LIFECYCLE_STATES = {
  PROVISIONING: 'PROVISIONING',
  TRIAL: 'TRIAL',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
  ARCHIVED: 'ARCHIVED',
};

/**
 * CENTRALIZED ALLOWED TRANSITION MATRIX
 */
const ALLOWED_TRANSITIONS = {
  [TENANT_LIFECYCLE_STATES.PROVISIONING]: [
    TENANT_LIFECYCLE_STATES.TRIAL,
    TENANT_LIFECYCLE_STATES.ACTIVE,
    TENANT_LIFECYCLE_STATES.CANCELLED,
  ],
  [TENANT_LIFECYCLE_STATES.TRIAL]: [
    TENANT_LIFECYCLE_STATES.ACTIVE,
    TENANT_LIFECYCLE_STATES.PAST_DUE,
    TENANT_LIFECYCLE_STATES.CANCELLED,
  ],
  [TENANT_LIFECYCLE_STATES.ACTIVE]: [
    TENANT_LIFECYCLE_STATES.PAST_DUE,
    TENANT_LIFECYCLE_STATES.SUSPENDED,
    TENANT_LIFECYCLE_STATES.CANCELLED,
  ],
  [TENANT_LIFECYCLE_STATES.PAST_DUE]: [
    TENANT_LIFECYCLE_STATES.ACTIVE,
    TENANT_LIFECYCLE_STATES.SUSPENDED,
    TENANT_LIFECYCLE_STATES.CANCELLED,
  ],
  [TENANT_LIFECYCLE_STATES.SUSPENDED]: [
    TENANT_LIFECYCLE_STATES.ACTIVE,
    TENANT_LIFECYCLE_STATES.CANCELLED,
  ],
  [TENANT_LIFECYCLE_STATES.CANCELLED]: [
    TENANT_LIFECYCLE_STATES.ARCHIVED,
  ],
  [TENANT_LIFECYCLE_STATES.ARCHIVED]: [], // Terminal state
};

/**
 * Determine effective lifecycle status with backward compatibility
 */
function resolveCurrentLifecycleState(user, subscription = null) {
  if (!user) return null;
  if (!user.isActive || user.userStatus === 'disabled') {
    if (user.lifecycleStatus === TENANT_LIFECYCLE_STATES.CANCELLED) return TENANT_LIFECYCLE_STATES.CANCELLED;
    if (user.lifecycleStatus === TENANT_LIFECYCLE_STATES.ARCHIVED) return TENANT_LIFECYCLE_STATES.ARCHIVED;
    return TENANT_LIFECYCLE_STATES.SUSPENDED;
  }
  if (user.userStatus === 'inactive') {
    return TENANT_LIFECYCLE_STATES.SUSPENDED;
  }
  if (user.lifecycleStatus && Object.values(TENANT_LIFECYCLE_STATES).includes(user.lifecycleStatus)) {
    return user.lifecycleStatus;
  }
  if (subscription?.status === 'PAST_DUE' || subscription?.status === 'PLAN_LOCKED') {
    return TENANT_LIFECYCLE_STATES.PAST_DUE;
  }
  if (subscription?.status === 'CANCELLED') {
    return TENANT_LIFECYCLE_STATES.CANCELLED;
  }
  if (user.plan === 'free' || !user.plan) {
    return TENANT_LIFECYCLE_STATES.TRIAL;
  }
  return TENANT_LIFECYCLE_STATES.ACTIVE;
}

/**
 * Map target lifecycle state to appropriate AuditLog action enum
 */
function getAuditActionForTransition(previousState, targetState) {
  if (targetState === TENANT_LIFECYCLE_STATES.ACTIVE) {
    return previousState === TENANT_LIFECYCLE_STATES.SUSPENDED
      ? 'TENANT_REACTIVATED'
      : 'TENANT_ACTIVATED';
  }
  if (targetState === TENANT_LIFECYCLE_STATES.SUSPENDED) return 'TENANT_SUSPENDED';
  if (targetState === TENANT_LIFECYCLE_STATES.CANCELLED) return 'TENANT_CANCELLED';
  if (targetState === TENANT_LIFECYCLE_STATES.ARCHIVED) return 'TENANT_ARCHIVED';
  if (targetState === TENANT_LIFECYCLE_STATES.PAST_DUE) return 'TENANT_PAST_DUE';
  if (targetState === TENANT_LIFECYCLE_STATES.TRIAL) return 'TENANT_TRIAL_STARTED';
  if (targetState === TENANT_LIFECYCLE_STATES.PROVISIONING) return 'TENANT_PROVISIONING';
  return 'TENANT_LIFECYCLE_TRANSITION';
}

/**
 * Central State Transition Engine
 */
async function transitionTenantState(tenantId, targetState, actor, metadata = {}) {
  if (!tenantId || !mongoose.Types.ObjectId.isValid(tenantId)) {
    const err = new Error('Invalid Tenant ID');
    err.statusCode = 400;
    throw err;
  }

  const normalizedTarget = String(targetState).toUpperCase().trim();
  if (!Object.values(TENANT_LIFECYCLE_STATES).includes(normalizedTarget)) {
    const err = new Error(`Invalid lifecycle state '${targetState}'. Allowed states: ${Object.values(TENANT_LIFECYCLE_STATES).join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  // Verify actor authorization: ONLY SuperAdmin or System background jobs
  const isSuperAdmin = actor?.role === 'superadmin';
  const isSystem = actor?.isSystem === true || actor?.role === 'system';

  if (!isSuperAdmin && !isSystem) {
    const err = new Error('Unauthorized: Only SuperAdmin platform administrators can transition tenant lifecycle');
    err.statusCode = 403;
    throw err;
  }

  // 1. Fetch current tenant
  const user = await User.findById(tenantId);
  if (!user) {
    const err = new Error('Tenant organisation not found');
    err.statusCode = 404;
    throw err;
  }

  const subscription = await Subscription.findOne({ companyId: user._id }).lean();
  const currentState = resolveCurrentLifecycleState(user, subscription);

  // 2. Idempotency Check: Transitioning to the current state is a safe no-op
  if (currentState === normalizedTarget) {
    return {
      success: true,
      idempotent: true,
      message: `Tenant is already in '${normalizedTarget}' state`,
      tenant: user,
      previousState: currentState,
      currentState: normalizedTarget,
    };
  }

  // 3. Allowed Transition Validation (Matrix Enforcement)
  const allowedNext = ALLOWED_TRANSITIONS[currentState] || [];
  if (!allowedNext.includes(normalizedTarget)) {
    const err = new Error(
      `Invalid lifecycle transition: Cannot transition tenant from '${currentState}' to '${normalizedTarget}'. Allowed transitions from '${currentState}': [${allowedNext.join(', ') || 'None (Terminal)'}]`
    );
    err.statusCode = 409;
    err.code = 'INVALID_LIFECYCLE_TRANSITION';
    throw err;
  }

  // 4. Concurrency & Optimistic Lock Protection
  const currentVersion = user.lifecycleVersion || 1;
  const now = new Date();

  const setFields = {
    lifecycleStatus: normalizedTarget,
  };

  if (normalizedTarget === TENANT_LIFECYCLE_STATES.PROVISIONING) {
    setFields['lifecycleTimestamps.provisionedAt'] = now;
  } else if (normalizedTarget === TENANT_LIFECYCLE_STATES.TRIAL) {
    setFields['lifecycleTimestamps.trialStartedAt'] = now;
    if (!user.lifecycleTimestamps?.trialEndsAt) {
      const trialDays = metadata.trialDays || 14;
      const trialEnd = new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000);
      setFields['lifecycleTimestamps.trialEndsAt'] = trialEnd;
      setFields.planEndDate = trialEnd;
    }
    setFields.isActive = true;
    setFields.userStatus = 'active';
  } else if (normalizedTarget === TENANT_LIFECYCLE_STATES.ACTIVE) {
    setFields['lifecycleTimestamps.activatedAt'] = now;
    setFields.isActive = true;
    setFields.userStatus = 'active';
  } else if (normalizedTarget === TENANT_LIFECYCLE_STATES.PAST_DUE) {
    setFields['lifecycleTimestamps.pastDueAt'] = now;
    setFields.isActive = true;
    setFields.userStatus = 'active';
  } else if (normalizedTarget === TENANT_LIFECYCLE_STATES.SUSPENDED) {
    setFields['lifecycleTimestamps.suspendedAt'] = now;
    setFields.suspensionReason = metadata.reason || 'Suspended by SuperAdmin';
    setFields.suspendedBy = isSystem ? null : actor?._id;
    setFields.isActive = true;
    setFields.userStatus = 'inactive';
  } else if (normalizedTarget === TENANT_LIFECYCLE_STATES.CANCELLED) {
    setFields['lifecycleTimestamps.cancelledAt'] = now;
    setFields.cancellationReason = metadata.reason || 'Cancelled by SuperAdmin';
    setFields.cancelledBy = isSystem ? null : actor?._id;
    setFields.isActive = false;
    setFields.userStatus = 'disabled';
  } else if (normalizedTarget === TENANT_LIFECYCLE_STATES.ARCHIVED) {
    setFields['lifecycleTimestamps.archivedAt'] = now;
    setFields.archivedReason = metadata.reason || 'Archived by SuperAdmin';
    setFields.archivedBy = isSystem ? null : actor?._id;
    setFields.isActive = false;
    setFields.userStatus = 'disabled';
  }

  // Atomic conditional update
  const updatedTenant = await User.findOneAndUpdate(
    {
      _id: user._id,
      $or: [
        { lifecycleVersion: currentVersion },
        { lifecycleVersion: { $exists: false } },
      ],
    },
    {
      $set: setFields,
      $inc: { lifecycleVersion: 1 },
    },
    { new: true }
  );

  if (!updatedTenant) {
    const err = new Error('Concurrency conflict: Tenant state was modified by another concurrent request. Please retry.');
    err.statusCode = 409;
    err.code = 'CONCURRENCY_CONFLICT';
    throw err;
  }

  // 5. Synchronize Subscription State
  try {
    if (normalizedTarget === TENANT_LIFECYCLE_STATES.ACTIVE) {
      await Subscription.updateMany(
        { companyId: updatedTenant._id },
        { $set: { status: 'ACTIVE' } }
      );
    } else if (normalizedTarget === TENANT_LIFECYCLE_STATES.PAST_DUE) {
      await Subscription.updateMany(
        { companyId: updatedTenant._id, status: { $nin: ['GRACE_PERIOD'] } },
        { $set: { status: 'PAST_DUE' } }
      );
    } else if (normalizedTarget === TENANT_LIFECYCLE_STATES.CANCELLED) {
      await Subscription.updateMany(
        { companyId: updatedTenant._id },
        { $set: { status: 'CANCELLED', cancelledAt: now, cancellationReason: metadata.reason || 'Tenant cancelled' } }
      );
    } else if (normalizedTarget === TENANT_LIFECYCLE_STATES.ARCHIVED) {
      await Subscription.updateMany(
        { companyId: updatedTenant._id },
        { $set: { status: 'ARCHIVED' } }
      );
    }
  } catch (subErr) {
    console.warn('[tenantLifecycleService] Subscription sync note:', subErr.message);
  }

  // 6. Record Immutable Audit Log
  const auditAction = getAuditActionForTransition(currentState, normalizedTarget);
  try {
    await AuditLog.create({
      actorId: isSystem ? null : (actor?._id || 'SYSTEM'),
      actorName: isSystem ? 'System Engine' : (actor?.name || 'SuperAdmin'),
      actorEmail: isSystem ? 'system@coresetu.internal' : (actor?.email || 'admin@coresetu.com'),
      actorRole: isSystem ? 'system' : (actor?.role || 'superadmin'),
      organizationId: updatedTenant._id,
      action: auditAction,
      resourceType: 'Tenant',
      resourceId: updatedTenant._id.toString(),
      resourceName: updatedTenant.companyInfo?.companyName || updatedTenant.name,
      before: {
        lifecycleStatus: currentState,
        userStatus: user.userStatus,
        isActive: user.isActive,
      },
      after: {
        lifecycleStatus: normalizedTarget,
        userStatus: updatedTenant.userStatus,
        isActive: updatedTenant.isActive,
      },
      changes: {
        from: currentState,
        to: normalizedTarget,
      },
      metadata: {
        reason: metadata.reason || '',
        notes: metadata.notes || '',
        source: isSystem ? 'automated_worker' : 'superadmin_command_center',
        version: updatedTenant.lifecycleVersion,
      },
      timestamp: now,
    });
  } catch (auditErr) {
    console.warn('[tenantLifecycleService] AuditLog creation warning:', auditErr.message);
  }

  // 7. Record Operational ActivityLog
  try {
    await ActivityLog.create({
      actor: isSystem ? null : actor?._id,
      actorRole: isSystem ? 'system' : (actor?.role || 'superadmin'),
      action: `TENANT_${normalizedTarget}`,
      eventType: 'TENANT_LIFECYCLE_EVENT',
      entityType: 'Tenant',
      entityId: updatedTenant._id,
      tenantId: updatedTenant._id,
      visibility: 'SYSTEM',
      metadata: {
        from: currentState,
        to: normalizedTarget,
        reason: metadata.reason || '',
      },
    });
  } catch (actErr) {
    console.warn('[tenantLifecycleService] ActivityLog creation warning:', actErr.message);
  }

  // 8. Notification to Tenant Owner
  try {
    let notifMessage = null;
    let notifTitle = 'Tenant Status Update';
    if (normalizedTarget === TENANT_LIFECYCLE_STATES.ACTIVE) {
      notifTitle = 'Account Activated';
      notifMessage = 'Your organization workspace is fully active and licensed.';
    } else if (normalizedTarget === TENANT_LIFECYCLE_STATES.SUSPENDED) {
      notifTitle = 'Account Suspended';
      notifMessage = `Your organization workspace has been suspended. Reason: ${metadata.reason || 'Administrative action'}. Please contact support.`;
    } else if (normalizedTarget === TENANT_LIFECYCLE_STATES.PAST_DUE) {
      notifTitle = 'Payment Past Due';
      notifMessage = 'Your subscription payment is overdue. Please renew your subscription to prevent service interruption.';
    } else if (normalizedTarget === TENANT_LIFECYCLE_STATES.CANCELLED) {
      notifTitle = 'Subscription Cancelled';
      notifMessage = 'Your organization workspace subscription has been cancelled.';
    }

    if (notifMessage) {
      await Notification.create({
        userId: updatedTenant._id,
        title: notifTitle,
        message: notifMessage,
        type: 'system_alert',
      });
    }
  } catch (notifErr) {
    console.warn('[tenantLifecycleService] Notification warning:', notifErr.message);
  }

  return {
    success: true,
    message: `Tenant successfully transitioned from '${currentState}' to '${normalizedTarget}'`,
    tenant: updatedTenant,
    previousState: currentState,
    currentState: normalizedTarget,
  };
}

/**
 * Deep inspection of a single tenant's lifecycle metadata & timeline
 */
async function getTenantLifecycleDetails(tenantId) {
  if (!tenantId || !mongoose.Types.ObjectId.isValid(tenantId)) {
    const err = new Error('Invalid Tenant ID');
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findById(tenantId).select('-password').lean();
  if (!user) {
    const err = new Error('Tenant organisation not found');
    err.statusCode = 404;
    throw err;
  }

  const subscription = await Subscription.findOne({ companyId: user._id }).populate('planId').lean();
  const effectiveState = resolveCurrentLifecycleState(user, subscription);
  const allowedTransitions = ALLOWED_TRANSITIONS[effectiveState] || [];

  const auditHistory = await AuditLog.find({
    organizationId: user._id,
    action: {
      $in: [
        'TENANT_CREATED',
        'TENANT_PROVISIONING',
        'TENANT_TRIAL_STARTED',
        'TENANT_ACTIVATED',
        'TENANT_PAST_DUE',
        'TENANT_SUSPENDED',
        'TENANT_REACTIVATED',
        'TENANT_CANCELLED',
        'TENANT_ARCHIVED',
        'TENANT_LIFECYCLE_TRANSITION',
        'TENANT_BLOCK',
        'TENANT_UNBLOCK',
        'PLAN_CHANGE',
      ],
    },
  })
    .sort({ timestamp: -1 })
    .limit(50)
    .lean();

  return {
    tenantId: user._id,
    name: user.companyInfo?.companyName || user.name,
    owner: {
      name: user.name,
      email: user.email,
      phone: user.phone,
    },
    lifecycleStatus: effectiveState,
    lifecycleTimestamps: user.lifecycleTimestamps || {},
    cancellationReason: user.cancellationReason || null,
    suspensionReason: user.suspensionReason || null,
    archivedReason: user.archivedReason || null,
    lifecycleVersion: user.lifecycleVersion || 1,
    allowedTransitions,
    subscription,
    auditHistory,
  };
}

module.exports = {
  TENANT_LIFECYCLE_STATES,
  ALLOWED_TRANSITIONS,
  resolveCurrentLifecycleState,
  transitionTenantState,
  getTenantLifecycleDetails,
};
