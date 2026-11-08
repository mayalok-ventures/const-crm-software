const mongoose = require('mongoose');

const feeInstallmentSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      required: true,
      index: true,
    },
    installmentNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    title: {
      type: String,
      trim: true,
      default: function () {
        return `Installment #${this.installmentNumber || 1}`;
      },
    },
    amount: {
      type: Number,
      required: [true, 'Installment amount is required'],
      min: [0, 'Amount must be positive'],
    },
    dueDate: {
      type: Date,
      required: [true, 'Installment due date is required'],
      index: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'partially_paid', 'overdue', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment',
      default: null,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    gracePeriodDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    writeConcern: {
      w: 'majority',
      j: true,
      wtimeout: 10000,
    },
  }
);

feeInstallmentSchema.index({ workspaceId: 1, leadId: 1, installmentNumber: 1 });
feeInstallmentSchema.index({ workspaceId: 1, status: 1, dueDate: 1 });

module.exports = mongoose.models.FeeInstallment || mongoose.model('FeeInstallment', feeInstallmentSchema);

