// routes/incidentRoutes.js - system_offering fetched from mapping, not request
const express = require('express');
const Joi = require('joi');
const IncidentService = require('../services/incident/IncidentService');
const { validateQuery, validateBody } = require('../middleware/validation');
const { handleError } = require('../middleware/errorHandler');
const { getErrorHtml } = require('../utils/htmlTemplates');

const router = express.Router();

// Initialize service
const incidentService = new IncidentService();

// Helper to generate error action link
const getErrorAction = (error) => {
  if (error.message.includes('No system mapping')) {
    const frontendUrl = 'http://localhost:3000';
    return {
      label: '➕ יצירת מיפוי חדש',
      url: `${frontendUrl}/incident`
    };
  }
  return null;
};

// ================== VALIDATION SCHEMAS ==================

const alertQuerySchema = Joi.object({
  application: Joi.string().required().trim().max(100),
  object_name: Joi.string().required().trim().max(100),
  node_name: Joi.string().required().trim().max(100),
  message: Joi.string().required().trim().max(500),
  time_created: Joi.string().optional().allow('').trim(),
  operator: Joi.string().required().trim().max(50),
  network: Joi.string().trim().max(50).optional(),
  user: Joi.string().trim().optional()
});

// ServiceNow alert creation (system_offering REMOVED)
const serviceNowAlertSchema = Joi.object({
  application: Joi.string().required().trim(),
  object_name: Joi.string().required().trim(),
  node_name: Joi.string().required().trim(),
  message: Joi.string().required().trim(),
  time_created: Joi.string().optional().allow('').trim(),
  operator: Joi.string().required().trim().max(50),
  incident_number: Joi.string().trim().optional(),
  network: Joi.string().trim().max(50).optional(),
  user: Joi.string().trim().optional()
});

// Combined incident + alert creation (system_offering REMOVED)
const combinedCreateSchema = Joi.object({
  application: Joi.string().required().trim().max(100),
  object_name: Joi.string().required().trim().max(100),
  node_name: Joi.string().required().trim().max(100),
  message: Joi.string().required().trim().max(500),
  time_created: Joi.string().optional().allow('').trim(),
  operator: Joi.string().required().trim().max(50),
  network: Joi.string().trim().max(50).optional(),
  user: Joi.string().trim().optional(),
  create_servicenow_alert: Joi.string().valid('true', 'false', '1', '0').default('true'),
  link_to_incident: Joi.string().valid('true', 'false', '1', '0').default('true'),
});

const systemMappingSchema = Joi.object({
  grafana_names: Joi.array().items(
    Joi.alternatives().try(
      Joi.object({
        value: Joi.string().trim().lowercase().required(),
        type: Joi.string().valid('exact', 'contains', 'regex').required(),
      }),
      Joi.string().trim().lowercase(),
    )
  ).min(1).required().messages({
    'array.min': 'at least one Grafana application required',
    'any.required': 'grafana names are required',
  }),
  service_offering: Joi.string().required().trim(),
  business_service: Joi.string().required().trim(),
  u_network: Joi.string().required().trim(),
  u_impact_technology: Joi.string().required().trim(),
  assignment_group: Joi.string().required().trim(),
  u_system_failure: Joi.boolean().default(false)
}).unknown(true);

const incidentRuleSchema = Joi.object({
  system_mapping_id: Joi.string().required(),
  rule_name: Joi.string().required().trim(),
  description: Joi.string().optional().trim(),
  conditions: Joi.object({
    message_contains: Joi.array().items(Joi.string().trim()).optional(),
    message_regex: Joi.string().optional(),
    message_exact: Joi.string().optional(),
    node_name_contains: Joi.array().items(Joi.string().trim()).optional(),
    node_name_regex: Joi.string().optional(),
    node_name_exact: Joi.string().optional(),
    object_name_contains: Joi.array().items(Joi.string().trim()).optional(),
    object_name_regex: Joi.string().optional(),
    object_name_exact: Joi.string().optional(),
    network_contains: Joi.array().items(Joi.string().trim()).optional(),
    network_regex: Joi.string().optional(),
    network_exact: Joi.string().optional(),
    network: Joi.string().optional(),
    operator_contains: Joi.array().items(Joi.string().trim()).optional(),
    operator_regex: Joi.string().optional(),
    operator_exact: Joi.string().optional()
  }).min(1).required(),
  logic_operator: Joi.string().valid('OR', 'AND').default('OR'),
  incident_overrides: Joi.object({
    short_description: Joi.string().optional(),
    description: Joi.string().optional(),
    u_system_failure: Joi.boolean().optional()
  }).unknown(true).optional(),
  enabled: Joi.boolean().default(true),
});

