// services/incident/IncidentTransformService.js - Data transformation and validation
/**
 * IncidentTransformService - Handles data transformation and validation
 * Single Responsibility: Transform and validate incident data
 */
class IncidentTransformService {
    /**
     * Parse boolean values from various formats
     */
    parseBoolean(value) {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'string') {
            return value.toLowerCase() === 'true' || value === '1';
        }
        return Boolean(value);
    }

    /**
     * Sanitize Grafana names (convert to lowercase, trim, deduplicate)
     */
    sanitizeGrafanaNames(names) {
        if (!names) return [];

        // Handle both string (comma-separated) and array inputs
        let namesArray = Array.isArray(names) ? names : names.split(',');

        // Clean, deduplicate, and sort
        return [...new Set(
            namesArray
                .map(name => String(name).trim().toLowerCase())
                .filter(name => name.length > 0)
        )].sort();
    }

    /**
     * Validate Grafana names
     */
    validateGrafanaNames(names) {
        const sanitized = this.sanitizeGrafanaNames(names);

        if (sanitized.length === 0) {
            throw new Error('At least one Grafana application name is required');
        }

        // Check for invalid characters
        const invalidNames = sanitized.filter(name =>
            /[^a-z0-9_-]/.test(name)
        );

        if (invalidNames.length > 0) {
            throw new Error(
                `Invalid Grafana names (only lowercase letters, numbers, hyphens, and underscores allowed): ${invalidNames.join(', ')}`
            );
        }

        return sanitized;
    }

    /**
     * Sanitize a single Grafana pattern
     */
    sanitizeGrafanaPattern(pattern) {
        if (!pattern || typeof pattern === 'string') {
            // Legacy support: string becomes exact match
            return {
                value: (pattern || '').trim().toLowerCase(),
                type: 'exact'
            };
        }

        return {
            value: (pattern.value || '').trim().toLowerCase(),
            type: pattern.type || 'exact'
        };
    }

    /**
     * Validate Grafana patterns (exact, contains, regex)
     */
    validateGrafanaPatterns(patterns) {
        if (!Array.isArray(patterns) && typeof patterns === 'string') {
            // Convert old format
            patterns = patterns.split(',').map(p => p.trim()).filter(Boolean);
        }

        if (!Array.isArray(patterns) || patterns.length === 0) {
            throw new Error('At least one Grafana application pattern is required');
        }

        const sanitized = patterns.map(p => this.sanitizeGrafanaPattern(p));

        // Validate each pattern
        for (const pattern of sanitized) {
            if (!pattern.value) {
                throw new Error('Pattern value cannot be empty');
            }

            // Validate based on type
            if (pattern.type === 'regex') {
                try {
                    new RegExp(pattern.value, 'i');
                } catch (e) {
                    throw new Error(`Invalid regex pattern "${pattern.value}": ${e.message}`);
                }
            } else if (pattern.type === 'exact') {
                // Only exact matches need strict character validation
                if (!/^[a-z0-9_-]+$/.test(pattern.value)) {
                    throw new Error(
                        `Invalid exact match pattern "${pattern.value}": only lowercase letters, numbers, hyphens, and underscores allowed`
                    );
                }
            }
            // 'contains' type can have any characters
        }

        return sanitized;
    }

    /**
     * Replace template variables in a string with alert data
     * Supports: {{application}}, {{object_name}}, {{node_name}}, etc.
     */
    replaceTemplateVariables(template, alertData) {
        if (!template || typeof template !== 'string') return template;

        const validFields = [
            'application',
            'object_name',
            'node_name',
            'message',
            'time_created',
            'operator',
            'network'
        ];

        let result = template;

        validFields.forEach(field => {
            const regex = new RegExp(`\\{\\{${field}\\}\\}`, 'g');
            result = result.replace(regex, alertData[field] || '');
        });

        return result;
    }

    /**
     * Build incident data from system mapping, rule overrides, and alert data
     * @param {Object} systemMapping - Base system mapping
     * @param {Object} ruleOverrides - Optional rule-specific overrides
     * @param {Object} alertData - Alert data for template variables
     * @returns {Object} Complete incident data ready for ServiceNow
     */
    buildIncidentData(systemMapping, ruleOverrides = {}, alertData) {
        const baseRequired = [
            'service_offering',
            'business_service',
            'u_network',
            'assignment_group',
            'u_system_failure'
        ];

        const excludeFields = new Set([
            '_id',
            'grafana_names',
            'created_at',
            'updated_at'
        ]);

        const incidentData = {};

        // 1. Add base required fields
        baseRequired.forEach(field => {
            let value = ruleOverrides[field] !== undefined
                ? ruleOverrides[field]
                : systemMapping[field];

            if (field === 'u_system_failure') {
                incidentData[field] = this.parseBoolean(value);
            } else if (!value && field !== 'u_system_failure') {
                throw new Error(`Required field '${field}' is missing`);
            } else if (field !== 'u_system_failure') {
                incidentData[field] = value;
            }
        });

        // 2. Add all custom fields from mapping
        Object.entries(systemMapping).forEach(([key, value]) => {
            if (!excludeFields.has(key) &&
                !baseRequired.includes(key) &&
                value != null &&
                String(value).trim() !== '') {
                incidentData[key] = value;
            }
        });

        // 3. Apply rule overrides with template replacement
        Object.entries(ruleOverrides).forEach(([key, value]) => {
            if (!excludeFields.has(key)) {
                if (key === 'u_system_failure') {
                    incidentData[key] = this.parseBoolean(value);
                } else if (value != null && String(value).trim() !== '') {
                    incidentData[key] = this.replaceTemplateVariables(value, alertData);
                }
            }
        });

        // 4. Add default descriptions if not provided
        if (!incidentData.short_description) {
            incidentData.short_description = `קפצה התראה על: ${alertData.object_name} בניטור של - ${alertData.application}`;
        }

        if (!incidentData.description) {
            const descParts = [
                `ההתראה:`,
                `${alertData.message}`,
            ];

            incidentData.description = descParts.join('\n        ');
        }

        // 5. Add default operational impact if not present
        if (!incidentData.u_operational_impact) {
            incidentData.u_operational_impact = "בבדיקה";
        }

        return incidentData;
    }

    /**
     * Validate required fields in incident data
     */
    validateIncidentData(incidentData) {
        const required = [
            'service_offering',
            'business_service',
            'u_network',
            'assignment_group'
        ];

        const missing = required.filter(field => !incidentData[field]);

        if (missing.length > 0) {
            throw new Error(`Missing required fields: ${missing.join(', ')}`);
        }

        return true;
    }
}

module.exports = { IncidentTransformService };
