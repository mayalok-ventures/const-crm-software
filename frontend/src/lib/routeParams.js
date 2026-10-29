/**
 * Shared Dynamic Route Parameter Resolver for Static-Export Next.js Applications
 * Safely resolves the actual record ID or token under Cloudflare Pages static rewrites.
 *
 * Prevents "placeholder" or malformed strings from being sent to backend APIs.
 */

/**
 * Validates whether a string is a standard 24-character hexadecimal MongoDB ObjectId
 * @param {string} val
 * @returns {boolean}
 */
export function isMongoId(val) {
  return typeof val === 'string' && /^[0-9a-fA-F]{24}$/.test(val.trim());
}

/**
 * Validates whether a string is a safe, non-placeholder entity identifier
 * Supports both standard 24-character ObjectIds and alphanumeric IDs with hyphens/underscores
 * (e.g. 'lead_1', 'camp_123', 'col_abc', 'cat_99') while strictly rejecting placeholders and illegal characters.
 * @param {string} val
 * @returns {boolean}
 */
export function isValidEntityId(val) {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed || trimmed.length > 128) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower === 'placeholder' ||
    lower === '[id]' ||
    lower === '[token]' ||
    lower === 'undefined' ||
    lower === 'null'
  ) {
    return false;
  }
  return /^[a-zA-Z0-9_-]+$/.test(trimmed);
}

/**
 * Validates whether a token string is non-empty, safe, and does not contain illegal characters.
 * Supports crypto hex tokens, UUIDs, and URL-safe alphanumeric tokens.
 * @param {string} val
 * @returns {boolean}
 */
export function isValidToken(val) {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed.length < 3 || trimmed.length > 256) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower === 'placeholder' ||
    lower === '[id]' ||
    lower === '[token]' ||
    lower === 'undefined' ||
    lower === 'null'
  ) {
    return false;
  }
  return /^[a-zA-Z0-9_.~-]+$/.test(trimmed);
}

/**
 * Resolves the genuine dynamic parameter from Next.js params or window.location
 * @param {Record<string, any>} params - Next.js useParams() object
 * @param {string} paramName - Name of the param ('id', 'token')
 * @param {string} routePrefix - Path segment preceding the param ('leads', 'campaigns', 'colleges', 'catalogue', 'invite', 'share')
 * @param {((val: string) => boolean)} [validator=isValidEntityId] - Optional validation function (defaults to isValidEntityId)
 * @returns {string}
 */
export function getResolvedRouteParam(params, paramName, routePrefix, validator = isValidEntityId) {
  // 1. Check if Next.js params has a valid, non-placeholder value
  const paramVal = params?.[paramName];
  if (
    paramVal &&
    paramVal !== 'placeholder' &&
    paramVal !== `[${paramName}]` &&
    paramVal !== 'undefined' &&
    paramVal !== 'null'
  ) {
    if (!validator || validator(paramVal)) {
      return paramVal;
    }
  }

  // 2. Fall back to browser window.location.pathname if available
  if (typeof window !== 'undefined' && window.location?.pathname) {
    try {
      const parts = window.location.pathname.split('/').filter(Boolean).map(decodeURIComponent);
      const prefixIndex = parts.findIndex(p => p.toLowerCase() === routePrefix.toLowerCase());
      if (prefixIndex !== -1 && parts[prefixIndex + 1]) {
        const candidate = parts[prefixIndex + 1].trim();
        if (
          candidate &&
          candidate !== 'placeholder' &&
          candidate !== `[${paramName}]` &&
          candidate !== 'undefined' &&
          candidate !== 'null'
        ) {
          if (!validator || validator(candidate)) {
            return candidate;
          }
        }
      }
    } catch (_) {}
  }

  return '';
}
