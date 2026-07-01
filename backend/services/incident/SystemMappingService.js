// services/incident/SystemMappingService.js
const { ObjectId } = require('mongodb');
const { getMongoDb } = require('../../database/connection');
const { mongoConfig } = require('../../config');
const { createLocalCache } = require('../../utils/cache');
const { NotFoundError, ConflictError, ValidationError } = require('../../utils/errors');
const { logger } = require('../../utils/logger');
const helpers = require('./incidentHelpers');

const mappingCache = createLocalCache('system-mappings', { ttlMs: 5 * 60 * 1000, maxEntries: 5 });
const log = logger.tagged('mapping-queue');

// Cap the "needs mapping" queue so it self-maintains without anyone pruning it:
// dedup keeps it to distinct apps, and the trim below evicts the oldest beyond this.
const QUEUE_MAX = 100;

class SystemMappingService {
    constructor() {
        this._collection = null;
        this._queueCollection = null;
    }

    get collection() {
        if (!this._collection) {
            this._collection = getMongoDb().collection(mongoConfig.collections.systemMappings);
        }
        return this._collection;
    }

    // Separate collection holding applications that fired an alert but had no
    // mapping — a self-maintaining todo list for analysts (see recordMappingMiss).
    get queueCollection() {
        if (!this._queueCollection) {
            this._queueCollection = getMongoDb().collection(mongoConfig.collections.mappingQueue);
        }
        return this._queueCollection;
    }

    async getSystemMappings() {
        const CACHE_KEY = 'all';
        const cached = mappingCache.get(CACHE_KEY);
        if (cached) return cached;
        const mappings = await this.collection.find({}).toArray();
        mappingCache.set(CACHE_KEY, mappings);
        return mappings;
    }

    async getNonExactMappings() {
        const CACHE_KEY = 'non-exact';
        const cached = mappingCache.get(CACHE_KEY);
        if (cached) return cached;

        const mappings = await this.collection.find({
            'grafana_names.type': { $in: ['contains', 'regex'] }
        }).toArray();
        mappingCache.set(CACHE_KEY, mappings);
        return mappings;
    }

    _invalidateCache() {
        mappingCache.clear();
    }

    // ================== "NEEDS MAPPING" QUEUE ==================

    // Record that an alert arrived for an application with no mapping. Deduped by
    // the normalized application name (same normalization as getMappingByApplication)
    // so one noisy unmapped app bumps a counter instead of flooding the queue.
    // Best-effort: callers fire-and-forget; a failure here must never break the
    // incident flow that triggered it.
    async recordMappingMiss(application, context = {}) {
        if (!application) return;
        const normalized = String(application).trim().toLowerCase();
        if (!normalized) return;

        const now = new Date();
        await this.queueCollection.updateOne(
            { application: normalized },
            {
                $set: { last_seen: now, ...(context.panel_title ? { last_panel: context.panel_title } : {}) },
                $setOnInsert: { application: normalized, display_name: application, first_seen: now },
                $inc: { hit_count: 1 }
            },
            { upsert: true }
        );

        // Trim to the newest QUEUE_MAX distinct apps (evict oldest by last_seen).
        const count = await this.queueCollection.countDocuments();
        if (count > QUEUE_MAX) {
            const oldest = await this.queueCollection
                .find({}, { projection: { _id: 1 } })
                .sort({ last_seen: 1 })
                .limit(count - QUEUE_MAX)
                .toArray();
            if (oldest.length) {
                await this.queueCollection.deleteMany({ _id: { $in: oldest.map(o => o._id) } });
            }
        }
    }

    async getMappingQueue() {
        return this.queueCollection
            .find({})
            .sort({ hit_count: -1, last_seen: -1 })
            .toArray();
    }

