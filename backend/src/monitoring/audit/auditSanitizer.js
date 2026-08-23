"use strict";
/**
 * AUDIT DATA SANITIZER
 * Recursively strips passwords, tokens, API key secrets, OTPs, recovery codes,
 * and payment card details so audit snapshots NEVER store sensitive secrets.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeAuditData = sanitizeAuditData;
const SENSITIVE_PATTERNS = [
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
    /pin/i,
    /cvv/i,
    /creditcard/i,
    /cardnumber/i,
    /twofactorsecret/i,
    /recoverycodes/i,
    /temp2fa/i,
];
function sanitizeAuditData(data, depth = 0) {
    if (depth > 6 || data === null || data === undefined) {
        return data;
    }
    if (typeof data !== 'object') {
        if (typeof data === 'string') {
            if (/^Bearer\s+[A-Za-z0-9\-_.]+/i.test(data) || /^[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}\.[A-Za-z0-9\-_]{20,}/.test(data)) {
                return '[REDACTED_TOKEN]';
            }
        }
        return data;
    }
    if (Array.isArray(data)) {
        return data.map((item) => sanitizeAuditData(item, depth + 1));
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(data)) {
        const isSensitive = SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
        if (isSensitive) {
            sanitized[key] = '[REDACTED]';
        }
        else {
            sanitized[key] = sanitizeAuditData(value, depth + 1);
        }
    }
    return sanitized;
}
