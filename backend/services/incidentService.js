// services/incidentService.js - Simplified and cleaned version
const { getMongoDb } = require('../database/connection');
const { mongoConfig } = require('../config');
const { ObjectId } = require('mongodb');

class IncidentService {
  constructor() {
    this.systemMappingsCollection = null;
    this.incidentRulesCollection = null;
    this.requiredFieldsCollection = null;
  }

  async initialize() {
    const db = getMongoDb();
    this.systemMappingsCollection = db.collection(mongoConfig.collections.systemMappings);
    this.incidentRulesCollection = db.collection('incident_rules');
    this.requiredFieldsCollection = db.collection('service_offering_required_fields');
  }

  // ================== REQUIRED FIELDS MANAGEMENT ==================

  async getRequiredFieldsForServiceOffering(serviceOffering) {
    // Base required fields that are always mandatory
    const baseRequired = ['grafana_name', 'service_offering', 'business_service', 'u_network', 'assignment_group'];
    
    if (!this.requiredFieldsCollection) await this.initialize();

    try {
      const doc = await this.requiredFieldsCollection.findOne({ service_offering: serviceOffering });
      const additionalFromStore = Array.isArray(doc?.fields) ? doc.fields : [];

      // Also get fields from existing mappings with this service offering
      const mappings = await this.systemMappingsCollection
        .find({ service_offering: serviceOffering })
        .toArray();

      const mappingFields = new Set();
      mappings.forEach(mapping => {
        Object.keys(mapping || {}).forEach(key => {
          if (!['_id', 'created_at', 'updated_at'].includes(key)) {
            mappingFields.add(key);
          }
        });
      });

      const allRequired = Array.from(new Set([
        ...baseRequired, 
        ...additionalFromStore, 
        ...mappingFields
      ]));

      return { 
        baseRequired, 
        additionalRequired: additionalFromStore, 
        allRequired 
      };
    } catch (error) {
      console.error('Error fetching required fields:', error);
      return { baseRequired, additionalRequired: [], allRequired: baseRequired };
    }
  }

  async setRequiredFieldsForServiceOffering(serviceOffering, fields) {
    if (!this.requiredFieldsCollection) await this.initialize();
    
    try {
      const cleanFields = Array.from(new Set(
        (fields || []).map(f => String(f).trim()).filter(Boolean)
      ));

      await this.requiredFieldsCollection.updateOne(
        { service_offering: serviceOffering },
        { 
          $set: { 
            service_offering: serviceOffering, 
            fields: cleanFields, 
            updated_at: new Date() 
          }, 
          $setOnInsert: { created_at: new Date() } 
        },
        { upsert: true }
      );

      return { service_offering: serviceOffering, fields: cleanFields };
    } catch (error) {
      console.error('Error setting required fields:', error);
      throw error;
    }
  }

  // ================== INCIDENT BUILDING ==================
  
  _buildIncidentData(systemMapping, ruleOverrides = {}, alertData) {
    const baseRequired = ['service_offering', 'business_service', 'u_network', 'assignment_group'];
    const excludeFields = new Set(['_id', 'grafana_name', 'created_at', 'updated_at']);
    
    const incidentData = {};
    
    // 1. Add base required fields first
    baseRequired.forEach(field => {
      const value = ruleOverrides[field] || systemMapping[field];
      if (!value) {
        throw new Error(`Required field '${field}' is missing`);
      }
      incidentData[field] = value;
    });
    
    // 2. Add other fields from mapping
    Object.entries(systemMapping).forEach(([key, value]) => {
      if (!excludeFields.has(key) && 
          !baseRequired.includes(key) && 
          value != null && 
          String(value).trim() !== '') {
        incidentData[key] = value;
      }
    });
    
    // 3. Apply rule overrides
    Object.entries(ruleOverrides).forEach(([key, value]) => {
      if (!excludeFields.has(key) && 
          value != null && 
          String(value).trim() !== '') {
        incidentData[key] = this._replaceTemplateVariables(value, alertData);
      }
    });
    
    // 4. Add default descriptions if not provided
    if (!incidentData.short_description) {
      incidentData.short_description = `Alert: ${alertData.object_name} - ${alertData.application}`;
    }
    
    if (!incidentData.description) {
      incidentData.description = `Alert Details:
Application: ${alertData.application}
Object: ${alertData.object_name}
Node: ${alertData.node_name}
Message: ${alertData.message}
Time: ${alertData.time_created}
Operator: ${alertData.operator}`;
    }
    
    return incidentData;
  }

