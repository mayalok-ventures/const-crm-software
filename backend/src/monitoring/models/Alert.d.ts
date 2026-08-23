import mongoose, { Document } from 'mongoose';
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
export interface IAlertDocument extends IAlert, Document {
}
export declare const Alert: mongoose.Model<any, {}, {}, {}, any, any>;
export default Alert;
