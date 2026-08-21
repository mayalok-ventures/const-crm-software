const mongoose = require('mongoose');

/**
 * Coupon Schema
 * Supports targeted promotional discounts across the 6 SaaS subscription plans or wildcard ['ALL'].
 */
const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, 'Coupon code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    discountType: {
      type: String,
      required: [true, 'Discount type is required'],
      enum: {
        values: ['PERCENTAGE', 'FLAT'],
        message: '{VALUE} is not a valid discount type. Must be PERCENTAGE or FLAT',
      },
      uppercase: true,
      default: 'PERCENTAGE',
    },
    discountValue: {
      type: Number,
      required: [true, 'Discount value is required'],
      min: [0, 'Discount value cannot be negative'],
      validate: {
        validator: function (val) {
          if (this.discountType === 'PERCENTAGE') {
            return val >= 0 && val <= 100;
          }
          return val >= 0;
        },
        message: 'Percentage discount must be between 0 and 100',
      },
    },
    applicablePlans: {
      type: [String],
      required: true,
      default: ['ALL'],
      validate: {
        validator: function (plans) {
          return Array.isArray(plans) && plans.length > 0;
        },
        message: 'At least one plan or ["ALL"] wildcard must be specified',
      },
    },
    validFrom: {
      type: Date,
      default: Date.now,
    },
    validUntil: {
      type: Date,
      required: [true, 'Coupon expiration date (validUntil) is required'],
      validate: {
        validator: function (val) {
          return !this.validFrom || val >= this.validFrom;
        },
        message: 'validUntil date must be equal to or later than validFrom date',
      },
      index: true,
    },
    maxOverallUses: {
      type: Number,
      default: null, // null = unlimited
      min: [1, 'maxOverallUses must be at least 1 if set'],
    },
    maxUsesPerUser: {
      type: Number,
      default: 1,
      min: [1, 'maxUsesPerUser must be at least 1'],
    },
    currentUsageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    usedBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        usedAt: { type: Date, default: Date.now },
        planName: { type: String, required: true },
        discountApplied: { type: Number, required: true },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound Index for fast active validation
couponSchema.index({ code: 1, isActive: 1, validUntil: 1 });

/**
 * Instance Helper: Check if coupon is currently valid for a specific user and plan
 */
couponSchema.methods.isValidFor = function (planName, userId = null) {
  const now = new Date();
  if (!this.isActive) return { valid: false, reason: 'Coupon is inactive' };
  if (this.validFrom && now < this.validFrom) return { valid: false, reason: 'Coupon is not yet active' };
  if (this.validUntil && now > this.validUntil) return { valid: false, reason: 'Coupon has expired' };
  if (this.maxOverallUses && this.currentUsageCount >= this.maxOverallUses) {
    return { valid: false, reason: 'Coupon overall usage limit reached' };
  }

  // Check Plan Applicability
  const isApplicable = this.applicablePlans.includes('ALL') || this.applicablePlans.includes(planName);
  if (!isApplicable) {
    return { valid: false, reason: `Coupon is not applicable to plan: ${planName}` };
  }

  // Check Per-User Limit if userId supplied
  if (userId) {
    const userUses = this.usedBy.filter(u => String(u.userId) === String(userId)).length;
    if (userUses >= this.maxUsesPerUser) {
      return { valid: false, reason: `You have reached the maximum allowed redemptions (${this.maxUsesPerUser}) for this coupon` };
    }
  }

  return { valid: true };
};

module.exports = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
