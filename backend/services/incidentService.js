// services/incidentService.js - Support multiple Grafana names per mapping
const { getMongoDb } = require('../database/connection');
const { mongoConfig } = require('../config');
const { ObjectId } = require('mongodb');
const axios = require('axios');

class IncidentService {
  constructor() {
    this.systemMappingsCollection = null;
    this.incidentRulesCollection = null;
    this.serviceNowUrl = process.env.SERVICENOW_URL;
    this.serviceNowUsername = process.env.SERVICENOW_USERNAME;
    this.serviceNowPassword = process.env.SERVICENOW_PASSWORD;
    this.serviceNowEnabled = Boolean(this.serviceNowUrl);
    this.assignmentGroupsCache = null;
    this.assignmentGroupsCacheTime = null;
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  }

  async initialize() {
    const db = getMongoDb();
    this.systemMappingsCollection = db.collection(mongoConfig.collections.systemMappings);
    this.incidentRulesCollection = db.collection('incident_rules');
    
    try {
      // Create index on grafana_names array
      await this.systemMappingsCollection.createIndex({ grafana_names: 1 });
      await this.incidentRulesCollection.createIndex({ grafana_names: 1 });
      await this.incidentRulesCollection.createIndex({ enabled: 1 });
      console.log('✅ Database indexes created successfully');
    } catch (error) {
      console.warn('⚠️  Index creation warning:', error.message);
    }
  }

  // ================== UTILITY METHODS ==================

