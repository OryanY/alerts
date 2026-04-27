// services/incident/incidentHelpers.js
// Pure functions for rule matching, transforming, and validating incident data

// ================== TRANSFORM HELPERS ==================

function parseBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true' || value === '1';
    return Boolean(value);
}

function sanitizeGrafanaPattern(pattern) {
    if (!pattern || typeof pattern === 'string') {
        return { value: (pattern || '').trim().toLowerCase(), type: 'exact' };
    }
    return { value: (pattern.value || '').trim().toLowerCase(), type: pattern.type || 'exact' };
}

function validateGrafanaPatterns(patterns) {
    if (!Array.isArray(patterns) && typeof patterns === 'string') {
        patterns = patterns.split(',').map(p => p.trim()).filter(Boolean);
    }
    if (!Array.isArray(patterns) || patterns.length === 0) {
        throw new Error('At least one Grafana application pattern is required');
    }

    const sanitized = patterns.map(sanitizeGrafanaPattern);

    for (const pattern of sanitized) {
        if (!pattern.value) throw new Error('Pattern value cannot be empty');
        if (pattern.type === 'regex') {
            try { new RegExp(pattern.value, 'i'); } 
            catch (e) { throw new Error(`Invalid regex pattern "${pattern.value}": ${e.message}`); }
        } else if (pattern.type === 'exact') {
            if (!/^[a-z0-9_-]+$/.test(pattern.value)) {
                throw new Error(`Invalid exact match pattern "${pattern.value}": only lowercase letters, numbers, hyphens, and underscores allowed`);
            }
        }
    }
    return sanitized;
}

function replaceTemplateVariables(template, alertData) {
    if (!template || typeof template !== 'string') return template;
    const validFields = ['application', 'object_name', 'node_name', 'message', 'time_created', 'operator', 'network'];
    let result = template;
    validFields.forEach(field => {
        const regex = new RegExp(`\\{\\{\\s*${field}\\s*\\}\\}`, 'g');
        result = result.replace(regex, alertData[field] || '');
    });
    return result;
}

function buildIncidentData(systemMapping, ruleOverrides = {}, alertData) {
    const baseRequired = ['service_offering', 'business_service', 'u_network', 'assignment_group', 'u_system_failure'];
    const excludeFields = new Set(['_id', 'grafana_names', 'created_at', 'updated_at']);
    const incidentData = {};

    baseRequired.forEach(field => {
        let value = ruleOverrides[field] !== undefined ? ruleOverrides[field] : systemMapping[field];
        if (field === 'u_system_failure') {
            incidentData[field] = parseBoolean(value);
        } else {
            const skipTemplates = ['assignment_group', 'service_offering', 'business_service'];
            if (value && typeof value === 'string' && !skipTemplates.includes(field)) {
                value = replaceTemplateVariables(value, alertData);
            }
            if (!value && field !== 'u_system_failure') {
                throw new Error(`Required field '${field}' is missing (or empty after template)`);
            }
            incidentData[field] = value;
        }
    });

    Object.entries(systemMapping).forEach(([key, value]) => {
        if (!excludeFields.has(key) && !baseRequired.includes(key) && value != null && String(value).trim() !== '') {
            incidentData[key] = typeof value === 'string' ? replaceTemplateVariables(value, alertData) : value;
        }
    });

    Object.entries(ruleOverrides).forEach(([key, value]) => {
        if (!excludeFields.has(key) && !baseRequired.includes(key)) {
            if (key === 'u_system_failure') {
                incidentData[key] = parseBoolean(value);
            } else if (value != null && String(value).trim() !== '') {
                incidentData[key] = replaceTemplateVariables(value, alertData);
            }
        }
    });

    if (!incidentData.short_description) {
        incidentData.short_description = `קפצה התראה על: ${alertData.object_name} בניטור של - ${alertData.application}`;
    }

    if (!incidentData.description) {
        incidentData.description = `ההתראה:\n        ${alertData.message}`;
    }

    if (!incidentData.u_perational_impact) {
        incidentData.u_perational_impact = "בבדיקה";
    }
    if (!incidentData.u_perational_impact) {
        incidentData.u_perational_impact = "בבדיקה";
    }
    if (!incidentData.u_phone_voip) {
        incidentData.u_phone_voip = "1234";
    }
    if (!incidentData.u_mobile_phone) {
        incidentData.u_mobile_phone = "1234";
    }
    if (!incidentData.u_computer_name) {
        incidentData.u_computer_name = "My Computer";
    }
    return incidentData;
}

