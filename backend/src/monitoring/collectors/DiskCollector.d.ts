export declare class DiskCollector {
    collect(): Promise<{
        totalBytes: number;
        usedBytes: number;
        freeBytes: number;
        usagePercent: number;
    }>;
}
