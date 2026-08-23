const mongoose = require('mongoose');

const ComponentScoreSchema = new mongoose.Schema(
  {
    componentId: { type: String, required: true },
    name: { type: String, required: true },
    score: { type: Number, required: true, min: 0, max: 100 },
    status: {
      type: String,
      enum: ['EXCELLENT', 'HEALTHY', 'GOOD', 'WARNING', 'DEGRADED', 'CRITICAL'],
      required: true,
    },
    weight: { type: Number, required: true, min: 0, max: 1 },
    weightedScore: { type: Number, required: true },
    confidence: { type: Number, required: true, min: 0, max: 100 },
    metricsUsed: { type: mongoose.Schema.Types.Mixed, default: {} },
    deductions: [
      {
        metric: { type: String, required: true },
        penalty: { type: Number, required: true },
        reason: { type: String, required: true },
      },
    ],
    isStale: { type: Boolean, default: false },
    staleReason: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const PlatformHealthSnapshotSchema = new mongoose.Schema(
  {
    snapshotId: { type: String, required: true, unique: true, index: true },
    timestamp: { type: Date, default: Date.now },
    overallScore: { type: Number, required: true, min: 0, max: 100, index: true },
    overallStatus: {
      type: String,
      enum: ['EXCELLENT', 'HEALTHY', 'GOOD', 'WARNING', 'DEGRADED', 'CRITICAL'],
      required: true,
      index: true,
    },
    confidence: { type: Number, required: true, min: 0, max: 100 },
    confidenceWarning: { type: String, default: '' },
    isCircuitBreakerActive: { type: Boolean, default: false },
    circuitBreakerReason: { type: String, default: '' },
    components: [ComponentScoreSchema],
    topDeductions: [
      {
        component: { type: String, required: true },
        metric: { type: String, required: true },
        penalty: { type: Number, required: true },
        reason: { type: String, required: true },
      },
    ],
    systemContext: {
      activeIncidentsCount: { type: Number, default: 0 },
      activeAlertsCount: { type: Number, default: 0 },
      serversOnline: { type: Number, default: 1 },
      serversTotal: { type: Number, default: 1 },
      databaseStatus: { type: String, default: 'HEALTHY' },
      totalApiRequestsLastHour: { type: Number, default: 0 },
      errorRateLastHour: { type: Number, default: 0 },
    },
    calculatedInMs: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PlatformHealthSnapshotSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
PlatformHealthSnapshotSchema.index({ overallStatus: 1, timestamp: -1 });

const PlatformHealthSnapshot =
  mongoose.models.PlatformHealthSnapshot ||
  mongoose.model('PlatformHealthSnapshot', PlatformHealthSnapshotSchema);

module.exports = {
  PlatformHealthSnapshot,
  default: PlatformHealthSnapshot,
};
