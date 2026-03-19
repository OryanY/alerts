// middleware/validation.js - Request validation middleware

const validateQuery = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.query);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Request validation failed',
      details: error.details.map(d => d.message)
    });
  }
  req.validatedQuery = value;
  next();
};

const validateBody = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Request body validation failed',
      details: error.details.map(d => d.message)
    });
  }
  req.validatedBody = value;
  next();
};

const validateParams = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.params);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Request parameters validation failed',
      details: error.details.map(d => d.message)
    });
  }
  req.validatedParams = value;
  next();
};

module.exports = { validateQuery, validateBody, validateParams };