const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

/**
 * Integration Schema
 * Securely stores encrypted third-party credentials and connection statuses for Meta Ads,
 * Google Ads, WhatsApp Business Cloud API, and generic inbound Webhooks.
 */
const integrationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null,
    },
    provider: {
      type: String,
      required: [true, 'Integration provider is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    mode: {
      type: String,
      default: 'client_managed',
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      default: 'connected',
      lowercase: true,
      trim: true,
      index: true,
    },
    accountId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    accountName: {
      type: String,
      trim: true,
      default: null,
    },
    pageId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    pageName: {
      type: String,
      trim: true,
      default: null,
    },
    formIds: {
      type: [String],
      default: [],
    },
    formNames: {
      type: [String],
      default: [],
    },
    customerId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    adAccountId: {
      type: String,
      trim: true,
      default: null,
    },
    adAccountName: {
      type: String,
      trim: true,
      default: null,
    },
    accessTokenEncrypted: {
      type: String,
      default: null,
      select: false,
    },
    refreshTokenEncrypted: {
      type: String,
      default: null,
      select: false,
    },
    encryptedCredentials: {
      type: String,
      default: null,
      select: false,
    },
    inboundSecretEncrypted: {
      type: String,
      default: null,
      select: false,
    },
    tokenExpiresAt: {
      type: Date,
      default: null,
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
    webhookUrl: {
      type: String,
      default: null,
      trim: true,
    },
    webhookSecret: {
      type: String,
      default: null,
      trim: true,
    },
    verifyToken: {
      type: String,
      default: null,
      trim: true,
    },
    lastSyncAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: '',
    },
    // Health & Degraded State Tracking
    degradedLeadCount: {
      type: Number,
      default: 0,
    },
    needsReconnectAt: {
      type: Date,
      default: null,
    },
    // Per-Integration Inbound Keys (stored as SHA-256 hashes, never plaintext)
    googleKeyHash: {
      type: String,
      default: null,
      select: false,
      index: true,
    },
    googleKeyPrefix: {
      type: String,
      default: '',
    },
    sheetsSecretHash: {
      type: String,
      default: null,
      select: false,
      index: true,
    },
    sheetsSecretPrefix: {
      type: String,
      default: '',
    },
    // Field Mapping Dictionary
    fieldMapping: [
      {
        sourceField: { type: String, required: true },
        crmField: { type: String, required: true },
        isCustom: { type: Boolean, default: false },
        displayLabel: { type: String, default: '' },
        showOnProfile: { type: Boolean, default: true },
      },
    ],
    // Team Assignment Rule
    assignmentRule: {
      type: {
        type: String,
        enum: ['specific_counselor', 'round_robin', 'weighted_split', 'fallback_only'],
        default: 'round_robin',
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
          maxActiveLeads: { type: Number, default: null }, // Best-effort capacity cap
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
    // Duplicate & Re-Inquiry Policy
    duplicatePolicy: {
      type: String,
      enum: ['merge_activity', 'create_inquiry', 'skip'],
      default: 'create_inquiry',
    },
    reInquiryAssignmentPolicy: {
      type: String,
      enum: ['keep_existing_owner', 'reassign_by_rule'],
      default: 'keep_existing_owner',
    },
    // Granular Campaign / Form Overrides
    campaignOverrides: [
      {
        campaignId: { type: String, required: true },
        campaignName: { type: String, default: '' },
        formId: { type: String, default: null },
        assignmentRule: {
          type: {
            type: String,
            enum: ['specific_counselor', 'round_robin', 'weighted_split', 'fallback_only'],
            default: 'round_robin',
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
          skipInactive: { type: Boolean, default: true },
          fallbackUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        },
        fieldMapping: [
          {
            sourceField: { type: String, required: true },
            crmField: { type: String, required: true },
            isCustom: { type: Boolean, default: false },
            displayLabel: { type: String, default: '' },
            showOnProfile: { type: Boolean, default: true },
          },
        ],
      },
    ],
    // Google Sheets Specific Configuration
    sheetsConfig: {
      spreadsheetId: { type: String, default: null },
      sheetId: { type: String, default: null },
      spreadsheetUrl: { type: String, default: null },
      tabName: { type: String, default: 'Sheet1' },
      sheetName: { type: String, default: null },
      headerRowIndex: { type: Number, default: 1 },
      syncMode: { type: String, enum: ['push', 'polling'], default: 'polling' },
      pollIntervalMinutes: { type: Number, default: 5 },
      accessMethod: { type: String, default: 'oauth' },
      hasWriteAccess: { type: Boolean, default: true },
      importExistingRows: { type: Boolean, default: false },
      cutoffRowIndex: { type: Number, default: 0 },
      lastSyncedRowIndex: { type: Number, default: 0 },
      lastSyncedAt: { type: Date, default: null },
      totalRowsSynced: { type: Number, default: 0 },
      totalNeedsReview: { type: Number, default: 0 },
      totalFailed: { type: Number, default: 0 },
      needsRemapping: { type: Boolean, default: false },
      storedHeaders: { type: [String], default: [] },
      syncedFingerprints: { type: [String], default: [] },
      trackingColumnName: { type: String, default: 'CRM_LEAD_ID' },
    },
    // Website Forms Specific Configuration
    websiteFormConfig: {
      formKey: { type: String, default: null, index: true },
      allowedOrigins: [{ type: String, trim: true }],
      honeypotField: { type: String, default: '_crm_hp_trap' },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    strict: false, // Ensures future dynamic provider fields do not fail upsert operations
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual for isActive
integrationSchema.virtual('isActive').get(function () {
  return this.status === 'connected';
});

// Virtual for accessToken (encrypt on set, decrypt on get)
integrationSchema
  .virtual('accessToken')
  .get(function () {
    return this.accessTokenEncrypted ? decrypt(this.accessTokenEncrypted) : null;
  })
  .set(function (value) {
    if (value) {
      this.accessTokenEncrypted = encrypt(value);
    } else {
      this.accessTokenEncrypted = null;
    }
  });

// Virtual for refreshToken (encrypt on set, decrypt on get)
integrationSchema
  .virtual('refreshToken')
  .get(function () {
    return this.refreshTokenEncrypted ? decrypt(this.refreshTokenEncrypted) : null;
  })
  .set(function (value) {
    if (value) {
      this.refreshTokenEncrypted = encrypt(value);
    } else {
      this.refreshTokenEncrypted = null;
    }
  });

// Virtual for inboundSecret (encrypt on set, decrypt on get)
integrationSchema
  .virtual('inboundSecret')
  .get(function () {
    return this.inboundSecretEncrypted ? decrypt(this.inboundSecretEncrypted) : null;
  })
  .set(function (value) {
    if (value) {
      this.inboundSecretEncrypted = encrypt(value);
    } else {
      this.inboundSecretEncrypted = null;
    }
  });

integrationSchema.index(
  { companyId: 1, provider: 1, accountId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      accountId: { $exists: true, $type: 'string', $gt: '' },
    },
  }
);
integrationSchema.index({ companyId: 1, provider: 1 });
integrationSchema.index({ userId: 1, provider: 1 });
integrationSchema.index({ provider: 1, status: 1 });
integrationSchema.index({ provider: 1, pageId: 1, status: 1 });
integrationSchema.index({ provider: 1, accountId: 1, status: 1 });
integrationSchema.index({ provider: 1, customerId: 1, status: 1 });

// Single-Tenant Meta Page Ownership Constraint:
// One Meta Page cannot be simultaneously connected to two workspaces in our CRM.
integrationSchema.index(
  { provider: 1, pageId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      provider: 'meta',
      status: 'connected',
      pageId: { $gt: '' },
    },
  }
);

module.exports = mongoose.models.Integration || mongoose.model('Integration', integrationSchema);