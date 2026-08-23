const mongoose = require('mongoose');

const DatabaseMetricSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now, required: true },
    pingLatencyMs: { type: Number, default: 0 },
    healthScore: { type: Number, default: 100 },
    activeConnections: { type: Number, default: 0 },
    dataSizeBytes: { type: Number, default: 0 },
    storageSizeBytes: { type: Number, default: 0 },
    indexSizeBytes: { type: Number, default: 0 },
    documentsCount: { type: Number, default: 0 },
    slowQueryCount: { type: Number, default: 0 },
    failedOpsCount: { type: Number, default: 0 },
    opsPerSec: { type: Number, default: 0 },
    isAggregated: { type: Boolean, default: false },
    aggregationType: {
      type: String,
      enum: ['raw', 'hourly', 'daily'],
      default: 'raw',
    },
  },
  { timestamps: true }
);

DatabaseMetricSchema.index({ timestamp: -1 });
DatabaseMetricSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports =
  mongoose.models.DatabaseMetric ||
  mongoose.model('DatabaseMetric', DatabaseMetricSchema);
