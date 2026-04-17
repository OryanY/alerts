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
            this._collections.incidentLogs.createIndex({ created_at: 1 }, { expireAfterSeconds: 7776000, background: true }).catch(() => {});
        }
        return this._collections;
    }

    get serviceNowClient() {
        if (!this._serviceNowClient) {
            this._serviceNowClient = new ServiceNowClient();
        }
        return this._serviceNowClient;
    }

    // ================== INCIDENT CREATION ==================

    
    async createIncidentFromAlert(alertData) {
        const { application } = alertData;
        if (!application) throw new Error('Alert must have an application field');

        const systemMapping = await this.mappingService.getMappingByApplication(application);
        if (!systemMapping) throw new Error(`No system mapping found for application: ${application}`);

        const allRules = await this.ruleService.getIncidentRules(application);
        const enabledRules = allRules.filter(r => r.enabled !== false);

        const allMatches = helpers.findAllMatches(alertData, enabledRules);
        const matchingRules = allMatches.reverse().map(m => m.rule);

        let finalOverrides = {};
        matchingRules.forEach(rule => {
            finalOverrides = { ...finalOverrides, ...rule.incident_overrides };
        });

        const incidentData = helpers.buildIncidentData(systemMapping, finalOverrides, alertData);
        const result = await this.serviceNowClient.createIncident(incidentData);

        const matchedRule = matchingRules.length > 0 ? matchingRules[matchingRules.length - 1] : null;

        this.db.incidentLogs.insertOne({
            application,
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
            rule_used: matchedRule?._id || null,
            rule_name: matchingRules.length > 0 ? matchingRules.map(r => r.rule_name).join(' + ') : 'Base Mapping',
            applied_rules: matchingRules.map(r => r.rule_name),
            matched_applications: systemMapping.grafana_names
        };
    }

    // ================== ASSIGNMENT GROUPS ==================

    async getAssignmentGroups() {
        const doc = await this.db.assignmentGroups.findOne({ _id: 'assignment_groups_store' });
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
        try {
        // ---------- 1️⃣  Basic validation & destructuring ----------
        const {
            application,
            message,
            node_name,
            user,
            prevented,
            incident_number,   // legacy field, optional
            incident_sys_id    // newer field, optional
        } = alertData;

        if (!application) {
            throw new Error('Alert must have an application field');
        }

        // ---------- 2️⃣  Mapping lookup ----------
        const systemMapping = await this.mappingService.getMappingByApplication(application);
        if (!systemMapping) {
            const allMappings = await this.mappingService.getSystemMappings();
            throw new Error(
            `No system mapping found for application: ${application}. ` +
            `Available: ${allMappings
                .map(m => m.grafana_names.map(p => p.value).join(', '))
                .join(' | ')}`
            );
        }

        // ---------- 3️⃣  Resolve caller → ServiceNow sys_id ----------
        
        const userSysId = await this.serviceNowClient.getSysIdByUser(user);
        // ---------- 4️⃣  Build the TIUD‑specific payload ----------
        const alertPayload = {
            // Core custom fields (match the log you posted)
            u_jump_comm:      message,
            u_cluster:        node_name,
            assignment_group: systemMapping.assignment_group,
            u_network:        systemMapping.u_network,
            u_service_offering: systemMapping.service_offering,
            u_opened:         userSysId,
            caller_id: userSysId,
            // Optional linking to an existing incident (legacy)
            ...(incident_number && { parent_incident: incident_number })
        };

        // ---------- 5️⃣  Back‑compatibility helpers ----------
        if (prevented && incident_sys_id) {
            alertPayload.parent_incident = incident_sys_id;                     // overrides legacy number
        }

        // ---------- 6️⃣  Send to ServiceNow ----------
        const serviceNowResult = await this.serviceNowClient.createTiudAlert(alertPayload);

        // ---------- 7️⃣  Return useful info ----------
        return {
            alertPayload,
            serviceNowResult,
            matched_applications: systemMapping.grafana_names,
            mapping_used: systemMapping._id
        };
        } catch (error) {
        console.error('❌ Error creating ServiceNow alert:', error);
        throw error;               // let the controller turn it into HTML/JSON
        }
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

    // ================== SIMULATION & DEBUGGING ==================

    async simulateIncidentCreation(alertData) {
        const { application } = alertData;
        if (!application) throw new Error('Alert must have an application field');

        const systemMapping = await this.mappingService.getMappingByApplication(application);
        const allRules = await this.ruleService.getIncidentRules(application);
        const enabledRules = allRules.filter(r => r.enabled !== false);

        const allMatches = helpers.findAllMatches(alertData, enabledRules);
        const matchingRules = allMatches.reverse().map(m => m.rule);

        let finalOverrides = {};
        matchingRules.forEach(rule => {
            finalOverrides = { ...finalOverrides, ...rule.incident_overrides };
        });

        let incidentData = null;
        if (systemMapping) {
            incidentData = helpers.buildIncidentData(systemMapping, finalOverrides, alertData);
        }

        return {
            system_mapping: systemMapping || null,
            applied_rules: matchingRules.map(r => ({ rule_name: r.rule_name, incident_overrides: r.incident_overrides, is_global: r.is_global })),
            total_rules_checked: enabledRules.length,
            generated_incident: incidentData,
            hierarchy_explanation: ["1. Specific Rules (Applied Last / High Priority)", "2. Global Rules (Applied First / Low Priority)", "3. Base System Mapping (Defaults)"]
        };
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
        const logs = await this.db.incidentLogs.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).toArray();
        return { logs, total };
    }
}

module.exports = IncidentService;
