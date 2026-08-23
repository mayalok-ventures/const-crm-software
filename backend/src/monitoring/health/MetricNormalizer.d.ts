import { IHealthThresholds } from '../models/HealthWeightConfig';
import { HealthStatus } from '../models/PlatformHealthSnapshot';
export declare class MetricNormalizer {
    /**
     * Normalizes percentage resource usage (CPU, RAM, Disk, Quota) into a 0 - 100 score.
     * Uses a smooth continuous polynomial curve instead of stepped jumps.
     */
    static normalizeUsage(usage: number, warning?: number, critical?: number): number;
    /**
     * Normalizes latency (in milliseconds) into a 0 - 100 score.
     */
    static normalizeLatency(latencyMs: number, optimalTarget?: number, warningTarget?: number, criticalTarget?: number): number;
    /**
     * Normalizes error rates (% of failed requests / total requests) into a 0 - 100 score.
     */
    static normalizeErrorRate(errorRatePct: number, warningPct?: number, criticalPct?: number): number;
    /**
     * Normalizes availability uptime percentage into a 0 - 100 score.
     */
    static normalizeUptime(uptimePct: number): number;
    /**
     * Evaluates discrete status string from calculated numerical score.
     */
    static getStatusFromScore(score: number, thresholds?: IHealthThresholds): HealthStatus;
    /**
     * Calculates confidence score (0 - 100%) based on availability and freshness of metrics.
     */
    static calculateConfidence(metricSources: Array<{
        name: string;
        isAvailable: boolean;
        ageSeconds: number;
        maxAgeSeconds: number;
    }>): {
        confidence: number;
        warning?: string;
        staleCount: number;
    };
}
export default MetricNormalizer;
