// utils/validateEnv.js - Environment variable validation
/**
 * Environment Validation
 * Fails fast on startup if required environment variables are missing
 * @module validateEnv
 */

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
        console.error('❌ Missing required environment variables:');
        missing.forEach(v => console.error(`   - ${v}`));
        process.exit(1);
    }

    // In development, just warn
    if (!isProduction && missing.length > 0) {
        console.warn('⚠️  Missing required environment variables (required in production):');
        missing.forEach(v => console.warn(`   - ${v}`));
    }

    // Always warn about recommended vars
    if (warnings.length > 0) {
        console.warn('⚠️  Missing recommended environment variables:');
        warnings.forEach(v => console.warn(`   - ${v}`));
    }

    // Log environment info
    console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
}

module.exports = { validateEnvironmentVariables, REQUIRED_ENV_VARS, RECOMMENDED_ENV_VARS };
