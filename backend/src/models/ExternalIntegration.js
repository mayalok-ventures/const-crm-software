const mongoose = require('mongoose');

const RecentFailureSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    error: { type: String, required: true },
    statusCode: { type: Number },
    latencyMs: { type: Number, default: 0 },
  },
  { _id: false }
);

const HealthHistoryPointSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    healthScore: { type: Number, required: true, min: 0, max: 100 },
    status: {
      type: String,
      enum: ['HEALTHY', 'DEGRADED', 'DOWN', 'UNKNOWN'],
      default: 'HEALTHY',
    },
    avgLatencyMs: { type: Number, default: 0 },
    errorRate: { type: Number, default: 0 },
    totalRequests: { type: Number, default: 0 },
  },
  { _id: false }
);

const AlertThresholdsSchema = new mongoose.Schema(
  {
    errorRatePercent: { type: Number, default: 10 },
    maxLatencyMs: { type: Number, default: 3000 },
    consecutiveFailures: { type: Number, default: 3 },
  },
  { _id: false }
);

const ExternalIntegrationSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    service: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      enum: ['social', 'messaging', 'communication', 'payment', 'storage', 'cache', 'custom'],
      default: 'custom',
      index: true,
    },
    status: {
      type: String,
      enum: ['HEALTHY', 'DEGRADED', 'DOWN', 'UNKNOWN'],
      default: 'UNKNOWN',
      index: true,
    },
    healthScore: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
      index: true,
    },
    latency: {
      type: Number,
      default: 0,
    },
    p95Latency: {
      type: Number,
      default: 0,
    },
    successCount: {
      type: Number,
      default: 0,
    },
    failureCount: {
      type: Number,
      default: 0,
    },
    totalRequests: {
      type: Number,
      default: 0,
    },
    errorRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    consecutiveFailures: {
      type: Number,
      default: 0,
    },
    lastSuccessfulRequest: {
      type: Date,
      default: null,
    },
    lastFailedRequest: {
      type: Date,
      default: null,
    },
    lastChecked: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastError: {
      message: { type: String },
      statusCode: { type: Number },
      timestamp: { type: Date },
    },
    recentFailures: {
      type: [RecentFailureSchema],
      default: [],
    },
    healthHistory: {
      type: [HealthHistoryPointSchema],
      default: [],
    },
    isConfigured: {
      type: Boolean,
      default: true,
    },
    alertThresholds: {
      type: AlertThresholdsSchema,
      default: () => ({
        errorRatePercent: 10,
        maxLatencyMs: 3000,
        consecutiveFailures: 3,
      }),
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

const ExternalIntegration =
  mongoose.models.ExternalIntegration ||
  mongoose.model('ExternalIntegration', ExternalIntegrationSchema);

module.exports = ExternalIntegration;
module.exports.ExternalIntegration = ExternalIntegration;
