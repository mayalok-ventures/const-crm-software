"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityTracker = void 0;
const crypto_1 = __importDefault(require("crypto"));
const SecurityEvent_1 = require("../models/SecurityEvent");
const SecurityIncident_1 = require("../models/SecurityIncident");
const SecurityRule_1 = require("../models/SecurityRule");
const securitySanitizer_1 = require("./securitySanitizer");
const riskScoreEngine_1 = require("./riskScoreEngine");
const ipBlockerMiddleware_1 = require("./ipBlockerMiddleware");
const logger_1 = require("../logging/logger");
class SecurityTrackerEngine {
    eventWindow = [];
    rulesCache = [];
    isRulesLoaded = false;
    constructor() {
        this.loadRules();
        // Prune sliding window every 60 seconds
        setInterval(() => this.pruneWindow(), 60000);
    }
    async initDefaultRules() {
        try {
            const defaultRules = [
                {
                    ruleId: 'RULE_BRUTE_FORCE_LOGIN',
                    name: 'Brute Force Login Detector',
                    description: 'Detects multiple failed login attempts against accounts',
                    eventType: 'LOGIN_FAILED',
                    threshold: 5,
                    windowSeconds: 300,
                    action: 'FLAG_INCIDENT',
                    severity: 'HIGH',
                    isActive: true,
                    isConfigurable: true,
                },
                {
                    ruleId: 'RULE_OTP_ABUSE',
                    name: 'OTP Flooding & Abuse Detector',
                    description: 'Detects excessive invalid OTP submissions or rapid requests',
                    eventType: 'OTP_ABUSE',
                    threshold: 4,
                    windowSeconds: 300,
                    action: 'FLAG_INCIDENT',
                    severity: 'CRITICAL',
                    isActive: true,
                    isConfigurable: true,
                },
                {
                    ruleId: 'RULE_MASSIVE_RATE_LIMIT',
                    name: 'Massive API Flooding & Rate Limit Guard',
                    description: 'Auto-blocks IPs exceeding rate limits repeatedly',
                    eventType: 'RATE_LIMIT',
                    threshold: 20,
                    windowSeconds: 600,
                    action: 'AUTO_BLOCK_IP',
                    severity: 'HIGH',
                    isActive: true,
                    isConfigurable: true,
                },
                {
                    ruleId: 'RULE_TOKEN_TAMPERING',
                    name: 'JWT Tampering & Invalid Token Detector',
                    description: 'Flags clients sending forged or malformed authorization tokens',
                    eventType: 'TOKEN_INVALID',
                    threshold: 8,
                    windowSeconds: 300,
                    action: 'FLAG_INCIDENT',
                    severity: 'HIGH',
                    isActive: true,
                    isConfigurable: true,
                },
                {
                    ruleId: 'RULE_AUTHZ_VIOLATION',
                    name: 'Permission Escalation Attempt Guard',
                    description: 'Flags repeated attempts to access unauthorized tenant resources',
                    eventType: 'PERMISSION_DENIED',
                    threshold: 6,
                    windowSeconds: 300,
                    action: 'FLAG_INCIDENT',
                    severity: 'HIGH',
                    isActive: true,
                    isConfigurable: true,
                },
                {
                    ruleId: 'RULE_SUSPICIOUS_ANOMALY',
                    name: 'Suspicious API Pattern Interceptor',
                    description: 'Detects unusual request frequencies and destructive actions',
                    eventType: 'SUSPICIOUS_ACTIVITY',
                    threshold: 3,
                    windowSeconds: 300,
                    action: 'FLAG_INCIDENT',
                    severity: 'CRITICAL',
                    isActive: true,
                    isConfigurable: true,
                },
            ];
            for (const rule of defaultRules) {
                await SecurityRule_1.SecurityRule.findOneAndUpdate({ ruleId: rule.ruleId }, { $setOnInsert: rule }, { upsert: true, new: true });
            }
            await this.loadRules();
        }
        catch (err) {
            // DB might not be connected yet
        }
    }
    async loadRules() {
        try {
            this.rulesCache = (await SecurityRule_1.SecurityRule.find({ isActive: true }).lean());
            this.isRulesLoaded = true;
        }
        catch (err) {
            // fallback
        }
    }
    pruneWindow() {
        const now = Date.now();
        const cutoff = now - 15 * 60 * 1000; // Keep 15 minutes of sliding history
        this.eventWindow = this.eventWindow.filter((e) => e.timestamp > cutoff);
    }
    /**
     * Records a security event with sanitization, multi-factor risk calculation,
     * sliding window aggregation, and automated rule evaluation.
     */
    async recordEvent(params) {
        try {
            const clientIp = params.ip || params.req?.ip || params.req?.socket?.remoteAddress || '127.0.0.1';
            const userAgent = params.userAgent || params.req?.headers['user-agent'] || 'unknown';
            const endpoint = params.endpoint || params.req?.originalUrl || params.req?.url || '';
            const method = params.method || params.req?.method || 'POST';
            const sanitizedMeta = (0, securitySanitizer_1.sanitizeSecurityMetadata)(params.metadata || {});
            const now = Date.now();
            // Push to sliding window
            this.eventWindow.push({
                type: params.type,
                ip: clientIp,
                userId: params.userId || null,
                timestamp: now,
            });
            // Calculate recent velocity for multi-factor evaluation
            const recentWindow = now - 5 * 60 * 1000;
            const recentFailures = this.eventWindow.filter((e) => (e.ip === clientIp || (params.userId && e.userId === params.userId)) &&
                (e.type === 'LOGIN_FAILED' || e.type === 'OTP_ABUSE') &&
                e.timestamp > recentWindow).length;
            const recentRateLimits = this.eventWindow.filter((e) => e.ip === clientIp && e.type === 'RATE_LIMIT' && e.timestamp > recentWindow).length;
            // Multi-factor Risk Calculation
            const multiFactorContext = {
                type: params.type,
                userId: params.userId,
                tenantId: params.tenantId,
                ip: clientIp,
                userAgent,
                endpoint,
                recentFailuresCount: recentFailures,
                recentRateLimitsCount: recentRateLimits,
                isAdminUser: params.isAdminUser || false,
            };
            const { score, severity } = riskScoreEngine_1.RiskScoreEngine.calculateEventRisk(multiFactorContext);
            // Async DB write
            SecurityEvent_1.SecurityEvent.create({
                type: params.type,
                severity,
                userId: params.userId || null,
                userEmail: params.userEmail || null,
                tenantId: params.tenantId || null,
                ip: clientIp,
                userAgent,
                endpoint,
                method,
                riskScore: score,
                metadata: sanitizedMeta,
                timestamp: new Date(),
            }).catch((err) => {
                logger_1.logger.error(`Failed to persist SecurityEvent: ${err.message}`, { module: 'security' });
            });
            // Evaluate active rules against sliding window
            this.evaluateRules(params.type, clientIp, params.userId, params.userEmail, params.tenantId, sanitizedMeta, score);
        }
        catch (err) {
            logger_1.logger.error(`Error in security recordEvent: ${err.message}`, { module: 'security' });
        }
    }
    async evaluateRules(type, ip, userId, userEmail, tenantId, metadata, riskScore = 50) {
        if (!this.isRulesLoaded || this.rulesCache.length === 0) {
            await this.loadRules();
        }
        const matchingRules = this.rulesCache.filter((r) => r.eventType === type && r.isActive);
        for (const rule of matchingRules) {
            const windowStart = Date.now() - rule.windowSeconds * 1000;
            // Count occurrences in sliding window matching IP or UserId
            const count = this.eventWindow.filter((e) => e.type === type &&
                (e.ip === ip || (userId && e.userId === userId)) &&
                e.timestamp >= windowStart).length;
            if (count >= rule.threshold) {
                // Trigger Action
                if (rule.action === 'AUTO_BLOCK_IP') {
                    await ipBlockerMiddleware_1.ipBlocker.blockIp(ip, `Auto-blocked by rule [${rule.name}]: ${count} violations in ${rule.windowSeconds}s`, 'SYSTEM_AUTO', 120 // 2 hours
                    );
                    logger_1.logger.warn(`[SECURITY AUTO-BLOCK] IP ${ip} blocked by rule ${rule.ruleId}`, {
                        module: 'security',
                        metadata: { ip, ruleId: rule.ruleId, count },
                    });
                }
                // Create or update SecurityIncident
                await this.upsertIncident({
                    rule,
                    ip,
                    userId,
                    userEmail,
                    tenantId,
                    eventCount: count,
                    riskScore,
                    metadata,
                });
            }
        }
    }
    async upsertIncident(params) {
        try {
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const hashKey = crypto_1.default
                .createHash('md5')
                .update(`${params.rule.ruleId}-${params.ip}-${params.userId || 'anon'}`)
                .digest('hex')
                .slice(0, 8);
            const incidentId = `INC-${dateStr}-${hashKey}`.toUpperCase();
            const existing = await SecurityIncident_1.SecurityIncident.findOne({
                incidentId,
                status: { $in: ['OPEN', 'ACKNOWLEDGED'] },
            });
            if (existing) {
                existing.eventCount += 1;
                existing.lastSeen = new Date();
                existing.riskScore = Math.max(existing.riskScore, params.riskScore);
                if (params.metadata) {
                    existing.metadata = { ...existing.metadata, ...params.metadata };
                }
                await existing.save();
            }
            else {
                await SecurityIncident_1.SecurityIncident.create({
                    incidentId,
                    title: `Security Alert: ${params.rule.name}`,
                    description: `Rule [${params.rule.name}] triggered: ${params.eventCount} occurrences detected within ${params.rule.windowSeconds} seconds.`,
                    type: params.rule.eventType,
                    severity: params.rule.severity,
                    status: 'OPEN',
                    targetIp: params.ip,
                    targetUserId: params.userId || null,
                    targetUserEmail: params.userEmail || null,
                    targetTenantId: params.tenantId || null,
                    eventCount: params.eventCount,
                    firstSeen: new Date(),
                    lastSeen: new Date(),
                    triggerRuleId: params.rule.ruleId,
                    riskScore: params.riskScore,
                    metadata: params.metadata || {},
                    adminNotes: [],
                });
                logger_1.logger.warn(`[NEW SECURITY INCIDENT] ${incidentId} - ${params.rule.name} from IP: ${params.ip}`, {
                    module: 'security',
                    metadata: { incidentId, ruleId: params.rule.ruleId, ip: params.ip },
                });
            }
        }
        catch (err) {
            logger_1.logger.error(`Failed to upsert SecurityIncident: ${err.message}`, { module: 'security' });
        }
    }
}
exports.securityTracker = new SecurityTrackerEngine();
