export interface ParsedStackFrame {
    functionName: string;
    fileName: string;
    lineNumber: number;
    columnNumber: number;
}
/**
 * Parses raw stack trace to extract the primary application frame
 */
export declare function parseStackTrace(stack?: string): {
    primaryFrame: string;
    cleanStack: string;
};
/**
 * Normalizes error messages by replacing variable IDs, Hex strings, and timestamps
 */
export declare function normalizeErrorMessage(message?: string): string;
/**
 * Generates a stable, deterministic Error Fingerprint
 */
export declare function generateErrorFingerprint(errorType: string, message: string, stack?: string): string;
/**
 * Sanitizes request headers and bodies for error tracking
 */
export declare function sanitizeErrorContext(context: Record<string, any>): Record<string, any>;
