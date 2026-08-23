import mongoose, { Document, Schema } from 'mongoose';

export type DeploymentIncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DeploymentIncidentType =
  | 'ERROR_RATE_SPIKE'
  | 'LATENCY_SPIKE'
  | 'HEALTH_CHECK_FAILURE'
  | 'SMOKE_TEST_FAILURE'
  | 'CRASH_LOOP';

export interface IDeploymentIncident extends Document {
  incidentId: string;
  deploymentId: string;
  version: string;
  environment: string;
  severity: DeploymentIncidentSeverity;
  type: DeploymentIncidentType;
  title: string;
  description: string;
  metricsSnapshot: {
    baselineErrorRate?: number;
    currentErrorRate?: number;
    baselineLatencyMs?: number;
    currentLatencyMs?: number;
    failedChecksCount?: number;
  };
  isResolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolutionNotes?: string;
  suggestedAction?: 'ROLLBACK_RECOMMENDED' | 'INVESTIGATE_ERROR_LOGS' | 'RESTART_SERVICE';
  createdAt: Date;
  updatedAt: Date;
}

const DeploymentIncidentSchema = new Schema<IDeploymentIncident>(
  {
    incidentId: { type: String, required: true, unique: true, index: true },
    deploymentId: { type: String, required: true, index: true },
    version: { type: String, required: true, index: true },
    environment: { type: String, default: 'production', index: true },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'HIGH',
      index: true,
    },
    type: {
      type: String,
      enum: [
        'ERROR_RATE_SPIKE',
        'LATENCY_SPIKE',
        'HEALTH_CHECK_FAILURE',
        'SMOKE_TEST_FAILURE',
        'CRASH_LOOP',
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    metricsSnapshot: {
      baselineErrorRate: { type: Number, default: 0 },
      currentErrorRate: { type: Number, default: 0 },
      baselineLatencyMs: { type: Number, default: 0 },
      currentLatencyMs: { type: Number, default: 0 },
      failedChecksCount: { type: Number, default: 0 },
    },
    isResolved: { type: Boolean, default: false, index: true },
    resolvedAt: { type: Date },
    resolvedBy: { type: String },
    resolutionNotes: { type: String, default: '' },
    suggestedAction: {
      type: String,
      enum: ['ROLLBACK_RECOMMENDED', 'INVESTIGATE_ERROR_LOGS', 'RESTART_SERVICE'],
      default: 'INVESTIGATE_ERROR_LOGS',
    },
  },
  { timestamps: true }
);

DeploymentIncidentSchema.index({ environment: 1, isResolved: 1, createdAt: -1 });

export default mongoose.models.DeploymentIncident ||
  mongoose.model<IDeploymentIncident>('DeploymentIncident', DeploymentIncidentSchema);
