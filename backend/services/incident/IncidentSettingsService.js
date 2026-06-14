// services/incident/IncidentSettingsService.js
// CRUD for the incident field configuration (content templates + default
// field values). Stored as a single document in the `incident_settings`
// collection.
//
// Caching: a short-TTL local cache (see utils/cache.js). The Mongo read is
// already sub-millisecond, so this is just to avoid a round-trip on bursts
// of incident creation. The cache is invalidated immediately on the pod
// that performs a write; other pods refresh within the TTL window.

const { getMongoDb } = require('../../database/connection');
const { mongoConfig } = require('../../config');
const { createLocalCache } = require('../../utils/cache');
const { DEFAULT_INCIDENT_SETTINGS } = require('./incidentSettingsDefaults');

const SETTINGS_DOC_ID = 'incident_field_config';
const CACHE_KEY = 'effective-settings';

const settingsCache = createLocalCache('incident-settings', { ttlMs: 30 * 1000, maxEntries: 1 });

class IncidentSettingsService {
    constructor() {
        this._collection = null;
    }

    get collection() {
        if (!this._collection) {
            this._collection = getMongoDb().collection(mongoConfig.collections.incidentSettings);
        }
        return this._collection;
    }

    /**
     * Effective settings: stored values layered over code defaults.
     * Each top-level key is atomic — a stored key fully replaces the
     * default for that key (the UI always saves whole sections).
     */
    async getSettings() {
        const cached = settingsCache.get(CACHE_KEY);
        if (cached) return cached;

        const stored = await this.collection.findOne({ _id: SETTINGS_DOC_ID });
        let effective;
        if (!stored) {
            effective = { ...DEFAULT_INCIDENT_SETTINGS };
        } else {
            const { _id, updated_at, ...overrides } = stored;
            effective = { ...DEFAULT_INCIDENT_SETTINGS, ...overrides, updated_at };
        }
        settingsCache.set(CACHE_KEY, effective);
        return effective;
    }

    /** Persist the provided sections (already Joi-validated at the route). */
    async updateSettings(patch) {
        await this.collection.updateOne(
            { _id: SETTINGS_DOC_ID },
            { $set: { ...patch, updated_at: new Date() } },
            { upsert: true }
        );
        settingsCache.clear(); // this pod is fresh immediately; others within TTL
        return this.getSettings();
    }

    /** Delete stored overrides — reverts to the code defaults. */
    async resetSettings() {
        await this.collection.deleteOne({ _id: SETTINGS_DOC_ID });
        settingsCache.clear();
        return { ...DEFAULT_INCIDENT_SETTINGS };
    }
}

module.exports = IncidentSettingsService;
