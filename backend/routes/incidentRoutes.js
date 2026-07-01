// routes/incidentRoutes.js - Clean route definitions using Controller pattern
const express = require('express');
const IncidentService = require('../services/incident/IncidentService');
const SystemMappingService = require('../services/incident/SystemMappingService');
const IncidentRuleService = require('../services/incident/IncidentRuleService');
const IncidentSettingsService = require('../services/incident/IncidentSettingsService');
const { IncidentController } = require('../controllers/IncidentController');
const { validateQuery, validateBody } = require('../middleware/validation');
const {
  alertQuerySchema,
  systemMappingSchema,
  incidentRuleSchema,
  serviceNowAlertSchema,
  combinedCreateSchema,
  incidentSettingsSchema
} = require('../schemas/incidentSchemas');

const router = express.Router();

// Initialize services and controller (Dependency Injection)
const mappingService = new SystemMappingService();
const ruleService = new IncidentRuleService();
const settingsService = new IncidentSettingsService();
const incidentService = new IncidentService(mappingService, ruleService, settingsService);
const controller = new IncidentController(incidentService, mappingService, ruleService, settingsService);

// ================== REFERENCE DATA ==================
router.get('/assignment-groups', controller.getAssignmentGroups);
router.get('/networks', controller.getNetworks);
router.get('/service-offerings', controller.getServiceOfferings);
router.get('/business-services', controller.getBusinessServices);
router.get('/service-relationships', controller.getServiceRelationships);

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

// ================== INCIDENT SETTINGS (templates & defaults) ==================
// Edits are restricted to the owning team via a shared key
// (INCIDENT_SETTINGS_KEY env var, sent as the X-Settings-Key header).
// Reading is open to everyone. If the env var is unset, edits stay open
// (dev convenience) and a warning is logged at startup.
const crypto = require('crypto');
const { logger } = require('../utils/logger');
const SETTINGS_KEY = process.env.INCIDENT_SETTINGS_KEY || '';
if (!SETTINGS_KEY) {
  logger.tagged('incident').warn('INCIDENT_SETTINGS_KEY is not set — incident settings edits are open to all viewers');
}
// Hash both sides to a fixed 32 bytes before comparing: constant-time, no
// length leak, and bounds the work done on attacker-controlled header input.
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest();
const SETTINGS_KEY_HASH = SETTINGS_KEY ? sha256(SETTINGS_KEY) : null;
const requireSettingsKey = (req, res, next) => {
  if (!SETTINGS_KEY) return next();
  const provided = req.get('X-Settings-Key') || '';
  if (crypto.timingSafeEqual(sha256(provided), SETTINGS_KEY_HASH)) return next();
  return res.status(403).json({
    success: false,
    error: 'Team key required',
    details: 'Modifying incident defaults requires the team key (X-Settings-Key header)'
  });
};

router.get('/settings', controller.getIncidentSettings);
router.put('/settings',
  requireSettingsKey,
  validateBody(incidentSettingsSchema),
  controller.updateIncidentSettings
);
router.delete('/settings', requireSettingsKey, controller.resetIncidentSettings);

// ================== "NEEDS MAPPING" QUEUE ==================
// Applications that fired an alert with no matching mapping. Self-maintaining
// (deduped + capped); entries clear automatically when a covering mapping is made.
router.get('/mapping-queue', controller.getMappingQueue);
router.delete('/mapping-queue/:id', controller.dismissMappingQueueEntry);

// ================== SYSTEM MAPPINGS ==================
router.get('/system-mappings', controller.getSystemMappings);

// Resolve an application name to its mapping id (exact/contains/regex).
// Used by n8n to tag alerts with mapping_id so clustering groups by system,
// not by raw application string. Returns mapping_id: null when unmapped.
router.get('/system-mappings/resolve', controller.resolveMapping);

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


// ================== GRAFANA WEBHOOK ==================
router.get('/', controller.createIncidentFromGrafana);

// Expose the service so server.js can trigger startup caching
router.incidentService = incidentService;
module.exports = router;
