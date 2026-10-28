import v8 from 'v8';
import { ComponentHealth } from '../healthTypes';

export class AppProbe {
  /**
   * Measures event loop lag in milliseconds
   */
  public static measureEventLoopLag(): Promise<number> {
    return new Promise((resolve) => {
      const start = process.hrtime();
      setImmediate(() => {
        const delta = process.hrtime(start);
        const lagMs = delta[0] * 1000 + delta[1] / 1e6;
        resolve(Math.round(lagMs * 100) / 100);
      });
    });
  }

  /**
   * Probes application runtime health
   */
  public async probe(): Promise<ComponentHealth> {
    const startTime = Date.now();
    try {
      const mem = process.memoryUsage();
      const uptime = process.uptime();
      const eventLoopLagMs = await AppProbe.measureEventLoopLag();

      const v8Stats = v8.getHeapStatistics();
      const heapLimitMb = Math.round((v8Stats.heap_size_limit / (1024 * 1024)) * 10) / 10;
      const heapUsedMb = Math.round((mem.heapUsed / (1024 * 1024)) * 10) / 10;
      const heapTotalMb = Math.round((mem.heapTotal / (1024 * 1024)) * 10) / 10;
      const rssMb = Math.round((mem.rss / (1024 * 1024)) * 10) / 10;
      // Calculate usage against actual V8 heap limit to avoid false alerts when heapTotal is small
      const heapUsagePercent = Math.round((mem.heapUsed / v8Stats.heap_size_limit) * 100);
      const heapAllocatedPercent = Math.round((mem.heapUsed / mem.heapTotal) * 100);

      // Score evaluation:
      // High event loop lag (>100ms) or true memory pressure (>85% of heap limit) degrades health
      let score = 100;
      let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';
      const issues: string[] = [];

      if (eventLoopLagMs > 300) {
        score -= 40;
        issues.push(`Severe event loop lag: ${eventLoopLagMs}ms`);
      } else if (eventLoopLagMs > 80) {
        score -= 20;
        issues.push(`Elevated event loop lag: ${eventLoopLagMs}ms`);
      }

      if (heapUsagePercent > 85) {
        score -= 35;
        issues.push(`Critical heap usage: ${heapUsagePercent}% of limit`);
      } else if (heapUsagePercent > 70) {
        score -= 15;
        issues.push(`High heap usage: ${heapUsagePercent}% of limit`);
      }

      score = Math.max(0, Math.min(100, score));

      if (score >= 85) {
        status = 'HEALTHY';
      } else if (score >= 50) {
        status = 'DEGRADED';
      } else {
        status = 'UNHEALTHY';
      }

      const latencyMs = Math.max(1, Date.now() - startTime);

      return {
        name: 'Application Runtime',
        category: 'core',
        status,
        score,
        latencyMs,
        isCritical: true,
        message: issues.length > 0 ? issues.join(', ') : 'Node.js process and event loop responsive',
        details: {
          pid: process.pid,
          nodeVersion: process.version,
          uptimeSeconds: Math.round(uptime),
          eventLoopLagMs,
          memory: {
            heapUsedMb,
            heapTotalMb,
            heapLimitMb,
            rssMb,
            heapUsagePercent,
            heapAllocatedPercent,
          },
          environment: process.env.NODE_ENV || 'development',
        },
        timestamp: new Date(),
      };
    } catch (err: any) {
      return {
        name: 'Application Runtime',
        category: 'core',
        status: 'UNHEALTHY',
        score: 0,
        latencyMs: Math.max(1, Date.now() - startTime),
        isCritical: true,
        error: err.message || 'Application probe failed',
        timestamp: new Date(),
      };
    }
  }
}

export const appProbe = new AppProbe();
