import { DEFAULT_THRESHOLDS, IHealthThresholds } from '../models/HealthWeightConfig';
import { HealthStatus } from '../models/PlatformHealthSnapshot';

export class MetricNormalizer {
  /**
   * Normalizes percentage resource usage (CPU, RAM, Disk, Quota) into a 0 - 100 score.
   * Uses a smooth continuous polynomial curve instead of stepped jumps.
   */
  public static normalizeUsage(
    usage: number,
    warning: number = 75,
    critical: number = 90
  ): number {
    const u = Math.max(0, Math.min(100, usage));

    if (u <= 50) {
      // 0% - 50% usage: 100 -> 95 points
      return Math.round((100 - (u / 50) * 5) * 10) / 10;
    } else if (u <= warning) {
      // 50% - warning% usage: 95 -> 80 points
      const ratio = (u - 50) / (warning - 50 || 1);
      return Math.round((95 - ratio * 15) * 10) / 10;
    } else if (u <= critical) {
      // warning% - critical% usage: 80 -> 45 points
      const ratio = (u - warning) / (critical - warning || 1);
      return Math.round((80 - ratio * 35) * 10) / 10;
    } else {
      // critical% - 100% usage: 45 -> 0 points
      const ratio = (u - critical) / (100 - critical || 1);
      return Math.max(0, Math.round((45 - ratio * 45) * 10) / 10);
    }
  }

  /**
   * Normalizes latency (in milliseconds) into a 0 - 100 score.
   */
  public static normalizeLatency(
    latencyMs: number,
    optimalTarget: number = 100,
    warningTarget: number = 300,
    criticalTarget: number = 1000
  ): number {
    const lat = Math.max(0, latencyMs);

    if (lat <= optimalTarget) {
      // 0 - optimal (e.g. 100ms): 100 -> 95 points
      return Math.round((100 - (lat / optimalTarget) * 5) * 10) / 10;
    } else if (lat <= warningTarget) {
      // optimal - warning (e.g. 100ms - 300ms): 95 -> 75 points
      const ratio = (lat - optimalTarget) / (warningTarget - optimalTarget || 1);
      return Math.round((95 - ratio * 20) * 10) / 10;
    } else if (lat <= criticalTarget) {
      // warning - critical (e.g. 300ms - 1000ms): 75 -> 30 points
      const ratio = (lat - warningTarget) / (criticalTarget - warningTarget || 1);
      return Math.round((75 - ratio * 45) * 10) / 10;
    } else {
      // > critical (e.g. >1000ms): decays from 30 down to 0 at 2000ms+
      const excessRatio = Math.min(1, (lat - criticalTarget) / 1000);
      return Math.max(0, Math.round((30 - excessRatio * 30) * 10) / 10);
    }
  }

  /**
   * Normalizes error rates (% of failed requests / total requests) into a 0 - 100 score.
   */
  public static normalizeErrorRate(
    errorRatePct: number,
    warningPct: number = 1.0,
    criticalPct: number = 5.0
  ): number {
    const err = Math.max(0, Math.min(100, errorRatePct));

    if (err <= 0.05) {
      return 100;
    } else if (err <= warningPct) {
      // 0.05% - 1.0%: 100 -> 85 points
      const ratio = err / warningPct;
      return Math.round((100 - ratio * 15) * 10) / 10;
    } else if (err <= criticalPct) {
      // 1.0% - 5.0%: 85 -> 40 points
      const ratio = (err - warningPct) / (criticalPct - warningPct || 1);
      return Math.round((85 - ratio * 45) * 10) / 10;
    } else {
      // > 5.0%: 40 -> 0 points (0 points at 15% error rate)
      const ratio = Math.min(1, (err - criticalPct) / 10);
      return Math.max(0, Math.round((40 - ratio * 40) * 10) / 10);
    }
  }

  /**
   * Normalizes availability uptime percentage into a 0 - 100 score.
   */
  public static normalizeUptime(uptimePct: number): number {
    const u = Math.max(0, Math.min(100, uptimePct));

    if (u >= 99.99) return 100;
    if (u >= 99.9) {
      // 99.9% to 99.99%: 95 -> 100
      const ratio = (u - 99.9) / 0.09;
      return Math.round((95 + ratio * 5) * 10) / 10;
    }
    if (u >= 99.0) {
      // 99.0% to 99.9%: 80 -> 95
      const ratio = (u - 99.0) / 0.9;
      return Math.round((80 + ratio * 15) * 10) / 10;
    }
    if (u >= 95.0) {
      // 95.0% to 99.0%: 50 -> 80
      const ratio = (u - 95.0) / 4.0;
      return Math.round((50 + ratio * 30) * 10) / 10;
    }
    // < 95%: 0 -> 50
    const ratio = Math.max(0, u / 95.0);
    return Math.round(ratio * 50 * 10) / 10;
  }

  /**
   * Evaluates discrete status string from calculated numerical score.
   */
  public static getStatusFromScore(
    score: number,
    thresholds: IHealthThresholds = DEFAULT_THRESHOLDS
  ): HealthStatus {
    if (score >= thresholds.excellentMin) return 'EXCELLENT';
    if (score >= thresholds.healthyMin) return 'HEALTHY';
    if (score >= thresholds.goodMin) return 'GOOD';
    if (score >= thresholds.warningMin) return 'WARNING';
    if (score >= thresholds.degradedMin) return 'DEGRADED';
    return 'CRITICAL';
  }

  /**
   * Calculates confidence score (0 - 100%) based on availability and freshness of metrics.
   */
  public static calculateConfidence(
    metricSources: Array<{ name: string; isAvailable: boolean; ageSeconds: number; maxAgeSeconds: number }>
  ): { confidence: number; warning?: string; staleCount: number } {
    if (!metricSources || metricSources.length === 0) {
      return { confidence: 100, staleCount: 0 };
    }

    let availableCount = 0;
    let staleCount = 0;
    const missingOrStale: string[] = [];

    for (const src of metricSources) {
      if (!src.isAvailable) {
        missingOrStale.push(`${src.name} (unavailable)`);
      } else if (src.ageSeconds > src.maxAgeSeconds) {
        staleCount++;
        missingOrStale.push(`${src.name} (stale: ${Math.round(src.ageSeconds / 60)}m old)`);
      } else {
        availableCount++;
      }
    }

    const ratio = availableCount / metricSources.length;
    const confidence = Math.round(ratio * 100);

    let warning: string | undefined = undefined;
    if (missingOrStale.length > 0) {
      warning = `Reduced confidence (${confidence}%): ${missingOrStale.join(', ')}`;
    }

    return { confidence, warning, staleCount };
  }
}

export default MetricNormalizer;
