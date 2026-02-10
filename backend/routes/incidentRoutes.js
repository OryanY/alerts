// routes/incidentRoutes.js - Clean route definitions using Controller pattern
const express = require('express');
const IncidentService = require('../services/incident/IncidentService');
const { IncidentController } = require('../controllers/IncidentController');
const { validateQuery, validateBody } = require('../middleware/validation');
const {
  alertQuerySchema,
  systemMappingSchema,
  incidentRuleSchema
} = require('../schemas/incidentSchemas');

const router = express.Router();

// Initialize service and controller (Dependency Injection)
const incidentService = new IncidentService();
const controller = new IncidentController(incidentService);

// ================== ASSIGNMENT GROUPS ==================
router.get('/assignment-groups', controller.getAssignmentGroups);
router.get('/assignment-groups/sync', controller.syncAssignmentGroups);

// ================== INCIDENT CREATION ==================
router.get('/incident', validateQuery(alertQuerySchema), controller.createIncidentFromAlertGET);
router.post('/incident', validateBody(alertQuerySchema), controller.createIncidentFromAlertPOST);
router.post('/incident/simulate', validateBody(alertQuerySchema), controller.simulateIncidentCreation);

// ================== PROTECTED ROUTES (System Mappings & Incident Rules) ==================
// Create a sub-router for protected routes that all require authentication and admin role
const { authenticate, requireRole, auditLog } = require('../middleware/auth');
const protectedRouter = express.Router();

const { CONFIG } = require('../config');

// Apply auth middleware to ALL routes in this sub-router
protectedRouter.use(authenticate);
protectedRouter.use(requireRole(...CONFIG.auth.adminGroups));

// ================== SYSTEM MAPPINGS ==================
protectedRouter.get('/system-mappings', controller.getSystemMappings);
protectedRouter.post('/system-mappings',
  auditLog('CREATE_SYSTEM_MAPPING'),
  validateBody(systemMappingSchema),
  controller.createSystemMapping
);
protectedRouter.put('/system-mappings/:id',
  auditLog('UPDATE_SYSTEM_MAPPING'),
  validateBody(systemMappingSchema.fork(['grafana_names'], (schema) => schema.optional())),
  controller.updateSystemMapping
);
protectedRouter.delete('/system-mappings/:id',
  auditLog('DELETE_SYSTEM_MAPPING'),
  controller.deleteSystemMapping
);

// ================== INCIDENT RULES ==================
protectedRouter.get('/incident-rules', controller.getIncidentRules);
protectedRouter.post('/incident-rules',
  auditLog('CREATE_INCIDENT_RULE'),
  validateBody(incidentRuleSchema),
  controller.createIncidentRule
);
protectedRouter.put('/incident-rules/:id',
  auditLog('UPDATE_INCIDENT_RULE'),
  validateBody(incidentRuleSchema.fork(['system_mapping_id'], (schema) => schema.optional())),
  controller.updateIncidentRule
);
protectedRouter.delete('/incident-rules/:id',
  auditLog('DELETE_INCIDENT_RULE'),
  controller.deleteIncidentRule
);
protectedRouter.patch('/incident-rules/:id/toggle',
  auditLog('TOGGLE_INCIDENT_RULE'),
  controller.toggleIncidentRule
);

// Mount the protected router
router.use(protectedRouter);

// ================== HISTORY / LOGS ==================
router.get('/incident-logs', controller.getIncidentLogs);

// ================== UTILITY ROUTES ==================
router.get('/distinct/:field', controller.getDistinctValues);

module.exports = router;
