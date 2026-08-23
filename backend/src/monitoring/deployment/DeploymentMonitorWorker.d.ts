export declare class DeploymentMonitorWorker {
    private static instance;
    private intervalId;
    private isRunning;
    private constructor();
    static getInstance(): DeploymentMonitorWorker;
    start(intervalMs?: number): void;
    stop(): void;
    runEvaluationCycle(): Promise<void>;
    seedDefaultDeployments(): Promise<void>;
}
export declare const deploymentMonitorWorker: DeploymentMonitorWorker;
export default deploymentMonitorWorker;
