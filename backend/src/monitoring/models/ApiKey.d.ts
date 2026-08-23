import mongoose, { Document } from 'mongoose';
export type ApiKeyStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'SUSPENDED';
export interface IRotationRecord {
    rotatedAt: Date;
    previousPrefix: string;
    gracePeriodEndsAt?: Date;
}
export interface IApiKey extends Document {
    keyId: string;
    name: string;
    organizationId: mongoose.Types.ObjectId;
    organizationName: string;
    createdBy: mongoose.Types.ObjectId;
    createdByName?: string;
    createdByEmail?: string;
    keyPrefix: string;
    keyHash: string;
    status: ApiKeyStatus;
    permissions: string[];
    rateLimitPerMinute: number;
    ipWhitelist: string[];
    expiresAt?: Date | null;
    lastUsedAt?: Date | null;
    lastUsedIp?: string;
    lastUsedUserAgent?: string;
    lastUsedGeo?: {
        country?: string;
        city?: string;
    };
    totalRequests: number;
    monthlyRequests: number;
    dailyRequests: number;
    failedAuthCount: number;
    rateLimitViolationsCount: number;
    unusualUsageScore: number;
    revokedAt?: Date | null;
    revokedBy?: string;
    revocationReason?: string;
    suspendedAt?: Date | null;
    suspensionReason?: string;
    rotationHistory: IRotationRecord[];
    createdAt: Date;
    updatedAt: Date;
}
declare const ApiKey: mongoose.Model<any, {}, {}, {}, any, any>;
export default ApiKey;
