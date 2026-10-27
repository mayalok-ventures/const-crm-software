const mongoose = require('mongoose');

/**
 * EmailMessage Schema
 * Stores synced and locally composed email messages, threading information,
 * attachments, CRM lead association, and status.
 */
const emailRecipientSchema = new mongoose.Schema(
  {
    name: { type: String, default: '', trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
  },
  { _id: false }
);

const emailAttachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    contentType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    url: { type: String, required: true },
    storageKey: { type: String, default: null },
  },
  { _id: true }
);

const emailMessageSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      index: true,
    },
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'EmailAccount',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      index: true,
      default: null,
    },

    // Threading & RFC Identifiers
    threadId: {
      type: String,
      required: true,
      index: true,
    },
    messageId: {
      type: String, // RFC 5322 Message-ID (e.g. <abc@domain.com>)
      index: true,
    },
    inReplyTo: {
      type: String, // RFC 5322 In-Reply-To
      default: null,
      index: true,
    },
    references: {
      type: [String],
      default: [],
    },
    providerMessageId: {
      type: String, // Native Gmail id or Graph id
      index: true,
    },

    folder: {
      type: String,
      enum: ['inbox', 'sent', 'drafts', 'scheduled', 'trash', 'archive'],
      default: 'inbox',
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'queued', 'sent', 'delivered', 'failed', 'received'],
      default: 'received',
      index: true,
    },

    // Sender & Recipients
    from: {
      type: emailRecipientSchema,
      required: true,
    },
    to: {
      type: [emailRecipientSchema],
      required: true,
      validate: [v => Array.isArray(v) && v.length > 0, 'At least one recipient is required in To'],
    },
    cc: {
      type: [emailRecipientSchema],
      default: [],
    },
    bcc: {
      type: [emailRecipientSchema],
      default: [],
    },
    replyTo: {
      type: String,
      default: null,
    },

    // Content
    subject: {
      type: String,
      trim: true,
      default: '(No Subject)',
    },
    snippet: {
      type: String,
      default: '',
    },
    bodyHtml: {
      type: String,
      default: '',
    },
    bodyText: {
      type: String,
      default: '',
    },

    // Metadata & Flags
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    isStarred: {
      type: Boolean,
      default: false,
      index: true,
    },
    hasAttachments: {
      type: Boolean,
      default: false,
    },
    attachments: {
      type: [emailAttachmentSchema],
      default: [],
    },
    scheduledAt: {
      type: Date,
      default: null,
      index: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    receivedAt: {
      type: Date,
      default: null,
    },
    date: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for rapid mailbox navigation and CRM queries
emailMessageSchema.index({ workspaceId: 1, accountId: 1, folder: 1, date: -1 });
emailMessageSchema.index({ workspaceId: 1, threadId: 1, date: 1 });
emailMessageSchema.index({ workspaceId: 1, leadId: 1, date: -1 });
emailMessageSchema.index({ workspaceId: 1, folder: 1, isRead: 1 });

module.exports = mongoose.models.EmailMessage || mongoose.model('EmailMessage', emailMessageSchema);
