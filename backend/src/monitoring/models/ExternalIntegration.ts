import mongoose, { Schema, Document } from 'mongoose';

export type IntegrationStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';

export interface IRecentFailure {
  timestamp: Date;
  error: string;
  statusCode?: number;
  latencyMs?: number;
}

export interface IHealthHistoryPoint {
  timestamp: Date;
  healthScore: number;
  status: IntegrationStatus;
  avgLatencyMs: number;
  errorRate: number;
  totalRequests: number;
}

export interface IAlertThresholds {
  errorRatePercent: number;
  maxLatencyMs: number;
  consecutiveFailures: number;
}

export interface IExternalIntegration extends Document {
  provider: string; // e.g. 'meta', 'whatsapp', 'email', 'sms', 'razorpay', 's3', 'redis'
  name: string; // e.g. 'Meta API', 'WhatsApp Business'
  service: string; // e.g. 'Graph API / Lead Ads', 'Cloud Webhooks'
  category: 'social' | 'messaging' | 'communication' | 'payment' | 'storage' | 'cache' | 'custom';
  status: IntegrationStatus;
  healthScore: number; // 0 - 100
  latency: number; // Moving average latency in ms
  p95Latency: number; // 95th percentile latency in ms
  successCount: number;
  failureCount: number;
  totalRequests: number;
  errorRate: number; // 0 - 100 percentage
  consecutiveFailures: number;
  lastSuccessfulRequest: Date | null;
  lastFailedRequest: Date | null;
  lastChecked: Date;
  lastError: {
    message: string;
    statusCode?: number;
    timestamp: Date;
  } | null;
  recentFailures: IRecentFailure[];
  healthHistory: IHealthHistoryPoint[];
  isConfigured: boolean;
  alertThresholds: IAlertThresholds;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

const RecentFailureSchema = new Schema<IRecentFailure>(
  {
    timestamp: { type: Date, default: Date.now },
    error: { type: String, required: true },
    statusCode: { type: Number },
    latencyMs: { type: Number, default: 0 },
  },
  { _id: false }
);

const HealthHistoryPointSchema = new Schema<IHealthHistoryPoint>(
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

const AlertThresholdsSchema = new Schema<IAlertThresholds>(
  {
    errorRatePercent: { type: Number, default: 10 },
    maxLatencyMs: { type: Number, default: 3000 },
    consecutiveFailures: { type: Number, default: 3 },
  },
  { _id: false }
);

const ExternalIntegrationSchema = new Schema<IExternalIntegration>(
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
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

export const ExternalIntegration =
  mongoose.models.ExternalIntegration ||
  mongoose.model<IExternalIntegration>('ExternalIntegration', ExternalIntegrationSchema);

export default ExternalIntegration;
