/**
 * BACKUP HEALTH SCORE CALCULATOR
 * Composite 0-100% Reliability Score based on:
 * 1. Timeliness / Recency (35%): Age of last verified successful backup vs policy SLA
 * 2. Integrity Verification (35%): Checksum matching + archive decompression + dry-run restore validation
 * 3. Execution Success Rate (20%): Successful runs vs failed/missed runs in 30-day window
 * 4. Storage Redundancy (10%): External offsite cloud compliance (e.g. AWS S3 / GCS)
 */
export interface BackupScoreInput {
    lastSuccessfulBackupAgeHours: number | null;
    policyMaxAgeHours: number;
    totalBackups30d: number;
    successfulBackups30d: number;
    verifiedBackups30d: number;
    failedBackups30d: number;
    openCriticalIncidentsCount: number;
    isExternalStorage: boolean;
    lastBackupVerified: boolean;
    lastBackupStatus: string;
}
export interface BackupScoreResult {
    score: number;
    status: 'OPTIMAL' | 'GOOD' | 'DEGRADED' | 'CRITICAL';
    breakdown: {
        recencyScore: number;
        verificationScore: number;
        successRateScore: number;
        redundancyScore: number;
    };
    summary: string;
}
export declare function calculateBackupHealthScore(input: BackupScoreInput): BackupScoreResult;
