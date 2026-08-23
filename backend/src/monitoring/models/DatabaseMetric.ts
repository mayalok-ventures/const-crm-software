import mongoose, { Document, Schema } from 'mongoose';

export interface IDatabaseMetric extends Document {
  timestamp: Date;
  pingLatencyMs: number;
  healthScore: number;
  activeConnections: number;
  dataSizeBytes: number;
  storageSizeBytes: number;
  indexSizeBytes: number;
  documentsCount: number;
  slowQueryCount: number;
  failedOpsCount: number;
  opsPerSec: number;
  isAggregated: boolean;
  aggregationType: 'raw' | 'hourly' | 'daily';
}

const DatabaseMetricSchema: Schema = new Schema(
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

// Indexes with 30-day TTL auto-purge
DatabaseMetricSchema.index({ timestamp: -1 });
DatabaseMetricSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.models.DatabaseMetric ||
  mongoose.model<IDatabaseMetric>('DatabaseMetric', DatabaseMetricSchema);
