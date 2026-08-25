const mongoose = require('mongoose');

const paymentScheduleSchema = new mongoose.Schema({
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Tenant companyId is required'],
    index: true,
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: [true, 'Booking reference is mandatory'],
    index: true,
  },
  milestoneName: {
    type: String,
    required: [true, 'Milestone name is required'],
    trim: true, // e.g. 'On Booking', 'On Agreement Signing', 'On 5th Floor Slab', 'On Possession'
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
    index: true,
  },
  percentage: {
    type: Number,
    min: [0, 'Percentage cannot be negative'],
    max: [100, 'Percentage cannot exceed 100%'],
    default: 10,
  },
  amount: {
    type: Number,
    required: [true, 'Milestone payable amount is required'],
    min: [0, 'Amount cannot be negative'],
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount cannot be negative'],
  },
  paidDate: {
    type: Date,
    default: null,
  },
  paymentMode: {
    type: String,
    default: null,
  },
  transactionRef: {
    type: String,
    default: '',
    trim: true,
  },
  status: {
    type: String,
    enum: ['UPCOMING', 'DUE', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED'],
    default: 'UPCOMING',
    index: true,
  },
  receiptUrl: {
    type: String,
    default: null,
  },
  notes: {
    type: String,
    default: '',
    trim: true,
  },
}, { timestamps: true });

paymentScheduleSchema.index({ companyId: 1, bookingId: 1, status: 1 });
paymentScheduleSchema.index({ companyId: 1, dueDate: 1, status: 1 });

module.exports = mongoose.models.PaymentSchedule || mongoose.model('PaymentSchedule', paymentScheduleSchema);
