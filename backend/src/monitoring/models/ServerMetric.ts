import mongoose, { Schema, Document } from 'mongoose';
import { IServerMetric } from '../types';

export interface IServerMetricDocument extends IServerMetric, Document {}

const ServerMetricSchema: Schema = new Schema({
  serverId: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true, index: true },
  cpu: {
    usagePercent: { type: Number, required: true },
    cores: { type: Number, required: true },
    loadAvg: { type: [Number], required: true },
  },
  ram: {
    totalBytes: { type: Number, required: true },
    usedBytes: { type: Number, required: true },
    freeBytes: { type: Number, required: true },
    usagePercent: { type: Number, required: true },
  },
  disk: {
    totalBytes: { type: Number, required: true },
    usedBytes: { type: Number, required: true },
    freeBytes: { type: Number, required: true },
    usagePercent: { type: Number, required: true },
  },
  network: {
    uploadBytesSec: { type: Number, required: true },
    downloadBytesSec: { type: Number, required: true },
  },
  process: {
    cpuPercent: { type: Number, required: true },
    memoryBytes: { type: Number, required: true },
    pm2Status: { type: String, required: true },
    pm2Restarts: { type: Number, required: true },
  },
  uptime: { type: Number, required: true },
  healthScore: { type: Number, required: true },
  isAggregated: { type: Boolean, default: false, index: true },
  aggregationType: {
    type: String,
    enum: ['raw', 'hourly', 'daily'],
    default: 'raw',
    index: true,
  },
});

// Compound index for fast time-series queries
ServerMetricSchema.index({ serverId: 1, timestamp: -1 });

export const ServerMetric = mongoose.models.ServerMetric || mongoose.model<IServerMetricDocument>('ServerMetric', ServerMetricSchema);
