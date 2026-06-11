// services/incident/incidentHelpers.js
// Pure functions for rule matching, transforming, and validating incident data.
// Field configuration (required fields, templates, defaults) comes from the
// caller-provided `settings` object (see IncidentSettingsService); the code
// defaults in incidentSettingsDefaults.js are only the fallback.

const { DEFAULT_INCIDENT_SETTINGS } = require('./incidentSettingsDefaults');

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

/**
 * Substitute {{variable}} placeholders in a template with alert values.
 * The allowed variable names come from settings.template_variables.
 */
function replaceTemplateVariables(template, alertData, templateVariables = DEFAULT_INCIDENT_SETTINGS.template_variables) {
    if (!template || typeof template !== 'string') return template;
    let result = template;
    templateVariables.forEach(field => {
        const regex = new RegExp(`\\{\\{\\s*${field}\\s*\\}\\}`, 'g');
        result = result.replace(regex, alertData[field] || '');
    });
    return result;
}

// Mapping/rule document keys that are metadata, never ServiceNow fields.
const NON_INCIDENT_FIELDS = new Set(['_id', 'grafana_names', 'created_at', 'updated_at']);

/**
 * Build the ServiceNow incident payload.
 *
 * Value precedence per field (highest wins):
 *   1. Rule overrides (merged in specificity order by the caller)
 *   2. System mapping fields
 *   3. settings.content_templates (templated from alert data)
 *   4. settings.default_fields (mandatory-field fillers)
 *
 * @param {object} systemMapping  Mongo mapping document for the application
 * @param {object} ruleOverrides  Merged incident_overrides from matching rules
 * @param {object} alertData      Normalized incoming alert
 * @param {object} settings       Incident field configuration (IncidentSettingsService.getSettings())
 */
function buildIncidentData(systemMapping, ruleOverrides = {}, alertData, settings = DEFAULT_INCIDENT_SETTINGS) {
    const requiredFields = settings.required_fields || DEFAULT_INCIDENT_SETTINGS.required_fields;
    const literalFields = new Set(settings.literal_fields || DEFAULT_INCIDENT_SETTINGS.literal_fields);
    const templateVariables = settings.template_variables || DEFAULT_INCIDENT_SETTINGS.template_variables;
    const incidentData = {};

    // 1+2. Required fields: rule override wins over the mapping; must end up non-empty.
    requiredFields.forEach(field => {
        let value = ruleOverrides[field] !== undefined ? ruleOverrides[field] : systemMapping[field];
        if (field === 'u_system_failure') {
            incidentData[field] = parseBoolean(value);
            return;
        }
        if (value && typeof value === 'string' && !literalFields.has(field)) {
            value = replaceTemplateVariables(value, alertData, templateVariables);
        }
        if (!value) {
            throw new Error(`Required field '${field}' is missing (or empty after template)`);
        }
        incidentData[field] = value;
    });

    // 2. Remaining mapping fields (custom fields configured on the mapping).
    Object.entries(systemMapping).forEach(([key, value]) => {
        if (!NON_INCIDENT_FIELDS.has(key) && !requiredFields.includes(key) && value != null && String(value).trim() !== '') {
            incidentData[key] = typeof value === 'string'
                ? replaceTemplateVariables(value, alertData, templateVariables)
                : value;
        }
    });

    // 1. Remaining rule overrides win over mapping fields.
    Object.entries(ruleOverrides).forEach(([key, value]) => {
        if (NON_INCIDENT_FIELDS.has(key) || requiredFields.includes(key)) return;
        if (key === 'u_system_failure') {
            incidentData[key] = parseBoolean(value);
        } else if (value != null && String(value).trim() !== '') {
            incidentData[key] = replaceTemplateVariables(value, alertData, templateVariables);
        }
    });

    // 3. Content templates (short_description, description, ...) when still missing.
    Object.entries(settings.content_templates || {}).forEach(([key, template]) => {
        if (!incidentData[key] && template) {
            incidentData[key] = replaceTemplateVariables(template, alertData, templateVariables);
        }
    });

    // 4. Mandatory-field fillers when still missing.
    Object.entries(settings.default_fields || {}).forEach(([key, value]) => {
        if (!incidentData[key] && value !== '' && value != null) {
            incidentData[key] = typeof value === 'string'
                ? replaceTemplateVariables(value, alertData, templateVariables)
                : value;
        }
    });

    return incidentData;
}

// Legacy application-name rewrites for incoming Grafana alerts (migrated
// from the old Python from_grafana.py). Intentionally hardcoded — these are
// frozen legacy behavior, not configuration.
// `when_contains` (optional): rewrite only when object_name or message
// contains this substring (case-insensitive).
const LEGACY_APPLICATION_REWRITES = [
    { from: 'vmwere', to: 'virtu_cyber', when_contains: 'esx' },
    { from: 'l-twix', to: 'twix' }
];

/**
 * Normalize a raw Grafana alert before mapping/rule evaluation:
 * - '%' breaks ServiceNow payloads → replaced with ' percent '
 * - legacy application renames (LEGACY_APPLICATION_REWRITES)
 * - object_name lowercased
 */
function normalizeGrafanaAlert(rawAlert) {
    const message = String(rawAlert.message || '').replace(/%/g, ' percent ');
    let application = rawAlert.application;

    const haystack = `${rawAlert.object_name || ''} ${message}`.toLowerCase();
    for (const rule of LEGACY_APPLICATION_REWRITES) {
        if (application !== rule.from) continue;
        if (rule.when_contains && !haystack.includes(String(rule.when_contains).toLowerCase())) continue;
        application = rule.to;
        break;
    }

    return {
        ...rawAlert,
        application,
        message,
        object_name: String(rawAlert.object_name || '').toLowerCase()
    };
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
    normalizeGrafanaAlert,
    matchesGrafanaPattern,
    calculateRuleSpecificity,
    checkFieldConditions,
    evaluateFieldResults,
    doesAlertMatchRule,
    findAllMatches,
    validateRuleConditions
};