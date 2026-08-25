const mongoose = require('mongoose');

const projectImageSchema = new mongoose.Schema({
  url: { type: String, required: true },
  filename: { type: String, default: '' },
  caption: { type: String, default: '' },
}, { _id: true });

const projectSchema = new mongoose.Schema({
  // Created by (Agent or Company Owner)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Associated Company (if user belongs to an agency)
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },

  name: {
    type: String,
    required: [true, 'Project/Product/Package name is required'],
    trim: true,
  },
  location: {
    type: String,
    required: [true, 'Location or Market is required'],
    trim: true,
  },
  city: {
    type: String,
    default: '',
    trim: true,
  },
  // Universal vendor/brand (aliases: developer)
  vendorOrBrand: {
    type: String,
    default: '',
    trim: true,
  },
  developer: {
    type: String,
    default: '',
    trim: true,
  },
  basePrice: {
    type: String,
    default: '',
    trim: true, // e.g. "₹50,000 / mo" or "$5,000" or "₹1.5 Cr"
  },
  minPrice: {
    type: Number,
    default: 0,
  },
  maxPrice: {
    type: Number,
    default: 0,
  },
  // Universal categories / tiers / variants (aliases: configuration)
  productCategory: [{
    type: String,
    trim: true, // e.g. ['Standard', 'Professional', 'Enterprise', 'Custom Tier']
  }],
  configuration: [{
    type: String,
    trim: true,
  }],
  // Features / Inclusions / Amenities
  amenities: [{
    type: String,
    trim: true, // e.g. ['24/7 Support', 'Dedicated Manager', 'API Access', 'Custom SLA']
  }],
  // Universal delivery / completion date (aliases: possessionDate)
  deliveryOrCompletionDate: {
    type: String,
    default: '',
    trim: true, // e.g. "Immediate", "Q4 2026", "2 Weeks Delivery"
  },
  possessionDate: {
    type: String,
    default: '',
    trim: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  // Universal reference ID / SKU / License (aliases: reraNumber)
  referenceId: {
    type: String,
    default: '',
    trim: true,
  },
  reraNumber: {
    type: String,
    default: '',
    trim: true,
  },
  brochureUrl: {
    type: String,
    default: null,
  },
  images: [projectImageSchema],
  status: {
    type: String,
    enum: ['upcoming', 'under_construction', 'ready_to_move', 'sold_out', 'active', 'in_development', 'available', 'archived'],
    default: 'available',
  },
  // Real Estate USPs & Property Types
  usps: [{
    type: String,
    trim: true,
  }],
  propertyTypes: [{
    type: String,
    trim: true, // e.g. ['Apartment', 'Villa', 'Plot', 'Commercial', 'Penthouse']
  }],
  // Detailed Pricing Structure
  pricingBreakdown: {
    baseRateSqFt: { type: Number, default: 0 },
    plc: { type: Number, default: 0 },
    floorRise: { type: Number, default: 0 },
    parkingCharges: { type: Number, default: 0 },
    clubMembership: { type: Number, default: 0 },
    maintenanceDeposit: { type: Number, default: 0 },
    gstPercent: { type: Number, default: 5 },
  },
  // Unit & Inventory Counters
  totalUnits: {
    type: Number,
    default: 0,
    min: 0,
  },
  availableUnits: {
    type: Number,
    default: 0,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  customData: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
}, { timestamps: true });

// Auto-sync aliases before saving
projectSchema.pre('save', function(next) {
  if (this.vendorOrBrand && !this.developer) this.developer = this.vendorOrBrand;
  if (this.developer && !this.vendorOrBrand) this.vendorOrBrand = this.developer;

  if (this.referenceId && !this.reraNumber) this.reraNumber = this.referenceId;
  if (this.reraNumber && !this.referenceId) this.referenceId = this.reraNumber;

  if (this.deliveryOrCompletionDate && !this.possessionDate) this.possessionDate = this.deliveryOrCompletionDate;
  if (this.possessionDate && !this.deliveryOrCompletionDate) this.deliveryOrCompletionDate = this.possessionDate;

  if (this.productCategory && this.productCategory.length && (!this.configuration || !this.configuration.length)) {
    this.configuration = this.productCategory;
  }
  if (this.configuration && this.configuration.length && (!this.productCategory || !this.productCategory.length)) {
    this.productCategory = this.configuration;
  }

  next();
});

// Search indexes
projectSchema.index({ userId: 1 });
projectSchema.index({ companyId: 1 });
projectSchema.index({ name: 'text', location: 'text', city: 'text', vendorOrBrand: 'text', developer: 'text' });

module.exports = mongoose.model('Project', projectSchema);
