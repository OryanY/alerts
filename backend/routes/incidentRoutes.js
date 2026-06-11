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
const SETTINGS_KEY = process.env.INCIDENT_SETTINGS_KEY || '';
if (!SETTINGS_KEY) {
  console.warn('⚠️ INCIDENT_SETTINGS_KEY is not set — incident settings edits are open to all viewers');
}
const requireSettingsKey = (req, res, next) => {
  if (!SETTINGS_KEY) return next();
  const provided = req.get('X-Settings-Key') || '';
  const a = Buffer.from(provided);
  const b = Buffer.from(SETTINGS_KEY);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
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

// Expose the service so server.js can trigger startup caching
router.incidentService = incidentService;
module.exports = router;
