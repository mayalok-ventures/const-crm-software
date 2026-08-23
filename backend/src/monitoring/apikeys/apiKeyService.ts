import crypto from 'crypto';
import mongoose from 'mongoose';
import ApiKey, { IApiKey, ApiKeyStatus } from '../models/ApiKey';
import ApiKeyAuditLog, { ApiKeyAuditAction } from '../models/ApiKeyAuditLog';
import ApiKeySecurityAlert, { ApiKeyAlertType, ApiKeyAlertSeverity } from '../models/ApiKeySecurityAlert';
import ApiKeyUsageMetric from '../models/ApiKeyUsageMetric';

export interface IGenerateApiKeyParams {
  name: string;
  organizationId: string | mongoose.Types.ObjectId;
  organizationName?: string;
  createdBy?: string | mongoose.Types.ObjectId;
  createdByName?: string;
  createdByEmail?: string;
  permissions?: string[];
  rateLimitPerMinute?: number;
  ipWhitelist?: string[];
  expiresAt?: Date | null;
}

export interface IValidateKeyResult {
  valid: boolean;
  code?: string;
  message?: string;
  apiKey?: IApiKey;
  organizationId?: mongoose.Types.ObjectId;
  permissions?: string[];
}

export interface IRequestMetadata {
  ip?: string;
  userAgent?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  latencyMs?: number;
}

// In-memory sliding-window rate limiter per keyId: Map<keyId, { count: number, windowStart: number }>
const rateLimitMap = new Map<string, { count: number; windowStart: number }>();

// IP history per keyId for unusual pattern detection: Map<keyId, Set<string>>
const knownIpsMap = new Map<string, Set<string>>();

export class ApiKeyService {
  private static getSecretSalt(): string {
    return process.env.API_KEY_SECRET || process.env.JWT_SECRET || 'crm_api_key_secret_salt_2026';
  }

  /**
   * Hashes raw API key using HMAC-SHA256
   */
  public static hashKey(rawKey: string): string {
    if (!rawKey || typeof rawKey !== 'string') return '';
    return crypto
      .createHmac('sha256', this.getSecretSalt())
      .update(rawKey.trim())
      .digest('hex');
  }

  /**
   * Generates a display mask for secret keys (e.g. crm_live_8f4a...4e1b)
   */
  public static maskKey(rawKey: string): string {
    if (!rawKey || typeof rawKey !== 'string') return 'crm_live_****';
    const clean = rawKey.trim();
    if (clean.length < 16) return clean.slice(0, 8) + '...';
    return `${clean.slice(0, 13)}...${clean.slice(-4)}`;
  }

