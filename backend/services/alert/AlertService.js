// services/alert/AlertService.js - Orchestration layer (REFACTORED)
const { getSqlPool } = require('../../database/connection');
const { AlertQueryService } = require('./AlertQueryService');
const { AlertAnalysisService } = require('./AlertAnalysisService');
const { AlertTransformService } = require('./AlertTransformService');
const { ResponseFormatter } = require('../../utils/ResponseFormatter');
const { CONFIG } = require('../../config');


class AlertService {
    constructor() {
        this.pool = null;

        // Configuration constants (frozen to prevent mutation)
        this.CONSTANTS = Object.freeze({
            DEFAULT_CAP: CONFIG.limits?.defaultCap || 100000,
            MAX_PAGE_SIZE: CONFIG.limits?.maxPageSize || 1000,
            MAX_DATE_RANGE_DAYS: CONFIG.limits?.maxDateRangeDays || 730,
            DAY_START: CONFIG.shifts?.dayStart || 8,
            DAY_END: CONFIG.shifts?.dayEnd || 22,
            NIGHT_START: CONFIG.shifts?.nightStart || 22,
            NIGHT_END: CONFIG.shifts?.nightEnd || 8,
            DUR_SHORT_MAX: CONFIG.duration?.short || 30,
            DUR_MEDIUM_MAX: CONFIG.duration?.medium || 300,
            FALSE_WAKEUP_THRESHOLD: CONFIG.duration?.falseWakeupThreshold || 120
        });

        // Lazy-loaded services
        this._queryService = null;
        this._analysisService = null;

        this._transformService = null;
    }

    // ================== INFRASTRUCTURE ==================


    getPool() {
        if (!this.pool) {
            this.pool = getSqlPool();
        }
        return this.pool;
    }

    get queryService() {
        if (!this._queryService) {
            this._queryService = new AlertQueryService(this.getPool(), this.CONSTANTS);
        }
        return this._queryService;
    }

    get analysisService() {
        if (!this._analysisService) {
            this._analysisService = new AlertAnalysisService();
        }
        return this._analysisService;
    }

    get transformService() {
        if (!this._transformService) {
            this._transformService = new AlertTransformService();
        }
        return this._transformService;
    }

    _getThresholds(params = {}) {
        return {
            day_start: params.day_start ?? this.CONSTANTS.DAY_START,
            day_end: params.day_end ?? this.CONSTANTS.DAY_END,
            night_start: params.night_start ?? this.CONSTANTS.NIGHT_START,
            night_end: params.night_end ?? this.CONSTANTS.NIGHT_END,
            dur_short_max: params.dur_short_max ?? this.CONSTANTS.DUR_SHORT_MAX,
            dur_medium_max: params.dur_medium_max ?? this.CONSTANTS.DUR_MEDIUM_MAX,
            false_wakeup_threshold: params.false_wakeup_threshold ?? this.CONSTANTS.FALSE_WAKEUP_THRESHOLD
        };
    }

    _getClusteringConfig(params = {}) {
        return {
            enabled: params.clustering_enabled !== 'false' && params.clustering_enabled !== false,
            threshold: params.clustering_threshold ? parseInt(params.clustering_threshold, 10) : 15
        };
    }

    // ================== PUBLIC API ==================

    /**
     * Get alerts with filtering, sorting, and pagination
     */
    async getAlerts(params) {
        const thresholds = this._getThresholds(params);

        // 1. Fetch data
        const rawRecords = await this.queryService.fetchAlerts(params);

        // 2. Handle pagination
        let records = rawRecords;
        let pagination = null;

        if (params.page && params.limit) {
            const formatted = this.transformService.formatPaginationMeta(
                rawRecords,
                params.page,
                params.limit
            );
            records = formatted.records;
            pagination = formatted.pagination;
        }

        // 3. Transform data
        // CLUSTER: Apply smart clustering to the list view for noise reduction
        const { enabled, threshold } = this._getClusteringConfig(params);
        const clusteredRecords = this.analysisService.clusterAlerts(records, enabled, threshold);

        const transformed = this.transformService.transformAlertRecords(clusteredRecords, thresholds);

        // Note: Pagination meta might reflect raw counts, but data is clustered.
        // We update pagination total to reflect "Incidents" vs "Raw Alerts" if possible, 
        // but here we just return the clustered list.
        return ResponseFormatter.success(transformed, pagination);
    }

