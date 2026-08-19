const mongoose = require('mongoose');

/**
 * AuditLog Schema (Security, Anti-Fraud & SuperAdmin Override Audit)
 * Implements an immutable trail of administrative actions, billing proration overrides,
 * risk scores, and anti-fraud enforcement.
 */
const auditLogSchema = new mongoose.Schema(
  {
    // Actor performing the action (SuperAdmin, System Cron, or User)
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    actorRole: {
      type: String,
      required: true,
      enum: ['superadmin', 'system', 'user'],
      index: true,
    },
    // Target Tenant affected by the action
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    targetCompanyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    // Action Identifier
    action: {
      type: String,
      required: true,
      enum: [
        'SUPERADMIN_SUBSCRIPTION_OVERRIDE',
        'SUPERADMIN_LIFETIME_GRANT',
        'SUPERADMIN_EXPORT_GATE_BYPASS',
        'SUPERADMIN_MANUAL_COUPON',
        'FRAUD_IMPORT_VELOCITY_TRIGGERED',
        'FRAUD_EXPORT_GATE_PREVENTED',
        'FRAUD_WA_FINGERPRINT_BANNED',
        'SUBSCRIPTION_PRORATION_APPLIED',
        'SUBSCRIPTION_DOWNGRADE_SCHEDULED',
        'SUBSCRIPTION_RENEWAL_FAILED',
        'SUBSCRIPTION_LOCKED',
        'SUBSCRIPTION_ARCHIVED',
        'ACCOUNT_TYPE_MIGRATION',
      ],
      index: true,
    },
    // State snapshots for non-repudiation
    beforeState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    afterState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    riskScore: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    ipAddress: {
      type: String,
      trim: true,
      default: null,
    },
    userAgent: {
      type: String,
      trim: true,
      default: null,
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

auditLogSchema.index({ targetUserId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);
