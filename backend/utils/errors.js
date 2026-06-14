// utils/errors.js
// Typed errors so controllers/middleware can map errors to HTTP responses
// by class instead of string-matching err.message.

class AppError extends Error {
    constructor(message, status = 500, code = 'INTERNAL_ERROR') {
        super(message);
        this.name = this.constructor.name;
        this.status = status;
        this.code = code;
    }
}

/** Resource does not exist (mapping, rule, log...). Maps to HTTP 404. */
class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, 'NOT_FOUND');
    }
}

/**
 * No system mapping matched the alert's application.
 * Separate class because webhook (HTML) flows render a special
 * "create a mapping" action button for this case.
 */
class MappingNotFoundError extends NotFoundError {
    constructor(message = 'No system mapping found') {
        super(message);
        this.code = 'NO_SYSTEM_MAPPING';
    }
}

/** Resource already exists / dependent resources block the operation. Maps to HTTP 409. */
class ConflictError extends AppError {
    constructor(message = 'Conflict') {
        super(message, 409, 'CONFLICT');
    }
}

/** Bad input that passed schema validation but failed a business rule. Maps to HTTP 400. */
class ValidationError extends AppError {
    constructor(message = 'Validation failed') {
        super(message, 400, 'VALIDATION_ERROR');
    }
}

/**
 * ServiceNow rejected the request or was unreachable/disabled when creating a
 * record. Thrown so callers never receive a 200 "created" for a ticket that
 * was never created. Maps to HTTP 502 by default.
 */
class ServiceNowError extends AppError {
    constructor(message = 'ServiceNow request failed', status = 502) {
        super(message, status, 'SERVICENOW_ERROR');
    }
}

module.exports = { AppError, NotFoundError, MappingNotFoundError, ConflictError, ValidationError, ServiceNowError };
