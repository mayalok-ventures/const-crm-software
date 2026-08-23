export declare class SystemMetricsCollector {
    private cpuCollector;
    private memoryCollector;
    private diskCollector;
    private networkCollector;
    private processCollector;
    collect(): Promise<{
        cpu: {
            usagePercent: number;
            cores: number;
            loadAvg: number[];
        };
        ram: {
            totalBytes: number;
            usedBytes: number;
            freeBytes: number;
            usagePercent: number;
        };
        disk: {
            totalBytes: number;
            usedBytes: number;
            freeBytes: number;
            usagePercent: number;
        };
        network: {
            uploadBytesSec: number;
            downloadBytesSec: number;
        };
        process: {
            cpuPercent: number;
            memoryBytes: number;
            pm2Status: string;
            pm2Restarts: number;
        };
        uptime: number;
        hostname: string;
        os: string;
        nodeVersion: string;
    }>;
}
