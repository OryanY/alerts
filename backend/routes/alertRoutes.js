// routes/alertRoutes.js - Main router with improved organization
const express = require('express');
const { validateQuery } = require('../middleware/validation');
const { handleError } = require('../middleware/errorHandler');
const { cache } = require('../utils/cache');
const { alertsSchema, recentSchema, statsSchema } = require('../schemas/alertSchemas');
const AlertService = require('../services/AlertService');

const router = express.Router();
const alertService = new AlertService();

// ================== CORE ALERT ENDPOINTS ==================

// GET /alerts – list with filters/pagination, IL-only times
router.get('/alerts', validateQuery(alertsSchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = `alerts:${JSON.stringify(params)}`;
    
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, meta: { ...cached.meta, cached: true } });
    }

    const result = await alertService.getAlerts(params);
    cache.set(cacheKey, result);
    
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// GET /stats/recent-alerts – last X hours, IL-only times
router.get('/stats/recent-alerts', validateQuery(recentSchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = `recent:${JSON.stringify(params)}`;
    
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, meta: { ...cached.meta, cached: true } });
    }

    const result = await alertService.getRecentAlerts(params);
    cache.set(cacheKey, result);
    
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ================== STATISTICS ENDPOINTS ==================

// Import and use stats routes
const statsRoutes = require('./statsRoutes');
router.use('/stats', statsRoutes);

module.exports = router;