const mongoose = require('mongoose');

/**
 * PaymentAttempt Schema (Immutable Transaction & Mandate Execution Log)
 * Records all incoming charges, e-mandate recurring debits, webhook payloads,
 * idempotency keys, and reconciliation receipts.
 */
const paymentAttemptSchema = new mongoose.Schema(
  {
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
      index: true,
    },
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
    // Razorpay Specific Identifiers
    razorpayPaymentId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    razorpaySubscriptionId: {
      type: String,
      trim: true,
      index: true,
    },
    razorpayInvoiceId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    // Idempotency Key: Prevents duplicate webhook / double-capture processing
    idempotencyKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    // Transaction Details
    amountInPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'authorized', 'captured', 'failed', 'refunded'],
      default: 'pending',
      index: true,
    },
    method: {
      type: String,
      enum: ['card', 'netbanking', 'upi', 'emandate', 'manual_override', 'other'],
      default: 'emandate',
    },
    // Failure / Error telemetry from payment gateway
    errorCode: {
      type: String,
      default: null,
    },
    errorDescription: {
      type: String,
      default: null,
    },
    errorSource: {
      type: String,
      default: null,
    },
    errorStep: {
      type: String,
      default: null,
    },
    // Raw Webhook / Gateway Payload for non-repudiation audit
    rawGatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    capturedAt: {
      type: Date,
      default: null,
    },
    // Reconciliation & Refund tracking
    reconciliationStatus: {
      type: String,
      enum: ['MATCHED', 'MISMATCHED', 'RECOVERABLE', 'MANUAL_REVIEW', 'NOT_APPLICABLE'],
      default: 'MATCHED',
      index: true,
    },
    invoiceNumber: {
      type: String,
      default: null,
      trim: true,
    },
    refundAmountInPaise: {
      type: Number,
      default: 0,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
    refundId: {
      type: String,
      default: null,
    },
    netAmountInPaise: {
      type: Number,
      default: function() {
        return Math.max(0, (this.amountInPaise || 0) - (this.refundAmountInPaise || 0));
      },
    },
    eventVersion: {
      type: Number,
      default: 1,
    },
    eventTimestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

paymentAttemptSchema.index({ subscriptionId: 1, createdAt: -1 });
paymentAttemptSchema.index({ userId: 1, createdAt: -1 });
paymentAttemptSchema.index({ companyId: 1, createdAt: -1 });
paymentAttemptSchema.index({ razorpayPaymentId: 1, status: 1 });
paymentAttemptSchema.index({ razorpaySubscriptionId: 1, createdAt: -1 });

module.exports = mongoose.models.PaymentAttempt || mongoose.model('PaymentAttempt', paymentAttemptSchema);
