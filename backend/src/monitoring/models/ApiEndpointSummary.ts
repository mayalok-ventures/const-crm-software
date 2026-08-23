import mongoose, { Schema, Document } from 'mongoose';
import { IApiEndpointSummary } from '../types';

export interface IApiEndpointSummaryDocument extends IApiEndpointSummary, Document {}

const ApiEndpointSummarySchema: Schema = new Schema({
  route: { type: String, required: true, index: true },
  method: { type: String, required: true },
  timeBucket: { type: Date, required: true, index: true },
  requests: { type: Number, required: true, default: 0 },
  avgResponseTime: { type: Number, required: true, default: 0 },
  p50: { type: Number, required: true, default: 0 },
  p75: { type: Number, required: true, default: 0 },
  p90: { type: Number, required: true, default: 0 },
  p95: { type: Number, required: true, default: 0 },
  p99: { type: Number, required: true, default: 0 },
  errorRate: { type: Number, required: true, default: 0 },
  errorsCount: { type: Number, required: true, default: 0 },
  statusCodes: { type: Schema.Types.Mixed, default: {} },
});

// Compound index for retrieval
ApiEndpointSummarySchema.index({ route: 1, method: 1, timeBucket: -1 });

export const ApiEndpointSummary = mongoose.models.ApiEndpointSummary || mongoose.model<IApiEndpointSummaryDocument>('ApiEndpointSummary', ApiEndpointSummarySchema);
