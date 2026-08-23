import mongoose, { Document, Types } from 'mongoose';
import { BackupStatus } from './BackupJob';
export type VerificationStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED';
export interface IBackupRecord extends Document {
    backupId: string;
    jobId: string;
    policyId?: Types.ObjectId;
    status: BackupStatus;
    startedAt: Date;
    completedAt?: Date;
    durationMs?: number;
    sizeBytes: number;
    formattedSize: string;
    location: {
        target: string;
        path: string;
        bucket?: string;
        region?: string;
        isExternal: boolean;
    };
    checksum: {
        algorithm: string;
        value: string;
        verified: boolean;
    };
    verification: {
        status: VerificationStatus;
        fileHeaderValid: boolean;
        archiveIntegrityValid: boolean;
        decompressionTestValid: boolean;
        simulatedRestoreValid: boolean;
        verifiedAt?: Date;
        failureReason?: string;
        verifiedBy?: string;
    };
    retentionExpiresAt: Date;
    isRetained: boolean;
    metadata: {
        databaseName: string;
        collectionsCount: number;
        documentsCount: number;
        storageEngine: string;
        backupEngineVersion: string;
    };
    failureDetails?: {
        code: string;
        message: string;
    };
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<any, {}, {}, {}, any, any>;
export default _default;
