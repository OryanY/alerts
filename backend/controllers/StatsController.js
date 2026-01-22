// controllers/StatsController.js - Clean separation for Statistics endpoints
/**
 * StatsController - Handles HTTP requests for statistics-related endpoints
 * Single Responsibility: Request/Response handling only
 */
class StatsController {
    constructor(alertService) {
        this.alertService = alertService;

        // Bind all methods
        this.getExecutiveKPIs = this.getExecutiveKPIs.bind(this);
        this.getOverviewStats = this.getOverviewStats.bind(this);
        this.getHourlyHeatmap = this.getHourlyHeatmap.bind(this);
        this.getHourlyStats = this.getHourlyStats.bind(this);
        this.getTimeseriesStats = this.getTimeseriesStats.bind(this);
        this.getDurationHistogram = this.getDurationHistogram.bind(this);
        this.getShiftAnalysis = this.getShiftAnalysis.bind(this);
        this.getPanelStats = this.getPanelStats.bind(this);
        this.getPanelList = this.getPanelList.bind(this);
        this.getPanelAnalysis = this.getPanelAnalysis.bind(this);
        this.getAlertMessageBreakdown = this.getAlertMessageBreakdown.bind(this);
        this.getTopNoisyNodes = this.getTopNoisyNodes.bind(this);
        this.getTopApplications = this.getTopApplications.bind(this);
        this.getTopNodesByApp = this.getTopNodesByApp.bind(this);
        this.getConsecutiveDaysNodes = this.getConsecutiveDaysNodes.bind(this);
    }

    async getExecutiveKPIs(req, res, next) {
        try {
            const result = await this.alertService.getExecutiveKPIs(req.validatedQuery || req.query);
            res.json({ success: true, data: result.data, meta: result.meta });
        } catch (error) { next(error); }
    }

    async getOverviewStats(req, res, next) {
        try {
            const result = await this.alertService.getOverviewStats(req.validatedQuery || req.query);
            res.json({ success: true, data: result.data, meta: result.meta });
        } catch (error) { next(error); }
    }

    async getHourlyHeatmap(req, res, next) {
        try {
            const result = await this.alertService.getHourlyHeatmap(req.validatedQuery || req.query);
            res.json({ success: true, data: result.data, meta: result.meta });
        } catch (error) { next(error); }
    }

    async getHourlyStats(req, res, next) {
        try {
            const result = await this.alertService.getHourlyStats(req.validatedQuery || req.query);
            res.json({ success: true, data: result.data, meta: result.meta });
        } catch (error) { next(error); }
    }

    async getTimeseriesStats(req, res, next) {
        try {
            const result = await this.alertService.getTimeseriesStats(req.validatedQuery || req.query);
            res.json({ success: true, data: result.data, meta: result.meta });
        } catch (error) { next(error); }
    }

    async getDurationHistogram(req, res, next) {
        try {
            const result = await this.alertService.getDurationHistogram(req.validatedQuery || req.query);
            res.json({ success: true, data: result.data, meta: result.meta });
        } catch (error) { next(error); }
    }

    async getShiftAnalysis(req, res, next) {
        try {
            const result = await this.alertService.getShiftAnalysis(req.validatedQuery || req.query);
            res.json({ success: true, data: result.data, meta: result.meta });
        } catch (error) { next(error); }
    }

    async getPanelStats(req, res, next) {
        try {
            const result = await this.alertService.getPanelStats(req.validatedQuery || req.query);
            res.json({ success: true, data: result.data, meta: result.meta });
        } catch (error) { next(error); }
    }

    async getPanelList(req, res, next) {
        try {
            const result = await this.alertService.getPanelList(req.validatedQuery || req.query);
            res.json({ success: true, data: result.data, meta: result.meta });
        } catch (error) { next(error); }
    }

    async getPanelAnalysis(req, res, next) {
        try {
            const result = await this.alertService.getPanelAnalysis(req.validatedQuery || req.query);
            res.json({ success: true, data: result.data, meta: result.meta });
        } catch (error) { next(error); }
    }

    async getAlertMessageBreakdown(req, res, next) {
        try {
            const result = await this.alertService.getAlertMessageBreakdown(req.validatedQuery || req.query);
            res.json({ success: true, data: result.data, meta: result.meta });
        } catch (error) { next(error); }
    }

    async getTopNoisyNodes(req, res, next) {
        try {
            const result = await this.alertService.getTopNoisyNodes(req.validatedQuery || req.query);
            res.json({ success: true, data: result.data, meta: result.meta });
        } catch (error) { next(error); }
    }

    async getTopApplications(req, res, next) {
        try {
            const result = await this.alertService.getTopApplications(req.validatedQuery || req.query);
            res.json({ success: true, data: result.data, meta: result.meta });
        } catch (error) { next(error); }
    }

    async getTopNodesByApp(req, res, next) {
        try {
            const result = await this.alertService.getTopNodesByApp(req.validatedQuery || req.query);
            res.json({ success: true, data: result.data, meta: result.meta });
        } catch (error) { next(error); }
    }

    async getConsecutiveDaysNodes(req, res, next) {
        try {
            const result = await this.alertService.getConsecutiveDaysNodes(req.validatedQuery || req.query);
            res.json({ success: true, data: result.data, meta: result.meta });
        } catch (error) { next(error); }
    }
}

module.exports = { StatsController };
