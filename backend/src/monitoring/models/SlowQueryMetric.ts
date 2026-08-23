import mongoose, { Document, Schema } from 'mongoose';

export interface ISlowQueryMetric extends Document {
  collectionName: string;
  operation: string;
  durationMs: number;
  filter?: Record<string, any>;
  projection?: Record<string, any>;
  sort?: Record<string, any>;
  limit?: number;
  planSummary?: string;
  requestId?: string;
  clientIp?: string;
  timestamp: Date;
}

const SlowQueryMetricSchema: Schema = new Schema(
  {
    collectionName: { type: String, required: true, index: true },
    operation: { type: String, required: true },
    durationMs: { type: Number, required: true, index: true },
    filter: { type: Schema.Types.Mixed, default: {} },
    projection: { type: Schema.Types.Mixed, default: {} },
    sort: { type: Schema.Types.Mixed, default: {} },
    limit: { type: Number },
    planSummary: { type: String, default: '' },
    requestId: { type: String, index: true },
    clientIp: { type: String },
    timestamp: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

// Indexes with 14-day TTL auto-purge
SlowQueryMetricSchema.index({ timestamp: -1 });
SlowQueryMetricSchema.index({ collectionName: 1, durationMs: -1 });
SlowQueryMetricSchema.index({ createdAt: 1 }, { expireAfterSeconds: 14 * 24 * 60 * 60 });

export default mongoose.models.SlowQueryMetric ||
  mongoose.model<ISlowQueryMetric>('SlowQueryMetric', SlowQueryMetricSchema);
