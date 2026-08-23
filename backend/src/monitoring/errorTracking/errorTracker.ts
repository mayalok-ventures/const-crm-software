import crypto from 'crypto';
import os from 'os';
import { Request, Response, NextFunction } from 'express';
import { ErrorGroup, ErrorSeverity } from '../models/ErrorGroup';
import { ErrorOccurrence } from '../models/ErrorOccurrence';
import {
  generateErrorFingerprint,
  parseStackTrace,
  sanitizeErrorContext,
} from './errorSanitizer';
import { logger } from '../logging/logger';

export interface ErrorContext {
  req?: Request | any;
  route?: string;
  method?: string;
  statusCode?: number;
  userId?: any;
  organizationId?: any;
  metadata?: Record<string, any>;
  severity?: ErrorSeverity;
}

class ErrorTrackerEngine {
  private serverId: string;
  private environment: string;
  private appVersion: string;
  private recentErrorTimestamps: number[] = [];
  private spikeThreshold = 20; // 20 errors in 5 min triggers spike warning
  private rollingWindowMs = 5 * 60 * 1000;

  constructor() {
    this.serverId = process.env.SERVER_ID || os.hostname() || 'server-default';
    this.environment = process.env.NODE_ENV || 'production';
    this.appVersion = process.env.APP_VERSION || '1.0.0';
  }

  public async recordError(error: any, context: ErrorContext = {}): Promise<string> {
    const errorId = `err_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const errorName = error?.name || 'Error';
    const errorMessage = error?.message || String(error);
    const stack = error?.stack || '';

    const fingerprint = generateErrorFingerprint(errorName, errorMessage, stack);
    const { primaryFrame, cleanStack } = parseStackTrace(stack);

    const route =
      context.route ||
      context.req?.originalUrl ||
      context.req?.url ||
      context.req?.path ||
      'unknown_route';
    const method = context.method || context.req?.method || 'INTERNAL';
    const statusCode = context.statusCode || (error?.status ? Number(error.status) : 500);
    const userId = context.userId || context.req?.user?._id || context.req?.user?.id;
    const organizationId =
      context.organizationId || context.req?.user?.companyId || context.req?.tenantId;
    const requestId =
      context.req?.headers?.['x-request-id'] || context.req?.requestId || `req_${Date.now()}`;

    const severity: ErrorSeverity =
      context.severity || (statusCode >= 500 ? 'CRITICAL' : statusCode >= 400 ? 'MEDIUM' : 'LOW');

    const sanitizedMeta = sanitizeErrorContext({
      ...context.metadata,
      ip: context.req?.ip,
      userAgent: context.req?.headers?.['user-agent'],
      query: context.req?.query,
    });

    try {
      const now = new Date();

      // 1. Upsert or update ErrorGroup
      let group = await ErrorGroup.findOne({ fingerprint });
      let isRegression = false;

      if (!group) {
        group = await ErrorGroup.create({
          fingerprint,
          errorType: errorName,
          message: errorMessage,
          stackTrace: cleanStack,
          primaryFrame,
          status: 'OPEN',
          severity,
          occurrences: 1,
          firstSeen: now,
          lastSeen: now,
          affectedEndpoints: [route],
          affectedServers: [this.serverId],
          affectedUsersCount: userId ? 1 : 0,
          affectedOrgsCount: organizationId ? 1 : 0,
          notes: [],
          isRegression: false,
        });

        logger.warn(`[NEW ERROR GROUP DETECTED] ${errorName}: ${errorMessage}`, {
          module: 'error_tracking',
          requestId,
          metadata: { fingerprint, route, severity },
        });
      } else {
        if (group.status === 'RESOLVED') {
          isRegression = true;
          group.status = 'OPEN';
          group.isRegression = true;
          logger.warn(`[ERROR REGRESSION DETECTED] Reopened: ${errorName} (${fingerprint})`, {
            module: 'error_tracking',
            requestId,
          });
        }

        group.occurrences += 1;
        group.lastSeen = now;
        if (!group.affectedEndpoints.includes(route)) group.affectedEndpoints.push(route);
        if (!group.affectedServers.includes(this.serverId)) group.affectedServers.push(this.serverId);
        if (group.severity !== 'CRITICAL' && severity === 'CRITICAL') group.severity = 'CRITICAL';
        await group.save();
      }

      // 2. Insert Occurrence
      await ErrorOccurrence.create({
        errorId,
        fingerprint,
        requestId,
        timestamp: now,
        serverId: this.serverId,
        environment: this.environment,
        route,
        method,
        statusCode,
        message: errorMessage,
        stackTrace: cleanStack,
        errorType: errorName,
        userId: userId ? String(userId) : null,
        organizationId: organizationId ? String(organizationId) : null,
        applicationVersion: this.appVersion,
        metadata: sanitizedMeta,
      });

      // 3. Track spikes
      this.checkErrorSpike(now.getTime());
    } catch (dbErr: any) {
      console.error('[ErrorTracker] Failed to record error to database:', dbErr.message);
    }

    return fingerprint;
  }

  private checkErrorSpike(nowMs: number) {
    this.recentErrorTimestamps.push(nowMs);
    const cutoff = nowMs - this.rollingWindowMs;
    this.recentErrorTimestamps = this.recentErrorTimestamps.filter((t) => t >= cutoff);

    if (this.recentErrorTimestamps.length >= this.spikeThreshold) {
      logger.fatal(
        `[HIGH ERROR RATE ALERT] ${this.recentErrorTimestamps.length} errors occurred in the last 5 minutes!`,
        {
          module: 'error_alerts',
          metadata: {
            errorCount: this.recentErrorTimestamps.length,
            windowMinutes: 5,
            serverId: this.serverId,
          },
        }
      );
    }
  }

  /**
   * Express middleware to intercept and log unhandled route errors
   */
  public expressMiddleware = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    this.recordError(err, { req, statusCode: res.statusCode >= 400 ? res.statusCode : 500 }).catch(
      () => {}
    );
    next(err);
  };
}

export const errorTracker = new ErrorTrackerEngine();
export default errorTracker;
