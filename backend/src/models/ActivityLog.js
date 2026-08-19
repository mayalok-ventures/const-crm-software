const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
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
  userName: {
    type: String,
    default: 'System',
  },
  role: {
    type: String,
    default: 'admin',
  },
  action: {
    type: String,
    required: [true, 'Activity action is required'],
    trim: true,
  },
  target_type: {
    type: String,
    default: 'lead',
    trim: true,
  },
  targetType: {
    type: String,
    default: 'lead',
    trim: true,
  },
  target_id: {
    type: String,
    default: '',
  },
  targetId: {
    type: String,
    default: '',
  },
  details: {
    type: String,
    default: '',
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
  timestamp: {
    type: Date,
    default: Date.now,
  },
}, { timestamps: true });

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
  next();
});

activityLogSchema.index({ target_id: 1, createdAt: -1 });
activityLogSchema.index({ user_id: 1, createdAt: -1 });
activityLogSchema.index({ action: 1 });

module.exports = mongoose.models.ActivityLog || mongoose.model('ActivityLog', activityLogSchema);
