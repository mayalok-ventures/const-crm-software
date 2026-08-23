import { AlertOperatorType } from '../models/AlertRule';
export interface MetricEvaluationInput {
    metricName: string;
    currentValue: number | string | boolean | null | undefined;
    operator: AlertOperatorType;
    threshold: number | string;
    durationSeconds?: number;
    lastDataTimestamp?: Date | number;
    historicalPoints?: Array<{
        timestamp: Date | number;
        value: number;
    }>;
    baselineValue?: number;
}
export interface MetricEvaluationResult {
    isBreached: boolean;
    currentValue: any;
    threshold: any;
    operator: AlertOperatorType;
    message: string;
    calculatedRate?: number;
    calculatedPercentIncrease?: number;
}
export declare class AlertEngine {
    private static instance;
    private constructor();
    static getInstance(): AlertEngine;
    /**
     * Evaluates if a given metric breaches the specified operator and threshold
     */
    evaluate(input: MetricEvaluationInput): MetricEvaluationResult;
}
export declare const alertEngine: AlertEngine;
export default alertEngine;
