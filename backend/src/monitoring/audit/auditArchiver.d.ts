export interface ArchiveResult {
    archivedCount: number;
    cutoffDate: Date;
    integrityHash: string;
    partitionId: string;
}
export declare class AuditArchiver {
    /**
     * Archives audit records older than retentionDays
     * Calculates a SHA256 integrity digest of all records in the archive batch
     */
    static archiveOldLogs(retentionDays?: number): Promise<ArchiveResult>;
}
