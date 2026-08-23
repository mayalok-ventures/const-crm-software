const mongoose = require('mongoose');

const NotificationChannelSchema = new mongoose.Schema(
  {
    channelId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ['WEBHOOK', 'SLACK', 'TELEGRAM', 'EMAIL', 'DISCORD', 'CUSTOM_HTTP'],
      index: true,
    },
    config: {
      webhookUrl: { type: String, default: '' },
      channelName: { type: String, default: '' },
      botToken: { type: String, default: '' },
      chatId: { type: String, default: '' },
      emailRecipients: [{ type: String }],
      customHeaders: { type: mongoose.Schema.Types.Mixed, default: {} },
      secretKey: { type: String, default: '' },
    },
    enabled: { type: Boolean, default: true, index: true },
    eventTypes: {
      type: [String],
      default: ['ALERT_TRIGGERED', 'ALERT_RESOLVED', 'INCIDENT_ESCALATED'],
    },
    minSeverity: {
      type: String,
      enum: ['INFO', 'WARNING', 'CRITICAL'],
      default: 'WARNING',
    },
  },
  { timestamps: true }
);

module.exports =
  mongoose.models.NotificationChannel || mongoose.model('NotificationChannel', NotificationChannelSchema);
