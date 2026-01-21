/**
 * routeHandler.js - Unified factory for creating consistent, cached API route handlers
 * 
 * Implements: Validation -> Caching -> Service Execution -> Response
 */
const { validateQuery } = require('./validation');
const { cache } = require('../utils/cache');

/**
 * Creates an Express route handler pipeline with built-in:
 * 1. Schema Validation (Joi)
 * 2. Deterministic Caching
 * 3. Service Method Execution
 * 4. Standard Error Handling
 * 
 * @param {Object} schema - Joi validation schema
 * @param {Function} serviceMethod - The service method to execute
 * @param {Object} serviceInstance - The instance to bind `this` to (e.g. alertService)
 * @param {String} cachePrefix - Prefix for cache keys
 * @returns {Array} Express middleware array
 */
function createCachedHandler(schema, serviceMethod, serviceInstance, cachePrefix) {
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
                const result = await serviceMethod.call(serviceInstance, params);

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
 * Generates a deterministic cache key from parameters.
 * Sorts keys to ensure {a:1, b:2} and {b:2, a:1} produce the same key.
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

module.exports = { createCachedHandler };
