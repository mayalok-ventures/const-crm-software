import mongoose, { Document } from 'mongoose';
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
export interface IIncidentDocument extends IIncident, Document {
}
export declare const Incident: mongoose.Model<any, {}, {}, {}, any, any>;
export default Incident;
