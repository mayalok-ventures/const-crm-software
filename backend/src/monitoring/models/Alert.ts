import mongoose, { Schema, Document } from 'mongoose';
import { AlertSeverityType } from './AlertRule';

export type AlertLifecycleStatus = 'TRIGGERED' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SILENCED';

export interface IAlert {
  alertId: string;
  ruleId: string;
  incidentId?: string;
  title: string;
  metricName: string;
  metricValue: number | string;
  threshold: number | string;
  operator: string;
  severity: AlertSeverityType;
  status: AlertLifecycleStatus;
  fingerprint: string;
  targetResource: {
    type: string;
    identifier: string;
    name?: string;
  };
  triggeredAt: Date;
  acknowledgedAt?: Date | null;
  acknowledgedBy?: string;
  resolvedAt?: Date | null;
  resolvedBy?: string;
  silencedUntil?: Date | null;
  details?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAlertDocument extends IAlert, Document {}

const AlertSchema: Schema = new Schema(
  {
    alertId: { type: String, required: true, unique: true, index: true },
    ruleId: { type: String, required: true, index: true },
    incidentId: { type: String, index: true },
    title: { type: String, required: true },
    metricName: { type: String, required: true, index: true },
    metricValue: { type: Schema.Types.Mixed, required: true },
    threshold: { type: Schema.Types.Mixed, required: true },
    operator: { type: String, required: true },
    severity: {
      type: String,
      required: true,
      enum: ['CRITICAL', 'WARNING', 'INFO'],
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['TRIGGERED', 'ACKNOWLEDGED', 'RESOLVED', 'SILENCED'],
      default: 'TRIGGERED',
      index: true,
    },
    fingerprint: { type: String, required: true, index: true },
    targetResource: {
      type: { type: String, default: 'SERVER' },
      identifier: { type: String, default: 'default' },
      name: { type: String, default: '' },
    },
    triggeredAt: { type: Date, required: true, default: Date.now, index: true },
    acknowledgedAt: { type: Date, default: null },
    acknowledgedBy: { type: String, default: '' },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: '' },
    silencedUntil: { type: Date, default: null },
    details: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const Alert =
  mongoose.models.Alert || mongoose.model<IAlertDocument>('Alert', AlertSchema);
export default Alert;
