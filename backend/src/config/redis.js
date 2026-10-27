const Redis = require('ioredis');

/**
 * Resilient Redis Client & Distributed Caching Layer
 * Provides high-speed key-value caching, distributed mutex locking,
 * and seamless in-memory fallback if Redis is unavailable in local dev.
 */

let redisClient = null;
let isRedisConnected = false;

// In-memory fallback cache when Redis is not running
const fallbackMemoryCache = new Map();

function initRedis() {
  const redisUrl = process.env.REDIS_URL || process.env.REDIS_HOST;
  
  if (redisUrl) {
    try {
      redisClient = new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
        connectTimeout: 3000,
        lazyConnect: true,
        retryStrategy(times) {
          if (times > 3) {
            console.warn('[Redis] Connection attempts exceeded limit. Using in-memory cache.');
            return null; // Stop retrying
          }
          return Math.min(times * 200, 1000);
        }
      });

      redisClient.connect().then(() => {
        isRedisConnected = true;
        console.log('⚡ [Redis] Connected successfully to Redis Cache');
      }).catch((err) => {
        isRedisConnected = false;
        console.warn(`⚠️ [Redis] Connection notice: ${err.message}. Using resilient in-memory fallback.`);
      });

      redisClient.on('error', (err) => {
        isRedisConnected = false;
      });

      redisClient.on('ready', () => {
        isRedisConnected = true;
      });
    } catch (err) {
      console.warn('[Redis] Initialization fallback:', err.message);
    }
  } else {
    console.log('ℹ️ [Redis] No REDIS_URL configured; operating with high-speed in-memory cache.');
  }

  return redisClient;
}

// Initialize on module load
initRedis();

const cacheService = {
  isAvailable() {
    return isRedisConnected && redisClient;
  },

  async getJson(key) {
    if (this.isAvailable()) {
      try {
        const val = await redisClient.get(key);
        return val ? JSON.parse(val) : null;
      } catch (err) {
        console.warn(`[Redis get error for ${key}]:`, err.message);
      }
    }
    // In-memory fallback
    const item = fallbackMemoryCache.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      fallbackMemoryCache.delete(key);
      return null;
    }
    return item.data;
  },

  async setJson(key, data, ttlSeconds = 60) {
    const stringified = JSON.stringify(data);
    if (this.isAvailable()) {
      try {
        if (ttlSeconds > 0) {
          await redisClient.set(key, stringified, 'EX', ttlSeconds);
        } else {
          await redisClient.set(key, stringified);
        }
        return true;
      } catch (err) {
        console.warn(`[Redis set error for ${key}]:`, err.message);
      }
    }
    // In-memory fallback
    fallbackMemoryCache.set(key, {
      data,
      expiresAt: ttlSeconds > 0 ? Date.now() + (ttlSeconds * 1000) : null
    });
    return true;
  },

  async delKey(key) {
    if (this.isAvailable()) {
      try {
        await redisClient.del(key);
      } catch (err) {
        console.warn(`[Redis del error for ${key}]:`, err.message);
      }
    }
    fallbackMemoryCache.delete(key);
  },

  async delPattern(pattern) {
    if (this.isAvailable()) {
      try {
        const keys = await redisClient.keys(pattern);
        if (keys && keys.length > 0) {
          await redisClient.del(...keys);
        }
      } catch (err) {
        console.warn(`[Redis delPattern error for ${pattern}]:`, err.message);
      }
    }
    // Clear matching memory keys
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const k of fallbackMemoryCache.keys()) {
      if (regex.test(k)) {
        fallbackMemoryCache.delete(k);
      }
    }
  },

  /**
   * Acquire a distributed lock for idempotent job / webhook execution
   */
  async acquireLock(lockKey, ttlMs = 10000) {
    const lockValue = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    if (this.isAvailable()) {
      try {
        const acquired = await redisClient.set(lockKey, lockValue, 'PX', ttlMs, 'NX');
        return acquired === 'OK' ? lockValue : null;
      } catch (e) {
        // Fall back to memory
      }
    }
    const existing = fallbackMemoryCache.get(lockKey);
    if (existing && (!existing.expiresAt || Date.now() < existing.expiresAt)) {
      return null; // Already locked
    }
    fallbackMemoryCache.set(lockKey, {
      data: lockValue,
      expiresAt: Date.now() + ttlMs
    });
    return lockValue;
  },

  async releaseLock(lockKey, lockValue) {
    if (this.isAvailable()) {
      try {
        const script = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        await redisClient.eval(script, 1, lockKey, lockValue);
      } catch (e) {
        // Non-blocking
      }
    }
    const existing = fallbackMemoryCache.get(lockKey);
    if (existing && existing.data === lockValue) {
      fallbackMemoryCache.delete(lockKey);
    }
  }
};

module.exports = {
  redisClient,
  cacheService,
  initRedis,
};
