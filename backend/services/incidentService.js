// services/incidentService.js - Enhanced version with rules support
const { getMongoDb } = require('../database/connection');
const { mongoConfig } = require('../config');
const { ObjectId } = require('mongodb');

class IncidentService {
  constructor() {
    this.systemMappingsCollection = null;
    this.incidentRulesCollection = null;
  }

  async initialize() {
    const db = getMongoDb();
    this.systemMappingsCollection = db.collection(mongoConfig.collections.systemMappings);
    this.incidentRulesCollection = db.collection('incident_rules'); // New collection
  }

   _buildIncidentData(systemMapping, ruleOverrides = {}, alertData) {
    // Define required fields that must always be present
    const requiredFields = ['assignment_group', 'service_offering', 'business_service'];
    
    // System fields that should never be copied to incidents
    const excludeFields = new Set(['_id', 'grafana_name', 'created_at', 'updated_at']);
    
    const incidentData = {};
    
    // 1. Add required fields (from overrides or mapping)
    requiredFields.forEach(field => {
      const value = ruleOverrides[field] || systemMapping[field];
      if (!value) {
        throw new Error(`Required field '${field}' is missing from both mapping and rule overrides`);
      }
      incidentData[field] = value;
    });
    
    // 2. Auto-inherit all other fields from system mapping (if they have values)
    Object.entries(systemMapping).forEach(([key, value]) => {
      if (!excludeFields.has(key) && !requiredFields.includes(key)) {
        // Only include if value exists and is not empty
        if (value != null && String(value).trim() !== '') {
          incidentData[key] = value;
        }
      }
    });
    
    // 3. Apply rule overrides (can override inherited fields)
    if (ruleOverrides) {
      Object.entries(ruleOverrides).forEach(([key, value]) => {
        if (!excludeFields.has(key) && value != null && String(value).trim() !== '') {
          incidentData[key] = this._replaceTemplateVariables(value, alertData);
        }
      });
    }
    
    // 4. Add default description fields if not overridden
    if (!incidentData.short_description) {
      incidentData.short_description = `Alert: ${alertData.object_name} - ${alertData.application}`;
    }
    
    if (!incidentData.description) {
      incidentData.description = `Alert Details:
Application: ${alertData.application}
Object: ${alertData.object_name}
Node: ${alertData.node_name}
Network: ${alertData.network || 'N/A'}
Message: ${alertData.message}
Time Created: ${alertData.time_created}
Operator: ${alertData.operator}`;
    }
    
    return incidentData;
  }



  _sanitizeIncidentOverrides(overrides) {
    if (!overrides || typeof overrides !== 'object') return overrides;
    // Disallow overriding core identity/enablement fields
    const forbidden = new Set(['priority', 'urgency', 'grafana_name', 'service_offering', 'business_service', 'enabled']);
    const cleaned = {};
    for (const [k, v] of Object.entries(overrides)) {
      if (forbidden.has(k)) continue;
      if (v === undefined || v === null) continue;
      if (typeof v === 'string' && v.trim() === '') continue;
      cleaned[k] = v;
    }
    return cleaned;
  }

  // ================== SYSTEM MAPPINGS (existing methods) ==================
  
  async getSystemMappings() {
    if (!this.systemMappingsCollection) await this.initialize();
    
    try {
      const mappings = await this.systemMappingsCollection.find({}).toArray();
      return mappings;
    } catch (error) {
      console.error('Error fetching system mappings:', error);
      throw new Error('Failed to fetch system mappings');
    }
  }

  async getMappingByApplication(grafanaName) {
    if (!this.systemMappingsCollection) await this.initialize();
    
    try {
      const mapping = await this.systemMappingsCollection.findOne({ grafana_name: grafanaName });
      return mapping;
    } catch (error) {
      console.error('Error fetching mapping by application:', error);
      throw new Error('Failed to fetch mapping');
    }
  }

  async createSystemMapping(mappingData) {
    if (!this.systemMappingsCollection) await this.initialize();
    
    try {
      if (!mappingData.grafana_name) {
        throw new Error('grafana_name is required');
      }

      const existing = await this.systemMappingsCollection.findOne({ grafana_name: mappingData.grafana_name });
      if (existing) {
        throw new Error('Mapping for this grafana_name already exists');
      }

      const result = await this.systemMappingsCollection.insertOne({
        ...mappingData,
        created_at: new Date(),
        updated_at: new Date()
      });

      return { _id: result.insertedId, ...mappingData };
    } catch (error) {
      console.error('Error creating system mapping:', error);
      throw error;
    }
  }

  async updateSystemMapping(id, mappingData) {
    if (!this.systemMappingsCollection) await this.initialize();
    
    try {
      const objectId = new ObjectId(id);
      const { _id, created_at, ...updateData } = mappingData;
      
      const result = await this.systemMappingsCollection.updateOne(
        { _id: objectId },
        { $set: { ...updateData, updated_at: new Date() } }
      );

      if (result.matchedCount === 0) {
        throw new Error('System mapping not found');
      }

      return await this.systemMappingsCollection.findOne({ _id: objectId });
    } catch (error) {
      console.error('Error updating system mapping:', error);
      throw error;
    }
  }

