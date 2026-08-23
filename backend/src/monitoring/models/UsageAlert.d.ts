import mongoose, { Document } from 'mongoose';
export type UsageAlertSeverity = 'WARNING' | 'CRITICAL' | 'LIMIT_REACHED';
export type UsageResourceType = 'storage' | 'users' | 'api' | 'leads' | 'groups' | 'campaigns' | 'messages';
export interface IUsageAlert {
    alertId: string;
    organizationId: mongoose.Types.ObjectId | string;
    organizationName: string;
    ownerEmail?: string;
    resourceType: UsageResourceType;
    thresholdPercent: number;
    severity: UsageAlertSeverity;
    currentValue: number;
    currentFormatted?: string;
    limitValue: number;
    limitFormatted?: string;
    currentPercent: number;
    message: string;
    isAcknowledged: boolean;
    acknowledgedBy?: string;
    acknowledgedAt?: Date | null;
    resolvedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}
export interface IUsageAlertDocument extends IUsageAlert, Document {
}
declare const _default: mongoose.Model<any, {}, {}, {}, any, any>;
export default _default;
