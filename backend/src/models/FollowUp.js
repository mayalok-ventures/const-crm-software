const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema({
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
  status: {
    type: String,
    enum: ['open', 'done', 'postponed', 'scheduled', 'completed'],
    default: 'open',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  creatorName: {
    type: String,
    default: 'Agent',
  },
}, { timestamps: true });

followUpSchema.pre('save', function (next) {
  if (this.lead_id && !this.leadId) this.leadId = this.lead_id;
  if (this.leadId && !this.lead_id) this.lead_id = this.leadId;
  if (this.agent_id && !this.agentId) this.agentId = this.agent_id;
  if (this.agentId && !this.agent_id) this.agent_id = this.agentId;
  if (this.scheduled_at && !this.scheduledAt) this.scheduledAt = this.scheduled_at;
  if (this.scheduledAt && !this.scheduled_at) this.scheduled_at = this.scheduledAt;
  if (this.postpone_remark !== undefined && this.postponeRemark === undefined) this.postponeRemark = this.postpone_remark;
  if (this.postponeRemark !== undefined && this.postpone_remark === undefined) this.postpone_remark = this.postponeRemark;
  if (this.completion_note !== undefined && this.completionNote === undefined) this.completionNote = this.completion_note;
  if (this.completionNote !== undefined && this.completion_note === undefined) this.completion_note = this.completionNote;
  if (this.completed_at !== undefined && this.completedAt === undefined) this.completedAt = this.completed_at;
  if (this.completedAt !== undefined && this.completed_at === undefined) this.completed_at = this.completed_at;
  next();
});

followUpSchema.index({ lead_id: 1, scheduled_at: 1 });
followUpSchema.index({ agent_id: 1, status: 1 });
followUpSchema.index({ status: 1, scheduled_at: 1 });

module.exports = mongoose.models.FollowUp || mongoose.model('FollowUp', followUpSchema);
