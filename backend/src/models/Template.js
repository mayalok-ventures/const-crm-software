const mongoose = require('mongoose');

/**
 * Template Schema
 * Standardized message scripting repository supporting WhatsApp, Email, and SMS with dynamic variables.
 */
const templateSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      index: true,
    },
    channel: {
      type: String,
      required: [true, 'Communication channel is required'],
      enum: {
        values: ['WHATSAPP', 'EMAIL', 'SMS'],
        message: '{VALUE} is not a valid channel. Must be WHATSAPP, EMAIL, or SMS',
      },
      uppercase: true,
      index: true,
    },
    content: {
      type: String,
      required: [true, 'Template content text is required'],
      trim: true,
    },
    category: {
      type: String,
      default: 'GENERAL',
      trim: true,
      uppercase: true,
      index: true,
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
    mediaUrl: {
      type: String,
      default: null,
      trim: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author user ID is required'],
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook: Automatically extract dynamic {{variable}} tags from content
templateSchema.pre('save', function (next) {
  if (this.content) {
    const matches = this.content.match(/{{\s*([a-zA-Z0-9_]+)\s*}}/g);
    if (matches) {
      this.variables = [...new Set(matches.map(m => m.replace(/[{}]/g, '').trim()))];
    }
  }
  next();
});

templateSchema.index({ channel: 1, isActive: 1, category: 1 });

module.exports = mongoose.models.Template || mongoose.model('Template', templateSchema);
