"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseStackTrace = parseStackTrace;
exports.normalizeErrorMessage = normalizeErrorMessage;
exports.generateErrorFingerprint = generateErrorFingerprint;
exports.sanitizeErrorContext = sanitizeErrorContext;
const crypto_1 = __importDefault(require("crypto"));
const logSanitizer_1 = require("../logging/logSanitizer");
/**
 * Parses raw stack trace to extract the primary application frame
 */
function parseStackTrace(stack) {
    if (!stack || typeof stack !== 'string') {
        return { primaryFrame: 'unknown', cleanStack: '' };
    }
    const lines = stack.split('\n').map((l) => l.trim());
    const frames = lines.filter((l) => l.startsWith('at '));
    // Find first frame not in node_modules or node:internal
    const appFrame = frames.find((f) => !f.includes('node_modules') && !f.includes('node:internal') && !f.includes('node:events')) || frames[0] || 'unknown';
    // Sanitize paths to avoid machine-specific paths (e.g. C:\Users\Hi\... -> /src/...)
    const cleanAppFrame = appFrame.replace(/\\/g, '/').replace(/.*\/src\//i, 'src/');
    const cleanStack = frames
        .slice(0, 15)
        .map((f) => f.replace(/\\/g, '/').replace(/.*\/src\//i, 'src/'))
        .join('\n');
    return { primaryFrame: cleanAppFrame, cleanStack };
}
/**
 * Normalizes error messages by replacing variable IDs, Hex strings, and timestamps
 */
function normalizeErrorMessage(message) {
    if (!message || typeof message !== 'string')
        return 'Unknown Error';
    return message
        .replace(/[0-9a-fA-F]{24}/g, '<OBJECT_ID>')
        .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '<UUID>')
        .replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?\b/g, '<TIMESTAMP>')
        .replace(/\b\d{10,13}\b/g, '<EPOCH>')
        .trim();
}
/**
 * Generates a stable, deterministic Error Fingerprint
 */
function generateErrorFingerprint(errorType, message, stack) {
    const normalizedType = (errorType || 'Error').trim();
    const normalizedMsg = normalizeErrorMessage(message);
    const { primaryFrame } = parseStackTrace(stack);
    const hashInput = `${normalizedType}:${normalizedMsg}:${primaryFrame}`;
    return crypto_1.default.createHash('sha256').update(hashInput).digest('hex').slice(0, 32);
}
/**
 * Sanitizes request headers and bodies for error tracking
 */
function sanitizeErrorContext(context) {
    return (0, logSanitizer_1.sanitizeLogData)(context);
}
