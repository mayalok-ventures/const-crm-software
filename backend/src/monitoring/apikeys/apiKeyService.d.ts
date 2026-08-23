import mongoose from 'mongoose';
import { IApiKey } from '../models/ApiKey';
import { ApiKeyAuditAction } from '../models/ApiKeyAuditLog';
import { ApiKeyAlertType, ApiKeyAlertSeverity } from '../models/ApiKeySecurityAlert';
export interface IGenerateApiKeyParams {
    name: string;
    organizationId: string | mongoose.Types.ObjectId;
    organizationName?: string;
    createdBy?: string | mongoose.Types.ObjectId;
    createdByName?: string;
    createdByEmail?: string;
    permissions?: string[];
    rateLimitPerMinute?: number;
    ipWhitelist?: string[];
    expiresAt?: Date | null;
}
export interface IValidateKeyResult {
    valid: boolean;
    code?: string;
    message?: string;
    apiKey?: IApiKey;
    organizationId?: mongoose.Types.ObjectId;
    permissions?: string[];
}
export interface IRequestMetadata {
    ip?: string;
    userAgent?: string;
    endpoint?: string;
    method?: string;
    statusCode?: number;
    latencyMs?: number;
}
export declare class ApiKeyService {
    private static getSecretSalt;
    /**
     * Hashes raw API key using HMAC-SHA256
     */
    static hashKey(rawKey: string): string;
    /**
     * Generates a display mask for secret keys (e.g. crm_live_8f4a...4e1b)
     */
    static maskKey(rawKey: string): string;
    /**
     * Generates a high-entropy cryptographically secure API key
     */
    static generateApiKey(params: IGenerateApiKeyParams): Promise<{
        apiKey: IApiKey;
        rawKey: string;
    }>;
    /**
     * Validates an incoming raw API key against database hashes, expiration, suspension, rate limits, and IP whitelist
     */
    static validateApiKey(rawKey: string, meta?: IRequestMetadata): Promise<IValidateKeyResult>;
    /**
     * Rotates an API Key by issuing a new high-entropy token while preserving settings and logging rotation history
     */
    static rotateApiKey(keyId: string, performedByOrOpts?: string | {
        performedBy?: string;
        gracePeriodHours?: number;
    }, gracePeriodHours?: number): Promise<{
        apiKey: IApiKey;
        newRawKey: string;
    }>;
    /**
     * Revokes an API Key permanently
     */
    static revokeApiKey(keyId: string, performedByOrOpts?: string | {
        performedBy?: string;
        reason?: string;
    }, reasonParam?: string): Promise<IApiKey>;
    /**
     * Temporarily suspends an API Key
     */
    static suspendApiKey(keyId: string, performedByOrOpts?: string | {
        performedBy?: string;
        reason?: string;
    }, reasonParam?: string): Promise<IApiKey>;
    /**
     * Reactivates a suspended API Key
     */
    static reactivateApiKey(keyId: string, performedByOrOpts?: string | {
        performedBy?: string;
    }): Promise<IApiKey>;
    /**
     * Checks and enforces in-memory rate limit for a key
     */
    private static checkRateLimit;
    /**
     * Asynchronously updates usage telemetry and detects IP anomalies
     */
    private static recordSuccessfulUsage;
    /**
     * Records failed authentication and triggers security alerts for abuse
     */
    private static recordFailedAuth;
    /**
     * Logs an immutable audit log for API Key operations
     */
    static logAudit(params: {
        keyId: string;
        keyPrefix: string;
        organizationId: mongoose.Types.ObjectId;
        action: ApiKeyAuditAction;
        performedBy?: string;
        ipAddress?: string;
        userAgent?: string;
        metadata?: Record<string, any>;
    }): Promise<void>;
    /**
     * Triggers a dedicated API Key security alert
     */
    static triggerSecurityAlert(params: {
        keyId: string;
        keyName: string;
        keyPrefix: string;
        organizationId: mongoose.Types.ObjectId;
        organizationName: string;
        alertType: ApiKeyAlertType;
        severity: ApiKeyAlertSeverity;
        title: string;
        description: string;
        metadata?: Record<string, any>;
    }): Promise<void>;
    /**
     * Computes high-level fleet overview KPIs
     */
    static getFleetOverview(orgIdFilter?: string): Promise<any>;
}
export declare const apiKeyService: typeof ApiKeyService;
export default ApiKeyService;
