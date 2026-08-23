import mongoose, { Schema, Document } from 'mongoose';
import { IServerStatusEvent } from '../types';

export interface IServerStatusEventDocument extends IServerStatusEvent, Document {}

const ServerStatusEventSchema: Schema = new Schema({
  serverId: { type: String, required: true, index: true },
  fromStatus: {
    type: String,
    required: true,
    enum: ['ONLINE', 'DEGRADED', 'OFFLINE', 'UNKNOWN', 'MAINTENANCE'],
  },
  toStatus: {
    type: String,
    required: true,
    enum: ['ONLINE', 'DEGRADED', 'OFFLINE', 'UNKNOWN', 'MAINTENANCE'],
  },
  timestamp: { type: Date, required: true, index: true },
  reason: { type: String, required: true },
  resolved: { type: Boolean, default: false },
  incidentId: { type: Schema.Types.ObjectId, ref: 'Incident', index: true },
});

export const ServerStatusEvent = mongoose.models.ServerStatusEvent || mongoose.model<IServerStatusEventDocument>('ServerStatusEvent', ServerStatusEventSchema);
