
// ================== VALIDATION SCHEMAS ==================
const Joi = require('joi');

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
  object_name: Joi.string().optional().trim(),
  node_name: Joi.string().required().trim(),
  message: Joi.string().required().trim(),
  time_created: Joi.string().optional().allow('').trim(),
  operator: Joi.string().optional().trim().max(50),
  incident_number: Joi.string().trim().optional(),
  network: Joi.string().trim().max(50).optional(),
  how_solved: Joi.string().trim().optional(),
  user: Joi.string().trim().optional(),
  prevented: Joi.string().trim().optional(),
  incident_sys_id: Joi.string().trim().optional(),
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
  assignment_group: Joi.string().required().trim(),
  u_system_failure: Joi.boolean().default(false)
}).unknown(true);

const incidentRuleSchema = Joi.object({
  system_mapping_id: Joi.string().optional().allow(null),
  is_global: Joi.boolean().default(false),
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

// Incident field configuration (templates + default fields) — editable from
// the UI, stored in Mongo.
// Each section is atomic: when present it fully replaces the stored value.
// (required_fields / literal_fields / template_variables / application
// rewrites are code-managed and deliberately not accepted here — they are
// the fixed ServiceNow base contract, not tunable configuration.)
const incidentSettingsSchema = Joi.object({
  content_templates: Joi.object().pattern(
    Joi.string().pattern(/^[a-zA-Z0-9_]+$/),
    Joi.string().allow('')
  ),
  default_fields: Joi.object().pattern(
    Joi.string().pattern(/^[a-zA-Z0-9_]+$/),
    Joi.alternatives().try(Joi.string().allow(''), Joi.boolean(), Joi.number())
  )
}).min(1);

module.exports = {
  alertQuerySchema,
  serviceNowAlertSchema,
  combinedCreateSchema,
  systemMappingSchema,
  incidentRuleSchema,
  incidentSettingsSchema
};