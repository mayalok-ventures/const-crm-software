export declare class MonitoringAgent {
    private collector;
    private healthCalculator;
    private intervalId;
    private serverId;
    private environment;
    private collectionIntervalMs;
    constructor();
    start(): Promise<void>;
    stop(): void;
    private registerServer;
    private collectAndPersist;
}
export default MonitoringAgent;
