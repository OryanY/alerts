// services/incident/IncidentService.js - Orchestration layer (REFACTORED)
const { getMongoDb } = require('../../database/connection');
const { mongoConfig } = require('../../config');
const { IncidentQueryService } = require('./IncidentQueryService');
const { IncidentRuleEngine } = require('./IncidentRuleEngine');
const { ServiceNowClient } = require('./ServiceNowClient');
const { IncidentTransformService } = require('./IncidentTransformService');

/**
 * This service uses the following sub-services:
 * - IncidentQueryService: MongoDB operations
 * - IncidentRuleEngine: Rule matching logic
 * - ServiceNowClient: Api calls to ServiceNow
 * - IncidentTransformService: Data transformation
 */
class IncidentService {
    constructor() {
        this.queryService = null;
        this.ruleEngine = null;
        this.serviceNowClient = null;
        this.transformService = null;
    }

    // Initialize all sub-services
    async initialize() {
        const db = getMongoDb();

        // Initialize query service
        this.queryService = new IncidentQueryService(db, {
            systemMappings: db.collection(mongoConfig.collections.systemMappings),
            incidentRules: db.collection(mongoConfig.collections.incidentRules),
            assignmentGroups: db.collection(mongoConfig.collections.assignmentGroups)
        });

        // Initialize other services
        this.ruleEngine = new IncidentRuleEngine();
        this.serviceNowClient = new ServiceNowClient();
        this.transformService = new IncidentTransformService();
        console.log('✅ IncidentService initialized with all sub-services.');
    }

    // ================== INCIDENT CREATION ==================

    // Create an incident from alert data (main orchestration method)
    async createIncidentFromAlert(alertData) {
        if (!this.queryService) await this.initialize();

        try {
            const { application } = alertData;

            if (!application) {
                throw new Error('Alert must have an application field');
            }

            console.log('🔍 Alert Data:', JSON.stringify(alertData, null, 2));

            if (alertData.user) {
                console.log('👤 Incident created by user:', alertData.user);
            }

            // 1. Find matching system mapping
            const systemMapping = await this.queryService.findMappingByApplication(
                application,
                this.ruleEngine
            );

            if (!systemMapping) {
                throw new Error(`No system mapping found for application: ${application}`);
            }

            console.log(`✅ Found system mapping for: ${application}`);

            // 2. Find matching rules
            const rules = await this.queryService.findEnabledRules(
                application,
                this.ruleEngine
            );

            console.log(`📋 Found ${rules.length} enabled rules for application: ${application}`);

            // 3. Find best matching rule
            const matchedRule = this.ruleEngine.findBestMatch(alertData, rules);

            if (matchedRule) {
                console.log(`🎯 Matched rule: ${matchedRule.rule_name}`);
            } else {
                console.log('ℹ️  No specific rule matched, using base system mapping');
            }

            // 4. Build incident data
            const incidentData = this.transformService.buildIncidentData(
                systemMapping,
                matchedRule?.incident_overrides || {},
                alertData
            );

            console.log('📝 Built incident data:', JSON.stringify(incidentData, null, 2));

            // 5. Send to ServiceNow
            const result = await this.serviceNowClient.createIncident(incidentData);

            return {
                incidentData,  // Include the built incident data in response
                serviceNowResult: result,
                mapping_used: systemMapping._id,
                rule_used: matchedRule?._id || null,
                rule_name: matchedRule?.rule_name || 'Base Mapping',
                matched_applications: systemMapping.grafana_names
            };

        } catch (error) {
            console.error('❌ Error creating incident from alert:', error);
            throw error;
        }
    }

    // ================== SYSTEM MAPPINGS ==================

    async getSystemMappings() {
        if (!this.queryService) await this.initialize();
        return this.queryService.findAllMappings();
    }

    async getMappingByApplication(grafanaName) {
        if (!this.queryService) await this.initialize();
        return this.queryService.findMappingByApplication(grafanaName, this.ruleEngine);
    }

    async createSystemMapping(mappingData) {
        if (!this.queryService) await this.initialize();

        try {
            // Handle legacy grafana_name field
            let namesToUse = mappingData.grafana_names || mappingData.grafana_name;

            if (!namesToUse) {
                throw new Error('grafana_names is required');
            }

            // Validate and sanitize patterns
            const sanitizedPatterns = this.transformService.validateGrafanaPatterns(namesToUse);

            // Check for conflicts
            await this.queryService.checkMappingConflicts(sanitizedPatterns);

            // Create mapping
            const dataToInsert = {
                ...mappingData,
                grafana_names: sanitizedPatterns,
                u_system_failure: this.transformService.parseBoolean(mappingData.u_system_failure),
                created_at: new Date(),
                updated_at: new Date()
            };

            delete dataToInsert.grafana_name;

            const result = await this.queryService.createMapping(dataToInsert);

            const patternSummary = sanitizedPatterns.map(p =>
                `${p.value} (${p.type})`
            ).join(', ');
            console.log(`✅ Created system mapping with patterns: ${patternSummary}`);

            return result;
        } catch (error) {
            console.error('❌ Error creating system mapping:', error);
            throw error;
        }
    }

