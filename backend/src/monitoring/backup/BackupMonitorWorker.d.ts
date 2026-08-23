/**
 * BACKUP MONITOR WORKER
 * 60-second background telemetry engine:
 * - Maintains zero-overhead in-memory cache for instant dashboard retrieval
 * - Seeds default policies and baseline verification records
 * - Evaluates SLA deadlines, detects anomalies, and syncs incidents
 * - Executes retention lifecycle pruning
 */
export interface CachedBackupDashboardState {
    healthScore: number;
    status: 'OPTIMAL' | 'GOOD' | 'DEGRADED' | 'CRITICAL';
    summary: string;
    scoreBreakdown: {
        recencyScore: number;
        verificationScore: number;
        successRateScore: number;
        redundancyScore: number;
    };
    lastBackup: {
        backupId: string;
        completedAt: Date;
        timeFormatted: string;
        status: string;
        verified: boolean;
        verificationStatus: string;
        sizeFormatted: string;
        sizeBytes: number;
        durationMs: number;
        location: {
            target: string;
            path: string;
            bucket: string;
            region: string;
            isExternal: boolean;
        };
        checksum: {
            algorithm: string;
            value: string;
            verified: boolean;
        };
    };
    stats: {
        totalBackups30d: number;
        successfulBackups30d: number;
        verifiedBackups30d: number;
        failedBackups30d: number;
        activePoliciesCount: number;
        openIncidentsCount: number;
        totalStorageBytes: number;
        formattedTotalStorage: string;
    };
    policies: any[];
    recentHistory: any[];
    openIncidents: any[];
    lastCheckedAt: Date;
}
export declare class BackupMonitorWorker {
    private static instance;
    private intervalTimer;
    private intervalMs;
    private isCollecting;
    private latestState;
    private constructor();
    static getInstance(): BackupMonitorWorker;
    start(intervalMs?: number): void;
    stop(): void;
    getLatestState(): CachedBackupDashboardState;
    private getFallbackState;
    /**
     * Seeds default policies and baseline snapshot if empty
     */
    seedDefaultPolicies(): Promise<void>;
    /**
     * Main collector routine
     */
    collect(): Promise<CachedBackupDashboardState>;
    /**
     * Executes an on-demand manual backup with full 4-tier verification
     */
    executeManualBackup(options: {
        name?: string;
        target?: string;
        initiatedBy?: string;
    }): Promise<{
        success: boolean;
        record: any;
        verification: any;
    }>;
}
export declare const backupMonitorWorker: BackupMonitorWorker;
