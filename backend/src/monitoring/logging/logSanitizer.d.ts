/**
 * Production-Grade Log & Payload Sanitizer
 * Automatically redacts sensitive fields (passwords, tokens, keys, cookies, OTPs, cards).
 */
export declare function isSensitiveKey(key: string): boolean;
/**
 * Deeply sanitizes any object, array, or primitive value
 */
export declare function sanitizeLogData(data: any, depth?: number): any;
