// controllers/IncidentController.js
// ---------------------------------------------------------------
// HTTP layer only — all business logic lives in the injected services.
//
// Two response styles, by caller type:
//  - Webhook/browser flows (Grafana links): redirect to ServiceNow on
//    success, styled HTML page on error (with a "create mapping" action
//    when the application has no mapping).
//  - Programmatic flows (the React app): JSON, with status taken from
//    typed errors (utils/errors.js).
// ---------------------------------------------------------------
const { getErrorHtml } = require('./htmlTemplates');
const { AppError, MappingNotFoundError } = require('../utils/errors');
const { logger } = require('../utils/logger');
const helpers = require('../services/incident/incidentHelpers');

const log = logger.tagged('incident');

// Hebrew user-facing messages for the HTML (webhook) error pages
const HTML_MESSAGES = {
    mappingMissing: 'לא נמצא מיפוי מערכת עבור האפליקציה',
    incidentFailed: 'אירעה שגיאה פנימית במערכת',
    alertFailed: 'אירעה שגיאה ביצירת ההתראה',
    combinedFailed: 'אירעה שגיאה ביצירת התקלה וההתראה',
    grafanaFailed: 'אירעה שגיאה ביצירת התקלה'
};

// Friendly `error` category derived from the typed error itself, so a 400
// validation error is never mislabeled "System mapping not found".
const ERROR_CATEGORY_BY_CODE = {
    NOT_FOUND: 'Resource not found',
    NO_SYSTEM_MAPPING: 'No system mapping found',
    CONFLICT: 'Conflict',
    VALIDATION_ERROR: 'Validation failed',
    SERVICENOW_ERROR: 'ServiceNow request failed'
};

class IncidentController {
    constructor(incidentService, mappingService, ruleService, settingsService) {
        this.incidentService = incidentService;
        this.mappingService = mappingService;
        this.ruleService = ruleService;
        this.settingsService = settingsService;
    }

    // ================== ERROR RESPONDERS ==================

    _isMappingError(err) {
        return err instanceof MappingNotFoundError || err.message.includes('No system mapping');
    }

