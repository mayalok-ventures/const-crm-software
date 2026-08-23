"use strict";
/**
 * Database Sanitizer
 * Deeply sanitizes MongoDB connection strings, credentials, and query filters
 * to prevent any secret or sensitive business parameter leakage in telemetry.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeMongoUri = sanitizeMongoUri;
exports.sanitizeQueryFilter = sanitizeQueryFilter;
exports.sanitizeErrorMessage = sanitizeErrorMessage;
const SENSITIVE_KEY_PATTERNS = [
    /password/i,
    /passwd/i,
    /secret/i,
    /token/i,
    /jwt/i,
    /auth/i,
    /apikey/i,
    /api_key/i,
    /creditcard/i,
    /cardnumber/i,
    /cvv/i,
    /pin/i,
    /otp/i,
    /twofactor/i,
    /2fa/i,
    /privatekey/i,
    /certificate/i,
];
/**
 * Sanitizes MongoDB connection URIs by redacting the credentials segment.
 * Example: mongodb+srv://admin:pass123@cluster.mongodb.net/crm -> mongodb+srv://admin:***@cluster.mongodb.net/crm
 */
function sanitizeMongoUri(uri) {
    if (!uri || typeof uri !== 'string')
        return '';
    return uri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/i, '$1***$3');
}
/**
 * Recursively redacts sensitive keys and values from query filter objects.
 */
function sanitizeQueryFilter(obj, depth = 0) {
    if (depth > 6)
        return '[MAX_DEPTH_EXCEEDED]';
    if (obj === null || obj === undefined)
        return obj;
    if (typeof obj !== 'object') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map((item) => sanitizeQueryFilter(item, depth + 1));
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        // Check if key matches sensitive patterns
        const isSensitive = SENSITIVE_KEY_PATTERNS.some((p) => p.test(key));
        if (isSensitive) {
            sanitized[key] = '[REDACTED]';
        }
        else if (value && typeof value === 'object') {
            sanitized[key] = sanitizeQueryFilter(value, depth + 1);
        }
        else {
            sanitized[key] = value;
        }
    }
    return sanitized;
}
/**
 * Sanitizes error messages by masking connection strings or password patterns.
 */
function sanitizeErrorMessage(message) {
    if (!message || typeof message !== 'string')
        return '';
    return sanitizeMongoUri(message)
        .replace(/(password\s*[:=]\s*)(['"][^'"]+['"]|[^\s,]+)/gi, '$1***')
        .replace(/(bearer\s+)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED]');
}
exports.default = {
    sanitizeMongoUri,
    sanitizeQueryFilter,
    sanitizeErrorMessage,
};
