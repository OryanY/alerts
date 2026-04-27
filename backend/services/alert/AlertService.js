// services/alert/AlertService.js
const sql = require('mssql');
const { DateTime } = require('luxon');
const { getSqlPool } = require('../../database/connection');
const queries = require('../../database/queries/alertQueries');
const { CONFIG } = require('../../config');

class AlertService {
    constructor(sqlPool = null) {
        this.pool = sqlPool;
        this.constants = {
            DEFAULT_CAP: CONFIG.limits?.defaultCap || 100000,
            MAX_PAGE_SIZE: CONFIG.limits?.maxPageSize || 1000,
            DAY_START: CONFIG.shifts?.dayStart || 8,
            DAY_END: CONFIG.shifts?.dayEnd || 22,
            NIGHT_START: CONFIG.shifts?.nightStart || 22,
            NIGHT_END: CONFIG.shifts?.nightEnd || 8,
            DUR_SHORT_MAX: CONFIG.duration?.short || 30,
            DUR_MEDIUM_MAX: CONFIG.duration?.medium || 300,
            FALSE_WAKEUP_THRESHOLD: CONFIG.duration?.falseWakeupThreshold || 120
        };
    }

    getPool() {
        if (!this.pool) this.pool = getSqlPool();
        return this.pool;
    }

    _buildWhereClause(params, request) {
        const conditions = [];

        if (params.start_date) {
            const utcStart = DateTime.fromISO(params.start_date, { zone: 'Asia/Jerusalem' })
                .startOf('day')
                .toUTC()
                .toJSDate();
            request.input('start_date', sql.DateTime, utcStart);
            conditions.push("time_fired >= @start_date");
        }
        if (params.end_date) {
            const utcEnd = DateTime.fromISO(params.end_date, { zone: 'Asia/Jerusalem' })
                .endOf('day')
                .toUTC()
                .toJSDate();
            request.input('end_date', sql.DateTime, utcEnd);
            conditions.push("time_fired <= @end_date");
        }
        if (params.panel_title) {
            request.input('panel_title', sql.NVarChar, params.panel_title);
            conditions.push('panel_title = @panel_title');
        }

        ['application', 'node_name', 'network', 'object', 'operator'].forEach(field => {
            if (params[field]) {
                request.input(field, sql.NVarChar, `${params[field]}%`);
                conditions.push(`${field} LIKE @${field}`);
            }
        });

        if (params.search) {
            request.input('search', sql.NVarChar, `%${params.search}%`);
            conditions.push('message LIKE @search');
        }

        if (params.min_duration) {
            request.input('min_duration', sql.Int, params.min_duration);
            conditions.push('duration_sec >= @min_duration'); // Note: For clustered, you might want cluster_duration
        }
        if (params.max_duration) {
            request.input('max_duration', sql.Int, params.max_duration);
            conditions.push('duration_sec <= @max_duration');
        }

        if (params.has_incident !== undefined) {
            const hasInc = params.has_incident === 'true' || params.has_incident === true;
            if (hasInc) {
                conditions.push('incident_number IS NOT NULL');
            } else {
                conditions.push('incident_number IS NULL');
            }
        }

        return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    }

    _bindThresholds(request, params) {
        const t = {
            day_start: params.day_start ?? this.constants.DAY_START,
            day_end: params.day_end ?? this.constants.DAY_END,
            dur_short_max: params.dur_short_max ?? this.constants.DUR_SHORT_MAX,
            dur_medium_max: params.dur_medium_max ?? this.constants.DUR_MEDIUM_MAX,
            false_wakeup_threshold: params.false_wakeup_threshold ?? this.constants.FALSE_WAKEUP_THRESHOLD
        };
        request.input('day_start', sql.Int, t.day_start);
        request.input('day_end', sql.Int, t.day_end);
        request.input('dur_short_max', sql.Int, t.dur_short_max);
        request.input('dur_medium_max', sql.Int, t.dur_medium_max);
        request.input('false_wakeup_threshold', sql.Int, t.false_wakeup_threshold);
        return t;
    }

