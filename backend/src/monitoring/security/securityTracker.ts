import { Request } from 'express';
import crypto from 'crypto';
import { SecurityEvent, SecurityEventType, SecuritySeverity } from '../models/SecurityEvent';
import { SecurityIncident, IncidentStatus } from '../models/SecurityIncident';
import { SecurityRule, ISecurityRule } from '../models/SecurityRule';
import { sanitizeSecurityMetadata } from './securitySanitizer';
import { RiskScoreEngine, MultiFactorContext } from './riskScoreEngine';
import { ipBlocker } from './ipBlockerMiddleware';
import { logger } from '../logging/logger';

interface SlidingWindowRecord {
  type: SecurityEventType;
  ip: string;
  userId?: string | null;
  timestamp: number;
}

class SecurityTrackerEngine {
  private eventWindow: SlidingWindowRecord[] = [];
  private rulesCache: ISecurityRule[] = [];
  private isRulesLoaded = false;

  constructor() {
    this.loadRules();
    // Prune sliding window every 60 seconds
    setInterval(() => this.pruneWindow(), 60000);
  }

  public async initDefaultRules(): Promise<void> {
    try {
      const defaultRules = [
        {
          ruleId: 'RULE_BRUTE_FORCE_LOGIN',
          name: 'Brute Force Login Detector',
          description: 'Detects multiple failed login attempts against accounts',
          eventType: 'LOGIN_FAILED' as SecurityEventType,
          threshold: 5,
          windowSeconds: 300,
          action: 'FLAG_INCIDENT' as const,
          severity: 'HIGH' as SecuritySeverity,
          isActive: true,
          isConfigurable: true,
        },
        {
          ruleId: 'RULE_OTP_ABUSE',
          name: 'OTP Flooding & Abuse Detector',
          description: 'Detects excessive invalid OTP submissions or rapid requests',
          eventType: 'OTP_ABUSE' as SecurityEventType,
          threshold: 4,
          windowSeconds: 300,
          action: 'FLAG_INCIDENT' as const,
          severity: 'CRITICAL' as SecuritySeverity,
          isActive: true,
          isConfigurable: true,
        },
        {
          ruleId: 'RULE_MASSIVE_RATE_LIMIT',
          name: 'Massive API Flooding & Rate Limit Guard',
          description: 'Auto-blocks IPs exceeding rate limits repeatedly',
          eventType: 'RATE_LIMIT' as SecurityEventType,
          threshold: 20,
          windowSeconds: 600,
          action: 'AUTO_BLOCK_IP' as const,
          severity: 'HIGH' as SecuritySeverity,
          isActive: true,
          isConfigurable: true,
        },
        {
          ruleId: 'RULE_TOKEN_TAMPERING',
          name: 'JWT Tampering & Invalid Token Detector',
          description: 'Flags clients sending forged or malformed authorization tokens',
          eventType: 'TOKEN_INVALID' as SecurityEventType,
          threshold: 8,
          windowSeconds: 300,
          action: 'FLAG_INCIDENT' as const,
          severity: 'HIGH' as SecuritySeverity,
          isActive: true,
          isConfigurable: true,
        },
        {
          ruleId: 'RULE_AUTHZ_VIOLATION',
          name: 'Permission Escalation Attempt Guard',
          description: 'Flags repeated attempts to access unauthorized tenant resources',
          eventType: 'PERMISSION_DENIED' as SecurityEventType,
          threshold: 6,
          windowSeconds: 300,
          action: 'FLAG_INCIDENT' as const,
          severity: 'HIGH' as SecuritySeverity,
          isActive: true,
          isConfigurable: true,
        },
        {
          ruleId: 'RULE_SUSPICIOUS_ANOMALY',
          name: 'Suspicious API Pattern Interceptor',
          description: 'Detects unusual request frequencies and destructive actions',
          eventType: 'SUSPICIOUS_ACTIVITY' as SecurityEventType,
          threshold: 3,
          windowSeconds: 300,
          action: 'FLAG_INCIDENT' as const,
          severity: 'CRITICAL' as SecuritySeverity,
          isActive: true,
          isConfigurable: true,
        },
      ];

      for (const rule of defaultRules) {
        await SecurityRule.findOneAndUpdate(
          { ruleId: rule.ruleId },
          { $setOnInsert: rule },
          { upsert: true, new: true }
        );
      }

      await this.loadRules();
    } catch (err: any) {
      // DB might not be connected yet
    }
  }

  public async loadRules(): Promise<void> {
    try {
      this.rulesCache = (await SecurityRule.find({ isActive: true }).lean()) as any;
      this.isRulesLoaded = true;
    } catch (err) {
      // fallback
    }
  }

  private pruneWindow(): void {
    const now = Date.now();
    const cutoff = now - 15 * 60 * 1000; // Keep 15 minutes of sliding history
    this.eventWindow = this.eventWindow.filter((e) => e.timestamp > cutoff);
  }

