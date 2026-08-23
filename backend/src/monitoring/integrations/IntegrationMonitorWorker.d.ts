export declare class IntegrationMonitorWorker {
    private static instance;
    private intervalTimer;
    private isRunning;
    static getInstance(): IntegrationMonitorWorker;
    /**
     * Starts background evaluation worker
     */
    start(intervalMs?: number): Promise<void>;
    /**
     * Stops worker gracefully
     */
    stop(): void;
    /**
     * Auto-seeds standard CRM external integrations
     */
    seedStandardIntegrations(): Promise<void>;
    /**
     * Seeds alert rules for integration outages and error spikes
     */
    seedIntegrationAlertRules(): Promise<void>;
    /**
     * Evaluates external integrations using safe, non-metered reachability checks
     */
    evaluateHealth(): Promise<void>;
}
export declare const integrationMonitorWorker: IntegrationMonitorWorker;
