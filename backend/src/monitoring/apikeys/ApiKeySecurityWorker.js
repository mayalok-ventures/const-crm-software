"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiKeySecurityWorker = exports.ApiKeySecurityWorker = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const ApiKey_1 = __importDefault(require("../models/ApiKey"));
const ApiKeyAuditLog_1 = __importDefault(require("../models/ApiKeyAuditLog"));
const ApiKeySecurityAlert_1 = __importDefault(require("../models/ApiKeySecurityAlert"));
const ApiKeyUsageMetric_1 = __importDefault(require("../models/ApiKeyUsageMetric"));
const apiKeyService_1 = require("./apiKeyService");
class ApiKeySecurityWorker {
    static instance;
    intervalId = null;
    isRunning = false;
    static getInstance() {
        if (!ApiKeySecurityWorker.instance) {
            ApiKeySecurityWorker.instance = new ApiKeySecurityWorker();
        }
        return ApiKeySecurityWorker.instance;
    }
    start(intervalMs = 60000) {
        if (this.isRunning)
            return;
        this.isRunning = true;
        console.log(`[ApiKeySecurityWorker] Starting background worker (Interval: ${intervalMs}ms)`);
        // Initial check & seeding
        this.runCycle().catch((err) => {
            console.error('[ApiKeySecurityWorker] Error in initial cycle:', err.message);
        });
        this.intervalId = setInterval(() => {
            this.runCycle().catch((err) => {
                console.error('[ApiKeySecurityWorker] Error in periodic cycle:', err.message);
            });
        }, intervalMs);
    }
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        this.isRunning = false;
        console.log('[ApiKeySecurityWorker] Stopped background worker');
    }
    async runCycle() {
        try {
            // 1. Auto-expire past-due keys
            const now = new Date();
            const expiredCount = await ApiKey_1.default.updateMany({
                status: 'ACTIVE',
                expiresAt: { $ne: null, $lt: now },
            }, { $set: { status: 'EXPIRED' } });
            if (expiredCount.modifiedCount > 0) {
                console.log(`[ApiKeySecurityWorker] Auto-expired ${expiredCount.modifiedCount} overdue API keys.`);
            }
            // 2. Ensure initial seed if database is empty
            const keyCount = await ApiKey_1.default.countDocuments();
            if (keyCount === 0) {
                console.log('[ApiKeySecurityWorker] Seeding realistic demo API keys and security alerts...');
                await this.seedDemoApiKeys();
            }
        }
        catch (err) {
            console.error('[ApiKeySecurityWorker] Cycle error:', err.message);
        }
    }
    /**
     * Seeds demo API keys with realistic multi-tenant usage, alerts, and historical metrics
     */
    async seedDemoApiKeys() {
        try {
            const demoKeys = [
                {
                    keyId: 'key_abc_zapier_sync',
                    name: 'ABC Coaching - Zapier Webhook Sync',
                    organizationName: 'ABC Coaching',
                    rawKey: 'crm_live_9f8a4b2c1d3e5f7a9b0c2d4e6f8a0b2c1d3e5f7a',
                    status: 'ACTIVE',
                    permissions: ['leads:read', 'leads:write', 'campaigns:read'],
                    rateLimitPerMinute: 120,
                    ipWhitelist: ['103.21.244.5', '103.21.244.6'],
                    expiresAt: new Date(Date.now() + 90 * 86400000), // 90 days
                    lastUsedAt: new Date(Date.now() - 2 * 60000), // 2 mins ago
                    lastUsedIp: '103.21.244.5',
                    lastUsedUserAgent: 'Zapier-Hook-Client/2.0',
                    totalRequests: 82400,
                    monthlyRequests: 82000,
                    dailyRequests: 2740,
                    rateLimitViolationsCount: 1,
                },
                {
                    keyId: 'key_apex_portal_ingest',
                    name: 'Apex Real Estate - Portal Lead Ingestion',
                    organizationName: 'Apex Real Estate',
                    rawKey: 'crm_live_7e2d4f6a8b0c1d3e5f7a9b1c3d5e7f9a1b3c5d7e',
                    status: 'ACTIVE',
                    permissions: ['leads:write', 'analytics:read'],
                    rateLimitPerMinute: 300,
                    ipWhitelist: [],
                    expiresAt: new Date(Date.now() + 180 * 86400000),
                    lastUsedAt: new Date(Date.now() - 1 * 60000),
                    lastUsedIp: '185.220.101.5',
                    lastUsedUserAgent: 'RealEstatePortalSync/1.4',
                    totalRequests: 235120,
                    monthlyRequests: 235000,
                    dailyRequests: 7800,
                    rateLimitViolationsCount: 8,
                },
                {
                    keyId: 'key_global_edutech_gateway',
                    name: 'Global Edutech - Mobile API Gateway',
                    organizationName: 'Global Edutech Group',
                    rawKey: 'crm_live_3a1b5c7d9e0f2a4b6c8d0e1f3a5b7c9d1e3f5a7b',
                    status: 'ACTIVE',
                    permissions: ['full_access'],
                    rateLimitPerMinute: 1000,
                    ipWhitelist: ['49.207.180.12', '49.207.180.13'],
                    expiresAt: null, // Never
                    lastUsedAt: new Date(Date.now() - 30 * 1000),
                    lastUsedIp: '49.207.180.12',
                    lastUsedUserAgent: 'MobileAppBackend/4.2.0',
                    totalRequests: 1000000,
                    monthlyRequests: 1000000,
                    dailyRequests: 33400,
                    rateLimitViolationsCount: 15,
                },
                {
                    keyId: 'key_prime_reporting_bi',
                    name: 'Prime Insurance - Custom Reporting BI Integration',
                    organizationName: 'Prime Insurance Advisors',
                    rawKey: 'crm_live_5c4e6a8b0d2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b',
                    status: 'ACTIVE',
                    permissions: ['analytics:read', 'leads:read'],
                    rateLimitPerMinute: 120,
                    ipWhitelist: [],
                    expiresAt: new Date(Date.now() + 60 * 86400000),
                    lastUsedAt: new Date(Date.now() - 10 * 60000),
                    lastUsedIp: '157.34.120.44',
                    lastUsedUserAgent: 'PowerBI-Collector/3.1',
                    totalRequests: 18400,
                    monthlyRequests: 18400,
                    dailyRequests: 620,
                    rateLimitViolationsCount: 0,
                },
                {
                    keyId: 'key_legacy_suspended',
                    name: 'Apex Real Estate - Legacy CRM Sync',
                    organizationName: 'Apex Real Estate',
                    rawKey: 'crm_live_1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e',
                    status: 'SUSPENDED',
                    permissions: ['leads:read', 'leads:write'],
                    rateLimitPerMinute: 60,
                    expiresAt: new Date(Date.now() + 30 * 86400000),
                    lastUsedAt: new Date(Date.now() - 48 * 3600000),
                    lastUsedIp: '194.26.29.112',
                    totalRequests: 5400,
                    monthlyRequests: 1200,
                    dailyRequests: 0,
                    suspendedAt: new Date(Date.now() - 24 * 3600000),
                    suspensionReason: 'Suspicious credential stuffing attempts from unknown subnet',
                    failedAuthCount: 7,
                },
                {
                    keyId: 'key_q1_campaign_expired',
                    name: 'Global Edutech - Q1 Marketing Agency Key',
                    organizationName: 'Global Edutech Group',
                    rawKey: 'crm_live_8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c',
                    status: 'EXPIRED',
                    permissions: ['campaigns:read', 'campaigns:write'],
                    rateLimitPerMinute: 120,
                    expiresAt: new Date(Date.now() - 5 * 86400000), // Expired 5 days ago
                    lastUsedAt: new Date(Date.now() - 6 * 86400000),
                    totalRequests: 42100,
                    monthlyRequests: 0,
                    dailyRequests: 0,
                    failedAuthCount: 4,
                },
                {
                    keyId: 'key_leaked_revoked',
                    name: 'ABC Coaching - Temporary Test Key',
                    organizationName: 'ABC Coaching',
                    rawKey: 'crm_live_0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b',
                    status: 'REVOKED',
                    permissions: ['leads:read'],
                    rateLimitPerMinute: 60,
                    expiresAt: null,
                    lastUsedAt: new Date(Date.now() - 14 * 86400000),
                    totalRequests: 950,
                    monthlyRequests: 0,
                    dailyRequests: 0,
                    revokedAt: new Date(Date.now() - 7 * 86400000),
                    revokedBy: 'Security Team',
                    revocationReason: 'Accidental commit to public GitHub repository',
                    failedAuthCount: 3,
                },
            ];
            for (const item of demoKeys) {
                const keyHash = apiKeyService_1.ApiKeyService.hashKey(item.rawKey);
                const keyPrefix = apiKeyService_1.ApiKeyService.maskKey(item.rawKey);
                const orgObjId = new mongoose_1.default.Types.ObjectId();
                await ApiKey_1.default.create({
                    keyId: item.keyId,
                    name: item.name,
                    organizationId: orgObjId,
                    organizationName: item.organizationName,
                    keyPrefix,
                    keyHash,
                    status: item.status,
                    permissions: item.permissions,
                    rateLimitPerMinute: item.rateLimitPerMinute,
                    ipWhitelist: item.ipWhitelist || [],
                    expiresAt: item.expiresAt,
                    lastUsedAt: item.lastUsedAt,
                    lastUsedIp: item.lastUsedIp || '',
                    lastUsedUserAgent: item.lastUsedUserAgent || 'CRM-Api-Client/1.0',
                    totalRequests: item.totalRequests,
                    monthlyRequests: item.monthlyRequests,
                    dailyRequests: item.dailyRequests,
                    rateLimitViolationsCount: item.rateLimitViolationsCount || 0,
                    failedAuthCount: item.failedAuthCount || 0,
                    suspendedAt: item.suspendedAt || null,
                    suspensionReason: item.suspensionReason || '',
                    revokedAt: item.revokedAt || null,
                    revokedBy: item.revokedBy || '',
                    revocationReason: item.revocationReason || '',
                    rotationHistory: [],
                });
                // Seed 14-day historical trend metrics for this key
                for (let d = 14; d >= 0; d--) {
                    const date = new Date();
                    date.setDate(date.getDate() - d);
                    date.setHours(0, 0, 0, 0);
                    const baseReq = Math.round((item.dailyRequests || 1000) * (0.8 + Math.random() * 0.4));
                    const baseErrors = Math.round(baseReq * 0.01);
                    const baseLatency = Math.round(35 + Math.random() * 25);
                    await ApiKeyUsageMetric_1.default.create({
                        keyId: item.keyId,
                        organizationId: orgObjId,
                        timestamp: date,
                        granularity: 'daily',
                        requestCount: baseReq,
                        successCount: baseReq - baseErrors,
                        errorCount: baseErrors,
                        rateLimitHits: Math.round((item.rateLimitViolationsCount || 0) / 10),
                        avgLatencyMs: baseLatency,
                        topEndpoints: [
                            { endpoint: '/api/leads', count: Math.round(baseReq * 0.7) },
                            { endpoint: '/api/campaigns', count: Math.round(baseReq * 0.2) },
                            { endpoint: '/api/analytics', count: Math.round(baseReq * 0.1) },
                        ],
                    });
                }
                // Seed Audit Logs
                await ApiKeyAuditLog_1.default.create({
                    auditId: `audit_${item.keyId}_create`,
                    keyId: item.keyId,
                    keyPrefix,
                    organizationId: orgObjId,
                    action: 'KEY_CREATED',
                    performedBy: 'Organization Admin',
                    createdAt: new Date(Date.now() - 30 * 86400000),
                    metadata: { name: item.name, permissions: item.permissions },
                });
            }
            // Seed Security Alerts
            await ApiKeySecurityAlert_1.default.create([
                {
                    alertId: `sec_alert_${Date.now()}_1`,
                    keyId: 'key_apex_portal_ingest',
                    keyName: 'Apex Real Estate - Portal Lead Ingestion',
                    keyPrefix: 'crm_live_7e2d...5d7e',
                    organizationId: new mongoose_1.default.Types.ObjectId(),
                    organizationName: 'Apex Real Estate',
                    alertType: 'UNUSUAL_IP_OR_GEO',
                    severity: 'HIGH',
                    title: 'Unusual IP Access Detected on "Portal Lead Ingestion"',
                    description: 'Key accessed from unfamiliar IP 185.220.101.5 (Known exit node). Previous regular IP: 103.21.244.5.',
                    metadata: { newIp: '185.220.101.5', previousIps: ['103.21.244.5'] },
                    isResolved: false,
                },
                {
                    alertId: `sec_alert_${Date.now()}_2`,
                    keyId: 'key_global_edutech_gateway',
                    keyName: 'Global Edutech - Mobile API Gateway',
                    keyPrefix: 'crm_live_3a1b...5a7b',
                    organizationId: new mongoose_1.default.Types.ObjectId(),
                    organizationName: 'Global Edutech Group',
                    alertType: 'RATE_LIMIT_SPIKE',
                    severity: 'MEDIUM',
                    title: 'Rate Limit Spike on "Mobile API Gateway"',
                    description: 'Key exceeded 1,000 req/min quota 15 times within the last hour.',
                    metadata: { limit: 1000, violationCount: 15 },
                    isResolved: false,
                },
                {
                    alertId: `sec_alert_${Date.now()}_3`,
                    keyId: 'key_q1_campaign_expired',
                    keyName: 'Global Edutech - Q1 Marketing Agency Key',
                    keyPrefix: 'crm_live_8b9c...6b7c',
                    organizationId: new mongoose_1.default.Types.ObjectId(),
                    organizationName: 'Global Edutech Group',
                    alertType: 'EXPIRED_KEY_ATTEMPT',
                    severity: 'HIGH',
                    title: 'Repeated Blocked Attempts on Expired Key',
                    description: 'Received 4 unauthorized API calls attempting to use an expired key from IP 192.0.2.45.',
                    metadata: { ip: '192.0.2.45', failedCount: 4 },
                    isResolved: false,
                },
            ]);
            console.log('[ApiKeySecurityWorker] Successfully seeded demo API keys, audit logs, and security alerts.');
        }
        catch (err) {
            console.error('[ApiKeySecurityWorker] Error seeding demo keys:', err.message);
        }
    }
}
exports.ApiKeySecurityWorker = ApiKeySecurityWorker;
exports.apiKeySecurityWorker = ApiKeySecurityWorker.getInstance();
exports.default = exports.apiKeySecurityWorker;
