// routes/incidentRoutes.js
const express = require('express');
const Joi = require('joi');
const incidentService = require('../services/incidentService');

const router = express.Router();

// Validation schemas
const alertSchema = Joi.object({
  application: Joi.string().required().trim(),
  object_name: Joi.string().required().trim(),
  node_name: Joi.string().required().trim(),
  message: Joi.string().required().trim(),
  time_created: Joi.string().required().trim(),
  operator: Joi.string().required().trim()
});

const systemMappingSchema = Joi.object({
  grafana_name: Joi.string().required().trim(),
  service_offering: Joi.string().required().trim(),
  business_service: Joi.string().required().trim(),
  u_site: Joi.string().required().trim(),
  u_network: Joi.string().required().trim(),
  u_impact_technology: Joi.string().required().trim(),
  u_monitor_identifier: Joi.string().default('from_grafana'),
  assignment_group: Joi.string().required().trim(),
  // Allow additional fields for flexibility
}).unknown(true);

const updateMappingSchema = systemMappingSchema.fork(['grafana_name'], (schema) => schema.optional());

// Middleware for validation
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

// Error handler
const handleError = (res, error, message = 'Internal server error') => {
  console.error(`${message}:`, error);
  res.status(500).json({
    error: message,
    details: error.message
  });
};

// Create incident from alert (secure endpoint with query params)
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
    if (error.message.includes('No system mapping found')) {
      return res.status(404).json({
        error: 'No system mapping found',
        details: error.message
      });
    }
    handleError(res, error, 'Error creating incident');
  }
});

// Get all system mappings
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

// Get system mapping by application
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

// Create new system mapping
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

// Update system mapping
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

// Delete system mapping
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
    if (error.message.includes('Invalid ObjectId')) {
      return res.status(400).json({
        error: 'Invalid mapping ID',
        details: 'Please provide a valid mapping ID'
      });
    }
    handleError(res, error, 'Error deleting system mapping');
  }
});

// Get distinct values for a field (for dropdowns)
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

module.exports = router;