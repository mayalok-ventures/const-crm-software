import mongoose from 'mongoose';
import { IOrganizationUsage, ResourceThresholdStatus } from '../models/OrganizationUsage';
export interface FleetUsageSummary {
    totalOrganizations: number;
    totalStorageBytes: number;
    totalStorageFormatted: string;
    totalUsers: number;
    totalApiRequests: number;
    totalDatabaseRecords: number;
    nearLimitsCount: number;
    criticalBreachCount: number;
    warningBreachCount: number;
    limitReachedCount: number;
    topConsumers: {
        byStorage: any[];
        byUsers: any[];
        byApi: any[];
        byRecords: any[];
    };
    fastestGrowing: any[];
    nearLimits: any[];
    lastAggregatedAt: Date;
}
export declare class UsageAggregatorService {
    /**
     * Formats raw bytes into human readable string (GB, MB, KB)
     */
    static formatBytes(bytes: number): string;
    /**
     * Calculates threshold status based on percentage:
     * < 80% => NOMINAL
     * 80% - 89.9% => WARNING
     * 90% - 99.9% => CRITICAL
     * >= 100% => LIMIT_REACHED
     */
    static resolveThresholdStatus(percent: number): ResourceThresholdStatus;
    /**
     * Calculates resource health score (0-100)
     * Example: 72% used -> ~73% Storage Health
     */
    static calculateHealthScore(percent: number): number;
    /**
     * Resolves effective plan limits for an organization (with custom override support)
     */
    static resolveEffectiveLimits(orgId: mongoose.Types.ObjectId | string, planName: string): Promise<{
        storageLimitBytes: number;
        maxUsers: number;
        maxApiRequests: number;
        maxLeads: number;
        maxGroups: number;
        maxConcurrentCampaigns: number;
        maxMonthlyMessages: number;
        isCustomOverride: boolean;
    }>;
    /**
     * Evaluates alert thresholds and manages UsageAlert records
     */
    static processResourceAlert(orgId: mongoose.Types.ObjectId | string, orgName: string, ownerEmail: string, resourceType: 'storage' | 'users' | 'api' | 'leads' | 'messages', currentValue: number, limitValue: number, percent: number, currentFormatted?: string, limitFormatted?: string): Promise<void>;
    /**
     * Aggregates usage for a single organization user/owner
     */
    static aggregateSingleOrganization(orgUser: any): Promise<IOrganizationUsage | null>;
    /**
     * Aggregates usage across all organizations in the CRM
     */
    static aggregateAllOrganizations(): Promise<FleetUsageSummary>;
    /**
     * Returns pre-aggregated fleet summary, leaderboards, and near-limit organizations
     */
    static getFleetSummary(): Promise<FleetUsageSummary>;
}
export declare const usageAggregatorService: typeof UsageAggregatorService;
export default UsageAggregatorService;
