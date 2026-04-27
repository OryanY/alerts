const express = require('express');
const axios = require('axios');
const router = express.Router();

// --- Configuration ---
const CONFIG = {
    snow: {
        // Uses the env variable provided in your details
        baseUrl: process.env.SERVICENOW_URL,
        auth: {
            username: process.env.SERVICENOW_USERNAME,
            password: process.env.SERVICENOW_PASSWORD
        }
    }
};

// --- Cache Manager ---
let incidentsCache = {
    data: null,
    timestamp: 0
};
const CACHE_TTL = 60000;

// --- Helper: Fetch Incidents ---
async function fetchIncidents() {
    const now = Date.now();
    if (incidentsCache.data && (now - incidentsCache.timestamp < CACHE_TTL)) {
        console.log("[Metrics] Using cached incidents data");
        return incidentsCache.data;
    }

    const url = `${CONFIG.snow.baseUrl}/api/now/table/incident`;
    
    // Replicating the exact query string from Python
    const query = 
        "short_descriptionNOT LIKEקפצה התראה על^" +
        "assignment_group.parent=8bbb2b2c610221109c674479f2d24d4c^" +
        "ORassignment_group=8bbb2b2c610221109c674479f2d24d4c^" +
        "stateIN1,2,3,4,10^" +
        "NQsys_tags.2835e6abc8fdde94936bc4e3b4e68a9b=2835e6abc8fdde94936bc4e3b4e68a9b^ORsys_tags.9c9158defdf9f9d027b38e3391c730ab=9c9158defdf9f9d027b38e3391c730ab" +
        "stateNOT IN6,7,8";

    const params = {
        sysparm_query: query,
        sysparm_fields: 'number,assignment_group,state,u_system_failure,sys_tags',
        sysparm_display_value: 'true'
    };

    try {
        console.log("[Metrics] Fetching fresh incidents from ServiceNow");
        const response = await axios.get(url, {
            auth: CONFIG.snow.auth,
            params: params,
            timeout: 20000
        });

        let data = response.data.result;
        
        // Clean up the assignment_group object (remove 'link' key) to mimic Python pandas behavior
        if (Array.isArray(data)) {
            data = data.map(item => {
                if (item.assignment_group && typeof item.assignment_group === 'object') {
                    delete item.assignment_group.link;
                }
                return item;
            });
        }

        incidentsCache.data = data;
        incidentsCache.timestamp = now;
        return data;
    } catch (error) {
        console.error("[Metrics] Failed to fetch incidents:", error.message);
        throw error;
    }
}

// --- Helper: Apply State Filter ---
function applyStateFilter(incidents, stateParam) {
    if (!stateParam || stateParam.toLowerCase() === 'all') {
        return incidents;
    }

    const states = stateParam.split(',').map(s => s.trim().toLowerCase());
    
    return incidents.filter(item => {
        const stateVal = item.state || '';
        const stateLower = stateVal.toLowerCase();

        return states.some(s => {
            if (s === 'in_progress') {
                return stateLower === 'in progress' || stateVal === 'בטיפול';
            } else if (s === 'new') {
                return stateLower === 'new' || stateVal === 'חדש';
            } else if (s === 'waiting') {
                return stateLower === 'waiting' || stateVal.includes('ממתין');
            } else if (s.includes('ממתין')) {
                // Specific match for Hebrew strings like 'ממתין תקלת אב'
                return stateVal === s;
            }
            return false;
        });
    });
}

