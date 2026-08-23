import mongoose, { Document } from 'mongoose';
export type AlertMetricType = 'cpu' | 'ram' | 'disk' | 'api_5xx_rate' | 'p95_latency' | 'server_heartbeat' | 'database_status' | 'backup_status' | 'security_event_spike' | 'custom';
export type AlertOperatorType = '>' | '<' | '>=' | '<=' | '==' | 'rate_increase' | 'percentage_increase' | 'absence_data';
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
    channels: string[];
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
export interface IAlertRuleDocument extends IAlertRule, Document {
}
export declare const AlertRule: mongoose.Model<any, {}, {}, {}, any, any>;
export default AlertRule;
