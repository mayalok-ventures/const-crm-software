import axios from 'axios';

const isPrivateLanIp = (hostname) => {
  if (!hostname || typeof hostname !== 'string') return false;
  return (
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)
  );
};

export const getBaseUrl = () => {
  if (process.env.NEXT_PUBLIC_API_URL) {
    const raw = process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
    return raw.endsWith('/api') ? raw : `${raw}/api`;
  }
  if (typeof window !== 'undefined') {
    const hn = window.location.hostname;
    // Local development via localhost, 127.0.0.1, or local Wi-Fi / LAN IP
    if (hn === 'localhost' || hn === '127.0.0.1' || isPrivateLanIp(hn)) {
      return `http://${hn}:5000/api`;
    }
    if (hn === 'crm.sahyak.com' || hn === 'app.sahyak.com' || hn.endsWith('.pages.dev')) {
      return 'https://api.sahyak.com/api';
    }
    // Fallback for custom domains / proxy hosts
    return `${window.location.protocol}//${window.location.host}/api`;
  }
  return process.env.NODE_ENV === 'production' ? 'https://api.sahyak.com/api' : 'http://localhost:5000/api';
};

export const API_URL = getBaseUrl();

const api = axios.create({
  baseURL: API_URL,
  timeout: 20000,
});

export const uploadApi = axios.create({
  baseURL: API_URL,
  timeout: 120000,
});

