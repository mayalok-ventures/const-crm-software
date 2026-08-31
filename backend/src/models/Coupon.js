const mongoose = require('mongoose');

/**
 * Enhanced Production Coupon Schema
 * Supports targeted promotional discounts, category & plan filtering, usage limits, and financial caps.
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
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
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
            return val > 0 && val <= 100;
          }
          return val >= 0;
        },
        message: 'Percentage discount must be between 0 and 100',
      },
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
    },
    appliesToAllPlans: {
      type: Boolean,
      default: true,
    },
    applicableCategories: {
      type: [String],
      enum: ['INDIVIDUAL', 'ORGANIZATION'],
      default: [],
    },
    applicablePlans: {
      type: [mongoose.Schema.Types.Mixed], // Supports ObjectIds or legacy plan codes/slugs
      default: ['ALL'],
    },
    minOrderValue: {
      type: Number,
      default: 0,
      min: [0, 'Minimum order value cannot be negative'],
    },
    maxDiscountAmount: {
      type: Number,
      default: null, // null = no cap
      min: [0, 'Maximum discount cap cannot be negative'],
    },
    validFrom: {
      type: Date,
      default: Date.now,
      index: true,
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
      default: null, // null / -1 = unlimited
    },
    maxUsesPerUser: {
      type: Number,
      default: 1,
      min: [1, 'maxUsesPerUser must be at least 1'],
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
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
        planName: { type: String, default: '' },
        discountApplied: { type: Number, default: 0 },
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Normalize code to uppercase before saving
couponSchema.pre('validate', function (next) {
  if (this.code) {
    this.code = String(this.code).toUpperCase().trim();
  }
  // Sync legacy isActive with status
  if (this.status === 'ACTIVE' && this.isActive === false) {
    this.isActive = true;
  } else if (this.status !== 'ACTIVE' && this.isActive === true) {
    this.isActive = false;
  }
  // Keep usageCount and currentUsageCount synchronized
  if (this.usageCount !== undefined && (this.currentUsageCount === undefined || this.currentUsageCount === 0)) {
    this.currentUsageCount = this.usageCount;
  } else if (this.currentUsageCount !== undefined && (this.usageCount === undefined || this.usageCount === 0)) {
    this.usageCount = this.currentUsageCount;
  }
  next();
});

// Compound Indexes for high-throughput queries
couponSchema.index({ code: 1, status: 1, validUntil: 1 });
couponSchema.index({ status: 1, validFrom: 1, validUntil: 1 });

/**
 * Instance Helper: Check if coupon is currently active in time window
 */
couponSchema.methods.isCurrentlyActive = function () {
  const now = new Date();
  if (this.status !== 'ACTIVE' || this.isActive === false) return false;
  if (this.validFrom && now < this.validFrom) return false;
  if (this.validUntil && now > this.validUntil) return false;
  return true;
};

/**
 * Instance Helper: Check if coupon is valid for a specific plan and user
 */
couponSchema.methods.isValidFor = function (planIdentifier, userId = null, orderAmount = 0) {
  const now = new Date();
  if (this.status !== 'ACTIVE' || !this.isActive) return { valid: false, reason: 'Coupon is inactive', code: 'COUPON_INACTIVE' };
  if (this.validFrom && now < this.validFrom) return { valid: false, reason: 'Coupon is not yet active', code: 'COUPON_NOT_STARTED' };
  if (this.validUntil && now > this.validUntil) return { valid: false, reason: 'Coupon has expired', code: 'COUPON_EXPIRED' };

  const effectiveUsage = Math.max(this.usageCount || 0, this.currentUsageCount || 0);
  if (this.maxOverallUses && this.maxOverallUses !== -1 && effectiveUsage >= this.maxOverallUses) {
    return { valid: false, reason: 'Coupon overall usage limit reached', code: 'COUPON_USAGE_LIMIT_REACHED' };
  }

  if (this.minOrderValue && orderAmount > 0 && orderAmount < this.minOrderValue) {
    return { valid: false, reason: `Minimum order value of ₹${this.minOrderValue} not met`, code: 'MIN_ORDER_VALUE_NOT_MET' };
  }

  // Check Per-User Limit if userId supplied
  if (userId && Array.isArray(this.usedBy)) {
    const userUses = this.usedBy.filter(u => String(u.userId) === String(userId)).length;
    if (userUses >= this.maxUsesPerUser) {
      return { valid: false, reason: `You have reached the maximum allowed redemptions (${this.maxUsesPerUser}) for this coupon`, code: 'COUPON_USER_LIMIT_REACHED' };
    }
  }

  return { valid: true };
};

module.exports = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);
