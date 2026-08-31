const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
    index: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  amountInPaise: {
    type: Number,
    min: 0,
    default: function() { return this.amount ? Math.round(this.amount * 100) : 0; },
    index: true,
  },
  refundAmountInPaise: {
    type: Number,
    default: 0,
    min: 0,
  },
  netAmountInPaise: {
    type: Number,
    min: 0,
    default: function() {
      const gross = this.amountInPaise || (this.amount ? Math.round(this.amount * 100) : 0);
      return Math.max(0, gross - (this.refundAmountInPaise || 0));
    },
  },
  refundId: {
    type: String,
    default: null,
  },
  refundReason: {
    type: String,
    default: null,
  },
  refundedAt: {
    type: Date,
    default: null,
  },
  invoiceNumber: {
    type: String,
    default: null,
    trim: true,
  },
  currency: {
    type: String,
    default: 'INR',
    uppercase: true,
  },
  razorpay_order_id: {
    type: String,
    required: true,
    index: true,
  },
  razorpay_payment_id: {
    type: String,
    sparse: true,
    unique: true,
    index: true,
  },
  razorpay_signature: {
    type: String,
    default: null,
  },
  planName: {
    type: String,
    required: true,
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly',
  },
  status: {
    type: String,
    enum: ['created', 'captured', 'authorized', 'failed', 'refunded'],
    default: 'captured',
    index: true,
  },
  paymentMethod: {
    type: String,
    default: 'razorpay',
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ companyId: 1, createdAt: -1 });
transactionSchema.index({ razorpay_order_id: 1, razorpay_payment_id: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);
