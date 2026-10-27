const mongoose = require('mongoose');

/**
 * Harmonized Template Schema
 * Fully backward-compatible with legacy WhatsApp controller (title, text, imageFile, etc.)
 * while providing first-class support for rich multi-channel Email & SMS templates.
 */
const templateSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
      default: null,
    },
    // Multi-tenant or user ownership
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },

    // Name / Title harmonization
    title: {
      type: String,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      index: true,
    },

    // Communication Channel
    channel: {
      type: String,
      enum: ['WHATSAPP', 'EMAIL', 'SMS', 'whatsapp', 'email', 'sms'],
      default: 'WHATSAPP',
      uppercase: true,
      index: true,
    },

    // Email-specific Subject
    subject: {
      type: String,
      trim: true,
      default: '',
    },

    // Text & Rich Content harmonization
    text: {
      type: String,
      trim: true,
    },
    content: {
      type: String,
      trim: true,
    },
    bodyHtml: {
      type: String,
      default: '',
    },

    category: {
      type: String,
      default: 'general',
      trim: true,
      index: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    variables: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    usageCount: {
      type: Number,
      default: 0,
    },

    // Attachments & Media (WhatsApp / Email attachments)
    mediaUrl: {
      type: String,
      default: null,
      trim: true,
    },
    imageFile: {
      filename: String,
      originalName: String,
      size: Number,
      mimetype: String,
      url: String,
    },
    videoFile: {
      filename: String,
      originalName: String,
      size: Number,
      mimetype: String,
      url: String,
    },
    docFile: {
      filename: String,
      originalName: String,
      size: Number,
      mimetype: String,
      url: String,
    },
  },
  {
    timestamps: true,
  }
);

// Harmonize field aliases before validation and saving
templateSchema.pre('validate', function (next) {
  // Title <-> Name
  if (!this.title && this.name) {
    this.title = this.name;
  } else if (!this.name && this.title) {
    this.name = this.title;
  }

  // Text <-> Content
  if (!this.text && this.content) {
    this.text = this.content;
  } else if (!this.content && this.text) {
    this.content = this.text;
  }

  // UserId <-> CreatedBy
  if (!this.userId && this.createdBy) {
    this.userId = this.createdBy;
  } else if (!this.createdBy && this.userId) {
    this.createdBy = this.userId;
  }

  // Enforce fallback title if completely empty
  if (!this.title && !this.name) {
    this.title = 'Untitled Template';
    this.name = 'Untitled Template';
  }

  // Enforce fallback content if empty
  if (!this.text && !this.content) {
    this.text = '';
    this.content = '';
  }

  // Extract {{variable}} tags automatically from content / text / subject / bodyHtml
  const combined = `${this.subject || ''} ${this.text || ''} ${this.content || ''} ${this.bodyHtml || ''}`;
  const matches = combined.match(/{{\s*([a-zA-Z0-9_]+)\s*}}/g);
  if (matches) {
    this.variables = [...new Set(matches.map(m => m.replace(/[{}]/g, '').trim()))];
  }

  next();
});

templateSchema.index({ workspaceId: 1, channel: 1, isActive: 1 });
templateSchema.index({ userId: 1, channel: 1 });

module.exports = mongoose.models.Template || mongoose.model('Template', templateSchema);
