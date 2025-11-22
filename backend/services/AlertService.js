// services/AlertService.js - Centralized business logic (Option 3)

const { getSqlPool } = require('../database/connection');
const { QueryBuilder } = require('../utils/QueryBuilder');
const { TimeUtils } = require('../utils/TimeUtils');
const { ResponseFormatter } = require('../utils/ResponseFormatter');
const sql = require('mssql');

class AlertService {
  constructor() {
    this.pool = null;

    // Global defaults (normalized)
    this.DEFAULT_CAP = 100000;

    this.DEFAULT_DAY_START = 8;
    this.DEFAULT_DAY_END = 22;

    this.DEFAULT_NIGHT_START = 22;
    this.DEFAULT_NIGHT_END = 8;

    this.DEFAULT_DUR_SHORT_MAX = 30;   // ≤30s
    this.DEFAULT_DUR_MEDIUM_MAX = 300; // 31–300s
    this.DEFAULT_FALSE_WAKEUP_THRESHOLD = 120; // ≤120s considered false wake
  }

  // ================== Infrastructure ==================

  getPool() {
    if (!this.pool) {
      this.pool = getSqlPool();
    }
    return this.pool;
  }

  _getSqlType(type) {
    const typeMap = {
      Int: sql.Int,
      DateTime2: sql.DateTime2,
      NVarChar: sql.NVarChar,
    };
    return typeMap[type] || sql.NVarChar;
  }

  /**
   * Normalizes thresholds and time-window parameters for all computations.
   */
  _getThresholds(params = {}) {
    const day_start = params.day_start ?? this.DEFAULT_DAY_START;
    const day_end = params.day_end ?? this.DEFAULT_DAY_END;
    const night_start = params.night_start ?? this.DEFAULT_NIGHT_START;
    const night_end = params.night_end ?? this.DEFAULT_NIGHT_END;
    const dur_short_max = params.dur_short_max ?? this.DEFAULT_DUR_SHORT_MAX;
    const dur_medium_max = params.dur_medium_max ?? this.DEFAULT_DUR_MEDIUM_MAX;
    const false_wakeup_threshold =
      params.false_wakeup_threshold ?? this.DEFAULT_FALSE_WAKEUP_THRESHOLD;

    return {
      day_start,
      day_end,
      night_start,
      night_end,
      dur_short_max,
      dur_medium_max,
      false_wakeup_threshold,
    };
  }

  /**
   * Base SELECT ... FROM dbo.historicalAlerts
   * - Handles start_date / end_date (UTC conversion via TimeUtils.validateDateRange)
   * - Optional exact panel_title filter
   * - TOP (@cap) with hard cap of DEFAULT_CAP
   * - ORDER BY time_fired DESC
   *
   * @param {sql.Request} request
   * @param {object} params
   * @param {string} fields - projection list (e.g. "time_fired, duration_sec")
   * @param {object} options
   *    - requirePanelTitle: boolean (if true, throws if no panel_title)
   * @returns {string} SQL text
   */
  _buildBaseQuery(request, params, fields, options = {}) {
    const { requirePanelTitle = false } = options;

    const range = TimeUtils.validateDateRange(params.start_date, params.end_date);
    const where = [];

    if (range?.start) {
      request.input('start', this._getSqlType('DateTime2'), range.start);
      where.push('time_fired >= @start');
    }
    if (range?.end) {
      request.input('end', this._getSqlType('DateTime2'), range.end);
      where.push('time_fired <= @end');
    }

    if (params.panel_title) {
      request.input('panelTitle', this._getSqlType('NVarChar'), params.panel_title);
      where.push('panel_title = @panelTitle');
    } else if (requirePanelTitle) {
      throw new Error('panel_title is required');
    }

    const cap = Math.min(params.limit || this.DEFAULT_CAP, this.DEFAULT_CAP);
    request.input('cap', this._getSqlType('Int'), cap);

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    return `
      SELECT TOP (@cap) ${fields}
      FROM dbo.historicalAlerts
      ${whereClause}
      ORDER BY time_fired DESC
    `;
  }

  /**
   * WHERE builder for group-by style queries.
   * Uses start_date / end_date from params and optional panel_title override.
   *
   * @param {sql.Request} request
   * @param {object} params
   * @param {object} overrides
   *    - panel_title: override of params.panel_title
   * @returns {string[]} where parts
   */
  _buildWhereClause(request, params, overrides = {}) {
    const range = TimeUtils.validateDateRange(params.start_date, params.end_date);
    const where = [];

    if (range?.start) {
      request.input('start', this._getSqlType('DateTime2'), range.start);
      where.push('time_fired >= @start');
    }
    if (range?.end) {
      request.input('end', this._getSqlType('DateTime2'), range.end);
      where.push('time_fired <= @end');
    }

    const panelTitle = overrides.panel_title ?? params.panel_title;
    if (panelTitle) {
      request.input('panelTitle', this._getSqlType('NVarChar'), panelTitle);
      where.push('panel_title = @panelTitle');
    }

    return where;
  }

