const mongoose = require('mongoose');

const ApiKeyUsageMetricSchema = new mongoose.Schema(
  {
    keyId: { type: String, required: true, index: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    timestamp: { type: Date, required: true, index: true },
    granularity: { type: String, enum: ['hourly', 'daily'], default: 'daily' },
    requestCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
    rateLimitHits: { type: Number, default: 0 },
    avgLatencyMs: { type: Number, default: 0 },
    topEndpoints: [
      {
        endpoint: { type: String },
        count: { type: Number },
      },
    ],
  },
  { timestamps: true }
);

ApiKeyUsageMetricSchema.index({ keyId: 1, timestamp: -1 });
ApiKeyUsageMetricSchema.index({ organizationId: 1, timestamp: -1 });

const ApiKeyUsageMetricModel = mongoose.models.ApiKeyUsageMetric || mongoose.model('ApiKeyUsageMetric', ApiKeyUsageMetricSchema);
ApiKeyUsageMetricModel.ApiKeyUsageMetric = ApiKeyUsageMetricModel;
ApiKeyUsageMetricModel.default = ApiKeyUsageMetricModel;
module.exports = ApiKeyUsageMetricModel;
module.exports.ApiKeyUsageMetric = ApiKeyUsageMetricModel;
module.exports.default = ApiKeyUsageMetricModel;
