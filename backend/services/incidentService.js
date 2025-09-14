// services/incidentService.js
const { getMongoDb } = require('../database/connection');
const { mongoConfig } = require('../config');
const { ObjectId } = require('mongodb');

class IncidentService {
  constructor() {
    this.collection = null;
  }

  async initialize() {
    const db = getMongoDb();
    this.collection = db.collection(mongoConfig.collections.systemMappings);
  }

  // Get all system mappings
  async getSystemMappings() {
    if (!this.collection) await this.initialize();
    
    try {
      const mappings = await this.collection.find({}).toArray();
      return mappings;
    } catch (error) {
      console.error('Error fetching system mappings:', error);
      throw new Error('Failed to fetch system mappings');
    }
  }

  // Get system mapping by grafana_name (application)
  async getMappingByApplication(grafanaName) {
    if (!this.collection) await this.initialize();
    
    try {
      const mapping = await this.collection.findOne({ grafana_name: grafanaName });
      return mapping;
    } catch (error) {
      console.error('Error fetching mapping by application:', error);
      throw new Error('Failed to fetch mapping');
    }
  }

  // Create new system mapping
  async createSystemMapping(mappingData) {
    if (!this.collection) await this.initialize();
    
    try {
      // Validate required fields
      if (!mappingData.grafana_name) {
        throw new Error('grafana_name is required');
      }

      // Check if mapping already exists
      const existing = await this.collection.findOne({ grafana_name: mappingData.grafana_name });
      if (existing) {
        throw new Error('Mapping for this grafana_name already exists');
      }

      const result = await this.collection.insertOne({
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

  // Update system mapping
  async updateSystemMapping(id, mappingData) {
    if (!this.collection) await this.initialize();
    
    try {
      const objectId = new ObjectId(id);
      
      // Remove _id and created_at from update data if present
      const { _id, created_at, ...updateData } = mappingData;
      
      const result = await this.collection.updateOne(
        { _id: objectId },
        { 
          $set: { 
            ...updateData, 
            updated_at: new Date() 
          } 
        }
      );

      if (result.matchedCount === 0) {
        throw new Error('System mapping not found');
      }

      return await this.collection.findOne({ _id: objectId });
    } catch (error) {
      console.error('Error updating system mapping:', error);
      throw error;
    }
  }

  // Delete system mapping
  async deleteSystemMapping(id) {
    if (!this.collection) await this.initialize();
    
    try {
      const objectId = new ObjectId(id);
      const result = await this.collection.deleteOne({ _id: objectId });
      
      if (result.deletedCount === 0) {
        throw new Error('System mapping not found');
      }

      return { message: 'System mapping deleted successfully' };
    } catch (error) {
      console.error('Error deleting system mapping:', error);
      throw error;
    }
  }

  // Create incident based on alert data and system mapping
  async createIncidentFromAlert(alertData) {
    try {
      const { application, object_name, node_name, message, time_created, operator } = alertData;
      
      // Get system mapping for this application
      const mapping = await this.getMappingByApplication(application);
      
      if (!mapping) {
        throw new Error(`No system mapping found for application: ${application}`);
      }

      // Build incident data using mapping
      const incidentData = {
        // ServiceNow fields from mapping
        assignment_group: mapping.assignment_group,
        service_offering: mapping.service_offering,
        business_service: mapping.business_service,
        u_site: mapping.u_site,
        u_network: mapping.u_network,
        u_impact_technology: mapping.u_impact_technology,
        u_monitor_identifier: mapping.u_monitor_identifier,
        
        // Alert-specific data
        short_description: `Alert: ${object_name} - ${application}`,
        description: `Alert Details:
        Application: ${application}
        Object: ${object_name}
        Node: ${node_name}
        Message: ${message}
        Time Created: ${time_created}
        Operator: ${operator}`,
        
        // Metadata
        source_application: application,
        alert_time: time_created,
        grafana_operator: operator,
        created_at: new Date()
      };

      // TODO: Integrate with ServiceNow API here
      console.log('Creating incident with data:', JSON.stringify(incidentData, null, 2));
      
      return incidentData;
    } catch (error) {
      console.error('Error creating incident from alert:', error);
      throw error;
    }
  }

  // Get distinct field values for dropdowns/validation
  async getDistinctValues(fieldName) {
    if (!this.collection) await this.initialize();
    
    try {
      const values = await this.collection.distinct(fieldName);
      return values.filter(v => v != null && v !== '');
    } catch (error) {
      console.error(`Error fetching distinct values for ${fieldName}:`, error);
      throw error;
    }
  }
}

module.exports = new IncidentService();