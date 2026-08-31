const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      index: true,
    },
    actorName: {
      type: String,
      default: null,
      trim: true,
    },
    actorEmail: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    actorRole: {
      type: String,
      default: 'user',
      index: true,
    },
    organizationId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        'CREATE',
        'UPDATE',
        'DELETE',
        'LOGIN',
        'LOGOUT',
        'EXPORT',
        'IMPORT',
        'ROLE_CHANGE',
        'PERMISSION_CHANGE',
        'PASSWORD_CHANGE',
        'SETTINGS_CHANGE',
        'API_KEY_CREATE',
        'API_KEY_REVOKE',
        'TENANT_BLOCK',
        'TENANT_UNBLOCK',
        'PLAN_CHANGE',
        'SUBSCRIPTION_CHANGE',
        'IMPERSONATION_START',
        'IMPERSONATION_END',
        'INTEGRATION_CHANGE',
        'FEATURE_FLAG_CHANGE',
        'BROADCAST',
        'TEST_DATA_CLEANUP',
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
        'SUBSCRIPTION_CREATED',
        'SUBSCRIPTION_ACTIVATED',
        'SUBSCRIPTION_RENEWED',
        'SUBSCRIPTION_UPGRADED',
        'SUBSCRIPTION_DOWNGRADED',
        'SUBSCRIPTION_DOWNGRADE_SCHEDULED',
        'SUBSCRIPTION_PAST_DUE',
        'SUBSCRIPTION_RENEWAL_FAILED',
        'SUBSCRIPTION_LOCKED',
        'SUBSCRIPTION_CANCELLED',
        'PAYMENT_VERIFIED',
        'PAYMENT_FAILED',
        'PAYMENT_REFUNDED',
        'PAYMENT_PARTIALLY_REFUNDED',
        'PAYMENT_RECONCILED',
        'RECONCILIATION_MISMATCH',
        'RECONCILIATION_REPAIRED',
        'RECONCILIATION_STALE_EVENT',
        'RECONCILIATION_MANUAL_REVIEW',
        'MANUAL_RECONCILIATION_ACTION',
      ],
      index: true,
    },
    resourceType: {
      type: String,
      required: true,
      index: true,
    },
    resourceId: {
      type: String,
      default: null,
      index: true,
    },
    resourceName: {
      type: String,
      default: null,
      trim: true,
    },
    before: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    requestId: {
      type: String,
      default: null,
      index: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    ip: {
      type: String,
      default: null,
      trim: true,
    },
    userAgent: {
      type: String,
      default: null,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    retentionCategory: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// ─────────────────────────────────────────────────────────────
// STRICT IMMUTABILITY ENFORCEMENT HOOKS
// ─────────────────────────────────────────────────────────────
const immutabilityError = () =>
  new Error('IMMUTABILITY_VIOLATION: AuditLog records are strictly append-only and cannot be modified or deleted.');

AuditLogSchema.pre('updateOne', function () {
  throw immutabilityError();
});
AuditLogSchema.pre('updateMany', function () {
  throw immutabilityError();
});
AuditLogSchema.pre('findOneAndUpdate', function () {
  throw immutabilityError();
});
AuditLogSchema.pre('replaceOne', function () {
  throw immutabilityError();
});
AuditLogSchema.pre('deleteOne', function () {
  throw immutabilityError();
});
AuditLogSchema.pre('deleteMany', function () {
  throw immutabilityError();
});
AuditLogSchema.pre('findOneAndDelete', function () {
  throw immutabilityError();
});
AuditLogSchema.pre('findOneAndRemove', function () {
  throw immutabilityError();
});

AuditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(immutabilityError());
  }
  next();
});

// Compound Indexes
AuditLogSchema.index({ organizationId: 1, timestamp: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
AuditLogSchema.index({ actorId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ timestamp: -1 });

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
