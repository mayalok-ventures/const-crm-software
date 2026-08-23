export declare class ApiKeySecurityWorker {
    private static instance;
    private intervalId;
    private isRunning;
    static getInstance(): ApiKeySecurityWorker;
    start(intervalMs?: number): void;
    stop(): void;
    runCycle(): Promise<void>;
    /**
     * Seeds demo API keys with realistic multi-tenant usage, alerts, and historical metrics
     */
    seedDemoApiKeys(): Promise<void>;
}
export declare const apiKeySecurityWorker: ApiKeySecurityWorker;
export default apiKeySecurityWorker;
