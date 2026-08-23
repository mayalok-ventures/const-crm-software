import { Request, Response, NextFunction } from 'express';
import os from 'os';
import { ApiMetric } from './models/ApiMetric';

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: [number, number];
    }
  }
}

export class ApiPerformanceMiddleware {
  private buffer: any[] = [];
  private serverId: string;
  private environment: string;
  private flushInterval: NodeJS.Timeout | null = null;
  private maxBufferSize: number = 100;
  private flushIntervalMs: number = 5000;

  constructor() {
    this.serverId = process.env.SERVER_ID || os.hostname() || 'use-setu-server';
    this.environment = process.env.NODE_ENV || 'development';

    // Periodically flush buffer
    this.flushInterval = setInterval(() => {
      this.flush().catch(err => console.error('[ApiPerformance] Error flushing metrics buffer:', err));
    }, this.flushIntervalMs);

    // Bind flush on exit
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
  }

  public getMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const requestId =
        (req.headers['x-request-id'] as string) ||
        `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      req.requestId = requestId;
      res.setHeader('X-Request-ID', requestId);

      const startTime = process.hrtime();

      res.on('finish', () => {
        const diff = process.hrtime(startTime);
        const responseTimeMs = (diff[0] * 1e9 + diff[1]) / 1e6;

        let route = req.path;
        if (req.route && req.route.path) {
          route = req.baseUrl + req.route.path;
        }

        // Avoid logging monitoring routes recursively
        if (route.includes('/monitoring') || route.includes('/heartbeat')) {
          return;
        }

        const organizationId = (req as any).user?.tenantId || (req as any).user?.companyId || undefined;

        const metric = {
          route,
          method: req.method,
          statusCode: res.statusCode,
          responseTime: parseFloat(responseTimeMs.toFixed(2)),
          timestamp: new Date(),
          requestId,
          serverId: this.serverId,
          organizationId: organizationId ? organizationId.toString() : undefined,
          environment: this.environment,
        };

        this.buffer.push(metric);

        if (this.buffer.length >= this.maxBufferSize) {
          this.flush().catch(err => console.error('[ApiPerformance] Buffer limit flush error:', err));
        }
      });

      next();
    };
  }

  public async flush() {
    if (this.buffer.length === 0) return;

    const metricsToSave = [...this.buffer];
    this.buffer = [];

    try {
      await ApiMetric.insertMany(metricsToSave, { ordered: false });
    } catch (error: any) {
      console.error(`[ApiPerformance] Failed to bulk write ${metricsToSave.length} API metrics:`, error?.message || error);
    }
  }

  private async shutdown() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
    console.log('[ApiPerformance] Shutting down, flushing remaining buffer...');
    await this.flush();
  }
}

const instance = new ApiPerformanceMiddleware();
export const apiPerformance = instance.getMiddleware();
export const apiPerformanceInstance = instance;
export default apiPerformance;
