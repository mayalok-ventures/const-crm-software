const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

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

    // Provider account information (Meta Ad Account ID or Google Customer ID)
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

    // Meta Page / Asset Identifiers
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

    // Google Ads Specific Account Identifiers
    customerId: {
      type: String,
      default: null,
      trim: true,
    },

    managerCustomerId: {
      type: String,
      default: null,
      trim: true,
    },

    // OAuth Encrypted Credentials (Never stored in plaintext)
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

    webhookSubscribed: {
      type: Boolean,
      default: false,
    },

    connectedAt: {
      type: Date,
      default: null,
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
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual property for backward compatibility with boolean checks (isActive)
integrationSchema.virtual('isActive')
  .get(function () {
    return this.status === 'connected';
  })
  .set(function (val) {
    if (val === true && this.status !== 'connected') {
      this.status = 'connected';
    } else if (val === false && this.status === 'connected') {
      this.status = 'disconnected';
    }
  });

// Virtual helper for transparent token encryption/decryption
integrationSchema.virtual('accessToken')
  .get(function () {
    if (!this.accessTokenEncrypted) return null;
    try {
      return decrypt(this.accessTokenEncrypted);
    } catch {
      return null;
    }
  })
  .set(function (rawToken) {
    if (!rawToken) {
      this.accessTokenEncrypted = null;
    } else {
      this.accessTokenEncrypted = encrypt(rawToken);
    }
  });

integrationSchema.virtual('refreshToken')
  .get(function () {
    if (!this.refreshTokenEncrypted) return null;
    try {
      return decrypt(this.refreshTokenEncrypted);
    } catch {
      return null;
    }
  })
  .set(function (rawToken) {
    if (!rawToken) {
      this.refreshTokenEncrypted = null;
    } else {
      this.refreshTokenEncrypted = encrypt(rawToken);
    }
  });

// Indexes for high-performance tenant queries and duplicate prevention
integrationSchema.index({
  companyId: 1,
  provider: 1,
});

integrationSchema.index({
  userId: 1,
  provider: 1,
});

// Unique index per company + provider + account
integrationSchema.index(
  {
    companyId: 1,
    provider: 1,
    accountId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      companyId: { $type: 'objectId' },
      accountId: { $type: 'string' },
    },
  }
);

// Unique index per solo user + provider + account
integrationSchema.index(
  {
    userId: 1,
    provider: 1,
    accountId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      companyId: { $eq: null },
      accountId: { $type: 'string' },
    },
  }
);

// Fast lookup indexes for webhooks
integrationSchema.index({ provider: 1, pageId: 1, status: 1 });
integrationSchema.index({ provider: 1, accountId: 1, status: 1 });
integrationSchema.index({ provider: 1, customerId: 1, status: 1 });

module.exports = mongoose.model('Integration', integrationSchema);