  async deleteSystemMapping(id) {
    if (!this.systemMappingsCollection) await this.initialize();
    
    try {
      const objectId = new ObjectId(id);
      
      // Check if there are rules using this mapping
      const rulesCount = await this.incidentRulesCollection.countDocuments({ 
        system_mapping_id: objectId 
      });
      
      if (rulesCount > 0) {
        throw new Error(`Cannot delete system mapping. ${rulesCount} incident rules depend on it.`);
      }
      
      const result = await this.systemMappingsCollection.deleteOne({ _id: objectId });
      
      if (result.deletedCount === 0) {
        throw new Error('System mapping not found');
      }

      return { message: 'System mapping deleted successfully' };
    } catch (error) {
      console.error('Error deleting system mapping:', error);
      throw error;
    }
  }

  // ================== INCIDENT RULES (new methods) ==================

  async getIncidentRules(grafanaName = null) {
    if (!this.incidentRulesCollection) await this.initialize();
    
    try {
      const filter = grafanaName ? { grafana_name: grafanaName } : {};
      const rules = await this.incidentRulesCollection
        .aggregate([
          { $match: filter },
          {
            $lookup: {
              from: mongoConfig.collections.systemMappings,
              localField: 'system_mapping_id',
              foreignField: '_id',
              as: 'system_mapping'
            }
          },
          {
            $unwind: {
              path: '$system_mapping',
              preserveNullAndEmptyArrays: true
            }
          },
          { $sort: { priority_order: -1, created_at: -1 } }
        ])
        .toArray();
      
      return rules;
    } catch (error) {
      console.error('Error fetching incident rules:', error);
      throw new Error('Failed to fetch incident rules');
    }
  }

  async createIncidentRule(ruleData) {
    if (!this.incidentRulesCollection) await this.initialize();
    
    try {
      // Validate system mapping exists
      const mappingId = new ObjectId(ruleData.system_mapping_id);
      const mapping = await this.systemMappingsCollection.findOne({ _id: mappingId });
      
      if (!mapping) {
        throw new Error('System mapping not found');
      }

      const cleanedOverrides = this._sanitizeIncidentOverrides(ruleData.incident_overrides);

      const result = await this.incidentRulesCollection.insertOne({
        ...ruleData,
        system_mapping_id: mappingId,
        grafana_name: mapping.grafana_name, // Store for quick lookup
        ...(cleanedOverrides !== undefined ? { incident_overrides: cleanedOverrides } : {}),
        created_at: new Date(),
        updated_at: new Date()
      });

      return { _id: result.insertedId, ...ruleData, ...(cleanedOverrides !== undefined ? { incident_overrides: cleanedOverrides } : {}) };
    } catch (error) {
      console.error('Error creating incident rule:', error);
      throw error;
    }
  }

  async updateIncidentRule(id, ruleData) {
    if (!this.incidentRulesCollection) await this.initialize();
    
    try {
      const objectId = new ObjectId(id);
      const { _id, created_at, system_mapping_id, ...updateData } = ruleData;
      
      // If system_mapping_id is being updated, validate it exists
      if (system_mapping_id) {
        const mappingId = new ObjectId(system_mapping_id);
        const mapping = await this.systemMappingsCollection.findOne({ _id: mappingId });
        if (!mapping) {
          throw new Error('System mapping not found');
        }
        updateData.system_mapping_id = mappingId;
        updateData.grafana_name = mapping.grafana_name;
      }
      if (updateData.incident_overrides) {
        updateData.incident_overrides = this._sanitizeIncidentOverrides(updateData.incident_overrides);
      }
      
      const result = await this.incidentRulesCollection.updateOne(
        { _id: objectId },
        { $set: { ...updateData, updated_at: new Date() } }
      );

      if (result.matchedCount === 0) {
        throw new Error('Incident rule not found');
      }

      return await this.incidentRulesCollection.findOne({ _id: objectId });
    } catch (error) {
      console.error('Error updating incident rule:', error);
      throw error;
    }
  }

  async deleteIncidentRule(id) {
    if (!this.incidentRulesCollection) await this.initialize();
    
    try {
      const objectId = new ObjectId(id);
      const result = await this.incidentRulesCollection.deleteOne({ _id: objectId });
      
      if (result.deletedCount === 0) {
        throw new Error('Incident rule not found');
      }

      return { message: 'Incident rule deleted successfully' };
    } catch (error) {
      console.error('Error deleting incident rule:', error);
      throw error;
    }
  }

  async toggleIncidentRule(id, enabled) {
    if (!this.incidentRulesCollection) await this.initialize();
    
    try {
      const objectId = new ObjectId(id);
      const result = await this.incidentRulesCollection.updateOne(
        { _id: objectId },
        { $set: { enabled, updated_at: new Date() } }
      );

      if (result.matchedCount === 0) {
        throw new Error('Incident rule not found');
      }

      return { message: `Incident rule ${enabled ? 'enabled' : 'disabled'} successfully` };
    } catch (error) {
      console.error('Error toggling incident rule:', error);
      throw error;
    }
  }

