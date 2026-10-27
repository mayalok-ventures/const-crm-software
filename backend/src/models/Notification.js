const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      index: true,
    },
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      index: true,
    },
    leadName: {
      type: String,
      default: '',
    },
    title: {
      type: String,
      default: '',
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: [
        'follow_up',
        'follow_up_overdue',
        'wa_reply',
        'whatsapp_disconnect',
        'whatsapp_reconnect',
        'email_delivery_failed',
        'lead_assigned',
        'system',
        'system_alert',
        'platform_signup',
      ],
      default: 'follow_up',
      index: true,
    },
    priority: {
      type: String,
      enum: ['urgent', 'high', 'normal', 'low'],
      default: 'normal',
      index: true,
    },
    category: {
      type: String,
      enum: ['reminder', 'communication', 'system', 'lead'],
      default: 'reminder',
      index: true,
    },
    entityType: {
      type: String,
      enum: ['Lead', 'FollowUp', 'WhatsApp', 'Email', 'System'],
      default: 'Lead',
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    dueAt: {
      type: Date,
      default: null,
      index: true,
    },
    dedupKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    channels: {
      type: [String],
      enum: ['in_app', 'push', 'sse'],
      default: ['in_app', 'push', 'sse'],
    },
    deliveryStatus: {
      inApp: { type: String, enum: ['delivered', 'failed'], default: 'delivered' },
      push: { type: String, enum: ['pending', 'delivered', 'failed', 'skipped'], default: 'pending' },
      pushError: { type: String, default: null },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ workspaceId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, category: 1, isRead: 1 });

module.exports =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
