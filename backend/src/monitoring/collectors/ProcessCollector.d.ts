export declare class ProcessCollector {
    private lastCpuUsage;
    private lastTime;
    collect(): {
        cpuPercent: number;
        memoryBytes: number;
        pm2Status: string;
        pm2Restarts: number;
    };
}
