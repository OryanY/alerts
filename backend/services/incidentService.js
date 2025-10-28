// services/incidentService.js - Updated with u_system_failure support and improved logic
const { getMongoDb } = require('../database/connection');
const { mongoConfig } = require('../config');
const { ObjectId } = require('mongodb');

class IncidentService {
  constructor() {
    this.systemMappingsCollection = null;
    this.incidentRulesCollection = null;

    // ServiceNow configuration
    this.serviceNowUrl = process.env.SERVICENOW_URL;
    this.serviceNowUsername = process.env.SERVICENOW_USERNAME;
    this.serviceNowPassword = process.env.SERVICENOW_PASSWORD;
  }

  async initialize() {
    const db = getMongoDb();
    this.systemMappingsCollection = db.collection(mongoConfig.collections.systemMappings);
    this.incidentRulesCollection = db.collection('incident_rules');
  }

   async _sendToServiceNow(incidentData) {
    if (!this.serviceNowEnabled || !this.serviceNowUrl) {
      console.log('ServiceNow integration disabled or not configured');
      return { 
        success: false, 
        message: 'ServiceNow integration disabled' 
      };
    }

    try {
      console.log('Sending to ServiceNow:', JSON.stringify(incidentData, null, 2));
      
      const response = await axios({
        method: 'POST',
        url: `${this.serviceNowUrl}/api/now/table/incident`,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        auth: {
          username: this.serviceNowUsername,
          password: this.serviceNowPassword
        },
        data: incidentData,
        timeout: 10000
      });

      console.log('ServiceNow incident created:', response.data.result.number);

      return {
        success: true,
        incident_number: response.data.result.number,
        sys_id: response.data.result.sys_id,
        link: `${this.serviceNowUrl}/nav_to.do?uri=incident.do?sys_id=${response.data.result.sys_id}`
      };
      
    } catch (error) {
      console.error('ServiceNow API Error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        status: error.response?.status
      };
    }
  }

  // ================== INCIDENT BUILDING ==================
  
