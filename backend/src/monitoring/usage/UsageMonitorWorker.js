"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.usageMonitorWorker = exports.UsageMonitorWorker = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const OrganizationUsage_1 = __importDefault(require("../models/OrganizationUsage"));
const UsageSnapshot_1 = __importDefault(require("../models/UsageSnapshot"));
const UsageLimit_1 = __importDefault(require("../models/UsageLimit"));
const UsageAlert_1 = __importDefault(require("../models/UsageAlert"));
const usageAggregatorService_1 = require("./usageAggregatorService");
class UsageMonitorWorker {
    static instance;
    intervalTimer = null;
    intervalMs = 60000; // 60 seconds default
    isCollecting = false;
    latestFleetSummary = null;
    constructor() { }
    static getInstance() {
        if (!UsageMonitorWorker.instance) {
            UsageMonitorWorker.instance = new UsageMonitorWorker();
        }
        return UsageMonitorWorker.instance;
    }
    /**
     * Starts periodic aggregation worker
     */
    start(intervalMs = 60000) {
        this.intervalMs = intervalMs;
        console.log(`[UsageMonitorWorker] Starting background worker (Interval: ${this.intervalMs}ms)`);
        // Initial collection and seeding
        this.collect().catch((err) => {
            console.warn('[UsageMonitorWorker] Initial aggregation warning:', err.message);
        });
        if (this.intervalTimer)
            clearInterval(this.intervalTimer);
        this.intervalTimer = setInterval(() => {
            this.collect().catch((err) => {
                console.warn('[UsageMonitorWorker] Periodic aggregation warning:', err.message);
            });
        }, this.intervalMs);
    }
    /**
     * Stops background worker
     */
    stop() {
        if (this.intervalTimer) {
            clearInterval(this.intervalTimer);
            this.intervalTimer = null;
            console.log('[UsageMonitorWorker] Stopped background worker');
        }
    }
    /**
     * Executes aggregation cycle
     */
    async collect() {
        if (this.isCollecting) {
            if (this.latestFleetSummary)
                return this.latestFleetSummary;
            return usageAggregatorService_1.UsageAggregatorService.getFleetSummary();
        }
        this.isCollecting = true;
        try {
            // 1. Seed demo organizations if database has none
            await this.ensureSeedData();
            // 2. Run actual aggregation across existing organizations
            this.latestFleetSummary = await usageAggregatorService_1.UsageAggregatorService.aggregateAllOrganizations();
            return this.latestFleetSummary;
        }
        catch (err) {
            console.error('[UsageMonitorWorker] Error during usage collection:', err.message);
            if (!this.latestFleetSummary) {
                this.latestFleetSummary = await usageAggregatorService_1.UsageAggregatorService.getFleetSummary();
            }
            return this.latestFleetSummary;
        }
        finally {
            this.isCollecting = false;
        }
    }
    /**
     * Returns cached fleet summary instantly (<1ms)
     */
    async getSummary() {
        if (this.latestFleetSummary) {
            return this.latestFleetSummary;
        }
        return this.collect();
    }
    /**
     * Seeds demo multi-tenant organizations if none exist (matches user prompt requirements)
     */
    async ensureSeedData() {
        const existingCount = await OrganizationUsage_1.default.countDocuments();
        if (existingCount > 0)
            return;
        console.log('[UsageMonitorWorker] Seeding demo organizations and usage snapshots...');
        // 1. ABC Coaching (matches prompt example)
        // Storage: 7.2GB / 10GB 72%
        // Users: 81 / 100 81%
        // API: 82,000 / 100,000 82%
        // Storage Health: 73%, User Capacity: 81%, API Capacity: 82%
        const demoOrgs = [
            {
                organizationId: new mongoose_1.default.Types.ObjectId(),
                organizationName: 'ABC Coaching',
                ownerEmail: 'director@abccoaching.com',
                ownerName: 'Rajesh Sharma',
                plan: 'custom_enterprise',
                tierType: 'enterprise',
                storage: {
                    usedBytes: 7730941132, // 7.2 GB
                    usedFormatted: '7.2 GB',
                    limitBytes: 10737418240, // 10.0 GB
                    limitFormatted: '10.0 GB',
                    percent: 72.0,
                    fileCount: 3420,
                    healthScore: 73,
                    status: 'NOMINAL',
                },
                users: {
                    activeUsers: 81,
                    maxUsers: 100,
                    percent: 81.0,
                    capacityScore: 81.0,
                    status: 'WARNING',
                },
                apiRequests: {
                    currentMonthRequests: 82000,
                    maxRequests: 100000,
                    percent: 82.0,
                    capacityScore: 82.0,
                    status: 'WARNING',
                },
                databaseRecords: {
                    leadsCount: 42500,
                    maxLeads: 50000,
                    leadsPercent: 85.0,
                    groupsCount: 38,
                    maxGroups: 50,
                    totalRecords: 42538,
                    status: 'WARNING',
                },
                campaigns: {
                    activeCampaigns: 4,
                    maxConcurrent: 10,
                    totalCampaignsThisMonth: 28,
                    status: 'NOMINAL',
                },
                messages: {
                    whatsappSent: 68400,
                    smsSent: 8200,
                    emailSent: 4100,
                    totalMessages: 80700,
                    monthlyLimit: 100000,
                    percent: 80.7,
                    status: 'WARNING',
                },
                growthMetrics: {
                    storageGrowthRate: 14.8,
                    usersGrowthRate: 8.5,
                    recordsGrowthRate: 12.2,
                    apiGrowthRate: 15.0,
                    velocityScore: 88.5,
                },
                overallStatus: 'WARNING',
                nearLimitCount: 4,
                overallCapacityPercent: 85.0,
                lastAggregatedAt: new Date(),
            },
            {
                organizationId: new mongoose_1.default.Types.ObjectId(),
                organizationName: 'Apex Real Estate',
                ownerEmail: 'admin@apexrealty.in',
                ownerName: 'Vikram Mehta',
                plan: 'business',
                tierType: 'organization',
                storage: {
                    usedBytes: 24800000000, // 23.1 GB
                    usedFormatted: '23.1 GB',
                    limitBytes: 26843545600, // 25 GB
                    limitFormatted: '25.0 GB',
                    percent: 92.4,
                    fileCount: 8400,
                    healthScore: 12,
                    status: 'CRITICAL',
                },
                users: {
                    activeUsers: 9,
                    maxUsers: 10,
                    percent: 90.0,
                    capacityScore: 90.0,
                    status: 'CRITICAL',
                },
                apiRequests: {
                    currentMonthRequests: 235000,
                    maxRequests: 250000,
                    percent: 94.0,
                    capacityScore: 94.0,
                    status: 'CRITICAL',
                },
                databaseRecords: {
                    leadsCount: 48900,
                    maxLeads: 50000,
                    leadsPercent: 97.8,
                    groupsCount: 95,
                    maxGroups: 100,
                    totalRecords: 48995,
                    status: 'CRITICAL',
                },
                campaigns: {
                    activeCampaigns: 9,
                    maxConcurrent: 10,
                    totalCampaignsThisMonth: 64,
                    status: 'CRITICAL',
                },
                messages: {
                    whatsappSent: 94000,
                    smsSent: 4200,
                    emailSent: 1200,
                    totalMessages: 99400,
                    monthlyLimit: 100000,
                    percent: 99.4,
                    status: 'CRITICAL',
                },
                growthMetrics: {
                    storageGrowthRate: 22.4,
                    usersGrowthRate: 12.0,
                    recordsGrowthRate: 18.6,
                    apiGrowthRate: 25.0,
                    velocityScore: 94.2,
                },
                overallStatus: 'CRITICAL',
                nearLimitCount: 5,
                overallCapacityPercent: 99.4,
                lastAggregatedAt: new Date(),
            },
            {
                organizationId: new mongoose_1.default.Types.ObjectId(),
                organizationName: 'Global Edutech Group',
                ownerEmail: 'contact@globaledutech.com',
                ownerName: 'Ananya Roy',
                plan: 'enterprise',
                tierType: 'enterprise',
                storage: {
                    usedBytes: 107374182400, // 100 GB (Limit Reached)
                    usedFormatted: '100.0 GB',
                    limitBytes: 107374182400,
                    limitFormatted: '100.0 GB',
                    percent: 100.0,
                    fileCount: 42000,
                    healthScore: 0,
                    status: 'LIMIT_REACHED',
                },
                users: {
                    activeUsers: 25,
                    maxUsers: 25,
                    percent: 100.0,
                    capacityScore: 100.0,
                    status: 'LIMIT_REACHED',
                },
                apiRequests: {
                    currentMonthRequests: 1000000,
                    maxRequests: 1000000,
                    percent: 100.0,
                    capacityScore: 100.0,
                    status: 'LIMIT_REACHED',
                },
                databaseRecords: {
                    leadsCount: 154000,
                    maxLeads: 150000,
                    leadsPercent: 102.6,
                    groupsCount: 120,
                    maxGroups: 100,
                    totalRecords: 154120,
                    status: 'LIMIT_REACHED',
                },
                campaigns: {
                    activeCampaigns: 20,
                    maxConcurrent: 20,
                    totalCampaignsThisMonth: 180,
                    status: 'LIMIT_REACHED',
                },
                messages: {
                    whatsappSent: 480000,
                    smsSent: 15000,
                    emailSent: 10000,
                    totalMessages: 505000,
                    monthlyLimit: 500000,
                    percent: 101.0,
                    status: 'LIMIT_REACHED',
                },
                growthMetrics: {
                    storageGrowthRate: 35.0,
                    usersGrowthRate: 15.0,
                    recordsGrowthRate: 28.0,
                    apiGrowthRate: 30.0,
                    velocityScore: 99.0,
                },
                overallStatus: 'LIMIT_REACHED',
                nearLimitCount: 5,
                overallCapacityPercent: 102.6,
                lastAggregatedAt: new Date(),
            },
            {
                organizationId: new mongoose_1.default.Types.ObjectId(),
                organizationName: 'Prime Insurance Advisors',
                ownerEmail: 'support@primeinsurance.in',
                ownerName: 'Sunil Verma',
                plan: 'team_starter',
                tierType: 'organization',
                storage: {
                    usedBytes: 2362232012, // 2.2 GB
                    usedFormatted: '2.2 GB',
                    limitBytes: 10737418240, // 10 GB
                    limitFormatted: '10.0 GB',
                    percent: 22.0,
                    fileCount: 420,
                    healthScore: 89,
                    status: 'NOMINAL',
                },
                users: {
                    activeUsers: 2,
                    maxUsers: 3,
                    percent: 66.7,
                    capacityScore: 66.7,
                    status: 'NOMINAL',
                },
                apiRequests: {
                    currentMonthRequests: 18400,
                    maxRequests: 100000,
                    percent: 18.4,
                    capacityScore: 18.4,
                    status: 'NOMINAL',
                },
                databaseRecords: {
                    leadsCount: 3200,
                    maxLeads: 15000,
                    leadsPercent: 21.3,
                    groupsCount: 6,
                    maxGroups: 25,
                    totalRecords: 3206,
                    status: 'NOMINAL',
                },
                campaigns: {
                    activeCampaigns: 1,
                    maxConcurrent: 5,
                    totalCampaignsThisMonth: 12,
                    status: 'NOMINAL',
                },
                messages: {
                    whatsappSent: 6200,
                    smsSent: 1200,
                    emailSent: 800,
                    totalMessages: 8200,
                    monthlyLimit: 50000,
                    percent: 16.4,
                    status: 'NOMINAL',
                },
                growthMetrics: {
                    storageGrowthRate: 2.1,
                    usersGrowthRate: 0.0,
                    recordsGrowthRate: 4.2,
                    apiGrowthRate: 3.5,
                    velocityScore: 18.2,
                },
                overallStatus: 'NOMINAL',
                nearLimitCount: 0,
                overallCapacityPercent: 66.7,
                lastAggregatedAt: new Date(),
            },
        ];
        for (const org of demoOrgs) {
            await OrganizationUsage_1.default.create(org);
            // Create initial UsageLimit
            await UsageLimit_1.default.create({
                organizationId: org.organizationId,
                plan: org.plan,
                tierType: org.tierType,
                storageLimitBytes: org.storage.limitBytes,
                maxUsers: org.users.maxUsers,
                maxApiRequests: org.apiRequests.maxRequests,
                maxLeads: org.databaseRecords.maxLeads,
                maxGroups: org.databaseRecords.maxGroups,
                maxConcurrentCampaigns: org.campaigns.maxConcurrent,
                maxMonthlyMessages: org.messages.monthlyLimit,
                isCustomOverride: org.plan === 'custom_enterprise',
            });
            // Generate 14-day historical trend snapshots
            const now = Date.now();
            for (let day = 14; day >= 0; day--) {
                const factor = (14 - day) / 14;
                await UsageSnapshot_1.default.create({
                    organizationId: org.organizationId,
                    timestamp: new Date(now - day * 86400000),
                    granularity: 'daily',
                    storageUsedBytes: Math.floor(org.storage.usedBytes * (0.8 + factor * 0.2)),
                    storageLimitBytes: org.storage.limitBytes,
                    storagePercent: Number((org.storage.percent * (0.8 + factor * 0.2)).toFixed(1)),
                    fileCount: Math.floor(org.storage.fileCount * (0.8 + factor * 0.2)),
                    activeUsers: org.users.activeUsers,
                    maxUsers: org.users.maxUsers,
                    usersPercent: org.users.percent,
                    apiRequests: Math.floor(org.apiRequests.currentMonthRequests * (0.7 + factor * 0.3)),
                    maxApiRequests: org.apiRequests.maxRequests,
                    apiPercent: Number((org.apiRequests.percent * (0.7 + factor * 0.3)).toFixed(1)),
                    leadsCount: Math.floor(org.databaseRecords.leadsCount * (0.85 + factor * 0.15)),
                    maxLeads: org.databaseRecords.maxLeads,
                    leadsPercent: Number((org.databaseRecords.leadsPercent * (0.85 + factor * 0.15)).toFixed(1)),
                    totalRecords: Math.floor(org.databaseRecords.totalRecords * (0.85 + factor * 0.15)),
                    campaignsActive: org.campaigns.activeCampaigns,
                    messagesSent: Math.floor(org.messages.totalMessages * (0.7 + factor * 0.3)),
                });
            }
            // Seed sample threshold alerts
            if (org.storage.percent >= 80) {
                await UsageAlert_1.default.create({
                    alertId: `seed_alert_storage_${org.organizationId}`,
                    organizationId: org.organizationId,
                    organizationName: org.organizationName,
                    ownerEmail: org.ownerEmail,
                    resourceType: 'storage',
                    thresholdPercent: org.storage.percent >= 100 ? 100 : org.storage.percent >= 90 ? 90 : 80,
                    severity: org.storage.status === 'LIMIT_REACHED' ? 'LIMIT_REACHED' : org.storage.status === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
                    currentValue: org.storage.usedBytes,
                    currentFormatted: org.storage.usedFormatted,
                    limitValue: org.storage.limitBytes,
                    limitFormatted: org.storage.limitFormatted,
                    currentPercent: org.storage.percent,
                    message: `${org.organizationName} has reached ${org.storage.percent}% of Storage capacity (${org.storage.usedFormatted} / ${org.storage.limitFormatted}).`,
                    isAcknowledged: false,
                });
            }
            if (org.users.percent >= 80) {
                await UsageAlert_1.default.create({
                    alertId: `seed_alert_users_${org.organizationId}`,
                    organizationId: org.organizationId,
                    organizationName: org.organizationName,
                    ownerEmail: org.ownerEmail,
                    resourceType: 'users',
                    thresholdPercent: org.users.percent >= 100 ? 100 : org.users.percent >= 90 ? 90 : 80,
                    severity: org.users.status === 'LIMIT_REACHED' ? 'LIMIT_REACHED' : org.users.status === 'CRITICAL' ? 'CRITICAL' : 'WARNING',
                    currentValue: org.users.activeUsers,
                    currentFormatted: `${org.users.activeUsers} seats`,
                    limitValue: org.users.maxUsers,
                    limitFormatted: `${org.users.maxUsers} seats`,
                    currentPercent: org.users.percent,
                    message: `${org.organizationName} has reached ${org.users.percent}% of User Seats (${org.users.activeUsers} / ${org.users.maxUsers}).`,
                    isAcknowledged: false,
                });
            }
        }
        console.log('[UsageMonitorWorker] Seeded 4 standard multi-tenant demo organizations.');
    }
}
exports.UsageMonitorWorker = UsageMonitorWorker;
exports.usageMonitorWorker = UsageMonitorWorker.getInstance();
exports.default = exports.usageMonitorWorker;
