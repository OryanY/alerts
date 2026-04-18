// services/incident/IncidentService.js
const { getMongoDb } = require('../../database/connection');
const { mongoConfig } = require('../../config');
const { ServiceNowClient } = require('./ServiceNowClient');
const helpers = require('./incidentHelpers');

class IncidentService {
    constructor(mappingService, ruleService) {
        this.mappingService = mappingService;
        this.ruleService = ruleService;
        this._collections = null;
        this._serviceNowClient = null;
    }

    get db() {
        if (!this._collections) {
            const mdb = getMongoDb();
            this._collections = {
                assignmentGroups: mdb.collection(mongoConfig.collections.assignmentGroups),
                incidentLogs: mdb.collection(mongoConfig.collections.incidentLogs)
            };
            this._collections.incidentLogs.createIndex({ created_at: 1 }, { expireAfterSeconds: 7776000, background: true }).catch(() => { });
        }
        return this._collections;
    }

    get serviceNowClient() {
        if (!this._serviceNowClient) {
            this._serviceNowClient = new ServiceNowClient();
        }
        return this._serviceNowClient;
    }

    // ================== PRIVATE HELPERS ==================

    async _resolveIncidentContext(alertData) {
        const { application } = alertData;
        if (!application) throw new Error('Alert must have an application field');

        const systemMapping = await this.mappingService.getMappingByApplication(application);
        if (!systemMapping) throw new Error(`No system mapping found for application: ${application}`);

        const allRules    = await this.ruleService.getIncidentRules(application);
        const enabledRules = allRules.filter(r => r.enabled !== false);

        const allMatches     = helpers.findAllMatches(alertData, enabledRules);
        const matchingRules  = [...allMatches].reverse().map(m => m.rule);

        // Merge all matching rule overrides (specific rules win — they are last)
        const finalOverrides = matchingRules.reduce(
            (acc, rule) => ({ ...acc, ...rule.incident_overrides }),
            {}
        );

        return { systemMapping, matchingRules, finalOverrides, enabledRules };
    }

    // ================== INCIDENT CREATION ==================

    async createIncidentFromAlert(alertData) {
        const { systemMapping, matchingRules, finalOverrides } = await this._resolveIncidentContext(alertData);

        const incidentData = helpers.buildIncidentData(systemMapping, finalOverrides, alertData);
        const result       = await this.serviceNowClient.createIncident(incidentData);

        const matchedRule = matchingRules.at(-1) ?? null;

        this.db.incidentLogs.insertOne({
            application: alertData.application,
            alert_source: alertData,
            incident_payload: incidentData,
            servicenow_result: result,
            process_info: {
                mapping_used: systemMapping._id,
                mapping_name: systemMapping.service_offering,
                applied_rules: matchingRules.map(r => r.rule_name),
                rule_stack_snapshot: matchingRules.map(r => ({ name: r.rule_name, id: r._id, overrides: r.incident_overrides }))
            },
            created_at: new Date()
        }).catch(err => console.error('Failed to log incident:', err));

        return {
            incidentData,
            serviceNowResult: result,
            mapping_used: systemMapping._id,
            rule_used: matchedRule?._id ?? null,
            rule_name: matchingRules.length > 0 ? matchingRules.map(r => r.rule_name).join(' + ') : 'Base Mapping',
            applied_rules: matchingRules.map(r => r.rule_name),
            matched_applications: systemMapping.grafana_names
        };
    }

    // ================== SIMULATION & DEBUGGING ==================

    async simulateIncidentCreation(alertData) {
        const { systemMapping, matchingRules, finalOverrides, enabledRules } = await this._resolveIncidentContext(alertData);

        return {
            system_mapping: systemMapping,
            applied_rules: matchingRules.map(r => ({ rule_name: r.rule_name, incident_overrides: r.incident_overrides, is_global: r.is_global })),
            total_rules_checked: enabledRules.length,
            generated_incident: helpers.buildIncidentData(systemMapping, finalOverrides, alertData),
            hierarchy_explanation: [
                "1. Specific Rules (Applied Last / High Priority)",
                "2. Global Rules (Applied First / Low Priority)",
                "3. Base System Mapping (Defaults)"
            ]
        };
    }

