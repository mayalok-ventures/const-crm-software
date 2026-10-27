const mongoose = require('mongoose');

/**
 * WhatsAppAccount Schema
 * Represents a connected WhatsApp channel/line within a workspace.
 * Supports official Meta Cloud API accounts as well as QR/Baileys sessions.
 * Supports granular role/user assignments:
 * - isGlobal: true -> Available to all counsellors and managers in the workspace.
 * - assignedUserIds: [] -> Restricts access to specifically assigned teammates.
 */
const whatsAppAccountSchema = new mongoose.Schema(
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
    name: {
      type: String,
      trim: true,
      default: 'Primary WhatsApp Line',
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['cloud_api', 'baileys', 'qr_session', 'web_session'],
      default: 'cloud_api',
    },
    sessionId: {
      type: String,
      trim: true,
      default: null,
    },
    phoneNumberId: {
      type: String,
      trim: true,
      default: null,
    },
    wabaId: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: ['connected', 'disconnected', 'pending', 'error'],
      default: 'connected',
    },
    isDefault: {
      type: Boolean,
      default: false,
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
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

whatsAppAccountSchema.index({ workspaceId: 1, phoneNumber: 1 }, { unique: true });

module.exports =
  mongoose.models.WhatsAppAccount ||
  mongoose.model('WhatsAppAccount', whatsAppAccountSchema);
