import mongoose, { Document } from 'mongoose';
export interface IUsageSnapshot {
    organizationId: mongoose.Types.ObjectId | string;
    timestamp: Date;
    granularity: 'hourly' | 'daily';
    storageUsedBytes: number;
    storageLimitBytes: number;
    storagePercent: number;
    fileCount: number;
    activeUsers: number;
    maxUsers: number;
    usersPercent: number;
    apiRequests: number;
    maxApiRequests: number;
    apiPercent: number;
    leadsCount: number;
    maxLeads: number;
    leadsPercent: number;
    totalRecords: number;
    campaignsActive: number;
    messagesSent: number;
}
export interface IUsageSnapshotDocument extends IUsageSnapshot, Document {
}
declare const _default: mongoose.Model<any, {}, {}, {}, any, any>;
export default _default;
