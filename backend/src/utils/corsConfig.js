/**
 * Bulletproof Production CORS Configuration
 *
 * Rules:
 * 1. Requests with an Origin header are checked against explicit allowlist and sahyak.com subdomains.
 * 2. Requests without an Origin header (webhooks, cURL, server-to-server) do NOT receive any CORS headers.
 * 3. Never send Access-Control-Allow-Origin: * when credentials are supported.
 * 4. Wildcards for public platforms (*.pages.dev, *.onrender.com) are strictly prohibited;
 *    specific preview/production deployments must be listed in process.env.ALLOWED_ORIGINS.
 */

const getAllowedOrigins = () => {
  const envOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);

  const defaultOrigins = [
    'https://app.sahyak.com',
    'https://crm.sahyak.com',
  ];

  if (process.env.NODE_ENV !== 'production') {
    defaultOrigins.push(
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5000',
      'http://127.0.0.1:5000'
    );
  }

  return Array.from(new Set([...defaultOrigins, ...envOrigins]));
};

/**
 * Checks whether an incoming Origin is authorized.
 * Non-browser requests without an Origin header return true (they are permitted through without CORS headers).
 */
const isOriginAllowed = (origin) => {
  if (!origin) return true;
  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return true;

  // Allow authoritative company root and tenant subdomains (*.sahyak.com)
  // Justification: sahyak.com is the proprietary domain owned by Sahyak CRM.
  // Wildcards on public hosting domains (*.pages.dev, *.onrender.com) are NOT allowed.
  if (/^https:\/\/([a-zA-Z0-9-]+\.)*sahyak\.com$/.test(origin)) return true;

  // In non-production, allow localhost and private LAN addresses
  if (process.env.NODE_ENV !== 'production') {
    if (/^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) {
      return true;
    }
  }

  return false;
};

/**
 * Express CORS and Preflight handler.
 */
const corsMiddleware = (req, res, next) => {
  const origin = req.headers.origin;

  if (origin) {
    if (isOriginAllowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-Workspace-Id, X-Request-Id');
      res.setHeader('Access-Control-Max-Age', '7200'); // 2 hours browser preflight cache
      res.setHeader('Vary', 'Origin');
    }
  }
  // IMPORTANT: For non-browser requests without Origin (webhooks, server-to-server, curl),
  // NEVER send Access-Control-Allow-Origin: * or any CORS headers.

  if (req.method === 'OPTIONS') {
    if (origin && !isOriginAllowed(origin)) {
      return res.status(403).json({ error: 'CORS policy: Origin not allowed' });
    }
    return res.status(204).end();
  }

  next();
};

module.exports = {
  getAllowedOrigins,
  isOriginAllowed,
  corsMiddleware,
};
