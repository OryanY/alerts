// services/incident/IncidentRuleService.js
const { ObjectId } = require('mongodb');
const { LRUCache } = require('lru-cache');
const { getMongoDb } = require('../../database/connection');
const { mongoConfig } = require('../../config');
const helpers = require('./incidentHelpers');

const ruleCache = new LRUCache({
    max: 3,
    ttl: 5 * 60 * 1000
});

class IncidentRuleService {
    constructor() {
        this._collection = null;
        this._mappingCollection = null;
    }

    get collection() {
        if (!this._collection) {
            this._collection = getMongoDb().collection(mongoConfig.collections.incidentRules);
        }
        return this._collection;
    }

    get mappingCollection() {
        if (!this._mappingCollection) {
            this._mappingCollection = getMongoDb().collection(mongoConfig.collections.systemMappings);
        }
        return this._mappingCollection;
    }

    _aggregateRules(match = {}) {
        return this.collection.aggregate([
            { $match: match },
            { $lookup: { from: mongoConfig.collections.systemMappings, localField: 'system_mapping_id', foreignField: '_id', as: 'system_mapping' } },
            { $unwind: { path: '$system_mapping', preserveNullAndEmptyArrays: true } },
            { $sort: { created_at: -1 } }
        ]).toArray();
    }

    _invalidateCache() {
        ruleCache.clear();
    }

    async getNonExactRules() {
        const CACHE_KEY = 'non-exact';
        const cached = ruleCache.get(CACHE_KEY);
        if (cached) return cached;

        const rules = await this._aggregateRules({
            is_global: { $ne: true },
            'grafana_names.type': { $in: ['contains', 'regex'] }
        });
        ruleCache.set(CACHE_KEY, rules);
        return rules;
    }

    async getIncidentRules(grafanaName = null) {
        if (!grafanaName) return this._aggregateRules({});

        const normalizedName = String(grafanaName).trim().toLowerCase();
        const indexedRules = await this._aggregateRules({
            $or: [
                { is_global: true },
                { grafana_names: normalizedName },
                { grafana_names: { $elemMatch: { type: 'exact', value: normalizedName } } }
            ]
        });

        const nonExactRules = await this.getNonExactRules();
        const matchedNonExactRules = nonExactRules.filter(rule => {
            if (rule.is_global) return true;
            if (!rule.grafana_names || !Array.isArray(rule.grafana_names)) return false;
            return rule.grafana_names.some(pattern => {
                const patternObj = typeof pattern === 'string' ? { value: pattern, type: 'exact' } : pattern;
                return patternObj.type !== 'exact' && helpers.matchesGrafanaPattern(normalizedName, patternObj);
            });
        });

        const byId = new Map();
        [...indexedRules, ...matchedNonExactRules].forEach(rule => {
            byId.set(String(rule._id), rule);
        });
        return [...byId.values()].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    }

    async createIncidentRule(ruleData) {
        let mapping = null;
        if (!ruleData.is_global) {
            if (!ruleData.system_mapping_id) throw new Error('System mapping ID is required for non-global rules');
            mapping = await this.mappingCollection.findOne({ _id: new ObjectId(ruleData.system_mapping_id) });
            if (!mapping) throw new Error('System mapping not found');
        }

        helpers.validateRuleConditions(ruleData.conditions);
        if (ruleData.incident_overrides?.u_system_failure !== undefined) {
            ruleData.incident_overrides.u_system_failure = helpers.parseBoolean(ruleData.incident_overrides.u_system_failure);
        }

        const dataToInsert = {
            ...ruleData,
            system_mapping_id: mapping ? mapping._id : null,
            grafana_names: mapping ? mapping.grafana_names : [],
            is_global: !!ruleData.is_global,
            logic_operator: ruleData.logic_operator || 'OR',
            created_at: new Date(),
            updated_at: new Date()
        };

        const result = await this.collection.insertOne(dataToInsert);
        this._invalidateCache();
        return { _id: result.insertedId, ...dataToInsert };
    }

    async updateIncidentRule(id, ruleData) {
        const { _id, created_at, system_mapping_id, ...updateData } = ruleData;

        if (system_mapping_id) {
            const mapping = await this.mappingCollection.findOne({ _id: new ObjectId(system_mapping_id) });
            if (!mapping) throw new Error('System mapping not found');
            updateData.system_mapping_id = mapping._id;
            updateData.grafana_names = mapping.grafana_names;
        }

        if (updateData.conditions) helpers.validateRuleConditions(updateData.conditions);
        if (updateData.incident_overrides?.u_system_failure !== undefined) {
            updateData.incident_overrides.u_system_failure = helpers.parseBoolean(updateData.incident_overrides.u_system_failure);
        }

        updateData.updated_at = new Date();
        const objId = new ObjectId(id);
        const result = await this.collection.updateOne({ _id: objId }, { $set: updateData });
        if (result.matchedCount === 0) throw new Error('Incident rule not found');
        this._invalidateCache();
        return this.collection.findOne({ _id: objId });
    }

    async deleteIncidentRule(id) {
        const result = await this.collection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) throw new Error('Incident rule not found');
        this._invalidateCache();
        return { message: 'Incident rule deleted successfully', deletedCount: result.deletedCount };
    }

    async toggleIncidentRule(id, enabled) {
        const objId = new ObjectId(id);
        const result = await this.collection.updateOne({ _id: objId }, { $set: { enabled, updated_at: new Date() } });
        if (result.matchedCount === 0) throw new Error('Incident rule not found');
        this._invalidateCache();
        return { message: `Incident rule ${enabled ? 'enabled' : 'disabled'} successfully` };
    }
}

module.exports = IncidentRuleService;
