export declare class ServerHeartbeat {
    private intervalId;
    private serverId;
    private applicationId;
    private environment;
    private agentVersion;
    private applicationVersion;
    private heartbeatIntervalMs;
    private heartbeatUrl;
    constructor();
    start(): void;
    stop(): void;
    private sendHeartbeat;
}
export default ServerHeartbeat;
