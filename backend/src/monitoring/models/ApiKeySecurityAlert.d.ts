import mongoose, { Document } from 'mongoose';
export type ApiKeyAlertType = 'UNUSUAL_IP_OR_GEO' | 'EXCESSIVE_REQUESTS' | 'EXPIRED_KEY_ATTEMPT' | 'REVOKED_KEY_ATTEMPT' | 'SUSPENDED_KEY_ATTEMPT' | 'RATE_LIMIT_SPIKE';
export type ApiKeyAlertSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export interface IApiKeySecurityAlert extends Document {
    alertId: string;
    keyId: string;
    keyName: string;
    keyPrefix: string;
    organizationId: mongoose.Types.ObjectId;
    organizationName: string;
    alertType: ApiKeyAlertType;
    severity: ApiKeyAlertSeverity;
    title: string;
    description: string;
    metadata: Record<string, any>;
    isResolved: boolean;
    resolvedAt?: Date | null;
    resolvedBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
declare const ApiKeySecurityAlert: mongoose.Model<any, {}, {}, {}, any, any>;
export default ApiKeySecurityAlert;
