// routes/incidentRoutes.js - Enhanced version with rules support
const express = require('express');
const Joi = require('joi');
const incidentService = require('../services/incidentService');

const router = express.Router();

// ================== VALIDATION SCHEMAS ==================

// Updated alert schema with optional network field
const alertSchema = Joi.object({
  application: Joi.string().required().trim(),
  object_name: Joi.string().required().trim(),
  node_name: Joi.string().required().trim(),
  message: Joi.string().required().trim(),
  time_created: Joi.string().required().trim(),
  operator: Joi.string().required().trim(),
  network: Joi.string().optional().trim() // New optional field
});

const systemMappingSchema = Joi.object({
  grafana_name: Joi.string().required().trim(),
  service_offering: Joi.string().required().trim(),
  business_service: Joi.string().required().trim(),
  u_site: Joi.string().required().trim(),
  u_network: Joi.string().required().trim(),
  u_impact_technology: Joi.string().required().trim(),
  u_monitor_identifier: Joi.string().default('עלה בניטור'),
  connection_string: Joi.string().required().trim(),
  assignment_group: Joi.string().required().trim(),
}).unknown(true);

const updateMappingSchema = systemMappingSchema.fork(['grafana_name'], (schema) => schema.optional());

// New incident rule schema
const incidentRuleSchema = Joi.object({
  system_mapping_id: Joi.string().required(),
  rule_name: Joi.string().required().trim(),
  description: Joi.string().optional().trim(),
  
  conditions: Joi.object({
    message_contains: Joi.array().items(Joi.string().trim()).optional(),
    message_regex: Joi.string().optional(),
    message_exact: Joi.string().optional(),
    node_name_contains: Joi.array().items(Joi.string().trim()).optional(),
    object_name_contains: Joi.array().items(Joi.string().trim()).optional(),
    network: Joi.string().optional().trim()
  }).min(1).required(), // At least one condition required
  
  incident_overrides: Joi.object({
    short_description: Joi.string().optional(),
    description: Joi.string().optional(),
    // Priority and urgency removed from backend
  }).unknown(true).optional(),
  
  enabled: Joi.boolean().default(true),
  priority_order: Joi.number().integer().min(1).default(1)
});

const updateRuleSchema = incidentRuleSchema.fork(['system_mapping_id'], (schema) => schema.optional());

// ================== MIDDLEWARE ==================

const validateRequest = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details.map(d => d.message)
    });
  }
  req.validatedBody = value;
  next();
};

const handleError = (res, error, message = 'Internal server error') => {
  console.error(`${message}:`, error);
  res.status(500).json({
    error: message,
    details: error.message
  });
};

// ================== INCIDENT CREATION (existing, enhanced) ==================

router.post('/create-incident', validateRequest(alertSchema), async (req, res) => {
  try {
    const alertData = req.validatedBody;
    console.log('Creating incident from alert:', JSON.stringify(alertData, null, 2));
    
    const incidentData = await incidentService.createIncidentFromAlert(alertData);
    
    res.json({
      success: true,
      message: 'Incident created successfully',
      data: incidentData
    });
  } catch (error) {
    if (error.message.includes('No system mapping') || error.message.includes('not found')) {
      return res.status(404).json({
        error: 'No system mapping or rules found',
        details: error.message
      });
    }
    handleError(res, error, 'Error creating incident');
  }
});

// ================== SYSTEM MAPPINGS (existing routes) ==================

router.get('/system-mappings', async (req, res) => {
  try {
    const mappings = await incidentService.getSystemMappings();
    res.json({
      success: true,
      data: mappings,
      count: mappings.length
    });
  } catch (error) {
    handleError(res, error, 'Error fetching system mappings');
  }
});

router.get('/system-mappings/application/:application', async (req, res) => {
  try {
    const { application } = req.params;
    const mapping = await incidentService.getMappingByApplication(application);
    
    if (!mapping) {
      return res.status(404).json({
        error: 'System mapping not found',
        details: `No mapping found for application: ${application}`
      });
    }
    
    res.json({
      success: true,
      data: mapping
    });
  } catch (error) {
    handleError(res, error, 'Error fetching system mapping');
  }
});

