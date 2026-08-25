const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tenant companyId is required'],
    index: true,
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: [true, 'Lead reference is required'],
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
    required: [true, 'Inventory unit reference is required'],
    index: true,
  },
  eoiId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'EOI',
    default: null,
  },
  bookingNumber: {
    type: String,
    required: [true, 'Booking number is mandatory'],
    trim: true,
  },
  bookingAmount: {
    type: Number,
    required: [true, 'Booking amount is mandatory'],
    min: [0, 'Booking amount cannot be negative'],
  },
  agreementValue: {
    type: Number,
    required: [true, 'Total agreement value is mandatory'],
    min: [0, 'Agreement value cannot be negative'],
  },
  paymentPlan: {
    type: String,
    enum: ['CLP', 'Down_Payment', 'Subvention_20_80', 'Custom', 'Time_Linked'],
    default: 'CLP',
  },
  bookingDate: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: ['CONFIRMED', 'AGREEMENT_SIGNED', 'REGISTERED', 'CANCELLED'],
    default: 'CONFIRMED',
    index: true,
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
    default: '',
    trim: true,
  },
  commissionCalculated: {
    type: Boolean,
    default: false,
  },
  commissionAmount: {
    type: Number,
    default: 0,
  },
  totalPaid: {
    type: Number,
    default: 0,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  notes: {
    type: String,
    default: '',
    trim: true,
  },
}, { timestamps: true });

// Tenant-scoped unique booking number
bookingSchema.index({ companyId: 1, bookingNumber: 1 }, { unique: true });
bookingSchema.index({ companyId: 1, leadId: 1, status: 1 });
bookingSchema.index({ companyId: 1, inventoryId: 1, status: 1 });
bookingSchema.index({ companyId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.Booking || mongoose.model('Booking', bookingSchema);
