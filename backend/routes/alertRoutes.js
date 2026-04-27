// routes/alertRoutes.js
// AlertController was removed — all handlers are thin wrappers so they live here directly.
// Real logic (orchestration, error handling) lives in AlertService.
const express = require('express');
const {
  alertsSchema,
  statsSchema,
  panelStatsSchema,
  timeseriesSchema,
  panelResearchSchema
} = require('../schemas/alertSchemas');
const AlertService = require('../services/alert/AlertService');
const { validateQuery } = require('../middleware/validation');

const router = express.Router();
const alertService = new AlertService();

const handle = (serviceFn) => async (req, res, next) => {
  try {
    const result = await serviceFn(req.validatedQuery || req.query);
    if (result.success === false) return res.status(500).json(result);
    res.json({ success: true, data: result.data, meta: result.meta || {} });
  } catch (err) {
    next(err);
  }
};

// ================== ALERTS ==================
router.get('/alerts', validateQuery(alertsSchema), async (req, res, next) => {
  try {
    const result = await alertService.getAlerts(req.validatedQuery || req.query);
    res.json({
      success: result.success,
      data: result.data,
      meta: result.meta || {},
      count: result.data?.length || 0
    });
  } catch (err) { next(err); }
});

// ================== EXECUTIVE/SUMMARY ==================
router.get('/stats/executive-kpis', validateQuery(statsSchema), handle((q) => alertService.getExecutiveKPIs(q)));

// ================== TEMPORAL ==================
router.get('/stats/hourly-heatmap', validateQuery(statsSchema), handle((q) => alertService.getHourlyHeatmap(q)));
router.get('/stats/timeseries', validateQuery(timeseriesSchema), handle((q) => alertService.getTimeseriesStats(q)));

// ================== CATEGORICAL ==================
router.get('/stats/duration-histogram', validateQuery(statsSchema), handle((q) => alertService.getDurationHistogram(q)));
router.get('/stats/shift-analysis', validateQuery(statsSchema), handle((q) => alertService.getShiftAnalysis(q)));

// ================== ENTITY ==================
// Distinct panel/app names for UI dropdown population — no date range applied
router.get('/stats/filter-options', async (req, res, next) => {
  try {
    const result = await alertService.getFilterOptions();
    res.json(result);
  } catch (err) { next(err); }
});
router.get('/stats/by-panel', validateQuery(panelStatsSchema), handle((q) => alertService.getPanelStats(q)));
router.get('/stats/panels', validateQuery(panelResearchSchema), handle((q) => alertService.getPanelList(q)));
router.get('/stats/panel-analysis', validateQuery(panelResearchSchema), handle((q) => alertService.getPanelAnalysis(q)));
router.get('/stats/top-applications', validateQuery(statsSchema), handle((q) => alertService.getTopApplications(q)));
router.get('/stats/top-nodes-by-app', validateQuery(statsSchema), handle((q) => alertService.getTopNodesByApp(q)));
router.get('/stats/top-objects-by-app', validateQuery(statsSchema), handle((q) => alertService.getTopObjectsByApp(q)));
router.get('/stats/consecutive-days', validateQuery(statsSchema), handle((q) => alertService.getConsecutiveDaysNodes(q)));
router.get('/stats/incident-stats', validateQuery(statsSchema), handle((q) => alertService.getIncidentStats(q)));

module.exports = router;