// ================== ASSIGNMENT GROUPS ==================
router.get('/assignment-groups', async (req, res) => {
  try {
    const groups = await incidentService.getAssignmentGroups();
    res.json({
      success: true,
      data: groups,
      count: groups.length
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/assignment-groups/sync', async (req, res) => {
  try {
    const groups = await incidentService.syncAssignmentGroups();
    res.json({
      success: true,
      message: 'Assignment groups synced successfully',
      data: groups,
      count: groups.length
    });
  } catch (error) {
    handleError(res, error, 'Failed to sync assignment groups');
  }
});
// ================== INCIDENT CREATION ONLY ==================


// GET for Grafana webhook compatibility
router.get('/incident', validateQuery(alertQuerySchema), async (req, res) => {
  try {
    const alertData = req.validatedQuery;
    console.log('Creating incident only (GET):', alertData);
    const result = await incidentService.createIncidentFromAlert(alertData);

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

    // Suggest creating a mapping if missing
    const action = getErrorAction(error);

    res.status(statusCode).send(getErrorHtml(userMessage, error.message, action));
  }
});

// POST for programmatic use
router.post('/incident', validateBody(alertQuerySchema), async (req, res) => {
  try {
    const alertData = req.validatedBody;
    console.log('Creating incident only (POST):', alertData);
    const result = await incidentService.createIncidentFromAlert(alertData);
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
    handleError(res, error);
  }
});

// ================== ALERT CREATION ONLY ==================

// GET for webhook compatibility
router.get('/alert', validateQuery(serviceNowAlertSchema), async (req, res) => {
  try {
    const alertData = req.validatedQuery;
    console.log('Creating ServiceNow alert only (GET):', alertData);
    const result = await incidentService.createServiceNowAlert(alertData);

    // Success: Redirect to ServiceNow (via Incident link if available, or just success message)
    // Note: Alert creation usually returns an incident link too if we used the table API
    if (result.serviceNowResult && result.serviceNowResult.link) {
      return res.redirect(result.serviceNowResult.link);
    }

    res.json({
      success: true,
      message: 'ServiceNow alert created successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Error in GET /alert:', error.message);
    const isMappingError = error.message.includes('No system mapping');
    const statusCode = isMappingError ? 404 : 500;
    const userMessage = isMappingError
      ? 'לא נמצא מיפוי מערכת עבור האפליקציה'
      : 'אירעה שגיאה ביצירת ההתראה';

    const action = getErrorAction(error);

    res.status(statusCode).send(getErrorHtml(userMessage, error.message, action));
  }
});

// POST for programmatic use
router.post('/alert', validateBody(serviceNowAlertSchema), async (req, res) => {
  try {
    const alertData = req.validatedBody;
    console.log('Creating ServiceNow alert only (POST):', alertData);
    const result = await incidentService.createServiceNowAlert(alertData);
    res.json({
      success: true,
      message: 'ServiceNow alert created successfully',
      data: result
    });
  } catch (error) {
    handleError(res, error);
  }
});


// ================== INCIDENT + ALERT CREATION (COMBINED) ==================

// GET for webhook compatibility
router.get('/incident-with-alert', validateQuery(combinedCreateSchema), async (req, res) => {
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
      severity: params.severity
    };

    console.log('Creating incident with alert (GET):', { alertData, createAlert, linkToIncident });

    const result = await incidentService.createIncidentWithAlert(
      alertData,
      createAlert,
      linkToIncident
    );

    // Redirect logic: prefer incident link, then alert link
    const redirectLink = result.incident?.serviceNowResult?.link || result.alert?.serviceNowResult?.link;

    if (redirectLink) {
      return res.redirect(redirectLink);
    }

    res.json({
      success: true,
      message: 'Incident and alert created successfully',
      data: result
    });
  } catch (error) {
    console.error('❌ Error in GET /incident-with-alert:', error.message);
    const isMappingError = error.message.includes('No system mapping');
    const statusCode = isMappingError ? 404 : 500;
    const userMessage = isMappingError
      ? 'לא נמצא מיפוי מערכת עבור האפליקציה'
      : 'אירעה שגיאה ביצירת התקלה וההתראה';

    const action = getErrorAction(error);

    res.status(statusCode).send(getErrorHtml(userMessage, error.message, action));
  }
});

// POST for programmatic use
router.post('/incident-with-alert', async (req, res) => {
  try {
    const { alert, create_servicenow_alert = true, link_to_incident = true } = req.body;

    if (!alert) {
      return res.status(400).json({
        success: false,
        error: 'Missing alert data',
        details: 'Request body must include "alert" object'
      });
    }

    console.log('Creating incident with alert (POST):', { alert, create_servicenow_alert, link_to_incident });
    const result = await incidentService.createIncidentWithAlert(
      alert,
      create_servicenow_alert,
      link_to_incident
    );

    res.json({
      success: true,
      message: 'Incident and alert created successfully',
      data: result
    });
  } catch (error) {
    handleError(res, error);
  }
});

// ================== SYSTEM MAPPINGS ==================

router.get('/system-mappings', async (req, res) => {
  try {
    const mappings = await incidentService.getSystemMappings();
    res.json({
      success: true,
      data: mappings,
      count: mappings.length
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/system-mappings', validateBody(systemMappingSchema), async (req, res) => {
  try {
    const mappingData = req.validatedBody;
    const newMapping = await incidentService.createSystemMapping(mappingData);
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
    handleError(res, error);
  }
});

router.put('/system-mappings/:id', validateBody(systemMappingSchema.fork(['grafana_names'], (schema) => schema.optional())), async (req, res) => {
  try {
    const { id } = req.params;
    const mappingData = req.validatedBody;
    const updatedMapping = await incidentService.updateSystemMapping(id, mappingData);
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
    handleError(res, error);
  }
});

router.delete('/system-mappings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await incidentService.deleteSystemMapping(id);
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
    handleError(res, error);
  }
});

// ================== INCIDENT RULES ==================

router.get('/incident-rules', async (req, res) => {
  try {
    const { application } = req.query;
    const rules = await incidentService.getIncidentRules(application);
    res.json({
      success: true,
      data: rules,
      count: rules.length
    });
  } catch (error) {
    handleError(res, error);
  }
});

router.post('/incident-rules', validateBody(incidentRuleSchema), async (req, res) => {
  try {
    const ruleData = req.validatedBody;
    const newRule = await incidentService.createIncidentRule(ruleData);
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
    handleError(res, error);
  }
});

router.put('/incident-rules/:id', validateBody(incidentRuleSchema.fork(['system_mapping_id'], (schema) => schema.optional())), async (req, res) => {
  try {
    const { id } = req.params;
    const ruleData = req.validatedBody;
    const updatedRule = await incidentService.updateIncidentRule(id, ruleData);
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
    handleError(res, error);
  }
});

router.delete('/incident-rules/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await incidentService.deleteIncidentRule(id);
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
    handleError(res, error);
  }
});

router.patch('/incident-rules/:id/toggle', async (req, res) => {
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

    const result = await incidentService.toggleIncidentRule(id, enabled);

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
    handleError(res, error);
  }
});

// ================== UTILITY ROUTES ==================

router.get('/distinct/:field', async (req, res) => {
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

    const values = await incidentService.getDistinctValues(field);
    res.json({
      success: true,
      data: values
    });
  } catch (error) {
    handleError(res, error, 'Error fetching distinct values');
  }
});

module.exports = router;
