import mongoose, { Document } from 'mongoose';
export interface IUsageLimit {
    organizationId: mongoose.Types.ObjectId | string;
    plan: string;
    tierType: string;
    storageLimitBytes: number;
    maxUsers: number;
    maxApiRequests: number;
    maxLeads: number;
    maxGroups: number;
    maxConcurrentCampaigns: number;
    maxMonthlyMessages: number;
    maxRecipientsPerCampaign: number;
    isCustomOverride: boolean;
    customOverrides?: Record<string, any>;
    notes?: string;
    updatedBy?: string;
}
export interface IUsageLimitDocument extends IUsageLimit, Document {
}
declare const _default: mongoose.Model<any, {}, {}, {}, any, any>;
export default _default;
