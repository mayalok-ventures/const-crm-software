const mongoose = require('mongoose');

const eoiSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tenant companyId is required'],
    index: true,
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: [true, 'Lead ID is mandatory'],
    index: true,
  },
  opportunityId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Opportunity',
    default: null,
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: [true, 'Project reference is required'],
    index: true,
  },
  inventoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Inventory',
    default: null,
  },
  eoiNumber: {
    type: String,
    required: [true, 'EOI number is required'],
    trim: true,
  },
  tokenAmount: {
    type: Number,
    required: [true, 'Token amount is required'],
    min: [0, 'Token amount cannot be negative'],
  },
  paymentStatus: {
    type: String,
    enum: ['PENDING', 'PAID', 'REFUNDED'],
    default: 'PENDING',
    index: true,
  },
  paymentReference: {
    type: String,
    default: '',
    trim: true,
  },
  paymentMode: {
    type: String,
    enum: ['UPI', 'Cheque', 'Bank Transfer', 'NEFT', 'RTGS', 'IMPS', 'Net Banking', 'Credit Card', 'Debit Card', 'Cash', 'Other', null],
    default: 'UPI',
  },
  status: {
    type: String,
    enum: ['DRAFT', 'SUBMITTED', 'CONFIRMED', 'CONVERTED_TO_BOOKING', 'CANCELLED', 'EXPIRED'],
    default: 'DRAFT',
    index: true,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  },
  confirmedAt: {
    type: Date,
    default: null,
  },
  convertedBookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null,
  },
  notes: {
    type: String,
    default: '',
    trim: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { timestamps: true });

// Tenant-scoped unique EOI number
eoiSchema.index({ companyId: 1, eoiNumber: 1 }, { unique: true });
eoiSchema.index({ companyId: 1, leadId: 1, status: 1 });
eoiSchema.index({ companyId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.EOI || mongoose.model('EOI', eoiSchema);
