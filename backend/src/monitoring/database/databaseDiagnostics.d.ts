/**
 * Database Diagnostics Engine
 * Classifies failure states to clearly distinguish:
 * 1. Application Down / Process Blocked
 * 2. Database Down / Disconnected
 * 3. Network Failure / DNS / Timeout
 */
export type FailureMode = 'HEALTHY' | 'APP_ISSUE' | 'DB_DOWN' | 'NETWORK_FAILURE';
export interface DiagnosticResult {
    mode: FailureMode;
    title: string;
    message: string;
    isOperational: boolean;
    recoveryAdvice: string;
}
export declare function diagnoseDatabaseFailure(readyState: number, error?: any, pingLatencyMs?: number, eventLoopLagMs?: number): DiagnosticResult;
declare const _default: {
    diagnoseDatabaseFailure: typeof diagnoseDatabaseFailure;
};
export default _default;
