/**
 * BACKUP INTEGRITY & RESTORE VERIFICATION ENGINE
 * Multi-Tier Verification Protocol:
 * Tier 1: Magic Byte Binary Header Inspection (Gzip 0x1F 0x8B / Tar)
 * Tier 2: Cryptographic SHA-256 Digest Computation & Hash Validation
 * Tier 3: Decompression & Archive Stream Structural Test (zlib dry-run)
 * Tier 4: Metadata Catalog & Schema Restore Simulation
 */
export interface VerificationReport {
    overallPassed: boolean;
    fileHeaderValid: boolean;
    archiveIntegrityValid: boolean;
    decompressionTestValid: boolean;
    simulatedRestoreValid: boolean;
    computedChecksum: string;
    checksumMatch: boolean;
    failureReason?: string;
    verifiedAt: Date;
    steps: {
        stepIndex: number;
        name: string;
        status: 'PASSED' | 'FAILED';
        durationMs: number;
        details: string;
    }[];
}
export declare class BackupVerificationEngine {
    private static instance;
    static getInstance(): BackupVerificationEngine;
    /**
     * Tier 1: Magic byte binary header validator
     */
    verifyFileHeader(buffer: Buffer): boolean;
    /**
     * Tier 2: Cryptographic SHA-256 Hash Computation
     */
    computeSha256(buffer: Buffer): string;
    /**
     * Tier 3: Decompression & Stream Extraction Test
     */
    testDecompress(buffer: Buffer): {
        success: boolean;
        decompressedSize: number;
        error?: string;
    };
    /**
     * Tier 4: Metadata Catalog & Schema Dry-Run Restore Simulation
     */
    simulateRestoreCatalog(metadata: {
        databaseName?: string;
        collectionsCount?: number;
        documentsCount?: number;
        sizeBytes?: number;
    }): {
        success: boolean;
        reason?: string;
    };
    /**
     * Orchestrates the 4-Tier Verification Pipeline against an in-memory buffer or record
     */
    verifyBackupBuffer(buffer: Buffer, expectedChecksum?: string, metadata?: any): VerificationReport;
    /**
     * Helper to create a valid synthetic mock Gzip backup buffer for testing
     */
    createSampleGzipBackup(data?: string): Buffer;
}
export declare const backupVerificationEngine: BackupVerificationEngine;