    async updateSystemMapping(id, mappingData) {
        if (!this.queryService) await this.initialize();

        try {
            const { _id, created_at, ...updateData } = mappingData;

            if (updateData.grafana_names) {
                const sanitizedPatterns = this.transformService.validateGrafanaPatterns(
                    updateData.grafana_names
                );

                // Check for conflicts (excluding this mapping)
                await this.queryService.checkMappingConflicts(sanitizedPatterns, id);

                updateData.grafana_names = sanitizedPatterns;
            }

            if ('u_system_failure' in updateData) {
                updateData.u_system_failure = this.transformService.parseBoolean(
                    updateData.u_system_failure
                );
            }

            const result = await this.queryService.updateMapping(id, updateData);
            console.log(`✅ Updated system mapping: ${id}`);
            return result;
        } catch (error) {
            console.error('❌ Error updating system mapping:', error);
            throw error;
        }
    }

    async deleteSystemMapping(id) {
        if (!this.queryService) await this.initialize();

        try {
            const result = await this.queryService.deleteMapping(id);
            console.log(`✅ Deleted system mapping: ${id}`);
            return result;
        } catch (error) {
            console.error('❌ Error deleting system mapping:', error);
            throw error;
        }
    }

    // ================== INCIDENT RULES ==================

    async getIncidentRules(grafanaName = null) {
        if (!this.queryService) await this.initialize();
        return this.queryService.findAllRules(grafanaName, this.ruleEngine);
    }

    async createIncidentRule(ruleData) {
        if (!this.queryService) await this.initialize();

        try {
            let mapping = null;
            if (ruleData.is_global) {
                // Global rules don't need a mapping
                console.log('🌍 Creating Global Incident Rule');
            } else {
                // Specific rules require a mapping
                if (!ruleData.system_mapping_id) {
                    throw new Error('System mapping ID is required for non-global rules');
                }
                mapping = await this.queryService.findMappingById(ruleData.system_mapping_id);

                if (!mapping) {
                    throw new Error('System mapping not found');
                }
            }

            // Validate rule conditions
            this.ruleEngine.validateRuleConditions(ruleData.conditions);

            // Parse boolean fields
            if (ruleData.incident_overrides?.u_system_failure !== undefined) {
                ruleData.incident_overrides.u_system_failure = this.transformService.parseBoolean(
                    ruleData.incident_overrides.u_system_failure
                );
            }

            const dataToInsert = {
                ...ruleData,
                system_mapping_id: mapping ? mapping._id : null,
                grafana_names: mapping ? mapping.grafana_names : [], // Globals have no specific grafana names
                is_global: !!ruleData.is_global,
                logic_operator: ruleData.logic_operator || 'OR',
                created_at: new Date(),
                updated_at: new Date()
            };

            const result = await this.queryService.createRule(dataToInsert);

            if (mapping) {
                console.log(`✅ Created incident rule for applications: ${mapping.grafana_names.map(p => p.value).join(', ')}`);
            } else {
                console.log('✅ Created Global incident rule');
            }
            return result;
        } catch (error) {
            console.error('❌ Error creating incident rule:', error);
            throw error;
        }
    }

    async updateIncidentRule(id, ruleData) {
        if (!this.queryService) await this.initialize();

        try {
            const { _id, created_at, system_mapping_id, ...updateData } = ruleData;

            // If updating system mapping, verify it exists and update grafana_names
            if (system_mapping_id) {
                const mapping = await this.queryService.findMappingById(system_mapping_id);
                if (!mapping) {
                    throw new Error('System mapping not found');
                }
                updateData.system_mapping_id = mapping._id;
                updateData.grafana_names = mapping.grafana_names;
            }

            // Validate conditions if provided
            if (updateData.conditions) {
                this.ruleEngine.validateRuleConditions(updateData.conditions);
            }

            // Parse boolean fields
            if (updateData.incident_overrides?.u_system_failure !== undefined) {
                updateData.incident_overrides.u_system_failure = this.transformService.parseBoolean(
                    updateData.incident_overrides.u_system_failure
                );
            }

            const result = await this.queryService.updateRule(id, updateData);
            console.log(`✅ Updated incident rule: ${id}`);
            return result;
        } catch (error) {
            console.error('❌ Error updating incident rule:', error);
            throw error;
        }
    }

    async deleteIncidentRule(id) {
        if (!this.queryService) await this.initialize();

        try {
            const result = await this.queryService.deleteRule(id);
            console.log(`✅ Deleted incident rule: ${id}`);
            return result;
        } catch (error) {
            console.error('❌ Error deleting incident rule:', error);
            throw error;
        }
    }

