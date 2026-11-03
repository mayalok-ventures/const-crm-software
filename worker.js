/**
 * Sahyak CRM — Cloudflare Worker API Gateway / Reverse Proxy
 *
 * Worker Name: api-app-proxy
 * Public Domain: https://api-app.sahyak.com
 * Upstream Target: Configured via BACKEND_URL (e.g. https://sahyak-api.onrender.com)
 *
 * Core Features:
 * - Robust runtime environment variable resolution (ES module env, globalThis, process.env, global scope).
 * - HTTPS protocol enforcement on upstream backend URL.
 * - Full preservation of HTTP method, URL path, query string, headers, and request body.
 * - CORS management with OPTIONS preflight (204 No Content) for https://app.sahyak.com and subdomains.
 * - Authorization header (Bearer tokens) and cookie forwarding without mutation.
 * - Upstream failure resilience (502 Bad Gateway with CORS headers).
 * - Proxy loop detection and missing configuration guards.
 * - Zero secret or environment variable leakage.
 */

// Default origins if ALLOWED_ORIGINS is not set in Worker environment
const DEFAULT_ALLOWED_ORIGINS = [
  'https://app.sahyak.com',
  'https://crm.sahyak.com'
];

/**
 * Merge environment variables from all available Cloudflare Worker runtime sources.
 * Supports ES Module bindings (env), Service Worker bindings (globalThis), and nodejs_compat (process.env).
 * @param {Record<string, unknown>} env - Worker environment bindings
 * @returns {Record<string, unknown>}
 */
export function getRuntimeEnv(env = {}) {
  const merged = {};
  if (typeof globalThis !== 'undefined') {
    Object.assign(merged, globalThis);
  }
  if (typeof process !== 'undefined' && process.env) {
    Object.assign(merged, process.env);
  }
  if (env && typeof env === 'object') {
    Object.assign(merged, env);
  }
  return merged;
}

/**
 * Resolve the BACKEND_URL string from available runtime sources.
 * @param {Record<string, unknown>} env
 * @returns {string|null}
 */
export function resolveBackendUrl(env = {}) {
  // 1. Direct ES module env object
  if (env && typeof env === 'object' && typeof env.BACKEND_URL === 'string' && env.BACKEND_URL.trim()) {
    return env.BACKEND_URL.trim();
  }
  // 2. globalThis (Service Worker syntax / Cloudflare global binding)
  if (typeof globalThis !== 'undefined' && typeof globalThis.BACKEND_URL === 'string' && globalThis.BACKEND_URL.trim()) {
    return globalThis.BACKEND_URL.trim();
  }
  // 3. process.env (nodejs_compat mode)
  if (typeof process !== 'undefined' && process.env && typeof process.env.BACKEND_URL === 'string' && process.env.BACKEND_URL.trim()) {
    return process.env.BACKEND_URL.trim();
  }
  // 4. Global scope lookup (classic Cloudflare Service Worker syntax)
  try {
    const val = (new Function("return typeof BACKEND_URL !== 'undefined' ? BACKEND_URL : null;"))();
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  } catch {}

  return null;
}

/**
 * Determine if an incoming Origin is authorized by CORS policy.
 * @param {string|null} origin - Incoming Origin header
 * @param {Record<string, unknown>} env - Worker environment variables
 * @returns {string|null} The origin to echo in Access-Control-Allow-Origin, or null if denied
 */
export function resolveAllowedOrigin(origin, env = {}) {
  if (!origin) return null;

  const runtime = getRuntimeEnv(env);
  const rawOrigins = typeof runtime.ALLOWED_ORIGINS === 'string' ? runtime.ALLOWED_ORIGINS : '';
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
  const environment = runtime.ENVIRONMENT || runtime.NODE_ENV || 'production';
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
  const backendUrlRaw = resolveBackendUrl(env);
  if (!backendUrlRaw) {
    return jsonResponse(
      {
        error: 'Gateway Configuration Error',
        message: 'Upstream BACKEND_URL is not configured in the Worker environment',
        code: 'MISSING_BACKEND_URL'
      },
      500,
      corsHeaders
    );
  }

  let backendUrl;
  try {
    backendUrl = new URL(backendUrlRaw);
    if (!['http:', 'https:'].includes(backendUrl.protocol)) {
      throw new Error('Invalid web protocol');
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

  // 3. Enforce HTTPS (HTTP allowed only in test environments)
  const runtime = getRuntimeEnv(env);
  const isTest = (runtime.ENVIRONMENT === 'test' || runtime.NODE_ENV === 'test');
  if (backendUrl.protocol !== 'https:' && (!isTest || backendUrl.protocol !== 'http:')) {
    return jsonResponse(
      {
        error: 'Gateway Configuration Error',
        message: 'Configured BACKEND_URL must use the HTTPS protocol',
        code: 'HTTPS_REQUIRED'
      },
      500,
      corsHeaders
    );
  }

  // 4. Prevent proxy loops
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

  // 5. Construct upstream target URL
  // Note: Backend routes are mounted on exact paths (e.g. /api/leads, /health/live, /).
  // Neither strip nor add /api prefix; preserve pathname and search query string identically.
  const upstreamBasePath = backendUrl.pathname.replace(/\/+$/, '');
  const upstreamFullPath = `${upstreamBasePath}${incomingUrl.pathname}${incomingUrl.search}`;
  const targetUrl = new URL(upstreamFullPath, backendUrl.origin);

  // 6. Clone and prepare headers for forwarding
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

  // 7. Build upstream request
  const method = request.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);

  const requestInit = {
    method,
    headers: forwardHeaders,
    redirect: 'manual' // Preserve redirects from backend as-is
  };

  if (hasBody) {
    requestInit.body = request.body;
    requestInit.duplex = 'half';
  }

  // 8. Execute fetch to upstream Render backend
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

  // 9. Construct downstream response with merged CORS & security headers
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

// Fallback for Service Worker runtime (if deployed using addEventListener)
if (typeof addEventListener === 'function' && typeof self !== 'undefined' && !self.__WORKER_FETCH_LISTENER_REGISTERED__) {
  self.__WORKER_FETCH_LISTENER_REGISTERED__ = true;
  addEventListener('fetch', (event) => {
    event.respondWith(handleRequest(event.request, globalThis, event));
  });
}