  // ================== ENHANCED INCIDENT CREATION ==================

  // Helper method to check if alert matches rule conditions
  _doesAlertMatchRule(alertData, rule) {
    const { conditions } = rule;
    const { message, node_name, object_name, network } = alertData;
    
    // Check message conditions
    if (conditions.message_exact && message !== conditions.message_exact) {
      return false;
    }
    
    if (conditions.message_regex) {
      try {
        const regex = new RegExp(conditions.message_regex.replace(/^\/|\/[gimuy]*$/g, ''), 'i');
        if (!regex.test(message)) return false;
      } catch (e) {
        console.warn('Invalid regex in rule:', conditions.message_regex);
        return false;
      }
    }
    
    if (conditions.message_contains && Array.isArray(conditions.message_contains)) {
      const hasMatch = conditions.message_contains.some(term => 
        message.toLowerCase().includes(term.toLowerCase())
      );
      if (!hasMatch) return false;
    }
    
    // Check node name conditions
    if (conditions.node_name_contains && Array.isArray(conditions.node_name_contains)) {
      const hasMatch = conditions.node_name_contains.some(term => 
        node_name.toLowerCase().includes(term.toLowerCase())
      );
      if (!hasMatch) return false;
    }
    
    // Check object name conditions
    if (conditions.object_name_contains && Array.isArray(conditions.object_name_contains)) {
      const hasMatch = conditions.object_name_contains.some(term => 
        object_name.toLowerCase().includes(term.toLowerCase())
      );
      if (!hasMatch) return false;
    }
    
    // Check network condition
    if (conditions.network && network !== conditions.network) {
      return false;
    }
    
    return true;
  }

  // Helper method to replace template variables
  _replaceTemplateVariables(template, alertData) {
    if (!template || typeof template !== 'string') return template;
    
    return template
      .replace(/\{\{application\}\}/g, alertData.application || '')
      .replace(/\{\{object_name\}\}/g, alertData.object_name || '')
      .replace(/\{\{node_name\}\}/g, alertData.node_name || '')
      .replace(/\{\{message\}\}/g, alertData.message || '')
      .replace(/\{\{time_created\}\}/g, alertData.time_created || '')
      .replace(/\{\{operator\}\}/g, alertData.operator || '')
      .replace(/\{\{network\}\}/g, alertData.network || '');
  }

  // Enhanced incident creation with rule support
   async createIncidentFromAlert(alertData) {
    try {
      const { application } = alertData;
      
      // First, try to find matching rules for this application
      const rules = await this.getIncidentRules(application);
      const enabledRules = rules.filter(rule => rule.enabled);
      
      // Find the first matching rule (sorted by priority)
      let matchingRule = null;
      for (const rule of enabledRules) {
        if (this._doesAlertMatchRule(alertData, rule)) {
          matchingRule = rule;
          break;
        }
      }
      
      let systemMapping;
      let incidentData;
      
      if (matchingRule) {
        // Use the rule's system mapping and overrides
        systemMapping = matchingRule.system_mapping;
        
        if (!systemMapping) {
          throw new Error(`System mapping not found for rule: ${matchingRule.rule_name}`);
        }
        
        console.log(`Using incident rule: ${matchingRule.rule_name}`);
        
        // Build incident with smart field inheritance
        const cleanedOverrides = this._sanitizeIncidentOverrides(matchingRule.incident_overrides);
        incidentData = this._buildIncidentData(systemMapping, cleanedOverrides, alertData);
        
        // Add rule metadata
        incidentData.matched_rule_id = matchingRule._id;
        incidentData.matched_rule_name = matchingRule.rule_name;
        
      } else {
        // Fallback to basic system mapping
        systemMapping = await this.getMappingByApplication(application);
        
        if (!systemMapping) {
          throw new Error(`No system mapping or incident rules found for application: ${application}`);
        }
        
        console.log(`Using basic system mapping for: ${application}`);
        
        // Build incident with smart field inheritance (no overrides)
        incidentData = this._buildIncidentData(systemMapping, {}, alertData);
      }
      
      // Add common metadata
      incidentData.source_application = alertData.application;
      incidentData.alert_time = alertData.time_created;
      incidentData.grafana_operator = alertData.operator;
      incidentData.created_at = new Date();
      
      // TODO: Integrate with ServiceNow API here
      console.log('Creating incident with data:', JSON.stringify(incidentData, null, 2));
      
      return incidentData;
      
    } catch (error) {
      console.error('Error creating incident from alert:', error);
      throw error;
    }
  }

  async getDistinctValues(fieldName) {
    if (!this.systemMappingsCollection) await this.initialize();
    
    try {
      const values = await this.systemMappingsCollection.distinct(fieldName);
      return values.filter(v => v != null && v !== '');
    } catch (error) {
      console.error(`Error fetching distinct values for ${fieldName}:`, error);
      throw error;
    }
  }
}

module.exports = new IncidentService();
