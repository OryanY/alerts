// utils/validateEnv.js - Environment variable validation
/**
 * Environment Validation
 * Fails fast on startup if required environment variables are missing
 * @module validateEnv
 */

const { logger } = require('../utils/logger');

const log = logger.tagged('env');

/**
 * Required environment variables for production
 */
const REQUIRED_ENV_VARS = [
    'SQL_SERVER',
    'SQL_DATABASE',
    'SQL_USER',
    'SQL_PASSWORD',
    'SERVICENOW_URL',
    'SERVICENOW_USERNAME',
    'SERVICENOW_PASSWORD',
    'NODE_ENV',
    'FRONTEND_URL',
];

/**
 * Optional but recommended environment variables
 */
const RECOMMENDED_ENV_VARS = [
    'SQL_POOL_MAX',
    'SQL_POOL_MIN',
    'SQL_PORT',
];

/**
 * Validates environment variables on startup
 * @throws {Error} If required variables are missing in production
 */
function validateEnvironmentVariables() {
    const isProduction = process.env.NODE_ENV === 'production';
    const missing = [];
    const warnings = [];

    // Check required variables
    for (const envVar of REQUIRED_ENV_VARS) {
        if (!process.env[envVar]) {
            missing.push(envVar);
        }
    }

    // Check recommended variables
    for (const envVar of RECOMMENDED_ENV_VARS) {
        if (!process.env[envVar]) {
            warnings.push(envVar);
        }
    }

    // In production, fail fast if required vars are missing
    if (isProduction && missing.length > 0) {
        log.error(`missing required environment variables: ${missing.join(', ')}`);
        process.exit(1);
    }

    // In development, just warn
    if (!isProduction && missing.length > 0) {
        log.warn(`missing required environment variables (required in production): ${missing.join(', ')}`);
    }

    // Always warn about recommended vars
    if (warnings.length > 0) {
        log.warn(`missing recommended environment variables: ${warnings.join(', ')}`);
    }

    log.info(`environment: ${process.env.NODE_ENV || 'development'}`);
}

module.exports = { validateEnvironmentVariables, REQUIRED_ENV_VARS, RECOMMENDED_ENV_VARS };
