const mongoose = require('mongoose');

const ApiKeySecurityAlertSchema = new mongoose.Schema(
  {
    alertId: { type: String, required: true, unique: true, index: true },
    keyId: { type: String, required: true, index: true },
    keyName: { type: String, required: true },
    keyPrefix: { type: String, required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationName: { type: String, default: 'Organization' },
    alertType: {
      type: String,
      enum: [
        'UNUSUAL_IP_OR_GEO',
        'EXCESSIVE_REQUESTS',
        'EXPIRED_KEY_ATTEMPT',
        'REVOKED_KEY_ATTEMPT',
        'SUSPENDED_KEY_ATTEMPT',
        'RATE_LIMIT_SPIKE',
      ],
      required: true,
      index: true,
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      index: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    isResolved: { type: Boolean, default: false, index: true },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: '' },
  },
  { timestamps: true }
);

ApiKeySecurityAlertSchema.index({ organizationId: 1, isResolved: 1, createdAt: -1 });

const ApiKeySecurityAlertModel = mongoose.models.ApiKeySecurityAlert || mongoose.model('ApiKeySecurityAlert', ApiKeySecurityAlertSchema);
ApiKeySecurityAlertModel.ApiKeySecurityAlert = ApiKeySecurityAlertModel;
ApiKeySecurityAlertModel.default = ApiKeySecurityAlertModel;
module.exports = ApiKeySecurityAlertModel;
module.exports.ApiKeySecurityAlert = ApiKeySecurityAlertModel;
module.exports.default = ApiKeySecurityAlertModel;
