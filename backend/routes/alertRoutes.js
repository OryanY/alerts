// routes/alertRoutes.js - Clean route definitions
const express = require('express');
const { validateQuery } = require('../middleware/validation');
const { handleError } = require('../middleware/errorHandler');
const { cache } = require('../utils/cache');
const { alertsSchema } = require('../schemas/alertSchemas');
const AlertService = require('../services/AlertService');

const router = express.Router();
const alertService = new AlertService();

/**
 * Higher-order function to create consistent route handlers
 * Handles: validation -> cache check -> service call -> cache set -> response
 */
function createCachedHandler(schema, serviceMethod, cachePrefix) {
  return [
    validateQuery(schema),
    async (req, res, next) => {
      try {
        const params = req.validatedQuery;

        // Generate deterministic cache key
        const cacheKey = generateCacheKey(cachePrefix, params);

        // Check cache
        const cached = cache.get(cacheKey);
        if (cached) {
          return res.json({
            ...cached,
            meta: { ...cached.meta, cached: true }
          });
        }

        // Call service method
        const result = await serviceMethod.call(alertService, params);

        // Cache result
        cache.set(cacheKey, result);

        // Return response
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  ];
}

/**
 * Generate consistent cache keys
 * Ensures same params = same key regardless of order
 */
function generateCacheKey(prefix, params) {
  const sortedParams = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc[key] = params[key];
      return acc;
    }, {});

  return `${prefix}:${JSON.stringify(sortedParams)}`;
}

// ================== ALERT ENDPOINTS ==================

router.get('/alerts', ...createCachedHandler(
  alertsSchema,
  alertService.getAlerts,
  'alerts'
));

// ================== MOUNT SUB-ROUTERS ==================

const statsRoutes = require('./statsRoutes');
router.use('/stats', statsRoutes);

module.exports = router;