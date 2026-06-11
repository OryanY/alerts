// services/incident/SystemMappingService.js
const { ObjectId } = require('mongodb');
const { getMongoDb } = require('../../database/connection');
const { mongoConfig } = require('../../config');
const { createLocalCache } = require('../../utils/cache');
const { NotFoundError, ConflictError, ValidationError } = require('../../utils/errors');
const helpers = require('./incidentHelpers');

const mappingCache = createLocalCache('system-mappings', { ttlMs: 5 * 60 * 1000, maxEntries: 5 });

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
