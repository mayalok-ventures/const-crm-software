/**
 * Database Health Score Calculator
 * Computes composite health score (0 - 100%) based on:
 * - Availability (35%)
 * - Ping / Query Latency (25%)
 * - Error / Failed Operation Rates (25%)
 * - Resource Headroom & Connection Indicators (15%)
 */

export interface DatabaseScoreInputs {
  readyState: number; // 0=disconnected, 1=connected, 2=connecting, 3=disconnecting
  pingLatencyMs: number;
  availabilityPercent?: number;
  failedOperationsCount?: number;
  totalOperationsCount?: number;
  activeConnections?: number;
  maxConnections?: number;
  slowQueryCount?: number;
}

export interface DatabaseScoreResult {
  score: number; // 0 - 100
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'DOWN';
  breakdown: {
    availabilityScore: number;
    latencyScore: number;
    errorScore: number;
    resourceScore: number;
  };
}

export function calculateDatabaseHealthScore(inputs: DatabaseScoreInputs): DatabaseScoreResult {
  const {
    readyState,
    pingLatencyMs = 0,
    availabilityPercent = 100,
    failedOperationsCount = 0,
    totalOperationsCount = 100,
    activeConnections = 5,
    maxConnections = 50,
    slowQueryCount = 0,
  } = inputs;

  // 1. AVAILABILITY SCORE (Weight: 35%)
  let availabilityScore = 100;
  if (readyState !== 1) {
    // Disconnected or unstable
    availabilityScore = readyState === 2 ? 40 : 0;
  } else {
    // ReadyState is connected, scale by historical availability window
    availabilityScore = Math.max(0, Math.min(100, availabilityPercent));
  }

  // 2. LATENCY SCORE (Weight: 25%)
  let latencyScore = 100;
  if (readyState !== 1) {
    latencyScore = 0;
  } else if (pingLatencyMs <= 20) {
    latencyScore = 100;
  } else if (pingLatencyMs <= 50) {
    // 20ms - 50ms (Normal acceptable latency)
    latencyScore = 90 - ((pingLatencyMs - 20) / 30) * 15; // 90 -> 75
  } else if (pingLatencyMs <= 150) {
    // 50ms - 150ms (Mild delay)
    latencyScore = 75 - ((pingLatencyMs - 50) / 100) * 25; // 75 -> 50
  } else if (pingLatencyMs <= 300) {
    // 150ms - 300ms (High latency)
    latencyScore = 50 - ((pingLatencyMs - 150) / 150) * 30; // 50 -> 20
  } else {
    // > 300ms (Degraded / Severe lag)
    latencyScore = Math.max(5, 20 - ((pingLatencyMs - 300) / 500) * 15);
  }

  // 3. ERROR & FAILED OPS SCORE (Weight: 25%)
  let errorScore = 100;
  if (readyState !== 1) {
    errorScore = 0;
  } else if (totalOperationsCount > 0) {
    const errorRate = (failedOperationsCount / Math.max(1, totalOperationsCount)) * 100;
    if (errorRate === 0) {
      errorScore = 100;
    } else if (errorRate < 1) {
      errorScore = 90;
    } else if (errorRate < 5) {
      errorScore = 70;
    } else if (errorRate < 15) {
      errorScore = 40;
    } else {
      errorScore = Math.max(0, 30 - errorRate);
    }
  }

  // Deduct slightly for active slow queries
  if (slowQueryCount > 0) {
    const slowDeduction = Math.min(15, slowQueryCount * 2);
    errorScore = Math.max(0, errorScore - slowDeduction);
  }

  // 4. RESOURCE & CONNECTION INDICATORS (Weight: 15%)
  let resourceScore = 100;
  if (readyState !== 1) {
    resourceScore = 0;
  } else {
    const connUtilization = maxConnections > 0 ? (activeConnections / maxConnections) * 100 : 10;
    if (connUtilization <= 70) {
      resourceScore = 100;
    } else if (connUtilization <= 85) {
      resourceScore = 80;
    } else if (connUtilization <= 95) {
      resourceScore = 50;
    } else {
      resourceScore = 20;
    }
  }

  // Composite Weighted Calculation
  const compositeScore = Math.round(
    availabilityScore * 0.35 +
      latencyScore * 0.25 +
      errorScore * 0.25 +
      resourceScore * 0.15
  );

  const finalScore = Math.max(0, Math.min(100, compositeScore));

  let status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'DOWN' = 'HEALTHY';
  if (readyState !== 1 || finalScore < 30) {
    status = 'DOWN';
  } else if (finalScore < 60) {
    status = 'UNHEALTHY';
  } else if (finalScore < 85) {
    status = 'DEGRADED';
  }

  return {
    score: finalScore,
    status,
    breakdown: {
      availabilityScore: Math.round(availabilityScore),
      latencyScore: Math.round(latencyScore),
      errorScore: Math.round(errorScore),
      resourceScore: Math.round(resourceScore),
    },
  };
}

export default {
  calculateDatabaseHealthScore,
};
