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
        // Dynamic cache object that can store multiple query results per category
        this.caches = {
            assignmentGroups: {},
            serviceOfferings: {},
            businessServices: {},
            networks: {}
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

    async _fetchCachedReferenceData(options) {
        if (!this.isEnabled()) return [];

        const {
            cacheKey,
            tableEnv,
            queryEnv,
            fieldsEnv,
            defaultTable,
            defaultQuery,
            defaultFields,
            valueField = 'sys_id',
            labelField = 'name',
            appendQuery = null
        } = options;

        const table = process.env[tableEnv] || defaultTable;
        let query = process.env[queryEnv] || defaultQuery;
        const fields = process.env[fieldsEnv] || defaultFields;

        if (appendQuery) {
            query = query ? `${query}^${appendQuery}` : appendQuery;
        }

        if (!table) {
            console.warn(`⚠️ Warning: No ServiceNow table configured for ${cacheKey}`);
            return [];
        }

        // Cache dynamically based on the final query string
        const cacheHash = query || 'default';
        const now = Date.now();
        const categoryCache = this.caches[cacheKey];
        const cacheObj = categoryCache && categoryCache[cacheHash];

        if (cacheObj && cacheObj.data && cacheObj.time && (now - cacheObj.time) < this.CACHE_TTL) {
            return cacheObj.data;
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
                label: (item[labelField] || item.label || item.name || 'Unknown').toString().trim()
            })).sort((a, b) => a.label.localeCompare(b.label));

            // Save to dynamic cache
            if (!this.caches[cacheKey]) this.caches[cacheKey] = {};
            this.caches[cacheKey][cacheHash] = { data: items, time: Date.now() };
            console.log(`✅ Cached ${items.length} ${cacheKey} (query: ${cacheHash})`);

            return items;
        } catch (error) {
            console.error(`❌ Error fetching ${cacheKey} (query: ${cacheHash}):`, error.message);
            if (cacheObj && cacheObj.data) {
                console.warn(`⚠️ Using stale cache for ${cacheKey} due to API error`);
                return cacheObj.data;
            }
            return [];
        }
    }

    async fetchAssignmentGroups() {
        return this._fetchCachedReferenceData({
            cacheKey: 'assignmentGroups',
            tableEnv: 'SN_GROUP_TABLE',
            queryEnv: 'SN_GROUP_QUERY',
            fieldsEnv: 'SN_GROUP_FIELDS',
            defaultTable: 'sys_user_group',
            defaultQuery: 'active=true^u_unit=80',
            defaultFields: 'sys_id,name',
            valueField: 'sys_id',
            labelField: 'name'
        });
    }

    async fetchNetworks() {
        return this._fetchCachedReferenceData({
            cacheKey: 'networks',
            tableEnv: 'SN_NETWORK_TABLE',
            queryEnv: 'SN_NETWORK_QUERY',
            fieldsEnv: 'SN_NETWORK_FIELDS',
            defaultTable: 'sys_choice',
            defaultQuery: 'name=incident^element=u_network^inactive=false',
            defaultFields: 'value,label',
            valueField: 'value',
            labelField: 'label'
        });
    }

    async fetchServiceOfferings(network = null) {
        // Appends to the base `.env` query. Using LIKE since u_network_ci can contain multiple comma-separated values
        // Including ^ORu_network_ciISEMPTY to fetch unassigned/global items as well.
        const appendQuery = network ? `u_network_ciLIKE${network}^ORu_network_ciISEMPTY` : null;

        return this._fetchCachedReferenceData({
            cacheKey: 'serviceOfferings',
            tableEnv: 'SN_OFFERING_TABLE',
            queryEnv: 'SN_OFFERING_QUERY',
            fieldsEnv: 'SN_OFFERING_FIELDS',
            defaultTable: 'service_offering',
            defaultQuery: 'active=true',
            defaultFields: 'sys_id,name',
            valueField: 'name', // Using name as the value identifier
            labelField: 'name',
            appendQuery
        });
    }

    async fetchBusinessServices(network = null) {
        // Appends to the base `.env` query. Using LIKE since u_network_ci can contain multiple comma-separated values
        // Including ^ORu_network_ciISEMPTY to fetch unassigned/global items as well.
        const appendQuery = network ? `u_network_ciLIKE${network}^ORu_network_ciISEMPTY` : null;

        return this._fetchCachedReferenceData({
            cacheKey: 'businessServices',
            tableEnv: 'SN_BUSINESS_TABLE',
            queryEnv: 'SN_BUSINESS_QUERY',
            fieldsEnv: 'SN_BUSINESS_FIELDS',
            defaultTable: 'cmdb_ci_service',
            defaultQuery: 'active=true',
            defaultFields: 'sys_id,name',
            valueField: 'name', // Using name as the value identifier
            labelField: 'name',
            appendQuery
        });
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
