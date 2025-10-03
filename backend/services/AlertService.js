// services/AlertService.js - Centralized business logic
const { getSqlPool } = require('../database/connection');
const { QueryBuilder } = require('../utils/QueryBuilder');
const { TimeUtils } = require('../utils/TimeUtils');
const { ResponseFormatter } = require('../utils/ResponseFormatter');

class AlertService {
  constructor() {
    this.pool = null;
  }

  getPool() {
    if (!this.pool) {
      this.pool = getSqlPool();
    }
    return this.pool;
  }


  async getAlerts(params) {
    const pool = this.getPool();
    const request = pool.request();

    // Build query
    const qb = new QueryBuilder()
      .select(`incident_id, panel_title, application, node_name, network, object, 
               operator, time_fired, time_resolved, duration_sec, message, key_field, history_id`)
      .orderBy(params.sort_by, params.sort_order);

    // Add filters
    const whereParts = [
      ...this._bindDateFilters(request, params),
      ...this._bindFieldFilters(request, params)
    ];
    
    whereParts.forEach(w => qb.addWhere(w));

    // Handle pagination
    let pagination = null;
    if (params.page && params.limit) {
      const offset = (params.page - 1) * params.limit;
      qb.offset(offset, params.limit + 1);
    } else {
      qb.top(params.limit);
    }

    const [sqlText, sqlParams] = qb.build();
    
    // Bind query builder parameters
    sqlParams.forEach(p => {
      const type = this._getSqlType(p.type);
      request.input(p.name, type, p.value);
    });

    const result = await request.query(sqlText);
    let records = result.recordset;

    // Process pagination
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

    const transformedData = records.map(r => this._transformAlertRecord(r, params));
    return ResponseFormatter.success(transformedData, pagination);
  }



  async getExecutiveKPIs(params) {
    const pool = this.getPool();
    const request = pool.request();

    const range = TimeUtils.validateDateRange(params.start_date, params.end_date);
    const whereParts = [];
    
    if (range?.start) {
      request.input('startDate', this._getSqlType('DateTime2'), range.start);
      whereParts.push('time_fired >= @startDate');
    }
    if (range?.end) {
      request.input('endDate', this._getSqlType('DateTime2'), range.end);
      whereParts.push('time_fired <= @endDate');
    }

    const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';
    const limit = Math.min(params.limit || 100000, 100000); // Safety cap
    request.input('cap', this._getSqlType('Int'), limit);

    const sqlText = `
      SELECT TOP (@cap) time_fired, duration_sec
      FROM dbo.historicalAlerts
      ${whereSql}
      ORDER BY time_fired DESC
    `;

    const result = await request.query(sqlText);
    const kpis = this._computeKPIs(result.recordset, params);
    
    return ResponseFormatter.success(kpis);
  }



  async getDurationHistogram(params) {
    const pool = this.getPool();
    const request = pool.request();
    
    const range = TimeUtils.validateDateRange(params.start_date, params.end_date);
    const where = this._buildDateWhereClause(request, range);
    const cap = Math.min(params.limit || 100000, 100000);
    request.input('cap', this._getSqlType('Int'), cap);

    const result = await request.query(`
      SELECT TOP (@cap) duration_sec
      FROM dbo.historicalAlerts
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY time_fired DESC
    `);

    const histogram = this._computeDurationHistogram(result.recordset, params);
    return ResponseFormatter.success(histogram);
  }

  async getHourlyHeatmap(params) {
    const data = await this._getBasicAlertData(params);
    const heatmap = this._computeHourlyHeatmap(data.recordset, params);
    return ResponseFormatter.success(heatmap);
  }

