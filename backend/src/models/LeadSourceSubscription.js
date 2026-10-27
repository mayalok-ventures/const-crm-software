const mongoose = require('mongoose');

/**
 * LeadSourceSubscription Schema
 *
 * Represents an active subscription routing leads from an external source asset
 * (e.g. Meta Lead Gen Form, Google Ads Lead Form, Website Form, Google Sheet)
 * into a designated CRM Campaign Group.
 *
 * Allows:
 * - One integration connection (e.g. Meta account) to split multiple forms across different campaign groups.
 * - Multiple providers (e.g. Meta + Google Ads) to route into the same campaign group.
 * - Independent field mapping and counselor assignment rules per source subscription.
 */
const leadSourceSubscriptionSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      default: null,
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Reference to parent integration connection
    integrationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Integration',
      required: true,
      index: true,
    },

    // Provider type: meta, google, sheets, website, custom
    provider: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    // Human-readable source subscription label (e.g. "Property Buyers Instagram Form")
    sourceName: {
      type: String,
      required: true,
      trim: true,
    },

    // External account/asset identifiers
    externalAccountId: {
      type: String,
      default: '',
      trim: true,
      index: true,
    },
    externalAccountName: {
      type: String,
      default: '',
      trim: true,
    },
    externalFormId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    externalFormName: {
      type: String,
      default: '',
      trim: true,
    },

    // Target CRM Campaign Group (Destination for inbound leads)
    campaignGroupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campaign',
      required: true,
      index: true,
    },

    // Subscription-specific Field Mapping Overrides
    fieldMapping: [
      {
        sourceField: { type: String, required: true },
        crmField: { type: String, required: true },
        isCustom: { type: Boolean, default: false },
        displayLabel: { type: String, default: '' },
        showOnProfile: { type: Boolean, default: true },
      },
    ],

    // Subscription-specific Assignment Rule (or 'inherit_campaign')
    assignmentRule: {
      type: {
        type: String,
        enum: ['inherit_campaign', 'specific_counselor', 'round_robin', 'weighted_split', 'fallback_only'],
        default: 'inherit_campaign',
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

    // Lifecycle Status
    status: {
      type: String,
      enum: ['active', 'paused', 'error'],
      default: 'active',
      index: true,
    },

    // Health & Operational Metrics
    healthStatus: {
      type: String,
      enum: ['healthy', 'warning', 'error'],
      default: 'healthy',
    },
    lastLeadAt: {
      type: Date,
      default: null,
    },
    totalLeadsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastError: {
      type: String,
      default: '',
    },

    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound Index: One externalFormId per provider within a single tenant/workspace
leadSourceSubscriptionSchema.index(
  { companyId: 1, provider: 1, externalFormId: 1 },
  { background: true }
);

leadSourceSubscriptionSchema.index(
  { workspaceId: 1, provider: 1, externalFormId: 1 },
  { background: true }
);

leadSourceSubscriptionSchema.index(
  { campaignGroupId: 1, status: 1 },
  { background: true }
);

module.exports =
  mongoose.models.LeadSourceSubscription ||
  mongoose.model('LeadSourceSubscription', leadSourceSubscriptionSchema);