// ================== RULE HELPERS ==================

function matchesGrafanaPattern(applicationName, pattern) {
    const normalizedApp = applicationName.toLowerCase();
    const normalizedPattern = pattern.value.toLowerCase();
    switch (pattern.type) {
        case 'exact': return normalizedApp === normalizedPattern;
        case 'contains': return normalizedApp.includes(normalizedPattern);
        case 'regex':
            try { return new RegExp(normalizedPattern, 'i').test(applicationName); } 
            catch (e) { return false; }
        default: return normalizedApp === normalizedPattern;
    }
}

function calculateRuleSpecificity(rule) {
    const { conditions } = rule;
    let score = 0;
    Object.keys(conditions).forEach(key => {
        if (key.endsWith('_exact')) score += 10;
        else if (key.endsWith('_regex')) score += 7;
        else if (key.endsWith('_contains')) score += 3 * (conditions[key]?.length || 1);
    });
    if (!rule.is_global) score += 100;
    return score;
}

function checkFieldConditions(value, conditions, fieldPrefix) {
    const results = [];
    if (conditions[`${fieldPrefix}_contains`]?.length) {
        conditions[`${fieldPrefix}_contains`].forEach(term => {
            results.push(value && value.toLowerCase().includes(term.toLowerCase()));
        });
    }
    if (conditions[`${fieldPrefix}_exact`]) {
        results.push(value && value.toLowerCase() === conditions[`${fieldPrefix}_exact`].toLowerCase());
    }
    if (conditions[`${fieldPrefix}_regex`]) {
        try {
            const regex = new RegExp(conditions[`${fieldPrefix}_regex`], 'i');
            results.push(value && regex.test(value));
        } catch (e) {
            results.push(false);
        }
    }
    return results;
}

function evaluateFieldResults(results, logicOperator) {
    if (results.length === 0) return null;
    if (logicOperator === 'AND' && results.length > 1) return results.every(r => r === true);
    return results.some(r => r === true);
}

function doesAlertMatchRule(alertData, rule) {
    const { conditions, logic_operator = 'OR' } = rule;
    const conditionGroups = [];

    ['message', 'node_name', 'object_name', 'operator'].forEach(field => {
        const match = evaluateFieldResults(checkFieldConditions(alertData[field], conditions, field), logic_operator);
        if (match !== null) conditionGroups.push(match);
    });

    const networkMatch = evaluateFieldResults(checkFieldConditions(alertData.network, conditions, 'network'), logic_operator);
    if (networkMatch !== null) {
        conditionGroups.push(networkMatch);
    } else if (conditions.network) {
        conditionGroups.push(alertData.network && alertData.network.toLowerCase().includes(conditions.network.toLowerCase()));
    }

    if (conditionGroups.length === 0) return false;
    return logic_operator === 'AND' ? conditionGroups.every(r => r === true) : conditionGroups.some(r => r === true);
}

function findAllMatches(alertData, rules) {
    if (!rules || rules.length === 0) return [];
    const matches = rules
        .filter(rule => doesAlertMatchRule(alertData, rule))
        .map(rule => ({ rule, score: calculateRuleSpecificity(rule), is_global: !!rule.is_global }));
    matches.sort((a, b) => b.score - a.score);
    return matches;
}

function validateRuleConditions(conditions) {
    const regexFields = ['message_regex', 'node_name_regex', 'object_name_regex', 'network_regex', 'operator_regex'];
    regexFields.forEach(field => {
        if (conditions[field]) {
            try { new RegExp(conditions[field]); } 
            catch (e) { throw new Error(`Invalid regex pattern in ${field}: ${e.message}`); }
        }
    });
}

module.exports = {
    parseBoolean,
    sanitizeGrafanaPattern,
    validateGrafanaPatterns,
    replaceTemplateVariables,
    buildIncidentData,
    matchesGrafanaPattern,
    calculateRuleSpecificity,
    checkFieldConditions,
    evaluateFieldResults,
    doesAlertMatchRule,
    findAllMatches,
    validateRuleConditions
};