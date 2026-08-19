const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
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
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Amount must be positive'],
  },
  method: {
    type: String,
    default: 'bank_transfer',
    trim: true,
  },
  transaction_id: {
    type: String,
    default: '',
    trim: true,
  },
  transactionId: {
    type: String,
    default: '',
    trim: true,
  },
  receipt_url: {
    type: String,
    default: '',
    trim: true,
  },
  verified_by_agent: {
    type: Boolean,
    default: false,
  },
  verifiedByAgent: {
    type: Boolean,
    default: false,
  },
  verified_at: {
    type: Date,
    default: null,
  },
  verifiedAt: {
    type: Date,
    default: null,
  },
  verifiedByUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  plan_id: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['completed', 'refunded', 'pending', 'failed'],
    default: 'completed',
  },
  refunded_at: {
    type: Date,
    default: null,
  },
  refundedAt: {
    type: Date,
    default: null,
  },
  refund_reason: {
    type: String,
    default: null,
    trim: true,
  },
  refundReason: {
    type: String,
    default: null,
    trim: true,
  },
  notes: {
    type: String,
    default: '',
    trim: true,
  },
}, { timestamps: true });

// Auto-sync snake_case and camelCase getters/setters for robust interop
paymentSchema.pre('save', function (next) {
  if (this.lead_id && !this.leadId) this.leadId = this.lead_id;
  if (this.leadId && !this.lead_id) this.lead_id = this.leadId;
  if (this.agent_id && !this.agentId) this.agentId = this.agent_id;
  if (this.agentId && !this.agent_id) this.agent_id = this.agentId;
  if (this.transaction_id && !this.transactionId) this.transactionId = this.transaction_id;
  if (this.transactionId && !this.transaction_id) this.transaction_id = this.transactionId;
  if (this.verified_by_agent !== undefined && this.verifiedByAgent === undefined) this.verifiedByAgent = this.verified_by_agent;
  if (this.verifiedByAgent !== undefined && this.verified_by_agent === undefined) this.verified_by_agent = this.verifiedByAgent;
  if (this.verified_at && !this.verifiedAt) this.verifiedAt = this.verified_at;
  if (this.verifiedAt && !this.verified_at) this.verified_at = this.verifiedAt;
  if (this.refunded_at && !this.refundedAt) this.refundedAt = this.refunded_at;
  if (this.refundedAt && !this.refunded_at) this.refunded_at = this.refundedAt;
  if (this.refund_reason !== undefined && this.refundReason === undefined) this.refundReason = this.refund_reason;
  if (this.refundReason !== undefined && this.refund_reason === undefined) this.refund_reason = this.refundReason;
  next();
});

paymentSchema.index({ lead_id: 1, createdAt: -1 });
paymentSchema.index({ agent_id: 1 });
paymentSchema.index(
  { transaction_id: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