  // ================== Filter Binding for getAlerts (flexible search) ==================

  _bindDateFilters(request, params) {
    const range = TimeUtils.validateDateRange(params.start_date, params.end_date);
    const conditions = [];

    if (range?.start) {
      request.input('startDate', this._getSqlType('DateTime2'), range.start);
      conditions.push('time_fired >= @startDate');
    }
    if (range?.end) {
      request.input('endDate', this._getSqlType('DateTime2'), range.end);
      conditions.push('time_fired <= @endDate');
    }

    return conditions;
  }

  _bindFieldFilters(request, params) {
    const conditions = [];
    const fields = ['panel_title', 'application', 'node_name', 'network', 'object', 'operator'];

    fields.forEach((field) => {
      if (params[field]) {
        // Array-based filter for panel_titles
        if (field === 'panel_title' && params.panel_titles && Array.isArray(params.panel_titles)) {
          const panelTitles = params.panel_titles;
          const placeholders = panelTitles
            .map((_, index) => `@${field}_${index}`)
            .join(',');
          conditions.push(`panel_title IN (${placeholders})`);
          panelTitles.forEach((title, index) => {
            request.input(`${field}_${index}`, this._getSqlType('NVarChar'), title);
          });
        } else {
          // Prefix LIKE filter for single values
          conditions.push(`${field} LIKE @${field}`);
          request.input(field, this._getSqlType('NVarChar'), `${params[field]}%`);
        }
      }
    });

    if (params.min_duration !== undefined) {
      conditions.push('duration_sec >= @minDuration');
      request.input('minDuration', this._getSqlType('Int'), params.min_duration);
    }

    if (params.max_duration !== undefined) {
      conditions.push('duration_sec <= @maxDuration');
      request.input('maxDuration', this._getSqlType('Int'), params.max_duration);
    }

    return conditions;
  }

  // ================== Public API ==================

  /**
   * Paginated, filterable alerts list (table view)
   */
  async getAlerts(params) {
    const pool = this.getPool();
    const request = pool.request();

    const qb = new QueryBuilder()
      .select(
        `incident_id, panel_title, application, node_name, network, object,
         operator, time_fired, time_resolved, duration_sec, message, key_field, history_id`
      )
      .orderBy(params.sort_by, params.sort_order);

    const whereParts = [
      ...this._bindDateFilters(request, params),
      ...this._bindFieldFilters(request, params),
    ];

    whereParts.forEach((w) => qb.addWhere(w));

    let pagination = null;
    if (params.page && params.limit) {
      const offset = (params.page - 1) * params.limit;
      qb.offset(offset, params.limit + 1); // +1 to detect hasNext
    } else if (params.limit) {
      qb.top(params.limit);
    }

    const [sqlText, sqlParams] = qb.build();

    sqlParams.forEach((p) => {
      const type = this._getSqlType(p.type);
      request.input(p.name, type, p.value);
    });

    const result = await request.query(sqlText);
    let records = result.recordset;

    if (params.page && params.limit) {
      const hasNext = records.length > params.limit;
      if (hasNext) records = records.slice(0, -1);
      pagination = {
        page: params.page,
        limit: params.limit,
        hasNext,
        hasPrev: params.page > 1,
      };
    }

    const transformedData = records.map((r) => this._transformAlertRecord(r, params));
    return ResponseFormatter.success(transformedData, pagination);
  }

  /**
   * Executive KPIs – minimal data: time_fired, duration_sec
   */
  async getExecutiveKPIs(params) {
    const pool = this.getPool();
    const request = pool.request();

    const query = this._buildBaseQuery(request, params, 'time_fired, duration_sec');
    const result = await request.query(query);

    const kpis = this._computeKPIs(result.recordset, params);
    return ResponseFormatter.success(kpis);
  }

  /**
   * Duration histogram (short/medium/long)
   */
  async getDurationHistogram(params) {
    const pool = this.getPool();
    const request = pool.request();

    const query = this._buildBaseQuery(request, params, 'duration_sec');
    const result = await request.query(query);

    const histogram = this._computeDurationHistogram(result.recordset, params);
    return ResponseFormatter.success(histogram);
  }

