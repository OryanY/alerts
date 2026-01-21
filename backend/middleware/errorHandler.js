// middleware/errorHandler.js
// Centralized error handling with proper error classification and logging

const { ERROR } = require('../utils/errorTypes');
const { ResponseFormatter } = require('../utils/ResponseFormatter');

// Custom error class for API errors
class ApiError extends Error {
  constructor(code, message, status = 400, details = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Error classification helpers
const ErrorClassifier = {
  isValidationError(err) {
    return err.isJoi || err.name === 'ValidationError';
  },

  isDatabaseError(err) {
    return err.name === 'MongoError' ||
      err.name === 'MongoServerError' ||
      err.number !== undefined ||
      err.originalError !== undefined;
  },

  isConnectionError(err) {
    return err.code === 'ECONNREFUSED' ||
      err.code === 'ETIMEOUT' ||
      err.code === 'ETIMEDOUT';
  },

  isDateRangeError(err) {
    return err.message?.includes('DATE_RANGE_INVALID');
  },

  isDurationError(err) {
    return err.message?.includes('DURATION_INVALID');
  }
};

// Generate unique error ID for tracking
function generateErrorId() {
  return `err_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// Log error with appropriate level
function logError(errorId, error, req = null) {
  const logData = {
    errorId,
    timestamp: new Date().toISOString(),
    error: {
      name: error.name,
      message: error.message,
      code: error.code,
      status: error.status
    }
  };

  if (req) {
    logData.request = {
      method: req.method,
      path: req.path,
      query: req.query,
      ip: req.ip
    };
  }

  if (process.env.NODE_ENV === 'development') {
    logData.stack = error.stack;
  }

  // Use appropriate log level based on error type
  if (error.status >= 500) {
    console.error('Server Error:', JSON.stringify(logData, null, 2));
  } else if (error.status >= 400) {
    console.warn('Client Error:', JSON.stringify(logData, null, 2));
  } else {
    console.info('Error:', JSON.stringify(logData, null, 2));
  }
}

// Main error handler function
function handleError(res, err, req = null) {
  const errorId = generateErrorId();
  logError(errorId, err, req);

  // Joi validation errors
  if (ErrorClassifier.isValidationError(err)) {
    const response = ResponseFormatter.validationError(
      err.details?.map(d => d.message) || [err.message],
      'Request validation failed'
    );
    response.error.errorId = errorId;
    return res.status(400).json(response);
  }

  // Custom API errors
  if (err instanceof ApiError) {
    const response = ResponseFormatter.error(
      err.code,
      err.message,
      err.status,
      { errorId, details: err.details }
    );
    return res.status(err.status).json(response);
  }

  // Database errors
  if (ErrorClassifier.isDatabaseError(err)) {
    const response = ResponseFormatter.error(
      ERROR.DB_QUERY,
      'Database operation failed',
      500,
      { errorId, sqlErrorNumber: err.number }
    );
    return res.status(500).json(response);
  }

  // Connection errors
  if (ErrorClassifier.isConnectionError(err)) {
    const response = ResponseFormatter.error(
      ERROR.DB_CONN,
      'Service temporarily unavailable',
      503,
      { errorId }
    );
    return res.status(503).json(response);
  }

  // Date range errors
  if (ErrorClassifier.isDateRangeError(err)) {
    const response = ResponseFormatter.error(
      ERROR.DATE_RANGE,
      err.message.replace('DATE_RANGE_INVALID: ', ''),
      400,
      { errorId }
    );
    return res.status(400).json(response);
  }

  // Duration errors
  if (ErrorClassifier.isDurationError(err)) {
    const response = ResponseFormatter.error(
      ERROR.DURATION,
      err.message.replace('DURATION_INVALID: ', ''),
      400,
      { errorId }
    );
    return res.status(400).json(response);
  }

  // Generic internal error
  const isDevelopment = process.env.NODE_ENV === 'development';
  const response = ResponseFormatter.error(
    ERROR.INTERNAL,
    isDevelopment ? err.message : 'An unexpected error occurred',
    500,
    {
      errorId,
      ...(isDevelopment && { stack: err.stack })
    }
  );

  return res.status(500).json(response);
}

// Express error handling middleware
function errorMiddleware(err, req, res, next) {
  // Skip if response already sent
  if (res.headersSent) {
    return next(err);
  }

  return handleError(res, err, req);
}

// Global error handler for unhandled rejections
function setupGlobalErrorHandlers() {
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection:', {
      timestamp: new Date().toISOString(),
      reason: reason,
      promise: promise
    });
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', {
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });

    // Give time to log then exit
    setTimeout(() => process.exit(1), 1000);
  });
}

module.exports = {
  handleError,
  ApiError,
  errorMiddleware,
  setupGlobalErrorHandlers,
  ErrorClassifier
};