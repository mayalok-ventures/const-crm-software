import { Request } from 'express';
import { AuditLog, AuditAction, IFieldChange } from '../models/AuditLog';
import { sanitizeAuditData } from './auditSanitizer';
import { calculateAuditDiff } from './auditDiffCalculator';
import { logger } from '../logging/logger';

export interface RecordAuditParams {
  actor?: {
    id?: string;
    _id?: any;
    name?: string;
    email?: string;
    role?: string;
    companyId?: any;
    isAdmin?: boolean;
  } | null;
  organizationId?: string | any;
  action: AuditAction;
  resourceType: string;
  resourceId?: string | any;
  resourceName?: string;
  before?: Record<string, any> | null;
  after?: Record<string, any> | null;
  changes?: Record<string, IFieldChange>;
  req?: Request;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

class AuditServiceEngine {
  /**
   * Universal Audit Log recorder
   * Append-only, fully sanitized, field-level diffing enabled
   */
  public async record(params: RecordAuditParams): Promise<void> {
    try {
      const user = params.actor || (params.req as any)?.user || null;
      const actorId = user?._id || user?.id || null;
      const actorName = user?.name || (user?.isAdmin ? 'SuperAdmin' : 'System');
      const actorEmail = user?.email || null;
      const actorRole = user?.role || (user?.isAdmin ? 'superadmin' : 'system');
      const organizationId = params.organizationId || user?.companyId || null;

      const clientIp =
        params.ip ||
        params.req?.ip ||
        (params.req?.socket?.remoteAddress as string) ||
        '127.0.0.1';
      const userAgent =
        params.userAgent ||
        (params.req?.headers['user-agent'] as string) ||
        'internal';
      const requestId =
        params.requestId ||
        (params.req?.headers['x-request-id'] as string) ||
        (params.req as any)?.id ||
        null;

      // Sanitize snapshots before storing
      const sanitizedBefore = params.before ? sanitizeAuditData(params.before) : null;
      const sanitizedAfter = params.after ? sanitizeAuditData(params.after) : null;
      const sanitizedMetadata = sanitizeAuditData(params.metadata || {});

      // Calculate or sanitize field changes
      let fieldChanges = params.changes;
      if (!fieldChanges && (sanitizedBefore || sanitizedAfter)) {
        fieldChanges = calculateAuditDiff(sanitizedBefore, sanitizedAfter);
      } else if (fieldChanges) {
        fieldChanges = sanitizeAuditData(fieldChanges);
      }

      // Non-blocking asynchronous persistence
      AuditLog.create({
        actorId,
        actorName,
        actorEmail,
        actorRole,
        organizationId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId ? String(params.resourceId) : null,
        resourceName: params.resourceName || null,
        before: sanitizedBefore,
        after: sanitizedAfter,
        changes: fieldChanges || {},
        requestId,
        timestamp: new Date(),
        ip: clientIp,
        userAgent,
        metadata: sanitizedMetadata,
        retentionCategory: 'ACTIVE',
      }).catch((err) => {
        logger.error(`Failed to persist AuditLog: ${err.message}`, { module: 'audit' });
      });

      // Output to structured audit logger
      logger.audit(
        actorEmail || actorName || 'System',
        params.action,
        `${params.resourceType}:${params.resourceId || 'N/A'}`,
        {
          organizationId,
          requestId,
          changesCount: Object.keys(fieldChanges || {}).length,
        }
      );
    } catch (err: any) {
      logger.error(`Error in auditService.record: ${err.message}`, { module: 'audit' });
    }
  }
}

export const auditService = new AuditServiceEngine();
