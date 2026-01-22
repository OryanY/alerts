// utils/errors.js - Custom error classes for better error handling
/**
 * Custom Error Classes
 * Provides semantic error types with automatic HTTP status codes
 * @module errors
 */

const { HTTP_STATUS, ERROR_CODES } = require('./constants');

/**
 * Base application error class
 */
class AppError extends Error {
    /**
     * @param {string} message - Error message
     * @param {number} status - HTTP status code
     * @param {string} code - Error code from ERROR_CODES
     */
    constructor(message, status = HTTP_STATUS.INTERNAL_ERROR, code = ERROR_CODES.INTERNAL_ERROR) {
        super(message);
        this.name = this.constructor.name;
        this.status = status;
        this.code = code;
        this.isOperational = true; // Distinguishes operational errors from programming errors
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Resource not found error (404)
 */
class NotFoundError extends AppError {
    /**
     * @param {string} resource - Name of the resource that was not found
     */
    constructor(resource = 'Resource') {
        super(`${resource} not found`, HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
}

/**
 * Validation error (400)
 */
class ValidationError extends AppError {
    /**
     * @param {string} message - Validation error message
     * @param {Object} [details] - Validation details
     */
    constructor(message, details = null) {
        super(message, HTTP_STATUS.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR);
        this.details = details;
    }
}

/**
 * Conflict error (409)
 */
class ConflictError extends AppError {
    /**
     * @param {string} message - Conflict description
     */
    constructor(message) {
        super(message, HTTP_STATUS.CONFLICT, ERROR_CODES.CONFLICT);
    }
}

/**
 * Unauthorized error (401)
 */
class UnauthorizedError extends AppError {
    /**
     * @param {string} [message] - Error message
     */
    constructor(message = 'Authentication required') {
        super(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED);
    }
}

/**
 * Database error (500)
 */
class DatabaseError extends AppError {
    /**
     * @param {string} [message] - Error message
     */
    constructor(message = 'Database operation failed') {
        super(message, HTTP_STATUS.INTERNAL_ERROR, ERROR_CODES.DATABASE_ERROR);
    }
}

/**
 * ServiceNow integration error (502)
 */
class ServiceNowError extends AppError {
    /**
     * @param {string} [message] - Error message
     */
    constructor(message = 'ServiceNow integration error') {
        super(message, HTTP_STATUS.SERVICE_UNAVAILABLE, ERROR_CODES.SERVICENOW_ERROR);
    }
}

module.exports = {
    AppError,
    NotFoundError,
    ValidationError,
    ConflictError,
    UnauthorizedError,
    DatabaseError,
    ServiceNowError,
};
