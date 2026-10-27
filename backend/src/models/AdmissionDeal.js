const mongoose = require('mongoose');

const admissionDealSchema = new mongoose.Schema({
  workspaceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
    required: true,
    index: true,
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: false,
    default: null,
    index: true,
  },
  studentName: {
    type: String,
    required: true,
    trim: true,
  },
  studentPhone: {
    type: String,
    trim: true,
    default: '',
  },
  studentEmail: {
    type: String,
    lowercase: true,
    trim: true,
    default: '',
  },
  collegeName: {
    type: String,
    required: true,
    trim: true,
  },
  courseName: {
    type: String,
    required: true,
    trim: true,
  },
  academicYear: {
    type: String,
    default: '2026-2027',
    trim: true,
  },
  quota: {
    type: String,
    enum: ['Merit', 'Management', 'NRI', 'State', 'Other'],
    default: 'Merit',
  },
  tuitionValue: {
    type: Number,
    default: 0,
    min: 0,
  },
  tokenFeePaid: {
    type: Number,
    default: 0,
    min: 0,
  },
  currency: {
    type: String,
    default: 'INR',
  },
  admissionStatus: {
    type: String,
    enum: ['draft', 'seat_locked', 'fee_submitted', 'confirmed', 'cancelled'],
    default: 'confirmed',
    index: true,
  },
  confirmedAt: {
    type: Date,
    default: Date.now,
  },
  commission: {
    ratePercent: { type: Number, default: 0, min: 0, max: 100 },
    expectedAmount: { type: Number, default: 0, min: 0 },
    invoiceNumber: { type: String, default: '', trim: true },
    invoiceStatus: {
      type: String,
      enum: ['unbilled', 'invoiced', 'overdue', 'paid'],
      default: 'unbilled',
      index: true,
    },
    invoicedAt: { type: Date, default: null },
    receivedAmount: { type: Number, default: 0, min: 0 },
    payoutStatus: {
      type: String,
      enum: ['pending', 'partial', 'paid'],
      default: 'pending',
      index: true,
    },
    settledAt: { type: Date, default: null },
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  notes: {
    type: String,
    default: '',
  },
  cancelledAt: {
    type: Date,
    default: null,
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  cancellationReason: {
    type: String,
    trim: true,
    default: '',
  },
}, {
  timestamps: true,
});

admissionDealSchema.index({ workspaceId: 1, admissionStatus: 1 });
admissionDealSchema.index({ workspaceId: 1, 'commission.payoutStatus': 1 });
admissionDealSchema.index({ workspaceId: 1, 'commission.invoiceStatus': 1 });
admissionDealSchema.index({ workspaceId: 1, confirmedAt: -1, createdAt: -1 });

module.exports = mongoose.models.AdmissionDeal || mongoose.model('AdmissionDeal', admissionDealSchema);
