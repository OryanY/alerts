// routes/statsRoutes.js - Statistics-specific routes
const express = require('express');
const { validateQuery } = require('../middleware/validation');
const { handleError } = require('../middleware/errorHandler');
const { cache } = require('../utils/cache');
const { 
  statsSchema, 
  panelStatsSchema, 
  timeseriesSchema 
} = require('../schemas/alertSchemas');
const AlertService = require('../services/AlertService');
const router = express.Router();
const alertService = new AlertService();

// ================== EXECUTIVE/SUMMARY STATS ==================

// Executive KPIs - computed in JS using IL-hour (DST-safe)
router.get('/executive-kpis', validateQuery(statsSchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = `kpis:${JSON.stringify(params)}`;
    
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, meta: { ...cached.meta, cached: true } });
    }

    const result = await alertService.getExecutiveKPIs(params);
    cache.set(cacheKey, result);
    
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// Overview statistics
router.get('/overview', validateQuery(statsSchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = `overview:${JSON.stringify(params)}`;
    
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, meta: { ...cached.meta, cached: true } });
    }

    const result = await alertService.getOverviewStats(params);
    cache.set(cacheKey, result);
    
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ================== TEMPORAL ANALYSIS ==================

// Weekend vs Weekday comparison
router.get('/weekend-weekday', validateQuery(statsSchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = `weekend-weekday:${JSON.stringify(params)}`;
    
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, meta: { ...cached.meta, cached: true } });
    }

    const result = await alertService.getWeekendWeekdayStats(params);
    cache.set(cacheKey, result);
    
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// Hourly distribution heatmap
router.get('/hourly-heatmap', validateQuery(statsSchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = `hourly-heatmap:${JSON.stringify(params)}`;
    
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, meta: { ...cached.meta, cached: true } });
    }

    const result = await alertService.getHourlyHeatmap(params);
    cache.set(cacheKey, result);
    
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// Hourly breakdown with detailed metrics
router.get('/hourly', validateQuery(statsSchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = `hourly:${JSON.stringify(params)}`;
    
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, meta: { ...cached.meta, cached: true } });
    }

    const result = await alertService.getHourlyStats(params);
    cache.set(cacheKey, result);
    
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// Time series data (per IL day)
router.get('/timeseries', validateQuery(timeseriesSchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = `timeseries:${JSON.stringify(params)}`;
    
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, meta: { ...cached.meta, cached: true } });
    }

    const result = await alertService.getTimeseriesStats(params);
    cache.set(cacheKey, result);
    
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ================== CATEGORICAL ANALYSIS ==================

// Duration histogram
router.get('/duration-histogram', validateQuery(statsSchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = `duration-hist:${JSON.stringify(params)}`;
    
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, meta: { ...cached.meta, cached: true } });
    }

    const result = await alertService.getDurationHistogram(params);
    cache.set(cacheKey, result);
    
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// Shift analysis (Day vs Night)
router.get('/shift-analysis', validateQuery(statsSchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = `shift-analysis:${JSON.stringify(params)}`;
    
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, meta: { ...cached.meta, cached: true } });
    }

    const result = await alertService.getShiftAnalysis(params);
    cache.set(cacheKey, result);
    
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ================== ENTITY-BASED ANALYSIS ==================

// Statistics by panel
router.get('/by-panel', validateQuery(panelStatsSchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = `by-panel:${JSON.stringify(params)}`;
    
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, meta: { ...cached.meta, cached: true } });
    }

    const result = await alertService.getPanelStats(params);
    cache.set(cacheKey, result);
    
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// ================== PATTERN ANALYSIS ==================

// Storm  and correlations
router.get('/patterns', validateQuery(statsSchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = `patterns:${JSON.stringify(params)}`;
    
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, meta: { ...cached.meta, cached: true } });
    }

    const result = await alertService.getPatternAnalysis(params);
    cache.set(cacheKey, result);
    
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;