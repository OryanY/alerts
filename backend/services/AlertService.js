// services/AlertService.js - Centralized business logic
const sql = require('mssql');
const { getSqlPool } = require('../database/connection');
const { QueryBuilder } = require('../utils/QueryBuilder');
const { TimeUtils } = require('../utils/TimeUtils');
const { ResponseFormatter } = require('../utils/ResponseFormatter');

class AlertService {
  constructor() {
    this.pool = null;

    // Global defaults (Frozen to prevent mutation)
    this.CONSTANTS = Object.freeze({
      DEFAULT_CAP: 100000,
      DAY_START: 8,
      DAY_END: 22,
      NIGHT_START: 22,
      NIGHT_END: 8,
      DUR_SHORT_MAX: 30, // ≤30s
      DUR_MEDIUM_MAX: 300, // 31–300s
      FALSE_WAKEUP_THRESHOLD: 120 // ≤120s
    });
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
      Bit: sql.Bit
    };
    return typeMap[type] || sql.NVarChar;
  }

  /**
   * Normalizes thresholds and time-window parameters.
   */
  _getThresholds(params = {}) {
    return {
      day_start: params.day_start ?? this.CONSTANTS.DAY_START,
      day_end: params.day_end ?? this.CONSTANTS.DAY_END,
      night_start: params.night_start ?? this.CONSTANTS.NIGHT_START,
      night_end: params.night_end ?? this.CONSTANTS.NIGHT_END,
      dur_short_max: params.dur_short_max ?? this.CONSTANTS.DUR_SHORT_MAX,
      dur_medium_max: params.dur_medium_max ?? this.CONSTANTS.DUR_MEDIUM_MAX,
      false_wakeup_threshold: params.false_wakeup_threshold ?? this.CONSTANTS.FALSE_WAKEUP_THRESHOLD,
    };
  }

  /**
   * Unified Query Construction Helper.
   * Handles Date Ranges, Panel Titles, and standard fields to reduce code duplication.
   */
  _buildQueryContext(request, params, options = {}) {
    const { requirePanelTitle = false, extraFields = [] } = options;
    const where = [];

    // 1. Date Range
    const range = TimeUtils.validateDateRange(params.start_date, params.end_date);
    if (range?.start) {
      request.input('start_date_param', sql.DateTime2, range.start);
      where.push('time_fired >= @start_date_param');
    }
    if (range?.end) {
      request.input('end_date_param', sql.DateTime2, range.end);
      where.push('time_fired <= @end_date_param');
    }

    // 2. Panel Title (Single)
    if (params.panel_title) {
      request.input('panel_title_param', sql.NVarChar, params.panel_title);
      where.push('panel_title = @panel_title_param');
    } else if (requirePanelTitle) {
      throw new Error('panel_title is required for this operation');
    }

    // 3. Array-based Panel Titles
    if (params.panel_titles && Array.isArray(params.panel_titles) && params.panel_titles.length > 0) {
      const placeholders = params.panel_titles.map((title, i) => {
        const pName = `pt_arr_${i}`;
        request.input(pName, sql.NVarChar, title);
        return `@${pName}`;
      });
      where.push(`panel_title IN (${placeholders.join(',')})`);
    }

    // 4. Standard Field Filters (Prefix LIKE)
    ['application', 'node_name', 'network', 'object', 'operator'].forEach(field => {
      if (params[field]) {
        request.input(`${field}_param`, sql.NVarChar, `${params[field]}%`);
        where.push(`${field} LIKE @${field}_param`);
      }
    });

    // 5. Duration Filters
    if (params.min_duration !== undefined) {
      request.input('min_dur_param', sql.Int, params.min_duration);
      where.push('duration_sec >= @min_dur_param');
    }
    if (params.max_duration !== undefined) {
      request.input('max_dur_param', sql.Int, params.max_duration);
      where.push('duration_sec <= @max_dur_param');
    }

    return {
      whereClause: where.length ? `WHERE ${where.join(' AND ')}` : '',
      cap: Math.min(params.limit || this.CONSTANTS.DEFAULT_CAP, this.CONSTANTS.DEFAULT_CAP)
    };
  }

  // ================== Public API ==================

  async getAlerts(params) {
    const pool = this.getPool();
    const request = pool.request();

    // Build unified WHERE clause + limit cap using the shared helper
    const { whereClause, cap } = this._buildQueryContext(request, params);

    // Sorting
    const sortBy = params.sort_by || 'time_fired';
    const sortOrder = params.sort_order === 'ASC' ? 'ASC' : 'DESC';

    // Pagination (supports page+limit or just limit)
    let offsetSql = '';
    let limitSql  = '';

    if (params.page && params.limit) {
      const offset = (params.page - 1) * params.limit;

      request.input('offset_param', sql.Int, offset);
      request.input('limit_param', sql.Int, params.limit + 1); // +1 for next-page detection

      offsetSql = 'OFFSET @offset_param ROWS';
      limitSql  = 'FETCH NEXT @limit_param ROWS ONLY';

    } else {
      request.input('limit_param', sql.Int, params.limit || cap);
      limitSql = 'TOP (@limit_param)';
    }

    // Build final SQL
    const sqlText = `
      SELECT ${!offsetSql ? 'TOP (@limit_param)' : ''} 
        incident_id, panel_title, application, node_name, network, object,
        operator, time_fired, time_resolved, duration_sec, message, key_field, history_id
      FROM dbo.historicalAlerts
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      ${offsetSql}
      ${offsetSql ? limitSql : ''}
    `;

    // Run the query
    const result = await request.query(sqlText);
    let records = result.recordset;
    let pagination = null;

    // Pagination logic (server-side)
    if (params.page && params.limit) {
      const hasNext = records.length > params.limit;
      if (hasNext) records = records.slice(0, -1);

      pagination = {
        page: params.page,
        limit: params.limit,
        hasNext,
        hasPrev: params.page > 1
      };
    }

    // Transform data
    const transformed = records.map(r => this._transformAlertRecord(r, params));
    return ResponseFormatter.success(transformed, pagination);
  }

  /**
   * Executive KPIs – minimal data: time_fired, duration_sec
   */
  async getExecutiveKPIs(params) {
    const records = await this._fetchBasicRecords(params);
    const kpis = this._computeKPIs(records, params);
    return ResponseFormatter.success(kpis);
  }

  /**
   * Duration histogram (short/medium/long)
   */
  async getDurationHistogram(params) {
    const records = await this._fetchBasicRecords(params, 'duration_sec');
    const histogram = this._computeDurationHistogram(records, params);
    return ResponseFormatter.success(histogram);
  }

  /**
   * Hourly heatmap (24 buckets)
   */
  async getHourlyHeatmap(params) {
    const records = await this._fetchBasicRecords(params, 'time_fired');
    const heatmap = this._computeHourlyHeatmap(records, params);
    return ResponseFormatter.success(heatmap);
  }

  /**
   * Shift analysis (Day/Night buckets)
   */
  async getShiftAnalysis(params) {
    const records = await this._fetchBasicRecords(params, 'time_fired, duration_sec, panel_title, operator');
    const analysis = this._computeShiftAnalysis(records, params);
    return ResponseFormatter.success(analysis);
  }

  /**
   * Overview stats (global)
   */
  async getOverviewStats(params) {
    const records = await this._fetchBasicRecords(params, 'time_fired, duration_sec');
    const stats = this._computeOverviewStats(records, params);
    
    // Explicitly echo back the resolved date range
    stats.date_range = (params.start_date && params.end_date)
        ? { start: params.start_date, end: params.end_date }
        : null;

    return ResponseFormatter.success(stats);
  }

  /**
   * Hourly stats with duration breakdown per hour
   */
  async getHourlyStats(params) {
    const records = await this._fetchBasicRecords(params, 'time_fired, duration_sec');
    const hourlyStats = this._computeHourlyStats(records, params);
    return ResponseFormatter.success(hourlyStats);
  }

  /**
   * Timeseries stats by day (alert_count, avg_duration, day/night split)
   */
  async getTimeseriesStats(params) {
    const records = await this._fetchBasicRecords(params, 'time_fired, duration_sec');
    const timeseries = this._computeTimeseriesStats(records, params);
    return ResponseFormatter.success(timeseries);
  }

  // ================== NEW FEATURE: TOP NOISY NODES ==================

  /**
   * Top alerting node_name/object_name combinations by count.
   */
