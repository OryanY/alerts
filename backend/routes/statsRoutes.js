// routes/statsRoutes.js
const express = require('express');
const { validateQuery } = require('../middleware/validation');
const { handleError } = require('../middleware/errorHandler');
const { cache } = require('../utils/cache');
const { statsSchema, panelStatsSchema, timeseriesSchema, panelResearchSchema } = require('../schemas/alertSchemas');
const AlertService = require('../services/AlertService');

const router = express.Router();
const alertService = new AlertService();

/**
 * Helper to handle standard API flows (Validate -> Cache -> Service -> Response).
 */
const handleStatsRequest = (schema, serviceFn, keyPrefix) => {
    return [
        validateQuery(schema),
        async (req, res) => {
            try {
                const params = req.validatedQuery;
                
                // Specific validation for panel routes where panel_title is REQUIRED
                if (keyPrefix.includes('panel') && keyPrefix !== 'panels' && keyPrefix !== 'by-panel' && !params.panel_title) {
                    return res.status(400).json({ success: false, error: 'panel_title query parameter is required' });
                }

                // Deterministic cache key
                const sortedParams = Object.keys(params).sort().reduce((acc, key) => {
                    acc[key] = params[key];
                    return acc;
                }, {});
                const cacheKey = `${keyPrefix}:${JSON.stringify(sortedParams)}`;

                const cached = cache.get(cacheKey);
                if (cached) {
                    return res.json({ ...cached, meta: { ...cached.meta, cached: true } });
                }

                // Call the service function, ensuring correct 'this' context
                const result = await serviceFn.call(alertService, params);
                cache.set(cacheKey, result);
                res.json(result);
            } catch (err) {
                handleError(res, err);
            }
        }
    ];
};

// ================== EXECUTIVE/SUMMARY STATS ==================

router.get('/executive-kpis', ...handleStatsRequest(statsSchema, alertService.getExecutiveKPIs, 'kpis'));
router.get('/overview', ...handleStatsRequest(statsSchema, alertService.getOverviewStats, 'overview'));

// ================== TEMPORAL ANALYSIS ==================

router.get('/hourly-heatmap', ...handleStatsRequest(statsSchema, alertService.getHourlyHeatmap, 'hourly-heatmap'));
router.get('/timeseries', ...handleStatsRequest(timeseriesSchema, alertService.getTimeseriesStats, 'timeseries'));

// ================== CATEGORICAL ANALYSIS ==================

router.get('/duration-histogram', ...handleStatsRequest(statsSchema, alertService.getDurationHistogram, 'duration-hist'));
router.get('/shift-analysis', ...handleStatsRequest(statsSchema, alertService.getShiftAnalysis, 'shift-analysis'));

// ================== ENTITY-BASED ANALYSIS ==================

router.get('/by-panel', ...handleStatsRequest(panelStatsSchema, alertService.getPanelStats, 'by-panel'));
router.get('/panels', ...handleStatsRequest(panelResearchSchema, alertService.getPanelList, 'panels'));
router.get('/panel-analysis', ...handleStatsRequest(panelResearchSchema, alertService.getPanelAnalysis, 'panel-analysis'));
router.get('/panel-messages', ...handleStatsRequest(statsSchema, alertService.getAlertMessageBreakdown, 'panel-messages'));
// CORRECTED ENDPOINT: Uses getTopNoisyNodes and passes panel_title (if present)
router.get('/top-nodes', ...handleStatsRequest(statsSchema, alertService.getTopNoisyNodes, 'top-nodes'));

module.exports = router;