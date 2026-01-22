// controllers/AlertController.js - Clean separation for Alert endpoints
/**
 * AlertController - Handles HTTP requests for alert-related endpoints
 * Single Responsibility: Request/Response handling only
 */
class AlertController {
    constructor(alertService) {
        this.alertService = alertService;

        // Bind methods
        this.getAlerts = this.getAlerts.bind(this);
    }

    async getAlerts(req, res, next) {
        try {
            const result = await this.alertService.getAlerts(req.validatedQuery || req.query);
            res.json({
                success: true,
                data: result.data,
                meta: result.meta || {},
                count: result.data?.length || 0
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = { AlertController };
