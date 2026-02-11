// controllers/IncidentController.js
// HTTP request/response handling for incident-related endpoints.
// Delegates all business logic to IncidentService.
// Used by: incidentRoutes.js
const { getErrorHtml } = require('../utils/htmlTemplates');

/**
 * IncidentController - Handles HTTP requests for incident-related endpoints
 * Single Responsibility: Request/Response handling only
 */
class IncidentController {
    constructor(incidentService) {
        this.incidentService = incidentService;

        // Bind methods to preserve 'this' context
        this.getAssignmentGroups = this.getAssignmentGroups.bind(this);
        this.syncAssignmentGroups = this.syncAssignmentGroups.bind(this);
        this.createIncidentFromAlertGET = this.createIncidentFromAlertGET.bind(this);
        this.createIncidentFromAlertPOST = this.createIncidentFromAlertPOST.bind(this);
        this.simulateIncidentCreation = this.simulateIncidentCreation.bind(this);
        this.getSystemMappings = this.getSystemMappings.bind(this);
        this.createSystemMapping = this.createSystemMapping.bind(this);
        this.updateSystemMapping = this.updateSystemMapping.bind(this);
        this.deleteSystemMapping = this.deleteSystemMapping.bind(this);
        this.getIncidentRules = this.getIncidentRules.bind(this);
        this.createIncidentRule = this.createIncidentRule.bind(this);
        this.updateIncidentRule = this.updateIncidentRule.bind(this);
        this.deleteIncidentRule = this.deleteIncidentRule.bind(this);
        this.toggleIncidentRule = this.toggleIncidentRule.bind(this);
        this.getIncidentLogs = this.getIncidentLogs.bind(this);
        this.getDistinctValues = this.getDistinctValues.bind(this);
    }

    // Helper to generate error action link
    _getErrorAction(error) {
        if (error.message.includes('No system mapping')) {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            return {
                label: '➕ יצירת מיפוי חדש',
                url: `${frontendUrl}/incident`
            };
        }
        return null;
    }

    // ================== ASSIGNMENT GROUPS ==================

    /** GET /api/incidents/assignment-groups — Returns cached ServiceNow assignment groups */
    async getAssignmentGroups(req, res, next) {
        try {
            const groups = await this.incidentService.getAssignmentGroups();

            if (!Array.isArray(groups)) {
                console.error('❌ Groups is not an array:', typeof groups);
                return res.status(500).json({
                    success: false,
                    error: 'Invalid groups data received from database'
                });
            }

            res.json({
                success: true,
                data: groups,
                count: groups.length,
            });
        } catch (error) {
            next(error);
        }
    }

    /** POST /api/incidents/assignment-groups/sync — Re-fetches groups from ServiceNow */
    async syncAssignmentGroups(req, res, next) {
        try {
            console.log('🔄 Starting assignment groups sync from ServiceNow...');
            const groups = await this.incidentService.syncAssignmentGroups();

            if (!Array.isArray(groups)) {
                console.error('❌ Sync returned invalid data:', typeof groups);
                return res.status(500).json({
                    success: false,
                    error: 'Sync failed - invalid data returned from ServiceNow'
                });
            }

            res.json({
                success: true,
                message: `Successfully synced ${groups.length} assignment groups from ServiceNow`,
                data: groups,
                count: groups.length,
                meta: {
                    syncedAt: new Date().toISOString(),
                    source: 'servicenow'
                }
            });
        } catch (error) {
            console.error('❌ Error syncing assignment groups:', error);
            next(error);
        }
    }

    // ================== INCIDENT CREATION ==================

    /** GET /api/incidents/create — Creates incident from query params (used by Grafana webhooks) */
    async createIncidentFromAlertGET(req, res, next) {
        try {
            const alertData = req.validatedQuery;
            console.log('Creating incident only (GET):', alertData);
            const result = await this.incidentService.createIncidentFromAlert(alertData);

            // Success: Redirect to ServiceNow
            if (result.serviceNowResult && result.serviceNowResult.link) {
                return res.redirect(result.serviceNowResult.link);
            }

            // Fallback if no link
            res.json({
                success: true,
                message: 'Incident created successfully',
                data: result
            });
        } catch (error) {
            console.error('❌ Error in GET /incident:', error.message);
            const isMappingError = error.message.includes('No system mapping');
            const statusCode = isMappingError ? 404 : 500;
            const userMessage = isMappingError
                ? 'לא נמצא מיפוי מערכת עבור האפליקציה'
                : 'אירעה שגיאה פנימית במערכת';

            const action = this._getErrorAction(error);
            res.status(statusCode).send(getErrorHtml(userMessage, error.message, action));
        }
    }

