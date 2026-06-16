// services/incident/IncidentService.js
// Orchestrates incident/alert creation against ServiceNow:
// mapping lookup → rule evaluation → payload build (per incident settings)
// → ServiceNow API call.
const { ServiceNowClient } = require('./ServiceNowClient');
const { MappingNotFoundError, ValidationError, ServiceNowError } = require('../../utils/errors');
const { logger } = require('../../utils/logger');
const helpers = require('./incidentHelpers');

const log = logger.tagged('incident');

class IncidentService {
    constructor(mappingService, ruleService, settingsService) {
        this.mappingService = mappingService;
        this.ruleService = ruleService;
        this.settingsService = settingsService;
        this._serviceNowClient = null;
    }

    get serviceNowClient() {
        if (!this._serviceNowClient) {
            this._serviceNowClient = new ServiceNowClient();
        }
        return this._serviceNowClient;
    }

    // ================== SHARED EVALUATION PIPELINE ==================

    /**
     * Resolve everything needed to build an incident for an alert:
     * the system mapping, the matching enabled rules (ordered by
     * specificity), and their merged overrides (least → most specific,
     * so the most specific rule wins each field).
     */
    async _evaluateAlert(alertData, { requireMapping = true } = {}) {
        const { application } = alertData;
        if (!application) throw new ValidationError('Alert must have an application field');

        // Mapping lookup and rule fetch are independent — run them concurrently.
        const [systemMapping, allRules] = await Promise.all([
            this.mappingService.getMappingByApplication(application),
            this.ruleService.getIncidentRules(application)
        ]);
        if (!systemMapping && requireMapping) {
            throw new MappingNotFoundError(`No system mapping found for application: ${application}`);
        }

        const enabledRules = allRules.filter(r => r.enabled !== false);

        // findAllMatches returns matches sorted by specificity (highest first).
        const rankedMatches = helpers.findAllMatches(alertData, enabledRules);
        // Apply overrides from least → most specific so the winner overwrites last.
        const rulesToApply = [...rankedMatches].reverse().map(m => m.rule);

        const mergedOverrides = {};
        rulesToApply.forEach(rule => Object.assign(mergedOverrides, rule.incident_overrides));

        return { systemMapping, enabledRules, rankedMatches, rulesToApply, mergedOverrides };
    }

    // ================== INCIDENT CREATION ==================

    async createIncidentFromAlert(alertData) {
        const [{ systemMapping, rulesToApply, mergedOverrides }, settings] = await Promise.all([
            this._evaluateAlert(alertData),
            this.settingsService.getSettings()
        ]);

        const incidentData = helpers.buildIncidentData(systemMapping, mergedOverrides, alertData, settings);
        const result = await this.serviceNowClient.createIncident(incidentData);

        // ServiceNow failures come back as { success:false } (the client never
        // throws). Surface them so callers don't get a 200 "created" for a
        // ticket that was never created.
        if (result.success === false) {
            throw new ServiceNowError(
                result.error || result.message || 'ServiceNow incident creation failed',
                result.status
            );
        }

        log.info('Incident created', {
            application: alertData.application,
            incident_number: result?.incident_number,
            success: true,
            rules: rulesToApply.map(r => r.rule_name)
        });

        const winningRule = rulesToApply.length > 0 ? rulesToApply[rulesToApply.length - 1] : null;
        return {
            incidentData,
            serviceNowResult: result,
            mapping_used: systemMapping._id,
            rule_used: winningRule?._id || null,
            rule_name: rulesToApply.length > 0 ? rulesToApply.map(r => r.rule_name).join(' + ') : 'Base Mapping',
            applied_rules: rulesToApply.map(r => r.rule_name),
            matched_applications: systemMapping.grafana_names
        };
    }

    // ================== SERVICENOW REFERENCE DATA ==================

    async getAssignmentGroups() {
        return this.serviceNowClient.fetchAssignmentGroups();
    }

    async getNetworks() {
        return this.serviceNowClient.fetchNetworks();
    }

    async getServiceOfferings(network = null) {
        return this.serviceNowClient.fetchServiceOfferings(network);
    }

