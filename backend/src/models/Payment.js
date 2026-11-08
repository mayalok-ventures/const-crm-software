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
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    default: null,
    index: true,
  },
  plan_id: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['completed', 'captured', 'success', 'refunded', 'pending', 'failed'],
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
}, {
  timestamps: true,
  writeConcern: {
    w: 'majority',
    j: true,
    wtimeout: 10000,
  },
});

const DUAL_FIELD_PAIRS = [
  ['lead_id', 'leadId'],
  ['agent_id', 'agentId'],
  ['transaction_id', 'transactionId'],
  ['verified_by_agent', 'verifiedByAgent'],
  ['verified_at', 'verifiedAt'],
  ['refunded_at', 'refundedAt'],
  ['refund_reason', 'refundReason'],
];

function syncDualFieldPairs(obj) {
  if (!obj || typeof obj !== 'object') return;
  for (const [snake, camel] of DUAL_FIELD_PAIRS) {
    const sVal = obj[snake];
    const cVal = obj[camel];

    const sHasValue = sVal !== undefined && sVal !== null && sVal !== '';
    const cHasValue = cVal !== undefined && cVal !== null && cVal !== '';

    if (sHasValue && !cHasValue) {
      obj[camel] = sVal;
    } else if (cHasValue && !sHasValue) {
      obj[snake] = cVal;
    } else if (typeof sVal === 'boolean' && typeof cVal !== 'boolean') {
      obj[camel] = sVal;
    } else if (typeof cVal === 'boolean' && typeof sVal !== 'boolean') {
      obj[snake] = cVal;
    }
  }
}

// Auto-sync snake_case and camelCase on save
paymentSchema.pre('save', function (next) {
  syncDualFieldPairs(this);
  next();
});

// Auto-sync snake_case and camelCase on updates
paymentSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'findByIdAndUpdate'], function (next) {
  const update = this.getUpdate();
  if (update) {
    syncDualFieldPairs(update);
    if (update.$set) syncDualFieldPairs(update.$set);
    if (update.$setOnInsert) syncDualFieldPairs(update.$setOnInsert);
  }
  next();
});

paymentSchema.index({ companyId: 1, status: 1, amount: 1 });
paymentSchema.index({ workspaceId: 1, createdAt: -1 });
paymentSchema.index({ lead_id: 1, createdAt: -1 });
paymentSchema.index({ leadId: 1, createdAt: -1 });
paymentSchema.index({ agent_id: 1 });
paymentSchema.index({ agentId: 1 });
paymentSchema.index(
  { transaction_id: 1 },
  { unique: true, sparse: true }
);
paymentSchema.index(
  { transactionId: 1 },
  { unique: true, sparse: true }
);

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
