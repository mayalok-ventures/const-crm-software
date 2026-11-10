const crypto = require('crypto');

/**
 * High-speed In-Memory TTL Cache for Authentication & Multi-Tenant Context Resolution
 * Eliminates the 3-4 sequential DB query waterfall on every authenticated request.
 * Bounded size with LRU eviction and explicit invalidation.
 */

class BoundedTtlCache {
  constructor(maxSize = 3000, defaultTtlMs = 30000) {
    this.maxSize = maxSize;
    this.defaultTtlMs = defaultTtlMs;
    this.map = new Map();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }

    // Refresh LRU order (delete & re-insert)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    if (this.map.size >= this.maxSize) {
      // Evict oldest entry (first item in Map iterator)
      const oldestKey = this.map.keys().next().value;
      if (oldestKey) this.map.delete(oldestKey);
    }

    this.map.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  del(key) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  /**
   * Delete all keys that match a predicate or string prefix
   */
  deleteMatching(predicate) {
    for (const [key, entry] of this.map.entries()) {
      if (predicate(key, entry.value)) {
        this.map.delete(key);
      }
    }
  }
}

// Dedicated caches with short, safe TTL (30 seconds)
const userCache = new BoundedTtlCache(3000, 30000);
const workspaceContextCache = new BoundedTtlCache(3000, 30000);
const subscriptionLifecycleCache = new BoundedTtlCache(3000, 30000);
const tokenVerificationCache = new BoundedTtlCache(5000, 10000); // 10s token decode cache keyed by SHA-256 token hash
const revokedTokensCache = new BoundedTtlCache(10000, 24 * 60 * 60 * 1000); // 24-hour revoked token blacklist

function hashToken(token) {
  if (!token || typeof token !== 'string') return null;
  return crypto.createHash('sha256').update(token).digest('hex');
}

function revokeToken(token) {
  const hash = hashToken(token);
  if (hash) {
    revokedTokensCache.set(hash, true);
    tokenVerificationCache.del(hash);
  }
}

function isTokenRevoked(token) {
  const hash = hashToken(token);
  if (!hash) return true;
  return Boolean(revokedTokensCache.get(hash));
}

/**
 * Invalidate all cached data related to a user (auth, workspace context, lifecycle, active tokens)
 */
function invalidateUserAuthCache(userId) {
  if (!userId) return;
  const idStr = String(userId);
  userCache.del(idStr);
  subscriptionLifecycleCache.del(idStr);
  // Zero-latency invalidation: immediately purge all tokens belonging to this user from verification cache
  tokenVerificationCache.deleteMatching((key, val) => {
    return val?.userId === idStr || String(val?.decoded?.id) === idStr;
  });
  workspaceContextCache.deleteMatching((k) => k.startsWith(idStr));
}

/**
 * Invalidate all cached workspace contexts when workspace settings or memberships change
 */
function invalidateWorkspaceCache(workspaceId) {
  if (!workspaceId) return;
  const wsStr = String(workspaceId);
  for (const [key, entry] of workspaceContextCache.map.entries()) {
    if (key.includes(wsStr) || String(entry.value?.workspace?._id) === wsStr) {
      workspaceContextCache.map.delete(key);
    }
  }
}

module.exports = {
  userCache,
  workspaceContextCache,
  subscriptionLifecycleCache,
  tokenVerificationCache,
  revokedTokensCache,
  hashToken,
  revokeToken,
  isTokenRevoked,
  invalidateUserAuthCache,
  invalidateWorkspaceCache,
};