    async getBusinessServices(network = null) {
        return this.serviceNowClient.fetchBusinessServices(network);
    }

    /**
     * Business-Service → Service-Offering pairs sourced from cmdb_ci_rel.
     * Drives the mapping form's offering→business-service auto-fill.
     */
    async getServiceRelationships(network = null) {
        return this.serviceNowClient.fetchServiceRelationships(network);
    }

    /** Network the mapping form should preselect (analyst can override). */
    getDefaultNetwork() {
        return process.env.SN_DEFAULT_NETWORK || '';
    }

    /** Fields ServiceNow makes mandatory once a Service Offering is selected. */
    async getOfferingMandatoryFields(offeringSysId) {
        return this.serviceNowClient.fetchOfferingMandatoryFields(offeringSysId);
    }

    // ================== TIUD ALERT CREATION ==================

    /**
     * Create a TIUD alert record (u_tiud_atraot table) in ServiceNow.
     * Unlike incidents, the payload is fixed-shape and built from the
     * mapping plus caller-provided fields.
     */
    async createServiceNowAlert(alertData) {
        const {
            application,
            message,
            node_name,
            user,
            prevented,
            how_solved,
            incident_number,  // legacy: link by incident number
            incident_sys_id   // preferred: link by sys_id
        } = alertData;

        if (!application) throw new ValidationError('Alert must have an application field');

        const systemMapping = await this.mappingService.getMappingByApplication(application);
        if (!systemMapping) {
            throw new MappingNotFoundError(`No system mapping found for application: ${application}`);
        }

        const userSysId = await this.serviceNowClient.getSysIdByUser(user);

        const alertPayload = {
            u_jump_comm: message,
            u_cluster: node_name,
            assignment_group: systemMapping.assignment_group,
            u_network: systemMapping.u_network,
            u_service_offering: systemMapping.service_offering,
            u_opened: userSysId,
            u_what_we_did: how_solved,
            u_prevent: prevented,
            // Link to an existing incident: sys_id (when prevented) wins over legacy number
            ...(incident_number && { parent_incident: incident_number }),
            ...(prevented && incident_sys_id && { parent_incident: incident_sys_id })
        };

        const serviceNowResult = await this.serviceNowClient.createTiudAlert(alertPayload);

        if (serviceNowResult.success === false) {
            throw new ServiceNowError(
                serviceNowResult.error || serviceNowResult.message || 'ServiceNow alert creation failed',
                serviceNowResult.status
            );
        }

        return {
            alertPayload,
            serviceNowResult,
            matched_applications: systemMapping.grafana_names,
            mapping_used: systemMapping._id
        };
    }

    /** Create an incident and (optionally) a linked TIUD alert in one call. */
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

    // ================== SIMULATION ==================

    /** Dry-run: evaluate mapping + rules and build the payload without calling ServiceNow. */
    async simulateIncidentCreation(alertData) {
        const [{ systemMapping, enabledRules, rankedMatches, rulesToApply, mergedOverrides }, settings] = await Promise.all([
            this._evaluateAlert(alertData, { requireMapping: false }),
            this.settingsService.getSettings()
        ]);

        const incidentData = systemMapping
            ? helpers.buildIncidentData(systemMapping, mergedOverrides, alertData, settings)
            : null;

        const matchObjects = rankedMatches.map(m => ({ rule: m.rule, score: m.score, is_global: !!m.rule.is_global }));
        return {
            system_mapping: systemMapping || null,
            winner: matchObjects[0] || null,
            shadowed_rules: matchObjects.slice(1),
            applied_rules: rulesToApply.map(r => ({ rule_name: r.rule_name, incident_overrides: r.incident_overrides, is_global: r.is_global })),
            total_rules_checked: enabledRules.length,
            generated_incident: incidentData,
            hierarchy_explanation: ["1. Specific Rules (Applied Last / High Priority)", "2. Global Rules (Applied First / Low Priority)", "3. Base System Mapping (Defaults)"]
        };
    }
}

module.exports = IncidentService;