  async getShiftAnalysis(params) {
    const pool = this.getPool();
    const request = pool.request();
    
    const range = TimeUtils.validateDateRange(params.start_date, params.end_date);
    const where = this._buildDateWhereClause(request, range);
    const cap = Math.min(params.limit || 100000, 100000);
    request.input('cap', this._getSqlType('Int'), cap);

    const result = await request.query(`
      SELECT TOP (@cap) time_fired, duration_sec, panel_title, operator
      FROM dbo.historicalAlerts
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY time_fired DESC
    `);

    const analysis = this._computeShiftAnalysis(result.recordset, params);
    return ResponseFormatter.success(analysis);
  }

  
  async _getBasicAlertData(params) {
    const pool = this.getPool();
    const request = pool.request();
    
    const range = TimeUtils.validateDateRange(params.start_date, params.end_date);
    const where = this._buildDateWhereClause(request, range);
    const cap = Math.min(params.limit || 100000, 100000);
    request.input('cap', this._getSqlType('Int'), cap);

    return await request.query(`
      SELECT TOP (@cap) time_fired, duration_sec
      FROM dbo.historicalAlerts
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY time_fired DESC
    `);
  }

  _buildDateWhereClause(request, range) {
    const where = [];
    if (range?.start) {
      request.input('start', this._getSqlType('DateTime2'), range.start);
      where.push('time_fired >= @start');
    }
    if (range?.end) {
      request.input('end', this._getSqlType('DateTime2'), range.end);
      where.push('time_fired <= @end');
    }
    return where;
  }

  async getOverviewStats(params) {
    const pool = this.getPool();
    const request = pool.request();
    const range = TimeUtils.validateDateRange(params.start_date, params.end_date);
    const where = this._buildDateWhereClause(request, range);
    const cap = Math.min(params.limit || 100000, 100000);
    request.input('cap', this._getSqlType('Int'), cap);

    const rows = (await request.query(`
      SELECT TOP (@cap)
        time_fired, time_resolved, duration_sec,
        panel_title, application, node_name, network, operator
      FROM dbo.historicalAlerts
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY time_fired DESC
    `)).recordset;

    const stats = this._computeOverviewStats(rows, params);
    return ResponseFormatter.success(stats);
  }

  async getHourlyStats(params) {
    const data = await this._getBasicAlertData(params);
    const hourlyStats = this._computeHourlyStats(data.recordset, params);
    return ResponseFormatter.success(hourlyStats);
  }

  async getTimeseriesStats(params) {
    const data = await this._getBasicAlertData(params);
    const timeseries = this._computeTimeseriesStats(data.recordset, params);
    return ResponseFormatter.success(timeseries);
  }

  async getPanelStats(params) {
    const pool = this.getPool();
    const request = pool.request();
    const range = TimeUtils.validateDateRange(params.start_date, params.end_date);
    const where = this._buildDateWhereClause(request, range);

    if (params.limit) request.input('limit', this._getSqlType('Int'), params.limit);

    const sqlText = params.limit ? `
        SELECT TOP (@limit)
        panel_title, application,
        COUNT(*) as alert_count,
        ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) as avg_duration,
        MIN(duration_sec) as min_duration,
        MAX(duration_sec) as max_duration,
        COUNT(CASE WHEN duration_sec <= ${params.dur_short_max || 30} THEN 1 END) as short_alerts,
        COUNT(CASE WHEN duration_sec > ${params.dur_short_max || 30} AND duration_sec <= ${params.dur_medium_max || 300} THEN 1 END) as medium_alerts,
        COUNT(CASE WHEN duration_sec > ${params.dur_medium_max || 300} THEN 1 END) as long_alerts
        FROM dbo.historicalAlerts
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        GROUP BY panel_title, application
        ORDER BY alert_count DESC
    ` : `
        SELECT 
        panel_title, application,
        COUNT(*) as alert_count,
        ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) as avg_duration,
        MIN(duration_sec) as min_duration,
        MAX(duration_sec) as max_duration,
        COUNT(CASE WHEN duration_sec <= ${params.dur_short_max || 30} THEN 1 END) as short_alerts,
        COUNT(CASE WHEN duration_sec > ${params.dur_short_max || 30} AND duration_sec <= ${params.dur_medium_max || 300} THEN 1 END) as medium_alerts,
        COUNT(CASE WHEN duration_sec > ${params.dur_medium_max || 300} THEN 1 END) as long_alerts
        FROM dbo.historicalAlerts
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        GROUP BY panel_title, application
        ORDER BY alert_count DESC
    `;

    const result = await request.query(sqlText);
    return ResponseFormatter.success(result.recordset);
  }