    // ================== ASSIGNMENT GROUPS ==================

    async getAssignmentGroups() {
        const REFRESH_THRESHOLD = 7 * 24 * 60 * 60 * 1000; // 7 days
        const doc = await this.db.assignmentGroups.findOne({ _id: 'assignment_groups_store' });

        const isStale = !doc || !doc.lastSynced || (Date.now() - new Date(doc.lastSynced).getTime() > REFRESH_THRESHOLD);

        if (isStale) {
            console.log('🔄 Assignment groups are stale or missing, triggering auto-sync...');
            if (!doc) {
                // If no data exists at all, wait for the first sync
                return await this.syncAssignmentGroups();
            } else {
                // If data exists but is stale, sync in background to avoid blocking the user
                this.syncAssignmentGroups().catch(err => 
                    console.error('❌ Background auto-sync of assignment groups failed:', err.message)
                );
            }
        }

        return doc ? doc.groups : [];
    }

    async syncAssignmentGroups() {
        const groups = await this.serviceNowClient.fetchAssignmentGroups();
        await this.db.assignmentGroups.updateOne(
            { _id: 'assignment_groups_store' },
            { $set: { groups, lastSynced: new Date(), count: groups.length } },
            { upsert: true }
        );
        return groups;
    }

    // ================== SERVICENOW ALERT SHORTCUTS ==================

    async createServiceNowAlert(alertData) {
        const {
            application,
            message,
            node_name,
            user,
            prevented,
            incident_number,    // legacy field, optional
            incident_sys_id     // newer field, optional
        } = alertData;

        if (!application) throw new Error('Alert must have an application field');

        const systemMapping = await this.mappingService.getMappingByApplication(application);
        if (!systemMapping) {
            const allMappings = await this.mappingService.getSystemMappings();
            throw new Error(
                `No system mapping found for application: ${application}. ` +
                `Available: ${allMappings.map(m => m.grafana_names.map(p => p.value).join(', ')).join(' | ')}`
            );
        }

        const userSysId = await this.serviceNowClient.getSysIdByUser(user);

        const alertPayload = {
            u_jump_comm:        message,
            u_cluster:          node_name,
            assignment_group:   systemMapping.assignment_group,
            u_network:          systemMapping.u_network,
            u_service_offering: systemMapping.service_offering,
            u_opened:           userSysId,
            caller_id:          userSysId,
            ...(incident_number && { parent_incident: incident_number })
        };

        // sys_id overrides legacy incident_number when prevented
        if (prevented && incident_sys_id) {
            alertPayload.parent_incident = incident_sys_id;
        }

        const serviceNowResult = await this.serviceNowClient.createTiudAlert(alertPayload);
        return { alertPayload, serviceNowResult, matched_applications: systemMapping.grafana_names, mapping_used: systemMapping._id };
    }

    async createIncidentWithAlert(alertData, createAlert = true, linkToIncident = true) {
        const incidentResult = await this.createIncidentFromAlert(alertData);
        if (!createAlert) return incidentResult;

        const alertResult = await this.createServiceNowAlert({
            ...alertData,
            prevented: true,
            incident_sys_id: linkToIncident ? incidentResult.serviceNowResult?.sys_id : undefined
        });
        return { incident: incidentResult, alert: alertResult };
    }

    // ================== HISTORY / LOGS ==================

    async getIncidentHistory(limit = 50, skip = 0, search = null) {
        const query = {};
        if (search) {
            query.$or = [
                { 'application': { $regex: search, $options: 'i' } },
                { 'servicenow_result.incident_number': { $regex: search, $options: 'i' } }
            ];
        }
        const total = await this.db.incidentLogs.countDocuments(query);
        const logs  = await this.db.incidentLogs.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).toArray();
        return { logs, total };
    }
}

module.exports = IncidentService;
