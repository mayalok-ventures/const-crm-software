const mongoose = require('mongoose');

const integrationSchema = new mongoose.Schema(
  {
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

    provider: {
      type: String,
      enum: ['meta', 'google'],
      required: true,
      index: true,
    },

    // client_managed:
    // Client runs ads himself, CRM only receives leads.
    //
    // crm_managed:
    // CRM is authorized to manage advertising.
    mode: {
      type: String,
      enum: ['client_managed', 'crm_managed'],
      default: 'client_managed',
      required: true,
    },

    status: {
      type: String,
      enum: [
        'pending',
        'connected',
        'disconnected',
        'expired',
        'error',
      ],
      default: 'pending',
      index: true,
    },

    // Provider account information
    accountId: {
      type: String,
      default: null,
      trim: true,
    },

    accountName: {
      type: String,
      default: '',
      trim: true,
    },

    // Meta Page
    pageId: {
      type: String,
      default: null,
      trim: true,
    },

    pageName: {
      type: String,
      default: '',
      trim: true,
    },

    // Selected lead forms
    formIds: {
      type: [String],
      default: [],
    },

    // OAuth
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

    tokenExpiresAt: {
      type: Date,
      default: null,
    },

    scopes: {
      type: [String],
      default: [],
    },

    // Provider-specific data
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    lastSyncAt: {
      type: Date,
      default: null,
    },

    lastError: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

integrationSchema.index({
  companyId: 1,
  provider: 1,
});

integrationSchema.index(
  {
    companyId: 1,
    provider: 1,
    accountId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      accountId: {
        $type: 'string',
      },
    },
  }
);

module.exports = mongoose.model('Integration', integrationSchema);