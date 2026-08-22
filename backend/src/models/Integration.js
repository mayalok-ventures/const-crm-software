const mongoose = require('mongoose');

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
  }
);

// Compound Indexes for fast multi-tenant queries
integrationSchema.index({ companyId: 1, provider: 1 });
integrationSchema.index({ userId: 1, provider: 1 });
integrationSchema.index({ provider: 1, status: 1 });
integrationSchema.index({ provider: 1, pageId: 1, status: 1 });
integrationSchema.index({ provider: 1, accountId: 1, status: 1 });
integrationSchema.index({ provider: 1, customerId: 1, status: 1 });

module.exports = mongoose.models.Integration || mongoose.model('Integration', integrationSchema);