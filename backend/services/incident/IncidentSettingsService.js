// services/incident/IncidentSettingsService.js
// CRUD for the incident field configuration (templates, default fields,
// required fields, application rewrites).
//
// Reads go straight to Mongo on every call — incident creation volume is
// low, and this guarantees that a settings change made in the UI applies
// to the very next incident on every pod, with no restart and no
// cross-replica cache staleness.

const { getMongoDb } = require('../../database/connection');
const { mongoConfig } = require('../../config');
const { DEFAULT_INCIDENT_SETTINGS } = require('./incidentSettingsDefaults');

const SETTINGS_DOC_ID = 'incident_field_config';

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
        const stored = await this.collection.findOne({ _id: SETTINGS_DOC_ID });
        if (!stored) return { ...DEFAULT_INCIDENT_SETTINGS };
        const { _id, updated_at, ...overrides } = stored;
        return { ...DEFAULT_INCIDENT_SETTINGS, ...overrides, updated_at };
    }

    /** Persist the provided sections (already Joi-validated at the route). */
    async updateSettings(patch) {
        await this.collection.updateOne(
            { _id: SETTINGS_DOC_ID },
            { $set: { ...patch, updated_at: new Date() } },
            { upsert: true }
        );
        return this.getSettings();
    }

    /** Delete stored overrides — reverts to the code defaults. */
    async resetSettings() {
        await this.collection.deleteOne({ _id: SETTINGS_DOC_ID });
        return { ...DEFAULT_INCIDENT_SETTINGS };
    }
}

module.exports = IncidentSettingsService;