  _replaceTemplateVariables(template, alertData) {
    if (!template || typeof template !== 'string') return template;
    
    return template
      .replace(/\{\{application\}\}/g, alertData.application || '')
      .replace(/\{\{object_name\}\}/g, alertData.object_name || '')
      .replace(/\{\{node_name\}\}/g, alertData.node_name || '')
      .replace(/\{\{message\}\}/g, alertData.message || '')
      .replace(/\{\{time_created\}\}/g, alertData.time_created || '')
      .replace(/\{\{operator\}\}/g, alertData.operator || '');
  }

  // ================== SYSTEM MAPPINGS ==================
  
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

      const existing = await this.systemMappingsCollection.findOne({ 
        grafana_name: mappingData.grafana_name 
      });
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
      
      // Check if rules depend on this mapping
      const rulesCount = await this.incidentRulesCollection.countDocuments({ 
        system_mapping_id: objectId 
      });
      
      if (rulesCount > 0) {
        throw new Error(`Cannot delete mapping. ${rulesCount} incident rules depend on it.`);
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

  // ================== INCIDENT RULES ==================

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
      const mappingId = new ObjectId(ruleData.system_mapping_id);
      const mapping = await this.systemMappingsCollection.findOne({ _id: mappingId });
      
      if (!mapping) {
        throw new Error('System mapping not found');
      }

      const result = await this.incidentRulesCollection.insertOne({
        ...ruleData,
        system_mapping_id: mappingId,
        grafana_name: mapping.grafana_name,
        created_at: new Date(),
        updated_at: new Date()
      });

      return { _id: result.insertedId, ...ruleData };
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
      
      if (system_mapping_id) {
        const mappingId = new ObjectId(system_mapping_id);
        const mapping = await this.systemMappingsCollection.findOne({ _id: mappingId });
        if (!mapping) {
          throw new Error('System mapping not found');
        }
        updateData.system_mapping_id = mappingId;
        updateData.grafana_name = mapping.grafana_name;
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

  // ================== RULE MATCHING ==================

  _doesAlertMatchRule(alertData, rule) {
    const { conditions } = rule;
    const { message, node_name, object_name } = alertData;
    
    // Check message conditions
    if (conditions.message_contains && Array.isArray(conditions.message_contains)) {
      const hasMatch = conditions.message_contains.some(term => 
        message.toLowerCase().includes(term.toLowerCase())
      );
      if (!hasMatch) return false;
    }
    
    if (conditions.message_regex) {
      try {
        const regex = new RegExp(conditions.message_regex, 'i');
        if (!regex.test(message)) return false;
      } catch (e) {
        console.warn('Invalid regex in rule:', conditions.message_regex);
        return false;
      }
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
    
    return true;
  }

  // ================== INCIDENT CREATION ==================

  async createIncidentFromAlert(alertData) {
    try {
      const { application } = alertData;
      
      // Find matching rules for this application
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
        systemMapping = matchingRule.system_mapping;
        
        if (!systemMapping) {
          throw new Error(`System mapping not found for rule: ${matchingRule.rule_name}`);
        }
        
        console.log(`Using incident rule: ${matchingRule.rule_name}`);
        incidentData = this._buildIncidentData(systemMapping, matchingRule.incident_overrides, alertData);
        
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
        incidentData = this._buildIncidentData(systemMapping, {}, alertData);
      }
      
      // Add common metadata
      incidentData.source_application = alertData.application;
      incidentData.alert_time = alertData.time_created;
      incidentData.grafana_operator = alertData.operator;
      incidentData.created_at = new Date();
      
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