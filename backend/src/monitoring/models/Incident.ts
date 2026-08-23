import mongoose, { Schema, Document } from 'mongoose';
import { IIncident } from '../types';

export interface IIncidentDocument extends IIncident, Document {}

const IncidentSchema: Schema = new Schema({
  serverId: { type: String, required: true, index: true },
  type: { type: String, required: true, enum: ['OFFLINE', 'DEGRADED'], index: true },
  startedAt: { type: Date, required: true, index: true },
  resolvedAt: { type: Date },
  durationMs: { type: Number },
  status: {
    type: String,
    required: true,
    enum: ['OPEN', 'RESOLVED'],
    default: 'OPEN',
    index: true,
  },
  events: [
    {
      status: { type: String, required: true },
      timestamp: { type: Date, required: true },
      reason: { type: String, required: true },
    },
  ],
});

export const Incident = mongoose.models.Incident || mongoose.model<IIncidentDocument>('Incident', IncidentSchema);
