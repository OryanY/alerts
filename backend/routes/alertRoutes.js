// routes/alertRoutes.js - Clean route definitions
const express = require('express');
const { alertsSchema } = require('../schemas/alertSchemas');
const AlertService = require('../services/alert/AlertService');
const { createCachedHandler } = require('../middleware/routeHandler');

const router = express.Router();
const alertService = new AlertService();

// ================== ALERT ENDPOINTS ==================

router.get('/', ...createCachedHandler(
  alertsSchema,
  alertService.getAlerts,
  alertService,
  'alerts'
));

module.exports = router;