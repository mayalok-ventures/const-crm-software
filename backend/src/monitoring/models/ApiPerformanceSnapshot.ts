import mongoose, { Schema, Document } from 'mongoose';
import { IApiPerformanceSnapshot } from '../types';

export interface IApiPerformanceSnapshotDocument extends IApiPerformanceSnapshot, Document {}

const ApiPerformanceSnapshotSchema: Schema = new Schema({
  timestamp: { type: Date, required: true, index: true },
  timeRange: { type: String, required: true, enum: ['1h', '6h', '24h'], index: true },
  overallScore: { type: Number, required: true },
  latencyScore: { type: Number, required: true },
  reliabilityScore: { type: Number, required: true },
  errorRateScore: { type: Number, required: true },
  availabilityScore: { type: Number, required: true },
});

export const ApiPerformanceSnapshot = mongoose.models.ApiPerformanceSnapshot || mongoose.model<IApiPerformanceSnapshotDocument>('ApiPerformanceSnapshot', ApiPerformanceSnapshotSchema);
