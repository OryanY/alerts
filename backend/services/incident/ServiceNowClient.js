// services/incident/ServiceNowClient.js - ServiceNow API integration
const axios = require('axios');
const { cacheGet, cacheSet } = require('../../utils/cache');
const { logger } = require('../../utils/logger');

const log = logger.tagged('servicenow');

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
            log.warn('integration disabled or not configured');
            return { success: false, message: 'ServiceNow integration disabled' };
        }

        try {
            log.debug('creating incident', incidentData);

            const response = await axios({
                method: 'POST',
                url: `${this.url}/api/now/table/incident`,
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                auth: { username: this.username, password: this.password },
                data: incidentData,
                timeout: 10000
            });

            log.info('incident created', response.data.result.number);

            return {
                success: true,
                incident_number: response.data.result.number,
                sys_id: response.data.result.sys_id,
                link: `${this.url}/nav_to.do?uri=incident.do?sys_id=${response.data.result.sys_id}`
            };
        } catch (error) {
            log.error('API error creating incident', error.response?.data || error.message);
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
            log.warn(`no table configured for ${cacheKey}`);
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
            log.debug(`cached ${items.length} ${cacheKey} (key: ${mongoKey})`);

            return items;
        } catch (error) {
            log.error(`error fetching ${cacheKey} (query: ${queryHash})`, error.message);
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

    /**
     * Fetch Business-Service → Service-Offering pairs from cmdb_ci_rel.
     *
     * parent = Business Service, child = Service Offering (confirmed by the
     * business owner). Unlike the flat reference fetchers above, each row is a
     * structured pair carrying BOTH the sys_id (value) and display name (label)
     * for parent and child, so the UI can store the spacing-proof sys_id while
     * showing the human-readable name.
     *
     * Everything instance-specific (relationship type, network field) is
     * env-driven and intentionally permissive by default: ServiceNow CMDB data
     * is frequently incomplete (missing rel types, missing networks), which is
     * why the mapping form always keeps a manual-override escape hatch. A wrong
     * filter here degrades to "fewer/no suggestions", never to a hard failure.
     */
    async fetchServiceRelationships(network = null) {
        if (!this.isEnabled()) return [];

        const table  = process.env.SN_REL_TABLE  || 'cmdb_ci_rel';
        // Request the plain reference (→ sys_id) AND the dot-walked name (→ display
        // name). `parent` alone returns the sys_id; `parent.name` returns the name.
        const fields = process.env.SN_REL_FIELDS || 'parent,parent.name,child,child.name';
        const typeQuery = process.env.SN_REL_TYPE_QUERY || '';

        // {network} is substituted with the chosen network. The default keeps
        // CIs that have no network set (ISEMPTY) so incomplete data still
        // surfaces rather than silently vanishing.
        const networkTemplate = process.env.SN_REL_NETWORK_FILTER
            || 'parent.u_network_ciLIKE{network}^ORchild.u_network_ciLIKE{network}^ORparent.u_network_ciISEMPTY';

        const clauses = [];
        if (typeQuery) clauses.push(typeQuery);
        if (network)   clauses.push(networkTemplate.replace(/\{network\}/g, network));
        const query = clauses.join('^');

        const queryHash = query || 'all';
        const mongoKey  = `sn:serviceRelationships:${queryHash}`;
        const cached    = await cacheGet(mongoKey);
        if (cached) return cached;

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

            // sys_id from the plain ref field. ServiceNow may return it as a bare
            // string or as a { value, link } object depending on version/config.
            const refValue = (field) => {
                if (field == null) return '';
                if (typeof field === 'string') return field.trim();
                return String(field.value || '').trim();
            };
            // Display name from the dot-walked `<base>.name` key, falling back to
            // a display_value object if display-value mode is ever turned on.
            const refLabel = (row, base) => {
                const dotted = row[`${base}.name`];
                if (typeof dotted === 'string' && dotted.trim()) return dotted.trim();
                const field = row[base];
                if (field && typeof field === 'object' && field.display_value) return String(field.display_value).trim();
                return '';
            };

            // Dedupe child offerings; the first parent seen for a child wins.
            const byChild = new Map();
            for (const row of response.data.result) {
                const childValue  = refValue(row.child);
                const childLabel  = refLabel(row, 'child');
                const parentValue = refValue(row.parent);
                const parentLabel = refLabel(row, 'parent');
                if (!childValue && !childLabel) continue;

                const key = childValue || childLabel;
                if (byChild.has(key)) continue;
                byChild.set(key, {
                    parent: { value: parentValue || parentLabel, label: parentLabel || parentValue },
                    child:  { value: childValue  || childLabel,  label: childLabel  || childValue  }
                });
            }

            const pairs = Array.from(byChild.values())
                .sort((a, b) => a.child.label.localeCompare(b.child.label));

            await cacheSet(mongoKey, pairs, SN_CACHE_TTL);
            log.debug(`cached ${pairs.length} service relationships (key: ${mongoKey})`);
            return pairs;
        } catch (error) {
            log.error(`error fetching service relationships (query: ${queryHash})`, error.message);
            return [];
        }
    }

    // ------------------------------------------------------------------ //
    //  User and Email resolution
    // ------------------------------------------------------------------ //

    /**
     * Resolve a username to their ServiceNow sys_id.
     * Queries by email matching "${username}@d360.dom".
     */
    async getSysIdByUser(username) {
        const fallbackSysId = "b52e61db853a7d549dd83f48caed07f5";
        const domain = "d360.dom";
        if (!this.isEnabled() || !username) {
            return fallbackSysId;
        }

        const email = `${username}@${domain}`;

        try {
            const response = await axios({
                method: 'GET',
                url: `${this.url}/api/now/table/sys_user`,
                params: {
                    sysparm_query: `email=${email}`,
                    sysparm_fields: 'sys_id',
                    sysparm_limit: 1
                },
                headers: { 'Accept': 'application/json' },
                auth:    { username: this.username, password: this.password },
                timeout: 10000
            });

            const result = response.data.result;
            if (!result || (Array.isArray(result) && result.length === 0)) {
                log.info(`No user found with email: ${email}, using fallback sys_id`);
                return fallbackSysId;
            }

            const userRecord = Array.isArray(result) ? result[0] : result;
            return userRecord?.sys_id || fallbackSysId;
        } catch (error) {
            log.error(`Error fetching user sys_id by email ${email}:`, error.message);
            return fallbackSysId;
        }
    }

    // ------------------------------------------------------------------ //
    //  TIUD alert creation
    // ------------------------------------------------------------------ //

    async createTiudAlert(alertData) {
        if (!this.isEnabled()) {
            log.warn('integration disabled or not configured');
            return { success: false, message: 'ServiceNow integration disabled' };
        }

        try {
            log.debug('creating TIUD alert', alertData);

            const response = await axios({
                method: 'POST',
                url: `${this.url}/api/now/table/u_tiud_atraot`,
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                auth:    { username: this.username, password: this.password },
                data:    alertData,
                timeout: 10000
            });

            log.info('TIUD alert created', response.data.result.u_number);

            return {
                success:      true,
                alert_number: response.data.result.u_number,
                sys_id:       response.data.result.sys_id,
                link:         `${this.url}/nav_to.do?uri=u_tiud_atraot.do?sys_id=${response.data.result.sys_id}`
            };
        } catch (error) {
            log.error('API error creating TIUD alert', error.response?.data || error.message);
            return {
                success: false,
                error:   error.response?.data?.error?.message || error.message,
                status:  error.response?.status
            };
        }
    }
}

module.exports = { ServiceNowClient };
