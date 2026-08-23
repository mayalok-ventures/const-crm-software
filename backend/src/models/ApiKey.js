const mongoose = require('mongoose');

const ApiKeySchema = new mongoose.Schema(
  {
    keyId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organizationName: { type: String, default: 'Organization' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdByName: { type: String, default: 'Admin' },
    createdByEmail: { type: String, default: '' },
    keyPrefix: { type: String, required: true, index: true },
    keyHash: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'REVOKED', 'SUSPENDED'],
      default: 'ACTIVE',
      index: true,
    },
    permissions: [{ type: String, trim: true }],
    rateLimitPerMinute: { type: Number, default: 120 },
    ipWhitelist: [{ type: String, trim: true }],
    expiresAt: { type: Date, default: null, index: true },
    lastUsedAt: { type: Date, default: null, index: true },
    lastUsedIp: { type: String, default: '' },
    lastUsedUserAgent: { type: String, default: '' },
    lastUsedGeo: {
      country: { type: String, default: '' },
      city: { type: String, default: '' },
    },
    totalRequests: { type: Number, default: 0 },
    monthlyRequests: { type: Number, default: 0 },
    dailyRequests: { type: Number, default: 0 },
    failedAuthCount: { type: Number, default: 0 },
    rateLimitViolationsCount: { type: Number, default: 0 },
    unusualUsageScore: { type: Number, default: 0 },
    revokedAt: { type: Date, default: null },
    revokedBy: { type: String, default: '' },
    revocationReason: { type: String, default: '' },
    suspendedAt: { type: Date, default: null },
    suspensionReason: { type: String, default: '' },
    rotationHistory: [
      {
        rotatedAt: { type: Date, default: Date.now },
        previousPrefix: { type: String },
        gracePeriodEndsAt: { type: Date },
      },
    ],
  },
  { timestamps: true }
);

ApiKeySchema.index({ organizationId: 1, status: 1 });
ApiKeySchema.index({ expiresAt: 1, status: 1 });

const ApiKeyModel = mongoose.models.ApiKey || mongoose.model('ApiKey', ApiKeySchema);
ApiKeyModel.ApiKey = ApiKeyModel;
ApiKeyModel.default = ApiKeyModel;
module.exports = ApiKeyModel;
module.exports.ApiKey = ApiKeyModel;
module.exports.default = ApiKeyModel;
