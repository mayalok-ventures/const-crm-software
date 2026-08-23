"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.alertEngine = exports.AlertEngine = void 0;
class AlertEngine {
    static instance;
    constructor() { }
    static getInstance() {
        if (!AlertEngine.instance) {
            AlertEngine.instance = new AlertEngine();
        }
        return AlertEngine.instance;
    }
    /**
     * Evaluates if a given metric breaches the specified operator and threshold
     */
    evaluate(input) {
        const { metricName, currentValue, operator, threshold, lastDataTimestamp, historicalPoints = [], baselineValue, } = input;
        let isBreached = false;
        let message = '';
        let calculatedRate;
        let calculatedPercentIncrease;
        switch (operator) {
            case '>': {
                const numVal = Number(currentValue);
                const numThresh = Number(threshold);
                if (!isNaN(numVal) && !isNaN(numThresh)) {
                    isBreached = numVal > numThresh;
                    message = isBreached
                        ? `${metricName} is ${numVal}, exceeding threshold of > ${numThresh}`
                        : `${metricName} is normal (${numVal} <= ${numThresh})`;
                }
                break;
            }
            case '<': {
                const numVal = Number(currentValue);
                const numThresh = Number(threshold);
                if (!isNaN(numVal) && !isNaN(numThresh)) {
                    isBreached = numVal < numThresh;
                    message = isBreached
                        ? `${metricName} is ${numVal}, below threshold of < ${numThresh}`
                        : `${metricName} is normal (${numVal} >= ${numThresh})`;
                }
                break;
            }
            case '>=': {
                const numVal = Number(currentValue);
                const numThresh = Number(threshold);
                if (!isNaN(numVal) && !isNaN(numThresh)) {
                    isBreached = numVal >= numThresh;
                    message = isBreached
                        ? `${metricName} is ${numVal}, meeting/exceeding threshold of >= ${numThresh}`
                        : `${metricName} is normal (${numVal} < ${numThresh})`;
                }
                break;
            }
            case '<=': {
                const numVal = Number(currentValue);
                const numThresh = Number(threshold);
                if (!isNaN(numVal) && !isNaN(numThresh)) {
                    isBreached = numVal <= numThresh;
                    message = isBreached
                        ? `${metricName} is ${numVal}, meeting/below threshold of <= ${numThresh}`
                        : `${metricName} is normal (${numVal} > ${numThresh})`;
                }
                break;
            }
            case '==': {
                const strVal = String(currentValue ?? '').trim().toUpperCase();
                const strThresh = String(threshold ?? '').trim().toUpperCase();
                isBreached = strVal === strThresh;
                message = isBreached
                    ? `${metricName} matches alert condition (${strVal} == ${strThresh})`
                    : `${metricName} is ${strVal} != ${strThresh}`;
                break;
            }
            case 'rate_increase': {
                // Calculate rate of increase per minute
                const numThresh = Number(threshold);
                if (historicalPoints.length >= 2) {
                    const first = historicalPoints[0];
                    const last = historicalPoints[historicalPoints.length - 1];
                    const timeDeltaMin = (new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()) / (1000 * 60);
                    if (timeDeltaMin > 0) {
                        const valDelta = Number(last.value) - Number(first.value);
                        calculatedRate = Number((valDelta / timeDeltaMin).toFixed(2));
                        isBreached = calculatedRate > numThresh;
                        message = isBreached
                            ? `${metricName} rate increased by ${calculatedRate}/min, exceeding threshold of ${numThresh}/min`
                            : `${metricName} rate increase is ${calculatedRate}/min (<= ${numThresh}/min)`;
                    }
                }
                else {
                    // If no history, compare against threshold directly if single point rate
                    const numVal = Number(currentValue);
                    isBreached = numVal > numThresh;
                    calculatedRate = numVal;
                    message = isBreached
                        ? `${metricName} rate is ${numVal}/min (threshold: ${numThresh}/min)`
                        : `${metricName} rate is nominal`;
                }
                break;
            }
            case 'percentage_increase': {
                const numVal = Number(currentValue);
                const numThresh = Number(threshold);
                const base = baselineValue ?? (historicalPoints.length > 0 ? historicalPoints[0].value : 0);
                if (base > 0 && !isNaN(numVal)) {
                    calculatedPercentIncrease = Number((((numVal - base) / base) * 100).toFixed(1));
                    isBreached = calculatedPercentIncrease > numThresh;
                    message = isBreached
                        ? `${metricName} increased by ${calculatedPercentIncrease}%, exceeding threshold of ${numThresh}% (Base: ${base}, Current: ${numVal})`
                        : `${metricName} increase is ${calculatedPercentIncrease}% (<= ${numThresh}%)`;
                }
                else if (base === 0 && numVal > 0) {
                    calculatedPercentIncrease = 100;
                    isBreached = calculatedPercentIncrease > numThresh;
                    message = isBreached
                        ? `${metricName} increased from 0 to ${numVal}`
                        : `${metricName} within thresholds`;
                }
                break;
            }
            case 'absence_data': {
                const durationSec = Number(input.durationSeconds || threshold || 300);
                const now = Date.now();
                const lastSeen = lastDataTimestamp ? new Date(lastDataTimestamp).getTime() : 0;
                const elapsedSec = lastSeen > 0 ? Math.floor((now - lastSeen) / 1000) : Infinity;
                isBreached = elapsedSec >= durationSec || lastSeen === 0;
                message = isBreached
                    ? `Absence of data for ${metricName}: no telemetry received for ${elapsedSec === Infinity ? 'unknown' : `${elapsedSec}s`} (Threshold: ${durationSec}s)`
                    : `${metricName} telemetry active (last seen ${elapsedSec}s ago)`;
                break;
            }
            default: {
                isBreached = false;
                message = `Unsupported operator: ${operator}`;
            }
        }
        return {
            isBreached,
            currentValue,
            threshold,
            operator,
            message,
            calculatedRate,
            calculatedPercentIncrease,
        };
    }
}
exports.AlertEngine = AlertEngine;
exports.alertEngine = AlertEngine.getInstance();
exports.default = exports.alertEngine;
