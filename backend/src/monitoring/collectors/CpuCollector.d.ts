export declare class CpuCollector {
    private lastCpuTimes;
    collect(): {
        usagePercent: number;
        cores: number;
        loadAvg: number[];
    };
}
