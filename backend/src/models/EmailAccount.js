const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');

/**
 * EmailAccount Schema
 * Represents a connected mailbox (Google Gmail, Microsoft 365 / Outlook, or Custom SMTP/IMAP).
 * Encrypts all sensitive refresh tokens, access tokens, and passwords using AES-256-GCM.
 */
const emailAccountSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
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
      enum: ['gmail', 'google', 'outlook', 'smtp'],
      required: [true, 'Email provider is required (gmail, google, outlook, or smtp)'],
      lowercase: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      lowercase: true,
      trim: true,
      index: true,
    },
    displayName: {
      type: String,
      trim: true,
      default: '',
    },
    isShared: {
      type: Boolean,
      default: false, // If true, visible to authorized workspace members
    },
    isGlobal: {
      type: Boolean,
      default: false, // Accessible by all counsellors in workspace
    },
    assignedUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
    ],
    status: {
      type: String,
      enum: ['active', 'needs_reauth', 'error', 'disconnected'],
      default: 'active',
      index: true,
    },
    syncStatus: {
      type: String,
      enum: ['idle', 'syncing', 'error'],
      default: 'idle',
    },
    lastSyncAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },

    // OAuth 2.0 Credentials (Encrypted)
    accessTokenEncrypted: {
      type: String,
      default: null,
      select: false, // Never return in default queries
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
    scope: {
      type: [String],
      default: [],
    },

    // Custom SMTP / IMAP Configuration (Encrypted)
    smtpHost: {
      type: String,
      trim: true,
      default: null,
    },
    smtpPort: {
      type: Number,
      default: 587,
    },
    smtpSecure: {
      type: Boolean,
      default: false,
    },
    smtpUser: {
      type: String,
      trim: true,
      default: null,
    },
    smtpPassEncrypted: {
      type: String,
      default: null,
      select: false,
    },

    imapHost: {
      type: String,
      trim: true,
      default: null,
    },
    imapPort: {
      type: Number,
      default: 993,
    },
    imapSecure: {
      type: Boolean,
      default: true,
    },

    // Mailbox stats & sync cursors
    unreadCount: {
      type: Number,
      default: 0,
    },
    totalMessagesCount: {
      type: Number,
      default: 0,
    },
    historyId: {
      type: String, // Gmail historyId cursor
      default: null,
    },
    deltaLink: {
      type: String, // Microsoft Graph delta cursor
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
emailAccountSchema.index({ workspaceId: 1, email: 1 }, { unique: true });
emailAccountSchema.index({ workspaceId: 1, userId: 1 });

/**
 * Method to set and encrypt OAuth access/refresh tokens
 */
emailAccountSchema.methods.setTokens = function ({ accessToken, refreshToken, expiresIn }) {
  if (accessToken) {
    this.accessTokenEncrypted = encrypt(accessToken);
  }
  if (refreshToken) {
    this.refreshTokenEncrypted = encrypt(refreshToken);
  }
  if (expiresIn) {
    this.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
  }
};

/**
 * Method to set and encrypt SMTP password
 */
emailAccountSchema.methods.setSmtpPassword = function (password) {
  if (password) {
    this.smtpPassEncrypted = encrypt(password);
  }
};

/**
 * Decrypt and retrieve access token
 */
emailAccountSchema.methods.getDecryptedAccessToken = function () {
  if (!this.accessTokenEncrypted) return null;
  return decrypt(this.accessTokenEncrypted);
};

/**
 * Decrypt and retrieve refresh token
 */
emailAccountSchema.methods.getDecryptedRefreshToken = function () {
  if (!this.refreshTokenEncrypted) return null;
  return decrypt(this.refreshTokenEncrypted);
};

/**
 * Decrypt and retrieve SMTP password
 */
emailAccountSchema.methods.getDecryptedSmtpPassword = function () {
  if (!this.smtpPassEncrypted) return null;
  return decrypt(this.smtpPassEncrypted);
};

/**
 * Safe JSON serializer to prevent credential leakage
 */
emailAccountSchema.methods.toSafeJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.accessTokenEncrypted;
  delete obj.refreshTokenEncrypted;
  delete obj.smtpPassEncrypted;
  return obj;
};

module.exports = mongoose.models.EmailAccount || mongoose.model('EmailAccount', emailAccountSchema);
