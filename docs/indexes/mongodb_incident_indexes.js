/*
  Manual MongoDB indexes for incident creation mapping/rule lookups.

  Run in mongosh against the application database after review. These indexes
  support exact Grafana application matches, non-exact fallback pattern lookup,
  and delete dependency checks.

  Rollback commands are included at the bottom.
*/

const systemMappings = db.getCollection('system_mappings_new');
const incidentRules = db.getCollection('incident_rules_new');

systemMappings.createIndex(
  { 'grafana_names.type': 1, 'grafana_names.value': 1 },
  { name: 'idx_system_mappings_grafana_pattern' }
);

systemMappings.createIndex(
  { grafana_names: 1 },
  { name: 'idx_system_mappings_grafana_legacy' }
);

incidentRules.createIndex(
  { 'grafana_names.type': 1, 'grafana_names.value': 1, enabled: 1, is_global: 1 },
  { name: 'idx_incident_rules_grafana_pattern' }
);

incidentRules.createIndex(
  { grafana_names: 1, enabled: 1, is_global: 1 },
  { name: 'idx_incident_rules_grafana_legacy' }
);

incidentRules.createIndex(
  { system_mapping_id: 1 },
  { name: 'idx_incident_rules_system_mapping_id' }
);

incidentRules.createIndex(
  { is_global: 1, enabled: 1, created_at: -1 },
  { name: 'idx_incident_rules_global_enabled' }
);

/*
  Rollback:

  db.system_mappings_new.dropIndex('idx_system_mappings_grafana_pattern');
  db.system_mappings_new.dropIndex('idx_system_mappings_grafana_legacy');
  db.incident_rules_new.dropIndex('idx_incident_rules_grafana_pattern');
  db.incident_rules_new.dropIndex('idx_incident_rules_grafana_legacy');
  db.incident_rules_new.dropIndex('idx_incident_rules_system_mapping_id');
  db.incident_rules_new.dropIndex('idx_incident_rules_global_enabled');
*/
