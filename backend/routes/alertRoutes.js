// routes/alertRoutes.js
const express = require('express');
const { validateQuery } = require('../middleware/validation');
const { handleError } = require('../middleware/errorHandler');
const { cache } = require('../utils/cache');
const { alertsSchema } = require('../schemas/alertSchemas');
const AlertService = require('../services/AlertService');

// Use a shared instance if stateless, or per-request if stateful.
// Since AlertService is currently stateless (DB pool is external), one instance is fine.
const alertService = new AlertService();
const router = express.Router();

/**
 * Higher-order function to standardize route logic:
 * Validation -> Cache Check -> Service Call -> Cache Set -> Response
 * * @param {Object} schema - Joi validation schema
 * @param {Function} serviceMethod - Async function from AlertService
 * @param {string} cachePrefix - Prefix for cache key
 */
const createRouteHandler = (schema, serviceMethod, cachePrefix) => {
  return [
    validateQuery(schema),
    async (req, res) => {
      try {
        const params = req.validatedQuery;
        // Ensure consistent key order for cache hits
        const cacheKey = `${cachePrefix}:${JSON.stringify(Object.keys(params).sort().reduce((obj, key) => { 
            obj[key] = params[key]; 
            return obj;
        }, {}))}`;

        const cached = cache.get(cacheKey);
        if (cached) {
          return res.json({ ...cached, meta: { ...cached.meta, cached: true } });
        }

        // Call the service method, binding 'this' to alertService
        const result = await serviceMethod.call(alertService, params);
        
        cache.set(cacheKey, result);
        res.json(result);
      } catch (err) {
        handleError(res, err);
      }
    }
  ];
};

// ================== CORE ALERT ENDPOINTS ==================

// GET /alerts – List with filters/pagination
router.get('/alerts', ...createRouteHandler(alertsSchema, alertService.getAlerts, 'alerts'));

// ================== STATISTICS ENDPOINTS ==================

// Mount stats sub-router
const statsRoutes = require('./statsRoutes');
router.use('/stats', statsRoutes);

// Export the handler helper for use in sub-routers if needed, 
// though typically sub-routers require their own require() calls.
module.exports = router;
module.exports.createRouteHandler = createRouteHandler;