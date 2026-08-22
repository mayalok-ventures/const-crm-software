const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorRole: {
      type: String,
      enum: ['admin', 'superadmin', 'manager', 'agent', 'system', 'developer'],
      default: 'admin',
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
    },
    entityType: {
      type: String,
      default: 'General',
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    eventType: {
      type: String,
      trim: true,
      index: true,
    },
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    visibility: {
      type: String,
      enum: ['GLOBAL', 'TEAM', 'PRIVATE', 'SYSTEM'],
      default: 'PRIVATE',
      index: true,
    },
    target_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    target_type: {
      type: String,
      default: null,
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    targetType: {
      type: String,
      default: null,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    before_state: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    beforeState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    after_state: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    afterState: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

activityLogSchema.pre('save', function (next) {
  if (this.user_id && !this.userId) this.userId = this.user_id;
  if (this.userId && !this.user_id) this.user_id = this.userId;
  if (this.target_type && !this.targetType) this.targetType = this.target_type;
  if (this.targetType && !this.target_type) this.target_type = this.targetType;
  if (this.target_id && !this.targetId) this.targetId = this.target_id;
  if (this.targetId && !this.target_id) this.target_id = this.targetId;
  if (this.before_state !== undefined && this.beforeState === undefined) this.beforeState = this.before_state;
  if (this.beforeState !== undefined && this.before_state === undefined) this.before_state = this.beforeState;
  if (this.after_state !== undefined && this.afterState === undefined) this.afterState = this.after_state;
  if (this.afterState !== undefined && this.after_state === undefined) this.after_state = this.afterState;
  if (this.actor && !this.actorUserId) this.actorUserId = this.actor;
  if (this.actorUserId && !this.actor) this.actor = this.actorUserId;
  next();
});

// ─────────────────────────────────────────────────────────────
// STATIC HELPER: Standardized Audit Logger
// ─────────────────────────────────────────────────────────────
activityLogSchema.statics.record = async function ({
  actor,
  actorRole = 'admin',
  action,
  entityType = 'General',
  entityId = null,
  oldValue = null,
  newValue = null,
  details = '',
  ipAddress = '127.0.0.1',
  tenantId = null,
  eventType = null,
  visibility = 'PRIVATE',
  metadata = {},
}) {
  try {
    return await this.create({
      actor,
      actorRole,
      action,
      entityType,
      entityId,
      metadata: { ...metadata, oldValue, newValue, details },
      ipAddress,
      tenantId,
      eventType: eventType || action,
      visibility,
      timestamp: new Date(),
    });
  } catch (err) {
    console.error('[ActivityLog Engine] Failed to record audit log:', err.message);
    return null;
  }
};

// High-Performance Query Indexes
activityLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
activityLogSchema.index({ actor: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ tenantId: 1, createdAt: -1 });
activityLogSchema.index({ tenantId: 1, eventType: 1, createdAt: -1 });
activityLogSchema.index({ tenantId: 1, visibility: 1, createdAt: -1 });
activityLogSchema.index({ target_id: 1, createdAt: -1 });
activityLogSchema.index({ user_id: 1, createdAt: -1 });
activityLogSchema.index({ timestamp: -1 });

module.exports = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);
