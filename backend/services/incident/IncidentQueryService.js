// services/incident/IncidentQueryService.js - MongoDB data access layer
const { ObjectId } = require('mongodb');

/**
 * IncidentQueryService - Handles all MongoDB queries
 * Single Responsibility: Database operations only, no business logic
 */
class IncidentQueryService {
    constructor(db, collections) {
        this.db = db;
        this.systemMappingsCollection = collections.systemMappings;
        this.incidentRulesCollection = collections.incidentRules;
    }

    /**
     * Create database indexes
     */
    async createIndexes() {
        try {
            await this.systemMappingsCollection.createIndex({ grafana_names: 1 });
            await this.incidentRulesCollection.createIndex({ grafana_names: 1 });
            await this.incidentRulesCollection.createIndex({ enabled: 1 });
            console.log('✅ Incident database indexes created successfully');
        } catch (error) {
            console.warn('⚠️  Index creation warning:', error.message);
        }
    }

    // ================== SYSTEM MAPPINGS ==================

    /**
     * Find all system mappings
     */
    async findAllMappings() {
        try {
            return await this.systemMappingsCollection.find({}).toArray();
        } catch (error) {
            console.error('❌ Error fetching system mappings:', error);
            throw new Error('Failed to fetch system mappings');
        }
    }

    /**
     * Find system mapping by ID
     */
    async findMappingById(id) {
        try {
            const objectId = new ObjectId(id);
            return await this.systemMappingsCollection.findOne({ _id: objectId });
        } catch (error) {
            console.error('❌ Error fetching mapping by ID:', error);
            throw new Error('Failed to fetch mapping');
        }
    }

    /**
     * Find system mapping by application name (using pattern matching)
     * This is done in-memory because patterns can be regex/contains
     */
    async findMappingByApplication(grafanaName, ruleEngine) {
        try {
            if (!grafanaName || typeof grafanaName !== 'string') {
                throw new Error('Invalid grafana_name');
            }

            // Get all mappings
            const allMappings = await this.systemMappingsCollection.find({}).toArray();

            // Find the first mapping where any pattern matches
            for (const mapping of allMappings) {
                if (!mapping.grafana_names) continue;

                for (const pattern of mapping.grafana_names) {
                    // Handle legacy string format
                    const patternObj = typeof pattern === 'string'
                        ? { value: pattern, type: 'exact' }
                        : pattern;

                    if (ruleEngine.matchesGrafanaPattern(grafanaName, patternObj)) {
                        return mapping;
                    }
                }
            }

            return null;
        } catch (error) {
            console.error('❌ Error fetching mapping by application:', error);
            throw new Error('Failed to fetch mapping');
        }
    }

    /**
     * Create system mapping
     */
    async createMapping(mappingData) {
        try {
            const result = await this.systemMappingsCollection.insertOne(mappingData);
            return { _id: result.insertedId, ...mappingData };
        } catch (error) {
            console.error('❌ Error creating system mapping:', error);
            throw error;
        }
    }

    /**
     * Update system mapping
     */
    async updateMapping(id, updateData) {
        try {
            const objectId = new ObjectId(id);

            const result = await this.systemMappingsCollection.updateOne(
                { _id: objectId },
                { $set: { ...updateData, updated_at: new Date() } }
            );

            if (result.matchedCount === 0) {
                throw new Error('System mapping not found');
            }

            return await this.systemMappingsCollection.findOne({ _id: objectId });
        } catch (error) {
            console.error('❌ Error updating system mapping:', error);
            throw error;
        }
    }

    /**
     * Delete system mapping
     */
    async deleteMapping(id) {
        try {
            const objectId = new ObjectId(id);

            // Check if rules depend on this mapping
            const rulesCount = await this.incidentRulesCollection.countDocuments({
                system_mapping_id: objectId
            });

            if (rulesCount > 0) {
                throw new Error(`Cannot delete mapping. ${rulesCount} incident rules depend on it.`);
            }

            const result = await this.systemMappingsCollection.deleteOne({ _id: objectId });

            if (result.deletedCount === 0) {
                throw new Error('System mapping not found');
            }

            return { message: 'System mapping deleted successfully' };
        } catch (error) {
            console.error('❌ Error deleting system mapping:', error);
            throw error;
        }
    }

    /**
     * Check for exact pattern conflicts
     */
    async checkMappingConflicts(patterns, excludeId = null) {
        const exactPatterns = patterns.filter(p => p.type === 'exact');
        if (exactPatterns.length === 0) return;

        const exactValues = exactPatterns.map(p => p.value);
        const query = {
            'grafana_names.value': { $in: exactValues },
            'grafana_names.type': 'exact'
        };

        if (excludeId) {
            query._id = { $ne: new ObjectId(excludeId) };
        }

        const existingMapping = await this.systemMappingsCollection.findOne(query);

        if (existingMapping) {
            const conflicts = exactValues.filter(val =>
                existingMapping.grafana_names.some(
                    p => (typeof p === 'string' ? p : p.value) === val
                )
            );
            throw new Error(`Exact match pattern(s) already exist: ${conflicts.join(', ')}`);
        }
    }

