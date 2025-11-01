// services/incidentService.js - Simplified without _custom_required_fields
const { getMongoDb } = require('../database/connection');
const { mongoConfig } = require('../config');
const { ObjectId } = require('mongodb');
const axios = require('axios');

class IncidentService {
  constructor() {
    this.systemMappingsCollection = null;
    this.incidentRulesCollection = null;

    // ServiceNow configuration
    this.serviceNowUrl = process.env.SERVICENOW_URL;
    this.serviceNowUsername = process.env.SERVICENOW_USERNAME;
    this.serviceNowPassword = process.env.SERVICENOW_PASSWORD;
    this.serviceNowEnabled = Boolean(this.serviceNowUrl);
    
    // Cache for assignment groups
    this.assignmentGroupsCache = null;
    this.assignmentGroupsCacheTime = null;
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  async initialize() {
    const db = getMongoDb();
    this.systemMappingsCollection = db.collection(mongoConfig.collections.systemMappings);
    this.incidentRulesCollection = db.collection('incident_rules');
    
    try {
      await this.systemMappingsCollection.createIndex({ grafana_name: 1 }, { unique: true });
      await this.incidentRulesCollection.createIndex({ grafana_name: 1 });
      await this.incidentRulesCollection.createIndex({ enabled: 1 });
    } catch (error) {
      console.warn('Index creation warning:', error.message);
    }
  }

  _parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return Boolean(value);
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

  // ================== ASSIGNMENT GROUPS FROM SERVICENOW (WITH CACHING) ==================

  async getAssignmentGroups() {
    if (!this.serviceNowEnabled) {
      return [];
    }

    // Check cache
    const now = Date.now();
    if (this.assignmentGroupsCache && 
        this.assignmentGroupsCacheTime && 
        (now - this.assignmentGroupsCacheTime) < this.CACHE_TTL) {
      console.log('Returning cached assignment groups');
      return this.assignmentGroupsCache;
    }

    try {
      console.log('Fetching fresh assignment groups from ServiceNow...');
      const response = await axios({
        method: 'GET',
        url: `${this.serviceNowUrl}/api/now/table/sys_user_group`,
        params: {
          sysparm_query: 'active=true',
          sysparm_fields: 'sys_id,name',
          sysparm_limit: 1000
        },
        headers: {
          'Accept': 'application/json'
        },
        auth: {
          username: this.serviceNowUsername,
          password: this.serviceNowPassword
        },
        timeout: 10000
      });
      
      const groups = response.data.result.map(group => ({
        value: group.sys_id,
        label: group.name
      }));

      // Update cache
      this.assignmentGroupsCache = groups;
      this.assignmentGroupsCacheTime = Date.now();
      
      console.log(`Cached ${groups.length} assignment groups`);
      return groups;
    } catch (error) {
      console.error('Error fetching assignment groups:', error.message);
      // Return cached data if available, even if expired
      if (this.assignmentGroupsCache) {
        console.warn('Using stale cache due to API error');
        return this.assignmentGroupsCache;
      }
      return [];
    }
  }

  // ================== INCIDENT BUILDING WITH CUSTOM FIELDS ==================
  
  _buildIncidentData(systemMapping, ruleOverrides = {}, alertData) {
    const baseRequired = ['service_offering', 'business_service', 'u_network', 'assignment_group', 'u_system_failure'];
    const excludeFields = new Set(['_id', 'grafana_name', 'created_at', 'updated_at']);
    
    const incidentData = {};
    
    // 1. Add base required fields
    baseRequired.forEach(field => {
      let value = ruleOverrides[field];
      if (value === undefined) {
        value = systemMapping[field];
      }
      
      if (field === 'u_system_failure') {
        incidentData[field] = this._parseBoolean(value);
      } else if (!value && field !== 'u_system_failure') {
        throw new Error(`Required field '${field}' is missing`);
      } else if (field !== 'u_system_failure') {
        incidentData[field] = value;
      }
    });
    
    // 2. Add all other fields from mapping (including custom fields)
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
          incidentData[key] = this._parseBoolean(value);
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
      // Build description with custom fields if they exist
      let descParts = [
        `Alert Details:`,
        `Application: ${alertData.application}`,
        `Object: ${alertData.object_name}`,
        `Node: ${alertData.node_name}`,
        `Message: ${alertData.message}`,
        `Time: ${alertData.time_created}`,
        `Operator: ${alertData.operator}`,
        `System Failure: ${incidentData.u_system_failure ? 'YES' : 'NO'}`
      ];
      
      // Add custom fields to description
      Object.entries(incidentData).forEach(([key, value]) => {
        if (!baseRequired.includes(key) && 
            !excludeFields.has(key) && 
            !['short_description', 'description', 'u_impact_technology'].includes(key)) {
          descParts.push(`${key.replace(/_/g, ' ')}: ${value}`);
        }
      });
      
      incidentData.description = descParts.join('\n        ');
    }
    
    return incidentData;
  }

  _replaceTemplateVariables(template, alertData) {
    if (!template || typeof template !== 'string') return template;
    
    const validFields = ['application', 'object_name', 'node_name', 'message', 'time_created', 'operator', 'network'];
    let result = template;
    
    // Replace valid template variables
    validFields.forEach(field => {
      const regex = new RegExp(`\\{\\{${field}\\}\\}`, 'g');
      result = result.replace(regex, alertData[field] || '');
    });
    
    // Warn about invalid template variables
    const invalidVars = result.match(/\{\{([^}]+)\}\}/g);
    if (invalidVars) {
      console.warn('Invalid template variables found:', invalidVars.join(', '));
    }
    