    _getClusteringConfig(params) {
        return {
            enabled: params.clustering_enabled !== undefined
                ? (params.clustering_enabled !== 'false' && params.clustering_enabled !== false)
                : CONFIG.clustering.enabledByDefault,
            threshold: params.clustering_threshold ? parseInt(params.clustering_threshold, 10) : (CONFIG.clustering.defaultThreshold || 15)
        };
    }

    async _execute(queryTemplate, params, overrides = {}) {
        const req = this.getPool().request();
        const whereClause = this._buildWhereClause(params, req);
        this._bindThresholds(req, params);

        const clusterConfig = this._getClusteringConfig(params);
        req.input('cluster_threshold', sql.Int, clusterConfig.threshold);

        if (overrides.limit !== undefined) {
            req.input('limit_param', sql.Int, overrides.limit);
        }

        let finalQuery = queryTemplate.replace(/{WHERE_CLAUSE}/g, whereClause);

        if (overrides.replace) {
            for (const [key, val] of Object.entries(overrides.replace)) {
                finalQuery = finalQuery.replace(new RegExp(`{${key}}`, 'g'), val);
            }
        }

        finalQuery = finalQuery.replace(/{[A-Z_]+}/g, '');
        const result = await req.query(finalQuery);
        return result.recordset;
    }

    async getExecutiveKPIs(params) {
        const { enabled } = this._getClusteringConfig(params);
        let sqlKpis;

        if (enabled) {
            const result = await this._execute(queries.CLUSTERED_KPI_STATS, params, { replace: { CLUSTER_FILTER: '' } });
            sqlKpis = result[0] || {};
        } else {
            const result = await this._execute(queries.UNCLUSTERED_KPI_STATS, params);
            sqlKpis = result[0] || {};
        }

        const kpis = {
            total_alerts: sqlKpis.total_alerts || 0,
            avg_duration: sqlKpis.avg_duration || 0,
            median_duration: sqlKpis.median_duration || 0,
            false_positive_rate_247: sqlKpis.total_alerts > 0 ? parseFloat(((sqlKpis.false_wakeups * 100) / sqlKpis.total_alerts).toFixed(1)) : 0,
            true_wakeups: sqlKpis.night_true_wakeups || 0,
            signal_ratio: sqlKpis.total_alerts > 0 ? parseFloat(((sqlKpis.true_alerts * 100) / sqlKpis.total_alerts).toFixed(1)) : 0
        };

        return { success: true, data: kpis };
    }

