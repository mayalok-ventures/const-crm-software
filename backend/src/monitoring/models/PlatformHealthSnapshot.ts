import mongoose, { Document, Schema } from 'mongoose';

export type HealthStatus = 'EXCELLENT' | 'HEALTHY' | 'GOOD' | 'WARNING' | 'DEGRADED' | 'CRITICAL';

export interface IComponentScore {
  componentId: string;
  name: string;
  score: number; // 0 - 100
  status: HealthStatus;
  weight: number; // 0 - 1
  weightedScore: number;
  confidence: number; // 0 - 100
  metricsUsed: Record<string, any>;
  deductions: Array<{
    metric: string;
    penalty: number;
    reason: string;
  }>;
  isStale?: boolean;
  staleReason?: string;
  timestamp: Date;
}

export interface IPlatformHealthSnapshot extends Document {
  snapshotId: string;
  timestamp: Date;
  overallScore: number; // 0 - 100
  overallStatus: HealthStatus;
  confidence: number; // 0 - 100
  confidenceWarning?: string;
  isCircuitBreakerActive: boolean;
  circuitBreakerReason?: string;
  components: IComponentScore[];
  topDeductions: Array<{
    component: string;
    metric: string;
    penalty: number;
    reason: string;
  }>;
  systemContext: {
    activeIncidentsCount: number;
    activeAlertsCount: number;
    serversOnline: number;
    serversTotal: number;
    databaseStatus: string;
    totalApiRequestsLastHour: number;
    errorRateLastHour: number;
  };
  calculatedInMs: number;
  createdAt: Date;
}

const ComponentScoreSchema = new Schema(
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
    metricsUsed: { type: Schema.Types.Mixed, default: {} },
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

const PlatformHealthSnapshotSchema = new Schema<IPlatformHealthSnapshot>(
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

// TTL index to automatically prune snapshots older than 90 days to maintain fast DB queries
PlatformHealthSnapshotSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90 * 24 * 3600 });
PlatformHealthSnapshotSchema.index({ overallStatus: 1, timestamp: -1 });

export const PlatformHealthSnapshot =
  mongoose.models.PlatformHealthSnapshot ||
  mongoose.model<IPlatformHealthSnapshot>('PlatformHealthSnapshot', PlatformHealthSnapshotSchema);

export default PlatformHealthSnapshot;
