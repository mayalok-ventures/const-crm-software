import { DiagnosticResult } from './databaseDiagnostics';
export interface CollectionStatItem {
    name: string;
    documentCount: number;
    dataSizeBytes: number;
    storageSizeBytes: number;
    indexCount: number;
    indexSizeBytes: number;
    avgDocSizeBytes: number;
    formattedDataSize: string;
    formattedStorageSize: string;
    formattedIndexSize: string;
}
export interface CachedDatabaseState {
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
    diagnostics: DiagnosticResult;
    scoreBreakdown: {
        availabilityScore: number;
        latencyScore: number;
        errorScore: number;
        resourceScore: number;
    };
    collections: CollectionStatItem[];
    lastCheckedAt: Date;
}
export declare class DatabaseMonitorWorker {
    private static instance;
    private intervalTimer;
    private intervalMs;
    private isCollecting;
    private latestState;
    private pingHistory;
    private maxPingHistory;
    private constructor();
    static getInstance(): DatabaseMonitorWorker;
    start(intervalMs?: number): void;
    stop(): void;
    getLatestState(): CachedDatabaseState;
    formatBytes(bytes: number): string;
    private getFallbackState;
    pingLive(): Promise<{
        success: boolean;
        latencyMs: number;
        error?: string;
    }>;
    collect(): Promise<CachedDatabaseState>;
}
export declare const databaseMonitorWorker: DatabaseMonitorWorker;
export default databaseMonitorWorker;
