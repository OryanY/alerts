// middleware/errorHandler.js - Centralized error handling middleware
const { ERROR } = require('../utils/errorTypes');
const { ResponseFormatter } = require('../utils/ResponseFormatter');

class ApiError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function handleError(res, err) {
  const errorId = Math.random().toString(36).slice(2, 9);

  // Log error for debugging
  console.error(`Error ${errorId}:`, err);

  // Joi validation errors
  if (err.isJoi) {
    const response = ResponseFormatter.validationError(
      err.details?.map(d => d.message) || [],
      'Request validation failed'
    );
    response.error.errorId = errorId;
    return res.status(400).json(response);
  }

  // Custom API errors
  if (err instanceof ApiError) {
    const response = ResponseFormatter.error(
      err.code || ERROR.INTERNAL,
      err.message,
      err.status || 400,
      { errorId }
    );
    return res.status(err.status || 400).json(response);
  }

  // MongoDB errors
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    const response = ResponseFormatter.error(
      ERROR.DB_QUERY,
      'Database operation failed',
      500,
      { errorId }
    );
    return res.status(500).json(response);
  }

  // Database connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEOUT') {
    const response = ResponseFormatter.error(
      ERROR.DB_CONN,
      'Database temporarily unavailable',
      503,
      { errorId }
    );
    return res.status(503).json(response);
  }

  // SQL Server errors
  if (err.number || err.originalError) {
    const response = ResponseFormatter.error(
      ERROR.DB_QUERY,
      'Database query failed',
      500,
      { errorId, sqlErrorNumber: err.number }
    );
    return res.status(500).json(response);
  }

  // Date validation errors
  if (err.message && err.message.includes('DATE_RANGE_INVALID')) {
    const response = ResponseFormatter.error(
      ERROR.DATE_RANGE,
      err.message.replace('DATE_RANGE_INVALID: ', ''),
      400,
      { errorId }
    );
    return res.status(400).json(response);
  }

  // Duration validation errors
  if (err.message && err.message.includes('DURATION_INVALID')) {
    const response = ResponseFormatter.error(
      ERROR.DURATION,
      err.message.replace('DURATION_INVALID: ', ''),
      400,
      { errorId }
    );
    return res.status(400).json(response);
  }

  // Generic internal error
  const response = ResponseFormatter.error(
    ERROR.INTERNAL,
    process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message,
    500,
    { errorId }
  );
  return res.status(500).json(response);
}

// Express error handling middleware
function errorMiddleware(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  
  return handleError(res, err);
}

module.exports = { handleError, ApiError, errorMiddleware };