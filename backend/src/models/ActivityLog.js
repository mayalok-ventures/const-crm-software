const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
  actor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Actor ID is required'],
  },
  actorRole: {
    type: String,
    enum: ['admin', 'superadmin', 'manager', 'agent', 'system'],
    default: 'admin',
    required: true,
  },
  action: {
    type: String,
    enum: ['CREATE', 'UPDATE', 'DELETE', 'ASSIGN', 'STATUS_CHANGE'],
    required: [true, 'Action enum is required'],
  },
  entityType: {
    type: String,
    enum: ['User', 'Lead', 'Pipeline', 'Form', 'DistributionRule'],
    required: [true, 'Entity type is required'],
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Entity ID is required'],
  },
  metadata: {
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
    details: { type: String, default: '' },
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
}, {
  timestamps: true,
  strict: true,
});

// ─────────────────────────────────────────────────────────────
// APPEND-ONLY ENFORCEMENT: Block any Mutation or Deletion
// ─────────────────────────────────────────────────────────────
const blockMutation = function (next) {
  const err = new Error('ActivityLog is an APPEND-ONLY immutable audit trail. Modifications and deletions are strictly prohibited.');
  err.status = 403;
  next(err);
};

activityLogSchema.pre('updateOne', blockMutation);
activityLogSchema.pre('updateMany', blockMutation);
activityLogSchema.pre('findOneAndUpdate', blockMutation);
activityLogSchema.pre('findByIdAndUpdate', blockMutation);
activityLogSchema.pre('deleteOne', blockMutation);
activityLogSchema.pre('deleteMany', blockMutation);
activityLogSchema.pre('findOneAndDelete', blockMutation);
activityLogSchema.pre('findByIdAndDelete', blockMutation);

// ─────────────────────────────────────────────────────────────
// STATIC HELPER: Standardized 1-Line Audit Logger
// ─────────────────────────────────────────────────────────────
activityLogSchema.statics.record = async function ({
  actor,
  actorRole = 'admin',
  action,
  entityType,
  entityId,
  oldValue = null,
  newValue = null,
  details = '',
  ipAddress = '127.0.0.1',
}) {
  try {
    return await this.create({
      actor,
      actorRole,
      action,
      entityType,
      entityId,
      metadata: { oldValue, newValue, details },
      ipAddress,
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
activityLogSchema.index({ timestamp: -1 });

module.exports = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);
