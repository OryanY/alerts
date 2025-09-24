// utils/ResponseFormatter.js - Standardized response formatting
const { IL_ZONE } = require('./TimeUtils');

class ResponseFormatter {
  /**
   * Format successful response
   */
  static success(data, pagination = null, meta = {}) {
    const response = {
      success: true,
      data,
      meta: {
        timezone: IL_ZONE,
        cached: false,
        timestamp: new Date().toISOString(),
        ...meta,
      },
    };

    if (pagination) {
      response.pagination = pagination;
    }

    return response;
  }

  /**
   * Format error response
   */
  static error(code, message, status = 400, extra = {}) {
    return {
      success: false,
      error: {
        code,
        message,
        status,
        timestamp: new Date().toISOString(),
        ...extra,
      },
    };
  }

  /**
   * Format validation error response
   */
  static validationError(details, message = 'Validation failed') {
    return this.error('VALIDATION_ERROR', message, 400, { details });
  }

  /**
   * Format not found error response
   */
  static notFound(resource = 'Resource') {
    return this.error('NOT_FOUND', `${resource} not found`, 404);
  }

  /**
   * Add cached flag to existing response
   */
  static markCached(response) {
    return {
      ...response,
      meta: {
        ...response.meta,
        cached: true,
      },
    };
  }
}

module.exports = { ResponseFormatter };