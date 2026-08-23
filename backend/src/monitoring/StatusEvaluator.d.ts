export declare class StatusEvaluator {
    private intervalId;
    private intervalMs;
    start(): void;
    stop(): void;
    evaluateStatuses(): Promise<void>;
}
export default StatusEvaluator;