    async toggleIncidentRule(id, enabled) {
        if (!this.queryService) await this.initialize();

        try {
            const result = await this.queryService.toggleRule(id, enabled);
            console.log(`✅ Toggled incident rule ${id}: ${enabled ? 'enabled' : 'disabled'}`);
            return result;
        } catch (error) {
            console.error('❌ Error toggling incident rule:', error);
            throw error;
        }
    }

    // ================== SERVICENOW INTEGRATION ==================

    async getAssignmentGroups() {
        if (!this.queryService) await this.initialize();
        return this.queryService.getAssignmentGroups();
    }

    async syncAssignmentGroups() {
        if (!this.serviceNowClient) await this.initialize();
        if (!this.queryService) await this.initialize();

        try {
            const groups = await this.serviceNowClient.fetchAssignmentGroups();
            await this.queryService.saveAssignmentGroups(groups);
            console.log(`✅ Synced ${groups.length} assignment groups to MongoDB`);
            return groups;
        } catch (error) {
            console.error('❌ Sync failed:', error);
            throw error;
        }
    }
    // Create ServiceNow alert only (simpler than full incident)
    async createServiceNowAlert(alertData) {
        if (!this.queryService) await this.initialize();

        try {
            const { application, incident_number } = alertData;
            if (!application) throw new Error('Alert must have an application field');

            // Find basic system mapping for this application
            const systemMapping = await this.queryService.findMappingByApplication(
                application,
                this.ruleEngine
            );

            if (!systemMapping) {
                const allMappings = await this.queryService.findAllMappings();
                throw new Error(
                    `No system mapping found for application: ${application}. ` +
                    `Available mappings cover: ${allMappings.map(m => m.grafana_names.map(p => p.value).join(', ')).join(' | ')}`
                );
            }

            // Build simplified alert data (not full incident)
            const alertPayload = {
                // Core alert fields
                short_description: `Alert: ${alertData.message}`,
                description: `Application: ${alertData.application}\nObject: ${alertData.object_name}\nNode: ${alertData.node_name}\nMessage: ${alertData.message}\nTime: ${alertData.time_created}`,

                // System mapping fields (minimal set)
                assignment_group: systemMapping.assignment_group,
                u_network: systemMapping.u_network,

                // Link to incident if provided
                ...(incident_number && { parent_incident: incident_number }),

            };

            console.log('📤 Alert payload:', JSON.stringify(alertPayload, null, 2));

            // Send to ServiceNow
            const serviceNowResult = await this.serviceNowClient.createIncident(alertPayload);

            return {
                alertPayload,
                serviceNowResult,
                matched_applications: systemMapping.grafana_names,
                mapping_used: systemMapping._id
            };
        } catch (error) {
            console.error('❌ Error creating ServiceNow alert:', error);
            throw error;
        }
    }

    // Create incident + optional alert
    async createIncidentWithAlert(alertData, createAlert = true, linkToIncident = true) {
        if (!this.queryService) await this.initialize();

        try {
            // First create the incident
            const incidentResult = await this.createIncidentFromAlert(alertData);

            // If createAlert is false, just return incident result
            if (!createAlert) {
                return incidentResult;
            }

            // Otherwise, also create a ServiceNow alert
            const alertResult = await this.createServiceNowAlert({
                ...alertData,
                incident_number: linkToIncident ? incidentResult.serviceNowResult?.incident_number : undefined
            });

            return {
                incident: incidentResult,
                alert: alertResult
            };
        } catch (error) {
            console.error('❌ Error creating incident with alert:', error);
            throw error;
        }
    }

    // ================== SIMULATION & DEBUGGING ==================

    async simulateIncidentCreation(alertData) {
        if (!this.queryService) await this.initialize();

        try {
            const { application } = alertData;
            if (!application) throw new Error('Alert must have an application field');

            // 1. Find matching system mapping
            const systemMapping = await this.queryService.findMappingByApplication(
                application,
                this.ruleEngine
            );

            // 2. Find matching rules (Specific + Global)
            const rules = await this.queryService.findEnabledRules(
                application,
                this.ruleEngine
            );

            // 3. Find all matches
            const allMatches = this.ruleEngine.findAllMatches(alertData, rules);
            const winner = allMatches.length > 0 ? allMatches[0] : null;

            // 4. Build incident data (preview)
            let incidentData = null;
            if (systemMapping) {
                incidentData = this.transformService.buildIncidentData(
                    systemMapping,
                    winner?.rule?.incident_overrides || {},
                    alertData
                );
            }

            return {
                system_mapping: systemMapping || null,
                winner: winner,
                shadowed_rules: allMatches.slice(1), // All matches except the winner
                total_rules_checked: rules.length,
                generated_incident: incidentData,
                hierarchy_explanation: [
                    "1. Specific Rules (Highest Priority)",
                    "2. Global Rules",
                    "3. System Mapping Defaults (Lowest Priority)"
                ]
            };
        } catch (error) {
            console.error('❌ Error simulating incident:', error);
            throw error;
        }
    }

}
module.exports = IncidentService;
