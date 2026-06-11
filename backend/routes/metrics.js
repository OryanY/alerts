// routes/metrics.js
const express = require('express');
const axios = require('axios');
const { cacheGet, cacheSet } = require('../utils/cache');

const router = express.Router();

// --- Configuration ---
const CONFIG = {
    snow: {
        baseUrl: process.env.SERVICENOW_URL,
        auth: {
            username: process.env.SERVICENOW_USERNAME,
            password: process.env.SERVICENOW_PASSWORD
        }
    }
};

// Shared cache key & TTL
const INCIDENTS_CACHE_KEY = 'metrics:snow_incidents';
const CACHE_TTL = 60_000; // 60 seconds

// --- Helper: Fetch Incidents (shared cache) ---
async function fetchIncidents() {
    // 1. Check shared MongoDB cache
    const cached = await cacheGet(INCIDENTS_CACHE_KEY);
    if (cached) {
        return cached;
    }

    // 2. Cache miss → fetch from ServiceNow
    const url = `${CONFIG.snow.baseUrl}/api/now/table/incident`;

    const query =
        'short_descriptionNOT LIKEקפצה התראה על^' +
        'assignment_group.parent=8bbb2b2c610221109c674479f2d24d4c^' +
        'ORassignment_group=8bbb2b2c610221109c674479f2d24d4c^' +
        'stateIN1,2,3,4,10^' +
        'NQsys_tags.2835e6abc8fdde94936bc4e3b4e68a9b=2835e6abc8fdde94936bc4e3b4e68a9b^ORsys_tags.9c9158defdf9f9d027b38e3391c730ab=9c9158defdf9f9d027b38e3391c730ab' +
        'stateNOT IN6,7,8';

    const params = {
        sysparm_query: query,
        sysparm_fields: 'number,assignment_group,state,u_system_failure,sys_tags',
        sysparm_display_value: 'true'
    };
    const response = await axios.get(url, {
        auth: CONFIG.snow.auth,
        params,
        timeout: 20000
    });

    let data = response.data.result;

    // Clean up the assignment_group object (remove 'link' key)
    if (Array.isArray(data)) {
        data = data.map(item => {
            if (item.assignment_group && typeof item.assignment_group === 'object') {
                delete item.assignment_group.link;
            }
            return item;
        });
    }

    // 3. Write to shared cache — all other pods will now read from here
    await cacheSet(INCIDENTS_CACHE_KEY, data, CACHE_TTL);

    return data;
}

// --- Helper: Apply State Filter ---
function applyStateFilter(incidents, stateParam) {
    if (!stateParam || stateParam.toLowerCase() === 'all') return incidents;

    const states = stateParam.split(',').map(s => s.trim().toLowerCase());

    return incidents.filter(item => {
        const stateVal = item.state || '';
        const stateLower = stateVal.toLowerCase();

        return states.some(s => {
            if (s === 'in_progress')  return stateLower === 'in progress' || stateVal === 'בטיפול';
            if (s === 'new')          return stateLower === 'new' || stateVal === 'חדש';
            if (s === 'waiting')      return stateLower === 'waiting' || stateVal.includes('ממתין');
            if (s.includes('ממתין')) return stateVal === s;
            return false;
        });
    });
}

// --- Main Route: /metrics ---
router.get('/', async (req, res) => {
    const { team, state, system_failure, details, tag } = req.query;
    try {
        const data = await fetchIncidents();

        // Add 'team' field
        let processedData = data.map(item => {
            const teamName = item.assignment_group?.display_value ?? '';
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
                const foundTeam = processedData.find(item => item.team.toLowerCase().includes(team.toLowerCase()));
                processedData = foundTeam
                    ? processedData.filter(item => item.team === foundTeam.team)
                    : [];
            }
        }

        // Filter by State
        processedData = applyStateFilter(processedData, state);

        // Filter by System Failure
        if (system_failure && system_failure !== 'all') {
            processedData = processedData.filter(item => {
                const sf = (item.u_system_failure || '').toLowerCase();
                if (system_failure === 'true')  return sf === 'true'  || item.u_system_failure === 'אמת';
                if (system_failure === 'false') return sf === 'false' || item.u_system_failure === 'שקר';
                return true;
            });
        }

        // Filter by Tag
        if (tag) {
            processedData = processedData.filter(item => (item.sys_tags || '').includes(tag));
        }

        if (details === 'true' || details === true) return res.json(processedData);
        return res.json({ count: processedData.length });

    } catch (error) {
        console.error('Error in /metrics:', error);
        res.status(500).json({ error: 'Failed to fetch metrics', details: error.message });
    }
});

// --- Route: /metrics/line-failures ---
router.get('/line-failures', async (req, res) => {
    const { team, state, system_failure, tag, details } = req.query;
    try {
        const data = await fetchIncidents();

        // Filter for Line Failures
        let processedData = data.filter(item => {
            const tags = item.sys_tags || '';
            return tags.includes('תקלות קווים') || tags.includes('תקלות פריסה');
        });

        // Add team field
        processedData = processedData.map(item => ({
            ...item,
            team: item.assignment_group?.display_value ?? ''
        }));

        // Filter by specific tag
        if (tag) {
            if (tag === 'קווים') {
                processedData = processedData.filter(item => (item.sys_tags || '').includes('תקלות קווים'));
            } else if (tag === 'פריסה') {
                processedData = processedData.filter(item => (item.sys_tags || '').includes('תקלות פריסה'));
            } else {
                return res.status(400).json({ error: 'Invalid tag. Use "קווים" or "פריסה"' });
            }
        }

        // Team Filter
        if (team && team.toLowerCase() !== 'all') {
            processedData = processedData.filter(item => item.team.toLowerCase().includes(team.toLowerCase()));
        }

        // State Filter
        processedData = applyStateFilter(processedData, state);

        // System Failure Filter
        if (system_failure && system_failure !== 'all') {
            processedData = processedData.filter(item => {
                const sf = (item.u_system_failure || '').toLowerCase();
                if (system_failure === 'true')  return sf === 'true'  || item.u_system_failure === 'אמת';
                if (system_failure === 'false') return sf === 'false' || item.u_system_failure === 'שקר';
                return true;
            });
        }

        if (details === 'true') return res.json(processedData);
        return res.json({ count: processedData.length });

    } catch (error) {
        console.error('Error in /metrics/line-failures:', error);
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
