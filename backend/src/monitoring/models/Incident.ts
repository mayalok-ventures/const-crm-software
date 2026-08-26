import mongoose, { Schema, Document } from 'mongoose';

export type IncidentSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'IDENTIFIED' | 'MONITORING' | 'RESOLVED';

export interface IIncidentTimelineEvent {
  timestamp: Date;
  event: string;
  description: string;
  actor?: string;
  metadata?: Record<string, any>;
}

export interface IIncident {
  incidentId: string;
  title: string;
  summary: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  startedAt: Date;
  triggeredAt?: Date;
  acknowledgedAt?: Date | null;
  resolvedAt?: Date | null;
  durationMs?: number;
  acknowledgedBy?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  rootCause?: string;
  trigger?: {
    metric: string;
    operator: string;
    threshold: any;
    value: any;
    ruleId?: string;
    alertId?: string;
  };
  affectedResources?: {
    serverId?: string;
    endpoint?: string;
    database?: string;
    service?: string;
    component?: string;
  };
  // Backward compatibility fields
  serverId?: string;
  type?: string;
  events?: Array<{
    status: string;
    timestamp: Date;
    reason: string;
  }>;
  relatedAlerts?: Array<{
    alertId: string;
    title: string;
    metricName: string;
    metricValue: any;
    severity: string;
    triggeredAt: Date;
  }>;
  relatedErrors?: Array<{
    errorGroupId?: string;
    name?: string;
    message?: string;
    count?: number;
    lastSeen?: Date;
  }>;
  relatedLogs?: Array<{
    logId?: string;
    level?: string;
    message?: string;
    timestamp?: Date;
    module?: string;
  }>;
  timeline: IIncidentTimelineEvent[];
  escalationLevel: number;
  lastNotifiedAt?: Date | null;
  fingerprint?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IIncidentDocument extends IIncident, Document {}

const IncidentSchema: Schema = new Schema(
  {
    incidentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      default: () => `inc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    },
    title: { type: String, required: true, default: 'System Incident' },
    summary: { type: String, default: '' },
    severity: {
      type: String,
      required: true,
      enum: ['CRITICAL', 'WARNING', 'INFO'],
      default: 'WARNING',
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: ['OPEN', 'INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED'],
      default: 'OPEN',
      index: true,
    },
    startedAt: { type: Date, required: true, default: Date.now, index: true },
    triggeredAt: { type: Date, default: Date.now },
    acknowledgedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    durationMs: { type: Number, default: 0 },
    acknowledgedBy: { type: String, default: '' },
    resolvedBy: { type: String, default: '' },
    resolutionNotes: { type: String, default: '' },
    rootCause: { type: String, default: '' },
    trigger: {
      metric: { type: String, default: '' },
      operator: { type: String, default: '' },
      threshold: { type: Schema.Types.Mixed, default: null },
      value: { type: Schema.Types.Mixed, default: null },
      ruleId: { type: String, default: '' },
      alertId: { type: String, default: '' },
    },
    affectedResources: {
      serverId: { type: String, default: '' },
      endpoint: { type: String, default: '' },
      database: { type: String, default: '' },
      service: { type: String, default: 'crm-backend' },
      component: { type: String, default: '' },
    },
    // Backward compatibility
    serverId: { type: String, index: true },
    type: { type: String, default: 'SYSTEM_ANOMALY', index: true },
    events: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, required: true },
        reason: { type: String, required: true },
      },
    ],
    relatedAlerts: [
      {
        alertId: { type: String },
        title: { type: String },
        metricName: { type: String },
        metricValue: { type: Schema.Types.Mixed },
        severity: { type: String },
        triggeredAt: { type: Date },
      },
    ],
    relatedErrors: [
      {
        errorGroupId: { type: String },
        name: { type: String },
        message: { type: String },
        count: { type: Number, default: 1 },
        lastSeen: { type: Date },
      },
    ],
    relatedLogs: [
      {
        logId: { type: String },
        level: { type: String },
        message: { type: String },
        timestamp: { type: Date },
        module: { type: String },
      },
    ],
    timeline: [
      {
        timestamp: { type: Date, required: true, default: Date.now },
        event: { type: String, required: true },
        description: { type: String, required: true },
        actor: { type: String, default: 'SYSTEM' },
        metadata: { type: Schema.Types.Mixed, default: {} },
      },
    ],
    escalationLevel: { type: Number, default: 1 },
    lastNotifiedAt: { type: Date, default: null },
    fingerprint: { type: String, index: true },
  },
  { timestamps: true }
);

// Compound indexes
IncidentSchema.index({ status: 1, severity: 1, startedAt: -1 });

export const Incident =
  mongoose.models.Incident || mongoose.model<IIncidentDocument>('Incident', IncidentSchema);
export default Incident;
