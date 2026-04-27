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

        // Cache configuration
        this.CACHE_TTL = 86400000; // 24 hours
        this.caches = {
            assignmentGroups: { data: null, time: null },
            serviceOfferings: { data: null, time: null },
            businessServices: { data: null, time: null }
        };
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

    async _fetchCachedReferenceData(cacheKey, tableEnv, queryEnv, fieldsEnv, defaultTable, defaultQuery, defaultFields, valueField = 'sys_id', labelField = 'name') {
        if (!this.isEnabled()) return [];

        const now = Date.now();
        const cacheObj = this.caches[cacheKey];

        if (cacheObj && cacheObj.data && cacheObj.time && (now - cacheObj.time) < this.CACHE_TTL) {
            return cacheObj.data;
        }

        const table = process.env[tableEnv] || defaultTable;
        const query = process.env[queryEnv] || defaultQuery;
        const fields = process.env[fieldsEnv] || defaultFields;

        if (!table) {
            console.warn(`⚠️ Warning: No ServiceNow table configured for ${cacheKey}`);
            return [];
        }

        try {
            const response = await axios({
                method: 'GET',
                url: `${this.url}/api/now/table/${table}`,
                params: {
                    sysparm_query: query,
                    sysparm_fields: fields,
                    sysparm_limit: 1000
                },
                headers: { 'Accept': 'application/json' },
                auth: {
                    username: this.username,
                    password: this.password
                },
                timeout: 10000
            });

            const items = response.data.result.map(item => ({
                value: item[valueField] || item.sys_id || item.name, 
                label: item[labelField] ? item[labelField].trim() : 'Unknown'
            })).sort((a, b) => a.label.localeCompare(b.label));

            this.caches[cacheKey] = { data: items, time: Date.now() };
            console.log(`✅ Cached ${items.length} ${cacheKey}`);

            return items;
        } catch (error) {
            console.error(`❌ Error fetching ${cacheKey}:`, error.message);
            if (cacheObj && cacheObj.data) {
                console.warn(`⚠️ Using stale cache for ${cacheKey} due to API error`);
                return cacheObj.data;
            }
            return [];
        }
    }

    async fetchAssignmentGroups() {
        return this._fetchCachedReferenceData(
            'assignmentGroups',
            'SN_GROUP_TABLE', 'SN_GROUP_QUERY', 'SN_GROUP_FIELDS',
            'sys_user_group', 'active=true^u_unit=80', 'sys_id,name',
            'sys_id', 'name' // Use sys_id for the value
        );
    }

    async fetchServiceOfferings() {
        return this._fetchCachedReferenceData(
            'serviceOfferings',
            'SN_OFFERING_TABLE', 'SN_OFFERING_QUERY', 'SN_OFFERING_FIELDS',
            'service_offering', 'active=true', 'sys_id,name',
            'name', 'name' // Use name for the value
        );
    }

    async fetchBusinessServices() {
        return this._fetchCachedReferenceData(
            'businessServices',
            'SN_BUSINESS_TABLE', 'SN_BUSINESS_QUERY', 'SN_BUSINESS_FIELDS',
            'cmdb_ci_service', 'active=true', 'sys_id,name',
            'name', 'name' // Use name for the value
        );
    }

    async getSysIdByUser(username) {
        if (!this.isEnabled()) {
            return [];
        }

        const email = username + "@domain.com";
        try {
            const response = await axios({
                method: 'GET',
                url: `${this.url}/api/now/table/sys_user`,
                params: {
                    sysparm_query: `email=${email}`,
                    sysparm_fields: 'sys_id',
                },
                headers: { 'Accept': 'application/json' },
                auth: {
                    username: this.username,
                    password: this.password
                },
                timeout: 10000
            });

            const result = response.data.result;

            // Handle possible empty result
            if (!result || (Array.isArray(result) && result.length === 0)) {
                console.log("No user found with email:", email);
                return [];
            }

            // If result is an array (multiple items), take first one
            const userRecord = Array.isArray(result) ? result[0] : result;

            if (!userRecord || !userRecord.sys_id) {
                console.log("User found, but no sys_id present");
                return [];
            }

            const sysId = userRecord.sys_id;
            return sysId; // Return just the ID

        } catch (error) {
            console.error('❌ Error fetching user by email:', error.message);
            return [];
        }
    }

    async createTiudAlert(alertData) {
        if (!this.isEnabled()) {
            console.log('❌ ServiceNow integration disabled or not configured');
            return { success: false, message: 'ServiceNow integration disabled' };
        }

        try {
            console.log('Sending to ServiceNow:', JSON.stringify(alertData, null, 2));

            const response = await axios({
                method: 'POST',
                url: `${this.url}/api/now/table/u_tiud_atraot`,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                auth: {
                    username: this.username,
                    password: this.password
                },
                data: alertData,
                timeout: 10000
            });

            console.log('✅ ServiceNow Alert created:', response.data.result.u_number);

            return {
                success: true,
                alert_number: response.data.result.u_number,
                sys_id: response.data.result.sys_id,
                link: `${this.url}/nav_to.do?uri=u_tiud_atraot.do?sys_id=${response.data.result.sys_id}`
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

}

module.exports = { ServiceNowClient };
