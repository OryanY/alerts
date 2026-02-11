// services/incident/IncidentService.js
// Orchestration layer for incident management: ServiceNow integration,
// system mappings (Grafana app → ServiceNow fields), incident rules, and assignment groups.
// Uses lazy-loaded sub-services to avoid circular dependencies.
// Used by: IncidentController (all incident-related endpoints)
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
        // Lazy-loaded services
        this._queryService = null;
        this._ruleEngine = null;
        this._serviceNowClient = null;
        this._transformService = null;
    }

    // ================== INFRASTRUCTURE ==================

    get queryService() {
        if (!this._queryService) {
            const db = getMongoDb();
            this._queryService = new IncidentQueryService(db, {
                systemMappings: db.collection(mongoConfig.collections.systemMappings),
                incidentRules: db.collection(mongoConfig.collections.incidentRules),
                assignmentGroups: db.collection(mongoConfig.collections.assignmentGroups),
                incidentLogs: db.collection(mongoConfig.collections.incidentLogs)
            });
        }
        return this._queryService;
    }

    get ruleEngine() {
        if (!this._ruleEngine) {
            this._ruleEngine = new IncidentRuleEngine();
        }
        return this._ruleEngine;
    }

    get serviceNowClient() {
        if (!this._serviceNowClient) {
            this._serviceNowClient = new ServiceNowClient();
        }
        return this._serviceNowClient;
    }

    get transformService() {
        if (!this._transformService) {
            this._transformService = new IncidentTransformService();
        }
        return this._transformService;
    }

    // ================== INCIDENT CREATION ==================

    /**
     * Main orchestration: match alert → system mapping → rules → build incident → send to ServiceNow.
     * Stacks global rules first (low priority), then specific rules (high priority).
     * Logs the result to MongoDB incident_logs collection.
     * @param {Object} alertData - Alert fields: application, message, node_name, object_name, time_created
     * @returns {Object} { incidentData, serviceNowResult, appliedRules[], matchedApplications[] }
     * @throws {Error} If no system mapping found for the application
     */
    // Create an incident from alert data (main orchestration method)
    async createIncidentFromAlert(alertData) {
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

            // 3. Find matching rules and stack them
            const allMatches = this.ruleEngine.findAllMatches(alertData, rules);

            // Stack overrides: Global (Low Specificity) -> Specific (High Specificity)
            // findAllMatches returns Highest -> Lowest, so we reverse it to apply Lowest first
            const matchingRules = allMatches.reverse().map(m => m.rule);

            let finalOverrides = {};
            matchingRules.forEach(rule => {
                finalOverrides = {
                    ...finalOverrides,
                    ...rule.incident_overrides
                };
            });

            if (matchingRules.length > 0) {
                console.log(`🎯 Matched ${matchingRules.length} rules. Applying stack:`,
                    matchingRules.map(r => r.rule_name).join(' -> '));
            } else {
                console.log('ℹ️  No specific rule matched, using base system mapping');
            }

            // 4. Build incident data
            const incidentData = this.transformService.buildIncidentData(
                systemMapping,
                finalOverrides,
                alertData
            );

            console.log('📝 Built incident data:', JSON.stringify(incidentData, null, 2));

            // 5. Send to ServiceNow
            const result = await this.serviceNowClient.createIncident(incidentData);

            // Determine the "winner" rule for logging/response (the last one applied)
            const matchedRule = matchingRules.length > 0 ? matchingRules[matchingRules.length - 1] : null;

            // 6. Log the incident (Async - do not await)
            this.queryService.logIncident({
                application,
                alert_source: alertData,
                incident_payload: incidentData,
                servicenow_result: result,
                process_info: {
                    mapping_used: systemMapping._id,
                    mapping_name: systemMapping.service_offering, // or another identifier
                    applied_rules: matchingRules.map(r => r.rule_name),
                    rule_stack_snapshot: matchingRules.map(r => ({ name: r.rule_name, id: r._id, overrides: r.incident_overrides }))
                }
            }).catch(err => console.error('Failed to log incident:', err));

            return {
                incidentData,  // Include the built incident data in response
                serviceNowResult: result,
                mapping_used: systemMapping._id,
                rule_used: matchedRule?._id || null,
                rule_name: matchingRules.length > 0 ? matchingRules.map(r => r.rule_name).join(' + ') : 'Base Mapping',
                applied_rules: matchingRules.map(r => r.rule_name),
                matched_applications: systemMapping.grafana_names
            };

        } catch (error) {
            console.error('❌ Error creating incident from alert:', error);
            throw error;
        }
    }

    // ================== SYSTEM MAPPINGS (Grafana app → ServiceNow config) ==================

    /** @returns {Array} All system mappings from MongoDB */
    async getSystemMappings() {
        return this.queryService.findAllMappings();
    }

    /**
     * Find system mapping matching a Grafana application name (via pattern matching).
     * @param {string} grafanaName - Grafana application name to match
     * @returns {Object|null} Matching system mapping or null
     */
    async getMappingByApplication(grafanaName) {
        return this.queryService.findMappingByApplication(grafanaName, this.ruleEngine);
    }

    /**
     * Create a new system mapping. Validates patterns and checks for duplicates.
     * @param {Object} mappingData - { grafana_names, assignment_group, u_network, service_offering, ... }
     * @returns {Object} Created mapping with _id
     * @throws {Error} On duplicate patterns or invalid data
     */
    async createSystemMapping(mappingData) {
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

    /**
     * Update an existing system mapping by ID. Re-validates patterns.
     * @param {string} id - MongoDB ObjectId of the mapping
     * @param {Object} mappingData - Updated mapping fields
     * @returns {Object|null} Updated mapping or null if not found
     */
    async updateSystemMapping(id, mappingData) {
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

    /**
     * Delete a system mapping. Checks for dependent incident rules first.
     * @param {string} id - MongoDB ObjectId of the mapping
     * @returns {Object} { deletedCount }
     * @throws {Error} If mapping has dependent rules
     */
    async deleteSystemMapping(id) {
        try {
            const result = await this.queryService.deleteMapping(id);
            console.log(`✅ Deleted system mapping: ${id}`);
            return result;
        } catch (error) {
            console.error('❌ Error deleting system mapping:', error);
            throw error;
        }
    }

    // ================== INCIDENT RULES (override ServiceNow fields based on alert conditions) ==================

    /**
     * Get all incident rules, optionally filtered by Grafana application name.
     * @param {string|null} grafanaName - Optional application filter
     * @returns {Array} Matching rules sorted by priority
     */
    async getIncidentRules(grafanaName = null) {
        return this.queryService.findAllRules(grafanaName, this.ruleEngine);
    }

    /**
     * Create a new incident rule. Validates regex patterns and links to system mapping.
     * @param {Object} ruleData - { rule_name, system_mapping_id, conditions[], incident_overrides, ... }
     * @returns {Object} Created rule with _id
     * @throws {Error} On invalid regex patterns or missing system mapping
     */
    async createIncidentRule(ruleData) {
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

    /**
     * Update an existing incident rule by ID.
     * @param {string} id - MongoDB ObjectId of the rule
     * @param {Object} ruleData - Updated rule fields
     * @returns {Object|null} Updated rule or null if not found
     */
    async updateIncidentRule(id, ruleData) {
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

    /** Delete an incident rule by ID. @returns {{ deletedCount: number }} */
    async deleteIncidentRule(id) {
        try {
            const result = await this.queryService.deleteRule(id);
            console.log(`✅ Deleted incident rule: ${id}`);
            return result;
        } catch (error) {
            console.error('❌ Error deleting incident rule:', error);
            throw error;
        }
    }

    /** Toggle an incident rule enabled/disabled. @returns {Object|null} Updated rule */
    async toggleIncidentRule(id, enabled) {
        try {
            const result = await this.queryService.toggleRule(id, enabled);
            console.log(`✅ Toggled incident rule ${id}: ${enabled ? 'enabled' : 'disabled'}`);
            return result;
        } catch (error) {
            console.error('❌ Error toggling incident rule:', error);
            throw error;
        }
    }

    // ================== ASSIGNMENT GROUPS (cached from ServiceNow) ==================

    /** Get locally-cached assignment groups. @returns {Array} Assignment group objects */
    async getAssignmentGroups() {
        return this.queryService.getAssignmentGroups();
    }

    /** Fetch fresh assignment groups from ServiceNow and save to MongoDB. @returns {Array} */
    async syncAssignmentGroups() {
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

    // ================== SERVICENOW ALERT SHORTCUTS ==================

    /**
     * Create a simplified ServiceNow alert (lighter than a full incident).
     * Finds the system mapping for the application to get service_offering,
     * and sends only the fields ServiceNow needs for an alert record.
     * @param {Object} alertData - Must include: application, message. Optional: user, prevented, incident_sys_id
     * @returns {Object} { alertPayload, serviceNowResult, mapping_used }
     */
    async createServiceNowAlert(alertData) {
        try {
            const { application, message, user, prevented, incident_sys_id } = alertData;
            if (!application) throw new Error('Alert must have an application field');

            // Find system mapping to get service_offering
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

            // Build lean alert payload — only what ServiceNow needs
            const alertPayload = {
                short_description: message,
                service_offering: systemMapping.service_offering,
                u_prevented_incident: Boolean(prevented),
            };

            // Optional fields — only include if they have a value
            if (user) {
                alertPayload.caller_id = user;
            }

            if (prevented && incident_sys_id) {
                alertPayload.parent_incident = incident_sys_id;
            }

            console.log('📤 Alert payload:', JSON.stringify(alertPayload, null, 2));

            const serviceNowResult = await this.serviceNowClient.createIncident(alertPayload);

            return {
                alertPayload,
                serviceNowResult,
                mapping_used: systemMapping._id
            };
        } catch (error) {
            console.error('❌ Error creating ServiceNow alert:', error);
            throw error;
        }
    }

    /**
     * Create a full incident + optionally a linked ServiceNow alert in one call.
     * The alert is automatically marked as "prevented" and linked to the incident.
     * @param {Object} alertData - Alert fields for incident creation
     * @param {boolean} [createAlert=true] - Whether to also create a ServiceNow alert
     * @param {boolean} [linkToIncident=true] - Whether to link the alert to the created incident
     * @returns {Object} { incident, alert } or just incident result if createAlert is false
     */
    async createIncidentWithAlert(alertData, createAlert = true, linkToIncident = true) {
        try {
            // First create the incident
            const incidentResult = await this.createIncidentFromAlert(alertData);

            // If createAlert is false, just return incident result
            if (!createAlert) {
                return incidentResult;
            }

            // Create a linked ServiceNow alert — marked as prevented since incident was created
            const alertResult = await this.createServiceNowAlert({
                ...alertData,
                prevented: true,
                incident_sys_id: linkToIncident ? incidentResult.serviceNowResult?.sys_id : undefined
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

    /**
     * Dry-run: simulate what would happen if an alert triggered incident creation.
     * Shows matched mapping, applied rules (stacked by priority), and generated incident data.
     * @param {Object} alertData - Same shape as createIncidentFromAlert input
     * @returns {Object} { system_mapping, applied_rules[], generated_incident, hierarchy_explanation }
     */
    async simulateIncidentCreation(alertData) {
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

            // 3. Find all matches and stack them
            const allMatches = this.ruleEngine.findAllMatches(alertData, rules);

            // Stack: Global (Low) -> Specific (High)
            const matchingRules = allMatches.reverse().map(m => m.rule);

            let finalOverrides = {};
            matchingRules.forEach(rule => {
                finalOverrides = {
                    ...finalOverrides,
                    ...rule.incident_overrides
                };
            });

            // 4. Build incident data (preview)
            let incidentData = null;
            if (systemMapping) {
                incidentData = this.transformService.buildIncidentData(
                    systemMapping,
                    finalOverrides,
                    alertData
                );
            }

            return {
                system_mapping: systemMapping || null,
                applied_rules: matchingRules.map(r => ({
                    rule_name: r.rule_name,
                    incident_overrides: r.incident_overrides,
                    is_global: r.is_global
                })),
                total_rules_checked: rules.length,
                generated_incident: incidentData,
                hierarchy_explanation: [
                    "1. Specific Rules (Applied Last / High Priority)",
                    "2. Global Rules (Applied First / Low Priority)",
                    "3. Base System Mapping (Defaults)"
                ]
            };
        } catch (error) {
            console.error('❌ Error simulating incident:', error);
            throw error;
        }
    }

    // ================== HISTORY / LOGS ==================

    /**
     * Get paginated incident creation history from MongoDB logs.
     * @param {number} limit - Page size
     * @param {number} skip - Offset
     * @param {string} search - Optional search term
     * @returns {Object} { logs, total }
     */
    async getIncidentHistory(limit, skip, search) {
        return this.queryService.getIncidentLogs(limit, skip, { search });
    }

}
module.exports = IncidentService;
