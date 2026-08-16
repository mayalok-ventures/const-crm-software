const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  plan: {
    type: String,
    enum: [
      'free',
      'basic_solo',
      'smart_solo',
      'power_solo',
      'team_starter',
      'business',
      'enterprise',
      'custom_enterprise',
      'starter',
      'growth',
      'pro',
    ],
    default: 'smart_solo',
  },
  planGranted: {
    type: String,
    enum: [
      'free',
      'basic_solo',
      'smart_solo',
      'power_solo',
      'team_starter',
      'business',
      'enterprise',
      'custom_enterprise',
      'starter',
      'growth',
      'pro',
    ],
    default: 'smart_solo',
  },
  discountPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  durationDays: {
    type: Number,
    default: 30,
  },
  maxUses: {
    type: Number,
    default: 1,
  },
  usedCount: {
    type: Number,
    default: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
  validUntil: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

// Pre-save hook to synchronize plan and planGranted
couponSchema.pre('save', function (next) {
  if (this.planGranted && !this.plan) this.plan = this.planGranted;
  if (this.plan && !this.planGranted) this.planGranted = this.plan;
  if (this.validUntil && !this.expiresAt) this.expiresAt = this.validUntil;
  if (this.expiresAt && !this.validUntil) this.validUntil = this.expiresAt;
  next();
});

module.exports = mongoose.model('Coupon', couponSchema);
