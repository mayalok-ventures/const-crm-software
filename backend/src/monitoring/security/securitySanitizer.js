"use strict";
/**
 * SECURITY METADATA SANITIZER
 * Recursively redacts passwords, tokens, secrets, OTPs, and card data
 * to ensure zero sensitive credential leakage into SecurityEvent or SecurityIncident.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeSecurityMetadata = sanitizeSecurityMetadata;
const SENSITIVE_KEY_PATTERNS = [
    /password/i,
    /pass/i,
    /secret/i,
    /token/i,
    /jwt/i,
    /authorization/i,
    /cookie/i,
    /apikey/i,
    /api_key/i,
    /otp/i,
    /code/i,
    /pin/i,
    /recovery/i,
    /card/i,
    /cvv/i,
    /credit/i,
    /auth/i,
];
function sanitizeSecurityMetadata(data, depth = 0) {
    if (depth > 6 || data === null || data === undefined) {
        return data;
    }
    if (typeof data !== 'object') {
        if (typeof data === 'string') {
            // Redact potential Bearer tokens or JWTs
            if (/^Bearer\s+[A-Za-z0-9\-_.]+/i.test(data) || /^[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}/.test(data)) {
                return '[REDACTED_TOKEN]';
            }
        }
        return data;
    }
    if (Array.isArray(data)) {
        return data.map((item) => sanitizeSecurityMetadata(item, depth + 1));
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
        if (isSensitiveKey) {
            sanitized[key] = '[REDACTED]';
        }
        else {
            sanitized[key] = sanitizeSecurityMetadata(value, depth + 1);
        }
    }
    return sanitized;
}