  /**
   * Generates a high-entropy cryptographically secure API key
   */
  public static async generateApiKey(params: IGenerateApiKeyParams): Promise<{ apiKey: IApiKey; rawKey: string }> {
    const entropy = crypto.randomBytes(24).toString('hex'); // 48 chars hex
    const rawKey = `crm_live_${entropy}`;
    const keyHash = this.hashKey(rawKey);
    const keyPrefix = this.maskKey(rawKey);
    const keyId = `key_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const orgId = typeof params.organizationId === 'string' && mongoose.Types.ObjectId.isValid(params.organizationId)
      ? new mongoose.Types.ObjectId(params.organizationId)
      : (params.organizationId && mongoose.Types.ObjectId.isValid(params.organizationId.toString())
        ? new mongoose.Types.ObjectId(params.organizationId.toString())
        : new mongoose.Types.ObjectId());

    const createdByObjId = params.createdBy
      ? (typeof params.createdBy === 'string' && mongoose.Types.ObjectId.isValid(params.createdBy)
        ? new mongoose.Types.ObjectId(params.createdBy)
        : (params.createdBy && mongoose.Types.ObjectId.isValid(params.createdBy.toString())
          ? new mongoose.Types.ObjectId(params.createdBy.toString())
          : orgId))
      : orgId;

    const apiKey = await ApiKey.create({
      keyId,
      name: params.name,
      organizationId: orgId,
      organizationName: params.organizationName || 'Organization',
      createdBy: createdByObjId,
      createdByName: params.createdByName || 'Admin',
      createdByEmail: params.createdByEmail || '',
      keyPrefix,
      keyHash,
      status: 'ACTIVE',
      permissions: params.permissions && params.permissions.length > 0 ? params.permissions : ['leads:read', 'leads:write'],
      rateLimitPerMinute: params.rateLimitPerMinute || 120,
      ipWhitelist: params.ipWhitelist || [],
      expiresAt: params.expiresAt || null,
      rotationHistory: [],
    });

    // Record Immutable Audit Log
    await this.logAudit({
      keyId,
      keyPrefix,
      organizationId: orgId,
      action: 'KEY_CREATED',
      performedBy: params.createdByName || 'Admin',
      metadata: {
        name: params.name,
        permissions: apiKey.permissions,
        rateLimitPerMinute: apiKey.rateLimitPerMinute,
        expiresAt: apiKey.expiresAt,
      },
    });

    return { apiKey, rawKey };
  }

  /**
   * Validates an incoming raw API key against database hashes, expiration, suspension, rate limits, and IP whitelist
   */
  public static async validateApiKey(rawKey: string, meta: IRequestMetadata = {}): Promise<IValidateKeyResult> {
    if (!rawKey || typeof rawKey !== 'string') {
      return { valid: false, code: 'MISSING_KEY', message: 'API Key is required' };
    }

    const cleanKey = rawKey.trim();
    if (!cleanKey.startsWith('crm_live_') && !cleanKey.startsWith('crm_test_')) {
      return { valid: false, code: 'INVALID_FORMAT', message: 'API key format invalid. Expected crm_live_...' };
    }

    const keyHash = this.hashKey(cleanKey);
    const apiKey = await ApiKey.findOne({ keyHash });

    if (!apiKey) {
      // Failed authentication attempt
      return { valid: false, code: 'INVALID_KEY', message: 'Invalid or unrecognized API Key' };
    }

    // 1. Status Check: REVOKED
    if (apiKey.status === 'REVOKED') {
      await this.recordFailedAuth(apiKey, 'REVOKED_KEY_ATTEMPT', meta, 'Attempted request using permanently revoked API Key');
      return { valid: false, code: 'KEY_REVOKED', message: 'API key has been revoked' };
    }

    // 2. Status Check: SUSPENDED
    if (apiKey.status === 'SUSPENDED') {
      await this.recordFailedAuth(apiKey, 'SUSPENDED_KEY_ATTEMPT', meta, `API Key is suspended: ${apiKey.suspensionReason || 'Violation'}`);
      return { valid: false, code: 'KEY_SUSPENDED', message: `API Key is suspended: ${apiKey.suspensionReason || 'Contact administrator'}` };
    }

    // 3. Expiration Check
    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      if (apiKey.status !== 'EXPIRED') {
        apiKey.status = 'EXPIRED';
        await apiKey.save();
      }
      await this.recordFailedAuth(apiKey, 'EXPIRED_KEY_ATTEMPT', meta, 'Attempted request using expired API Key');
      return { valid: false, code: 'KEY_EXPIRED', message: 'API key has expired' };
    }

    // 4. IP Whitelist Enforcement
    if (apiKey.ipWhitelist && apiKey.ipWhitelist.length > 0 && meta.ip) {
      const isAllowed = apiKey.ipWhitelist.some(
        (allowedIp: string) =>
          allowedIp === meta.ip ||
          allowedIp === '*' ||
          (allowedIp.includes('*') && meta.ip && meta.ip.startsWith(allowedIp.replace('*', ''))) ||
          (allowedIp.includes('/*') && meta.ip && meta.ip.startsWith(allowedIp.replace('/*', '')))
      );
      if (!isAllowed) {
        await this.logAudit({
          keyId: apiKey.keyId,
          keyPrefix: apiKey.keyPrefix,
          organizationId: apiKey.organizationId,
          action: 'FAILED_AUTH_ATTEMPT',
          ipAddress: meta.ip,
          userAgent: meta.userAgent,
          metadata: { reason: 'IP_NOT_WHITELISTED', ip: meta.ip, whitelist: apiKey.ipWhitelist },
        });
        return { valid: false, code: 'IP_NOT_AUTHORIZED', message: `IP ${meta.ip} is not authorized for this API key` };
      }
    }

    // 5. Rate Limit Enforcement (Sliding Window 60s)
    const rateLimitExceeded = this.checkRateLimit(apiKey.keyId, apiKey.rateLimitPerMinute || 120);
    if (rateLimitExceeded) {
      apiKey.rateLimitViolationsCount = (apiKey.rateLimitViolationsCount || 0) + 1;
      await apiKey.save();

      await this.logAudit({
        keyId: apiKey.keyId,
        keyPrefix: apiKey.keyPrefix,
        organizationId: apiKey.organizationId,
        action: 'RATE_LIMIT_EXCEEDED',
        ipAddress: meta.ip,
        userAgent: meta.userAgent,
        metadata: { limit: apiKey.rateLimitPerMinute, violations: apiKey.rateLimitViolationsCount },
      });

      if (apiKey.rateLimitViolationsCount % 5 === 0) {
        await this.triggerSecurityAlert({
          keyId: apiKey.keyId,
          keyName: apiKey.name,
          keyPrefix: apiKey.keyPrefix,
          organizationId: apiKey.organizationId,
          organizationName: apiKey.organizationName,
          alertType: 'EXCESSIVE_REQUESTS',
          severity: 'HIGH',
          title: `Excessive Rate-Limit Violations on "${apiKey.name}"`,
          description: `Key exceeded limit of ${apiKey.rateLimitPerMinute} req/min ${apiKey.rateLimitViolationsCount} times.`,
          metadata: { rateLimitPerMinute: apiKey.rateLimitPerMinute, ip: meta.ip },
        });
      }

      return { valid: false, code: 'RATE_LIMIT_EXCEEDED', message: `API Key rate limit of ${apiKey.rateLimitPerMinute} requests/minute exceeded` };
    }

    // 6. Asynchronously track usage metrics & unusual IP patterns
    this.recordSuccessfulUsage(apiKey, meta).catch((err) => {
      console.error('[ApiKeyService] Error updating telemetry:', err.message);
    });

    return {
      valid: true,
      apiKey,
      organizationId: apiKey.organizationId,
      permissions: apiKey.permissions || [],
    };
  }

  /**
   * Rotates an API Key by issuing a new high-entropy token while preserving settings and logging rotation history
   */
  public static async rotateApiKey(
    keyId: string,
    performedByOrOpts: string | { performedBy?: string; gracePeriodHours?: number } = 'Admin',
    gracePeriodHours: number = 0
  ): Promise<{ apiKey: IApiKey; newRawKey: string }> {
    const performedBy = typeof performedByOrOpts === 'object' && performedByOrOpts !== null
      ? performedByOrOpts.performedBy || 'Admin'
      : typeof performedByOrOpts === 'string'
      ? performedByOrOpts
      : 'Admin';
    const effectiveGraceHours = typeof performedByOrOpts === 'object' && performedByOrOpts !== null && performedByOrOpts.gracePeriodHours !== undefined
      ? performedByOrOpts.gracePeriodHours
      : gracePeriodHours;

    const query = mongoose.Types.ObjectId.isValid(keyId) ? { $or: [{ keyId }, { _id: keyId }] } : { keyId };
    const apiKey = await ApiKey.findOne(query);
    if (!apiKey) {
      throw new Error(`API key ${keyId} not found`);
    }

    const entropy = crypto.randomBytes(24).toString('hex');
    const newRawKey = `crm_live_${entropy}`;
    const newKeyHash = this.hashKey(newRawKey);
    const newKeyPrefix = this.maskKey(newRawKey);
    const previousPrefix = apiKey.keyPrefix;

    const graceEndsAt = effectiveGraceHours > 0 ? new Date(Date.now() + effectiveGraceHours * 3600000) : undefined;

    if (!Array.isArray(apiKey.rotationHistory)) {
      apiKey.rotationHistory = [];
    }

    apiKey.rotationHistory.push({
      rotatedAt: new Date(),
      previousPrefix,
      gracePeriodEndsAt: graceEndsAt,
    });

    apiKey.keyHash = newKeyHash;
    apiKey.keyPrefix = newKeyPrefix;
    apiKey.status = 'ACTIVE';
    await apiKey.save();

    await this.logAudit({
      keyId: apiKey.keyId,
      keyPrefix: newKeyPrefix,
      organizationId: apiKey.organizationId,
      action: 'KEY_ROTATED',
      performedBy,
      metadata: { previousPrefix, gracePeriodHours: effectiveGraceHours },
    });

    return { apiKey, newRawKey };
  }

  /**
   * Revokes an API Key permanently
   */
  public static async revokeApiKey(
    keyId: string,
    performedByOrOpts: string | { performedBy?: string; reason?: string } = 'Admin',
    reasonParam: string = ''
  ): Promise<IApiKey> {
    const performedBy = typeof performedByOrOpts === 'object' && performedByOrOpts !== null
      ? performedByOrOpts.performedBy || 'Admin'
      : typeof performedByOrOpts === 'string'
      ? performedByOrOpts
      : 'Admin';
    const reason = typeof performedByOrOpts === 'object' && performedByOrOpts !== null && performedByOrOpts.reason !== undefined
      ? performedByOrOpts.reason
      : reasonParam;

    const query = mongoose.Types.ObjectId.isValid(keyId) ? { $or: [{ keyId }, { _id: keyId }] } : { keyId };
    const apiKey = await ApiKey.findOne(query);
    if (!apiKey) throw new Error(`API key ${keyId} not found`);

    apiKey.status = 'REVOKED';
    apiKey.revokedAt = new Date();
    apiKey.revokedBy = performedBy;
    apiKey.revocationReason = reason || 'Revoked by administrator';
    await apiKey.save();

    await this.logAudit({
      keyId: apiKey.keyId,
      keyPrefix: apiKey.keyPrefix,
      organizationId: apiKey.organizationId,
      action: 'KEY_REVOKED',
      performedBy,
      metadata: { reason: apiKey.revocationReason },
    });

    return apiKey;
  }

  /**
   * Temporarily suspends an API Key
   */
  public static async suspendApiKey(
    keyId: string,
    performedByOrOpts: string | { performedBy?: string; reason?: string } = 'Admin',
    reasonParam: string = ''
  ): Promise<IApiKey> {
    const performedBy = typeof performedByOrOpts === 'object' && performedByOrOpts !== null
      ? performedByOrOpts.performedBy || 'Admin'
      : typeof performedByOrOpts === 'string'
      ? performedByOrOpts
      : 'Admin';
    const reason = typeof performedByOrOpts === 'object' && performedByOrOpts !== null && performedByOrOpts.reason !== undefined
      ? performedByOrOpts.reason
      : reasonParam;

    const query = mongoose.Types.ObjectId.isValid(keyId) ? { $or: [{ keyId }, { _id: keyId }] } : { keyId };
    const apiKey = await ApiKey.findOne(query);
    if (!apiKey) throw new Error(`API key ${keyId} not found`);

    apiKey.status = 'SUSPENDED';
    apiKey.suspendedAt = new Date();
    apiKey.suspensionReason = reason || 'Suspended by administrator';
    await apiKey.save();

    await this.logAudit({
      keyId: apiKey.keyId,
      keyPrefix: apiKey.keyPrefix,
      organizationId: apiKey.organizationId,
      action: 'KEY_SUSPENDED',
      performedBy,
      metadata: { reason: apiKey.suspensionReason },
    });

    return apiKey;
  }

  /**
   * Reactivates a suspended API Key
   */
  public static async reactivateApiKey(
    keyId: string,
    performedByOrOpts: string | { performedBy?: string } = 'Admin'
  ): Promise<IApiKey> {
    const performedBy = typeof performedByOrOpts === 'object' && performedByOrOpts !== null
      ? performedByOrOpts.performedBy || 'Admin'
      : typeof performedByOrOpts === 'string'
      ? performedByOrOpts
      : 'Admin';

    const query = mongoose.Types.ObjectId.isValid(keyId) ? { $or: [{ keyId }, { _id: keyId }] } : { keyId };
    const apiKey = await ApiKey.findOne(query);
    if (!apiKey) throw new Error(`API key ${keyId} not found`);

    apiKey.status = 'ACTIVE';
    apiKey.suspendedAt = null;
    apiKey.suspensionReason = '';
    await apiKey.save();

    await this.logAudit({
      keyId: apiKey.keyId,
      keyPrefix: apiKey.keyPrefix,
      organizationId: apiKey.organizationId,
      action: 'KEY_REACTIVATED',
      performedBy,
    });

    return apiKey;
  }

  /**
   * Checks and enforces in-memory rate limit for a key
   */
  private static checkRateLimit(keyId: string, limitPerMinute: number): boolean {
    const now = Date.now();
    const windowMs = 60000;
    const record = rateLimitMap.get(keyId);

    if (!record || now - record.windowStart > windowMs) {
      rateLimitMap.set(keyId, { count: 1, windowStart: now });
      return false;
    }

    record.count++;
    return record.count > limitPerMinute;
  }

  /**
   * Asynchronously updates usage telemetry and detects IP anomalies
   */
  private static async recordSuccessfulUsage(apiKey: IApiKey, meta: IRequestMetadata): Promise<void> {
    const updateQuery: any = {
      $inc: { totalRequests: 1, monthlyRequests: 1, dailyRequests: 1 },
      $set: { lastUsedAt: new Date() },
    };

    if (meta.ip) {
      updateQuery.$set.lastUsedIp = meta.ip;

      // Anomaly Detection: Check if IP is completely new
      let knownIps = knownIpsMap.get(apiKey.keyId);
      if (!knownIps) {
        knownIps = new Set<string>();
        if (apiKey.lastUsedIp) knownIps.add(apiKey.lastUsedIp);
        knownIpsMap.set(apiKey.keyId, knownIps);
      }

      if (knownIps.size > 0 && !knownIps.has(meta.ip)) {
        // New IP detected on active key
        knownIps.add(meta.ip);
        if (knownIps.size >= 4) {
          // Trigger security alert on unusual IP shift
          await this.triggerSecurityAlert({
            keyId: apiKey.keyId,
            keyName: apiKey.name,
            keyPrefix: apiKey.keyPrefix,
            organizationId: apiKey.organizationId,
            organizationName: apiKey.organizationName,
            alertType: 'UNUSUAL_IP_OR_GEO',
            severity: 'MEDIUM',
            title: `Unusual IP Access Detected on "${apiKey.name}"`,
            description: `Key accessed from new IP ${meta.ip}. Known historical IPs: ${Array.from(knownIps).slice(0, 3).join(', ')}.`,
            metadata: { newIp: meta.ip, knownIps: Array.from(knownIps) },
          });
        }
      } else {
        knownIps.add(meta.ip);
      }
    }

    if (meta.userAgent) {
      updateQuery.$set.lastUsedUserAgent = meta.userAgent;
    }

    if (mongoose.connection.readyState === 1 || typeof (ApiKey as any).updateOne === 'function') {
      try {
        await ApiKey.updateOne({ _id: apiKey._id }, updateQuery);
      } catch (err: any) {
        console.error('[ApiKeyService] Error updating telemetry:', err.message);
      }
    }
  }

  /**
   * Records failed authentication and triggers security alerts for abuse
   */
  private static async recordFailedAuth(
    apiKey: IApiKey,
    action: ApiKeyAuditAction,
    meta: IRequestMetadata,
    reason: string
  ): Promise<void> {
    if (mongoose.connection.readyState === 1 || typeof (ApiKey as any).updateOne === 'function') {
      try {
        await ApiKey.updateOne({ _id: apiKey._id }, { $inc: { failedAuthCount: 1 } });
      } catch (err: any) {}
    }

    await this.logAudit({
      keyId: apiKey.keyId,
      keyPrefix: apiKey.keyPrefix,
      organizationId: apiKey.organizationId,
      action,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
      metadata: { reason, ip: meta.ip },
    });

    if ((apiKey.failedAuthCount || 0) + 1 >= 3) {
      const alertType: ApiKeyAlertType =
        action === 'EXPIRED_KEY_ATTEMPT'
          ? 'EXPIRED_KEY_ATTEMPT'
          : action === 'REVOKED_KEY_ATTEMPT'
          ? 'REVOKED_KEY_ATTEMPT'
          : 'SUSPENDED_KEY_ATTEMPT';

      await this.triggerSecurityAlert({
        keyId: apiKey.keyId,
        keyName: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        organizationId: apiKey.organizationId,
        organizationName: apiKey.organizationName,
        alertType,
        severity: 'HIGH',
        title: `Repeated Blocked Attempts on ${apiKey.status} Key "${apiKey.name}"`,
        description: `Received ${(apiKey.failedAuthCount || 0) + 1} authentication attempts using ${apiKey.status.toLowerCase()} key from IP ${meta.ip || 'Unknown'}.`,
        metadata: { ip: meta.ip, userAgent: meta.userAgent, failedCount: (apiKey.failedAuthCount || 0) + 1 },
      });
    }
  }

  /**
   * Logs an immutable audit log for API Key operations
   */
  public static async logAudit(params: {
    keyId: string;
    keyPrefix: string;
    organizationId: mongoose.Types.ObjectId;
    action: ApiKeyAuditAction;
    performedBy?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const auditId = `audit_key_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await ApiKeyAuditLog.create({
        auditId,
        keyId: params.keyId,
        keyPrefix: params.keyPrefix,
        organizationId: params.organizationId,
        action: params.action,
        performedBy: params.performedBy || 'System',
        ipAddress: params.ipAddress || '',
        userAgent: params.userAgent || '',
        metadata: params.metadata || {},
      });
    } catch (err: any) {
      console.error('[ApiKeyService] Audit log error:', err.message);
    }
  }

  /**
   * Triggers a dedicated API Key security alert
   */
  public static async triggerSecurityAlert(params: {
    keyId: string;
    keyName: string;
    keyPrefix: string;
    organizationId: mongoose.Types.ObjectId;
    organizationName: string;
    alertType: ApiKeyAlertType;
    severity: ApiKeyAlertSeverity;
    title: string;
    description: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      let existing = null;
      if (mongoose.connection.readyState === 1 || typeof (ApiKeySecurityAlert as any).findOne === 'function') {
        try {
          existing = await ApiKeySecurityAlert.findOne({
            keyId: params.keyId,
            alertType: params.alertType,
            isResolved: false,
          });
        } catch (e) {}
      }

      if (!existing) {
        const alertId = `sec_alert_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
        await ApiKeySecurityAlert.create({
          alertId,
          keyId: params.keyId,
          keyName: params.keyName,
          keyPrefix: params.keyPrefix,
          organizationId: params.organizationId,
          organizationName: params.organizationName,
          alertType: params.alertType,
          severity: params.severity,
          title: params.title,
          description: params.description,
          metadata: params.metadata || {},
          isResolved: false,
        });
      }
    } catch (err: any) {
      console.error('[ApiKeyService] Security alert error:', err.message);
    }
  }

  /**
   * Computes high-level fleet overview KPIs
   */
  public static async getFleetOverview(orgIdFilter?: string): Promise<any> {
    const filter: any = {};
    if (orgIdFilter && mongoose.Types.ObjectId.isValid(orgIdFilter)) {
      filter.organizationId = new mongoose.Types.ObjectId(orgIdFilter);
    }

    const [allKeys, activeAlertsCount, recentAuditLogs] = await Promise.all([
      ApiKey.find(filter).sort({ createdAt: -1 }).lean(),
      ApiKeySecurityAlert.countDocuments({ ...filter, isResolved: false }),
      ApiKeyAuditLog.find(filter).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    const totalKeys = allKeys.length;
    const activeKeys = allKeys.filter((k) => k.status === 'ACTIVE').length;
    const revokedKeys = allKeys.filter((k) => k.status === 'REVOKED').length;
    const suspendedKeys = allKeys.filter((k) => k.status === 'SUSPENDED').length;
    const expiredKeys = allKeys.filter((k) => k.status === 'EXPIRED').length;

    const totalRequests = allKeys.reduce((acc, k) => acc + (k.totalRequests || 0), 0);
    const monthlyRequests = allKeys.reduce((acc, k) => acc + (k.monthlyRequests || 0), 0);
    const rateLimitViolations = allKeys.reduce((acc, k) => acc + (k.rateLimitViolationsCount || 0), 0);
    const failedAuthAttempts = allKeys.reduce((acc, k) => acc + (k.failedAuthCount || 0), 0);

    const topConsumers = [...allKeys]
      .sort((a, b) => (b.totalRequests || 0) - (a.totalRequests || 0))
      .slice(0, 5)
      .map((k) => ({
        keyId: k.keyId,
        name: k.name,
        keyPrefix: k.keyPrefix,
        organizationName: k.organizationName,
        status: k.status,
        totalRequests: k.totalRequests || 0,
        rateLimitPerMinute: k.rateLimitPerMinute,
        lastUsedAt: k.lastUsedAt,
      }));

    return {
      summary: {
        totalKeys,
        activeKeys,
        revokedKeys,
        suspendedKeys,
        expiredKeys,
        totalRequests,
        monthlyRequests,
        rateLimitViolations,
        failedAuthAttempts,
        activeAlertsCount,
      },
      topConsumers,
      recentAuditLogs,
    };
  }
}

export const apiKeyService = ApiKeyService;
export default ApiKeyService;
