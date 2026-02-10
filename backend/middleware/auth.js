// middleware/auth.js - Windows Authentication with development mode support
const nodeSSPI = require('node-sspi');

/**
 * Authentication middleware that supports:
 * - Windows Authentication (production/domain)
 * - Development mode bypass (localhost)
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const devBypassEnabled = process.env.AUTH_DEV_BYPASS === 'true';

// Windows Authentication configuration
const nodeSSPIObj = new nodeSSPI({
    retrieveGroups: true,
    offerBasic: false,
    offerNTLM: true,
    authoritative: true
});

// The middleware function itself
const windowsAuthMiddleware = (req, res, next) => {
    nodeSSPIObj.authenticate(req, res, next);
};

/**
 * Main authentication middleware
 * Uses Windows Auth in production, allows bypass in development
 */
// Import CONFIG
const { CONFIG } = require('../config');

// ... (existing code)

function authenticate(req, res, next) {
    // Development mode bypass
    if (isDevelopment && devBypassEnabled) {
        console.log('[AUTH] Development mode - bypassing Windows Authentication');

        // Mock user for development
        req.user = {
            username: process.env.DEV_USERNAME || 'dev-user',
            domain: process.env.DEV_DOMAIN || 'DEV',
            groups: process.env.DEV_GROUPS ? process.env.DEV_GROUPS.split(',') : (CONFIG.auth.devGroups || ['Admins']),
            isDev: true
        };

        return next();
    }

    // Production: Use Windows Authentication
    // Production: Use Windows Authentication
    windowsAuthMiddleware(req, res, (err) => {
        // If the middleware already sent a response (e.g. 401 challenge), verify we don't double-send
        if (res.headersSent || res.finished) {
            return;
        }

        if (err) {
            console.error('[AUTH] Windows Authentication failed:', err);
            return res.status(401).json({
                success: false,
                error: 'Authentication failed',
                message: 'Unable to authenticate with Windows credentials'
            });
        }

        // Extract user info from Windows Auth
        if (req.connection && req.connection.user) {
            const userParts = req.connection.user.split('\\');

            req.user = {
                username: userParts[1] || req.connection.user,
                domain: userParts[0] || 'UNKNOWN',
                fullName: req.connection.user,
                sid: req.connection.userSid,
                groups: req.connection.userGroups || [],
                isDev: false
            };

            if (isDevelopment) {
                console.log(`[AUTH] Authenticated user: ${req.user.fullName}`);
            }
            next();
        } else {
            return res.status(401).json({
                success: false,
                error: 'Authentication required',
                message: 'No Windows credentials provided'
            });
        }
    });
}

/**
 * Role-based authorization middleware
 * Checks if user belongs to required groups
 */
function requireRole(...allowedGroups) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: 'Authentication required'
            });
        }

        // In development mode, allow all roles
        if (req.user.isDev) {
            console.log(`[AUTH] Dev mode - allowing access to ${req.path}`);
            return next();
        }

        // Check if user has any of the allowed groups
        const userGroups = req.user.groups.map(g =>
            typeof g === 'string' ? g.toLowerCase() : g
        );

        const hasRole = allowedGroups.some(role => {
            const roleLower = role.toLowerCase();
            return userGroups.some(group =>
                group.includes(roleLower) || group.endsWith(`\\${roleLower}`)
            );
        });

        if (!hasRole) {
            console.warn(`[AUTH] Access denied for ${req.user.fullName} to ${req.path}`);
            console.warn(`[AUTH] Required roles: ${allowedGroups.join(', ')}`);
            console.warn(`[AUTH] User groups: ${userGroups.join(', ')}`);

            return res.status(403).json({
                success: false,
                error: 'Insufficient permissions',
                message: `This action requires one of the following roles: ${allowedGroups.join(', ')}`,
                requiredRoles: allowedGroups,
                userGroups: req.user.groups
            });
        }

        next();
    };
}

/**
 * Optional authentication - sets user if available but doesn't require it
 * Useful for endpoints that show different data based on user role
 */
function optionalAuth(req, res, next) {
    if (isDevelopment && devBypassEnabled) {
        req.user = {
            username: 'dev-admin',
            domain: 'DEV',
            fullName: 'DEV\\dev-admin',
            groups: ['Admins'],
            isDev: true
        };
        return next();
    }

    windowsAuthMiddleware(req, res, (err) => {
        // If headers sent (e.g. 401 challenge), we stop. Browser will re-send with creds.
        if (res.headersSent || res.finished) {
            return;
        }

        if (!err && req.connection && req.connection.user) {
            const userParts = req.connection.user.split('\\');
            req.user = {
                username: userParts[1] || req.connection.user,
                domain: userParts[0] || 'UNKNOWN',
                fullName: req.connection.user,
                groups: req.connection.userGroups || [],
                isDev: false
            };
        }
        // Continue even if auth fails
        next();
    });
}

/**
 * Logs user actions for security/compliance
 */
function auditLog(action) {
    return (req, res, next) => {
        const user = req.user ? req.user.fullName || req.user.username : 'anonymous';
        const timestamp = new Date().toISOString();

        console.log(`[AUDIT] ${timestamp} | User: ${user} | Action: ${action} | Path: ${req.path}`);

        // You can extend this to write to a database or file
        // For now, just console logging

        next();
    };
}

module.exports = {
    authenticate,
    requireRole,
    optionalAuth,
    auditLog
};