// --- Main Route: /metrics ---
router.get('/', async (req, res) => {
    const { team, state, system_failure, details, tag } = req.query;

    console.log(`Incoming /metrics request. Params: team=${team}, state=${state}, system_failure=${system_failure}, details=${details}, tag=${tag}`);

    try {
        const data = await fetchIncidents();
        
        // Transform data to add 'team' field
        let processedData = data.map(item => {
            const teamName = (item.assignment_group && item.assignment_group.display_value) 
                             ? item.assignment_group.display_value 
                             : '';
            return { ...item, team: teamName };
        });

        // Exclude specific tags
        processedData = processedData.filter(item => {
            const tags = item.sys_tags || '';
            return !tags.includes('תקלות קווים') && !tags.includes('תקלות פריסה');
        });

        // Filter by Team
        if (team) {
            if (team.toLowerCase() === 'tipul') {
                const excludedTeam = '851/ צוות Tequila';
                processedData = processedData.filter(item => item.team !== excludedTeam);
                processedData = processedData.filter(item => !(item.sys_tags || '').includes('פחות קריטי'));
            } else if (team.toLowerCase() !== 'all') {
                // Search for team name
                const foundTeam = processedData.find(item => item.team.toLowerCase().includes(team.toLowerCase()));
                if (foundTeam) {
                    processedData = processedData.filter(item => item.team === foundTeam.team);
                } else {
                    // If team not found, return empty for count, or continue for details
                    processedData = [];
                }
            }
        }

        // Filter by State
        processedData = applyStateFilter(processedData, state);

        // 5. Filter by System Failure
        if (system_failure && system_failure !== 'all') {
            processedData = processedData.filter(item => {
                const sf = (item.u_system_failure || '').toLowerCase();
                if (system_failure === 'true') {
                    return sf === 'true' || item.u_system_failure === 'אמת';
                } else if (system_failure === 'false') {
                    return sf === 'false' || item.u_system_failure === 'שקר';
                }
                return true;
            });
        }

        // Filter by Tag
        if (tag) {
            processedData = processedData.filter(item => (item.sys_tags || '').includes(tag));
        }

        // Response
        if (details === 'true' || details === true) {
            return res.json(processedData);
        } else {
            return res.json({ count: processedData.length });
        }

    } catch (error) {
        console.error("Error in /metrics:", error);
        res.status(500).json({ error: 'Failed to fetch metrics', details: error.message });
    }
});

// --- Route: /metrics/line-failures ---
router.get('/line-failures', async (req, res) => {
    const { team, state, system_failure, tag, details } = req.query;
    
    console.log(`Incoming /metrics/line-failures request. Params: team=${team}, state=${state}, system_failure=${system_failure}, tag=${tag}, details=${details}`);

    try {
        const data = await fetchIncidents();
        
        // 1. Filter for Line Failures (include תקלות קווים OR תקלות פריסה)
        let processedData = data.filter(item => {
            const tags = item.sys_tags || '';
            return tags.includes('תקלות קווים') || tags.includes('תקלות פריסה');
        });

        // Add team field
        processedData = processedData.map(item => {
            const teamName = (item.assignment_group && item.assignment_group.display_value) 
                             ? item.assignment_group.display_value 
                             : '';
            return { ...item, team: teamName };
        });

        // 2. Filter by specific tag if provided
        if (tag) {
            if (tag === 'קווים') {
                processedData = processedData.filter(item => (item.sys_tags || '').includes('תקלות קווים'));
            } else if (tag === 'פריסה') {
                processedData = processedData.filter(item => (item.sys_tags || '').includes('תקלות פריסה'));
            } else {
                return res.status(400).json({ error: 'Invalid tag. Use "קווים" or "פריסה"' });
            }
        }

        // 3. Team Filter
        if (team && team.toLowerCase() !== 'all') {
            processedData = processedData.filter(item => item.team.toLowerCase().includes(team.toLowerCase()));
        }

        // 4. State Filter
        processedData = applyStateFilter(processedData, state);

        // 5. System Failure Filter
        if (system_failure && system_failure !== 'all') {
            processedData = processedData.filter(item => {
                const sf = (item.u_system_failure || '').toLowerCase();
                if (system_failure === 'true') return sf === 'true' || item.u_system_failure === 'אמת';
                if (system_failure === 'false') return sf === 'false' || item.u_system_failure === 'שקר';
                return true;
            });
        }

        if (details === 'true') {
            return res.json(processedData);
        } else {
            return res.json({ count: processedData.length });
        }

    } catch (error) {
        console.error("Error in /metrics/line-failures:", error);
        res.status(500).json({ error: 'Failed to fetch line failures' });
    }
});

// --- Route: /metrics/details ---
router.get('/details', async (req, res) => {
    try {
        const data = await fetchIncidents();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch details' });
    }
});

module.exports = router;

