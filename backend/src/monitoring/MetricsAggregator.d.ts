export declare class MetricsAggregator {
    private intervalId;
    private intervalMs;
    start(): void;
    stop(): void;
    runAggregation(): Promise<void>;
    aggregateServerMetrics(start: Date, end: Date): Promise<void>;
    aggregateApiMetrics(start: Date, end: Date): Promise<void>;
    private enforceRetentionPolicies;
}
export default MetricsAggregator;
