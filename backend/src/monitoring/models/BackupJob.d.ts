import mongoose, { Document, Types } from 'mongoose';
export type BackupStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'VERIFICATION_FAILED' | 'EXPIRED';
export type BackupJobType = 'FULL_SNAPSHOT' | 'INCREMENTAL' | 'OPLOG' | 'COLLECTION_EXPORT';
export interface IBackupJob extends Document {
    jobId: string;
    policyId?: Types.ObjectId;
    name: string;
    jobType: BackupJobType;
    lastRunAt?: Date;
    lastStatus: BackupStatus;
    nextScheduledAt?: Date;
    consecutiveFailures: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<any, {}, {}, {}, any, any>;
export default _default;
