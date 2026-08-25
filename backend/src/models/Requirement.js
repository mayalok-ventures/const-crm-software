const mongoose = require('mongoose');

const requirementSchema = new mongoose.Schema({
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
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  title: {
    type: String,
    required: [true, 'Requirement title is required'],
    trim: true,
    default: 'Property Requirement',
  },
  propertyType: {
    type: String,
    enum: ['Apartment', 'Villa', 'Plot', 'Commercial', 'Penthouse', 'Independent Floor', 'Office Space', 'Other'],
    default: 'Apartment',
    trim: true,
  },
  configurations: [{
    type: String,
    trim: true, // e.g. ['1BHK', '2BHK', '3BHK', '4BHK', 'Studio']
  }],
  preferredLocations: [{
    type: String,
    trim: true, // e.g. ['Noida Expressway', 'Sector 150', 'Greater Noida']
  }],
  budgetMin: {
    type: Number,
    default: 0,
    min: [0, 'Budget minimum cannot be negative'],
  },
  budgetMax: {
    type: Number,
    default: 0,
    min: [0, 'Budget maximum cannot be negative'],
  },
  areaMin: {
    type: Number,
    default: 0,
    min: 0, // sq. ft.
  },
  areaMax: {
    type: Number,
    default: 0,
    min: 0, // sq. ft.
  },
  purpose: {
    type: String,
    enum: ['End Use', 'Investment', 'Rental Income', 'Other', null],
    default: 'End Use',
  },
  possessionPreference: {
    type: String,
    enum: ['Ready to Move', 'Within 6 Months', '1-2 Years', 'Under Construction', 'Flexible', null],
    default: 'Ready to Move',
  },
  furnishing: {
    type: String,
    enum: ['Furnished', 'Semi-Furnished', 'Bare Shell', 'Any', null],
    default: 'Any',
  },
  financingRequired: {
    type: Boolean,
    default: false,
  },
  timeline: {
    type: String,
    enum: ['Immediate (15-30 days)', '1-3 Months', '3-6 Months', 'Just Exploring'],
    default: 'Immediate (15-30 days)',
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'MATCHED', 'FULFILLED', 'INACTIVE'],
    default: 'ACTIVE',
    index: true,
  },
  notes: {
    type: String,
    default: '',
    trim: true,
  },
  matchedProjectsCount: {
    type: Number,
    default: 0,
  },
}, { timestamps: true });

// Compound Indexes for fast tenant-scoped queries
requirementSchema.index({ companyId: 1, leadId: 1, status: 1 });
requirementSchema.index({ companyId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.Requirement || mongoose.model('Requirement', requirementSchema);
