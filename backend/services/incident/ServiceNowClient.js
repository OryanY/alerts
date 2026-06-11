// services/incident/ServiceNowClient.js - ServiceNow API integration
const axios = require('axios');
const { cacheGet, cacheSet } = require('../../utils/cache');

// 24-hour TTL for ServiceNow reference data (groups, networks, offerings, etc.)
const SN_CACHE_TTL = 86_400_000; // 24 hours in ms

/**
 * ServiceNowClient - Handles all ServiceNow API interactions
 * Single Responsibility: External API communication
 *
 * Cache strategy: MongoDB shared_cache collection (via utils/cache shared tier).
 * All pod replicas share the same cache → only one race-to-fill per TTL window.
 */
class ServiceNowClient {
    constructor(config = {}) {
        this.url = config.url || process.env.SERVICENOW_URL;
        this.username = config.username || process.env.SERVICENOW_USERNAME;
        this.password = config.password || process.env.SERVICENOW_PASSWORD;
        this.enabled = Boolean(this.url);
    }

    isEnabled() {
        return this.enabled && this.url;
    }

    // ------------------------------------------------------------------ //
    //  Incident creation
    // ------------------------------------------------------------------ //

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
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                auth: { username: this.username, password: this.password },
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

    // ------------------------------------------------------------------ //
    //  Reference-data fetcher (shared MongoDB cache)
    // ------------------------------------------------------------------ //

    /**
     * Generic cached fetch for ServiceNow reference tables.
     *
     * Cache key format: "sn:<cacheKey>:<queryHash>"
     * All pods share this key, so only the first pod to miss will call ServiceNow.
     */
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

        const table  = process.env[tableEnv]  || defaultTable;
        let   query  = process.env[queryEnv]  || defaultQuery;
        const fields = process.env[fieldsEnv] || defaultFields;

        if (appendQuery) query = query ? `${query}^${appendQuery}` : appendQuery;

        if (!table) {
            console.warn(`⚠️ No ServiceNow table configured for ${cacheKey}`);
            return [];
        }

        // ── 1. Check shared cache ──────────────────────────────────────
        const queryHash  = query || 'default';
        const mongoKey   = `sn:${cacheKey}:${queryHash}`;
        const cached     = await cacheGet(mongoKey);
        if (cached) {
            return cached;
        }

        // ── 2. Cache miss → fetch from ServiceNow ─────────────────────
        try {
            const response = await axios({
                method: 'GET',
                url: `${this.url}/api/now/table/${table}`,
                params: {
                    sysparm_query:  query,
                    sysparm_fields: fields,
                    sysparm_limit:  1000
                },
                headers: { 'Accept': 'application/json' },
                auth:    { username: this.username, password: this.password },
                timeout: 10000
            });

            // Build + deduplicate items
            const uniqueMap = new Map();
            for (const item of response.data.result) {
                const rawLabel = (item[labelField] || item.label || item.name || '').toString().trim();
                const rawValue = (item[valueField] || item.sys_id || item.name || '').toString().trim();
                if (!rawLabel && !rawValue) continue;
                const label = rawLabel || rawValue;
                if (!uniqueMap.has(label)) {
                    uniqueMap.set(label, { value: rawValue || rawLabel, label });
                }
            }

            const items = Array.from(uniqueMap.values()).sort((a, b) => a.label.localeCompare(b.label));

            // ── 3. Write to shared cache ───────────────────────────────
            await cacheSet(mongoKey, items, SN_CACHE_TTL);
            console.log(`✅ SharedCache SET ${items.length} ${cacheKey} (key: ${mongoKey})`);

            return items;
        } catch (error) {
            console.error(`❌ Error fetching ${cacheKey} (query: ${queryHash}):`, error.message);
            return [];
        }
    }

    async fetchAssignmentGroups() {
        return this._fetchCachedReferenceData({
            cacheKey:      'assignmentGroups',
            tableEnv:      'SN_GROUP_TABLE',
            queryEnv:      'SN_GROUP_QUERY',
            fieldsEnv:     'SN_GROUP_FIELDS',
            defaultTable:  'sys_user_group',
            defaultQuery:  'active=true^u_unit=80',
            defaultFields: 'sys_id,name',
            valueField:    'sys_id',
            labelField:    'name'
        });
    }

    async fetchNetworks() {
        return this._fetchCachedReferenceData({
            cacheKey:      'networks',
            tableEnv:      'SN_NETWORK_TABLE',
            queryEnv:      'SN_NETWORK_QUERY',
            fieldsEnv:     'SN_NETWORK_FIELDS',
            defaultTable:  'sys_choice',
            defaultQuery:  'name=incident^element=u_network^inactive=false',
            defaultFields: 'value,label',
            valueField:    'label',
            labelField:    'label'
        });
    }

    async fetchServiceOfferings(network = null) {
        const appendQuery = network ? `u_network_ciLIKE${network}^ORu_network_ciISEMPTY` : null;
        return this._fetchCachedReferenceData({
            cacheKey:      'serviceOfferings',
            tableEnv:      'SN_OFFERING_TABLE',
            queryEnv:      'SN_OFFERING_QUERY',
            fieldsEnv:     'SN_OFFERING_FIELDS',
            defaultTable:  'service_offering',
            defaultQuery:  'active=true',
            defaultFields: 'sys_id,name',
            valueField:    'name',
            labelField:    'name',
            appendQuery
        });
    }

    async fetchBusinessServices(network = null) {
        const appendQuery = network ? `u_network_ciLIKE${network}^ORu_network_ciISEMPTY` : null;
        return this._fetchCachedReferenceData({
            cacheKey:      'businessServices',
            tableEnv:      'SN_BUSINESS_TABLE',
            queryEnv:      'SN_BUSINESS_QUERY',
            fieldsEnv:     'SN_BUSINESS_FIELDS',
            defaultTable:  'cmdb_ci_service',
            defaultQuery:  'active=true',
            defaultFields: 'sys_id,name',
            valueField:    'name',
            labelField:    'name',
            appendQuery
        });
    }

    // ------------------------------------------------------------------ //
    //  TIUD alert creation
    // ------------------------------------------------------------------ //

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
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                auth:    { username: this.username, password: this.password },
                data:    alertData,
                timeout: 10000
            });

            console.log('✅ ServiceNow Alert created:', response.data.result.u_number);

            return {
                success:      true,
                alert_number: response.data.result.u_number,
                sys_id:       response.data.result.sys_id,
                link:         `${this.url}/nav_to.do?uri=u_tiud_atraot.do?sys_id=${response.data.result.sys_id}`
            };
        } catch (error) {
            console.error('❌ ServiceNow API Error:', error.response?.data || error.message);
            return {
                success: false,
                error:   error.response?.data?.error?.message || error.message,
                status:  error.response?.status
            };
        }
    }
}

module.exports = { ServiceNowClient };
