const mongoose = require('mongoose');

/**
 * Campaign Schema
 * Serves as:
 * 1. The Central Inbound Campaign Registry:
 *    Auto-created per (tenant + platform + connection + externalCampaignId) on first lead arrival.
 *    Stores custom displayName, assignmentRule, and fieldMapping (feeding campaignOverrides).
 * 2. Advertising spend and attribution tracker (Meta, Google, Sheets, Website, Custom Webhooks).
 * 3. Outbound broadcast/messaging campaigns.
 */
const campaignSchema = new mongoose.Schema(
  {
    // Tenant & Workspace Ownership
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    // Campaign Identifier & Display Names
    campaignName: {
      type: String,
      default: '',
      trim: true,
    },
    name: {
      type: String,
      default: '',
      trim: true,
    },
    displayName: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    campaignType: {
      type: String,
      enum: ['inbound_ad', 'outbound_broadcast', 'hybrid'],
      default: 'inbound_ad',
      index: true,
    },

    // Platform Attribution: meta, google, sheets, website, custom, broadcast, multi
    platform: {
      type: String,
      default: 'multi',
      lowercase: true,
      trim: true,
      index: true,
    },

    // Inbound Ad / Integration Routing Rules
    routingRules: {
      metaFormIds: [{ type: String, trim: true }],       // Meta Lead Gen Form IDs (e.g. "X form" ID)
      metaFormNames: [{ type: String, trim: true }],     // Meta Form Names (e.g. "X form")
      metaPageIds: [{ type: String, trim: true }],       // Meta Page IDs
      googleAccountIds: [{ type: String, trim: true }],  // Google Customer IDs
      googleCampaignIds: [{ type: String, trim: true }], // Google Campaign IDs
      websiteFormKeys: [{ type: String, trim: true }],   // Website Form Keys
      sheetIds: [{ type: String, trim: true }],          // Google Sheet IDs
      utmCampaigns: [{ type: String, trim: true, lowercase: true }], // UTM tags
    },

    // Inbound Hierarchy Linkage
    connectionId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    connectionName: {
      type: String,
      default: '',
      trim: true,
    },
    integrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Integration',
      default: null,
      index: true,
    },
    externalCampaignId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    campaignId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    // Inbound Campaign Overrides: Assignment Rule
    assignmentRule: {
      type: {
        type: String,
        enum: ['specific_counselor', 'round_robin', 'weighted_split', 'fallback_only'],
        default: 'round_robin',
        set: (v) => (v === 'specific_counsellor' ? 'specific_counselor' : v),
      },
      specificCounselorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      counselorPool: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
          weight: { type: Number, default: 1 },
          maxActiveLeads: { type: Number, default: null },
        },
      ],
      skipInactive: {
        type: Boolean,
        default: true,
      },
      fallbackUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
    },

    // Inbound Campaign Overrides: Field Mapping
    fieldMapping: [
      {
        sourceField: { type: String, required: true },
        crmField: { type: String, required: true },
        isCustom: { type: Boolean, default: false },
        displayLabel: { type: String, default: '' },
        showOnProfile: { type: Boolean, default: true },
      },
    ],

    // Lead Volume & Conversion Metrics
    leadsGenerated: {
      type: Number,
      default: 0,
      min: 0,
    },
    leadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    revenueGenerated: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastLeadAt: {
      type: Date,
      default: null,
    },

    // Advertising & Budget Metrics (Optional)
    budget: {
      type: Number,
      default: 0,
      min: [0, 'Budget cannot be negative'],
    },
    amountSpent: {
      type: Number,
      default: 0,
      min: [0, 'Amount spent cannot be negative'],
    },
    startDate: {
      type: Date,
      default: Date.now,
    },
    endDate: {
      type: Date,
      default: null,
    },

    // Lifecycle Status
    status: {
      type: String,
      enum: ['active', 'paused', 'completed', 'archived', 'draft', 'queued', 'running', 'cancelled'],
      default: 'active',
      trim: true,
      index: true,
    },

    // UTM Attribution Tracking
    utmSource: {
      type: String,
      default: '',
      trim: true,
    },
    utmMedium: {
      type: String,
      default: '',
      trim: true,
    },
    utmCampaign: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },

    // Outbound Broadcast Properties (preserving backward compatibility)
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Group',
      default: null,
    },
    template: {
      type: String,
      default: '',
    },
    totalLeads: {
      type: Number,
      default: 0,
    },
    sentCount: {
      type: Number,
      default: 0,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    strict: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Unified name resolution
campaignSchema.pre('save', function (next) {
  if (!this.campaignName && this.name) {
    this.campaignName = this.name;
  }
  if (!this.name && this.campaignName) {
    this.name = this.campaignName;
  }
  if (!this.externalCampaignId && this.campaignId) {
    this.externalCampaignId = this.campaignId;
  }
  if (!this.leadCount && this.leadsGenerated) {
    this.leadCount = this.leadsGenerated;
  }
  if (!this.leadsGenerated && this.leadCount) {
    this.leadsGenerated = this.leadCount;
  }
  next();
});

// Indexes for Inbound Registry & Performance
campaignSchema.index(
  { companyId: 1, platform: 1, connectionId: 1, externalCampaignId: 1 },
  { background: true }
);
campaignSchema.index({ platform: 1, status: 1, createdAt: -1 });

module.exports = mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