    /**
     * Get executive KPIs
     */
    async getExecutiveKPIs(params) {
        const thresholds = this._getThresholds(params);

        // 1. Fetch current data
        const rawRecords = await this.queryService.fetchBasicRecords(
            params,
            'time_fired, duration_sec, application, panel_title'
        );

        // 1b. Cluster Alerts (Smart Incidents)
        const { enabled, threshold } = this._getClusteringConfig(params);
        const records = this.analysisService.clusterAlerts(rawRecords, enabled, threshold);

        // 2. Compute analytics for current data (using Clustered records)
        const kpis = this.analysisService.computeKPIs(records, thresholds);

        try {
            // 3. Calculate previous period
            const startDate = params.start_date ? new Date(params.start_date) : new Date();
            const endDate = params.end_date ? new Date(params.end_date) : new Date();

            // Calculate duration in milliseconds
            const duration = endDate.getTime() - startDate.getTime();

            // Previous period is shift back by duration
            const prevEndDate = new Date(startDate.getTime());
            const prevStartDate = new Date(startDate.getTime() - duration);

            const prevParams = {
                ...params,
                start_date: prevStartDate.toISOString(),
                end_date: prevEndDate.toISOString()
            };

            // 4. Fetch previous period data
            const prevRawRecords = await this.queryService.fetchBasicRecords(
                prevParams,
                'time_fired, duration_sec, application, panel_title'
            );
            const prevRecords = this.analysisService.clusterAlerts(prevRawRecords, enabled, threshold);
            const prevKpis = this.analysisService.computeKPIs(prevRecords, thresholds);

            // 5. Calculate trends
            // Noise Trend
            const currentNoise = kpis.noise_alerts || 0;
            const prevNoise = prevKpis.noise_alerts || 0;

            // Avoid division by zero
            let noiseTrendPct = 0;
            if (prevNoise > 0) {
                noiseTrendPct = ((currentNoise - prevNoise) / prevNoise) * 100;
            } else if (currentNoise > 0) {
                noiseTrendPct = 100; // 0 to something is 100% increase
            }

            // Total Trend
            const currentTotal = kpis.total_alerts || 0;
            const prevTotal = prevKpis.total_alerts || 0;

            let totalTrendPct = 0;
            if (prevTotal > 0) {
                totalTrendPct = ((currentTotal - prevTotal) / prevTotal) * 100;
            } else if (currentTotal > 0) {
                totalTrendPct = 100;
            }

            // Return with trends (rounded to 1 decimal)
            return ResponseFormatter.success({
                ...kpis,
                noise_trend_pct: parseFloat(noiseTrendPct.toFixed(1)),
                total_trend_pct: parseFloat(totalTrendPct.toFixed(1))
            });

        } catch (error) {
            console.error('Error calculating trends:', error);
            // Fallback to no trend if error
            return ResponseFormatter.success({
                ...kpis,
                noise_trend_pct: 0,
                total_trend_pct: 0
            });
        }
    }

    /**
     * Get duration histogram
     */
    async getDurationHistogram(params) {
        const thresholds = this._getThresholds(params);

        // 1. Fetch from SQL (optimized aggregation)
        const sqlResult = await this.queryService.fetchDurationHistogram(params, thresholds);

        // 2. Format as histogram
        const histogram = [
            {
                range: `≤${thresholds.dur_short_max}s`,
                category: 'Short',
                count: sqlResult.short_count || 0
            },
            {
                range: `${thresholds.dur_short_max + 1}-${thresholds.dur_medium_max}s`,
                category: 'Medium',
                count: sqlResult.medium_count || 0
            },
            {
                range: `>${thresholds.dur_medium_max}s`,
                category: 'Long',
                count: sqlResult.long_count || 0
            }
        ];

        const total = histogram.reduce((sum, b) => sum + b.count, 0);
        const formatted = this.transformService.formatDurationHistogram(histogram, total);

        return ResponseFormatter.success(formatted);
    }

    /**
     * Get hourly heatmap
     */
    async getHourlyHeatmap(params) {
        const thresholds = this._getThresholds(params);

        // 1. Fetch from SQL (optimized query with CTEs)
        const heatmap = await this.queryService.fetchHourlyHeatmap(params);

        // 2. Format with metadata
        const formatted = this.transformService.formatHourlyHeatmap(heatmap, thresholds);

        return ResponseFormatter.success(formatted);
    }

    /**
     * Get shift analysis (Day/Night breakdown)
     */
    async getShiftAnalysis(params) {
        const thresholds = this._getThresholds(params);

        // 1. Fetch from SQL (optimized aggregation)
        const analysis = await this.queryService.fetchShiftAnalysis(params, thresholds);

        // 2. Add computed metrics
        const enriched = analysis.map(shift => ({
            ...shift,
            false_wakeup_rate: shift.alert_count > 0
                ? parseFloat(((shift.false_wakeups * 100) / shift.alert_count).toFixed(1))
                : 0
        }));

        return ResponseFormatter.success(enriched);
    }