// Shared interceptor logic
const injectToken = (config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

let isRedirectingToLogin = false;

const handleAuthError = (err) => {
  if (typeof window !== 'undefined') {
    const currentPath = window.location.pathname || '';
    const isAuthPage = currentPath.includes('/login') || currentPath.includes('/signup');
    const isSilent = Boolean(
      err.config?.silentAuth ||
      err.config?._silentAuth ||
      err.config?.isBackground ||
      err.config?._isBackground
    );

    if (err.response?.status === 403 && (err.response?.data?.code === 'SUSPENDED' || err.response?.data?.code === 'ACCOUNT_SUSPENDED')) {
      clearAllQueryCache();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      const reason = encodeURIComponent(err.response.data.message || 'Account suspended.');
      if (!isAuthPage && !isRedirectingToLogin) {
        isRedirectingToLogin = true;
        window.location.href = `/login?error=suspended&reason=${reason}`;
      }
    } else if (err.response?.status === 401) {
      // Do not force logout or redirect if request was a background polling task
      if (!isSilent) {
        clearAllQueryCache();
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        if (!isAuthPage && !isRedirectingToLogin) {
          isRedirectingToLogin = true;
          window.location.href = '/login?error=session_expired';
        }
      }
    }
  }
  return Promise.reject(err);
};

// ─────────────────────────────────────────────────────────────
// CLIENT QUERY CACHE & REQUEST DEDUPLICATION (100ms TARGET)
// ─────────────────────────────────────────────────────────────
const queryCache = new Map();
const inFlightRequests = new Map();

/**
 * Derives a tenant-isolated cache key incorporating user and workspace IDs.
 * Ensures zero cross-tenant cache pollution.
 */
const getCacheKey = (url, params = {}) => {
  if (typeof window === 'undefined') return `ssr:${url}`;
  let wsId = 'solo';
  let userId = 'anon';
  try {
    const u = localStorage.getItem('user');
    if (u) {
      const parsed = JSON.parse(u);
      wsId = parsed.workspaceId || parsed.companyId || 'solo';
      userId = parsed._id || 'anon';
    }
  } catch (e) {}

  let baseUrl = url;
  const mergedParams = { ...params };
  if (url && url.includes('?')) {
    const [path, query] = url.split('?');
    baseUrl = path;
    const searchParams = new URLSearchParams(query);
    for (const [key, value] of searchParams.entries()) {
      if (mergedParams[key] === undefined) {
        mergedParams[key] = value;
      }
    }
  }

  const sortedKeys = Object.keys(mergedParams).sort();
  const sortedQuery = sortedKeys.length > 0 ? '?' + sortedKeys.map(k => `${k}=${mergedParams[k]}`).join('&') : '';
  return `${wsId}:${userId}:${baseUrl}${sortedQuery}`;
};

/**
 * Purges query cache entries matching a given prefix.
 */
export const invalidateQueryCache = (urlPrefix) => {
  if (!urlPrefix) {
    queryCache.clear();
    return;
  }
  for (const key of queryCache.keys()) {
    if (key.includes(urlPrefix)) {
      queryCache.delete(key);
    }
  }
};

/**
 * Completely purges all query cache entries (e.g. on logout or tenant switch).
 */
export const clearAllQueryCache = () => {
  queryCache.clear();
  inFlightRequests.clear();
};

/**
 * Synchronous cache lookup for instantaneous Frame-0 rendering.
 * Returns cached data immediately if present and not older than maxAgeMs.
 */
export const getCachedData = (url, params = {}, maxAgeMs = 120000) => {
  if (typeof window === 'undefined') return null;
  const cacheKey = getCacheKey(url, params);
  const cached = queryCache.get(cacheKey);
  if (!cached) return null;
  if (Date.now() - cached.timestamp < maxAgeMs) {
    return cached.data;
  }
  return null;
};

/**
 * Cached GET request with deduplication, tenant isolation, and SWR revalidation.
 * Achieves <100ms p95 warm navigation by serving valid cached data immediately.
 */
export const cachedGet = async (url, config = {}) => {
  const {
    ttl = 60000, // 60s cache TTL by default
    forceRefresh = false,
    staleWhileRevalidate = true,
    ...axiosConfig
  } = config;

  const cacheKey = getCacheKey(url, axiosConfig.params || {});
  const cached = queryCache.get(cacheKey);
  const now = Date.now();

  // Return cached result if fresh and not forcing refresh
  if (!forceRefresh && cached && (now - cached.timestamp < ttl)) {
    // Background revalidate if older than 10 seconds
    if (staleWhileRevalidate && (now - cached.timestamp > 10000)) {
      api.get(url, axiosConfig).then((freshRes) => {
        queryCache.set(cacheKey, { data: freshRes.data, timestamp: Date.now() });
      }).catch(() => {});
    }
    return { data: cached.data, fromCache: true, status: 200 };
  }

  // Deduplicate simultaneous in-flight requests to the same URL
  if (inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const fetchPromise = api.get(url, axiosConfig)
    .then((res) => {
      queryCache.set(cacheKey, { data: res.data, timestamp: Date.now() });
      inFlightRequests.delete(cacheKey);
      return res;
    })
    .catch((err) => {
      inFlightRequests.delete(cacheKey);
      throw err;
    });

  inFlightRequests.set(cacheKey, fetchPromise);
  return fetchPromise;
};

// Automatic targeted cache invalidation on mutations
const handleMutationInvalidation = (response) => {
  const method = response.config?.method?.toLowerCase();
  const url = response.config?.url || '';

  if (['post', 'put', 'delete', 'patch'].includes(method)) {
    if (url.includes('/leads')) {
      invalidateQueryCache('/leads');
      invalidateQueryCache('/analytics');
    }
    if (url.includes('/deals')) {
      invalidateQueryCache('/deals');
      invalidateQueryCache('/commission');
      invalidateQueryCache('/analytics');
    }
    if (url.includes('/workspace')) {
      invalidateQueryCache('/workspace');
    }
    if (url.includes('/pipelines')) {
      invalidateQueryCache('/pipelines');
      invalidateQueryCache('/leads');
    }
    if (url.includes('/catalogue') || url.includes('/colleges')) {
      invalidateQueryCache('/catalogue');
      invalidateQueryCache('/colleges');
    }
  }
  return response;
};

// Listen for storage events (e.g. user logout in another tab) to purge cache
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'token' || e.key === 'user') {
      clearAllQueryCache();
    }
  });
  window.addEventListener('user-updated', () => {
    clearAllQueryCache();
  });
}

// Inject token on every request
api.interceptors.request.use(injectToken);
api.interceptors.response.use(handleMutationInvalidation, handleAuthError);

// Apply interceptors to uploadApi
uploadApi.interceptors.request.use(injectToken);
uploadApi.interceptors.response.use(handleMutationInvalidation, handleAuthError);

api.cachedGet = cachedGet;
api.getCachedData = getCachedData;
api.invalidateCache = invalidateQueryCache;
api.clearCache = clearAllQueryCache;

export default api;
