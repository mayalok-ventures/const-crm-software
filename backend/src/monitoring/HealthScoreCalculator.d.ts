export interface HealthWeights {
    cpu: number;
    ram: number;
    disk: number;
    process: number;
    uptime: number;
    network: number;
}
export interface MetricThresholds {
    warning: number;
    critical: number;
    severe: number;
}
export interface ThresholdConfig {
    cpu: MetricThresholds;
    ram: MetricThresholds;
    disk: MetricThresholds;
    process: MetricThresholds;
}
export declare class HealthScoreCalculator {
    private weights;
    private thresholds;
    constructor(customWeights?: Partial<HealthWeights>, customThresholds?: Partial<ThresholdConfig>);
    private normalizeWeights;
    calculateResourceScore(usage: number, t: MetricThresholds): number;
    calculate(metrics: {
        cpuUsage: number;
        ramUsage: number;
        diskUsage: number;
        processCpu: number;
        networkActive: boolean;
        uptimeSeconds: number;
    }): {
        overall: number;
        cpu: number;
        ram: number;
        disk: number;
        process: number;
        uptime: number;
        network: number;
    };
}
export default HealthScoreCalculator;
export declare const DEFAULT_THRESHOLDS: {
    cpu: {
        warning: number;
        critical: number;
        severe: number;
    };
    ram: {
        warning: number;
        critical: number;
        severe: number;
    };
    disk: {
        warning: number;
        critical: number;
        severe: number;
    };
    process: {
        warning: number;
        critical: number;
        severe: number;
    };
};