  // ================== Helper Methods ==================

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
    
    fields.forEach(field => {
      if (params[field]) {
        conditions.push(`${field} LIKE @${field}`);
        request.input(field, this._getSqlType('NVarChar'), `${params[field]}%`);
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

  _getSqlType(type) {
    const sql = require('mssql');
    const typeMap = {
      'Int': sql.Int,
      'DateTime2': sql.DateTime2,
      'NVarChar': sql.NVarChar
    };
    return typeMap[type] || sql.NVarChar;
  }

  _transformAlertRecord(record, config = {}) {
    const {
      day_start = 8,
      day_end = 22,
      dur_short_max = 30,
      dur_medium_max = 300
    } = config;

    const ilHour = TimeUtils.getILHour(record.time_fired);
    const shift = ilHour !== null && ilHour >= day_start && ilHour < day_end ? 'Day' : 'Night';

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



  // ================== COMPUTATION HELPERS ==================

  _computeOverviewStats(records, params) {
    const { day_start = 8, day_end = 22, dur_short_max = 30, dur_medium_max = 300 } = params;

    let total = 0, sum = 0, min = Infinity, max = -Infinity;
    let shortAlerts = 0, mediumAlerts = 0, longAlerts = 0;
    let resolved = 0, unresolved = 0, nightAlerts = 0, dayAlerts = 0;
    const sets = {
      panels: new Set(),
      apps: new Set(), 
      nodes: new Set(),
      networks: new Set(),
      operators: new Set()
    };

    for (const record of records) {
      total++;
      sum += record.duration_sec;
      min = Math.min(min, record.duration_sec);
      max = Math.max(max, record.duration_sec);

      if (record.duration_sec <= dur_short_max) shortAlerts++;
      else if (record.duration_sec <= dur_medium_max) mediumAlerts++;
      else longAlerts++;

      if (record.time_resolved) resolved++;
      else unresolved++;

      const hour = TimeUtils.getILHour(record.time_fired);
      if (TimeUtils.isDayHour(hour, day_start, day_end)) dayAlerts++;
      else nightAlerts++;

      if (record.panel_title) sets.panels.add(record.panel_title);
      if (record.application) sets.apps.add(record.application);
      if (record.node_name) sets.nodes.add(record.node_name);
      if (record.network) sets.networks.add(record.network);
      if (record.operator) sets.operators.add(record.operator);
    }

    const signalRatio = total ? +((total - shortAlerts) * 100 / total).toFixed(1) : 0;

    return {
      total_alerts: total,
      avg_duration: total ? +(sum / total).toFixed(2) : 0,
      min_duration: total ? min : 0,
      max_duration: total ? max : 0,
      short_alerts: shortAlerts,
      medium_alerts: mediumAlerts,
      long_alerts: longAlerts,
      unique_panels: sets.panels.size,
      unique_applications: sets.apps.size,
      unique_nodes: sets.nodes.size,
      unique_networks: sets.networks.size,
      unique_operators: sets.operators.size,
      resolved_alerts: resolved,
      unresolved_alerts: unresolved,
      night_alerts: nightAlerts,
      day_alerts: dayAlerts,
      signal_to_noise_ratio: signalRatio,
      date_range: params.start_date && params.end_date 
        ? { start: params.start_date, end: params.end_date } 
        : null,
    };
  }

  _computeHourlyStats(records, params) {
    const { dur_short_max = 30, dur_medium_max = 300 } = params;
    const buckets = Array.from({ length: 24 }, () => ({ 
      n: 0, sum: 0, immediate: 0, short: 0, long: 0 
    }));

    for (const record of records) {
      const hour = TimeUtils.getILHour(record.time_fired);
      if (hour !== null) {
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
    const { day_start = 8, day_end = 22 } = params;
    const { DateTime } = require('luxon');
    
    const dayMap = new Map();

    for (const record of records) {
      const ilDate = DateTime.fromJSDate(record.time_fired, { zone: 'utc' })
        .setZone('Asia/Jerusalem').toISODate();
      const hour = TimeUtils.getILHour(record.time_fired);

      if (!dayMap.has(ilDate)) {
        dayMap.set(ilDate, { count: 0, sum: 0, day: 0, night: 0 });
      }

      const dayStats = dayMap.get(ilDate);
      dayStats.count++;
      dayStats.sum += record.duration_sec;

      if (TimeUtils.isDayHour(hour, day_start, day_end)) {
        dayStats.day++;
      } else {
        dayStats.night++;
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
      day_start = 8, day_end = 22,
      false_wakeup_threshold = 120
    } = params;

    const buckets = {
      Day: { 
        n: 0, sum: 0, min: Infinity, max: -Infinity, 
        false_wakeups: 0, true_alerts: 0, 
        panels: new Set(), ops: new Set() 
      },
      Night: { 
        n: 0, sum: 0, min: Infinity, max: -Infinity, 
        false_wakeups: 0, true_alerts: 0, 
        panels: new Set(), ops: new Set() 
      },
    };

    for (const record of records) {
      const hour = TimeUtils.getILHour(record.time_fired);
      const shift = TimeUtils.isDayHour(hour, day_start, day_end) ? 'Day' : 'Night';
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
      false_wakeup_rate: bucket.n ? +((bucket.false_wakeups * 100) / bucket.n).toFixed(1) : 0,
    }));
  }

  _computeKPIs(records, params) {
    console.log('Computing KPIs with params:', params);
  const {
    night_start = params.night_start || 22,
    night_end = params.night_end || 8,
    dur_short_max = params.dur_short_max || 30,
    false_wakeup_threshold = params.false_wakeup_threshold || 120  // This should come from client settings
  } = params;

  let total = 0, noise = 0, night = 0, trueWakeups = 0, falseWakeups = 0;

  for (const record of records) {
    total++;
    const ilHour = TimeUtils.getILHour(record.time_fired);
    const isNight = ilHour >= night_start || ilHour < night_end;

    if (record.duration_sec <= dur_short_max) noise++;
    
    if (isNight) {
      night++;
      if (record.duration_sec > false_wakeup_threshold) {
        trueWakeups++;
      } else {
        falseWakeups++;
      }
    }
  }

  const signalRatio = total > 0 ? +((total - noise) * 100 / total).toFixed(1) : 0;
  const falseWakeRate = (trueWakeups + falseWakeups) > 0 
    ? +(falseWakeups * 100 / (trueWakeups + falseWakeups)).toFixed(1) 
    : 0;

  return {
    total_alerts: total,
    noise_alerts: noise,
    night_alerts: night,
    true_wakeups: trueWakeups,
    false_wakeups: falseWakeups,
    signal_ratio: signalRatio,
    false_wakeup_rate: falseWakeRate,
  };
  }

  _computeDurationHistogram(records, params) {
    const { dur_short_max = 30, dur_medium_max = 300 } = params;
    let short = 0, medium = 0, long = 0;

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
    const { night_start = 22, night_end = 8 } = params;
    const counts = Array.from({ length: 24 }, () => 0);

    for (const record of records) {
      const ilHour = TimeUtils.getILHour(record.time_fired);
      if (ilHour !== null) counts[ilHour]++;
    }

    return counts.map((count, hour) => ({
      hour,
      hour_display: `${String(hour).padStart(2, '0')}:00`,
      count,
      is_night: TimeUtils.isNightHour(hour, night_start, night_end),
    }));
  }

}

module.exports = AlertService;