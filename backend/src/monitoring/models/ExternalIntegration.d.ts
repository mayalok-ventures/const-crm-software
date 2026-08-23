import mongoose, { Document } from 'mongoose';
export type IntegrationStatus = 'HEALTHY' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';
export interface IRecentFailure {
    timestamp: Date;
    error: string;
    statusCode?: number;
    latencyMs?: number;
}
export interface IHealthHistoryPoint {
    timestamp: Date;
    healthScore: number;
    status: IntegrationStatus;
    avgLatencyMs: number;
    errorRate: number;
    totalRequests: number;
}
export interface IAlertThresholds {
    errorRatePercent: number;
    maxLatencyMs: number;
    consecutiveFailures: number;
}
export interface IExternalIntegration extends Document {
    provider: string;
    name: string;
    service: string;
    category: 'social' | 'messaging' | 'communication' | 'payment' | 'storage' | 'cache' | 'custom';
    status: IntegrationStatus;
    healthScore: number;
    latency: number;
    p95Latency: number;
    successCount: number;
    failureCount: number;
    totalRequests: number;
    errorRate: number;
    consecutiveFailures: number;
    lastSuccessfulRequest: Date | null;
    lastFailedRequest: Date | null;
    lastChecked: Date;
    lastError: {
        message: string;
        statusCode?: number;
        timestamp: Date;
    } | null;
    recentFailures: IRecentFailure[];
    healthHistory: IHealthHistoryPoint[];
    isConfigured: boolean;
    alertThresholds: IAlertThresholds;
    metadata?: Record<string, any>;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ExternalIntegration: mongoose.Model<any, {}, {}, {}, any, any>;
export default ExternalIntegration;
