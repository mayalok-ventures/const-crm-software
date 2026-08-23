/**
 * AUDIT DATA SANITIZER
 * Recursively strips passwords, tokens, API key secrets, OTPs, recovery codes,
 * and payment card details so audit snapshots NEVER store sensitive secrets.
 */
export declare function sanitizeAuditData(data: any, depth?: number): any;