    async getAlerts(params) {
        const { page, limit, sort_by = 'time_fired', sort_order = 'DESC' } = params;
        const req = this.getPool().request();
        const whereClause = this._buildWhereClause(params, req);

        const { enabled } = this._getClusteringConfig(params);

        if (enabled) {
            this._bindThresholds(req, params);
            req.input('cluster_threshold', sql.Int, params.clustering_threshold ? parseInt(params.clustering_threshold, 10) : (CONFIG.clustering.defaultThreshold || 15));
        }

        let paginationClause = '', topClause = '';
        if (page && limit) {
            req.input('limit_param', sql.Int, limit + 1);
            paginationClause = `OFFSET ${(page - 1) * limit} ROWS FETCH NEXT ${limit + 1} ROWS ONLY`;
        } else {
            req.input('limit_param', sql.Int, limit || this.constants.DEFAULT_CAP);
            topClause = 'TOP (@limit_param)';
        }

        const baseQuery = enabled ? queries.CLUSTERED_ALERTS : queries.SELECT_ALERTS;

        // Ensure sort_by has table prefix 'c.' for the final query if needed, but the RAW CTE needs raw names
        const rawOrderClause = `ORDER BY ${sort_by} ${sort_order}`;
        const finalOrderClause = enabled && sort_by === 'time_fired' ? `ORDER BY c.time_fired ${sort_order}` : `ORDER BY ${sort_by} ${sort_order}`;

        const sqlQuery = baseQuery
            .replace(/{TOP_CLAUSE}/g, topClause)
            .replace(/{WHERE_CLAUSE}/g, whereClause)
            .replace(/{RAW_ORDER_CLAUSE}/g, rawOrderClause)
            .replace(/{ORDER_CLAUSE}/g, finalOrderClause)
            .replace(/{PAGINATION_CLAUSE}/g, paginationClause);

        const result = await req.query(sqlQuery);
        let records = result.recordset;
        let hasNext = false;

        if (page && limit && records.length > limit) {
            hasNext = true;
            records = records.slice(0, limit);
        }

        const ds = params.day_start ? parseInt(params.day_start, 10) : this.constants.DAY_START;
        const de = params.day_end ? parseInt(params.day_end, 10) : this.constants.DAY_END;

        const formatted = records.map(r => {
            const duration_sec = r.duration_sec || 0;
            let raw_alerts = null;
            if (enabled && r.raw_alerts_json) {
                try {
                    raw_alerts = JSON.parse(r.raw_alerts_json);
                } catch (e) {
                    console.error('Failed to parse raw_alerts_json', e);
                }
            }

            let shift = 'Unknown';
            if (r.time_fired) {
                // time_fired is now a pre-converted IL time string (varchar from SQL CONVERT)
                // Parse the hour directly from the string — no UTC→IL conversion needed
                const hrMatch = String(r.time_fired).match(/T(\d{2}):/);
                const hr = hrMatch ? parseInt(hrMatch[1], 10) : null;
                if (hr !== null) shift = (hr >= ds && hr < de) ? 'Day' : 'Night';
            }

            return {
                id: r.incident_id,
                panel_title: r.panel_title,
                application: r.application,
                node_name: r.node_name,
                network: r.network,
                object: r.object,
                operator: r.operator,
                time_fired: r.time_fired,
                time_resolved: r.time_resolved,
                duration_sec: duration_sec,
                duration_category: duration_sec <= (this.constants.DUR_SHORT_MAX || 59) ? 'short' : (duration_sec <= (this.constants.DUR_MEDIUM_MAX || 299) ? 'medium' : 'long'),
                shift: shift,
                message: r.message,
                key_field: r.key_field,
                incident_number: r.incident_number,
                incident_sys_id: r.incident_sys_id,
                history_id: r.history_id,
                is_cluster: r.cluster_count > 1,
                cluster_count: r.cluster_count || 1,
                raw_alerts: raw_alerts
            };
        });

        const response = { success: true, data: formatted };
        if (page && limit) {
            response.meta = { pagination: { page, limit, hasNext } };
        }
        return response;
    }

    async getFilterOptions(params = {}) {
        const pool = this.getPool();
        const req = pool.request();
        req.input('panel_title', sql.NVarChar, params.panel_title || null);

        const result = await req.query(queries.DISTINCT_FILTER_OPTIONS);
        const rows = result.recordset || [];

        const panels = [...new Set(rows.map(r => r.panel_title).filter(Boolean))].sort();
        const applications = [...new Set(rows.map(r => r.application).filter(Boolean))].sort();
        const operators = [...new Set(rows.map(r => r.operator).filter(Boolean))].sort();

        return { success: true, data: { panels, applications, operators } };
    }

    async getPanelList(params) {
        const { enabled } = this._getClusteringConfig(params);
        const queryTarget = enabled ? queries.CLUSTERED_PANEL_LIST : queries.PANEL_LIST;
        const records = await this._execute(queryTarget, params);
        const formatted = records.map(p => ({
            ...p,
            health_score: p.alert_count > 0 ? Math.max(0, 100 - ((p.false_positive_count / p.alert_count) * 100)) : 100
        }));
        return { success: true, data: formatted };
    }

    async getTimeseriesStats(params) {
        const { enabled } = this._getClusteringConfig(params);
        const queryTarget = enabled ? queries.CLUSTERED_TIMESERIES : queries.TIMESERIES;
        const records = await this._execute(queryTarget, params);
        return { success: true, data: records };
    }