  /**
   * Hourly heatmap (24 buckets)
   */
  async getHourlyHeatmap(params) {
    const pool = this.getPool();
    const request = pool.request();

    const query = this._buildBaseQuery(request, params, 'time_fired');
    const result = await request.query(query);

    const heatmap = this._computeHourlyHeatmap(result.recordset, params);
    return ResponseFormatter.success(heatmap);
  }

  /**
   * Shift analysis (Day/Night buckets)
   */
  async getShiftAnalysis(params) {
    const pool = this.getPool();
    const request = pool.request();

    const query = this._buildBaseQuery(
      request,
      params,
      'time_fired, duration_sec, panel_title, operator'
    );
    const result = await request.query(query);

    const analysis = this._computeShiftAnalysis(result.recordset, params);
    return ResponseFormatter.success(analysis);
  }

  /**
   * Overview stats (global)
   */
  async getOverviewStats(params) {
    const pool = this.getPool();
    const request = pool.request();

    const query = this._buildBaseQuery(request, params, 'time_fired, duration_sec');
    const result = await request.query(query);

    const stats = this._computeOverviewStats(result.recordset, params);

    // Preserve explicit date_range in response
    stats.date_range =
      params.start_date && params.end_date
        ? { start: params.start_date, end: params.end_date }
        : null;

    return ResponseFormatter.success(stats);
  }

  /**
   * Hourly stats with duration breakdown per hour
   */
  async getHourlyStats(params) {
    const records = await this._getBasicAlertData(params);
    const hourlyStats = this._computeHourlyStats(records, params);
    return ResponseFormatter.success(hourlyStats);
  }

  /**
   * Per-panel aggregate stats (alert count, avg duration, etc.)
   */
  async getPanelList(params) {
    const pool = this.getPool();
    const request = pool.request();

    const where = this._buildWhereClause(request, params);

    const { false_wakeup_threshold, dur_short_max, dur_medium_max } =
      this._getThresholds(params);

    request.input(
      'false_wakeup_threshold',
      this._getSqlType('Int'),
      false_wakeup_threshold
    );
    request.input('dur_short_max', this._getSqlType('Int'), dur_short_max);
    request.input('dur_medium_max', this._getSqlType('Int'), dur_medium_max);

    const sqlText = `
      SELECT 
        panel_title,
        COUNT(*) AS alert_count,
        COUNT(CASE WHEN duration_sec <= @false_wakeup_threshold THEN 1 END) AS false_positive_count,
        ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration,
        COUNT(DISTINCT application) AS application_count
      FROM dbo.historicalAlerts
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      GROUP BY panel_title
      ORDER BY alert_count DESC
    `;

    const result = await request.query(sqlText);
    return ResponseFormatter.success(result.recordset);
  }

  /**
   * Timeseries stats by day (alert_count, avg_duration, day/night split)
   */
  async getTimeseriesStats(params) {
    const pool = this.getPool();
    const request = pool.request();

    const query = this._buildBaseQuery(request, params, 'time_fired, duration_sec');
    const result = await request.query(query);

    const timeseries = this._computeTimeseriesStats(result.recordset, params);
    return ResponseFormatter.success(timeseries);
  }

  /**
   * Detailed panel analysis – single panel, rich metrics
   */
  async getPanelAnalysis(params) {
    if (!params.panel_title) {
      throw new Error('panel_title is required');
    }

    const pool = this.getPool();
    const request = pool.request();

    const fields = `
      incident_id, panel_title, application, time_fired,
      time_resolved, duration_sec, operator, message
    `;
    const query = this._buildBaseQuery(
      request,
      { ...params, panel_title: params.panel_title },
      fields,
      { requirePanelTitle: true }
    );
    const result = await request.query(query);

    const analysis = this._computePanelAnalysis(result.recordset, params);
    return ResponseFormatter.success(analysis);
  }

  /**
   * Alert message breakdown per panel (frequency, avg duration, etc.)
   */
  async getAlertMessageBreakdown(params) {
    if (!params.panel_title) {
      throw new Error('panel_title is required');
    }

    const pool = this.getPool();
    const request = pool.request();

    const where = this._buildWhereClause(request, params, {
      panel_title: params.panel_title,
    });

    const { false_wakeup_threshold } = this._getThresholds(params);
    request.input(
      'false_wakeup_threshold',
      this._getSqlType('Int'),
      false_wakeup_threshold
    );

    const sqlText = `
      SELECT 
        message,
        COUNT(*) AS occurrence_count,
        ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration,
        MIN(duration_sec) AS min_duration,
        MAX(duration_sec) AS max_duration,
        COUNT(CASE WHEN duration_sec <= @false_wakeup_threshold THEN 1 END) AS false_positive_count
      FROM dbo.historicalAlerts
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      GROUP BY message
      ORDER BY occurrence_count DESC
    `;

    const result = await request.query(sqlText);
    return ResponseFormatter.success(result.recordset);
  }

