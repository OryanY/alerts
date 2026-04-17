// routes/incidentRoutes.js - Clean route definitions using Controller pattern
const express = require('express');
const IncidentService = require('../services/incident/IncidentService');
const SystemMappingService = require('../services/incident/SystemMappingService');
const IncidentRuleService = require('../services/incident/IncidentRuleService');
const { IncidentController } = require('../controllers/IncidentController');
const { validateQuery, validateBody } = require('../middleware/validation');
const {
  alertQuerySchema,
  systemMappingSchema,
  incidentRuleSchema,
  serviceNowAlertSchema,
  combinedCreateSchema
} = require('../schemas/incidentSchemas');

const router = express.Router();

// Initialize service and controller (Dependency Injection)
const mappingService = new SystemMappingService();
const ruleService = new IncidentRuleService();
const incidentService = new IncidentService(mappingService, ruleService);
const controller = new IncidentController(incidentService, mappingService, ruleService);

// ================== ASSIGNMENT GROUPS ==================
router.get('/assignment-groups', controller.getAssignmentGroups);
router.get('/assignment-groups/sync', controller.syncAssignmentGroups);

router.get(
  '/incident-with-alert',
  validateQuery(combinedCreateSchema),  
  controller.createIncidentWithAlertGET 
);

router.post(
  '/incident-with-alert',
  validateBody(combinedCreateSchema),    
  controller.createIncidentWithAlertPOST 
);

// ================== INCIDENT CREATION ==================
router.get('/incident', validateQuery(alertQuerySchema), controller.createIncidentFromAlertGET);
router.post('/incident', validateBody(alertQuerySchema), controller.createIncidentFromAlertPOST);
router.post('/incident/simulate', validateBody(alertQuerySchema), controller.simulateIncidentCreation);

router.post('/alert', validateBody(serviceNowAlertSchema), controller.createServiceNowAlert);
router.get('/alert', validateQuery(serviceNowAlertSchema), controller.createServiceNowAlert);

// ================== SYSTEM MAPPINGS ==================
router.get('/system-mappings', controller.getSystemMappings);

router.post('/system-mappings',
  validateBody(systemMappingSchema),
  controller.createSystemMapping
);
router.put('/system-mappings/:id',
  validateBody(systemMappingSchema.fork(['grafana_names'], (schema) => schema.optional())),
  controller.updateSystemMapping
);
router.delete('/system-mappings/:id',
  controller.deleteSystemMapping
);

// ================== INCIDENT RULES ==================
router.get('/incident-rules', controller.getIncidentRules);

router.post('/incident-rules',
  validateBody(incidentRuleSchema),
  controller.createIncidentRule
);
router.put('/incident-rules/:id',
  validateBody(incidentRuleSchema.fork(['system_mapping_id'], (schema) => schema.optional())),
  controller.updateIncidentRule
);
router.delete('/incident-rules/:id',
  controller.deleteIncidentRule
);
router.patch('/incident-rules/:id/toggle',
  controller.toggleIncidentRule
);


// ================== HISTORY / LOGS ==================
router.get('/incident-logs', controller.getIncidentLogs);

// ================== GRAFANA WEBHOOK ==================
router.get('/', controller.createIncidentFromGrafana);

module.exports = router;
