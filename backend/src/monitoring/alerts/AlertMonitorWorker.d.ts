export interface CachedAlertDashboardState {
    counts: {
        activeCritical: number;
        activeWarning: number;
        activeInfo: number;
        totalOpen: number;
        totalResolved24h: number;
        totalAlerts24h: number;
    };
    metrics: {
        mttaMinutes: number;
        mttrMinutes: number;
        deliverySuccessRate: number;
    };
    recentIncidents: any[];
    recentAlerts: any[];
    activeRulesCount: number;
    activeChannelsCount: number;
    lastEvaluatedAt: Date;
}
export declare class AlertMonitorWorker {
    private static instance;
    private intervalTimer;
    private intervalMs;
    private isEvaluating;
    private latestState;
    private constructor();
    static getInstance(): AlertMonitorWorker;
    start(intervalMs?: number): void;
    stop(): void;
    getLatestState(): CachedAlertDashboardState;
    /**
     * Main evaluation loop
     */
    evaluate(): Promise<CachedAlertDashboardState>;
    /**
     * Refreshes the fast in-memory telemetry state for admin dashboard
     */
    refreshCachedState(): Promise<void>;
    /**
     * Collects current values from each monitoring subsystem
     */
    private gatherTelemetrySnapshot;
    /**
     * Extracts metric value and metadata for evaluation
     */
    private extractMetricData;
    /**
     * Seeds 9 default out-of-the-box alert rules & default webhook channel
     */
    private ensureDefaultRulesAndChannels;
    private getFallbackState;
}
export declare const alertMonitorWorker: AlertMonitorWorker;
export default alertMonitorWorker;