  /**
   * Panel stats grouped by panel_title + application
   */
  async getPanelStats(params) {
    const pool = this.getPool();
    const request = pool.request();

    const where = this._buildWhereClause(request, params);

    const limit = params.limit || null;
    const { dur_short_max, dur_medium_max } = this._getThresholds(params);

    if (limit) {
      request.input('limit', this._getSqlType('Int'), limit);
    }
    request.input('dur_short_max', this._getSqlType('Int'), dur_short_max);
    request.input('dur_medium_max', this._getSqlType('Int'), dur_medium_max);

    const topClause = limit ? 'TOP (@limit)' : '';
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const sqlText = `
      SELECT ${topClause}
        panel_title,
        application,
        COUNT(*) AS alert_count,
        ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration,
        MIN(duration_sec) AS min_duration,
        MAX(duration_sec) AS max_duration,
        COUNT(CASE WHEN duration_sec <= @dur_short_max THEN 1 END) AS short_alerts,
        COUNT(CASE WHEN duration_sec > @dur_short_max AND duration_sec <= @dur_medium_max THEN 1 END) AS medium_alerts,
        COUNT(CASE WHEN duration_sec > @dur_medium_max THEN 1 END) AS long_alerts
      FROM dbo.historicalAlerts
      ${whereClause}
      GROUP BY panel_title, application
      ORDER BY alert_count DESC
    `;

    try {
      const result = await request.query(sqlText);
      return ResponseFormatter.success(result.recordset);
    } catch (err) {
      console.error('Database query failed:', err);
      return ResponseFormatter.error('Database query failed', err);
    }
  }

  // ================== Internal fetch helpers ==================

  /**
   * Basic alert data: time_fired, duration_sec
   * Used by hourly / timeseries stats.
   */
  async _getBasicAlertData(params) {
    const pool = this.getPool();
    const request = pool.request();

    const query = this._buildBaseQuery(request, params, 'time_fired, duration_sec');
    const result = await request.query(query);
    return result.recordset;
  }

  // ================== Transformations ==================

  _transformAlertRecord(record, config = {}) {
    const {
      day_start,
      day_end,
      dur_short_max,
      dur_medium_max,
    } = this._getThresholds(config);

    const ilHour = TimeUtils.getILHour(record.time_fired);
    const shift =
      ilHour !== null && ilHour >= day_start && ilHour < day_end ? 'Day' : 'Night';

    let durCategory = 'long';
    if (record.duration_sec <= dur_short_max) durCategory = 'short';
    else if (record.duration_sec <= dur_medium_max) durCategory = 'medium';

    return {
      id: record.incident_id,
      panel_title: record.panel_title,
      application: record.application,
      node_name: record.node_name,
      network: record.network,
      object: record.object,
      operator: record.operator,
      time_fired: TimeUtils.utcToIL(record.time_fired),
      time_resolved: TimeUtils.utcToIL(record.time_resolved),
      duration_sec: record.duration_sec,
      duration_category: durCategory,
      shift,
      il_hour: ilHour,
      message: record.message,
      key_field: record.key_field,
      history_id: record.history_id,
    };
  }