    /**
     * Get overview statistics
     */
    async getOverviewStats(params) {
        const thresholds = this._getThresholds(params);

        // 1. Fetch from SQL (optimized aggregation)
        const sqlStats = await this.queryService.fetchOverviewStats(params, thresholds);

        // 2. Add computed metrics
        const stats = {
            ...sqlStats,
            signal_to_noise_ratio: sqlStats.total_alerts > 0
                ? parseFloat((((sqlStats.total_alerts - sqlStats.short_alerts) * 100) / sqlStats.total_alerts).toFixed(1))
                : 0
        };

        // 3. Add date range metadata
        const enriched = this.transformService.addDateRangeMeta(stats, params);

        return ResponseFormatter.success(enriched);
    }

    /**
     * Get hourly statistics
     */
    async getHourlyStats(params) {
        const thresholds = this._getThresholds(params);

        // 1. Fetch data
        const records = await this.queryService.fetchBasicRecords(
            params,
            'time_fired, duration_sec'
        );

        // 2. Compute analytics
        const hourlyStats = this.analysisService.computeHourlyStats(records, thresholds);

        return ResponseFormatter.success(hourlyStats);
    }

    /**
     * Get timeseries statistics
     */
    async getTimeseriesStats(params) {
        const thresholds = this._getThresholds(params);

        // 1. Fetch data
        const records = await this.queryService.fetchBasicRecords(
            params,
            'time_fired, duration_sec'
        );

        // 2. Compute analytics
        const timeseries = this.analysisService.computeTimeseries(records, thresholds);

        return ResponseFormatter.success(timeseries);
    }

    /**
     * Get panel list with aggregates
     */
    async getPanelList(params) {
        const thresholds = this._getThresholds(params);

        // 1. Fetch from SQL (optimized aggregation)
        const panels = await this.queryService.fetchPanelList(params, thresholds);

        // 2. Enrich with health scores
        const enriched = this.transformService.enrichPanelStats(panels);

        return ResponseFormatter.success(enriched);
    }

    /**
     * Get panel statistics
     */
    async getPanelStats(params) {
        const thresholds = this._getThresholds(params);

        // 1. Fetch from SQL (optimized aggregation)
        const stats = await this.queryService.fetchPanelStats(params, thresholds);

        return ResponseFormatter.success(stats);
    }

    /**
     * Get detailed panel analysis
     */
    async getPanelAnalysis(params) {
        const thresholds = this._getThresholds(params);

        // 1. Fetch data (requires more fields for deep analysis)
        const rawRecords = await this.queryService.fetchBasicRecords(
            params,
            'time_fired, time_resolved, duration_sec, operator, message, application, panel_title'
        );

        // 1b. Cluster Alerts (Consistency with Dashboard)
        const { enabled, threshold } = this._getClusteringConfig(params);
        const records = this.analysisService.clusterAlerts(rawRecords, enabled, threshold);

        // 2. Compute analytics
        const analysis = this.analysisService.computePanelAnalysis(records, thresholds);



        return ResponseFormatter.success({
            ...analysis
        });
    }

    /**
     * Get alert message breakdown
     */
    async getAlertMessageBreakdown(params) {
        const thresholds = this._getThresholds(params);

        // 1. Fetch from SQL (optimized aggregation)
        const breakdown = await this.queryService.fetchMessageBreakdown(params, thresholds);

        return ResponseFormatter.success(breakdown);
    }

    /**
     * Get top noisy nodes
     */
    async getTopNoisyNodes(params) {
        // 1. Fetch from SQL (optimized query)
        const nodes = await this.queryService.fetchTopNoisyNodes(params);

        // 2. Apply post-filter if needed
        let filtered = nodes;
        if (params.min_percent) {
            const minPercent = parseFloat(params.min_percent);
            if (!isNaN(minPercent)) {
                filtered = nodes.filter(n => n.alert_percent >= minPercent);
            }
        }

        return ResponseFormatter.success(filtered);
    }

    /**
     * Get top applications per panel
     */
    async getTopApplications(params) {
        const apps = await this.queryService.fetchTopApplicationsPerPanel(params);
        return ResponseFormatter.success(apps);
    }

    /**
     * Get top nodes per application
     */
    async getTopNodesByApp(params) {
        const nodes = await this.queryService.fetchTopNodesPerApplication(params);
        return ResponseFormatter.success(nodes);
    }

    /**
     * Get consecutive days analysis
     */
    async getConsecutiveDaysNodes(params) {
        const nodes = await this.queryService.fetchConsecutiveDaysNodes(params);
        return ResponseFormatter.success(nodes);
    }
}

module.exports = AlertService;