    async getIncidentStats(params) {
        const { enabled } = this._getClusteringConfig(params);

        try {
            const batchQuery = enabled ? queries.CLUSTERED_INCIDENT_STATS_BATCH : queries.UNCLUSTERED_INCIDENT_STATS_BATCH;

            const req = this.getPool().request();
            const whereClause = this._buildWhereClause(params, req);

            if (enabled) {
                const clusterThreshold = params.clustering_threshold
                    ? parseInt(params.clustering_threshold, 10)
                    : (CONFIG.clustering.defaultThreshold || 15);
                req.input('cluster_threshold', sql.Int, clusterThreshold);
            }

            const finalQuery = batchQuery.replace(/{WHERE_CLAUSE}/g, whereClause);
            const result = await req.query(finalQuery);

            if (!result.recordsets || result.recordsets.length < 4) {
                throw new Error('Batch query did not return all 4 expected recordsets');
            }

            const [coverageRows, byTeam, byApp, dailyTrend] = result.recordsets;

            return {
                success: true,
                data: {
                    coverage: coverageRows[0] || {},
                    by_team: byTeam || [],
                    by_application: byApp || [],
                    daily_trend: dailyTrend || [],
                }
            };
        } catch (error) {
            console.error('Error fetching incident stats:', error);
            return {
                success: false,
                error: { message: 'Failed to fetch incident stats' }
            };
        }
    }


    async getDurationHistogram(params) {
        let records;
        const { enabled } = this._getClusteringConfig(params);

        if (enabled) {
            records = await this._execute(queries.CLUSTERED_DURATION_HISTOGRAM, params);
        } else {
            records = await this._execute(queries.DURATION_HISTOGRAM, params);
        }

        const row = records[0] || { short_count: 0, medium_count: 0, long_count: 0 };
        const formatted = [
            { category: 'Short', range: `≤${this.constants.DUR_SHORT_MAX}s`, count: row.short_count || 0 },
            { category: 'Medium', range: `${this.constants.DUR_SHORT_MAX + 1}-${this.constants.DUR_MEDIUM_MAX}s`, count: row.medium_count || 0 },
            { category: 'Long', range: `>${this.constants.DUR_MEDIUM_MAX}s`, count: row.long_count || 0 }
        ];

        return { success: true, data: formatted };
    }

    async getHourlyHeatmap(params) {
        const { enabled } = this._getClusteringConfig(params);
        const queryTarget = enabled ? queries.CLUSTERED_HOURLY_HEATMAP : queries.HOURLY_HEATMAP;
        const records = await this._execute(queryTarget, params);

        const dayStart = params.day_start ? parseInt(params.day_start, 10) : 8;
        const dayEnd = params.day_end ? parseInt(params.day_end, 10) : 22;

        const formatted = records.map(r => {
            const hr = parseInt(r.hour, 10);
            return {
                ...r,
                hour_display: `${hr.toString().padStart(2, '0')}:00`,
                is_night: hr < dayStart || hr >= dayEnd
            };
        });

        return { success: true, data: formatted };
    }

    async getShiftAnalysis(params) {
        const { enabled } = this._getClusteringConfig(params);
        const queryTarget = enabled ? queries.CLUSTERED_SHIFT_ANALYSIS : queries.SHIFT_ANALYSIS;
        const records = await this._execute(queryTarget, params);
        return { success: true, data: records };
    }

