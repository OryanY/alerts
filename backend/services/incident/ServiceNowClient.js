// services/incident/ServiceNowClient.js - ServiceNow API integration
const axios = require('axios');

/**
 * ServiceNowClient - Handles all ServiceNow API interactions
 * Single Responsibility: External API communication
 */
class ServiceNowClient {
    constructor(config = {}) {
        this.url = config.url || process.env.SERVICENOW_URL;
        this.username = config.username || process.env.SERVICENOW_USERNAME;
        this.password = config.password || process.env.SERVICENOW_PASSWORD;
        this.enabled = Boolean(this.url);
    }

    /**
     * Check if ServiceNow integration is enabled
     */
    isEnabled() {
        return this.enabled && this.url;
    }

    async createIncident(incidentData) {
        if (!this.isEnabled()) {
            console.log('❌ ServiceNow integration disabled or not configured');
            return { success: false, message: 'ServiceNow integration disabled' };
        }

        try {
            console.log('Sending to ServiceNow:', JSON.stringify(incidentData, null, 2));

            const response = await axios({
                method: 'POST',
                url: `${this.url}/api/now/table/incident`,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                auth: {
                    username: this.username,
                    password: this.password
                },
                data: incidentData,
                timeout: 10000
            });

            console.log('✅ ServiceNow incident created:', response.data.result.number);

            return {
                success: true,
                incident_number: response.data.result.number,
                sys_id: response.data.result.sys_id,
                link: `${this.url}/nav_to.do?uri=incident.do?sys_id=${response.data.result.sys_id}`
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
        if (!this.isEnabled()) {
            return [];
        }

        try {
            const response = await axios({
                method: 'GET',
                url: `${this.url}/api/now/table/sys_user_group`,
                params: {
                    sysparm_query: 'active=true',
                    sysparm_fields: 'sys_id,name',
                    sysparm_limit: 1000
                },
                headers: { 'Accept': 'application/json' },
                auth: {
                    username: this.username,
                    password: this.password
                },
                timeout: 10000
            });

            const groups = response.data.result.map(group => ({
                value: group.sys_id,
                label: group.name
            }));


            console.log(`✅ fetched ${groups.length} assignment groups`);
            return groups;

        } catch (error) {
            console.error('❌ Error fetching assignment groups:', error.message);
            return [];
        }
    }

    /**
     * Test ServiceNow connection
     * @returns {Promise<Object>} Connection test result
     */
    async testConnection() {
        if (!this.isEnabled()) {
            return { success: false, message: 'ServiceNow not configured' };
        }

        try {
            const response = await axios({
                method: 'GET',
                url: `${this.url}/api/now/table/incident`,
                params: { sysparm_limit: 1 },
                headers: { 'Accept': 'application/json' },
                auth: {
                    username: this.username,
                    password: this.password
                },
                timeout: 5000
            });

            return {
                success: true,
                message: 'ServiceNow connection successful',
                status: response.status
            };

        } catch (error) {
            return {
                success: false,
                message: error.message,
                status: error.response?.status
            };
        }
    }

    /**
     * Clear assignment groups cache
     */
    clearCache() {
        this.assignmentGroupsCache = null;
        this.assignmentGroupsCacheTime = null;
    }
}

module.exports = { ServiceNowClient };
