import mongoose, { Schema, Document } from 'mongoose';
import { IServerHeartbeat } from '../types';

export interface IServerHeartbeatDocument extends IServerHeartbeat, Document {}

const ServerHeartbeatSchema: Schema = new Schema({
  serverId: { type: String, required: true, index: true },
  applicationId: { type: String, required: true },
  environment: { type: String, required: true },
  timestamp: { type: Date, required: true, index: true },
  agentVersion: { type: String, required: true },
  healthStatus: {
    type: String,
    required: true,
    enum: ['ONLINE', 'DEGRADED', 'OFFLINE', 'UNKNOWN', 'MAINTENANCE'],
  },
  applicationVersion: { type: String, required: true },
  latencyMs: { type: Number, default: 0 },
});

export const ServerHeartbeat = mongoose.models.ServerHeartbeat || mongoose.model<IServerHeartbeatDocument>('ServerHeartbeat', ServerHeartbeatSchema);
