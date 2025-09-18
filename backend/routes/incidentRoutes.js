// routes/incidentRoutes.js - Simplified version with GET for alerts
const express = require('express');
const Joi = require('joi');
const incidentService = require('../services/incidentService');

const router = express.Router();

// ================== VALIDATION SCHEMAS ==================

// Secure alert schema for GET request (query parameters)
const alertQuerySchema = Joi.object({
  application: Joi.string().required().trim().max(100),
  object_name: Joi.string().required().trim().max(100),
  node_name: Joi.string().required().trim().max(100),
  message: Joi.string().required().trim().max(500),
  time_created: Joi.string().required().trim(),
  operator: Joi.string().required().trim().max(50),
  network: Joi.string().trim().max(50)

});

// Simplified system mapping schema - only base required fields
const systemMappingSchema = Joi.object({
  grafana_name: Joi.string().required().trim(),
  service_offering: Joi.string().required().trim(),
  business_service: Joi.string().required().trim(),
  u_network: Joi.string().required().trim(),
  assignment_group: Joi.string().required().trim()
}).unknown(true); // Allow additional fields

// Incident rule schema
const incidentRuleSchema = Joi.object({
  system_mapping_id: Joi.string().required(),
  rule_name: Joi.string().required().trim(),
  description: Joi.string().optional().trim(),
  conditions: Joi.object({
    message_contains: Joi.array().items(Joi.string().trim()).optional(),
    message_regex: Joi.string().optional(),
    node_name_contains: Joi.array().items(Joi.string().trim()).optional(),
    object_name_contains: Joi.array().items(Joi.string().trim()).optional()
  }).min(1).required(),
  incident_overrides: Joi.object().unknown(true).optional(),
  enabled: Joi.boolean().default(true),
  priority_order: Joi.number().integer().min(1).default(1)
});

// ================== UTILITY FUNCTIONS ==================

const validateQuery = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.query);
  if (error) {
    return res.status(400).json({
      error: 'Invalid parameters',
      details: error.details.map(d => d.message)
    });
  }
  req.validatedQuery = value;
  next();
};

const validateBody = (schema) => (req, res, next) => {
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

// ================== INCIDENT CREATION - SECURE GET REQUEST ==================

// GET endpoint for Grafana webhooks - using query parameters for security
router.get('/alert', validateQuery(alertQuerySchema), async (req, res) => {
  try {
    const alertData = req.validatedQuery;
    console.log('Creating incident from alert (GET):', alertData);
    
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
    if (error.message.includes('Required field') && error.message.includes('is missing')) {
      return res.status(400).json({
        error: 'Missing required field',
        details: error.message
      });
    }
    handleError(res, error, 'Error creating incident');
  }
});

// ================== REQUIRED FIELDS MANAGEMENT ==================

router.get('/required-fields', async (req, res) => {
  try {
    const { service_offering } = req.query;
    
    if (!service_offering) {
      return res.status(400).json({
        error: 'service_offering parameter is required'
      });
    }

    const requiredFields = await incidentService.getRequiredFieldsForServiceOffering(service_offering);
    
    res.json({
      success: true,
      data: requiredFields
    });
  } catch (error) {
    handleError(res, error, 'Error fetching required fields');
  }
});

router.post('/required-fields', async (req, res) => {
  try {
    const { service_offering, fields } = req.body;
    
    if (!service_offering) {
      return res.status(400).json({
        error: 'service_offering is required'
      });
    }

    if (!Array.isArray(fields)) {
      return res.status(400).json({
        error: 'fields must be an array'
      });
    }

    const result = await incidentService.setRequiredFieldsForServiceOffering(service_offering, fields);
    
    res.json({
      success: true,
      message: 'Required fields updated successfully',
      data: result
    });
  } catch (error) {
    handleError(res, error, 'Error setting required fields');
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
    handleError(res, error, 'Error fetching system mappings');
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
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: 'Mapping already exists',
        details: error.message
      });
    }
    handleError(res, error, 'Error creating system mapping');
  }
});

router.put('/system-mappings/:id', validateBody(systemMappingSchema.fork(['grafana_name'], (schema) => schema.optional())), async (req, res) => {
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
    handleError(res, error, 'Error deleting system mapping');
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
    handleError(res, error, 'Error fetching incident rules');
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
        error: 'System mapping not found',
        details: error.message
      });
    }
    handleError(res, error, 'Error creating incident rule');
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
        error: 'Rule not found',
        details: error.message
      });
    }
    handleError(res, error, 'Error updating incident rule');
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
        error: 'Incident rule not found',
        details: error.message
      });
    }
    handleError(res, error, 'Error deleting incident rule');
  }
});

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