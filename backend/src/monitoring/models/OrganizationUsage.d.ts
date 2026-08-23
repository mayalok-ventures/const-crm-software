import mongoose, { Document } from 'mongoose';
export type ResourceThresholdStatus = 'NOMINAL' | 'WARNING' | 'CRITICAL' | 'LIMIT_REACHED';
export interface IResourceStorageUsage {
    usedBytes: number;
    usedFormatted: string;
    limitBytes: number;
    limitFormatted: string;
    percent: number;
    fileCount: number;
    healthScore: number;
    status: ResourceThresholdStatus;
}
export interface IResourceUsersUsage {
    activeUsers: number;
    maxUsers: number;
    percent: number;
    capacityScore: number;
    status: ResourceThresholdStatus;
}
export interface IResourceApiUsage {
    currentMonthRequests: number;
    maxRequests: number;
    percent: number;
    capacityScore: number;
    status: ResourceThresholdStatus;
}
export interface IResourceDatabaseUsage {
    leadsCount: number;
    maxLeads: number;
    leadsPercent: number;
    groupsCount: number;
    maxGroups: number;
    totalRecords: number;
    status: ResourceThresholdStatus;
}
export interface IResourceCampaignUsage {
    activeCampaigns: number;
    maxConcurrent: number;
    totalCampaignsThisMonth: number;
    status: ResourceThresholdStatus;
}
export interface IResourceMessageUsage {
    whatsappSent: number;
    smsSent: number;
    emailSent: number;
    totalMessages: number;
    monthlyLimit: number;
    percent: number;
    status: ResourceThresholdStatus;
}
export interface IResourceGrowthMetrics {
    storageGrowthRate: number;
    usersGrowthRate: number;
    recordsGrowthRate: number;
    apiGrowthRate: number;
    velocityScore: number;
}
export interface IOrganizationUsage {
    organizationId: mongoose.Types.ObjectId | string;
    organizationName: string;
    ownerEmail: string;
    ownerName?: string;
    plan: string;
    tierType: 'organization' | 'individual' | 'free' | 'enterprise';
    storage: IResourceStorageUsage;
    users: IResourceUsersUsage;
    apiRequests: IResourceApiUsage;
    databaseRecords: IResourceDatabaseUsage;
    campaigns: IResourceCampaignUsage;
    messages: IResourceMessageUsage;
    growthMetrics: IResourceGrowthMetrics;
    overallStatus: ResourceThresholdStatus;
    nearLimitCount: number;
    overallCapacityPercent: number;
    lastAggregatedAt: Date;
    metadata?: Record<string, any>;
    createdAt?: Date;
    updatedAt?: Date;
}
export interface IOrganizationUsageDocument extends IOrganizationUsage, Document {
}
declare const _default: mongoose.Model<any, {}, {}, {}, any, any>;
export default _default;