    async dismissMappingQueueEntry(id) {
        const result = await this.queueCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) throw new NotFoundError('Queue entry not found');
        return { message: 'Removed from queue', deletedCount: result.deletedCount };
    }

    // Drop queue entries that a set of mapping patterns now covers — closes the
    // loop so an app disappears from the todo list the moment it gets mapped.
    // Best-effort: never blocks mapping create/update.
    async _cleanQueueForPatterns(patterns) {
        try {
            const entries = await this.queueCollection
                .find({}, { projection: { _id: 1, application: 1 } })
                .toArray();
            const toRemove = entries
                .filter(e => patterns.some(p =>
                    helpers.matchesGrafanaPattern(e.application, typeof p === 'string' ? { value: p, type: 'exact' } : p)
                ))
                .map(e => e._id);
            if (toRemove.length) {
                await this.queueCollection.deleteMany({ _id: { $in: toRemove } });
            }
        } catch (e) {
            log.warn('failed to clean mapping queue after mapping change', e.message);
        }
    }

    async getMappingByApplication(grafanaName) {
        if (!grafanaName) return null;

        const normalizedName = String(grafanaName).trim().toLowerCase();
        const exactMapping = await this.collection.findOne({
            $or: [
                { grafana_names: normalizedName },
                { grafana_names: { $elemMatch: { type: 'exact', value: normalizedName } } }
            ]
        });
        if (exactMapping) return exactMapping;

        const nonExactMappings = await this.getNonExactMappings();
        for (const mapping of nonExactMappings) {
            if (!mapping.grafana_names) continue;
            for (const pattern of mapping.grafana_names) {
                const patternObj = typeof pattern === 'string' ? { value: pattern, type: 'exact' } : pattern;
                if (patternObj.type !== 'exact' && helpers.matchesGrafanaPattern(normalizedName, patternObj)) return mapping;
            }
        }
        return null;
    }

    async checkMappingConflicts(patterns, excludeId = null) {
        const exactValues = patterns.filter(p => p.type === 'exact').map(p => p.value);
        if (exactValues.length === 0) return;

        const query = { 'grafana_names.value': { $in: exactValues }, 'grafana_names.type': 'exact' };
        if (excludeId) query._id = { $ne: new ObjectId(excludeId) };

        const existingMapping = await this.collection.findOne(query);
        if (existingMapping) {
            const conflicts = exactValues.filter(val => existingMapping.grafana_names.some(p => (typeof p === 'string' ? p : p.value) === val));
            throw new ConflictError(`Exact match pattern(s) already exist: ${conflicts.join(', ')}`);
        }
    }

    async createSystemMapping(mappingData) {
        const namesToUse = mappingData.grafana_names || mappingData.grafana_name;
        if (!namesToUse) throw new ValidationError('grafana_names is required');

        const sanitizedPatterns = helpers.validateGrafanaPatterns(namesToUse);
        await this.checkMappingConflicts(sanitizedPatterns);

        const dataToInsert = {
            ...mappingData,
            grafana_names: sanitizedPatterns,
            u_system_failure: helpers.parseBoolean(mappingData.u_system_failure),
            created_at: new Date(),
            updated_at: new Date()
        };
        delete dataToInsert.grafana_name;

        const result = await this.collection.insertOne(dataToInsert);
        this._invalidateCache();
        this._cleanQueueForPatterns(sanitizedPatterns);
        return { _id: result.insertedId, ...dataToInsert };
    }

    async updateSystemMapping(id, mappingData) {
        const { _id, created_at, ...updateData } = mappingData;

        if (updateData.grafana_names) {
            updateData.grafana_names = helpers.validateGrafanaPatterns(updateData.grafana_names);
            await this.checkMappingConflicts(updateData.grafana_names, id);
        }

        if ('u_system_failure' in updateData) {
            updateData.u_system_failure = helpers.parseBoolean(updateData.u_system_failure);
        }

        updateData.updated_at = new Date();
        const objId = new ObjectId(id);
        const result = await this.collection.updateOne({ _id: objId }, { $set: updateData });
        if (result.matchedCount === 0) throw new NotFoundError('System mapping not found');
        this._invalidateCache();
        if (updateData.grafana_names) this._cleanQueueForPatterns(updateData.grafana_names);
        return this.collection.findOne({ _id: objId });
    }

    async deleteSystemMapping(id) {
        const objId = new ObjectId(id);
        const db = getMongoDb();
        const rulesCount = await db.collection(mongoConfig.collections.incidentRules).countDocuments({ system_mapping_id: objId });
        if (rulesCount > 0) throw new ConflictError(`Cannot delete mapping. ${rulesCount} incident rules depend on it.`);

        const result = await this.collection.deleteOne({ _id: objId });
        if (result.deletedCount === 0) throw new NotFoundError('System mapping not found');
        this._invalidateCache();
        return { message: 'System mapping deleted successfully', deletedCount: result.deletedCount };
    }
}

module.exports = SystemMappingService;
