const mongoose = require('mongoose');

const NotificationDeliverySchema = new mongoose.Schema(
  {
    deliveryId: { type: String, required: true, unique: true, index: true },
    alertId: { type: String, index: true },
    incidentId: { type: String, index: true },
    channelId: { type: String, required: true, index: true },
    channelName: { type: String, default: '' },
    channelType: { type: String, required: true },
    eventType: { type: String, required: true, index: true },
    status: {
      type: String,
      required: true,
      enum: ['PENDING', 'DELIVERED', 'FAILED', 'RATE_LIMITED', 'SKIPPED'],
      default: 'PENDING',
      index: true,
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    responseCode: { type: Number },
    responseBody: { type: String },
    latencyMs: { type: Number, default: 0 },
    attempts: { type: Number, default: 1 },
    error: { type: String, default: '' },
    deliveredAt: { type: Date, default: null },
  },
  { timestamps: true }
);

NotificationDeliverySchema.index({ createdAt: -1 });

module.exports =
  mongoose.models.NotificationDelivery ||
  mongoose.model('NotificationDelivery', NotificationDeliverySchema);