    /** POST /api/incidents/create — Creates incident from JSON body (used by frontend) */
    async createIncidentFromAlertPOST(req, res, next) {
        try {
            const alertData = req.validatedBody;
            console.log('Creating incident only (POST):', alertData);
            const result = await this.incidentService.createIncidentFromAlert(alertData);
            res.json({
                success: true,
                message: 'Incident created successfully',
                data: result
            });
        } catch (error) {
            if (error.message.includes('No system mapping') || error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: 'No system mapping or rules found',
                    details: error.message
                });
            }
            next(error);
        }
    }

    /** POST /api/incidents/simulate — Dry-run incident creation without sending to ServiceNow */
    async simulateIncidentCreation(req, res, next) {
        try {
            const alertData = req.validatedBody;
            console.log('🧪 Simulating incident creation:', alertData);

            const simulationResult = await this.incidentService.simulateIncidentCreation(alertData);

            res.json({
                success: true,
                message: 'Simulation completed',
                data: simulationResult
            });
        } catch (error) {
            next(error);
        }
    }

    // ================== SYSTEM MAPPINGS ==================

    /** GET /api/incidents/system-mappings — List all Grafana→ServiceNow system mappings */
    async getSystemMappings(req, res, next) {
        try {
            const mappings = await this.incidentService.getSystemMappings();
            res.json({
                success: true,
                data: mappings,
                count: mappings.length
            });
        } catch (error) {
            next(error);
        }
    }

    /** POST /api/incidents/system-mappings — Create a new system mapping */
    async createSystemMapping(req, res, next) {
        try {
            const mappingData = req.validatedBody;
            const newMapping = await this.incidentService.createSystemMapping(mappingData);
            res.status(201).json({
                success: true,
                message: 'System mapping created successfully',
                data: newMapping
            });
        } catch (error) {
            if (error.message.includes('already exist')) {
                return res.status(409).json({
                    success: false,
                    error: 'Mapping already exists',
                    details: error.message
                });
            }
            next(error);
        }
    }

    /** PUT /api/incidents/system-mappings/:id — Update an existing system mapping */
    async updateSystemMapping(req, res, next) {
        try {
            const { id } = req.params;
            const mappingData = req.validatedBody;
            const updatedMapping = await this.incidentService.updateSystemMapping(id, mappingData);
            res.json({
                success: true,
                message: 'System mapping updated successfully',
                data: updatedMapping
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: 'System mapping not found',
                    details: error.message
                });
            }
            next(error);
        }
    }

    /** DELETE /api/incidents/system-mappings/:id — Delete a system mapping */
    async deleteSystemMapping(req, res, next) {
        try {
            const { id } = req.params;
            const result = await this.incidentService.deleteSystemMapping(id);
            res.json({
                success: true,
                message: result.message
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: 'System mapping not found',
                    details: error.message
                });
            }
            next(error);
        }
    }

    // ================== INCIDENT RULES ==================

    /** GET /api/incidents/rules — List rules, optionally filtered by ?grafana_name */
    async getIncidentRules(req, res, next) {
        try {
            const { application } = req.query;
            const rules = await this.incidentService.getIncidentRules(application);
            res.json({
                success: true,
                data: rules,
                count: rules.length
            });
        } catch (error) {
            next(error);
        }
    }

    /** POST /api/incidents/rules — Create a new incident rule */
    async createIncidentRule(req, res, next) {
        try {
            const ruleData = req.validatedBody;
            const newRule = await this.incidentService.createIncidentRule(ruleData);
            res.status(201).json({
                success: true,
                message: 'Incident rule created successfully',
                data: newRule
            });
        } catch (error) {
            if (error.message.includes('System mapping not found')) {
                return res.status(404).json({
                    success: false,
                    error: 'System mapping not found',
                    details: error.message
                });
            }
            next(error);
        }
    }

    /** PUT /api/incidents/rules/:id — Update an existing rule */
    async updateIncidentRule(req, res, next) {
        try {
            const { id } = req.params;
            const ruleData = req.validatedBody;
            const updatedRule = await this.incidentService.updateIncidentRule(id, ruleData);
            res.json({
                success: true,
                message: 'Incident rule updated successfully',
                data: updatedRule
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: 'Rule not found',
                    details: error.message
                });
            }
            next(error);
        }
    }

    /** DELETE /api/incidents/rules/:id — Delete an incident rule */
    async deleteIncidentRule(req, res, next) {
        try {
            const { id } = req.params;
            const result = await this.incidentService.deleteIncidentRule(id);
            res.json({
                success: true,
                message: result.message
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: 'Incident rule not found',
                    details: error.message
                });
            }
            next(error);
        }
    }

    /** PATCH /api/incidents/rules/:id/toggle — Enable or disable a rule */
    async toggleIncidentRule(req, res, next) {
        try {
            const { id } = req.params;
            const { enabled } = req.body;

            if (typeof enabled !== 'boolean') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid request',
                    details: 'enabled field must be a boolean'
                });
            }

            const result = await this.incidentService.toggleIncidentRule(id, enabled);

            res.json({
                success: true,
                message: result.message
            });
        } catch (error) {
            if (error.message.includes('not found')) {
                return res.status(404).json({
                    success: false,
                    error: 'Incident rule not found',
                    details: error.message
                });
            }
            next(error);
        }
    }

    // ================== HISTORY / LOGS ==================

    /** GET /api/incidents/logs — Paginated incident creation history */
    async getIncidentLogs(req, res, next) {
        try {
            const { limit = 50, skip = 0, search = '' } = req.query;
            const result = await this.incidentService.getIncidentHistory(
                parseInt(limit),
                parseInt(skip),
                search
            );
            res.json({
                success: true,
                data: result.logs,
                count: result.total,
                meta: { limit, skip, search }
            });
        } catch (error) {
            next(error);
        }
    }

    // ================== UTILITY ==================

    /** GET /api/incidents/distinct/:field — Get distinct values for a field (for filter dropdowns) */
    async getDistinctValues(req, res, next) {
        try {
            const { field } = req.params;
            const validFields = [
                'assignment_group',
                'service_offering',
                'business_service',
                'u_network',
                'u_site',
                'u_impact_technology',
                'u_monitor_identifier'
            ];

            if (!validFields.includes(field)) {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid field',
                    details: `Valid fields are: ${validFields.join(', ')}`
                });
            }

            const values = await this.incidentService.getDistinctValues(field);
            res.json({
                success: true,
                data: values
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = { IncidentController };
