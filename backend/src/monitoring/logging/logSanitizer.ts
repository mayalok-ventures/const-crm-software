/**
 * Production-Grade Log & Payload Sanitizer
 * Automatically redacts sensitive fields (passwords, tokens, keys, cookies, OTPs, cards).
 */

const SENSITIVE_KEY_PATTERNS = [
  /pass(word)?/i,
  /secret/i,
  /token/i,
  /access_?token/i,
  /refresh_?token/i,
  /auth(orization)?/i,
  /cookie/i,
  /api_?key/i,
  /otp/i,
  /credit_?card/i,
  /card_?number/i,
  /cvv/i,
  /cvc/i,
  /ssn/i,
  /pin/i,
  /encryption_?key/i,
  /private_?key/i,
  /bearer/i,
];

const REDACTED_MASK = '[REDACTED]';

export function isSensitiveKey(key: string): boolean {
  if (!key || typeof key !== 'string') return false;
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Deeply sanitizes any object, array, or primitive value
 */
export function sanitizeLogData(data: any, depth = 0): any {
  if (depth > 6) return '[MAX_DEPTH_REACHED]';
  if (data === null || data === undefined) return data;

  if (typeof data === 'string') {
    // Check if string contains JWT token format (header.payload.signature)
    if (/^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/.test(data) && data.length > 30) {
      return REDACTED_MASK;
    }
    // Check if string contains Bearer header
    if (/^Bearer\s+/i.test(data)) {
      return `Bearer ${REDACTED_MASK}`;
    }
    return data;
  }

  if (typeof data === 'number' || typeof data === 'boolean' || typeof data === 'symbol') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map((item) => sanitizeLogData(item, depth + 1));
  }

  if (typeof data === 'object') {
    // Avoid modifying special instances (e.g. Date, Error, ObjectId)
    if (data instanceof Date) return data.toISOString();
    if (data instanceof Error) {
      return {
        name: data.name,
        message: data.message,
        stack: data.stack,
      };
    }

    const sanitizedObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (isSensitiveKey(key)) {
        sanitizedObj[key] = REDACTED_MASK;
      } else {
        sanitizedObj[key] = sanitizeLogData(value, depth + 1);
      }
    }
    return sanitizedObj;
  }

  return REDACTED_MASK;
}
