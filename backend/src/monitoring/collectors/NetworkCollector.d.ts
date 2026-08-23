export declare class NetworkCollector {
    private lastRxBytes;
    private lastTxBytes;
    private lastTimestamp;
    collect(): Promise<{
        uploadBytesSec: number;
        downloadBytesSec: number;
    }>;
}