  /**
   * Records a security event with sanitization, multi-factor risk calculation,
   * sliding window aggregation, and automated rule evaluation.
   */
  public async recordEvent(params: {
    type: SecurityEventType;
    req?: Request;
    userId?: string | null;
    userEmail?: string | null;
    tenantId?: string | null;
    ip?: string;
    userAgent?: string;
    endpoint?: string;
    method?: string;
    metadata?: Record<string, any>;
    isAdminUser?: boolean;
  }): Promise<void> {
    try {
      const clientIp = params.ip || params.req?.ip || params.req?.socket?.remoteAddress || '127.0.0.1';
      const userAgent = params.userAgent || params.req?.headers['user-agent'] || 'unknown';
      const endpoint = params.endpoint || params.req?.originalUrl || params.req?.url || '';
      const method = params.method || params.req?.method || 'POST';
      const sanitizedMeta = sanitizeSecurityMetadata(params.metadata || {});

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
      const recentFailures = this.eventWindow.filter(
        (e) =>
          (e.ip === clientIp || (params.userId && e.userId === params.userId)) &&
          (e.type === 'LOGIN_FAILED' || e.type === 'OTP_ABUSE') &&
          e.timestamp > recentWindow
      ).length;

      const recentRateLimits = this.eventWindow.filter(
        (e) => e.ip === clientIp && e.type === 'RATE_LIMIT' && e.timestamp > recentWindow
      ).length;

      // Multi-factor Risk Calculation
      const multiFactorContext: MultiFactorContext = {
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

      const { score, severity } = RiskScoreEngine.calculateEventRisk(multiFactorContext);

      // Async DB write
      SecurityEvent.create({
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
        logger.error(`Failed to persist SecurityEvent: ${err.message}`, { module: 'security' });
      });

      // Evaluate active rules against sliding window
      this.evaluateRules(params.type, clientIp, params.userId, params.userEmail, params.tenantId, sanitizedMeta, score);
    } catch (err: any) {
      logger.error(`Error in security recordEvent: ${err.message}`, { module: 'security' });
    }
  }

  private async evaluateRules(
    type: SecurityEventType,
    ip: string,
    userId?: string | null,
    userEmail?: string | null,
    tenantId?: string | null,
    metadata?: Record<string, any>,
    riskScore: number = 50
  ): Promise<void> {
    if (!this.isRulesLoaded || this.rulesCache.length === 0) {
      await this.loadRules();
    }

    const matchingRules = this.rulesCache.filter((r) => r.eventType === type && r.isActive);

    for (const rule of matchingRules) {
      const windowStart = Date.now() - rule.windowSeconds * 1000;

      // Count occurrences in sliding window matching IP or UserId
      const count = this.eventWindow.filter(
        (e) =>
          e.type === type &&
          (e.ip === ip || (userId && e.userId === userId)) &&
          e.timestamp >= windowStart
      ).length;

      if (count >= rule.threshold) {
        // Trigger Action
        if (rule.action === 'AUTO_BLOCK_IP') {
          await ipBlocker.blockIp(
            ip,
            `Auto-blocked by rule [${rule.name}]: ${count} violations in ${rule.windowSeconds}s`,
            'SYSTEM_AUTO',
            120 // 2 hours
          );
          logger.warn(`[SECURITY AUTO-BLOCK] IP ${ip} blocked by rule ${rule.ruleId}`, {
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

  private async upsertIncident(params: {
    rule: ISecurityRule;
    ip: string;
    userId?: string | null;
    userEmail?: string | null;
    tenantId?: string | null;
    eventCount: number;
    riskScore: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const hashKey = crypto
        .createHash('md5')
        .update(`${params.rule.ruleId}-${params.ip}-${params.userId || 'anon'}`)
        .digest('hex')
        .slice(0, 8);
      const incidentId = `INC-${dateStr}-${hashKey}`.toUpperCase();

      const existing = await SecurityIncident.findOne({
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
      } else {
        await SecurityIncident.create({
          incidentId,
          title: `Security Alert: ${params.rule.name}`,
          description: `Rule [${params.rule.name}] triggered: ${params.eventCount} occurrences detected within ${params.rule.windowSeconds} seconds.`,
          type: params.rule.eventType,
          severity: params.rule.severity,
          status: 'OPEN' as IncidentStatus,
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

        logger.warn(`[NEW SECURITY INCIDENT] ${incidentId} - ${params.rule.name} from IP: ${params.ip}`, {
          module: 'security',
          metadata: { incidentId, ruleId: params.rule.ruleId, ip: params.ip },
        });
      }
    } catch (err: any) {
      logger.error(`Failed to upsert SecurityIncident: ${err.message}`, { module: 'security' });
    }
  }
}

export const securityTracker = new SecurityTrackerEngine();
