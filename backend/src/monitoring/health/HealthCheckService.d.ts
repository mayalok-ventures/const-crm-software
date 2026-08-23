import { LivenessResult, ReadinessResult, DetailedHealthResult } from './healthTypes';
export declare class HealthCheckService {
    private static instance;
    private cachedDetailed;
    private lastDetailedFetchTime;
    private readonly CACHE_TTL_MS;
    static getInstance(): HealthCheckService;
    /**
     * Safe timeout wrapper preventing any probe from hanging indefinitely
     */
    withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T>;
    /**
     * Kubernetes Liveness Probe (GET /health/live)
     * Super fast in-memory inspection of process and event loop responsiveness
     */
    getLiveness(): Promise<LivenessResult>;
    /**
     * Kubernetes Readiness Probe (GET /health/ready)
     * Verifies critical dependencies can serve traffic (MongoDB, Filesystem Storage)
     */
    getReadiness(): Promise<ReadinessResult>;
    /**
     * Deep Diagnostics Probe (GET /health/detailed)
     * Inspects all components, calculates weighted score, and sanitizes output
     */
    getDetailed(forceFresh?: boolean): Promise<DetailedHealthResult>;
    /**
     * Fast Overview (GET /health & GET /api/health)
     */
    getSummary(): Promise<{
        status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
        overallScore: number;
        uptimeSeconds: number;
        timestamp: Date;
        components: Record<string, string>;
    }>;
    /**
     * Sanitizer to guarantee zero secrets, passwords, or connection strings leak
     */
    private sanitizeOutput;
}
export declare const healthCheckService: HealthCheckService;
