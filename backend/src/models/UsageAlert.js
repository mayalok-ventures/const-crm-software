const mongoose = require('mongoose');

const UsageAlertSchema = new mongoose.Schema(
  {
    alertId: { type: String, required: true, unique: true, index: true },
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    organizationName: { type: String, required: true },
    ownerEmail: { type: String, default: '' },
    resourceType: {
      type: String,
      enum: ['storage', 'users', 'api', 'leads', 'groups', 'campaigns', 'messages'],
      required: true,
      index: true,
    },
    thresholdPercent: { type: Number, required: true }, // 80, 90, 100
    severity: {
      type: String,
      enum: ['WARNING', 'CRITICAL', 'LIMIT_REACHED'],
      required: true,
      index: true,
    },

    currentValue: { type: Number, required: true },
    currentFormatted: { type: String, default: '' },
    limitValue: { type: Number, required: true },
    limitFormatted: { type: String, default: '' },
    currentPercent: { type: Number, required: true },

    message: { type: String, required: true },
    isAcknowledged: { type: Boolean, default: false, index: true },
    acknowledgedBy: { type: String, default: null },
    acknowledgedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

UsageAlertSchema.index({ organizationId: 1, resourceType: 1, resolvedAt: 1 });
UsageAlertSchema.index({ severity: 1, isAcknowledged: 1, createdAt: -1 });

module.exports = mongoose.models.UsageAlert ||
  mongoose.model('UsageAlert', UsageAlertSchema);
