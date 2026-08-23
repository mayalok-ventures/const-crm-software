import mongoose, { Document } from 'mongoose';
export type HealthStatus = 'EXCELLENT' | 'HEALTHY' | 'GOOD' | 'WARNING' | 'DEGRADED' | 'CRITICAL';
export interface IComponentScore {
    componentId: string;
    name: string;
    score: number;
    status: HealthStatus;
    weight: number;
    weightedScore: number;
    confidence: number;
    metricsUsed: Record<string, any>;
    deductions: Array<{
        metric: string;
        penalty: number;
        reason: string;
    }>;
    isStale?: boolean;
    staleReason?: string;
    timestamp: Date;
}
export interface IPlatformHealthSnapshot extends Document {
    snapshotId: string;
    timestamp: Date;
    overallScore: number;
    overallStatus: HealthStatus;
    confidence: number;
    confidenceWarning?: string;
    isCircuitBreakerActive: boolean;
    circuitBreakerReason?: string;
    components: IComponentScore[];
    topDeductions: Array<{
        component: string;
        metric: string;
        penalty: number;
        reason: string;
    }>;
    systemContext: {
        activeIncidentsCount: number;
        activeAlertsCount: number;
        serversOnline: number;
        serversTotal: number;
        databaseStatus: string;
        totalApiRequestsLastHour: number;
        errorRateLastHour: number;
    };
    calculatedInMs: number;
    createdAt: Date;
}
export declare const PlatformHealthSnapshot: mongoose.Model<any, {}, {}, {}, any, any>;
export default PlatformHealthSnapshot;
