import { FleetUsageSummary } from './usageAggregatorService';
export declare class UsageMonitorWorker {
    private static instance;
    private intervalTimer;
    private intervalMs;
    private isCollecting;
    private latestFleetSummary;
    constructor();
    static getInstance(): UsageMonitorWorker;
    /**
     * Starts periodic aggregation worker
     */
    start(intervalMs?: number): void;
    /**
     * Stops background worker
     */
    stop(): void;
    /**
     * Executes aggregation cycle
     */
    collect(): Promise<FleetUsageSummary>;
    /**
     * Returns cached fleet summary instantly (<1ms)
     */
    getSummary(): Promise<FleetUsageSummary>;
    /**
     * Seeds demo multi-tenant organizations if none exist (matches user prompt requirements)
     */
    ensureSeedData(): Promise<void>;
}
export declare const usageMonitorWorker: UsageMonitorWorker;
export default usageMonitorWorker;
