// services/alert/AlertService.js
// Main orchestration layer for alert analytics and listing.
// Coordinates between AlertQueryService (SQL), AlertAnalysisService (computations),
// and AlertTransformService (response shaping).
// Used by: AlertController (alert listing), StatsController (all analytics endpoints)

const { getSqlPool } = require('../../database/connection');
const { AlertQueryService } = require('./AlertQueryService');
const { AlertAnalysisService } = require('./AlertAnalysisService');
const { AlertTransformService } = require('./AlertTransformService');
const { ResponseFormatter } = require('../../utils/ResponseFormatter');
const { CONFIG } = require('../../config');

class AlertService {

    // Core Dependencies
    constructor(sqlPool = null) {
        this.pool = sqlPool;
        this.constants = this._initializeConstants();
        this._queryService = null;
        this._analysisService = null;
        this._transformService = null;
    }

    _initializeConstants() {
        return Object.freeze({
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
    }

    getPool() {
        if (!this.pool) this.pool = getSqlPool();
        return this.pool;
    }

    get queryService() {
        if (!this._queryService) this._queryService = new AlertQueryService(this.getPool(), this.constants);
        return this._queryService;
    }

    get analysisService() {
        if (!this._analysisService) this._analysisService = new AlertAnalysisService();
        return this._analysisService;
    }

    get transformService() {
        if (!this._transformService) this._transformService = new AlertTransformService();
        return this._transformService;
    }

    // Config helpers
    _getThresholds(params = {}) {
        return {
            day_start: params.day_start ?? this.constants.DAY_START,
            day_end: params.day_end ?? this.constants.DAY_END,
            night_start: params.night_start ?? this.constants.NIGHT_START,
            night_end: params.night_end ?? this.constants.NIGHT_END,
            dur_short_max: params.dur_short_max ?? this.constants.DUR_SHORT_MAX,
            dur_medium_max: params.dur_medium_max ?? this.constants.DUR_MEDIUM_MAX,
            false_wakeup_threshold: params.false_wakeup_threshold ?? this.constants.FALSE_WAKEUP_THRESHOLD
        };
    }

    _getClusteringConfig(params = {}) {
        return {
            enabled: params.clustering_enabled !== undefined
                ? (params.clustering_enabled !== 'false' && params.clustering_enabled !== false)
                : CONFIG.clustering.enabledByDefault,
            threshold: params.clustering_threshold
                ? parseInt(params.clustering_threshold, 10)
                : (CONFIG.clustering.defaultThreshold || 15)
        };
    }

    /**
     * Helper to fetch raw records and apply clustering.
     * Handles the logic of fetching all records if clustering is enabled.
     */
    async _fetchAndCluster(params, fields, forceClustering = null) {
        const { enabled, threshold } = this._getClusteringConfig(params);
        const shouldCluster = forceClustering !== null ? forceClustering : enabled;

        let fetchParams = params;
        if (shouldCluster) {
            const { limit, ...rest } = params;
            fetchParams = rest;
        }

        const rawRecords = await this.queryService.fetchBasicRecords(fetchParams, fields);
        const records = this.analysisService.clusterAlerts(rawRecords, shouldCluster, threshold);

        return { records, clusteringEnabled: shouldCluster };
    }

    /**
     * Calculate executive KPIs: total alerts, avg/median duration, false-positive rate,
     * true wakeups, signal ratio, and period-over-period trend percentages.
     * @param {Object} params - Query filters (start_date, end_date, application, etc.)
     * @returns {Object} ResponseFormatter-wrapped KPI data with noise_trend_pct and total_trend_pct
     */
    async getExecutiveKPIs(params) {
        const thresholds = this._getThresholds(params);
        const { enabled, threshold } = this._getClusteringConfig(params);

        let kpis;
        if (enabled) {
            // Use optimized SQL-based clustering
            const clusterParams = { ...params, cluster_threshold: threshold };
            const sqlKpis = await this.queryService.fetchClusteredKPIs(clusterParams, thresholds);

            // Calculate Night Rate
            const nightTotal = (sqlKpis.night_true_wakeups || 0) + (sqlKpis.night_false_wakeups || 0);

            kpis = {
                total_alerts: sqlKpis.total_alerts || 0,

                // Duration metrics
                avg_duration: sqlKpis.avg_duration || 0,
                median_duration: sqlKpis.median_duration || 0,

                // 24/7 Metric (Used in Dashboard)
                false_positive_rate_247: sqlKpis.total_alerts > 0
                    ? parseFloat(((sqlKpis.false_wakeups * 100) / sqlKpis.total_alerts).toFixed(1))
                    : 0,

                // Night Metric (Used in Dashboard)
                true_wakeups: sqlKpis.night_true_wakeups || 0,

                // Used in Dashboard
                signal_ratio: sqlKpis.total_alerts > 0
                    ? parseFloat(((sqlKpis.true_alerts * 100) / sqlKpis.total_alerts).toFixed(1))
                    : 0
            };
        } else {
            const records = await this.queryService.fetchBasicRecords(params, 'time_fired, duration_sec, application, panel_title');
            kpis = this.analysisService.computeKPIs(records, thresholds);
        }

        try {
            const { prevStartDate, prevEndDate } = this._calculatePreviousPeriod(params.start_date, params.end_date);
            const prevParams = { ...params, start_date: prevStartDate.toISOString(), end_date: prevEndDate.toISOString() };

            let prevKpis;
            if (enabled) {
                const prevClusterParams = { ...prevParams, cluster_threshold: threshold };
                const prevSqlKpis = await this.queryService.fetchClusteredKPIs(prevClusterParams, thresholds);
                prevKpis = {
                    total_alerts: prevSqlKpis.total_alerts || 0,
                    false_positive_rate_247: prevSqlKpis.total_alerts > 0
                        ? parseFloat(((prevSqlKpis.false_wakeups * 100) / prevSqlKpis.total_alerts).toFixed(1))
                        : 0
                };
            } else {
                const prevRecords = await this.queryService.fetchBasicRecords(prevParams, 'time_fired, duration_sec, application, panel_title');
                prevKpis = this.analysisService.computeKPIs(prevRecords, thresholds);
            }

            return ResponseFormatter.success({
                ...kpis,
                noise_trend_pct: parseFloat(this._calculateTrend(kpis.false_positive_rate_247, prevKpis.false_positive_rate_247).toFixed(1)),
                total_trend_pct: parseFloat(this._calculateTrend(kpis.total_alerts, prevKpis.total_alerts).toFixed(1))
            });
        } catch (error) {
            console.error('Trend calculation failed:', error.message);
            return ResponseFormatter.success({ ...kpis, noise_trend_pct: 0, total_trend_pct: 0 });
        }
    }

    /**
     * Get daily timeseries of alert counts, average duration, and day/night split.
     * @param {Object} params - Query filters (start_date, end_date, application, etc.)
     * @returns {Object} ResponseFormatter-wrapped array of { date_il, alert_count, avg_duration, day_count, night_count }
     */
    async getTimeseriesStats(params) {
        const thresholds = this._getThresholds(params);
        const { enabled, threshold } = this._getClusteringConfig(params);

        if (!enabled) {
            const records = await this.queryService.fetchBasicRecords(params, 'time_fired, duration_sec');
            return ResponseFormatter.success(this.analysisService.computeTimeseries(records, thresholds));
        }

        // Use optimized SQL-based clustering
        const clusterParams = { ...params, cluster_threshold: threshold };
        const timeseries = await this.queryService.fetchClusteredTimeseries(clusterParams, thresholds);
        return ResponseFormatter.success(timeseries.map(row => ({
            date_il: row.date_il,
            alert_count: row.alert_count,
            avg_duration: Math.round(row.avg_duration || 0),
            day_count: row.day_count || 0,
            night_count: row.night_count || 0
        })));
    }

    /**
     * Get duration histogram bucketed into Short / Medium / Long categories.
     * @param {Object} params - Query filters
     * @returns {Object} ResponseFormatter-wrapped array of { range, category, count, percentage }
     */
    async getDurationHistogram(params) {
        const thresholds = this._getThresholds(params);
        const { enabled, threshold } = this._getClusteringConfig(params);

        let sqlResult;
        if (enabled) {
            // Use optimized SQL-based clustering
            const clusterParams = { ...params, cluster_threshold: threshold };
            sqlResult = await this.queryService.fetchClusteredDurationHistogram(clusterParams, thresholds);
        } else {
            sqlResult = await this.queryService.fetchDurationHistogram(params, thresholds);
        }

        const histogram = [
            { range: `≤${thresholds.dur_short_max}s`, category: 'Short', count: sqlResult.short_count || 0 },
            { range: `${thresholds.dur_short_max + 1}-${thresholds.dur_medium_max}s`, category: 'Medium', count: sqlResult.medium_count || 0 },
            { range: `>${thresholds.dur_medium_max}s`, category: 'Long', count: sqlResult.long_count || 0 }
        ];
        const total = histogram.reduce((sum, bucket) => sum + bucket.count, 0);
        return ResponseFormatter.success(this.transformService.formatDurationHistogram(histogram, total));
    }

    /**
     * Get hourly heatmap: alert count and avg duration for each of 24 hours.
     * @param {Object} params - Query filters
     * @returns {Object} ResponseFormatter-wrapped array of { hour, count, avg_duration, is_night, hour_display }
     */
    async getHourlyHeatmap(params) {
        const thresholds = this._getThresholds(params);
        const { enabled, threshold } = this._getClusteringConfig(params);

        let heatmap;
        if (enabled) {
            // Use optimized SQL-based clustering
            const clusterParams = { ...params, cluster_threshold: threshold };
            heatmap = await this.queryService.fetchClusteredHourlyHeatmap(clusterParams);
        } else {
            heatmap = await this.queryService.fetchHourlyHeatmap(params);
        }
        return ResponseFormatter.success(this.transformService.formatHourlyHeatmap(heatmap, thresholds));
    }

    /**
     * Analyze alerts by shift (Day vs Night), including false-wakeup rate per shift.
     * @param {Object} params - Query filters
     * @returns {Object} ResponseFormatter-wrapped array of { shift, alert_count, true_alerts, false_wakeups, false_wakeup_rate }
     */
    async getShiftAnalysis(params) {
        const thresholds = this._getThresholds(params);
        const { enabled, threshold } = this._getClusteringConfig(params);

        let analysis;
        if (enabled) {
            // Use optimized SQL-based clustering
            const clusterParams = { ...params, cluster_threshold: threshold };
            analysis = await this.queryService.fetchClusteredShiftAnalysis(clusterParams, thresholds);
        } else {
            analysis = await this.queryService.fetchShiftAnalysis(params, thresholds);
        }

        const enriched = analysis.map(shift => ({
            ...shift,
            false_wakeup_rate: shift.alert_count > 0 ? parseFloat(((shift.false_wakeups * 100) / shift.alert_count).toFixed(1)) : 0
        }));
        return ResponseFormatter.success(enriched);
    }

    /**
     * Deep-dive analysis for a specific panel: summary, duration distribution,
     * daily trend, hourly heatmap, and top noisy alert messages.
     * @param {Object} params - Must include panel_title; also accepts date range filters
     * @returns {Object} ResponseFormatter-wrapped panel analysis with summary, duration_distribution, daily_trend, hourly_heatmap, top_noisy_alerts
     */
    async getPanelAnalysis(params) {
        const thresholds = this._getThresholds(params);
        const { records } = await this._fetchAndCluster(
            params,
            'time_fired, time_resolved, duration_sec, operator, message, application, panel_title'
        );
        return ResponseFormatter.success(this.analysisService.computePanelAnalysis(records, thresholds));
    }

    /**
     * Get paginated list of alerts, with optional clustering, sorting, and filtering.
     * When clustering is enabled, duration filters are applied after clustering.
     * @param {Object} params - Query filters, pagination (page, limit), sorting (sort_by, sort_order)
     * @returns {Object} ResponseFormatter-wrapped array of transformed alert records with pagination metadata
     */
    async getAlerts(params) {
        const thresholds = this._getThresholds(params);
        const { enabled, threshold } = this._getClusteringConfig(params);

        let fetchParams = params;
        if (enabled) {
            const { limit, ...rest } = params;
            fetchParams = rest;

            // Remove duration filters from fetch params - we'll apply them after clustering
            const { min_duration, max_duration, ...paramsWithoutDuration } = fetchParams;
            fetchParams = paramsWithoutDuration;
        }

        const rawRecords = await this.queryService.fetchAlerts(fetchParams);
        let clusteredRecords = this.analysisService.clusterAlerts(rawRecords, enabled, threshold);

        // Apply duration filters AFTER clustering (if clustering is enabled)
        if (enabled && (params.min_duration || params.max_duration)) {
            const minDur = params.min_duration ? parseFloat(params.min_duration) : null;
            const maxDur = params.max_duration ? parseFloat(params.max_duration) : null;

            clusteredRecords = clusteredRecords.filter(cluster => {
                const duration = cluster.cluster_duration || cluster.duration_sec || 0;

                if (minDur !== null && duration < minDur) return false;
                if (maxDur !== null && duration > maxDur) return false;

                return true;
            });
        }

        if (enabled && clusteredRecords.length > 0) {
            const sortBy = params.sort_by || 'time_fired';
            const sortOrder = (params.sort_order || 'DESC').toUpperCase();
            const dir = sortOrder === 'ASC' ? 1 : -1;

            clusteredRecords.sort((a, b) => {
                let aVal = a[sortBy], bVal = b[sortBy];
                if (aVal instanceof Date) aVal = aVal.getTime();
                if (bVal instanceof Date) bVal = bVal.getTime();
                if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                if (typeof bVal === 'string') bVal = bVal.toLowerCase();

                if (aVal < bVal) return -1 * dir;
                if (aVal > bVal) return 1 * dir;
                return 0;
            });
        }

        let finalRecords = clusteredRecords;
        let pagination = null;

        if (params.page && params.limit) {
            const formatted = this.transformService.formatPaginationMeta(finalRecords, params.page, params.limit);
            finalRecords = formatted.records;
            pagination = formatted.pagination;
        } else if (params.limit) {
            if (clusteredRecords.length > params.limit) {
                finalRecords = clusteredRecords.slice(0, params.limit);
            }
        }

        const transformed = this.transformService.transformAlertRecords(finalRecords, thresholds);
        return ResponseFormatter.success(transformed, pagination);
    }

    /**
     * Get list of panels with their alert counts, avg duration, and health scores.
     * @param {Object} params - Query filters
     * @returns {Object} ResponseFormatter-wrapped array of panel stats with health_score and risk_level
     */
    async getPanelList(params) {
        const thresholds = this._getThresholds(params);
        const { enabled } = this._getClusteringConfig(params);

        if (!enabled) {
            const panels = await this.queryService.fetchPanelList(params, thresholds);
            return ResponseFormatter.success(this.transformService.enrichPanelStats(panels));
        }

        const { records } = await this._fetchAndCluster(params, 'panel_title, application, time_fired, duration_sec');
        const panels = this._aggregatePanelStats(records, thresholds);
        return ResponseFormatter.success(this.transformService.enrichPanelStats(panels));
    }

    /**
     * Get top panels ranked by alert count (limited, default 20).
     * @param {Object} params - Query filters, optional limit
     * @returns {Object} ResponseFormatter-wrapped array of panel stats
     */
    async getPanelStats(params) {
        const thresholds = this._getThresholds(params);
        const { enabled } = this._getClusteringConfig(params);

        if (!enabled) {
            const stats = await this.queryService.fetchPanelStats(params, thresholds);
            return ResponseFormatter.success(stats);
        }

        const { records } = await this._fetchAndCluster(params, 'panel_title, application, time_fired, duration_sec');
        const panels = this._aggregatePanelStats(records, thresholds);

        const sorted = panels.sort((a, b) => b.alert_count - a.alert_count);
        const limited = sorted.slice(0, params.limit || 20);

        return ResponseFormatter.success(limited);
    }

    /**
     * Get top applications ranked by alert count.
     * @param {Object} params - Query filters, optional limit (default 10)
     * @returns {Object} ResponseFormatter-wrapped array of { application, alert_count }
     */
    async getTopApplications(params) {
        const { enabled } = this._getClusteringConfig(params);

        if (!enabled) {
            const apps = await this.queryService.fetchTopApplicationsPerPanel(params);
            return ResponseFormatter.success(apps);
        }

        const { records } = await this._fetchAndCluster(params, 'application, time_fired, duration_sec');

        const appMap = new Map();
        for (const record of records) {
            const app = record.application || 'Unknown Application';
            appMap.set(app, (appMap.get(app) || 0) + 1);
        }

        const apps = Array.from(appMap.entries())
            .map(([application, alert_count]) => ({ application, alert_count }))
            .sort((a, b) => b.alert_count - a.alert_count)
            .slice(0, params.limit || 10);

        return ResponseFormatter.success(apps);
    }

    /**
     * Get top nodes ranked by alert count within a given application.
     * @param {Object} params - Query filters including application, optional limit (default 10)
     * @returns {Object} ResponseFormatter-wrapped array of { node_name, alert_count }
     */
    async getTopNodesByApp(params) {
        const { enabled } = this._getClusteringConfig(params);

        if (!enabled) {
            const nodes = await this.queryService.fetchTopNodesPerApplication(params);
            return ResponseFormatter.success(nodes);
        }

        const { records } = await this._fetchAndCluster(params, 'node_name, application, time_fired, duration_sec');

        const nodeMap = new Map();
        for (const record of records) {
            const node = record.node_name || 'Unknown Node';
            nodeMap.set(node, (nodeMap.get(node) || 0) + 1);
        }

        const nodes = Array.from(nodeMap.entries())
            .map(([node_name, alert_count]) => ({ node_name, alert_count }))
            .sort((a, b) => b.alert_count - a.alert_count)
            .slice(0, params.limit || 10);

        return ResponseFormatter.success(nodes);
    }

    /**
     * Find nodes that had alerts on 3+ consecutive days (indicates persistent issues).
     * @param {Object} params - Query filters, optional limit (default 10)
     * @returns {Object} ResponseFormatter-wrapped array of { node_name, consecutive_days, total_alerts, first_alert_date, last_alert_date }
     */
    async getConsecutiveDaysNodes(params) {
        const { enabled } = this._getClusteringConfig(params);

        if (!enabled) {
            const nodes = await this.queryService.fetchConsecutiveDaysNodes(params);
            return ResponseFormatter.success(nodes);
        }

        const { records } = await this._fetchAndCluster(params, 'node_name, time_fired, duration_sec');
        const nodeData = new Map();

        for (const record of records) {
            const node = record.node_name || 'Unknown Node';
            const date = record.time_fired instanceof Date ? record.time_fired : new Date(record.time_fired);
            const dateKey = date.toISOString().split('T')[0];

            if (!nodeData.has(node)) nodeData.set(node, { dates: new Map(), totalAlerts: 0 });
            const data = nodeData.get(node);
            data.dates.set(dateKey, (data.dates.get(dateKey) || 0) + 1);
            data.totalAlerts++;
        }

        const nodes = [];
        for (const [node_name, data] of nodeData) {
            const dates = Array.from(data.dates.keys()).sort();
            let maxConsecutive = 0, currentStreak = 1;
            let streakStart = dates[0], streakEnd = dates[0];
            let bestStreakStart = dates[0], bestStreakEnd = dates[0];

            for (let i = 1; i < dates.length; i++) {
                const prev = new Date(dates[i - 1]), curr = new Date(dates[i]);
                const diffDays = (curr - prev) / (1000 * 60 * 60 * 24);

                if (diffDays === 1) {
                    currentStreak++;
                    streakEnd = dates[i];
                } else {
                    if (currentStreak > maxConsecutive) {
                        maxConsecutive = currentStreak;
                        bestStreakStart = streakStart;
                        bestStreakEnd = streakEnd;
                    }
                    currentStreak = 1;
                    streakStart = dates[i];
                    streakEnd = dates[i];
                }
            }
            if (currentStreak > maxConsecutive) {
                maxConsecutive = currentStreak;
                bestStreakStart = streakStart;
                bestStreakEnd = streakEnd;
            }

            if (maxConsecutive >= 3) {
                nodes.push({
                    node_name,
                    consecutive_days: maxConsecutive,
                    total_alerts: data.totalAlerts,
                    first_alert_date: bestStreakStart,
                    last_alert_date: bestStreakEnd
                });
            }
        }

        const sorted = nodes.sort((a, b) => b.consecutive_days - a.consecutive_days)
            .slice(0, params.limit || 10);
        return ResponseFormatter.success(sorted);
    }

    // ================== INTERNAL HELPERS ==================
    _calculateTrend(current, previous) {
        if (!previous || previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous) * 100;
    }

    _calculatePreviousPeriod(startDateStr, endDateStr) {
        const startDate = startDateStr ? new Date(startDateStr) : new Date();
        const endDate = endDateStr ? new Date(endDateStr) : new Date();
        const duration = endDate.getTime() - startDate.getTime();
        return { prevEndDate: new Date(startDate.getTime()), prevStartDate: new Date(startDate.getTime() - duration) };
    }

    _aggregatePanelStats(records, thresholds) {
        const panelMap = new Map();
        for (const alert of records) {
            const key = alert.panel_title || 'Unknown Panel';
            if (!panelMap.has(key)) {
                panelMap.set(key, {
                    panel_title: key, application: alert.application || 'Unknown',
                    alert_count: 0, total_duration: 0, false_positive_count: 0
                });
            }
            const entry = panelMap.get(key);
            entry.alert_count++;
            entry.total_duration += alert.duration_sec;
            if (alert.duration_sec <= thresholds.false_wakeup_threshold) entry.false_positive_count++;
        }

        return Array.from(panelMap.values())
            .map(panel => ({
                ...panel,
                avg_duration: panel.alert_count > 0 ? Math.round(panel.total_duration / panel.alert_count) : 0
            }))
            .sort((a, b) => b.alert_count - a.alert_count);
    }
}

module.exports = AlertService;
