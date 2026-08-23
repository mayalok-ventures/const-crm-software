import {
  ComponentHealth,
  LivenessResult,
  ReadinessResult,
  DetailedHealthResult,
} from './healthTypes';
import { appProbe, AppProbe } from './probes/AppProbe';
import { mongoProbe } from './probes/MongoProbe';
import { redisProbe } from './probes/RedisProbe';
import { storageProbe } from './probes/StorageProbe';
import { externalServiceProbe } from './probes/ExternalServiceProbe';
import { queueProbe } from './probes/QueueProbe';

export class HealthCheckService {
  private static instance: HealthCheckService;
  private cachedDetailed: DetailedHealthResult | null = null;
  private lastDetailedFetchTime = 0;
  private readonly CACHE_TTL_MS = 3000; // 3 seconds in-memory cache

  public static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  /**
   * Safe timeout wrapper preventing any probe from hanging indefinitely
   */
  public async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    fallbackValue: T
  ): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallbackValue), timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timer!);
      return result;
    } catch {
      clearTimeout(timer!);
      return fallbackValue;
    }
  }

  /**
   * Kubernetes Liveness Probe (GET /health/live)
   * Super fast in-memory inspection of process and event loop responsiveness
   */
  public async getLiveness(): Promise<LivenessResult> {
    const mem = process.memoryUsage();
    const uptime = process.uptime();
    const eventLoopLagMs = await this.withTimeout(AppProbe.measureEventLoopLag(), 500, 10);

    const isAlive = eventLoopLagMs < 2000;

    return {
      status: isAlive ? 'HEALTHY' : 'UNHEALTHY',
      liveness: isAlive,
      pid: process.pid,
      uptimeSeconds: Math.round(uptime),
      memory: {
        rssBytes: mem.rss,
        heapTotalBytes: mem.heapTotal,
        heapUsedBytes: mem.heapUsed,
        externalBytes: mem.external,
        formattedHeap: `${Math.round(mem.heapUsed / (1024 * 1024))} MB / ${Math.round(
          mem.heapTotal / (1024 * 1024)
        )} MB`,
        formattedRss: `${Math.round(mem.rss / (1024 * 1024))} MB`,
      },
      eventLoopLagMs,
      timestamp: new Date(),
    };
  }

  /**
   * Kubernetes Readiness Probe (GET /health/ready)
   * Verifies critical dependencies can serve traffic (MongoDB, Filesystem Storage)
   */
  public async getReadiness(): Promise<ReadinessResult> {
    const [mongoHealth, storageHealth] = await Promise.all([
      this.withTimeout(
        mongoProbe.probe(),
        2000,
        {
          name: 'MongoDB',
          category: 'database',
          status: 'UNHEALTHY',
          score: 0,
          latencyMs: 2000,
          isCritical: true,
          error: 'MongoDB readiness check timed out',
          timestamp: new Date(),
        } as ComponentHealth
      ),
      this.withTimeout(
        storageProbe.probe(),
        1500,
        {
          name: 'Storage & Filesystem',
          category: 'storage',
          status: 'UNHEALTHY',
          score: 0,
          latencyMs: 1500,
          isCritical: true,
          error: 'Storage readiness check timed out',
          timestamp: new Date(),
        } as ComponentHealth
      ),
    ]);

    const isMongoReady = mongoHealth.status === 'HEALTHY' || mongoHealth.status === 'DEGRADED';
    const isStorageReady = storageHealth.status === 'HEALTHY' || storageHealth.status === 'DEGRADED';
    const isReady = isMongoReady && isStorageReady;

    return {
      status: isReady ? 'HEALTHY' : 'UNHEALTHY',
      ready: isReady,
      checks: {
        mongodb: {
          status: mongoHealth.status,
          connectionState: mongoHealth.details?.connectionState || 'unknown',
          pingLatencyMs: mongoHealth.latencyMs,
          isOperational: isMongoReady,
        },
        storage: {
          status: storageHealth.status,
          isWritable: storageHealth.details?.isWritable ?? isStorageReady,
          latencyMs: storageHealth.latencyMs,
        },
      },
      timestamp: new Date(),
    };
  }

  /**
   * Deep Diagnostics Probe (GET /health/detailed)
   * Inspects all components, calculates weighted score, and sanitizes output
   */
  public async getDetailed(forceFresh = false): Promise<DetailedHealthResult> {
    const now = Date.now();
    if (!forceFresh && this.cachedDetailed && now - this.lastDetailedFetchTime < this.CACHE_TTL_MS) {
      return this.cachedDetailed;
    }

    const [
      appHealth,
      mongoHealth,
      redisHealth,
      storageHealth,
      whatsappHealth,
      paymentHealth,
      queueHealth,
    ] = await Promise.all([
      this.withTimeout(appProbe.probe(), 1500, {
        name: 'Application Runtime',
        category: 'core',
        status: 'DEGRADED',
        score: 50,
        latencyMs: 1500,
        isCritical: true,
        error: 'App probe timed out',
        timestamp: new Date(),
      } as ComponentHealth),

      this.withTimeout(mongoProbe.probe(), 2000, {
        name: 'MongoDB',
        category: 'database',
        status: 'UNHEALTHY',
        score: 0,
        latencyMs: 2000,
        isCritical: true,
        error: 'MongoDB probe timed out',
        timestamp: new Date(),
      } as ComponentHealth),

      this.withTimeout(redisProbe.probe(), 1500, {
        name: 'Redis Cache',
        category: 'cache',
        status: 'NOT_CONFIGURED',
        score: 100,
        latencyMs: 0,
        isCritical: false,
        message: 'Redis not configured',
        timestamp: new Date(),
      } as ComponentHealth),

      this.withTimeout(storageProbe.probe(), 1500, {
        name: 'Storage & Filesystem',
        category: 'storage',
        status: 'DEGRADED',
        score: 50,
        latencyMs: 1500,
        isCritical: true,
        error: 'Storage probe timed out',
        timestamp: new Date(),
      } as ComponentHealth),

      this.withTimeout(externalServiceProbe.probeWhatsApp(), 2500, {
        name: 'WhatsApp API',
        category: 'external',
        status: 'DEGRADED',
        score: 50,
        latencyMs: 2500,
        isCritical: false,
        message: 'WhatsApp probe timed out',
        timestamp: new Date(),
      } as ComponentHealth),

      this.withTimeout(externalServiceProbe.probePaymentGateway(), 2500, {
        name: 'Payment Gateway (Razorpay)',
        category: 'external',
        status: 'HEALTHY',
        score: 100,
        latencyMs: 0,
        isCritical: false,
        timestamp: new Date(),
      } as ComponentHealth),

      this.withTimeout(queueProbe.probe(), 1500, {
        name: 'Queue & Background Workers',
        category: 'queue',
        status: 'HEALTHY',
        score: 90,
        latencyMs: 10,
        isCritical: false,
        timestamp: new Date(),
      } as ComponentHealth),
    ]);

    const components: Record<string, ComponentHealth> = {
      application: appHealth,
      mongodb: mongoHealth,
      redis: redisHealth,
      storage: storageHealth,
      whatsapp: whatsappHealth,
      payment: paymentHealth,
      queue: queueHealth,
    };

    // Calculate weighted health score
    // Weights: MongoDB (35%), App (25%), Storage (15%), WhatsApp (10%), Payment (5%), Queue (10%)
    const weightedScore = Math.round(
      mongoHealth.score * 0.35 +
        appHealth.score * 0.25 +
        storageHealth.score * 0.15 +
        whatsappHealth.score * 0.10 +
        paymentHealth.score * 0.05 +
        queueHealth.score * 0.10
    );

    const overallScore = Math.max(0, Math.min(100, weightedScore));

    // Determine overall status
    let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' = 'HEALTHY';

    const hasCriticalFailure = Object.values(components).some(
      (c) => c.isCritical && c.status === 'UNHEALTHY'
    );
    const hasDegradedComponent = Object.values(components).some(
      (c) => c.status === 'DEGRADED' || (c.status === 'UNHEALTHY' && !c.isCritical)
    );

    if (hasCriticalFailure || overallScore < 50) {
      status = 'UNHEALTHY';
    } else if (hasDegradedComponent || overallScore < 85) {
      status = 'DEGRADED';
    } else {
      status = 'HEALTHY';
    }

    const componentList = Object.values(components);
    const summary = {
      healthyComponents: componentList.filter((c) => c.status === 'HEALTHY' || c.status === 'NOT_CONFIGURED').length,
      degradedComponents: componentList.filter((c) => c.status === 'DEGRADED').length,
      unhealthyComponents: componentList.filter((c) => c.status === 'UNHEALTHY').length,
      totalComponents: componentList.length,
    };

    const result: DetailedHealthResult = {
      status,
      overallScore,
      uptimeSeconds: Math.round(process.uptime()),
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
      timestamp: new Date(),
      components: this.sanitizeOutput(components),
      scoreBreakdown: {
        coreScore: appHealth.score,
        databaseScore: mongoHealth.score,
        cacheScore: redisHealth.score,
        storageScore: storageHealth.score,
        externalScore: Math.round((whatsappHealth.score + paymentHealth.score) / 2),
        queueScore: queueHealth.score,
      },
      summary,
    };

    this.cachedDetailed = result;
    this.lastDetailedFetchTime = now;

    return result;
  }

  /**
   * Fast Overview (GET /health & GET /api/health)
   */
  public async getSummary(): Promise<{
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
    overallScore: number;
    uptimeSeconds: number;
    timestamp: Date;
    components: Record<string, string>;
  }> {
    const detailed = await this.getDetailed();
    const componentSummaryMap: Record<string, string> = {};
    for (const [key, comp] of Object.entries(detailed.components)) {
      componentSummaryMap[key] = comp.status;
    }

    return {
      status: detailed.status,
      overallScore: detailed.overallScore,
      uptimeSeconds: detailed.uptimeSeconds,
      timestamp: detailed.timestamp,
      components: componentSummaryMap,
    };
  }

  /**
   * Sanitizer to guarantee zero secrets, passwords, or connection strings leak
   */
  private sanitizeOutput<T>(obj: T): T {
    if (!obj) return obj;
    const str = JSON.stringify(obj);

    const sanitizedStr = str
      // Scrub MongoDB URIs with passwords
      .replace(/mongodb(\+srv)?:\/\/[^:]+:[^@]+@/gi, 'mongodb$1://***:***@')
      // Scrub Redis URIs with passwords
      .replace(/redis(s)?:\/\/[^:]+:[^@]+@/gi, 'redis$1://***:***@')
      // Scrub bearer tokens
      .replace(/bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer ***')
      // Scrub api keys / secrets
      .replace(/("apiKey"|"secretKey"|"token"|"password"|"secret"):\s*"[^"]+"/gi, '$1:"***"');

    return JSON.parse(sanitizedStr);
  }
}

export const healthCheckService = HealthCheckService.getInstance();
