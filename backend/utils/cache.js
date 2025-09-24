// utils/cache.js - Lightweight LRU Cache with TTL
const { CONFIG } = require('../config');

class LRUCache {
  constructor(maxSize = 1000, ttlSeconds = 300) {
    this.maxSize = maxSize;
    this.ttlMs = ttlSeconds * 1000;
    this.map = new Map();
  }

  _isExpired(entry) {
    return Date.now() - entry.timestamp > this.ttlMs;
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return null;

    if (this._isExpired(entry)) {
      this.map.delete(key);
      return null;
    }

    // LRU: move to end (most recently used)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value) {
    // Opportunistic cleanup of expired entries
    this._cleanupExpired();

    // Remove oldest entry if at capacity
    if (this.map.size >= this.maxSize) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }

    this.map.set(key, { 
      value, 
      timestamp: Date.now() 
    });
  }

  _cleanupExpired() {
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (now - entry.timestamp > this.ttlMs) {
        this.map.delete(key);
      }
    }
  }

  clear() {
    this.map.clear();
  }

  size() {
    this._cleanupExpired();
    return this.map.size;
  }

  stats() {
    this._cleanupExpired();
    return {
      size: this.map.size,
      maxSize: this.maxSize,
      ttlMs: this.ttlMs,
      utilization: (this.map.size / this.maxSize * 100).toFixed(1) + '%'
    };
  }
}

// Create singleton instance
const cache = new LRUCache(CONFIG.cache.maxEntries, CONFIG.cache.ttl);

module.exports = { cache, LRUCache };