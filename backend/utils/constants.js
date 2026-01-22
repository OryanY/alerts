// utils/constants.js - Centralized constants to avoid magic strings
/**
 * Application-wide constants
 * @module constants
 */

/**
 * Default values used when no rule matches
 */
const DEFAULTS = Object.freeze({
    RULE_NAME: 'Base Mapping',
    OPERATIONAL_IMPACT: 'בבדיקה',
    ASSIGNMENT_GROUP: null,
});

/**
 * Rule types for classification
 */
const RULE_TYPES = Object.freeze({
    GLOBAL: 'global',
    SPECIFIC: 'specific',
});

/**
 * HTTP Status codes for clarity
 */
const HTTP_STATUS = Object.freeze({
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
});

/**
 * Error codes for API responses
 */
const ERROR_CODES = Object.freeze({
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    CONFIG_ERROR: 'CONFIG_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    SERVICENOW_ERROR: 'SERVICENOW_ERROR',
});

/**
 * Fields that should not have template variables substituted
 */
const TEMPLATE_EXCLUDED_FIELDS = Object.freeze([
    'assignment_group',
    'service_offering',
    'business_service',
]);

/**
 * Valid fields for distinct value queries
 */
const VALID_DISTINCT_FIELDS = Object.freeze([
    'assignment_group',
    'service_offering',
    'business_service',
    'u_network',
    'u_site',
    'u_impact_technology',
    'u_monitor_identifier',
]);

/**
 * TTL for incident logs in seconds (90 days)
 */
const INCIDENT_LOG_TTL_SECONDS = 90 * 24 * 60 * 60; // 7,776,000 seconds

module.exports = {
    DEFAULTS,
    RULE_TYPES,
    HTTP_STATUS,
    ERROR_CODES,
    TEMPLATE_EXCLUDED_FIELDS,
    VALID_DISTINCT_FIELDS,
    INCIDENT_LOG_TTL_SECONDS,
};
