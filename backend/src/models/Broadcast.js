const mongoose = require('mongoose');

/**
 * Broadcast Schema
 * Platform Owner Broadcast and Internal Announcement Dispatcher.
 * Dispatches targeted messages to internal staff (Admins, Managers, Agents)
 * and external SaaS tenant organizations or individual users.
 */
const broadcastSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Broadcast title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    message: {
      type: String,
      required: [true, 'Broadcast message content is required'],
      trim: true,
    },
    priority: {
      type: String,
      required: true,
      enum: {
        values: ['LOW', 'NORMAL', 'HIGH', 'URGENT'],
        message: '{VALUE} is not a valid priority level',
      },
      default: 'NORMAL',
      index: true,
    },
    targetAudience: {
      type: String,
      required: [true, 'Target audience scope is required'],
      enum: {
        values: [
          'INTERNAL_ALL',
          'ALL_USERS',
          'PLATFORM_MANAGERS_AGENTS',
          'PLATFORM_MANAGERS_ONLY',
          'INTERNAL_MANAGERS',
          'PLATFORM_AGENTS_ONLY',
          'INTERNAL_AGENTS',
          'SOLO_USERS_ONLY',
          'ORGANISATIONS_ONLY',
          'PLATFORM_ALL_ORGS',
          'MY_TEAM_ONLY',
          'PLATFORM_SPECIFIC_ORG',
          'PLATFORM_SPECIFIC_USER',
        ],
        message: '{VALUE} is not a recognized broadcast audience target',
      },
      index: true,
    },
    targetIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: [],
      },
    ],
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author user ID is required'],
      index: true,
    },
    sentAt: {
      type: Date,
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['DRAFT', 'SENT', 'FAILED'],
        message: '{VALUE} is not a valid broadcast status',
      },
      default: 'DRAFT',
      index: true,
    },
    recipientCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    deliveryChannels: {
      type: [String],
      enum: ['IN_APP', 'EMAIL', 'WHATSAPP'],
      default: ['IN_APP'],
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

broadcastSchema.index({ status: 1, createdAt: -1 });
broadcastSchema.index({ targetAudience: 1, sentAt: -1 });

module.exports = mongoose.models.Broadcast || mongoose.model('Broadcast', broadcastSchema);
