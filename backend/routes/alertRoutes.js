// routes/alertRoutes.js - Clean route definitions using Controller pattern
const express = require('express');
const { alertsSchema } = require('../schemas/alertSchemas');
const AlertService = require('../services/alert/AlertService');
const { AlertController } = require('../controllers/AlertController');
const { validateQuery } = require('../middleware/validation');

const router = express.Router();

// Initialize service and controller (Dependency Injection)
const alertService = new AlertService();
const controller = new AlertController(alertService);

// ================== ALERT ENDPOINTS ==================
router.get('/', validateQuery(alertsSchema), controller.getAlerts);

module.exports = router;