const mongoose = require('mongoose');

const SlowQueryMetricSchema = new mongoose.Schema(
  {
    collectionName: { type: String, required: true, index: true },
    operation: { type: String, required: true },
    durationMs: { type: Number, required: true, index: true },
    filter: { type: mongoose.Schema.Types.Mixed, default: {} },
    projection: { type: mongoose.Schema.Types.Mixed, default: {} },
    sort: { type: mongoose.Schema.Types.Mixed, default: {} },
    limit: { type: Number },
    planSummary: { type: String, default: '' },
    requestId: { type: String, index: true },
    clientIp: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

SlowQueryMetricSchema.index({ timestamp: -1 });
SlowQueryMetricSchema.index({ collectionName: 1, durationMs: -1 });
SlowQueryMetricSchema.index({ createdAt: 1 }, { expireAfterSeconds: 14 * 24 * 60 * 60 });

module.exports =
  mongoose.models.SlowQueryMetric ||
  mongoose.model('SlowQueryMetric', SlowQueryMetricSchema);
