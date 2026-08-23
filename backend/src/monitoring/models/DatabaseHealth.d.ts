import mongoose, { Document } from 'mongoose';
export interface IDatabaseHealth extends Document {
    connectionState: 'connected' | 'disconnected' | 'connecting' | 'disconnecting' | 'uninitialized';
    readyState: number;
    healthScore: number;
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'DOWN';
    pingLatencyMs: number;
    availabilityPercentage: number;
    slowQueryCount24h: number;
    failedOperations24h: number;
    databaseSize: {
        dataSizeBytes: number;
        storageSizeBytes: number;
        totalSizeBytes: number;
        formattedDataSize: string;
        formattedStorageSize: string;
    };
    totalDocuments: number;
    totalCollections: number;
    totalIndexes: number;
    totalIndexSizeBytes: number;
    connectionCount: {
        current: number;
        available: number;
        totalCreated: number;
        activePercent: number;
    };
    cluster: {
        isReplicaSet: boolean;
        setName: string;
        hosts: string[];
        primary: string;
        secondaryCount: number;
        standalone: boolean;
        storageEngine: string;
        version: string;
    };
    diagnostics: {
        mode: 'HEALTHY' | 'APP_ISSUE' | 'DB_DOWN' | 'NETWORK_FAILURE';
        message: string;
        lastTestedAt: Date;
    };
    scoreBreakdown: {
        availabilityScore: number;
        latencyScore: number;
        errorScore: number;
        resourceScore: number;
    };
    lastCheckedAt: Date;
    timestamp: Date;
}
export declare const DatabaseHealth: mongoose.Model<any, {}, {}, {}, any, any>;
export default DatabaseHealth;
