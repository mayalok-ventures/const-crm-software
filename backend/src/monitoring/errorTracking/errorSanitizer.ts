import crypto from 'crypto';
import { sanitizeLogData } from '../logging/logSanitizer';

export interface ParsedStackFrame {
  functionName: string;
  fileName: string;
  lineNumber: number;
  columnNumber: number;
}

/**
 * Parses raw stack trace to extract the primary application frame
 */
export function parseStackTrace(stack?: string): { primaryFrame: string; cleanStack: string } {
  if (!stack || typeof stack !== 'string') {
    return { primaryFrame: 'unknown', cleanStack: '' };
  }

  const lines = stack.split('\n').map((l) => l.trim());
  const frames = lines.filter((l) => l.startsWith('at '));

  // Find first frame not in node_modules or node:internal
  const appFrame = frames.find(
    (f) => !f.includes('node_modules') && !f.includes('node:internal') && !f.includes('node:events')
  ) || frames[0] || 'unknown';

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
export function normalizeErrorMessage(message?: string): string {
  if (!message || typeof message !== 'string') return 'Unknown Error';

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
export function generateErrorFingerprint(errorType: string, message: string, stack?: string): string {
  const normalizedType = (errorType || 'Error').trim();
  const normalizedMsg = normalizeErrorMessage(message);
  const { primaryFrame } = parseStackTrace(stack);

  const hashInput = `${normalizedType}:${normalizedMsg}:${primaryFrame}`;
  return crypto.createHash('sha256').update(hashInput).digest('hex').slice(0, 32);
}

/**
 * Sanitizes request headers and bodies for error tracking
 */
export function sanitizeErrorContext(context: Record<string, any>): Record<string, any> {
  return sanitizeLogData(context);
}