    return result;
  }

  // ================== SYSTEM MAPPINGS WITH CUSTOM FIELDS ==================
  
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
      if (!grafanaName || typeof grafanaName !== 'string') {
        throw new Error('Invalid grafana_name');
      }
      
      const mapping = await this.systemMappingsCollection.findOne({ 
        grafana_name: String(grafanaName) 
      });
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

      const dataToInsert = {
        ...mappingData,
        u_system_failure: this._parseBoolean(mappingData.u_system_failure),
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
      
      if ('u_system_failure' in updateData) {
        updateData.u_system_failure = this._parseBoolean(updateData.u_system_failure);
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

      this._validateRuleConditions(ruleData.conditions);

      if (ruleData.incident_overrides?.u_system_failure !== undefined) {
        ruleData.incident_overrides.u_system_failure = this._parseBoolean(ruleData.incident_overrides.u_system_failure);
      }

      const dataToInsert = {
        ...ruleData,
        system_mapping_id: mappingId,
        grafana_name: mapping.grafana_name,
        logic_operator: ruleData.logic_operator || 'OR',
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

  _validateRuleConditions(conditions) {
    const regexFields = ['message_regex', 'node_name_regex', 'object_name_regex', 'network_regex', 'operator_regex'];
    
    regexFields.forEach(field => {
      if (conditions[field]) {
        try {
          new RegExp(conditions[field]);
        } catch (e) {
          throw new Error(`Invalid regex pattern in ${field}: ${e.message}`);
        }
      }
    });
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

      if (updateData.conditions) {
        this._validateRuleConditions(updateData.conditions);
      }

      if (updateData.incident_overrides?.u_system_failure !== undefined) {
        updateData.incident_overrides.u_system_failure = this._parseBoolean(updateData.incident_overrides.u_system_failure);
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

  // ================== RULE MATCHING - MOST CONDITIONS WINS ==================

  _calculateRuleSpecificity(rule) {
    const { conditions } = rule;
    let score = 0;
    
    const weights = {
      exact: 10,
      regex: 7,
      contains: 3
    };
    
    Object.keys(conditions).forEach(key => {
      if (key.endsWith('_exact')) score += weights.exact;
      else if (key.endsWith('_regex')) score += weights.regex;
      else if (key.endsWith('_contains')) {
        score += weights.contains * (conditions[key]?.length || 1);
      }
    });
    
    return score;
  }

  _checkFieldConditions(value, conditions, fieldPrefix) {
    const results = [];
    
    if (conditions[`${fieldPrefix}_contains`]?.length) {
      conditions[`${fieldPrefix}_contains`].forEach(term => {
        results.push(value && value.toLowerCase().includes(term.toLowerCase()));
      });
    }
    
    if (conditions[`${fieldPrefix}_exact`]) {
      results.push(value && value.toLowerCase() === conditions[`${fieldPrefix}_exact`].toLowerCase());
    }
    
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

    const evaluateFieldResults = (results, fieldName) => {
      if (results.length === 0) return null;
      
      if (logic_operator === 'AND' && results.length > 1) {
        return results.every(result => result === true);
      }
      return results.some(result => result === true);
    };

    const messageResults = this._checkFieldConditions(message, conditions, 'message');
    const messageMatch = evaluateFieldResults(messageResults, 'message');
    if (messageMatch !== null) conditionGroups.push(messageMatch);

    const nodeResults = this._checkFieldConditions(node_name, conditions, 'node_name');
    const nodeMatch = evaluateFieldResults(nodeResults, 'node_name');
    if (nodeMatch !== null) conditionGroups.push(nodeMatch);

    const objectResults = this._checkFieldConditions(object_name, conditions, 'object_name');
    const objectMatch = evaluateFieldResults(objectResults, 'object_name');
    if (objectMatch !== null) conditionGroups.push(objectMatch);

    const networkResults = this._checkFieldConditions(network, conditions, 'network');
    const networkMatch = evaluateFieldResults(networkResults, 'network');
    if (networkMatch !== null) {
      conditionGroups.push(networkMatch);
    } else if (conditions.network) {
      const networkMatches = network && network.toLowerCase().includes(conditions.network.toLowerCase());
      conditionGroups.push(networkMatches);
    }

    const operatorResults = this._checkFieldConditions(operator, conditions, 'operator');
    const operatorMatch = evaluateFieldResults(operatorResults, 'operator');
    if (operatorMatch !== null) conditionGroups.push(operatorMatch);

    if (conditionGroups.length === 0) return false;

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
      
      const rules = await this.getIncidentRules(application);
      const enabledRules = rules
        .filter(rule => rule.enabled)
        .sort((a, b) => {
          const scoreA = this._calculateRuleSpecificity(a);
          const scoreB = this._calculateRuleSpecificity(b);
          if (scoreA !== scoreB) return scoreB - scoreA;
          return new Date(b.created_at) - new Date(a.created_at);
        });
      
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
        
        console.log(`Using incident rule: ${matchingRule.rule_name} (specificity: ${this._calculateRuleSpecificity(matchingRule)})`);
        incidentData = this._buildIncidentData(systemMapping, matchingRule.incident_overrides, alertData);
        
        incidentData.matched_rule_id = matchingRule._id;
        incidentData.matched_rule_name = matchingRule.rule_name;
        incidentData.matched_rule_logic = matchingRule.logic_operator || 'OR';
        
      } else {
        systemMapping = await this.getMappingByApplication(application);
        
        if (!systemMapping) {
          throw new Error(`No system mapping or incident rules found for application: ${application}`);
        }
        
        console.log(`Using basic system mapping for: ${application}`);
        incidentData = this._buildIncidentData(systemMapping, {}, alertData);
      }
      
      console.log('Creating incident with data:', JSON.stringify(incidentData, null, 2));
      
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