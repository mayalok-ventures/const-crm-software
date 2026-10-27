const mongoose = require('mongoose');

const whatsAppSessionStateSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    transport: {
      type: String,
      enum: ['baileys', 'meta_cloud'],
      default: 'baileys',
      index: true,
    },
    phone: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        'DISCONNECTED',
        'CONNECTING',
        'CONNECTED',
        'RECONNECTING',
        'AUTHENTICATION_REQUIRED',
        'DEGRADED',
        'ERROR',
      ],
      default: 'DISCONNECTED',
      index: true,
    },
    lastConfirmedAt: {
      type: Date,
      default: null,
    },
    lastDisconnectAt: {
      type: Date,
      default: null,
    },
    lastDisconnectReason: {
      type: String,
      default: null,
    },
    lastError: {
      type: String,
      default: null,
    },
    reconnectAttempts: {
      type: Number,
      default: 0,
    },
    nextRetryAt: {
      type: Date,
      default: null,
    },
    requiresAction: {
      type: Boolean,
      default: false,
      index: true,
    },
    pairingCode: {
      type: String,
      default: null,
    },
    qrCode: {
      type: String,
      default: null,
    },
    // Distributed instance lease & fencing
    leaseOwner: {
      type: String,
      default: null,
    },
    leaseExpiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

whatsAppSessionStateSchema.index({ userId: 1, transport: 1 });
whatsAppSessionStateSchema.index({ status: 1, updatedAt: -1 });

module.exports =
  mongoose.models.WhatsAppSessionState ||
  mongoose.model('WhatsAppSessionState', whatsAppSessionStateSchema);
