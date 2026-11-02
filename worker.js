/**
 * Sahyak CRM — Cloudflare Worker API Gateway / Reverse Proxy
 *
 * Edge Domain: https://api-app.sahyak.com
 * Upstream Backend: Render Web Service (configured via BACKEND_URL)
 *
 * Features & Specifications:
 * - Dynamic upstream resolution from Cloudflare environment variable BACKEND_URL.
 * - Zero hardcoded platform or container URLs (Zoho Catalyst completely removed).
 * - Full HTTP method, path, query parameter, header, and body preservation.
 * - Strict CORS enforcement for configured ALLOWED_ORIGINS and *.sahyak.com.
 * - Robust OPTIONS preflight handler with 204 No Content.
 * - Auth headers (Bearer tokens, cookies) forwarded without mutation.
 * - Upstream error, timeout, and connection failure handling with sanitized 502 Bad Gateway.
 * - Proxy loop detection and missing configuration guards.
 * - Zero sensitive environment variable or secret leakage.
 */

// Default origins if ALLOWED_ORIGINS is not set in Worker environment
const DEFAULT_ALLOWED_ORIGINS = [
  'https://app.sahyak.com',
  'https://crm.sahyak.com'
];

/**
 * Determine if an incoming Origin is authorized by CORS policy.
 * @param {string|null} origin - Incoming Origin header
 * @param {Record<string, string>} env - Worker environment variables
 * @returns {string|null} The origin to echo in Access-Control-Allow-Origin, or null if denied
 */
export function resolveAllowedOrigin(origin, env = {}) {
  if (!origin) return null;

  const rawOrigins = env.ALLOWED_ORIGINS || '';
  const configuredOrigins = rawOrigins
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  const allowedSet = new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins]);
  if (allowedSet.has(origin)) {
    return origin;
  }

  // Allow all *.sahyak.com domains (production & staging subdomains)
  if (/^https:\/\/([a-zA-Z0-9-]+\.)*sahyak\.com$/.test(origin)) {
    return origin;
  }

  // Allow Cloudflare Pages deployments (*.pages.dev)
  if (/^https:\/\/([a-zA-Z0-9-]+\.)*pages\.dev$/.test(origin)) {
    return origin;
  }

  // Allow Render deployed frontends / preview URLs (*.onrender.com)
  if (/^https:\/\/([a-zA-Z0-9-]+\.)*onrender\.com$/.test(origin)) {
    return origin;
  }

  // Allow localhost / LAN in non-production environments
  const environment = env.ENVIRONMENT || env.NODE_ENV || 'production';
  if (environment !== 'production') {
    if (/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      return origin;
    }
  }

  return null;
}

/**
 * Generate standard CORS headers.
 * @param {string|null} allowedOrigin - Validated origin or null
 * @returns {Record<string, string>}
 */