  _buildIncidentData(systemMapping, ruleOverrides = {}, alertData) {
    const baseRequired = ['service_offering', 'business_service', 'u_network', 'assignment_group', 'u_system_failure'];
    const excludeFields = new Set(['_id', 'grafana_name', 'created_at', 'updated_at']);
    
    const incidentData = {};
    
    // 1. Add base required fields first
    baseRequired.forEach(field => {
      let value = ruleOverrides[field];
      if (value === undefined) {
        value = systemMapping[field];
      }
      
      // Special handling for u_system_failure boolean
      if (field === 'u_system_failure') {
        incidentData[field] = Boolean(value);
      } else if (!value && field !== 'u_system_failure') {
        throw new Error(`Required field '${field}' is missing`);
      } else if (field !== 'u_system_failure') {
        incidentData[field] = value;
      }
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
    
    // 3. Apply rule overrides with template replacement
    Object.entries(ruleOverrides).forEach(([key, value]) => {
      if (!excludeFields.has(key)) {
        if (key === 'u_system_failure') {
          incidentData[key] = Boolean(value);
        } else if (value != null && String(value).trim() !== '') {
          incidentData[key] = this._replaceTemplateVariables(value, alertData);
        }
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
Operator: ${alertData.operator}
System Failure: ${incidentData.u_system_failure ? 'YES' : 'NO'}`;
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
      .replace(/\{\{operator\}\}/g, alertData.operator || '')
      .replace(/\{\{network\}\}/g, alertData.network || '');
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

      // Ensure u_system_failure is properly handled
      const dataToInsert = {
        ...mappingData,
        u_system_failure: Boolean(mappingData.u_system_failure),
        created_at: new Date(),
        updated_at: new Date()
      };

      const result = await this.systemMappingsCollection.insertOne(dataToInsert);

      return { _id: result.insertedId, ...dataToInsert };
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
      
      // Ensure u_system_failure is properly handled
      if ('u_system_failure' in updateData) {
        updateData.u_system_failure = Boolean(updateData.u_system_failure);
      }
      
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
          { $sort: { created_at: -1 } }
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

      if (ruleData.incident_overrides?.u_system_failure !== undefined) {
        ruleData.incident_overrides.u_system_failure = Boolean(ruleData.incident_overrides.u_system_failure);
      }

      const dataToInsert = {
        ...ruleData,
        system_mapping_id: mappingId,
        grafana_name: mapping.grafana_name,
        logic_operator: ruleData.logic_operator || 'OR', // Use consistent field name
        created_at: new Date(),
        updated_at: new Date()
      };

      const result = await this.incidentRulesCollection.insertOne(dataToInsert);
      return { _id: result.insertedId, ...dataToInsert };
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

      // Ensure u_system_failure in overrides is properly handled
      if (updateData.incident_overrides?.u_system_failure !== undefined) {
        updateData.incident_overrides.u_system_failure = Boolean(updateData.incident_overrides.u_system_failure);
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

  // ================== IMPROVED RULE MATCHING WITH AND/OR LOGIC ==================

  _checkFieldConditions(value, conditions, fieldPrefix) {
    const results = [];
    
    // Contains conditions
    if (conditions[`${fieldPrefix}_contains`]?.length) {
      conditions[`${fieldPrefix}_contains`].forEach(term => {
        results.push(value && value.toLowerCase().includes(term.toLowerCase()));
      });
    }
    
    // Exact match conditions
    if (conditions[`${fieldPrefix}_exact`]) {
      results.push(value && value.toLowerCase() === conditions[`${fieldPrefix}_exact`].toLowerCase());
    }
    
    // Regex conditions
    if (conditions[`${fieldPrefix}_regex`]) {
      try {
        const regex = new RegExp(conditions[`${fieldPrefix}_regex`], 'i');
        results.push(value && regex.test(value));
      } catch (e) {
        console.warn(`Invalid regex in rule for ${fieldPrefix}:`, conditions[`${fieldPrefix}_regex`]);
        results.push(false);
      }
    }
    
    return results;
  }
_doesAlertMatchRule(alertData, rule) {
  const { conditions, logic_operator = 'OR' } = rule;
  const { message, node_name, object_name, network, operator } = alertData;
  
  const conditionGroups = [];

  // Helper function to evaluate field results based on logic operator
  const evaluateFieldResults = (results, fieldName) => {
    if (results.length === 0) return null;
    
    // For AND logic with multiple conditions, ALL must match
    if (logic_operator === 'AND' && results.length > 1) {
      return results.every(result => result === true);
    }
    // For OR logic or single conditions, ANY can match
    return results.some(result => result === true);
  };

  // Message conditions
  const messageResults = this._checkFieldConditions(message, conditions, 'message');
  const messageMatch = evaluateFieldResults(messageResults, 'message');
  if (messageMatch !== null) {
    conditionGroups.push(messageMatch);
  }

  // Node name conditions
  const nodeResults = this._checkFieldConditions(node_name, conditions, 'node_name');
  const nodeMatch = evaluateFieldResults(nodeResults, 'node_name');
  if (nodeMatch !== null) {
    conditionGroups.push(nodeMatch);
  }

  // Object name conditions  
  const objectResults = this._checkFieldConditions(object_name, conditions, 'object_name');
  const objectMatch = evaluateFieldResults(objectResults, 'object_name');
  if (objectMatch !== null) {
    conditionGroups.push(objectMatch);
  }

  // Network conditions
  const networkResults = this._checkFieldConditions(network, conditions, 'network');
  const networkMatch = evaluateFieldResults(networkResults, 'network');
  if (networkMatch !== null) {
    conditionGroups.push(networkMatch);
  } else if (conditions.network) {
    // Legacy network condition support
    const networkMatches = network && network.toLowerCase().includes(conditions.network.toLowerCase());
    conditionGroups.push(networkMatches);
  }

  // Operator conditions
  const operatorResults = this._checkFieldConditions(operator, conditions, 'operator');
  const operatorMatch = evaluateFieldResults(operatorResults, 'operator');
  if (operatorMatch !== null) {
    conditionGroups.push(operatorMatch);
  }

  if (conditionGroups.length === 0) {
    return false;
  }

  // Apply the main logic operator to condition groups
  if (logic_operator === 'AND') {
    return conditionGroups.every(result => result === true);
  } else {
    return conditionGroups.some(result => result === true);
  }
}


  // ================== INCIDENT CREATION ==================

  async createIncidentFromAlert(alertData) {
    try {
      const { application } = alertData;
      
      // Find matching rules for this application
      const rules = await this.getIncidentRules(application);
      const enabledRules = rules
        .filter(rule => rule.enabled)
        .sort((a, b) => {
          const countA = Object.keys(a.conditions || {}).length;
          const countB = Object.keys(b.conditions || {}).length;
          if (countA !== countB) return countB - countA;
          return new Date(b.created_at) - new Date(a.created_at);
        });      
      // Find the first matching rule (sorted by creation date - newest first)
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
        
        console.log(`Using incident rule: ${matchingRule.rule_name} (${matchingRule.logic_operator || 'OR'} logic)`);
        incidentData = this._buildIncidentData(systemMapping, matchingRule.incident_overrides, alertData);
        
        // Add rule metadata
        incidentData.matched_rule_id = matchingRule._id;
        incidentData.matched_rule_name = matchingRule.rule_name;
        incidentData.matched_rule_logic = matchingRule.logic_operator || 'OR';
        
      } else {
        // Fallback to basic system mapping
        systemMapping = await this.getMappingByApplication(application);
        
        if (!systemMapping) {
          throw new Error(`No system mapping or incident rules found for application: ${application}`);
        }
        
        console.log(`Using basic system mapping for: ${application}`);
        incidentData = this._buildIncidentData(systemMapping, {}, alertData);
      }
      
      console.log('Creating incident with data:', JSON.stringify(incidentData, null, 2));
      
      // Send to ServiceNow
      const serviceNowResult = await this._sendToServiceNow(incidentData);
      
      return {
        incidentData,
        serviceNowResult
      };
      
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