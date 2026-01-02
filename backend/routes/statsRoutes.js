// routes/statsRoutes.js - Clean statistics route definitions
const express = require('express');
const { validateQuery } = require('../middleware/validation');
const { cache } = require('../utils/cache');
const {
  statsSchema,
  panelStatsSchema,
  timeseriesSchema,
  panelResearchSchema
} = require('../schemas/alertSchemas');
const AlertService = require('../services/alert/AlertService');

const router = express.Router();
const alertService = new AlertService();

/**
 * Reusable handler for cached statistics endpoints
 */
function createStatsHandler(schema, serviceMethod, cachePrefix) {
  return [
    validateQuery(schema),
    async (req, res, next) => {
      try {
        const params = req.validatedQuery;

        // Validate panel_title requirement for certain endpoints
        if (requiresPanelTitle(cachePrefix) && !params.panel_title) {
          return res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'panel_title query parameter is required',
              status: 400
            }
          });
        }

        // Generate cache key
        const cacheKey = generateCacheKey(cachePrefix, params);

        // Check cache
        const cached = cache.get(cacheKey);
        if (cached) {
          return res.json({
            ...cached,
            meta: { ...cached.meta, cached: true }
          });
        }

        // Call service
        const result = await serviceMethod.call(alertService, params);

        // Cache result
        cache.set(cacheKey, result);

        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  ];
}

/**
 * Generate deterministic cache key
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

/**
 * Check if endpoint requires panel_title
 */
function requiresPanelTitle(cachePrefix) {
  const requiresPanel = ['panel-messages'];
  return requiresPanel.includes(cachePrefix);
}

// ================== EXECUTIVE/SUMMARY STATS ==================

router.get('/executive-kpis', ...createStatsHandler(
  statsSchema,
  alertService.getExecutiveKPIs,
  'kpis'
));

router.get('/overview', ...createStatsHandler(
  statsSchema,
  alertService.getOverviewStats,
  'overview'
));

// ================== TEMPORAL ANALYSIS ==================

router.get('/hourly-heatmap', ...createStatsHandler(
  statsSchema,
  alertService.getHourlyHeatmap,
  'hourly-heatmap'
));

router.get('/hourly', ...createStatsHandler(
  statsSchema,
  alertService.getHourlyStats,
  'hourly'
));

router.get('/timeseries', ...createStatsHandler(
  timeseriesSchema,
  alertService.getTimeseriesStats,
  'timeseries'
));

// ================== CATEGORICAL ANALYSIS ==================

router.get('/duration-histogram', ...createStatsHandler(
  statsSchema,
  alertService.getDurationHistogram,
  'duration-hist'
));

router.get('/shift-analysis', ...createStatsHandler(
  statsSchema,
  alertService.getShiftAnalysis,
  'shift-analysis'
));

// ================== ENTITY-BASED ANALYSIS ==================

router.get('/by-panel', ...createStatsHandler(
  panelStatsSchema,
  alertService.getPanelStats,
  'by-panel'
));

router.get('/panels', ...createStatsHandler(
  panelResearchSchema,
  alertService.getPanelList,
  'panels'
));

router.get('/panel-analysis', ...createStatsHandler(
  panelResearchSchema,
  alertService.getPanelAnalysis,
  'panel-analysis'
));

router.get('/panel-messages', ...createStatsHandler(
  statsSchema,
  alertService.getAlertMessageBreakdown,
  'panel-messages'
));

router.get('/top-nodes', ...createStatsHandler(
  statsSchema,
  alertService.getTopNoisyNodes,
  'top-nodes'
));

router.get('/top-applications', ...createStatsHandler(
  statsSchema,
  alertService.getTopApplications,
  'top-apps'
));

router.get('/top-nodes-by-app', ...createStatsHandler(
  statsSchema,
  alertService.getTopNodesByApp,
  'top-nodes-app'
));

router.get('/consecutive-days', ...createStatsHandler(
  statsSchema,
  alertService.getConsecutiveDaysNodes,
  'consecutive-days'
));

module.exports = router;