  _parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return Boolean(value);
  }

  _sanitizeGrafanaNames(names) {
    if (!names) return [];
    
    // Handle both string (comma-separated) and array inputs
    let namesArray = Array.isArray(names) ? names : names.split(',');
    
    // Clean, deduplicate, and sort
    return [...new Set(
      namesArray
        .map(name => String(name).trim().toLowerCase())
        .filter(name => name.length > 0)
    )].sort();
  }

  _validateGrafanaNames(names) {
    const sanitized = this._sanitizeGrafanaNames(names);
    
    if (sanitized.length === 0) {
      throw new Error('At least one Grafana application name is required');
    }

    // Check for invalid characters
    const invalidNames = sanitized.filter(name => 
      /[^a-z0-9_-]/.test(name)
    );
    
    if (invalidNames.length > 0) {
      throw new Error(
        `Invalid Grafana names (only lowercase letters, numbers, hyphens, and underscores allowed): ${invalidNames.join(', ')}`
      );
    }

    return sanitized;
  }

  // ================== SERVICENOW INTEGRATION ==================

  async _sendToServiceNow(incidentData) {
    if (!this.serviceNowEnabled || !this.serviceNowUrl) {
      console.log('❌ ServiceNow integration disabled or not configured');
      return { success: false, message: 'ServiceNow integration disabled' };
    }

    try {
      console.log('📤 Sending to ServiceNow:', JSON.stringify(incidentData, null, 2));
      
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

      console.log('✅ ServiceNow incident created:', response.data.result.number);

      return {
        success: true,
        incident_number: response.data.result.number,
        sys_id: response.data.result.sys_id,
        link: `${this.serviceNowUrl}/nav_to.do?uri=incident.do?sys_id=${response.data.result.sys_id}`
      };
      
    } catch (error) {
      console.error('❌ ServiceNow API Error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.error?.message || error.message,
        status: error.response?.status
      };
    }
  }

  async getAssignmentGroups() {
    if (!this.serviceNowEnabled) {
      return [];
    }

    const now = Date.now();
    if (this.assignmentGroupsCache && 
        this.assignmentGroupsCacheTime && 
        (now - this.assignmentGroupsCacheTime) < this.CACHE_TTL) {
      return this.assignmentGroupsCache;
    }

    try {
      const response = await axios({
        method: 'GET',
        url: `${this.serviceNowUrl}/api/now/table/sys_user_group`,
        params: {
          sysparm_query: 'active=true',
          sysparm_fields: 'sys_id,name',
          sysparm_limit: 1000
        },
        headers: { 'Accept': 'application/json' },
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

      this.assignmentGroupsCache = groups;
      this.assignmentGroupsCacheTime = Date.now();
      
      console.log(`✅ Cached ${groups.length} assignment groups`);
      return groups;
    } catch (error) {
      console.error('❌ Error fetching assignment groups:', error.message);
      if (this.assignmentGroupsCache) {
        console.warn('⚠️  Using stale cache due to API error');
        return this.assignmentGroupsCache;
      }
      return [];
    }
  }

  // ================== INCIDENT BUILDING ==================
  
  _replaceTemplateVariables(template, alertData) {
    if (!template || typeof template !== 'string') return template;
    
    const validFields = ['application', 'object_name', 'node_name', 'message', 'time_created', 'operator', 'network'];
    let result = template;
    
    validFields.forEach(field => {
      const regex = new RegExp(`\\{\\{${field}\\}\\}`, 'g');
      result = result.replace(regex, alertData[field] || '');
    });
    
    return result;
  }

  _buildIncidentData(systemMapping, ruleOverrides = {}, alertData) {
    const baseRequired = ['service_offering', 'business_service', 'u_network', 'assignment_group', 'u_system_failure'];
    const excludeFields = new Set(['_id', 'grafana_names', 'created_at', 'updated_at']);
    
    const incidentData = {};
    
    // 1. Add base required fields
    baseRequired.forEach(field => {
      let value = ruleOverrides[field] !== undefined ? ruleOverrides[field] : systemMapping[field];
      
      if (field === 'u_system_failure') {
        incidentData[field] = this._parseBoolean(value);
      } else if (!value && field !== 'u_system_failure') {
        throw new Error(`Required field '${field}' is missing`);
      } else if (field !== 'u_system_failure') {
        incidentData[field] = value;
      }
    });
    
    // 2. Add all custom fields from mapping
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
      const descParts = [
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

  // ================== SYSTEM MAPPINGS (MULTIPLE GRAFANA NAMES) ==================
  
  async getSystemMappings() {
    if (!this.systemMappingsCollection) await this.initialize();
    
    try {
      const mappings = await this.systemMappingsCollection.find({}).toArray();
      return mappings;
    } catch (error) {
      console.error('❌ Error fetching system mappings:', error);
      throw new Error('Failed to fetch system mappings');
    }
  }

  async getMappingByApplication(grafanaName) {
    if (!this.systemMappingsCollection) await this.initialize();
    
    try {
      if (!grafanaName || typeof grafanaName !== 'string') {
        throw new Error('Invalid grafana_name');
      }
      
      const normalizedName = grafanaName.trim().toLowerCase();
      
      // Find mapping where grafana_names array contains this name
      const mapping = await this.systemMappingsCollection.findOne({ 
        grafana_names: normalizedName
      });
      
      return mapping;
    } catch (error) {
      console.error('❌ Error fetching mapping by application:', error);
      throw new Error('Failed to fetch mapping');
    }
  }

  async createSystemMapping(mappingData) {
    if (!this.systemMappingsCollection) await this.initialize();
    
    try {
      // Handle backward compatibility - convert grafana_name to grafana_names
      let namesToUse = mappingData.grafana_names;
      
      if (!namesToUse && mappingData.grafana_name) {
        namesToUse = mappingData.grafana_name;
        console.log('⚠️  Converting old grafana_name format to grafana_names');
      }
      
      if (!namesToUse) {
        throw new Error('Either grafana_name or grafana_names must be provided');
      }

      // Validate and sanitize grafana_names
      const sanitizedNames = this._validateGrafanaNames(namesToUse);

      // Check for existing mappings with any of these names
      const existingMapping = await this.systemMappingsCollection.findOne({
        grafana_names: { $in: sanitizedNames }
      });

      if (existingMapping) {
        const conflictingNames = sanitizedNames.filter(name => 
          existingMapping.grafana_names.includes(name)
        );
        throw new Error(
          `Grafana name(s) already exist in another mapping: ${conflictingNames.join(', ')}`
        );
      }

      const dataToInsert = {
        ...mappingData,
        grafana_names: sanitizedNames,
        u_system_failure: this._parseBoolean(mappingData.u_system_failure),
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // Remove old field if it exists
      delete dataToInsert.grafana_name;

      const result = await this.systemMappingsCollection.insertOne(dataToInsert);

      console.log(`✅ Created system mapping with names: ${sanitizedNames.join(', ')}`);
      return { _id: result.insertedId, ...dataToInsert };
    } catch (error) {
      console.error('❌ Error creating system mapping:', error);
      throw error;
    }
  }

  async updateSystemMapping(id, mappingData) {
    if (!this.systemMappingsCollection) await this.initialize();
    
    try {
      const objectId = new ObjectId(id);
      const { _id, created_at, ...updateData } = mappingData;
      
      // If updating grafana_names, validate and check for conflicts
      if (updateData.grafana_names) {
        const sanitizedNames = this._validateGrafanaNames(updateData.grafana_names);
        
        // Check for conflicts with other mappings (excluding current one)
        const conflictingMapping = await this.systemMappingsCollection.findOne({
          _id: { $ne: objectId },
          grafana_names: { $in: sanitizedNames }
        });

        if (conflictingMapping) {
          const conflictingNames = sanitizedNames.filter(name => 
            conflictingMapping.grafana_names.includes(name)
          );
          throw new Error(
            `Grafana name(s) already exist in another mapping: ${conflictingNames.join(', ')}`
          );
        }

        updateData.grafana_names = sanitizedNames;
      }
      
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

      console.log(`✅ Updated system mapping: ${id}`);
      return await this.systemMappingsCollection.findOne({ _id: objectId });
    } catch (error) {
      console.error('❌ Error updating system mapping:', error);
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

      console.log(`✅ Deleted system mapping: ${id}`);
      return { message: 'System mapping deleted successfully' };
    } catch (error) {
      console.error('❌ Error deleting system mapping:', error);
      throw error;
    }
  }

  // ================== INCIDENT RULES ==================

  async getIncidentRules(grafanaName = null) {
    if (!this.incidentRulesCollection) await this.initialize();
    
    try {
      const filter = grafanaName ? { grafana_names: grafanaName.trim().toLowerCase() } : {};
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
      console.error('❌ Error fetching incident rules:', error);
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
        grafana_names: mapping.grafana_names, // Store array of names
        logic_operator: ruleData.logic_operator || 'OR',
        created_at: new Date(),
        updated_at: new Date()
      };

      const result = await this.incidentRulesCollection.insertOne(dataToInsert);
      
      console.log(`✅ Created incident rule for applications: ${mapping.grafana_names.join(', ')}`);
      return { _id: result.insertedId, ...dataToInsert };
    } catch (error) {
      console.error('❌ Error creating incident rule:', error);
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
        updateData.grafana_names = mapping.grafana_names;
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

      console.log(`✅ Updated incident rule: ${id}`);
      return await this.incidentRulesCollection.findOne({ _id: objectId });
    } catch (error) {
      console.error('❌ Error updating incident rule:', error);
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

      console.log(`✅ Deleted incident rule: ${id}`);
      return { message: 'Incident rule deleted successfully' };
    } catch (error) {
      console.error('❌ Error deleting incident rule:', error);
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

      console.log(`✅ Toggled incident rule ${id}: ${enabled ? 'enabled' : 'disabled'}`);
      return { message: `Incident rule ${enabled ? 'enabled' : 'disabled'} successfully` };
    } catch (error) {
      console.error('❌ Error toggling incident rule:', error);
      throw error;
    }
  }

  // ================== RULE MATCHING ==================

  _calculateRuleSpecificity(rule) {
    const { conditions } = rule;
    let score = 0;
    
    const weights = { exact: 10, regex: 7, contains: 3 };
    
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
        console.warn(`⚠️  Invalid regex in rule for ${fieldPrefix}:`, conditions[`${fieldPrefix}_regex`]);
        results.push(false);
      }
    }
    
    return results;
  }

  _doesAlertMatchRule(alertData, rule) {
    const { conditions, logic_operator = 'OR' } = rule;
    const { message, node_name, object_name, network, operator } = alertData;
    
    const conditionGroups = [];

    const evaluateFieldResults = (results) => {
      if (results.length === 0) return null;
      
      if (logic_operator === 'AND' && results.length > 1) {
        return results.every(result => result === true);
      }
      return results.some(result => result === true);
    };

    // Evaluate all field conditions
    ['message', 'node_name', 'object_name', 'operator'].forEach(field => {
      const value = alertData[field];
      const results = this._checkFieldConditions(value, conditions, field);
      const match = evaluateFieldResults(results);
      if (match !== null) conditionGroups.push(match);
    });

    // Network special handling
    const networkResults = this._checkFieldConditions(network, conditions, 'network');
    const networkMatch = evaluateFieldResults(networkResults);
    if (networkMatch !== null) {
      conditionGroups.push(networkMatch);
    } else if (conditions.network) {
      conditionGroups.push(network && network.toLowerCase().includes(conditions.network.toLowerCase()));
    }

    if (conditionGroups.length === 0) return false;

    return logic_operator === 'AND' 
      ? conditionGroups.every(result => result === true)
      : conditionGroups.some(result => result === true);
  }

  // ================== INCIDENT CREATION ==================

  async createIncidentFromAlert(alertData) {
    try {
      const { application } = alertData;
      
      if (!application) {
        throw new Error('Alert must have an application field');
      }

      // Get rules for this application (rules are stored with grafana_names array)
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
        
        console.log(`✅ Using incident rule: ${matchingRule.rule_name} (specificity: ${this._calculateRuleSpecificity(matchingRule)})`);
        incidentData = this._buildIncidentData(systemMapping, matchingRule.incident_overrides, alertData);
        
        incidentData.matched_rule_id = matchingRule._id;
        incidentData.matched_rule_name = matchingRule.rule_name;
        incidentData.matched_rule_logic = matchingRule.logic_operator || 'OR';
        
      } else {
        // Fallback to basic system mapping
        systemMapping = await this.getMappingByApplication(application);
        
        if (!systemMapping) {
          throw new Error(
            `No system mapping or incident rules found for application: ${application}. ` +
            `Available mappings cover: ${(await this.getSystemMappings()).map(m => m.grafana_names.join(', ')).join(' | ')}`
          );
        }
        
        console.log(`ℹ️  Using basic system mapping for: ${application} (from ${systemMapping.grafana_names.join(', ')})`);
        incidentData = this._buildIncidentData(systemMapping, {}, alertData);
      }
      
      console.log('📋 Creating incident with data:', JSON.stringify(incidentData, null, 2));
      
      const serviceNowResult = await this._sendToServiceNow(incidentData);
      
      return {
        incidentData,
        serviceNowResult,
        matched_applications: systemMapping.grafana_names
      };
      
    } catch (error) {
      console.error('❌ Error creating incident from alert:', error);
      throw error;
    }
  }

  async getDistinctValues(fieldName) {
    if (!this.systemMappingsCollection) await this.initialize();
    
    try {
      const values = await this.systemMappingsCollection.distinct(fieldName);
      return values.filter(v => v != null && v !== '');
    } catch (error) {
      console.error(`❌ Error fetching distinct values for ${fieldName}:`, error);
      throw error;
    }
  }
}

module.exports = new IncidentService();