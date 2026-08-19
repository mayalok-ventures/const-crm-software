const mongoose = require('mongoose');

/**
 * Entitlement Schema (Current Active Permissions & Quota Engine)
 * Authorizes what an Individual or Organization tenant can execute right now.
 * Implements export gating, monthly feature dripping, and anti-fraud velocity limits.
 */
const entitlementSchema = new mongoose.Schema(
  {
    // Tenant identity
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    subscriptionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription',
      required: true,
      index: true,
    },
    accountType: {
      type: String,
      required: true,
      enum: ['INDIVIDUAL', 'ORGANIZATION'],
      index: true,
    },
    // Overall Entitlement Status
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'RESTRICTED', 'LOCKED'],
      default: 'ACTIVE',
      index: true,
    },

    // ── 1. SEATS & TEAM MEMBERSHIP ──────────────────────────────────────────
    seats: {
      maxAllowed: {
        type: Number,
        default: 1,
        min: 1,
      },
      currentUsed: {
        type: Number,
        default: 1,
        min: 0,
      },
    },

    // ── 2. LEAD DATABASE QUOTA ──────────────────────────────────────────────
    leads: {
      maxAllowed: {
        type: Number,
        required: true,
        default: 500,
      },
      currentCount: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    // ── 3. WHATSAPP QUOTA & DRIP ACCUMULATOR ─────────────────────────────────
    whatsapp: {
      monthlyLimit: {
        type: Number,
        required: true,
        default: 1000,
      },
      messagesSentThisPeriod: {
        type: Number,
        default: 0,
        min: 0,
      },
      quotaResetDate: {
        type: Date,
        required: true,
      },
      // Annual Drip Schedule (Quota unlocked month-by-month to prevent churn & clone)
      isDripEnabled: {
        type: Boolean,
        default: false,
      },
      totalAnnualQuota: {
        type: Number,
        default: 0,
      },
      drippedQuotaAccumulator: {
        type: Number,
        default: 0,
      },
      nextDripDate: {
        type: Date,
        default: null,
      },
    },

    // ── 4. ANTI-FRAUD: EXPORT GATING & SECURITY ─────────────────────────────
    exportGating: {
      canExportData: {
        type: Boolean,
        default: false,
        index: true,
      },
      exportUnlockedAt: {
        type: Date,
        default: null,
      },
      gatingReason: {
        type: String,
        default: null,
      },
    },

    // ── 5. ANTI-FRAUD: IMPORT VELOCITY LIMITS ───────────────────────────────
    importVelocity: {
      dailyLimit: {
        type: Number,
        default: 500, // New accounts capped at 500/day
      },
      importedToday: {
        type: Number,
        default: 0,
      },
      lastResetAt: {
        type: Date,
        default: Date.now,
      },
    },

    // ── 6. FEATURE FLAGS ────────────────────────────────────────────────────
    features: {
      advancedAnalytics: { type: Boolean, default: false },
      customWebhooks: { type: Boolean, default: false },
      bulkCampaigns: { type: Boolean, default: false },
      customLeadFields: { type: Boolean, default: true },
      pipelineCustomization: { type: Boolean, default: true },
      prioritySupport: { type: Boolean, default: false },
      dedicatedSenderId: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for rapid entitlement enforcement
entitlementSchema.index({ userId: 1, status: 1 });
entitlementSchema.index({ companyId: 1, status: 1 });

module.exports = mongoose.models.Entitlement || mongoose.model('Entitlement', entitlementSchema);