    /** Styled HTML error page for webhook/browser flows. */
    _respondHtmlError(res, err, failureMessage) {
        const isMapping = this._isMappingError(err);
        const status = isMapping ? 404 : (err.status || 500);
        const userMsg = isMapping ? HTML_MESSAGES.mappingMissing : failureMessage;
        const action = isMapping
            ? { label: '➕ יצירת מיפוי חדש', url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/incident` }
            : null;
        res.status(status).send(getErrorHtml(userMsg, err.message, action));
    }

    /** JSON error for programmatic flows; unknown errors go to the global handler. */
    _respondJsonError(res, next, err, label = null) {
        if (err instanceof AppError) {
            return res.status(err.status).json({
                success: false,
                // Category from the actual error type; `label` is only a fallback.
                error: ERROR_CATEGORY_BY_CODE[err.code] || label || err.message,
                details: err.message
            });
        }
        next(err);
    }

    /** Redirect to the ServiceNow record if a link came back, else JSON. */
    _redirectOrJson(res, result, message, link) {
        if (link) return res.redirect(link);
        return res.json({ success: true, message, data: result });
    }

    // ================== SERVICENOW REFERENCE DATA ==================

    getAssignmentGroups = async (req, res, next) => {
        try {
            const groups = await this.incidentService.getAssignmentGroups();
            res.json({ success: true, data: groups, count: groups.length });
        } catch (err) { next(err); }
    };

    getNetworks = async (req, res, next) => {
        try {
            const networks = await this.incidentService.getNetworks();
            res.json({ success: true, data: networks, count: networks.length });
        } catch (err) { next(err); }
    };

    getServiceOfferings = async (req, res, next) => {
        try {
            const offerings = await this.incidentService.getServiceOfferings(req.query.network || null);
            res.json({ success: true, data: offerings, count: offerings.length });
        } catch (err) { next(err); }
    };

    getBusinessServices = async (req, res, next) => {
        try {
            const services = await this.incidentService.getBusinessServices(req.query.network);
            res.json({ success: true, data: services, count: services.length });
        } catch (err) { next(err); }
    };

    // ================== INCIDENT CREATION ==================

    /** GET /incident — Grafana click-through: redirect to the created ticket. */
    createIncidentFromAlertGET = async (req, res) => {
        try {
            const result = await this.incidentService.createIncidentFromAlert(req.validatedQuery);
            this._redirectOrJson(res, result, 'Incident created successfully', result?.serviceNowResult?.link);
        } catch (err) {
            log.error('GET /incident failed', err.message);
            this._respondHtmlError(res, err, HTML_MESSAGES.incidentFailed);
        }
    };

    /** POST /incident — programmatic creation, JSON in/out. */
    createIncidentFromAlertPOST = async (req, res, next) => {
        try {
            const result = await this.incidentService.createIncidentFromAlert(req.validatedBody);
            res.json({ success: true, message: 'Incident created successfully', data: result });
        } catch (err) {
            this._respondJsonError(res, next, err, 'No system mapping or rules found');
        }
    };

    /** GET /from-grafana — legacy webhook route with alert normalization. */
    createIncidentFromGrafana = async (req, res) => {
        try {
            const { object_name, application, node_name, message, time_created, operator } = req.query;
            if (!object_name || !application || !node_name || !message || !time_created || !operator) {
                return res.status(400).json({ success: false, error: 'Missing required parameters' });
            }

            const alertData = helpers.normalizeGrafanaAlert(
                { object_name, application, node_name, message, time_created, operator }
            );

            log.debug('received Grafana alert (legacy route)', alertData);
            const result = await this.incidentService.createIncidentFromAlert(alertData);
            this._redirectOrJson(res, result, 'Incident created successfully via Grafana Route', result?.serviceNowResult?.link);
        } catch (err) {
            log.error('/from-grafana failed', err.message);
            this._respondHtmlError(res, err, HTML_MESSAGES.grafanaFailed);
        }
    };

    // ================== TIUD ALERT ==================

    /** GET|POST /alert — create a TIUD alert record. GET = browser/webhook (HTML on error), POST = programmatic (JSON). */
    createServiceNowAlert = async (req, res, next) => {
        try {
            const alertData = req.validatedQuery || req.validatedBody;
            log.debug(`creating TIUD alert (${req.method})`, alertData);
            const result = await this.incidentService.createServiceNowAlert(alertData);
            this._redirectOrJson(res, result, 'ServiceNow alert created successfully', result?.serviceNowResult?.link);
        } catch (err) {
            log.error(`${req.method} /alert failed`, err.message);
            if (req.method === 'POST') return this._respondJsonError(res, next, err, 'ServiceNow alert creation failed');
            this._respondHtmlError(res, err, HTML_MESSAGES.alertFailed);
        }
    };

    // ================== INCIDENT + ALERT (COMBINED) ==================

    /** GET /incident-with-alert — webhook compatible. */
    createIncidentWithAlertGET = async (req, res) => {
        try {
            const params = req.validatedQuery;
            const createAlert = params.create_servicenow_alert === 'true' || params.create_servicenow_alert === '1';
            const linkToIncident = params.link_to_incident === 'true' || params.link_to_incident === '1';

            const alertData = {
                application: params.application,
                object_name: params.object_name,
                node_name: params.node_name,
                message: params.message,
                time_created: params.time_created,
                operator: params.operator,
                network: params.network,
                user: params.user
            };

            log.debug('GET /incident-with-alert', { alertData, createAlert, linkToIncident });
            const result = await this.incidentService.createIncidentWithAlert(alertData, createAlert, linkToIncident);

            const link = result.incident?.serviceNowResult?.link || result.alert?.serviceNowResult?.link;
            this._redirectOrJson(res, result, 'Incident and alert created successfully', link);
        } catch (err) {
            log.error('GET /incident-with-alert failed', err.message);
            this._respondHtmlError(res, err, HTML_MESSAGES.combinedFailed);
        }
    };

    /** POST /incident-with-alert — programmatic use (JSON in/out). */
    createIncidentWithAlertPOST = async (req, res, next) => {
        try {
            const { alert, create_servicenow_alert = true, link_to_incident = true } = req.body;
            if (!alert) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing alert data',
                    details: 'Request body must include an "alert" object'
                });
            }

            log.debug('POST /incident-with-alert', { alert, create_servicenow_alert, link_to_incident });
            const result = await this.incidentService.createIncidentWithAlert(alert, create_servicenow_alert, link_to_incident);
            res.json({ success: true, message: 'Incident and alert created successfully', data: result });
        } catch (err) {
            this._respondJsonError(res, next, err, 'Incident and alert creation failed');
        }
    };

    // ================== SIMULATION ==================

    simulateIncidentCreation = async (req, res, next) => {
        try {
            const simulationResult = await this.incidentService.simulateIncidentCreation(req.validatedBody);
            res.json({ success: true, message: 'Simulation completed', data: simulationResult });
        } catch (err) { next(err); }
    };

    // ================== INCIDENT SETTINGS (templates & defaults) ==================

    getIncidentSettings = async (req, res, next) => {
        try {
            const settings = await this.settingsService.getSettings();
            res.json({ success: true, data: settings });
        } catch (err) { next(err); }
    };

    updateIncidentSettings = async (req, res, next) => {
        try {
            const settings = await this.settingsService.updateSettings(req.validatedBody);
            res.json({ success: true, message: 'Incident settings updated successfully', data: settings });
        } catch (err) { next(err); }
    };

    resetIncidentSettings = async (req, res, next) => {
        try {
            const settings = await this.settingsService.resetSettings();
            res.json({ success: true, message: 'Incident settings reset to defaults', data: settings });
        } catch (err) { next(err); }
    };

    // ================== SYSTEM MAPPINGS ==================

    getSystemMappings = async (req, res, next) => {
        try {
            const mappings = await this.mappingService.getSystemMappings();
            res.json({ success: true, data: mappings, count: mappings.length });
        } catch (err) { next(err); }
    };

    createSystemMapping = async (req, res, next) => {
        try {
            const newMapping = await this.mappingService.createSystemMapping(req.validatedBody);
            res.status(201).json({ success: true, message: 'System mapping created successfully', data: newMapping });
        } catch (err) {
            this._respondJsonError(res, next, err, err.status === 409 ? 'Mapping already exists' : 'System mapping not found');
        }
    };

    updateSystemMapping = async (req, res, next) => {
        try {
            const updated = await this.mappingService.updateSystemMapping(req.params.id, req.validatedBody);
            res.json({ success: true, message: 'System mapping updated successfully', data: updated });
        } catch (err) {
            this._respondJsonError(res, next, err, 'System mapping not found');
        }
    };

    deleteSystemMapping = async (req, res, next) => {
        try {
            const result = await this.mappingService.deleteSystemMapping(req.params.id);
            res.json({ success: true, message: result.message, deletedCount: result.deletedCount });
        } catch (err) {
            this._respondJsonError(res, next, err, 'System mapping not found');
        }
    };

    // ================== INCIDENT RULES ==================

    getIncidentRules = async (req, res, next) => {
        try {
            const rules = await this.ruleService.getIncidentRules(req.query.application);
            res.json({ success: true, data: rules, count: rules.length });
        } catch (err) { next(err); }
    };

    createIncidentRule = async (req, res, next) => {
        try {
            const newRule = await this.ruleService.createIncidentRule(req.validatedBody);
            res.status(201).json({ success: true, message: 'Incident rule created successfully', data: newRule });
        } catch (err) {
            this._respondJsonError(res, next, err, 'System mapping not found');
        }
    };

    updateIncidentRule = async (req, res, next) => {
        try {
            const updated = await this.ruleService.updateIncidentRule(req.params.id, req.validatedBody);
            res.json({ success: true, message: 'Incident rule updated successfully', data: updated });
        } catch (err) {
            this._respondJsonError(res, next, err, 'Rule not found');
        }
    };

    deleteIncidentRule = async (req, res, next) => {
        try {
            const result = await this.ruleService.deleteIncidentRule(req.params.id);
            res.json({ success: true, message: result.message, deletedCount: result.deletedCount });
        } catch (err) {
            this._respondJsonError(res, next, err, 'Incident rule not found');
        }
    };

    toggleIncidentRule = async (req, res, next) => {
        try {
            const { enabled } = req.body;
            if (typeof enabled !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid request',
                    details: 'enabled field must be a boolean'
                });
            }
            const result = await this.ruleService.toggleIncidentRule(req.params.id, enabled);
            res.json({ success: true, message: result.message });
        } catch (err) {
            this._respondJsonError(res, next, err, 'Incident rule not found');
        }
    };

}

module.exports = { IncidentController };
