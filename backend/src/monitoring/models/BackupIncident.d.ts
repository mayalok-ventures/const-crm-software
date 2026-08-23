import mongoose, { Document, Types } from 'mongoose';
export type BackupIncidentType = 'BACKUP_MISSED' | 'BACKUP_FAILED' | 'BACKUP_TOO_OLD' | 'VERIFICATION_FAILED' | 'STORAGE_UNAVAILABLE' | 'CORRUPTED_CHECKSUM';
export type IncidentSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
export type IncidentResolutionStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
export interface IBackupIncident extends Document {
    incidentId: string;
    type: BackupIncidentType;
    severity: IncidentSeverity;
    status: IncidentResolutionStatus;
    policyId?: Types.ObjectId;
    backupId?: string;
    title: string;
    message: string;
    details: Record<string, any>;
    detectedAt: Date;
    resolvedAt?: Date;
    resolvedBy?: string;
    resolutionNotes?: string;
    createdAt: Date;
    updatedAt: Date;
}
declare const _default: mongoose.Model<any, {}, {}, {}, any, any>;
export default _default;
