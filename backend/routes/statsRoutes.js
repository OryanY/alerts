// routes/statsRoutes.js - Clean statistics route definitions using Controller pattern
const express = require('express');
const {
  statsSchema,
  panelStatsSchema,
  timeseriesSchema,
  panelResearchSchema
} = require('../schemas/alertSchemas');
const AlertService = require('../services/alert/AlertService');
const { StatsController } = require('../controllers/StatsController');
const { validateQuery } = require('../middleware/validation');

const router = express.Router();

// Initialize service and controller (Dependency Injection)
const alertService = new AlertService();
const controller = new StatsController(alertService);

// ================== EXECUTIVE/SUMMARY STATS ==================
router.get('/executive-kpis', validateQuery(statsSchema), controller.getExecutiveKPIs);

// ================== TEMPORAL ANALYSIS ==================
router.get('/hourly-heatmap', validateQuery(statsSchema), controller.getHourlyHeatmap);
router.get('/timeseries', validateQuery(timeseriesSchema), controller.getTimeseriesStats);

// ================== CATEGORICAL ANALYSIS ==================
router.get('/duration-histogram', validateQuery(statsSchema), controller.getDurationHistogram);
router.get('/shift-analysis', validateQuery(statsSchema), controller.getShiftAnalysis);

// ================== ENTITY-BASED ANALYSIS ==================
router.get('/by-panel', validateQuery(panelStatsSchema), controller.getPanelStats);
router.get('/panels', validateQuery(panelResearchSchema), controller.getPanelList);
router.get('/panel-analysis', validateQuery(panelResearchSchema), controller.getPanelAnalysis);
router.get('/top-applications', validateQuery(statsSchema), controller.getTopApplications);
router.get('/top-nodes-by-app', validateQuery(statsSchema), controller.getTopNodesByApp);
router.get('/consecutive-days', validateQuery(statsSchema), controller.getConsecutiveDaysNodes);

module.exports = router;