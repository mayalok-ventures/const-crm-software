import mongoose, { Schema, Document } from 'mongoose';

export type AlertMetricType =
  | 'cpu'
  | 'ram'
  | 'disk'
  | 'api_5xx_rate'
  | 'p95_latency'
  | 'server_heartbeat'
  | 'database_status'
  | 'backup_status'
  | 'security_event_spike'
  | 'custom';

export type AlertOperatorType =
  | '>'
  | '<'
  | '>='
  | '<='
  | '=='
  | 'rate_increase'
  | 'percentage_increase'
  | 'absence_data';

export type AlertSeverityType = 'CRITICAL' | 'WARNING' | 'INFO';

export interface IAlertRule {
  ruleId: string;
  name: string;
  description: string;
  metric: AlertMetricType;
  operator: AlertOperatorType;
  threshold: number | string;
  durationSeconds: number;
  severity: AlertSeverityType;
  cooldownMinutes: number;
  channels: string[]; // NotificationChannel IDs or types
  targetResource: {
    type: 'SERVER' | 'API' | 'DATABASE' | 'BACKUP' | 'SECURITY' | 'ALL';
    identifier?: string;
  };
  isActive: boolean;
  silenceUntil?: Date | null;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAlertRuleDocument extends IAlertRule, Document {}

const AlertRuleSchema: Schema = new Schema(
  {
    ruleId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    metric: {
      type: String,
      required: true,
      index: true,
    },
    operator: {
      type: String,
      required: true,
      enum: ['>', '<', '>=', '<=', '==', 'rate_increase', 'percentage_increase', 'absence_data'],
    },
    threshold: { type: Schema.Types.Mixed, required: true },
    durationSeconds: { type: Number, default: 0 },
    severity: {
      type: String,
      required: true,
      enum: ['CRITICAL', 'WARNING', 'INFO'],
      default: 'WARNING',
      index: true,
    },
    cooldownMinutes: { type: Number, default: 15 },
    channels: [{ type: String }],
    targetResource: {
      type: { type: String, default: 'ALL' },
      identifier: { type: String, default: '*' },
    },
    isActive: { type: Boolean, default: true, index: true },
    silenceUntil: { type: Date, default: null },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const AlertRule =
  mongoose.models.AlertRule || mongoose.model<IAlertRuleDocument>('AlertRule', AlertRuleSchema);
export default AlertRule;
