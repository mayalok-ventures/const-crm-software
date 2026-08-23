import mongoose, { Schema, Document } from 'mongoose';
import { IApiMetric } from '../types';

export interface IApiMetricDocument extends IApiMetric, Document {}

const ApiMetricSchema: Schema = new Schema({
  route: { type: String, required: true, index: true },
  method: { type: String, required: true },
  statusCode: { type: Number, required: true },
  responseTime: { type: Number, required: true },
  timestamp: { type: Date, required: true, index: true },
  requestId: { type: String, required: true, unique: true },
  serverId: { type: String, required: true, index: true },
  organizationId: { type: String, index: true },
  environment: { type: String, required: true },
});

// Compound index for aggregations
ApiMetricSchema.index({ route: 1, timestamp: -1 });

export const ApiMetric = mongoose.models.ApiMetric || mongoose.model<IApiMetricDocument>('ApiMetric', ApiMetricSchema);
