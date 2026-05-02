// services/incident/SystemMappingService.js
const { ObjectId } = require('mongodb');
const { LRUCache } = require('lru-cache');
const { getMongoDb } = require('../../database/connection');
const { mongoConfig } = require('../../config');
const helpers = require('./incidentHelpers');

const mappingCache = new LRUCache({
    max: 1,
    ttl: 5 * 60 * 1000
});

class SystemMappingService {
    constructor() {
        this._collection = null;
    }

    get collection() {
        if (!this._collection) {
            this._collection = getMongoDb().collection(mongoConfig.collections.systemMappings);
        }
        return this._collection;
    }

    async getSystemMappings() {
        const CACHE_KEY = 'all';
        const cached = mappingCache.get(CACHE_KEY);
        if (cached) return cached;
        const mappings = await this.collection.find({}).toArray();
        mappingCache.set(CACHE_KEY, mappings);
        return mappings;
    }

    _invalidateCache() {
        mappingCache.clear();
    }

    async getMappingByApplication(grafanaName) {
        if (!grafanaName) return null;
        const allMappings = await this.getSystemMappings();
        for (const mapping of allMappings) {
            if (!mapping.grafana_names) continue;
            for (const pattern of mapping.grafana_names) {
                const patternObj = typeof pattern === 'string' ? { value: pattern, type: 'exact' } : pattern;
                if (helpers.matchesGrafanaPattern(grafanaName, patternObj)) return mapping;
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
            throw new Error(`Exact match pattern(s) already exist: ${conflicts.join(', ')}`);
        }
    }

    async createSystemMapping(mappingData) {
        const namesToUse = mappingData.grafana_names || mappingData.grafana_name;
        if (!namesToUse) throw new Error('grafana_names is required');

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
        if (result.matchedCount === 0) throw new Error('System mapping not found');
        this._invalidateCache();
        return this.collection.findOne({ _id: objId });
    }

    async deleteSystemMapping(id) {
        const objId = new ObjectId(id);
        const db = getMongoDb();
        const rulesCount = await db.collection(mongoConfig.collections.incidentRules).countDocuments({ system_mapping_id: objId });
        if (rulesCount > 0) throw new Error(`Cannot delete mapping. ${rulesCount} incident rules depend on it.`);

        const result = await this.collection.deleteOne({ _id: objId });
        if (result.deletedCount === 0) throw new Error('System mapping not found');
        this._invalidateCache();
        // Fix: return { message } so the controller's res.json({ message: result.message }) works correctly
        return { message: 'System mapping deleted successfully' };
    }
}

module.exports = SystemMappingService;
