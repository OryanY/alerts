// controllers/index.js - Export all controllers
const { IncidentController } = require('./IncidentController');
const { AlertController } = require('./AlertController');
const { StatsController } = require('./StatsController');

module.exports = {
    IncidentController,
    AlertController,
    StatsController
};
