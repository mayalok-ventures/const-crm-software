/**
 * BACKUP ANOMALY & INCIDENT DETECTOR
 * Evaluates active backup policies and records to detect:
 * 1. BACKUP_MISSED: Scheduled job window elapsed with no execution
 * 2. BACKUP_FAILED: Process crashed or was terminated
 * 3. BACKUP_TOO_OLD: Exceeded SLA age threshold
 * 4. VERIFICATION_FAILED: Corrupted archive, truncated stream, or header mismatch
 * 5. STORAGE_UNAVAILABLE: Destination storage unreachable
 * 6. CORRUPTED_CHECKSUM: Hash mismatch
 */
import { BackupIncidentType, IncidentSeverity } from '../models/BackupIncident';
import { IBackupRecord } from '../models/BackupRecord';
import { IBackupPolicy } from '../models/BackupPolicy';
import { IBackupJob } from '../models/BackupJob';
export interface AnomalyEvaluationContext {
    policies: IBackupPolicy[];
    jobs: IBackupJob[];
    latestRecord?: IBackupRecord | null;
    recentRecords: IBackupRecord[];
}
export interface DetectedAnomaly {
    type: BackupIncidentType;
    severity: IncidentSeverity;
    title: string;
    message: string;
    policyId?: any;
    backupId?: string;
    details: Record<string, any>;
}
export declare class BackupAnomalyDetector {
    private static instance;
    static getInstance(): BackupAnomalyDetector;
    /**
     * Evaluates current system state and returns detected anomalies
     */
    evaluateAnomalies(context: AnomalyEvaluationContext): DetectedAnomaly[];
    /**
     * Persists detected anomalies to MongoDB while de-duplicating existing open incidents
     */
    syncIncidents(anomalies: DetectedAnomaly[]): Promise<number>;
}
export declare const backupAnomalyDetector: BackupAnomalyDetector;