router.post('/system-mappings', validateRequest(systemMappingSchema), async (req, res) => {
  try {
    const mappingData = req.validatedBody;
    const newMapping = await incidentService.createSystemMapping(mappingData);
    
    res.status(201).json({
      success: true,
      message: 'System mapping created successfully',
      data: newMapping
    });
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: 'Mapping already exists',
        details: error.message
      });
    }
    handleError(res, error, 'Error creating system mapping');
  }
});

router.put('/system-mappings/:id', validateRequest(updateMappingSchema), async (req, res) => {
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
        error: 'System mapping not found',
        details: error.message
      });
    }
    if (error.message.includes('Invalid ObjectId')) {
      return res.status(400).json({
        error: 'Invalid mapping ID',
        details: 'Please provide a valid mapping ID'
      });
    }
    handleError(res, error, 'Error updating system mapping');
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
        error: 'System mapping not found',
        details: error.message
      });
    }
    if (error.message.includes('Cannot delete')) {
      return res.status(409).json({
        error: 'Cannot delete mapping',
        details: error.message
      });
    }
    if (error.message.includes('Invalid ObjectId')) {
      return res.status(400).json({
        error: 'Invalid mapping ID',
        details: 'Please provide a valid mapping ID'
      });
    }
    handleError(res, error, 'Error deleting system mapping');
  }
});

// ================== DROPDOWN OPTIONS FOR SYSTEM MAPPINGS ==================

// Expose distinct values for select fields in the UI
router.get('/dropdown-options/:field', async (req, res) => {
  try {
    const { field } = req.params;
    const allowed = new Set(['u_monitor_identifier', 'u_impact_technology']);
    if (!allowed.has(field)) {
      return res.status(400).json({
        error: 'Invalid field parameter',
        valid_fields: Array.from(allowed)
      });
    }

    const values = await incidentService.getDistinctValues(field);
    res.json({ success: true, data: values });
  } catch (error) {
    handleError(res, error, 'Error fetching dropdown options');
  }
});

// ================== INCIDENT RULES (new routes) ==================

// Get all incident rules or rules for specific application
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
    handleError(res, error, 'Error fetching incident rules');
  }
});

// Create new incident rule
router.post('/incident-rules', validateRequest(incidentRuleSchema), async (req, res) => {
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
        error: 'System mapping not found',
        details: error.message
      });
    }
    handleError(res, error, 'Error creating incident rule');
  }
});

// Update incident rule
router.put('/incident-rules/:id', validateRequest(updateRuleSchema), async (req, res) => {
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
        error: 'Rule not found',
        details: error.message
      });
    }
    if (error.message.includes('Invalid ObjectId')) {
      return res.status(400).json({
        error: 'Invalid rule ID',
        details: 'Please provide a valid rule ID'
      });
    }
    handleError(res, error, 'Error updating incident rule');
  }
});

// Delete incident rule
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
        error: 'Incident rule not found',
        details: error.message
      });
    }
    if (error.message.includes('Invalid ObjectId')) {
      return res.status(400).json({
        error: 'Invalid rule ID',
        details: 'Please provide a valid rule ID'
      });
    }
    handleError(res, error, 'Error deleting incident rule');
  }
});

// Toggle incident rule enabled/disabled
router.patch('/incident-rules/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
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
        error: 'Incident rule not found',
        details: error.message
      });
    }
    handleError(res, error, 'Error toggling incident rule');
  }
});

// ================== UTILITY ROUTES (existing) ==================

router.get('/system-mappings/distinct/:field', async (req, res) => {
  try {
    const { field } = req.params;
    const validFields = ['assignment_group', 'service_offering', 'business_service', 'u_site', 'u_network', 'u_impact_technology'];
    
    if (!validFields.includes(field)) {
      return res.status(400).json({
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

// Test rule matching (for testing purposes)
router.post('/test-rule-match', async (req, res) => {
  try {
    const { alertData, ruleId } = req.body;
    
    if (!alertData || !ruleId) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: 'alertData and ruleId are required'
      });
    }
    
    // This would be implemented in the service if needed
    res.json({
      success: true,
      message: 'Rule matching test endpoint - implement as needed'
    });
  } catch (error) {
    handleError(res, error, 'Error testing rule match');
  }
});

module.exports = router;