async getTopNoisyNodes(params) {
    const pool = this.getPool();
    const request = pool.request();
    // Default to 10, max 50
    const limit = Math.min(params.limit || 10, 50); 

    request.input('limit_param', this._getSqlType('Int'), limit);
    
    // _buildQueryContext populates the request with @start and @end parameters 
    // and returns a WHERE clause (which includes the panel_title filter if provided).
    const { whereClause } = this._buildQueryContext(request, params);
    
    // Remove "WHERE " prefix if it exists in whereClause for use in CTE
    const whereCondition = whereClause.startsWith('WHERE ') ? whereClause.substring(6) : whereClause;
    const whereSql = whereCondition.length ? `WHERE ${whereCondition}` : '';

    const sqlText = `
        -- 1. Calculate the total alerts for the period (for percentage calculation)
        WITH TotalAlerts AS (
            SELECT COUNT(*) AS total_count
            FROM dbo.historicalAlerts
            ${whereSql}
        )
        -- 2. Group by node_name and object to find the noisy pairs
        SELECT TOP (@limit_param)
            T1.node_name,
            T1.object,
            COUNT(*) AS alert_count,
            ROUND(AVG(CAST(T1.duration_sec AS FLOAT)), 2) AS avg_duration_sec,
            CAST(
                (COUNT(*) * 100.0) / (SELECT ISNULL(total_count, 1) FROM TotalAlerts) 
                AS DECIMAL(5, 2)
            ) AS alert_percent
        FROM dbo.historicalAlerts T1
        ${whereSql}
        GROUP BY T1.node_name, T1.object
        HAVING T1.node_name IS NOT NULL AND T1.object IS NOT NULL -- Ensure we have identification
        ORDER BY alert_count DESC;
    `;

    const result = await request.query(sqlText);

    // Apply minimum percentage filter if provided in JS (post-query)
    let records = result.recordset;
    if (params.min_percent) {
        const minPercent = parseFloat(params.min_percent);
        if (!isNaN(minPercent)) {
            records = records.filter(r => r.alert_percent >= minPercent);
        }
    }
    
    return ResponseFormatter.success(records);
}
  /**
   * Per-panel aggregate stats (alert count, avg duration, etc.)
   */
  async getPanelList(params) {
    const pool = this.getPool();
    const request = pool.request();
    const { whereClause } = this._buildQueryContext(request, params);
    const { false_wakeup_threshold } = this._getThresholds(params);

    request.input('false_wakeup_threshold', sql.Int, false_wakeup_threshold);

    const sqlText = `
      SELECT 
        panel_title,
        COUNT(*) AS alert_count,
        COUNT(CASE WHEN duration_sec <= @false_wakeup_threshold THEN 1 END) AS false_positive_count,
        ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration,
        COUNT(DISTINCT application) AS application_count
      FROM dbo.historicalAlerts
      ${whereClause}
      GROUP BY panel_title
      ORDER BY alert_count DESC
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
    const { whereClause } = this._buildQueryContext(request, params);
    const { dur_short_max, dur_medium_max } = this._getThresholds(params);

    request.input('dur_short_max', sql.Int, dur_short_max);
    request.input('dur_medium_max', sql.Int, dur_medium_max);

    let topClause = '';
    if (params.limit) {
        request.input('limit_param', sql.Int, params.limit);
        topClause = 'TOP (@limit_param)';
    }

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
      console.error('Database query failed in getPanelStats:', err);
      return ResponseFormatter.error('Database query failed', err);
    }
  }

  /**
   * Detailed panel analysis – single panel, rich metrics
   */
  async getPanelAnalysis(params) {
    // Force specific fields needed for deep analysis
    const fields = 'incident_id, panel_title, application, time_fired, time_resolved, duration_sec, operator, message';
    const records = await this._fetchBasicRecords({ ...params }, fields, { requirePanelTitle: true });
    
    const analysis = this._computePanelAnalysis(records, params);
    return ResponseFormatter.success(analysis);
  }

  /**
   * Alert message breakdown per panel
   */
  async getAlertMessageBreakdown(params) {
    if (!params.panel_title) throw new Error('panel_title is required');

    const pool = this.getPool();
    const request = pool.request();
    const { whereClause } = this._buildQueryContext(request, params);
    const { false_wakeup_threshold } = this._getThresholds(params);

    request.input('false_wakeup_threshold', sql.Int, false_wakeup_threshold);

    const sqlText = `
      SELECT 
        message,
        COUNT(*) AS occurrence_count,
        ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration,
        MIN(duration_sec) AS min_duration,
        MAX(duration_sec) AS max_duration,
        COUNT(CASE WHEN duration_sec <= @false_wakeup_threshold THEN 1 END) AS false_positive_count
      FROM dbo.historicalAlerts
      ${whereClause}
      GROUP BY message
      ORDER BY occurrence_count DESC
    `;

    const result = await request.query(sqlText);
    return ResponseFormatter.success(result.recordset);
  }

  // ================== Internal Helpers ==================

  /**
   * Optimized generic fetcher to reduce repeated SQL string construction
   */
  async _fetchBasicRecords(params, fields = 'time_fired, duration_sec', options = {}) {
    const pool = this.getPool();
    const request = pool.request();
    const { whereClause, cap } = this._buildQueryContext(request, params, options);

    request.input('cap_param', sql.Int, cap);

    const sqlText = `
      SELECT TOP (@cap_param) ${fields}
      FROM dbo.historicalAlerts
      ${whereClause}
      ORDER BY time_fired DESC
    `;

    const result = await request.query(sqlText);
    return result.recordset;
  }

  _transformAlertRecord(record, config = {}) {
    const { day_start, day_end, dur_short_max, dur_medium_max } = this._getThresholds(config);
    const ilHour = TimeUtils.getILHour(record.time_fired);
    const isDay = ilHour !== null && ilHour >= day_start && ilHour < day_end;

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
      shift: isDay ? 'Day' : 'Night',
      il_hour: ilHour,
      message: record.message,
      key_field: record.key_field,
      history_id: record.history_id,
    };
  }

  _isDayHour(hour, start, end) {
    if (typeof TimeUtils.isDayHour === 'function') {
      return TimeUtils.isDayHour(hour, start, end);
    }
    return hour != null && hour >= start && hour < end;
  }

  _isNightHour(hour, start, end) {
    if (typeof TimeUtils.isNightHour === 'function') {
      return TimeUtils.isNightHour(hour, start, end);
    }
    return hour >= start || hour < end;
  }

  _calculateMedian(numbers) {
    if (!numbers || numbers.length === 0) return 0;
    // Use Float64Array for memory efficiency if list is massive, but standard sort is fine for TOP 100k
    numbers.sort((a, b) => a - b);
    const mid = Math.floor(numbers.length / 2);
    return numbers.length % 2 === 0
      ? (numbers[mid - 1] + numbers[mid]) / 2
      : numbers[mid];
  }

  // ================== Computations (Optimization Focus) ==================

  _computeOverviewStats(records, params) {
    const { day_start, day_end, dur_short_max, dur_medium_max } = this._getThresholds(params);

    const stats = {
      total: 0, sum: 0, min: Infinity, max: -Infinity,
      short: 0, medium: 0, long: 0,
      night: 0, day: 0
    };

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const dur = r.duration_sec;
      
      stats.total++;
      stats.sum += dur;
      if (dur < stats.min) stats.min = dur;
      if (dur > stats.max) stats.max = dur;

      if (dur <= dur_short_max) stats.short++;
      else if (dur <= dur_medium_max) stats.medium++;
      else stats.long++;

      const hour = TimeUtils.getILHour(r.time_fired);
      if (this._isDayHour(hour, day_start, day_end)) stats.day++;
      else stats.night++;
    }

    // Safety reset if empty
    if (stats.min === Infinity) stats.min = 0;
    if (stats.max === -Infinity) stats.max = 0;

    return {
      total_alerts: stats.total,
      avg_duration: stats.total ? +(stats.sum / stats.total).toFixed(2) : 0,
      min_duration: stats.min,
      max_duration: stats.max,
      short_alerts: stats.short,
      medium_alerts: stats.medium,
      long_alerts: stats.long,
      night_alerts: stats.night,
      day_alerts: stats.day,
      signal_to_noise_ratio: stats.total ? +(((stats.total - stats.short) * 100) / stats.total).toFixed(1) : 0,
      date_range: null // Set by caller
    };
  }

  _computeHourlyStats(records, params) {
    const { dur_short_max, dur_medium_max } = this._getThresholds(params);
    // Pre-allocate array for 24 hours
    const buckets = new Array(24).fill(null).map((_, i) => ({
      hour: i, n: 0, sum: 0, immediate: 0, short: 0, long: 0
    }));

    for (const record of records) {
      const hour = TimeUtils.getILHour(record.time_fired);
      if (hour !== null && hour >= 0 && hour < 24) {
        const b = buckets[hour];
        b.n++;
        b.sum += record.duration_sec;
        if (record.duration_sec <= dur_short_max) b.immediate++;
        else if (record.duration_sec <= dur_medium_max) b.short++;
        else b.long++;
      }
    }

    return buckets.map(b => ({
      hour: b.hour,
      alert_count: b.n,
      avg_duration: b.n ? +(b.sum / b.n).toFixed(2) : 0,
      immediate_alerts: b.immediate,
      short_alerts: b.short,
      long_alerts: b.long,
    }));
  }

  _computeTimeseriesStats(records, params) {
    const { day_start, day_end } = this._getThresholds(params);
    const dayMap = new Map();

    for (const record of records) {
      const ilDate = TimeUtils.getILDate(record.time_fired);
      if (!ilDate) continue;

      let stats = dayMap.get(ilDate);
      if (!stats) {
        stats = { count: 0, sum: 0, day: 0, night: 0 };
        dayMap.set(ilDate, stats);
      }

      stats.count++;
      stats.sum += record.duration_sec;

      const hour = TimeUtils.getILHour(record.time_fired);
      if (this._isDayHour(hour, day_start, day_end)) stats.day++;
      else stats.night++;
    }

    return Array.from(dayMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, s]) => ({
        date_il: date,
        alert_count: s.count,
        avg_duration: s.count ? +(s.sum / s.count).toFixed(2) : 0,
        day_count: s.day,
        night_count: s.night,
      }));
  }

  _computeShiftAnalysis(records, params) {
    const { day_start, day_end, false_wakeup_threshold } = this._getThresholds(params);
    
    const factory = () => ({
      n: 0, sum: 0, min: Infinity, max: -Infinity, 
      false_wakeups: 0, true_alerts: 0,
      panels: new Set(), ops: new Set()
    });

    const buckets = { Day: factory(), Night: factory() };

    for (const record of records) {
      const hour = TimeUtils.getILHour(record.time_fired);
      const isDay = this._isDayHour(hour, day_start, day_end);
      const bucket = buckets[isDay ? 'Day' : 'Night'];

      bucket.n++;
      bucket.sum += record.duration_sec;
      if (record.duration_sec < bucket.min) bucket.min = record.duration_sec;
      if (record.duration_sec > bucket.max) bucket.max = record.duration_sec;

      if (record.duration_sec <= false_wakeup_threshold) bucket.false_wakeups++;
      else bucket.true_alerts++;

      if (record.panel_title) bucket.panels.add(record.panel_title);
      if (record.operator) bucket.ops.add(record.operator);
    }

    return Object.entries(buckets).map(([shift, b]) => {
      const n = b.n;
      return {
        shift,
        alert_count: n,
        avg_duration: n ? +(b.sum / n).toFixed(2) : 0,
        min_duration: n ? b.min : 0,
        max_duration: n ? b.max : 0,
        false_wakeups: b.false_wakeups,
        true_alerts: b.true_alerts,
        unique_panels: b.panels.size,
        unique_operators: b.ops.size,
        false_wakeup_rate: n ? +((b.false_wakeups * 100) / n).toFixed(1) : 0,
      };
    });
  }

  _computeKPIs(records, params) {
    const { night_start, night_end, dur_short_max, false_wakeup_threshold } = this._getThresholds(params);
    
    let total = 0, noise = 0, night = 0, trueWake = 0, falseWake = 0, sumDur = 0;
    const durations = [];

    for (const r of records) {
      total++;
      sumDur += r.duration_sec;
      durations.push(r.duration_sec);

      const hour = TimeUtils.getILHour(r.time_fired);
      const isNight = this._isNightHour(hour, night_start, night_end);

      if (r.duration_sec <= dur_short_max) noise++;

      if (isNight) {
        night++;
        if (r.duration_sec <= false_wakeup_threshold) falseWake++;
        else trueWake++;
      }
    }

    return {
      total_alerts: total,
      noise_alerts: noise,
      night_alerts: night,
      true_wakeups: trueWake,
      false_wakeups: falseWake,
      signal_ratio: total ? +(((total - noise) * 100) / total).toFixed(1) : 0,
      false_wakeup_rate: (trueWake + falseWake) ? +((falseWake * 100) / (trueWake + falseWake)).toFixed(1) : 0,
      avg_duration: total ? +(sumDur / total).toFixed(2) : 0,
      median_duration: this._calculateMedian(durations),
    };
  }

  _computeDurationHistogram(records, params) {
    const { dur_short_max, dur_medium_max } = this._getThresholds(params);
    const counts = { short: 0, medium: 0, long: 0 };

    for (const r of records) {
      if (r.duration_sec <= dur_short_max) counts.short++;
      else if (r.duration_sec <= dur_medium_max) counts.medium++;
      else counts.long++;
    }

    return [
      { range: '<=short', count: counts.short },
      { range: 'short..medium', count: counts.medium },
      { range: '>medium', count: counts.long },
    ];
  }

  _computeHourlyHeatmap(records, params) {
    const { night_start, night_end } = this._getThresholds(params);
    const counts = new Uint32Array(24); // Optimization for integer counting

    for (const r of records) {
      const h = TimeUtils.getILHour(r.time_fired);
      if (h !== null && h >= 0 && h < 24) counts[h]++;
    }

    return Array.from(counts).map((count, hour) => ({
      hour,
      hour_display: `${String(hour).padStart(2, '0')}:00`,
      count,
      is_night: this._isNightHour(hour, night_start, night_end),
    }));
  }

  _computePanelAnalysis(records, params) {
    const thresholds = this._getThresholds(params);
    const { dur_short_max, dur_medium_max, false_wakeup_threshold, night_start, night_end } = thresholds;

    // Use a single pass object to collect all metrics
    const agg = {
      total: 0, sum: 0, short: 0, medium: 0, long: 0,
      falsePos: 0, nightAlerts: 0, nightWake: 0, nightFalseWake: 0, dayAlerts: 0,
      hourly: new Array(24).fill(0).map(() => ({ count: 0, sum: 0 })),
      daily: new Map(),
      messages: new Map() // { count, durSum, min, max, falsePos }
    };

    if (!records || records.length === 0) return this._emptyPanelAnalysis();

    for (const r of records) {
      agg.total++;
      agg.sum += r.duration_sec;

      // Duration Buckets
      if (r.duration_sec <= dur_short_max) agg.short++;
      else if (r.duration_sec <= dur_medium_max) agg.medium++;
      else agg.long++;

      // False Positive
      if (r.duration_sec <= false_wakeup_threshold) agg.falsePos++;

      // Shift Analysis
      const hour = TimeUtils.getILHour(r.time_fired);
      const isNight = this._isNightHour(hour, night_start, night_end);

      if (isNight) {
        agg.nightAlerts++;
        if (r.duration_sec > false_wakeup_threshold) agg.nightWake++;
        else agg.nightFalseWake++;
      } else {
        agg.dayAlerts++;
      }

      // Hourly Heatmap Data
      if (hour !== null && hour >= 0 && hour < 24) {
        agg.hourly[hour].count++;
        agg.hourly[hour].sum += r.duration_sec;
      }

      // Daily Trend Data
      const date = TimeUtils.getILDate(r.time_fired);
      if (date) agg.daily.set(date, (agg.daily.get(date) || 0) + 1);

      // Message Breakdown
      if (r.message) {
        let mStats = agg.messages.get(r.message);
        if (!mStats) {
          mStats = { count: 0, sum: 0, falsePos: 0 };
          agg.messages.set(r.message, mStats);
        }
        mStats.count++;
        mStats.sum += r.duration_sec;
        if (r.duration_sec <= false_wakeup_threshold) mStats.falsePos++;
      }
    }

    // --- Format Results ---

    // 1. Daily Trend & Direction
    const dailyTrend = Array.from(agg.daily.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
    
    let trendDirection = 'stable';
    if (dailyTrend.length >= 4) {
        const mid = Math.floor(dailyTrend.length / 2);
        const first = dailyTrend.slice(0, mid);
        const second = dailyTrend.slice(mid);
        const avg1 = first.reduce((a, b) => a + b.count, 0) / first.length;
        const avg2 = second.reduce((a, b) => a + b.count, 0) / second.length;
        const change = avg1 ? ((avg2 - avg1) / avg1) * 100 : 0;
        if (change > 15) trendDirection = 'increasing';
        else if (change < -15) trendDirection = 'decreasing';
    }

    // 2. Hourly Heatmap
    const hourlyHeatmap = agg.hourly.map((h, i) => ({
      hour: i,
      count: h.count,
      avg_duration: h.count ? +(h.sum / h.count).toFixed(2) : 0,
      is_night: this._isNightHour(i, night_start, night_end)
    }));

    // 3. Top Noisy Alerts
    const topNoisyAlerts = Array.from(agg.messages.entries())
      .map(([msg, s]) => ({
        message: msg,
        count: s.count,
        avg_duration: +(s.sum / s.count).toFixed(2),
        false_positive_rate: +((s.falsePos * 100) / s.count).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const daysInRange = dailyTrend.length || 1;
    const summary = {
      total_alerts: agg.total,
      avg_duration: agg.total ? +(agg.sum / agg.total).toFixed(2) : 0,
      false_positive_count: agg.falsePos,
      false_positive_rate: agg.total ? +((agg.falsePos * 100) / agg.total).toFixed(1) : 0,
      night_alerts: agg.nightAlerts,
      night_wakeups: agg.nightWake,
      night_false_wakeups: agg.nightFalseWake,
      day_alerts: agg.dayAlerts,
      alerts_per_day: +(agg.total / daysInRange).toFixed(2),
      trend_direction: trendDirection
    };

    const recommendations = this._generateRecommendations({
      ...summary, 
      topNoisyAlerts,
      hourlyHeatmap,
      falsePositives: agg.falsePos,
      shortAlerts: agg.short,
      alertsPerDay: summary.alerts_per_day,
      trendDirection: summary.trend_direction,
      nightWakeups: agg.nightWake,
      nightFalseWakeups: agg.nightFalseWake,
      total: agg.total // ensure total is passed explicitly
    }, params);

    return {
      summary,
      duration_distribution: [
        { category: 'Short', range: `≤${dur_short_max}s`, count: agg.short },
        { category: 'Medium', range: `${dur_short_max + 1}-${dur_medium_max}s`, count: agg.medium },
        { category: 'Long', range: `>${dur_medium_max}s`, count: agg.long },
      ],
      daily_trend: dailyTrend,
      hourly_heatmap: hourlyHeatmap,
      top_noisy_alerts: topNoisyAlerts,
      recommendations,
    };
  }

  _emptyPanelAnalysis() {
    return {
      summary: {
        total_alerts: 0, avg_duration: 0, false_positive_count: 0, false_positive_rate: 0,
        night_alerts: 0, night_wakeups: 0, night_false_wakeups: 0, day_alerts: 0,
        alerts_per_day: 0, trend_direction: 'stable'
      },
      duration_distribution: [], daily_trend: [], hourly_heatmap: [],
      top_noisy_alerts: [], recommendations: []
    };
  }

  _generateRecommendations(metrics, params) {
    const { false_wakeup_threshold } = this._getThresholds(params);
    const { 
      total, falsePositives, nightWakeups, nightFalseWakeups, 
      alertsPerDay, trendDirection, topNoisyAlerts, hourlyHeatmap 
    } = metrics;
    
    if (!total) return [];

    const recommendations = [];
    const falsePositiveRate = (falsePositives * 100) / total;

    // 1. Noise / False Positive Logic
    if (falsePositiveRate > 60) {
      recommendations.push({
        severity: 'high', category: 'threshold',
        message: `${falsePositiveRate.toFixed(1)}% of alerts are false positives (<${false_wakeup_threshold}s)`,
        action: 'Increase alert thresholds and/or implement correlation rules',
        impact: 'High team disruption with low-value alerts'
      });
    } else if (falsePositiveRate > 40) {
      recommendations.push({
        severity: 'medium', category: 'threshold',
        message: `${falsePositiveRate.toFixed(1)}% false positive rate`,
        action: 'Review alert thresholds for top noisy sources',
        impact: 'Moderate noise affecting team efficiency'
      });
    }

    // 2. Night Operations
    if (nightFalseWakeups > 20) {
      recommendations.push({
        severity: 'high', category: 'night-operations',
        message: `${nightFalseWakeups} false night wakeups detected`,
        action: 'Implement night-specific thresholds or suppress non-critical alerts',
        impact: 'Team fatigue and reduced on-call effectiveness'
      });
    }
    if (nightWakeups > 50) {
      recommendations.push({
        severity: 'medium', category: 'night-operations',
        message: `${nightWakeups} legitimate night wakeups (high frequency)`,
        action: 'Investigate automation to reduce night incidents',
        impact: 'High on-call load'
      });
    }

    // 3. Trends & Volume
    if (trendDirection === 'increasing') {
      recommendations.push({
        severity: 'medium', category: 'trend',
        message: 'Alert volume is trending upward',
        action: 'Investigate possible system degradation',
        impact: 'Increasing operational burden'
      });
    }
    if (alertsPerDay > 50) {
      recommendations.push({
        severity: 'high', category: 'velocity',
        message: `${alertsPerDay} alerts per day`,
        action: 'Review alert definitions and aggregation rules',
        impact: 'Alert fatigue'
      });
    }

    // 4. Specific Noisy Alerts
    if (topNoisyAlerts.length > 0 && topNoisyAlerts[0].count > total * 0.25) {
      const topPct = ((topNoisyAlerts[0].count * 100) / total).toFixed(1);
      recommendations.push({
        severity: 'high', category: 'noise-concentration',
        message: `Alert "${topNoisyAlerts[0].message}" accounts for ${topPct}% of volume`,
        action: 'Prioritize fixing or tuning this specific alert',
        impact: 'Extreme noise from single source'
      });
    }

    // 5. Night Patterns
    const nightHours = hourlyHeatmap.filter(h => h.is_night);
    const nightTotal = nightHours.reduce((acc, h) => acc + h.count, 0);
    if (nightTotal > 0) {
        const peak = nightHours.reduce((prev, curr) => (curr.count > prev.count ? curr : prev), nightHours[0]);
        if (peak && peak.count > nightTotal * 0.4) {
              recommendations.push({
                severity: 'medium', category: 'time-pattern',
                message: `Peak night activity at ${peak.hour}:00 (${peak.count} alerts)`,
                action: 'Investigate scheduled jobs/backups around this hour',
                impact: 'Predictable disruption pattern'
            });
        }
    }

    // 6. Healthy State
    if (falsePositiveRate < 20 && nightWakeups < 20 && recommendations.length === 0) {
      recommendations.push({
        severity: 'low', category: 'health',
        message: 'Panel health looks good',
        action: 'Maintain current practices',
        impact: 'Well-tuned alerting'
      });
    }

    return recommendations;
  }
}

module.exports = AlertService;