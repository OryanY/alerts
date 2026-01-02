// utils/cache.js - Professional LRU Cache using battle-tested library
// Install: npm install lru-cache
const { LRUCache } = require('lru-cache');
const { CONFIG } = require('../config');

/**
 * Enterprise-grade cache with proper LRU eviction, TTL, and memory management
 * Uses the 'lru-cache' library - battle-tested and used by npm itself
 */
class CacheManager {
  constructor(options = {}) {
    const {
      max = CONFIG.cache.maxEntries,
      ttl = CONFIG.cache.ttl * 1000, // Convert to milliseconds
      updateAgeOnGet = true,
      allowStale = false
    } = options;

    // Initialize LRU cache with proper configuration
    this.cache = new LRUCache({
      max,
      ttl,
      updateAgeOnGet,
      allowStale,

      // Max memory-aware size
      maxSize: 50 * 1024 * 1024,

      // Size calculation for memory-aware eviction
      sizeCalculation: (value) => {
        return JSON.stringify(value).length;
      },

      // Disposal callback for debugging
      dispose: (value, key, reason) => {
        if (process.env.NODE_ENV === 'development') {
          console.debug(`Cache eviction: ${key} (reason: ${reason})`);
        }
      }
    });

    this.hits = 0;
    this.misses = 0;
    this.enabled = CONFIG.cache.enabled;
  }

  get(key) {
    if (!this.enabled) return null;

    const value = this.cache.get(key);

    if (value !== undefined) {
      this.hits++;
      return value;
    }

    this.misses++;
    return null;
  }

  set(key, value, ttl) {
    if (!this.enabled) return false;

    this.cache.set(key, value, {
      ttl: ttl ? ttl * 1000 : undefined
    });

    return true;
  }

  has(key) {
    if (!this.enabled) return false;
    return this.cache.has(key);
  }

  delete(key) {
    return this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  deletePattern(pattern) {
    const regex = new RegExp(pattern);
    const keys = [...this.cache.keys()];
    let deleted = 0;

    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  stats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(2) : 0;

    return {
      enabled: this.enabled,
      size: this.cache.size,
      maxSize: this.cache.max,
      hits: this.hits,
      misses: this.misses,
      hitRate: `${hitRate}%`,
      utilization: `${((this.cache.size / this.cache.max) * 100).toFixed(1)}%`,
      calculatedSize: this.cache.calculatedSize,
      maxMemorySize: `50MB`
    };
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  keys() {
    return [...this.cache.keys()];
  }

  purgeStale() {
    this.cache.purgeStale();
  }

  info(key) {
    const value = this.cache.get(key);
    if (value === undefined) return null;

    return {
      key,
      hasValue: true,
      size: JSON.stringify(value).length,
      remainingTTL: this.cache.getRemainingTTL(key)
    };
  }
}

// Create singleton instance
const cache = new CacheManager();

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('Clearing cache on shutdown...');
  cache.clear();
});

module.exports = { cache, CacheManager };
