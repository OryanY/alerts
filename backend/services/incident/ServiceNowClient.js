// services/incident/ServiceNowClient.js - ServiceNow API integration
const axios = require('axios');

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

    async fetchAssignmentGroups() {
        if (!this.isEnabled()) {
            return [];
        }

        // Check cache
        const now = Date.now();
        if (this.assignmentGroupsCache &&
            this.assignmentGroupsCacheTime &&
            (now - this.assignmentGroupsCacheTime) < this.CACHE_TTL) {
            return this.assignmentGroupsCache;
        }

        try {
            const response = await axios({
                method: 'GET',
                url: `${this.url}/api/now/table/sys_user_group`,
                params: {
                    sysparm_query: 'active=true^u_unit=7180',
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

            // Update cache
            this.assignmentGroupsCache = groups;
            this.assignmentGroupsCacheTime = Date.now();

            console.log(`✅ Cached ${groups.length} assignment groups`);
            return groups;

        } catch (error) {
            console.error('❌ Error fetching assignment groups:', error.message);

            // Return stale cache if available
            if (this.assignmentGroupsCache) {
                console.warn('⚠️  Using stale cache due to API error');
                return this.assignmentGroupsCache;
            }

            return [];
        }
    }
    
   async getSysIdByUser(username) {
        const fallbackSysId = "b52e61db853a7d549dd83f48caed07f5";
        const domain = "d360.dom"
        if (!this.isEnabled() || !username) {
            return fallbackSysId;
        }

        const email = `${username}@${domain}`;
        
        try {
            const response = await axios({
                method: 'GET',
                url: `https://servicenow.domain.com/api/now/table/sys_user`,
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

            if (!result || (Array.isArray(result) && result.length === 0)) {
                console.log(`No user found with email: ${email}, using fallback: ${fallbackSysId}`);
                return fallbackSysId;
            }

            const userRecord = Array.isArray(result) ? result[0] : result;
            
            if (!userRecord || !userRecord.sys_id) {
                console.log(`User found, but no sys_id present, using fallback: ${fallbackSysId}`);
                return fallbackSysId;
            }
            return userRecord.sys_id;
        } catch (error) {
            console.error('❌ Error fetching user by email:', error.message);
            return fallbackSysId;
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
