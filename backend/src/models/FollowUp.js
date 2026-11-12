const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    index: true,
  },
  lead_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: true,
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
  },
  agent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  scheduled_at: {
    type: Date,
    required: [true, 'Scheduled follow-up date/time is mandatory'],
  },
  scheduledAt: {
    type: Date,
  },
  note: {
    type: String,
    required: [true, 'Follow-up note is mandatory'],
    trim: true,
  },
  postpone_remark: {
    type: String,
    default: null,
    trim: true,
  },
  postponeRemark: {
    type: String,
    default: null,
    trim: true,
  },
  completion_note: {
    type: String,
    default: null,
    trim: true,
  },
  completionNote: {
    type: String,
    default: null,
    trim: true,
  },
  completed_at: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  delay_count: {
    type: Number,
    default: 0,
    min: 0,
    max: 2,
  },
  delayCount: {
    type: Number,
    default: 0,
    min: 0,
    max: 2,
  },
  delay_history: [{
    delayed_at: { type: Date, default: Date.now },
    delayed_until: { type: Date, required: true },
    delay_minutes: { type: Number, required: true },
    reason: { type: String, default: '' },
    performed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  }],
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  type: {
    type: String,
    enum: ['call', 'site_visit', 'meeting', 'whatsapp', 'email', 'document_collection', 'payment_reminder'],
    default: 'call',
  },
  siteVisitDetails: {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'TenantCatalogue', default: null },
    location: { type: String, default: '', trim: true },
    outcome: {
      type: String,
      enum: ['interested', 'highly_interested', 'not_interested', 'budget_mismatch', 'location_mismatch', 'rescheduled', 'no_show', null],
      set: (v) => (v ? String(v).toLowerCase().trim() : null),
      default: null,
    },
    clientFeedback: { type: String, default: '', trim: true },
    nextAction: { type: String, default: '', trim: true },
  },
  status: {
    type: String,
    enum: ['open', 'completed', 'postponed', 'cancelled'],
    default: 'open',
    set: (v) => {
      if (!v) return 'open';
      const clean = String(v).toLowerCase().trim();
      if (clean === 'scheduled' || clean === 'pending') return 'open';
      if (clean === 'done') return 'completed';
      return clean;
    },
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  creatorName: {
    type: String,
    default: 'Agent',
  },
  notified: {
    type: Boolean,
    default: false,
    index: true,
  },
  notifiedAt: {
    type: Date,
    default: null,
  },
  claimStatus: {
    type: String,
    enum: ['idle', 'processing', 'dispatched', 'failed'],
    default: 'idle',
  },
  claimedAt: {
    type: Date,
    default: null,
  },
  idempotencyKey: {
    type: String,
    trim: true,
    index: true,
    sparse: true,
  },
  acknowledged: {
    type: Boolean,
    default: false,
    index: true,
  },
  acknowledgedAt: {
    type: Date,
    default: null,
  },
  reminderCount: {
    type: Number,
    default: 0,
  },
  lastReminderAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

function syncDualFields(doc) {
  if (!doc) return;
  if (doc.lead_id && !doc.leadId) doc.leadId = doc.lead_id;
  if (doc.leadId && !doc.lead_id) doc.lead_id = doc.leadId;
  if (doc.agent_id && !doc.agentId) doc.agentId = doc.agent_id;
  if (doc.agentId && !doc.agent_id) doc.agent_id = doc.agentId;
  if (doc.scheduled_at && !doc.scheduledAt) doc.scheduledAt = doc.scheduled_at;
  if (doc.scheduledAt && !doc.scheduled_at) doc.scheduled_at = doc.scheduledAt;
  if (doc.note && !doc.scheduleNote) doc.scheduleNote = doc.note;
  if (doc.scheduleNote && !doc.note) doc.note = doc.scheduleNote;
  if (doc.postpone_remark && !doc.postponeRemark) doc.postponeRemark = doc.postpone_remark;
  if (doc.postponeRemark && !doc.postpone_remark) doc.postpone_remark = doc.postponeRemark;
  if (doc.completion_note && !doc.completionNote) doc.completionNote = doc.completion_note;
  if (doc.completionNote && !doc.completion_note) doc.completion_note = doc.completionNote;
  if (doc.completed_at && !doc.completedAt) doc.completedAt = doc.completed_at;
  if (doc.completedAt && !doc.completed_at) doc.completed_at = doc.completedAt;
}

followUpSchema.pre('validate', function (next) {
  syncDualFields(this);
  next();
});

followUpSchema.pre('save', function (next) {
  syncDualFields(this);
  next();
});

followUpSchema.pre(['updateOne', 'findOneAndUpdate'], function (next) {
  const update = this.getUpdate();
  if (update) {
    if (update.$set) syncDualFields(update.$set);
    else syncDualFields(update);
  }
  next();
});

followUpSchema.index({ workspaceId: 1, scheduled_at: 1, status: 1 });
followUpSchema.index({ lead_id: 1, scheduled_at: 1 });
followUpSchema.index({ agent_id: 1, status: 1 });
followUpSchema.index({ status: 1, scheduled_at: 1 });
followUpSchema.index({ status: 1, notified: 1, scheduled_at: 1, claimStatus: 1 });

module.exports = mongoose.models.FollowUp || mongoose.model('FollowUp', followUpSchema);
