const mongoose = require('mongoose');

/**
 * Plan Schema (Dynamic Product & Entitlement Definition)
 * Authoritative source of truth for:
 * 1. Commercial Pricing (Monthly & Yearly)
 * 2. Resource Caps (-1 = Unlimited, 0 = Disabled, >0 = Capped)
 * 3. Feature Permissions & Flags
 * 4. Marketing "What's Included" bullets
 * 5. Plan Versioning and Grandfathering
 */
const planSchema = new mongoose.Schema(
  {
    // Unique immutable plan code e.g. IND_STARTER_MONTHLY_V1, ORG_GROWTH_MONTHLY_V1, basic_solo, business
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    slug: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
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
    badge: {
      type: String,
      default: null,
      trim: true,
    },
    // Account Type / Category Isolation
    category: {
      type: String,
      enum: ['INDIVIDUAL', 'ORGANIZATION'],
      default: 'ORGANIZATION',
      index: true,
    },
    accountType: {
      type: String,
      required: true,
      enum: ['INDIVIDUAL', 'ORGANIZATION'],
      default: function() { return this.category || 'ORGANIZATION'; },
      index: true,
    },
    // Lifecycle & Visibility Status
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
    visibility: {
      type: String,
      enum: ['PUBLIC', 'HIDDEN'],
      default: 'PUBLIC',
      index: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    // Tier Level (1: Starter/Basic, 2: Pro/Growth, 3: Enterprise/Scale)
    tier: {
      type: Number,
      default: 1,
      min: 1,
      max: 5,
      index: true,
    },
    // Billing Interval (Legacy compatibility)
    interval: {
      type: String,
      enum: ['monthly', 'yearly'],
      default: 'monthly',
      index: true,
    },
    intervalCount: {
      type: Number,
      default: 1,
      min: 1,
    },

    // ── PRICING STRUCTURE (INTEGER PAISE CANONICAL) ─────────────────────────
    pricing: {
      monthly: {
        enabled: { type: Boolean, default: true },
        amount: { type: Number, default: 0 },
        priceInPaise: { type: Number, default: 0 },
      },
      yearly: {
        enabled: { type: Boolean, default: true },
        amount: { type: Number, default: 0 },
        priceInPaise: { type: Number, default: 0 },
      },
      currency: {
        type: String,
        default: 'INR',
        uppercase: true,
      },
    },

    // Legacy price fields for backwards compatibility
    priceInPaise: {
      type: Number,
      default: function() {
        return this.pricing?.monthly?.priceInPaise || (this.pricing?.yearly?.priceInPaise ? Math.round(this.pricing.yearly.priceInPaise / 12) : 0);
      },
    },
    price: {
      type: Number,
      default: function() {
        return this.priceInPaise ? Math.round(this.priceInPaise / 100) : 0;
      },
    },
    monthlyPrice: {
      type: Number,
      default: function() {
        if (this.pricing?.monthly?.amount) return this.pricing.monthly.amount;
        if (this.pricing?.monthly?.priceInPaise) return Math.round(this.pricing.monthly.priceInPaise / 100);
        return this.priceInPaise ? Math.round(this.priceInPaise / 100) : 0;
      },
    },
    yearlyPrice: {
      type: Number,
      default: function() {
        if (this.pricing?.yearly?.amount) return this.pricing.yearly.amount;
        if (this.pricing?.yearly?.priceInPaise) return Math.round(this.pricing.yearly.priceInPaise / 100);
        return this.monthlyPrice ? this.monthlyPrice * 10 : 0;
      },
    },
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

    // ── RESOURCE LIMITS (-1 = Unlimited, 0 = Disabled, >0 = Capped) ────────
    limits: {
      seats: {
        type: Number,
        default: 1, // Number of agent seats included
      },
      leads: {
        type: Number,
        default: 1000, // Max active leads
      },
      contacts: {
        type: Number,
        default: 5000,
      },
      contactGroups: {
        type: Number,
        default: 10, // Max contact groups
      },
      branches: {
        type: Number,
        default: 1,
      },
      pipelines: {
        type: Number,
        default: 3,
      },
      storageGB: {
        type: Number,
        default: 5,
      },
      monthlyWhatsAppMessages: {
        type: Number,
        default: 1000,
      },
      monthlyBroadcasts: {
        type: Number,
        default: 5,
      },
      apiRequestsMonthly: {
        type: Number,
        default: 0,
      },
    },

    // ── FEATURE FLAGS & PERMISSIONS ─────────────────────────────────────────
    features: {
      leadManagement: { type: Boolean, default: true },
      leadExport: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: true },
      whatsappBroadcast: { type: Boolean, default: false },
      automation: { type: Boolean, default: false },
      commonLeadPool: { type: Boolean, default: false },
      autoLeadDistribution: { type: Boolean, default: false },
      performanceTracking: { type: Boolean, default: false },
      commissionTracking: { type: Boolean, default: false },
      hierarchy: { type: Boolean, default: false },
      smartExitRules: { type: Boolean, default: false },
      advancedAnalytics: { type: Boolean, default: false },
      revenueAnalytics: { type: Boolean, default: false },
      customWebhooks: { type: Boolean, default: false },
      apiAccess: { type: Boolean, default: false },
      customDomain: { type: Boolean, default: false },
      customFields: { type: Boolean, default: true },
      prioritySupport: { type: Boolean, default: false },
    },

    // ── CUSTOMER-FACING MARKETING BULLETS (WHAT'S INCLUDED) ─────────────────
    whatsIncluded: [
      {
        type: String,
        trim: true,
      },
    ],

    // Versioning for plan grandfathering & immutable snapshots
    version: {
      type: Number,
      default: 1,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    razorpayPlanId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },

    // Legacy defaultEntitlements mapping for backwards compatibility
    defaultEntitlements: {
      maxSeats: { type: Number, default: 1 },
      maxLeads: { type: Number, default: 1000 },
      monthlyWAQuota: { type: Number, default: 1000 },
      isDripEnabled: { type: Boolean, default: false },
      totalAnnualQuota: { type: Number, default: 0 },
      exportGatedDays: { type: Number, default: 0 },
      dailyImportLimit: { type: Number, default: 500 },
      features: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },

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
planSchema.index({ category: 1, status: 1, visibility: 1, displayOrder: 1 });
planSchema.index({ code: 1, version: 1 }, { unique: true });

module.exports = mongoose.models.Plan || mongoose.model('Plan', planSchema);
