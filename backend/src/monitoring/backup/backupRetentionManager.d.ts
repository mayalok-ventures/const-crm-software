/**
 * BACKUP RETENTION POLICY MANAGER
 * Manages retention lifecycles:
 * - Scans records with expired retention windows (retentionExpiresAt <= now)
 * - Transitions status to 'EXPIRED' and updates isRetained = false
 * - Preserves compliance audit metadata while retiring stale backups
 */
export declare class BackupRetentionManager {
    private static instance;
    static getInstance(): BackupRetentionManager;
    /**
     * Evaluates and applies retention policies against stored backup records
     */
    pruneExpiredBackups(): Promise<{
        expiredCount: number;
        errors: string[];
    }>;
}
export declare const backupRetentionManager: BackupRetentionManager;
