export declare class HealthScoreWorker {
    private static instance;
    private intervalId;
    private isRunning;
    static getInstance(): HealthScoreWorker;
    start(intervalMs?: number): void;
    stop(): void;
    runCycle(): Promise<void>;
    /**
     * If snapshot count is low (< 10), seeds realistic historical snapshots over the last 24h.
     */
    private ensureHistoricalSnapshots;
}
export declare const healthScoreWorker: HealthScoreWorker;
export default healthScoreWorker;
