// routes/statsRoutes.js - Clean statistics route definitions
const express = require('express');
const {
  statsSchema,
  statsSchemaRequiredPanel,
  panelStatsSchema,
  timeseriesSchema,
  panelResearchSchema
} = require('../schemas/alertSchemas');
const AlertService = require('../services/alert/AlertService');
const { createCachedHandler } = require('../middleware/routeHandler');

const router = express.Router();
const alertService = new AlertService();

// ================== EXECUTIVE/SUMMARY STATS ==================

router.get('/executive-kpis', ...createCachedHandler(
  statsSchema,
  alertService.getExecutiveKPIs,
  alertService,
  'kpis'
));

router.get('/overview', ...createCachedHandler(
  statsSchema,
  alertService.getOverviewStats,
  alertService,
  'overview'
));

// ================== TEMPORAL ANALYSIS ==================

router.get('/hourly-heatmap', ...createCachedHandler(
  statsSchema,
  alertService.getHourlyHeatmap,
  alertService,
  'hourly-heatmap'
));

router.get('/hourly', ...createCachedHandler(
  statsSchema,
  alertService.getHourlyStats,
  alertService,
  'hourly'
));

router.get('/timeseries', ...createCachedHandler(
  timeseriesSchema,
  alertService.getTimeseriesStats,
  alertService,
  'timeseries'
));

// ================== CATEGORICAL ANALYSIS ==================

router.get('/duration-histogram', ...createCachedHandler(
  statsSchema,
  alertService.getDurationHistogram,
  alertService,
  'duration-hist'
));

router.get('/shift-analysis', ...createCachedHandler(
  statsSchema,
  alertService.getShiftAnalysis,
  alertService,
  'shift-analysis'
));

// ================== ENTITY-BASED ANALYSIS ==================

router.get('/by-panel', ...createCachedHandler(
  panelStatsSchema,
  alertService.getPanelStats,
  alertService,
  'by-panel'
));

router.get('/panels', ...createCachedHandler(
  panelResearchSchema,
  alertService.getPanelList,
  alertService,
  'panels'
));

router.get('/panel-analysis', ...createCachedHandler(
  panelResearchSchema,
  alertService.getPanelAnalysis,
  alertService,
  'panel-analysis'
));

router.get('/panel-messages', ...createCachedHandler(
  statsSchemaRequiredPanel,
  alertService.getAlertMessageBreakdown,
  alertService,
  'panel-messages'
));

router.get('/top-nodes', ...createCachedHandler(
  statsSchema,
  alertService.getTopNoisyNodes,
  alertService,
  'top-nodes'
));

router.get('/top-applications', ...createCachedHandler(
  statsSchema,
  alertService.getTopApplications,
  alertService,
  'top-apps'
));

router.get('/top-nodes-by-app', ...createCachedHandler(
  statsSchema,
  alertService.getTopNodesByApp,
  alertService,
  'top-nodes-app'
));

router.get('/consecutive-days', ...createCachedHandler(
  statsSchema,
  alertService.getConsecutiveDaysNodes,
  alertService,
  'consecutive-days'
));

module.exports = router;