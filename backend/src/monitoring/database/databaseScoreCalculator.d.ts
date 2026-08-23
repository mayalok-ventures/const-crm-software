/**
 * Database Health Score Calculator
 * Computes composite health score (0 - 100%) based on:
 * - Availability (35%)
 * - Ping / Query Latency (25%)
 * - Error / Failed Operation Rates (25%)
 * - Resource Headroom & Connection Indicators (15%)
 */
export interface DatabaseScoreInputs {
    readyState: number;
    pingLatencyMs: number;
    availabilityPercent?: number;
    failedOperationsCount?: number;
    totalOperationsCount?: number;
    activeConnections?: number;
    maxConnections?: number;
    slowQueryCount?: number;
}
export interface DatabaseScoreResult {
    score: number;
    status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'DOWN';
    breakdown: {
        availabilityScore: number;
        latencyScore: number;
        errorScore: number;
        resourceScore: number;
    };
}
export declare function calculateDatabaseHealthScore(inputs: DatabaseScoreInputs): DatabaseScoreResult;
declare const _default: {
    calculateDatabaseHealthScore: typeof calculateDatabaseHealthScore;
};
export default _default;
