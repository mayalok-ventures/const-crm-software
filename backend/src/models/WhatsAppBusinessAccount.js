const mongoose = require('mongoose');
const { encrypt, decrypt } = require('../utils/encryption');
const crypto = require('crypto');

/**
 * WhatsAppBusinessAccount Schema
 * Represents an official Meta WhatsApp Business Platform (Cloud API) integration.
 * Securely stores Phone Number ID, WABA ID, and AES-256 encrypted system user access tokens.
 */
const whatsAppBusinessAccountSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    wabaId: {
      type: String,
      required: [true, 'WhatsApp Business Account ID (WABA ID) is required'],
      trim: true,
      index: true,
    },
    phoneNumberId: {
      type: String,
      required: [true, 'Phone Number ID is required'],
      trim: true,
      index: true,
    },
    displayPhoneNumber: {
      type: String,
      trim: true,
      default: '',
    },
    verifiedName: {
      type: String,
      trim: true,
      default: '',
    },
    qualityRating: {
      type: String,
      enum: ['GREEN', 'YELLOW', 'RED', 'UNKNOWN'],
      default: 'UNKNOWN',
    },
    messagingLimitTier: {
      type: String,
      default: 'TIER_1K',
    },
    codeVerificationStatus: {
      type: String,
      default: 'VERIFIED',
    },
    status: {
      type: String,
      enum: ['CONNECTED', 'PENDING_REVIEW', 'RESTRICTED', 'DISCONNECTED'],
      default: 'CONNECTED',
      index: true,
    },
    metaAppId: {
      type: String,
      trim: true,
      default: '',
    },
    isGlobal: {
      type: Boolean,
      default: false,
    },
    assignedUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        index: true,
      },
    ],

    // AES-256-GCM Encrypted Credentials
    systemUserAccessTokenEncrypted: {
      type: String,
      default: null,
      select: false, // Never expose in default query
    },
    appSecretEncrypted: {
      type: String,
      default: null,
      select: false,
    },

    // Webhook Security Token
    webhookVerifyToken: {
      type: String,
      default: () => crypto.randomBytes(24).toString('hex'),
      index: true,
    },
    webhookSubscribed: {
      type: Boolean,
      default: false,
    },
    lastSyncAt: {
      type: Date,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to guarantee tenant isolation
whatsAppBusinessAccountSchema.index({ workspaceId: 1, phoneNumberId: 1 }, { unique: true });

/**
 * Set and encrypt permanent system user access token
 */
whatsAppBusinessAccountSchema.methods.setAccessToken = function (token) {
  if (token) {
    this.systemUserAccessTokenEncrypted = encrypt(token);
  }
};

/**
 * Decrypt access token
 */
whatsAppBusinessAccountSchema.methods.getDecryptedAccessToken = function () {
  if (!this.systemUserAccessTokenEncrypted) return null;
  return decrypt(this.systemUserAccessTokenEncrypted);
};

/**
 * Set and encrypt App Secret
 */
whatsAppBusinessAccountSchema.methods.setAppSecret = function (secret) {
  if (secret) {
    this.appSecretEncrypted = encrypt(secret);
  }
};

/**
 * Decrypt App Secret
 */
whatsAppBusinessAccountSchema.methods.getDecryptedAppSecret = function () {
  if (!this.appSecretEncrypted) return null;
  return decrypt(this.appSecretEncrypted);
};

/**
 * Safe JSON serializer to prevent credential exposure
 */
whatsAppBusinessAccountSchema.methods.toSafeJSON = function () {
  const obj = this.toObject ? this.toObject() : { ...this };
  delete obj.systemUserAccessTokenEncrypted;
  delete obj.appSecretEncrypted;
  return obj;
};

module.exports =
  mongoose.models.WhatsAppBusinessAccount ||
  mongoose.model('WhatsAppBusinessAccount', whatsAppBusinessAccountSchema);
