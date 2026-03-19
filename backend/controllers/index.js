// controllers/index.js - Export all controllers
const { IncidentController } = require('./IncidentController');
const { AlertController } = require('./AlertController');

module.exports = {
    IncidentController,
    AlertController
};
