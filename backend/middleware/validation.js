// middleware/validation.js - Request validation middleware
const { ResponseFormatter } = require('../utils/ResponseFormatter');

const validateQuery = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.query);
  if (error) {
    const response = ResponseFormatter.validationError(
      error.details.map(d => d.message),
      'Request validation failed'
    );
    return res.status(400).json(response);
  }
  req.validatedQuery = value;
  next();
};

const validateBody = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body);
  if (error) {
    const response = ResponseFormatter.validationError(
      error.details.map(d => d.message),
      'Request body validation failed'
    );
    return res.status(400).json(response);
  }
  req.validatedBody = value;
  next();
};

const validateParams = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.params);
  if (error) {
    const response = ResponseFormatter.validationError(
      error.details.map(d => d.message),
      'Request parameters validation failed'
    );
    return res.status(400).json(response);
  }
  req.validatedParams = value;
  next();
};

module.exports = { validateQuery, validateBody, validateParams };