const mongoose = require('mongoose');

/**
 * Integration Schema
 * Securely stores encrypted third-party credentials and connection statuses for Meta Ads,
 * Google Ads, WhatsApp Business Cloud API, and generic inbound Webhooks.
 */
const integrationSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: [true, 'Integration provider is required'],
      enum: {
        values: ['META', 'GOOGLE', 'WHATSAPP', 'WEBHOOK'],
        message: '{VALUE} is not a recognized integration provider',
      },
      uppercase: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['CONNECTED', 'DISCONNECTED', 'ERROR'],
        message: '{VALUE} is not a valid integration status',
      },
      default: 'DISCONNECTED',
      uppercase: true,
      index: true,
    },
    encryptedCredentials: {
      type: String,
      required: [true, 'Encrypted credentials string is required. Raw secrets are strictly prohibited.'],
      trim: true,
    },
    webhookUrl: {
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
      default: null,
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
  }
);

integrationSchema.index({ provider: 1, status: 1 });

module.exports = mongoose.models.Integration || mongoose.model('Integration', integrationSchema);