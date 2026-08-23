import mongoose, { Schema, Document } from 'mongoose';
import { IServer } from '../types';

export interface IServerDocument extends IServer, Document {}

const ServerSchema: Schema = new Schema(
  {
    serverId: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, index: true },
    name: { type: String, required: true },
    hostname: { type: String, required: true },
    environment: { type: String, required: true, index: true },
    status: {
      type: String,
      required: true,
      enum: ['ONLINE', 'DEGRADED', 'OFFLINE', 'UNKNOWN', 'MAINTENANCE'],
      default: 'UNKNOWN',
      index: true,
    },
    lastHeartbeat: { type: Date },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    nodeVersion: { type: String, required: true },
    os: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    healthScore: { type: Number, default: 100 },
    uptimePercentage: { type: Number, default: 100 },
    availabilityPercentage: { type: Number, default: 100 },
  },
  { timestamps: true }
);

export const Server = mongoose.models.Server || mongoose.model<IServerDocument>('Server', ServerSchema);