    async getPanelAnalysis(params) {
        if (!params.panel_title) {
            return {
                success: false,
                error: { message: "panel_title is required for panel analysis" }
            };
        }

        const { enabled } = this._getClusteringConfig(params);

        try {
            const batchQuery = enabled ? queries.CLUSTERED_PANEL_ANALYSIS_BATCH : queries.UNCLUSTERED_PANEL_ANALYSIS_BATCH;

            const req = this.getPool().request();
            const whereClause = this._buildWhereClause(params, req);
            this._bindThresholds(req, params);

            if (enabled) {
                req.input('cluster_threshold', sql.Int, params.clustering_threshold ? parseInt(params.clustering_threshold, 10) : (this.constants.DEFAULT_THRESHOLD || 15));
            }

            const finalQuery = batchQuery.replace(/{WHERE_CLAUSE}/g, whereClause);
            const result = await req.query(finalQuery);

            if (!result.recordsets || result.recordsets.length < 5) {
                throw new Error('Batch query did not return all 5 expected recordsets');
            }

            const [kpiResult, trendResult, heatmapResult, durationResult, noisyResult] = result.recordsets;

            const sqlKpis = kpiResult[0] || {};
            const total = sqlKpis.total_alerts || 0;

            const summary = {
                total_alerts: total,
                avg_duration: sqlKpis.avg_duration || 0,
                median_duration: sqlKpis.median_duration || 0,
                false_positive_rate: total > 0 ? parseFloat(((sqlKpis.false_wakeups * 100) / total).toFixed(1)) : 0,
                night_wakeups: sqlKpis.night_alerts || 0,
                night_false_wakeups: sqlKpis.night_false_wakeups || 0,
                alerts_per_day: total > 0 && trendResult.length > 0 ? Math.round(total / trendResult.length) : 0,
                trend_direction: 'stable' // Can calculate from trendResult if needed later
            };

            // Format Duration Histogram
            const shortMax = params.dur_short_max ? parseInt(params.dur_short_max, 10) : this.constants.DUR_SHORT_MAX;
            const mediumMax = params.dur_medium_max ? parseInt(params.dur_medium_max, 10) : this.constants.DUR_MEDIUM_MAX;

            const durRow = durationResult[0] || { short_count: 0, medium_count: 0, long_count: 0 };
            const formattedDuration = [
                { category: 'Short', range: `≤${shortMax}s`, count: durRow.short_count || 0 },
                { category: 'Medium', range: `${shortMax + 1}-${mediumMax}s`, count: durRow.medium_count || 0 },
                { category: 'Long', range: `>${mediumMax}s`, count: durRow.long_count || 0 }
            ];

            // Format Hourly Heatmap
            const dayStart = params.day_start ? parseInt(params.day_start, 10) : this.constants.DAY_START;
            const dayEnd = params.day_end ? parseInt(params.day_end, 10) : this.constants.DAY_END;
            const formattedHeatmap = (heatmapResult || []).map(r => {
                const hr = parseInt(r.hour, 10);
                return {
                    ...r,
                    hour_display: `${hr.toString().padStart(2, '0')}:00`,
                    is_night: hr < dayStart || hr >= dayEnd
                };
            });

            return {
                success: true,
                data: {
                    summary,
                    daily_trend: trendResult || [],
                    duration_distribution: formattedDuration,
                    hourly_heatmap: formattedHeatmap,
                    top_noisy_alerts: noisyResult || []
                }
            };
        } catch (error) {
            console.error('Error fetching panel analysis:', error);
            return {
                success: false,
                error: { message: 'Failed to fetch panel analysis' }
            };
        }
    }

    async getPanelStats(params) {
        const { enabled } = this._getClusteringConfig(params);
        const queryTarget = enabled ? queries.CLUSTERED_PANEL_STATS : queries.PANEL_STATS;
        
        const records = await this._execute(queryTarget, params, {
            limit: params.limit || 20,
            replace: { TOP_CLAUSE: params.limit ? 'TOP (@limit_param)' : '' }
        });
        return { success: true, data: records };
    }

    async getTopApplications(params) {
        const { enabled } = this._getClusteringConfig(params);
        const queryTarget = enabled ? queries.CLUSTERED_TOP_APPLICATIONS : queries.TOP_APPLICATIONS;
        const records = await this._execute(queryTarget, params, { limit: params.limit || 10 });
        return { success: true, data: records };
    }

    async getTopNodesByApp(params) {
        const { enabled } = this._getClusteringConfig(params);
        const queryTarget = enabled ? queries.CLUSTERED_TOP_NODES_BY_APP : queries.TOP_NODES_BY_APP;
        const records = await this._execute(queryTarget, params, { limit: params.limit || 10 });
        return { success: true, data: records };
    }

    async getTopObjectsByApp(params) {
        const { enabled } = this._getClusteringConfig(params);
        const queryTarget = enabled ? queries.CLUSTERED_TOP_OBJECTS_BY_APP : queries.TOP_OBJECTS_BY_APP;
        const records = await this._execute(queryTarget, params, { limit: params.limit || 10 });
        return { success: true, data: records };
    }

    async getConsecutiveDaysNodes(params) {
        const { enabled } = this._getClusteringConfig(params);
        const queryTarget = enabled ? queries.CLUSTERED_CONSECUTIVE_DAYS_NODES : queries.CONSECUTIVE_DAYS_NODES;
        const records = await this._execute(queryTarget, params, { limit: params.limit || 10 });
        return { success: true, data: records };
    }

}

module.exports = AlertService;
