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
  currency: {
    type: String,
    default: 'INR',
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

module.exports = mongoose.model('Transaction', transactionSchema);
