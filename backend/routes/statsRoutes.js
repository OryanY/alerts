// routes/statsRoutes.js - Statistics-specific routes
const express = require('express');
const { validateQuery } = require('../middleware/validation');
const { handleError } = require('../middleware/errorHandler');
const { cache } = require('../utils/cache');
const { statsSchema, panelStatsSchema, timeseriesSchema,panelResearchSchema} = require('../schemas/alertSchemas');
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

// Time series data
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

// Get list of all panels
router.get('/panels', validateQuery(panelResearchSchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = `panels:${JSON.stringify(params)}`;
    
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, meta: { ...cached.meta, cached: true } });
    }

    const result = await alertService.getPanelList(params);
    cache.set(cacheKey, result);
    
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// Get detailed panel analysis
router.get('/panel-analysis', validateQuery(panelResearchSchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    
    if (!params.panel_title) {
      return res.status(400).json({
        success: false,
        error: 'panel_title query parameter is required'
      });
    }
    
    const cacheKey = `panel-analysis:${JSON.stringify(params)}`;
    
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, meta: { ...cached.meta, cached: true } });
    }

    const result = await alertService.getPanelAnalysis(params);
    cache.set(cacheKey, result);
    
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

// Get alert message breakdown for a panel
router.get('/panel-messages', validateQuery(statsSchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    
    if (!params.panel_title) {
      return res.status(400).json({
        success: false,
        error: 'panel_title query parameter is required'
      });
    }
    
    const cacheKey = `panel-messages:${JSON.stringify(params)}`;
    
    const cached = cache.get(cacheKey);
    if (cached) {
      return res.json({ ...cached, meta: { ...cached.meta, cached: true } });
    }

    const result = await alertService.getAlertMessageBreakdown(params);
    cache.set(cacheKey, result);
    
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

module.exports = router;