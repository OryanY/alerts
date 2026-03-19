// routes/alertRoutes.js - Consolidated endpoints using the unified AlertController
const express = require('express');
const {
  alertsSchema,
  statsSchema,
  panelStatsSchema,
  timeseriesSchema,
  panelResearchSchema
} = require('../schemas/alertSchemas');
const AlertService = require('../services/alert/AlertService');
const { AlertController } = require('../controllers/AlertController');
const { validateQuery } = require('../middleware/validation');

const router = express.Router();

// Initialize service and controller (Dependency Injection)
const alertService = new AlertService();
const controller = new AlertController(alertService);

// ================== ALERT ENDPOINTS ==================
router.get('/alerts', validateQuery(alertsSchema), controller.getAlerts);

// ================== EXECUTIVE/SUMMARY STATS ==================
router.get('/stats/executive-kpis', validateQuery(statsSchema), controller.getExecutiveKPIs);

// ================== TEMPORAL ANALYSIS ==================
router.get('/stats/hourly-heatmap', validateQuery(statsSchema), controller.getHourlyHeatmap);
router.get('/stats/timeseries', validateQuery(timeseriesSchema), controller.getTimeseriesStats);

// ================== CATEGORICAL ANALYSIS ==================
router.get('/stats/duration-histogram', validateQuery(statsSchema), controller.getDurationHistogram);
router.get('/stats/shift-analysis', validateQuery(statsSchema), controller.getShiftAnalysis);

// ================== ENTITY-BASED ANALYSIS ==================
router.get('/stats/by-panel', validateQuery(panelStatsSchema), controller.getPanelStats);
router.get('/stats/panels', validateQuery(panelResearchSchema), controller.getPanelList);
router.get('/stats/panel-analysis', validateQuery(panelResearchSchema), controller.getPanelAnalysis);
router.get('/stats/top-applications', validateQuery(statsSchema), controller.getTopApplications);
router.get('/stats/top-nodes-by-app', validateQuery(statsSchema), controller.getTopNodesByApp);
router.get('/stats/consecutive-days', validateQuery(statsSchema), controller.getConsecutiveDaysNodes);

module.exports = router;