  _calculateMedian(numbers) {
    if (!numbers || numbers.length === 0) return 0;
    const sorted = [...numbers].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  // ================== Computation Helpers ==================

  _computeOverviewStats(records, params) {
    const {
      day_start,
      day_end,
      dur_short_max,
      dur_medium_max,
    } = this._getThresholds(params);

    let total = 0;
    let sum = 0;
    let min = Infinity;
    let max = -Infinity;
    let shortAlerts = 0;
    let mediumAlerts = 0;
    let longAlerts = 0;
    let nightAlerts = 0;
    let dayAlerts = 0;

    for (const record of records) {
      total++;
      sum += record.duration_sec;
      min = Math.min(min, record.duration_sec);
      max = Math.max(max, record.duration_sec);

      if (record.duration_sec <= dur_short_max) shortAlerts++;
      else if (record.duration_sec <= dur_medium_max) mediumAlerts++;
      else longAlerts++;

      const hour = TimeUtils.getILHour(record.time_fired);

      let isDay;
      if (typeof TimeUtils.isDayHour === 'function') {
        isDay = TimeUtils.isDayHour(hour, day_start, day_end);
      } else {
        isDay = hour != null && hour >= day_start && hour < day_end;
      }

      if (isDay) {
        dayAlerts++;
      } else {
        nightAlerts++;
      }
    }

    const signalRatio = total ? +(((total - shortAlerts) * 100) / total).toFixed(1) : 0;

    return {
      total_alerts: total,
      avg_duration: total ? +(sum / total).toFixed(2) : 0,
      min_duration: total ? min : 0,
      max_duration: total ? max : 0,
      short_alerts: shortAlerts,
      medium_alerts: mediumAlerts,
      long_alerts: longAlerts,
      night_alerts: nightAlerts,
      day_alerts: dayAlerts,
      signal_to_noise_ratio: signalRatio,
      date_range: null, // filled in getOverviewStats
    };
  }

  _computeHourlyStats(records, params) {
    const { dur_short_max, dur_medium_max } = this._getThresholds(params);
    const buckets = Array.from({ length: 24 }, () => ({
      n: 0,
      sum: 0,
      immediate: 0,
      short: 0,
      long: 0,
    }));

    for (const record of records) {
      const hour = TimeUtils.getILHour(record.time_fired);
      if (hour !== null && hour >= 0 && hour < 24) {
        const bucket = buckets[hour];
        bucket.n++;
        bucket.sum += record.duration_sec;

        if (record.duration_sec <= dur_short_max) bucket.immediate++;
        else if (record.duration_sec <= dur_medium_max) bucket.short++;
        else bucket.long++;
      }
    }

    return buckets.map((bucket, hour) => ({
      hour,
      alert_count: bucket.n,
      avg_duration: bucket.n ? +(bucket.sum / bucket.n).toFixed(2) : 0,
      immediate_alerts: bucket.immediate,
      short_alerts: bucket.short,
      long_alerts: bucket.long,
    }));
  }

  _computeTimeseriesStats(records, params) {
    const { day_start, day_end } = this._getThresholds(params);
    const dayMap = new Map();

    for (const record of records) {
      const ilDate = TimeUtils.getILDate(record.time_fired);
      const hour = TimeUtils.getILHour(record.time_fired);

      if (!dayMap.has(ilDate)) {
        dayMap.set(ilDate, { count: 0, sum: 0, day: 0, night: 0 });
      }

      const stats = dayMap.get(ilDate);
      stats.count++;
      stats.sum += record.duration_sec;

      let isDay;
      if (typeof TimeUtils.isDayHour === 'function') {
        isDay = TimeUtils.isDayHour(hour, day_start, day_end);
      } else {
        isDay = hour != null && hour >= day_start && hour < day_end;
      }

      if (isDay) {
        stats.day++;
      } else {
        stats.night++;
      }
    }

    return Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, stats]) => ({
        date_il: date,
        alert_count: stats.count,
        avg_duration: stats.count ? +(stats.sum / stats.count).toFixed(2) : 0,
        day_count: stats.day,
        night_count: stats.night,
      }));
  }

  _computeShiftAnalysis(records, params) {
    const {
      day_start,
      day_end,
      false_wakeup_threshold,
    } = this._getThresholds(params);

    const buckets = {
      Day: {
        n: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        false_wakeups: 0,
        true_alerts: 0,
        panels: new Set(),
        ops: new Set(),
      },
      Night: {
        n: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        false_wakeups: 0,
        true_alerts: 0,
        panels: new Set(),
        ops: new Set(),
      },
    };

    for (const record of records) {
      const hour = TimeUtils.getILHour(record.time_fired);

      let isDay;
      if (typeof TimeUtils.isDayHour === 'function') {
        isDay = TimeUtils.isDayHour(hour, day_start, day_end);
      } else {
        isDay = hour != null && hour >= day_start && hour < day_end;
      }

      const shift = isDay ? 'Day' : 'Night';
      const bucket = buckets[shift];

      bucket.n++;
      bucket.sum += record.duration_sec;
      bucket.min = Math.min(bucket.min, record.duration_sec);
      bucket.max = Math.max(bucket.max, record.duration_sec);

      if (record.duration_sec <= false_wakeup_threshold) {
        bucket.false_wakeups++;
      } else {
        bucket.true_alerts++;
      }

      if (record.panel_title) bucket.panels.add(record.panel_title);
      if (record.operator) bucket.ops.add(record.operator);
    }

    return Object.entries(buckets).map(([shift, bucket]) => ({
      shift,
      alert_count: bucket.n,
      avg_duration: bucket.n ? +(bucket.sum / bucket.n).toFixed(2) : 0,
      min_duration: bucket.n ? bucket.min : 0,
      max_duration: bucket.n ? bucket.max : 0,
      false_wakeups: bucket.false_wakeups,
      true_alerts: bucket.true_alerts,
      unique_panels: bucket.panels.size,
      unique_operators: bucket.ops.size,
      false_wakeup_rate: bucket.n
        ? +((bucket.false_wakeups * 100) / bucket.n).toFixed(1)
        : 0,
    }));
  }

  _computeKPIs(records, params) {
    const {
      night_start,
      night_end,
      dur_short_max,
      false_wakeup_threshold,
    } = this._getThresholds(params);

    let total = 0;
    let noise = 0;
    let night = 0;
    let trueWakeups = 0;
    let falseWakeups = 0;
    let sumDuration = 0;

    for (const record of records) {
      total++;
      sumDuration += record.duration_sec;

      const ilHour = TimeUtils.getILHour(record.time_fired);
      let isNight;
      if (typeof TimeUtils.isNightHour === 'function') {
        isNight = TimeUtils.isNightHour(ilHour, night_start, night_end);
      } else {
        isNight = ilHour >= night_start || ilHour < night_end;
      }

      const isShort = record.duration_sec <= dur_short_max;
      const isFalsePositive = record.duration_sec <= false_wakeup_threshold;

      if (isShort) noise++;

      if (isNight) {
        night++;
        if (isFalsePositive) falseWakeups++;
        else trueWakeups++;
      }
    }

    const signalRatio = total > 0 ? +(((total - noise) * 100) / total).toFixed(1) : 0;
    const falseWakeRate =
      trueWakeups + falseWakeups > 0
        ? +((falseWakeups * 100) / (trueWakeups + falseWakeups)).toFixed(1)
        : 0;

    return {
      total_alerts: total,
      noise_alerts: noise,
      night_alerts: night,
      true_wakeups: trueWakeups,
      false_wakeups: falseWakeups,
      signal_ratio: signalRatio,
      false_wakeup_rate: falseWakeRate,
      avg_duration: total ? +(sumDuration / total).toFixed(2) : 0,
      median_duration: this._calculateMedian(records.map((r) => r.duration_sec)),
    };
  }

  _computeDurationHistogram(records, params) {
    const { dur_short_max, dur_medium_max } = this._getThresholds(params);
    let short = 0;
    let medium = 0;
    let long = 0;

    for (const record of records) {
      if (record.duration_sec <= dur_short_max) short++;
      else if (record.duration_sec <= dur_medium_max) medium++;
      else long++;
    }

    return [
      { range: '<=short', count: short },
      { range: 'short..medium', count: medium },
      { range: '>medium', count: long },
    ];
  }

  _computeHourlyHeatmap(records, params) {
    const { night_start, night_end } = this._getThresholds(params);
    const counts = Array.from({ length: 24 }, () => 0);

    for (const record of records) {
      const ilHour = TimeUtils.getILHour(record.time_fired);
      if (ilHour !== null && ilHour >= 0 && ilHour < 24) {
        counts[ilHour]++;
      }
    }

    return counts.map((count, hour) => {
      let isNight;
      if (typeof TimeUtils.isNightHour === 'function') {
        isNight = TimeUtils.isNightHour(hour, night_start, night_end);
      } else {
        isNight = hour >= night_start || hour < night_end;
      }

      return {
        hour,
        hour_display: `${String(hour).padStart(2, '0')}:00`,
        count,
        is_night: isNight,
      };
    });
  }

  _computePanelAnalysis(records, params) {
    const {
      day_start,
      day_end,
      dur_short_max,
      dur_medium_max,
      false_wakeup_threshold,
      night_start,
      night_end,
    } = this._getThresholds(params);

    if (!records || records.length === 0) {
      return {
        summary: {
          total_alerts: 0,
          avg_duration: 0,
          false_positive_count: 0,
          false_positive_rate: 0,
          night_alerts: 0,
          night_wakeups: 0,
          night_false_wakeups: 0,
          day_alerts: 0,
          alerts_per_day: 0,
          trend_direction: 'stable',
        },
        duration_distribution: [],
        daily_trend: [],
        hourly_heatmap: [],
        top_noisy_alerts: [],
        recommendations: [],
      };
    }

    let total = 0;
    let sumDuration = 0;
    let shortAlerts = 0;
    let mediumAlerts = 0;
    let longAlerts = 0;
    let falsePositives = 0;
    let nightAlerts = 0;
    let dayAlerts = 0;
    let nightWakeups = 0;
    let nightFalseWakeups = 0;

    const dailyCount = new Map();
    const hourlyCount = Array(24).fill(0);
    const durationBuckets = Array.from({ length: 24 }, () => ({ sum: 0, count: 0 }));
    const messageFrequency = new Map();

    for (const record of records) {
      total++;
      sumDuration += record.duration_sec;

      if (record.duration_sec <= dur_short_max) shortAlerts++;
      else if (record.duration_sec <= dur_medium_max) mediumAlerts++;
      else longAlerts++;

      if (record.duration_sec <= false_wakeup_threshold) {
        falsePositives++;
      }

      const hour = TimeUtils.getILHour(record.time_fired);
      const date = TimeUtils.getILDate(record.time_fired);

      let isNight;
      if (typeof TimeUtils.isNightHour === 'function') {
        isNight = TimeUtils.isNightHour(hour, night_start, night_end);
      } else {
        isNight = hour >= night_start || hour < night_end;
      }

      if (isNight) {
        nightAlerts++;
        if (record.duration_sec > false_wakeup_threshold) {
          nightWakeups++;
        } else {
          nightFalseWakeups++;
        }
      } else {
        dayAlerts++;
      }

      if (hour !== null && hour >= 0 && hour < 24) {
        hourlyCount[hour]++;
        durationBuckets[hour].sum += record.duration_sec;
        durationBuckets[hour].count++;
      }

      if (date) {
        dailyCount.set(date, (dailyCount.get(date) || 0) + 1);
      }

      if (record.message) {
        const current =
          messageFrequency.get(record.message) || { count: 0, durations: [] };
        current.count++;
        current.durations.push(record.duration_sec);
        messageFrequency.set(record.message, current);
      }
    }

    const dailyTrend = Array.from(dailyCount.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    const hourlyHeatmap = hourlyCount.map((count, hour) => {
      let isNight;
      if (typeof TimeUtils.isNightHour === 'function') {
        isNight = TimeUtils.isNightHour(hour, night_start, night_end);
      } else {
        isNight = hour >= night_start || hour < night_end;
      }

      return {
        hour,
        count,
        avg_duration: durationBuckets[hour].count
          ? +(durationBuckets[hour].sum / durationBuckets[hour].count).toFixed(2)
          : 0,
        is_night: isNight,
      };
    });

    const topNoisyAlerts = Array.from(messageFrequency.entries())
      .map(([message, data]) => ({
        message,
        count: data.count,
        avg_duration: +(
          data.durations.reduce((a, b) => a + b, 0) / data.durations.length
        ).toFixed(2),
        false_positive_rate: +(
          (data.durations.filter((d) => d <= false_wakeup_threshold).length * 100) /
          data.count
        ).toFixed(1),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const durationDistribution = [
      { category: 'Short', range: `≤${dur_short_max}s`, count: shortAlerts },
      {
        category: 'Medium',
        range: `${dur_short_max + 1}-${dur_medium_max}s`,
        count: mediumAlerts,
      },
      { category: 'Long', range: `>${dur_medium_max}s`, count: longAlerts },
    ];

    const daysInRange = dailyTrend.length || 1;
    const alertsPerDay = +(total / daysInRange).toFixed(2);

    let trendDirection = 'stable';
    if (dailyTrend.length >= 4) {
      const midpoint = Math.floor(dailyTrend.length / 2);
      const firstHalf = dailyTrend.slice(0, midpoint);
      const secondHalf = dailyTrend.slice(midpoint);
      const firstAvg =
        firstHalf.reduce((sum, d) => sum + d.count, 0) / firstHalf.length;
      const secondAvg =
        secondHalf.reduce((sum, d) => sum + d.count, 0) / secondHalf.length;
      const change = ((secondAvg - firstAvg) / firstAvg) * 100;

      if (change > 15) trendDirection = 'increasing';
      else if (change < -15) trendDirection = 'decreasing';
    }

    const summary = {
      total_alerts: total,
      avg_duration: total ? +(sumDuration / total).toFixed(2) : 0,
      false_positive_count: falsePositives,
      false_positive_rate: total
        ? +((falsePositives * 100) / total).toFixed(1)
        : 0,
      night_alerts: nightAlerts,
      night_wakeups: nightWakeups,
      night_false_wakeups: nightFalseWakeups,
      day_alerts: dayAlerts,
      alerts_per_day: alertsPerDay,
      trend_direction: trendDirection,
    };

    const recommendations = this._generateRecommendations(
      {
        total,
        falsePositives,
        nightWakeups,
        nightFalseWakeups,
        shortAlerts,
        alertsPerDay,
        trendDirection,
        topNoisyAlerts,
        hourlyHeatmap,
      },
      params
    );

    return {
      summary,
      duration_distribution: durationDistribution,
      daily_trend: dailyTrend,
      hourly_heatmap: hourlyHeatmap,
      top_noisy_alerts: topNoisyAlerts,
      recommendations,
    };
  }

  _generateRecommendations(metrics, params) {
    const recommendations = [];
    const {
      total,
      falsePositives,
      nightWakeups,
      nightFalseWakeups,
      alertsPerDay,
      trendDirection,
      topNoisyAlerts,
      hourlyHeatmap,
    } = metrics;

    const { false_wakeup_threshold } = this._getThresholds(params);
    const falsePositiveRate = total ? (falsePositives * 100) / total : 0;

    if (falsePositiveRate > 60) {
      recommendations.push({
        severity: 'high',
        category: 'threshold',
        message: `${falsePositiveRate.toFixed(
          1
        )}% of alerts are false positives (<${false_wakeup_threshold}s)`,
        action:
          'Increase alert thresholds and/or implement correlation rules for noisy alerts',
        impact: 'High team disruption with low-value alerts',
      });
    } else if (falsePositiveRate > 40) {
      recommendations.push({
        severity: 'medium',
        category: 'threshold',
        message: `${falsePositiveRate.toFixed(1)}% false positive rate detected`,
        action: 'Review alert thresholds for top noisy sources',
        impact: 'Moderate noise affecting team efficiency',
      });
    }

    if (nightFalseWakeups > 20) {
      recommendations.push({
        severity: 'high',
        category: 'night-operations',
        message: `${nightFalseWakeups} false night wakeups detected`,
        action:
          'Implement night-specific thresholds or suppress non-critical alerts at night',
        impact: 'Team fatigue and reduced on-call effectiveness',
      });
    }

    if (nightWakeups > 50) {
      recommendations.push({
        severity: 'medium',
        category: 'night-operations',
        message: `${nightWakeups} legitimate night wakeups (high frequency)`,
        action:
          'Investigate automation and SRE practices to reduce night incidents',
        impact: 'Unsustainable on-call load',
      });
    }

    if (trendDirection === 'increasing') {
      recommendations.push({
        severity: 'medium',
        category: 'trend',
        message: 'Alert volume is trending upward',
        action:
          'Investigate root causes – possible system degradation or monitoring misconfiguration',
        impact: 'Increasing operational burden',
      });
    }

    if (alertsPerDay > 50) {
      recommendations.push({
        severity: 'high',
        category: 'velocity',
        message: `${alertsPerDay.toFixed(1)} alerts per day (high volume)`,
        action:
          'Review alert definitions and implement aggregation where possible',
        impact: 'Alert fatigue and potential for missed critical issues',
      });
    }

    if (
      topNoisyAlerts.length > 0 &&
      topNoisyAlerts[0].count > total * 0.25
    ) {
      recommendations.push({
        severity: 'high',
        category: 'noise-concentration',
        message: `Single alert type "${topNoisyAlerts[0].message}" accounts for ${(
          (topNoisyAlerts[0].count * 100) /
          total
        ).toFixed(1)}% of all alerts`,
      action:
          'Prioritize fixing or tuning this specific alert (thresholds/correlation)',
        impact: 'Extreme noise from a single source',
      });
    }

    const nightHours = hourlyHeatmap.filter((h) => h.is_night);
    const nightTotal = nightHours.reduce((sum, h) => sum + h.count, 0);
    const peakNightHour =
      nightHours.length > 0
        ? nightHours.reduce((max, h) => (h.count > max.count ? h : max), nightHours[0])
        : null;

    if (peakNightHour && nightTotal > 0 && peakNightHour.count > nightTotal * 0.4) {
      recommendations.push({
        severity: 'medium',
        category: 'time-pattern',
        message: `Peak night activity at ${peakNightHour.hour}:00 (${peakNightHour.count} alerts)`,
        action:
          'Investigate scheduled jobs, backups, or batch processes around this hour',
        impact: 'Predictable disruption pattern',
      });
    }

    if (falsePositiveRate < 20 && nightWakeups < 20) {
      recommendations.push({
        severity: 'low',
        category: 'health',
        message:
          'Panel health looks good – low false positive rate and minimal night disruption',
        action: 'Maintain current monitoring practices and periodically review',
        impact: 'Well-tuned alerting',
      });
    }

    return recommendations;
  }
}

module.exports = AlertService;
