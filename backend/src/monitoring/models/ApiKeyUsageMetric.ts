import mongoose, { Document, Schema } from 'mongoose';

export interface IApiKeyUsageMetric extends Document {
  keyId: string;
  organizationId: mongoose.Types.ObjectId;
  timestamp: Date;
  granularity: 'hourly' | 'daily';
  requestCount: number;
  successCount: number;
  errorCount: number;
  rateLimitHits: number;
  avgLatencyMs: number;
  topEndpoints: {
    endpoint: string;
    count: number;
  }[];
}

const ApiKeyUsageMetricSchema = new Schema<IApiKeyUsageMetric>(
  {
    keyId: { type: String, required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
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

const ApiKeyUsageMetric =
  mongoose.models.ApiKeyUsageMetric ||
  mongoose.model<IApiKeyUsageMetric>('ApiKeyUsageMetric', ApiKeyUsageMetricSchema);
export default ApiKeyUsageMetric;
