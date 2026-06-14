// utils/cache.js
// -------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH for all backend caching. Two tiers:
//
//  LOCAL  (createLocalCache) — per-process, TTL + max-entries.
//    For hot Mongo-sourced data (mappings, rules, settings, response
//    memoization). Cheap, but each pod has its own copy: after a write,
//    other pods may serve stale data for up to the TTL. Keep TTLs short
//    and always invalidate the local cache in the same service that
//    performs the write.
//
//  SHARED (cacheGet/cacheSet/...) — MongoDB `shared_cache` collection,
//    visible to every pod. For EXPENSIVE EXTERNAL calls (ServiceNow
//    reference data, metrics): only the first pod to miss pays the
//    upstream call. Never use it for data that already lives in Mongo —
//    that just replaces one Mongo read with another.
//
// Do not create ad-hoc Maps / lru-cache instances elsewhere; create a
// named cache here so every cache is discoverable and clearable.
// -------------------------------------------------------------------
const { getMongoDb } = require('../database/connection');
const { logger } = require('./logger');

const log = logger.tagged('cache');

// ==================== LOCAL TIER ====================

const localCaches = new Map(); // name → cache instance (registry)

/**
 * Create (or return the existing) named in-process cache.
 * @param {string} name        Unique cache name, e.g. 'incident-rules'
 * @param {number} opts.ttlMs       Entry time-to-live (default 60s)
 * @param {number} opts.maxEntries  Max entries; oldest evicted first (default 500)
 */
function createLocalCache(name, { ttlMs = 60_000, maxEntries = 500 } = {}) {
    if (localCaches.has(name)) return localCaches.get(name);

    const store = new Map(); // key → { value, expiresAt }
    const cache = {
        name,
        get(key) {
            const entry = store.get(key);
            if (!entry) return undefined;
            if (Date.now() > entry.expiresAt) {
                store.delete(key);
                return undefined;
            }
            return entry.value;
        },
        set(key, value, ttlOverrideMs) {
            if (store.size >= maxEntries && !store.has(key)) {
                store.delete(store.keys().next().value); // evict oldest insert
            }
            store.set(key, { value, expiresAt: Date.now() + (ttlOverrideMs ?? ttlMs) });
        },
        delete(key) { store.delete(key); },
        clear() { store.clear(); },
        size() { return store.size; }
    };

    localCaches.set(name, cache);
    return cache;
}

/** Clear every registered local cache (useful for tests/debug endpoints). */
function clearAllLocalCaches() {
    for (const cache of localCaches.values()) cache.clear();
}

// ==================== SHARED TIER (MongoDB-backed) ====================

const SHARED_COLLECTION = 'shared_cache';

/** Get a shared cached value. Returns null on miss or expired entry. */
async function cacheGet(key) {
    try {
        const doc = await getMongoDb()
            .collection(SHARED_COLLECTION)
            .findOne({ _id: key, expiresAt: { $gt: new Date() } });
        return doc ? doc.value : null;
    } catch (err) {
        log.warn(`shared GET failed for key "${key}"`, err.message);
        return null;
    }
}

/** Set a shared cached value with a TTL (ms). Value must be JSON-serialisable. */
async function cacheSet(key, value, ttlMs) {
    try {
        const expiresAt = new Date(Date.now() + ttlMs);
        await getMongoDb()
            .collection(SHARED_COLLECTION)
            .updateOne(
                { _id: key },
                { $set: { value, expiresAt, updatedAt: new Date() } },
                { upsert: true }
            );
    } catch (err) {
        log.warn(`shared SET failed for key "${key}"`, err.message);
    }
}

/** Delete a shared cache entry (call on invalidation). */
async function cacheDel(key) {
    try {
        await getMongoDb().collection(SHARED_COLLECTION).deleteOne({ _id: key });
    } catch (err) {
        log.warn(`shared DEL failed for key "${key}"`, err.message);
    }
}

/** Delete all shared entries whose key starts with a prefix (e.g. "sn:offerings:"). */
async function cacheDelByPrefix(prefix) {
    try {
        await getMongoDb()
            .collection(SHARED_COLLECTION)
            .deleteMany({ _id: { $regex: `^${prefix}` } });
    } catch (err) {
        log.warn(`shared DEL-prefix failed for "${prefix}"`, err.message);
    }
}

/**
 * Call once at startup: TTL index so Mongo auto-deletes expired entries.
 * Idempotent.
 */
async function ensureCacheIndex() {
    try {
        await getMongoDb()
            .collection(SHARED_COLLECTION)
            .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, background: true });
        log.debug('TTL index ensured on shared_cache collection');
    } catch (err) {
        log.warn('could not create shared_cache TTL index', err.message);
    }
}

module.exports = {
    // local tier
    createLocalCache,
    clearAllLocalCaches,
    // shared tier
    cacheGet,
    cacheSet,
    cacheDel,
    cacheDelByPrefix,
    ensureCacheIndex
};