    // ================== INCIDENT RULES ==================

    /**
     * Find all incident rules (optionally filtered by grafana name)
     */
    async findAllRules(grafanaName = null, ruleEngine = null) {
        try {
            const allRules = await this.incidentRulesCollection
                .aggregate([
                    { $match: {} },
                    {
                        $lookup: {
                            from: this.systemMappingsCollection.collectionName,
                            localField: 'system_mapping_id',
                            foreignField: '_id',
                            as: 'system_mapping'
                        }
                    },
                    {
                        $unwind: {
                            path: '$system_mapping',
                            preserveNullAndEmptyArrays: true
                        }
                    },
                    { $sort: { created_at: -1 } }
                ])
                .toArray();

            // If no filter, return all
            if (!grafanaName || !ruleEngine) {
                return allRules;
            }

            // Filter rules where grafanaName matches any pattern
            const matchingRules = allRules.filter(rule => {
                if (!rule.grafana_names || !Array.isArray(rule.grafana_names)) return false;

                return rule.grafana_names.some(pattern => {
                    const patternObj = typeof pattern === 'string'
                        ? { value: pattern, type: 'exact' }
                        : pattern;

                    return ruleEngine.matchesGrafanaPattern(grafanaName, patternObj);
                });
            });

            return matchingRules;
        } catch (error) {
            console.error('❌ Error fetching incident rules:', error);
            throw new Error('Failed to fetch incident rules');
        }
    }

    /**
     * Find enabled rules only
     */
    async findEnabledRules(grafanaName, ruleEngine) {
        const allRules = await this.findAllRules(grafanaName, ruleEngine);
        return allRules.filter(rule => rule.enabled !== false);
    }

    /**
     * Find rule by ID
     */
    async findRuleById(id) {
        try {
            const objectId = new ObjectId(id);
            return await this.incidentRulesCollection.findOne({ _id: objectId });
        } catch (error) {
            console.error('❌ Error fetching rule by ID:', error);
            throw new Error('Failed to fetch rule');
        }
    }

    /**
     * Create incident rule
     */
    async createRule(ruleData) {
        try {
            const result = await this.incidentRulesCollection.insertOne(ruleData);
            return { _id: result.insertedId, ...ruleData };
        } catch (error) {
            console.error('❌ Error creating incident rule:', error);
            throw error;
        }
    }

    /**
     * Update incident rule
     */
    async updateRule(id, updateData) {
        try {
            const objectId = new ObjectId(id);

            const result = await this.incidentRulesCollection.updateOne(
                { _id: objectId },
                { $set: { ...updateData, updated_at: new Date() } }
            );

            if (result.matchedCount === 0) {
                throw new Error('Incident rule not found');
            }

            return await this.incidentRulesCollection.findOne({ _id: objectId });
        } catch (error) {
            console.error('❌ Error updating incident rule:', error);
            throw error;
        }
    }

    /**
     * Delete incident rule
     */
    async deleteRule(id) {
        try {
            const objectId = new ObjectId(id);
            const result = await this.incidentRulesCollection.deleteOne({ _id: objectId });

            if (result.deletedCount === 0) {
                throw new Error('Incident rule not found');
            }

            return { message: 'Incident rule deleted successfully' };
        } catch (error) {
            console.error('❌ Error deleting incident rule:', error);
            throw error;
        }
    }

    /**
     * Toggle rule enabled status
     */
    async toggleRule(id, enabled) {
        try {
            const objectId = new ObjectId(id);
            const result = await this.incidentRulesCollection.updateOne(
                { _id: objectId },
                { $set: { enabled, updated_at: new Date() } }
            );

            if (result.matchedCount === 0) {
                throw new Error('Incident rule not found');
            }

            return { message: `Incident rule ${enabled ? 'enabled' : 'disabled'} successfully` };
        } catch (error) {
            console.error('❌ Error toggling incident rule:', error);
            throw error;
        }
    }

    /**
     * Count rules by mapping ID
     */
    async countRulesByMapping(mappingId) {
        try {
            const objectId = new ObjectId(mappingId);
            return await this.incidentRulesCollection.countDocuments({
                system_mapping_id: objectId
            });
        } catch (error) {
            console.error('❌ Error counting rules:', error);
            return 0;
        }
    }
}

module.exports = { IncidentQueryService };
