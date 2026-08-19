const mongoose = require('mongoose');

/**
 * Plan Schema (Immutable Product Definition)
 * Defines the product offerings, pricing tiers, and base entitlement templates.
 */
const planSchema = new mongoose.Schema(
  {
    // Unique immutable plan code e.g. IND_TIER1_MONTHLY_V1, ORG_TIER2_YEARLY_V1
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    // Account Type Isolation
    accountType: {
      type: String,
      required: true,
      enum: ['INDIVIDUAL', 'ORGANIZATION'],
      index: true,
    },
    // Tier Level (1: Starter/Basic, 2: Pro/Growth, 3: Enterprise/Scale)
    tier: {
      type: Number,
      required: true,
      min: 1,
      max: 3,
      index: true,
    },
    // Billing Interval
    interval: {
      type: String,
      required: true,
      enum: ['monthly', 'yearly'],
      index: true,
    },
    // Interval count (usually 1 for monthly/yearly)
    intervalCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    // Base Price in lowest currency unit (Paise for INR, e.g. 199900 = ₹1,999)
    priceInPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    // Price per additional seat (for ORGANIZATION tier plans)
    perSeatPriceInPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      uppercase: true,
      trim: true,
    },
    // Versioning for plan grandfathering & price migration
    version: {
      type: Number,
      default: 1,
      required: true,
    },
    // Whether this plan is currently available for new purchases
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    // Razorpay Plan identifier for e-Mandate sync
    razorpayPlanId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    // Default Entitlements granted when this plan is active
    defaultEntitlements: {
      maxSeats: {
        type: Number,
        default: 1,
        min: 1,
      },
      maxLeads: {
        type: Number,
        required: true,
        min: 100,
      },
      monthlyWAQuota: {
        type: Number,
        required: true,
        min: 0,
      },
      // Annual quota drip (e.g. 120k yearly is dripped 10k/month)
      isDripEnabled: {
        type: Boolean,
        default: false,
      },
      totalAnnualQuota: {
        type: Number,
        default: 0,
      },
      // Export gating: requires 90 days tenure on monthly-paid annual commitments
      exportGatedDays: {
        type: Number,
        default: 0,
      },
      // Daily import velocity limits for fraud prevention
      dailyImportLimit: {
        type: Number,
        default: 500,
      },
      // Advanced features
      features: {
        advancedAnalytics: { type: Boolean, default: false },
        customWebhooks: { type: Boolean, default: false },
        bulkCampaigns: { type: Boolean, default: false },
        customFields: { type: Boolean, default: true },
        pipelineCustomization: { type: Boolean, default: true },
        prioritySupport: { type: Boolean, default: false },
        dedicatedSenderId: { type: Boolean, default: false },
      },
    },
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for rapid lookup and catalog filtering
planSchema.index({ accountType: 1, tier: 1, interval: 1, isActive: 1 });
planSchema.index({ code: 1, version: 1 }, { unique: true });

module.exports = mongoose.models.Plan || mongoose.model('Plan', planSchema);
