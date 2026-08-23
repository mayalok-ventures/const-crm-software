import mongoose, { Document } from 'mongoose';
export type DeploymentIncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DeploymentIncidentType = 'ERROR_RATE_SPIKE' | 'LATENCY_SPIKE' | 'HEALTH_CHECK_FAILURE' | 'SMOKE_TEST_FAILURE' | 'CRASH_LOOP';
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
declare const _default: mongoose.Model<any, {}, {}, {}, any, any>;
export default _default;
