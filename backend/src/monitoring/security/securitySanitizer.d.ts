/**
 * SECURITY METADATA SANITIZER
 * Recursively redacts passwords, tokens, secrets, OTPs, and card data
 * to ensure zero sensitive credential leakage into SecurityEvent or SecurityIncident.
 */
export declare function sanitizeSecurityMetadata(data: any, depth?: number): any;
