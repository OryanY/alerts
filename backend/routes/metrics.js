// routes/metrics.js
const express = require('express');
const axios = require('axios');
const { cacheGet, cacheSet, createLocalCache } = require('../utils/cache');
const { logger } = require('../utils/logger');

const log = logger.tagged('metrics');
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
// Shared cache reduces ServiceNow calls across pods, but does not fully prevent
// cross-pod stampedes on cache miss unless cacheGet/cacheSet implements locking.
const CACHE_TTL = 60_000; // 60 seconds

// Tiny per-pod cache in front of the shared tier so a burst of dashboard polls
// doesn't do a Mongo round-trip per request. `inFlight` coalesces concurrent
// misses into a single upstream load (no thundering herd to ServiceNow).
const LOCAL_TTL = 5_000; // 5 seconds
const localIncidents = createLocalCache('metrics-incidents', { ttlMs: LOCAL_TTL, maxEntries: 1 });
let inFlight = null;

// Shared cache → ServiceNow. Only reached on a local-cache miss.
async function loadIncidents() {
    // 1. Try shared MongoDB cache — degrades gracefully if Mongo is down
    let shared = null;
    try {
        shared = await cacheGet(INCIDENTS_CACHE_KEY);
    } catch (err) {
        log.warn('shared cache read failed, falling back to ServiceNow', err.message);
    }
    if (shared) return shared;

    // 2. Cache miss → fetch from ServiceNow
    const url = `${CONFIG.snow.baseUrl}/api/now/table/incident`;

    const query = [
        'short_descriptionNOT LIKEקפצה התראה על',
        'assignment_group.parent=8bbb2b2c610221109c674479f2d24d4c',
        'ORassignment_group=8bbb2b2c610221109c674479f2d24d4c',
        'stateIN1,2,3,4,10',
        'NQsys_tags.2835e6abc8fdde94936bc4e3b4e68a9b=2835e6abc8fdde94936bc4e3b4e68a9b',
        'ORsys_tags.9c9158defdf9f9d027b38e3391c730ab=9c9158defdf9f9d027b38e3391c730ab',
        'stateNOT IN6,7,8',
    ].join('^');

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

    // Clean up the assignment_group object (remove 'link' key) and pre-add normalized 'team' property
    if (Array.isArray(data)) {
        data = data.map(item => {
            const teamName = item.assignment_group?.display_value ?? '';
            if (item.assignment_group && typeof item.assignment_group === 'object') {
                delete item.assignment_group.link;
            }
            return { ...item, team: teamName };
        });
    }

    // 3. Write to shared cache — failure here degrades performance, not correctness
    try {
        await cacheSet(INCIDENTS_CACHE_KEY, data, CACHE_TTL);
    } catch (err) {
        log.warn('shared cache write failed, continuing without cache', err.message);
    }

    return data;
}

// --- Helper: Fetch Incidents (local cache → shared cache → ServiceNow) ---
async function fetchIncidents() {
    const local = localIncidents.get('all');
    if (local) return local;

    // Coalesce concurrent misses: only the first caller loads, the rest await it.
    if (!inFlight) {
        inFlight = loadIncidents()
            .then(data => { localIncidents.set('all', data); return data; })
            .finally(() => { inFlight = null; });
    }
    return inFlight;
}

// --- Helper: Parse boolean-like query param ---
function isTrue(value) {
    return String(value).toLowerCase() === 'true';
}

// --- Helper: Apply State Filter ---
function applyStateFilter(incidents, stateParam) {
    if (!stateParam || stateParam.toLowerCase() === 'all') return incidents;

    const states = stateParam.split(',').map(s => s.trim().toLowerCase());

    return incidents.filter(item => {
        const stateVal = String(item.state || '');
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

// --- Helper: Apply System Failure Filter ---
function applySystemFailureFilter(incidents, systemFailureParam) {
    if (!systemFailureParam || systemFailureParam.toLowerCase() === 'all') return incidents;

    const value = systemFailureParam.toLowerCase();

    return incidents.filter(item => {
        const sf = String(item.u_system_failure || '').toLowerCase();
        if (value === 'true')  return sf === 'true'  || item.u_system_failure === 'אמת';
        if (value === 'false') return sf === 'false' || item.u_system_failure === 'שקר';
        return true;
    });
}

// --- Main Route: /metrics ---
router.get('/', async (req, res) => {
    const { team, state, system_failure, details, tag } = req.query;
    try {
        const data = await fetchIncidents();

        // Use cached pre-normalized data
        let processedData = data;

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
                processedData = processedData.filter(item => !String(item.sys_tags || '').includes('פחות קריטי'));
            } else if (team.toLowerCase() !== 'all') {
                processedData = processedData.filter(item =>
                    String(item.team || '').toLowerCase().includes(team.toLowerCase())
                );
            }
        }

        // Filter by State
        processedData = applyStateFilter(processedData, state);

        // Filter by System Failure
        processedData = applySystemFailureFilter(processedData, system_failure);

        // Filter by Tag
        if (tag) {
            processedData = processedData.filter(item => String(item.sys_tags || '').includes(tag));
        }

        if (isTrue(details)) return res.json(processedData);
        return res.json({ count: processedData.length });

    } catch (error) {
        log.error('error in /metrics', error.message);
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
            processedData = processedData.filter(item =>
                String(item.team || '').toLowerCase().includes(team.toLowerCase())
            );
        }

        // State Filter
        processedData = applyStateFilter(processedData, state);

        // System Failure Filter
        processedData = applySystemFailureFilter(processedData, system_failure);

        if (isTrue(details)) return res.json(processedData);
        return res.json({ count: processedData.length });

    } catch (error) {
        log.error('error in /metrics/line-failures', error.message);
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
