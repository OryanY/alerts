// services/alert/AlertService.js
// Main orchestration layer - coordinates between query, analysis, and transform layers

const { getSqlPool } = require('../../database/connection');
const { AlertQueryService } = require('./AlertQueryService');
const { AlertAnalysisService } = require('./AlertAnalysisService');
const { AlertTransformService } = require('./AlertTransformService');
const { ResponseFormatter } = require('../../utils/ResponseFormatter');
const { CONFIG } = require('../../config');

class AlertService {
    constructor(sqlPool = null) {
        this.pool = sqlPool;
        this.constants = this._initializeConstants();

        // Lazy-loaded services
        this._queryService = null;
        this._analysisService = null;
        this._transformService = null;
    }

    // Initialize frozen constants to prevent mutation
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

    // Lazy getters for dependency injection
    getPool() {
        if (!this.pool) {
            this.pool = getSqlPool();
        }
        return this.pool;
    }

    get queryService() {
        if (!this._queryService) {
            this._queryService = new AlertQueryService(this.getPool(), this.constants);
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

    // Extract threshold configuration from params with defaults
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

    // Extract clustering configuration from params
    _getClusteringConfig(params = {}) {
        return {
            enabled: params.clustering_enabled !== 'false' && params.clustering_enabled !== false,
            threshold: params.clustering_threshold ? parseInt(params.clustering_threshold, 10) : 15
        };
    }

    // Calculate percentage change between current and previous values
    _calculateTrend(current, previous) {
        if (!previous || previous === 0) {
            return current > 0 ? 100 : 0;
        }
        return ((current - previous) / previous) * 100;
    }

    // Centralized helper to fetch raw records and apply clustering
    async _fetchAndCluster(params, fields, forceClustering = null) {
        const { enabled, threshold } = this._getClusteringConfig(params);

        // Use forced state if provided, otherwise config
        const shouldCluster = forceClustering !== null ? forceClustering : enabled;

        // If clustering is enabled, we MUST fetch all records (no limit) to cluster correctly.
        // If clustering is disabled, we can respect the limit if it exists (though usually we fetch all for analytics).
        let fetchParams = params;
        if (shouldCluster) {
            const { limit, ...rest } = params;
            fetchParams = rest;
        }

        const rawRecords = await this.queryService.fetchBasicRecords(fetchParams, fields);

        const records = this.analysisService.clusterAlerts(rawRecords, shouldCluster, threshold);

        return { records, clusteringEnabled: shouldCluster };
    }

    // PUBLIC API METHODS

    async getAlerts(params) {
        const thresholds = this._getThresholds(params);

        // Note: fetchAlerts is special because QueryService.fetchAlerts does huge query building.
        // But for consistency with clustering, we should use the basic record fetch + manual clustering strategy
        // IF clustering is enabled.
        // However, fetchAlerts (the query) returns full objects, fetchBasicRecords returns partials.
        // To strictly support full alert objects with clustering, we need fetchAlerts (query) but without limit if clustering is on.

        // Let's defer full refactor of getAlerts for now to avoid breaking the complex query builder 
        // unless we want to change fetchBasicRecords to fetch *all* columns.
        // Actually, getAlerts uses `fetchAlerts`, not `fetchBasicRecords`.
        // So for getAlerts, we keep the specific logic but adopt the pattern:

        const { enabled, threshold } = this._getClusteringConfig(params);

        // Fetch step
        let fetchParams = params;
        if (enabled) {
            const { limit, ...rest } = params;
            fetchParams = rest;
        }

        const rawRecords = await this.queryService.fetchAlerts(fetchParams);

        // Clustering step
        let clusteredRecords = this.analysisService.clusterAlerts(rawRecords, enabled, threshold);

        // Sorting
        if (enabled && clusteredRecords.length > 0) {
            const sortBy = params.sort_by || 'time_fired';
            const sortOrder = (params.sort_order || 'DESC').toUpperCase();
            const dir = sortOrder === 'ASC' ? 1 : -1;

            clusteredRecords.sort((a, b) => {
                let aVal = a[sortBy];
                let bVal = b[sortBy];

                if (aVal instanceof Date) aVal = aVal.getTime();
                if (bVal instanceof Date) bVal = bVal.getTime();

                if (typeof aVal === 'string') aVal = aVal.toLowerCase();
                if (typeof bVal === 'string') bVal = bVal.toLowerCase();

                if (aVal < bVal) return -1 * dir;
                if (aVal > bVal) return 1 * dir;
                return 0;
            });
        }

        // Pagination logic remains here as it's specific to the list view
        let finalRecords = clusteredRecords;
        let pagination = null;

        if (params.page && params.limit) {
            const formatted = this.transformService.formatPaginationMeta(
                finalRecords, // pass the full list (clustered or raw) to be sliced
                params.page,
                params.limit
            );
            finalRecords = formatted.records;
            pagination = formatted.pagination;
        } else if (params.limit && !enabled) {
            // If we didn't cluster, and we didn't paginate, but we had a limit, the query might have applied it.
            // If we DID cluster, we fetched all, so now we must apply limit.
            if (clusteredRecords.length > params.limit) {
                finalRecords = clusteredRecords.slice(0, params.limit);
            }
        } else if (params.limit && enabled) {
            if (clusteredRecords.length > params.limit) {
                finalRecords = clusteredRecords.slice(0, params.limit);
            }
        }


        // Transform to API format
        const transformed = this.transformService.transformAlertRecords(clusteredRecords, thresholds);

        return ResponseFormatter.success(transformed, pagination);
    }

    async getExecutiveKPIs(params) {
        const thresholds = this._getThresholds(params);
        // Fetch current period data
        const { records, clusteringEnabled } = await this._fetchAndCluster(
            params,
            'time_fired, duration_sec, application, panel_title'
        );

        const kpis = this.analysisService.computeKPIs(records, thresholds);

        try {
            // Calculate previous period for trend analysis
            const { prevStartDate, prevEndDate } = this._calculatePreviousPeriod(
                params.start_date,
                params.end_date
            );

            const prevParams = {
                ...params,
                start_date: prevStartDate.toISOString(),
                end_date: prevEndDate.toISOString()
            };

            // Fetch previous period data
            // Note: force clustering state to match current period
            const { records: prevRecords } = await this._fetchAndCluster(
                prevParams,
                'time_fired, duration_sec, application, panel_title',
                clusteringEnabled
            );

            const prevKpis = this.analysisService.computeKPIs(prevRecords, thresholds);

            // Calculate trends
            const noiseTrendPct = this._calculateTrend(
                kpis.false_positive_rate_247,
                prevKpis.false_positive_rate_247
            );

            const totalTrendPct = this._calculateTrend(
                kpis.total_alerts,
                prevKpis.total_alerts
            );

            return ResponseFormatter.success({
                ...kpis,
                noise_trend_pct: parseFloat(noiseTrendPct.toFixed(1)),
                total_trend_pct: parseFloat(totalTrendPct.toFixed(1))
            });

        } catch (error) {
            console.error('Trend calculation failed:', error.message);

            // Return KPIs without trends on error
            return ResponseFormatter.success({
                ...kpis,
                noise_trend_pct: 0,
                total_trend_pct: 0
            });
        }
    }

    // Calculate the previous period dates based on current date range
    _calculatePreviousPeriod(startDateStr, endDateStr) {
        const startDate = startDateStr ? new Date(startDateStr) : new Date();
        const endDate = endDateStr ? new Date(endDateStr) : new Date();

        const duration = endDate.getTime() - startDate.getTime();

        return {
            prevEndDate: new Date(startDate.getTime()),
            prevStartDate: new Date(startDate.getTime() - duration)
        };
    }

    async getDurationHistogram(params) {
        const thresholds = this._getThresholds(params);

        const sqlResult = await this.queryService.fetchDurationHistogram(params, thresholds);

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

        const total = histogram.reduce((sum, bucket) => sum + bucket.count, 0);
        const formatted = this.transformService.formatDurationHistogram(histogram, total);

        return ResponseFormatter.success(formatted);
    }

    async getHourlyHeatmap(params) {
        const thresholds = this._getThresholds(params);
        const heatmap = await this.queryService.fetchHourlyHeatmap(params);
        const formatted = this.transformService.formatHourlyHeatmap(heatmap, thresholds);

        return ResponseFormatter.success(formatted);
    }

    async getShiftAnalysis(params) {
        const thresholds = this._getThresholds(params);
        const analysis = await this.queryService.fetchShiftAnalysis(params, thresholds);

        const enriched = analysis.map(shift => ({
            ...shift,
            false_wakeup_rate: shift.alert_count > 0
                ? parseFloat(((shift.false_wakeups * 100) / shift.alert_count).toFixed(1))
                : 0
        }));

        return ResponseFormatter.success(enriched);
    }

    async getOverviewStats(params) {
        const thresholds = this._getThresholds(params);
        const sqlStats = await this.queryService.fetchOverviewStats(params, thresholds);

        const stats = {
            ...sqlStats,
            signal_to_noise_ratio: sqlStats.total_alerts > 0
                ? parseFloat((((sqlStats.total_alerts - sqlStats.short_alerts) * 100) / sqlStats.total_alerts).toFixed(1))
                : 0
        };

        const enriched = this.transformService.addDateRangeMeta(stats, params);

        return ResponseFormatter.success(enriched);
    }

    async getHourlyStats(params) {
        const thresholds = this._getThresholds(params);

        const records = await this.queryService.fetchBasicRecords(
            params,
            'time_fired, duration_sec'
        );

        const hourlyStats = this.analysisService.computeHourlyStats(records, thresholds);

        return ResponseFormatter.success(hourlyStats);
    }

    async getTimeseriesStats(params) {
        const thresholds = this._getThresholds(params);

        const records = await this.queryService.fetchBasicRecords(
            params,
            'time_fired, duration_sec'
        );

        const timeseries = this.analysisService.computeTimeseries(records, thresholds);

        return ResponseFormatter.success(timeseries);
    }

    async getPanelList(params) {
        const thresholds = this._getThresholds(params);
        const { enabled } = this._getClusteringConfig(params);

        if (!enabled) {
            const panels = await this.queryService.fetchPanelList(params, thresholds);
            return ResponseFormatter.success(this.transformService.enrichPanelStats(panels));
        }

        const { records: clusteredRecords } = await this._fetchAndCluster(
            params,
            'panel_title, application, time_fired, duration_sec'
        );

        const panels = this._aggregatePanelStats(clusteredRecords, thresholds);
        const enriched = this.transformService.enrichPanelStats(panels);

        return ResponseFormatter.success(enriched);
    }

    // Helper method for panel list with clustering
    async _getPanelListWithClustering(params, thresholds, clusterThreshold) {
        // Fix: Do not limit raw records when clustering, otherwise aggregation is incorrect.
        // The limit should only apply to the final number of panels returned.
        const { limit, ...fetchParams } = params;

        const rawRecords = await this.queryService.fetchBasicRecords(
            fetchParams,
            'panel_title, application, time_fired, duration_sec'
        );

        const clusteredRecords = this.analysisService.clusterAlerts(
            rawRecords,
            true,
            clusterThreshold
        );

        return this._aggregatePanelStats(clusteredRecords, thresholds);
    }

    // Aggregate panel statistics from clustered records
    _aggregatePanelStats(records, thresholds) {
        const panelMap = new Map();

        for (const alert of records) {
            const key = alert.panel_title || 'Unknown Panel';

            if (!panelMap.has(key)) {
                panelMap.set(key, {
                    panel_title: key,
                    application: alert.application || 'Unknown',
                    alert_count: 0,
                    total_duration: 0,
                    false_positive_count: 0
                });
            }

            const entry = panelMap.get(key);

            // Revert: User prefers counting Incidents (Clusters) when clustering is enabled.
            // So a cluster of 50 alerts counts as 1 item in the list.
            entry.alert_count++;

            // Duration aggregation logic:
            // For clusters, duration_sec is the total span of the incident.
            // If we want "Average Duration of Alerts", we might need the sum of individual durations.
            // But for panel stats, we usually want "Incidents" or "Impact".
            // However, to match raw DB stats, we should probably stick to accumulating impact or count.
            // Let's assume for panel list we want SUM of durations? 
            // Original code: entry.total_duration += alert.duration_sec
            // If alert is a cluster, duration_sec is the cluster duration.
            // Let's keep it as adding the incident duration.
            entry.total_duration += alert.duration_sec;

            if (alert.duration_sec <= thresholds.false_wakeup_threshold) {
                // If the entire cluster is short, does that count as N false positives or 1?
                // Logic: A "False Wakeup" is usually an event. A cluster is an event.
                // But if we are counting "Alerts", maybe we should count false positives?
                // Existing logic: entry.false_positive_count++;
                // Let's keep counting events (incidents) for FP to avoid skewing unless we unpack.
                entry.false_positive_count++;
            }
        }

        return Array.from(panelMap.values())
            .map(panel => ({
                ...panel,
                avg_duration: panel.alert_count > 0
                    ? Math.round(panel.total_duration / panel.alert_count)
                    : 0
            }))
            .sort((a, b) => b.alert_count - a.alert_count);
    }

    async getPanelStats(params) {
        const thresholds = this._getThresholds(params);
        const stats = await this.queryService.fetchPanelStats(params, thresholds);

        return ResponseFormatter.success(stats);
    }

    async getPanelAnalysis(params) {
        const thresholds = this._getThresholds(params);

        const { records } = await this._fetchAndCluster(
            params,
            'time_fired, time_resolved, duration_sec, operator, message, application, panel_title'
        );

        const analysis = this.analysisService.computePanelAnalysis(records, thresholds);

        return ResponseFormatter.success(analysis);
    }

    async getAlertMessageBreakdown(params) {
        const thresholds = this._getThresholds(params);
        const breakdown = await this.queryService.fetchMessageBreakdown(params, thresholds);

        return ResponseFormatter.success(breakdown);
    }

    async getTopNoisyNodes(params) {
        const nodes = await this.queryService.fetchTopNoisyNodes(params);

        let filtered = nodes;
        if (params.min_percent) {
            const minPercent = parseFloat(params.min_percent);
            if (!isNaN(minPercent)) {
                filtered = nodes.filter(node => node.alert_percent >= minPercent);
            }
        }

        return ResponseFormatter.success(filtered);
    }

    async getTopApplications(params) {
        const { enabled } = this._getClusteringConfig(params);

        if (!enabled) {
            const apps = await this.queryService.fetchTopApplicationsPerPanel(params);
            return ResponseFormatter.success(apps);
        }

        const { records } = await this._fetchAndCluster(
            params,
            'application, time_fired, duration_sec'
        );

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

    async getTopNodesByApp(params) {
        const { enabled } = this._getClusteringConfig(params);

        if (!enabled) {
            const nodes = await this.queryService.fetchTopNodesPerApplication(params);
            return ResponseFormatter.success(nodes);
        }

        const { records } = await this._fetchAndCluster(
            params,
            'node_name, application, time_fired, duration_sec'
        );

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

    async getConsecutiveDaysNodes(params) {
        const nodes = await this.queryService.fetchConsecutiveDaysNodes(params);
        return ResponseFormatter.success(nodes);
    }
}

module.exports = AlertService;