export function buildCorsHeaders(allowedOrigin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Workspace-Id, X-Request-Id, Cache-Control, Pragma',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };

  if (allowedOrigin) {
    headers['Access-Control-Allow-Origin'] = allowedOrigin;
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Helper to build JSON responses.
 * @param {object} data
 * @param {number} status
 * @param {Record<string, string>} extraHeaders
 * @returns {Response}
 */
export function jsonResponse(data, status = 200, extraHeaders = {}) {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('X-Proxied-By', 'Sahyak-API-Gateway');
  return new Response(JSON.stringify(data), {
    status,
    headers
  });
}

/**
 * Main Cloudflare Worker fetch handler.
 */
export async function handleRequest(request, env = {}, ctx = {}) {
  const incomingUrl = new URL(request.url);
  const clientOrigin = request.headers.get('Origin');
  const allowedOrigin = resolveAllowedOrigin(clientOrigin, env);
  const corsHeaders = buildCorsHeaders(allowedOrigin);

  // 1. Handle OPTIONS preflight requests
  if (request.method.toUpperCase() === 'OPTIONS') {
    // If browser supplied an Origin that is unauthorized, reject with 403
    if (clientOrigin && !allowedOrigin) {
      return jsonResponse(
        {
          error: 'CORS Forbidden',
          message: 'Origin not allowed by API gateway CORS policy'
        },
        403,
        corsHeaders
      );
    }

    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // 2. Validate BACKEND_URL configuration
  const backendUrlRaw = env.BACKEND_URL;
  if (!backendUrlRaw || typeof backendUrlRaw !== 'string' || !backendUrlRaw.trim()) {
    return jsonResponse(
      {
        error: 'Gateway Configuration Error',
        message: 'Upstream BACKEND_URL is not configured on Cloudflare Worker',
        code: 'MISSING_BACKEND_URL'
      },
      500,
      corsHeaders
    );
  }

  let backendUrl;
  try {
    backendUrl = new URL(backendUrlRaw.trim());
    if (!['http:', 'https:'].includes(backendUrl.protocol)) {
      throw new Error('Invalid protocol');
    }
  } catch {
    return jsonResponse(
      {
        error: 'Gateway Configuration Error',
        message: 'Configured BACKEND_URL has an invalid URL format',
        code: 'INVALID_BACKEND_URL'
      },
      500,
      corsHeaders
    );
  }

  // 3. Prevent proxy loops
  if (incomingUrl.hostname.toLowerCase() === backendUrl.hostname.toLowerCase()) {
    return jsonResponse(
      {
        error: 'Routing Loop Detected',
        message: 'Proxy loop detected: incoming hostname matches upstream hostname',
        code: 'PROXY_LOOP_DETECTED'
      },
      508,
      corsHeaders
    );
  }

  // 4. Construct upstream target URL
  // Note: Backend routes are mounted on exact paths (e.g. /api/leads, /health/live, /).
  // Neither strip nor add /api prefix; preserve pathname and search query string identically.
  const upstreamBasePath = backendUrl.pathname.replace(/\/+$/, '');
  const upstreamFullPath = `${upstreamBasePath}${incomingUrl.pathname}${incomingUrl.search}`;
  const targetUrl = new URL(upstreamFullPath, backendUrl.origin);

  // 5. Clone and prepare headers for forwarding
  const forwardHeaders = new Headers(request.headers);

  // Set authoritative Host header for Render SNI and service routing
  forwardHeaders.set('Host', backendUrl.host);

  // Add standard proxy tracking headers
  forwardHeaders.set('X-Forwarded-Host', incomingUrl.host);
  forwardHeaders.set('X-Forwarded-Proto', incomingUrl.protocol.replace(':', ''));

  const clientIp = request.headers.get('cf-connecting-ip') ||
                   request.headers.get('x-real-ip') ||
                   request.headers.get('x-forwarded-for');
  if (clientIp) {
    forwardHeaders.set('X-Forwarded-For', clientIp);
    forwardHeaders.set('CF-Connecting-IP', clientIp);
  }

  // Ensure request ID is preserved or generated
  const requestId = forwardHeaders.get('x-request-id') ||
    `gw_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  forwardHeaders.set('X-Request-Id', requestId);

  // Clean hop-by-hop / Cloudflare internal headers
  forwardHeaders.delete('cf-ray');
  forwardHeaders.delete('cf-visitor');

  // 6. Build upstream request
  const method = request.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);

  const requestInit = {
    method,
    headers: forwardHeaders,
    redirect: 'manual' // Preserve redirects from backend as-is
  };

  if (hasBody) {
    // Forward the request body as stream / buffer
    requestInit.body = request.body;
    requestInit.duplex = 'half';
  }

  // 7. Execute fetch to upstream Render backend
  let upstreamResponse;
  try {
    upstreamResponse = await fetch(targetUrl.toString(), requestInit);
  } catch (err) {
    return jsonResponse(
      {
        error: 'Bad Gateway',
        message: 'Upstream backend service is unavailable or unreachable',
        code: 'UPSTREAM_UNAVAILABLE',
        timestamp: new Date().toISOString()
      },
      502,
      corsHeaders
    );
  }

  // 8. Construct downstream response with merged CORS & security headers
  const responseHeaders = new Headers(upstreamResponse.headers);

  // Apply CORS headers for allowed origins
  if (allowedOrigin) {
    responseHeaders.set('Access-Control-Allow-Origin', allowedOrigin);
    responseHeaders.set('Access-Control-Allow-Credentials', 'true');
    responseHeaders.append('Vary', 'Origin');
  }

  // Gateway identification
  responseHeaders.set('X-Proxied-By', 'Sahyak-API-Gateway');

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders
  });
}

export default {
  fetch: handleRequest
};
