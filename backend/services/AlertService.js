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
  } async getPanelList(params) {
    const pool = this.getPool();
    const request = pool.request();
    
    const range = TimeUtils.validateDateRange(params.start_date, params.end_date);
    const where = this._buildDateWhereClause(request, range);

    const result = await request.query(`
      SELECT 
        panel_title,
        COUNT(*) AS alert_count,
        COUNT(CASE WHEN duration_sec <= ${params.false_wakeup_threshold || 120} THEN 1 END) AS false_positive_count,
        ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration,
        COUNT(DISTINCT application) AS application_count
      FROM dbo.historicalAlerts
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      GROUP BY panel_title
      ORDER BY alert_count DESC
    `);

    return ResponseFormatter.success(result.recordset);
  }

  // Detailed panel analysis
  async getPanelAnalysis(params) {
    const pool = this.getPool();
    const request = pool.request();
    
    const range = TimeUtils.validateDateRange(params.start_date, params.end_date);
    const where = this._buildDateWhereClause(request, range);
    
    // Add panel filter
    if (!params.panel_title) {
      throw new Error('panel_title is required');
    }
    request.input('panelTitle', this._getSqlType('NVarChar'), params.panel_title);
    where.push('panel_title = @panelTitle');

    const cap = Math.min(params.limit || 100000, 100000);
    request.input('cap', this._getSqlType('Int'), cap);

    const result = await request.query(`
      SELECT TOP (@cap)
        incident_id, panel_title, application, time_fired, 
        time_resolved, duration_sec, operator, message
      FROM dbo.historicalAlerts
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY time_fired DESC
    `);

    const analysis = this._computePanelAnalysis(result.recordset, params);
    return ResponseFormatter.success(analysis);
  }

  // Get alert frequency by specific alert message/type
  async getAlertMessageBreakdown(params) {
    const pool = this.getPool();
    const request = pool.request();
    
    const range = TimeUtils.validateDateRange(params.start_date, params.end_date);
    const where = this._buildDateWhereClause(request, range);
    
    if (!params.panel_title) {
      throw new Error('panel_title is required');
    }
    request.input('panelTitle', this._getSqlType('NVarChar'), params.panel_title);
    where.push('panel_title = @panelTitle');

    const result = await request.query(`
      SELECT 
        message,
        COUNT(*) AS occurrence_count,
        ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration,
        MIN(duration_sec) AS min_duration,
        MAX(duration_sec) AS max_duration,
        COUNT(CASE WHEN duration_sec <= ${params.false_wakeup_threshold || 120} THEN 1 END) AS false_positive_count
      FROM dbo.historicalAlerts
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      GROUP BY message
      ORDER BY occurrence_count DESC
    `);

    return ResponseFormatter.success(result.recordset);
  }

  // Helper: Compute detailed panel analysis
  _computePanelAnalysis(records, params) {
    const {
      day_start = 8, day_end = 22,
      dur_short_max = 30,
      dur_medium_max = 300,
      false_wakeup_threshold = 120,
      night_start = 22,
      night_end = 8
    } = params;

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
          trend_direction: 'stable'
        },
        duration_distribution: [],
        daily_trend: [],
        hourly_heatmap: [],
        top_noisy_alerts: [],
        recommendations: []
      };
    }

    // Basic metrics
    let total = 0, sumDuration = 0;
    let shortAlerts = 0, mediumAlerts = 0, longAlerts = 0;
    let falsePositives = 0, nightAlerts = 0, dayAlerts = 0;
    let nightWakeups = 0, nightFalseWakeups = 0;
    
    const dailyCount = new Map();
    const hourlyCount = Array(24).fill(0);
    const durationBuckets = Array(24).fill(0).map(() => ({ sum: 0, count: 0 }));
    const messageFrequency = new Map();

    for (const record of records) {
      total++;
      sumDuration += record.duration_sec;
      
      // Duration categories
      if (record.duration_sec <= dur_short_max) shortAlerts++;
      else if (record.duration_sec <= dur_medium_max) mediumAlerts++;
      else longAlerts++;

      // False positives
      if (record.duration_sec <= false_wakeup_threshold) {
        falsePositives++;
      }

      // Time analysis
      const hour = TimeUtils.getILHour(record.time_fired);
      const date = TimeUtils.getILDate(record.time_fired);
      const isNight = hour >= night_start || hour < night_end;

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

      // Hourly distribution
      if (hour !== null) {
        hourlyCount[hour]++;
        durationBuckets[hour].sum += record.duration_sec;
        durationBuckets[hour].count++;
      }

      // Daily trend
      if (date) {
        dailyCount.set(date, (dailyCount.get(date) || 0) + 1);
      }

      // Message frequency
      if (record.message) {
        const current = messageFrequency.get(record.message) || { count: 0, durations: [] };
        current.count++;
        current.durations.push(record.duration_sec);
        messageFrequency.set(record.message, current);
      }
    }

    // Calculate trends
    const dailyTrend = Array.from(dailyCount.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    const hourlyHeatmap = hourlyCount.map((count, hour) => ({
      hour,
      count,
      avg_duration: durationBuckets[hour].count 
        ? +(durationBuckets[hour].sum / durationBuckets[hour].count).toFixed(2)
        : 0,
      is_night: hour >= night_start || hour < night_end
    }));

    // Top noisy messages
    const topNoisyAlerts = Array.from(messageFrequency.entries())
      .map(([message, data]) => ({
        message,
        count: data.count,
        avg_duration: +(data.durations.reduce((a, b) => a + b, 0) / data.durations.length).toFixed(2),
        false_positive_rate: +((data.durations.filter(d => d <= false_wakeup_threshold).length * 100) / data.count).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Duration distribution
    const durationDistribution = [
      { category: 'Short', range: `≤${dur_short_max}s`, count: shortAlerts },
      { category: 'Medium', range: `${dur_short_max + 1}-${dur_medium_max}s`, count: mediumAlerts },
      { category: 'Long', range: `>${dur_medium_max}s`, count: longAlerts }
    ];

    // Calculate velocity (alerts per day)
    const daysInRange = dailyTrend.length || 1;
    const alertsPerDay = +(total / daysInRange).toFixed(2);

    // Trend analysis (first half vs second half)
    let trendDirection = 'stable';
    if (dailyTrend.length >= 4) {
      const midpoint = Math.floor(dailyTrend.length / 2);
      const firstHalf = dailyTrend.slice(0, midpoint);
      const secondHalf = dailyTrend.slice(midpoint);
      const firstAvg = firstHalf.reduce((sum, d) => sum + d.count, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, d) => sum + d.count, 0) / secondHalf.length;
      const change = ((secondAvg - firstAvg) / firstAvg) * 100;
      
      if (change > 15) trendDirection = 'increasing';
      else if (change < -15) trendDirection = 'decreasing';
    }

    return {
      summary: {
        total_alerts: total,
        avg_duration: total ? +(sumDuration / total).toFixed(2) : 0,
        false_positive_count: falsePositives,
        false_positive_rate: total ? +((falsePositives * 100) / total).toFixed(1) : 0,
        night_alerts: nightAlerts,
        night_wakeups: nightWakeups,
        night_false_wakeups: nightFalseWakeups,
        day_alerts: dayAlerts,
        alerts_per_day: alertsPerDay,
        trend_direction: trendDirection
      },
      duration_distribution: durationDistribution,
      daily_trend: dailyTrend,
      hourly_heatmap: hourlyHeatmap,
      top_noisy_alerts: topNoisyAlerts,
      recommendations: this._generateRecommendations({
        total,
        falsePositives,
        nightWakeups,
        nightFalseWakeups,
        shortAlerts,
        alertsPerDay,
        trendDirection,
        topNoisyAlerts,
        hourlyHeatmap
      }, params)
    };
  }

  // Generate intelligent recommendations
  _generateRecommendations(metrics, params) {
    const recommendations = [];
    const {
      total, falsePositives, nightWakeups, nightFalseWakeups,
      shortAlerts, alertsPerDay, trendDirection, topNoisyAlerts, hourlyHeatmap
    } = metrics;

    const falsePositiveRate = total ? (falsePositives * 100) / total : 0;

    // Rule 1: High false positive rate
    if (falsePositiveRate > 60) {
      recommendations.push({
        severity: 'high',
        category: 'threshold',
        message: `${falsePositiveRate.toFixed(1)}% of alerts are false positives (<${params.false_wakeup_threshold || 120}s)`,
        action: 'Consider increasing alert threshold or implementing correlation rules',
        impact: 'High team disruption with low-value alerts'
      });
    } else if (falsePositiveRate > 40) {
      recommendations.push({
        severity: 'medium',
        category: 'threshold',
        message: `${falsePositiveRate.toFixed(1)}% false positive rate detected`,
        action: 'Review alert thresholds for top noisy sources',
        impact: 'Moderate noise affecting team efficiency'
      });
    }

    // Rule 2: Night disruption analysis
    if (nightFalseWakeups > 20) {
      recommendations.push({
        severity: 'high',
        category: 'night-operations',
        message: `${nightFalseWakeups} false night wakeups detected`,
        action: 'Implement night-specific thresholds or suppress non-critical alerts during night hours',
        impact: 'Team fatigue and reduced on-call effectiveness'
      });
    }

    if (nightWakeups > 50) {
      recommendations.push({
        severity: 'medium',
        category: 'night-operations',
        message: `${nightWakeups} legitimate night wakeups (high frequency)`,
        action: 'Review SRE practices and automation opportunities to reduce night incidents',
        impact: 'Unsustainable on-call load'
      });
    }

    // Rule 3: Alert volume trend
    if (trendDirection === 'increasing') {
      recommendations.push({
        severity: 'medium',
        category: 'trend',
        message: 'Alert volume is trending upward',
        action: 'Investigate root causes - possible system degradation or monitoring misconfiguration',
        impact: 'Increasing operational burden'
      });
    }

    // Rule 4: High alert velocity
    if (alertsPerDay > 50) {
      recommendations.push({
        severity: 'high',
        category: 'velocity',
        message: `${alertsPerDay.toFixed(1)} alerts per day (high volume)`,
        action: 'Review alert definitions and consider implementing alert aggregation',
        impact: 'Alert fatigue and potential for missed critical issues'
      });
    }

    // Rule 5: Noisy alert concentration
    if (topNoisyAlerts.length > 0 && topNoisyAlerts[0].count > total * 0.25) {
      recommendations.push({
        severity: 'high',
        category: 'noise-concentration',
        message: `Single alert type "${topNoisyAlerts[0].message}" accounts for ${((topNoisyAlerts[0].count * 100) / total).toFixed(1)}% of all alerts`,
        action: 'Priority: Address this specific alert - likely misconfigured threshold or needs correlation',
        impact: 'Extreme noise from single source'
      });
    }

    // Rule 6: Time pattern analysis
    const nightHours = hourlyHeatmap.filter(h => h.is_night);
    const nightTotal = nightHours.reduce((sum, h) => sum + h.count, 0);
    const peakNightHour = nightHours.reduce((max, h) => h.count > max.count ? h : max, nightHours[0] || { count: 0 });
    
    if (peakNightHour && peakNightHour.count > nightTotal * 0.4) {
      recommendations.push({
        severity: 'medium',
        category: 'time-pattern',
        message: `Peak night activity at ${peakNightHour.hour}:00 (${peakNightHour.count} alerts)`,
        action: 'Investigate scheduled jobs or batch processes that may be causing alerts',
        impact: 'Predictable disruption pattern'
      });
    }

    // Rule 7: Positive feedback
    if (falsePositiveRate < 20 && nightWakeups < 20) {
      recommendations.push({
        severity: 'low',
        category: 'health',
        message: 'Panel health looks good - low false positive rate and minimal night disruption',
        action: 'Continue current monitoring practices',
        impact: 'Well-tuned alerting'
      });
    }

    return recommendations;
  }

  async getPanelStats(params) {
    const pool = this.getPool();
    const request = pool.request();

    // 1. Validate and parameterize date range
    const range = TimeUtils.validateDateRange(params.start_date, params.end_date);
    const where = this._buildDateWhereClause(request, range);

    // 2. Parameterize numeric filters
    const limit = params.limit || null;
    const durShortMax = params.dur_short_max || 30;
    const durMediumMax = params.dur_medium_max || 300;

    if (limit) request.input('limit', this._getSqlType('Int'), limit);
    request.input('dur_short_max', this._getSqlType('Int'), durShortMax);
    request.input('dur_medium_max', this._getSqlType('Int'), durMediumMax);

    // 3. Construct SQL dynamically but safely
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

    // 4. Run query safely
    try {
      const result = await request.query(sqlText);
      return ResponseFormatter.success(result.recordset);
    } catch (err) {
      console.error('Database query failed:', err);
      return ResponseFormatter.error('Database query failed', err);
    }
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
    const dayMap = new Map();

    for (const record of records) {
      // ✅ Use the helper method for consistency
      const ilDate = TimeUtils.getILDate(record.time_fired);
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

  // Helper: Compute detailed panel analysis
  _computePanelAnalysis(records, params) {
    const {
      day_start = 8, day_end = 22,
      dur_short_max = 30,
      dur_medium_max = 300,
      false_wakeup_threshold = 120,
      night_start = 22,
      night_end = 8
    } = params;

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
          trend_direction: 'stable'
        },
        duration_distribution: [],
        daily_trend: [],
        hourly_heatmap: [],
        top_noisy_alerts: [],
        recommendations: []
      };
    }

    // Basic metrics
    let total = 0, sumDuration = 0;
    let shortAlerts = 0, mediumAlerts = 0, longAlerts = 0;
    let falsePositives = 0, nightAlerts = 0, dayAlerts = 0;
    let nightWakeups = 0, nightFalseWakeups = 0;
    
    const dailyCount = new Map();
    const hourlyCount = Array(24).fill(0);
    const durationBuckets = Array(24).fill(0).map(() => ({ sum: 0, count: 0 }));
    const messageFrequency = new Map();

    for (const record of records) {
      total++;
      sumDuration += record.duration_sec;
      
      // Duration categories
      if (record.duration_sec <= dur_short_max) shortAlerts++;
      else if (record.duration_sec <= dur_medium_max) mediumAlerts++;
      else longAlerts++;

      // False positives
      if (record.duration_sec <= false_wakeup_threshold) {
        falsePositives++;
      }

      // Time analysis
      const hour = TimeUtils.getILHour(record.time_fired);
      const date = TimeUtils.getILDate(record.time_fired);
      const isNight = hour >= night_start || hour < night_end;

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

      // Hourly distribution
      if (hour !== null) {
        hourlyCount[hour]++;
        durationBuckets[hour].sum += record.duration_sec;
        durationBuckets[hour].count++;
      }

      // Daily trend
      if (date) {
        dailyCount.set(date, (dailyCount.get(date) || 0) + 1);
      }

      // Message frequency
      if (record.message) {
        const current = messageFrequency.get(record.message) || { count: 0, durations: [] };
        current.count++;
        current.durations.push(record.duration_sec);
        messageFrequency.set(record.message, current);
      }
    }

    // Calculate trends
    const dailyTrend = Array.from(dailyCount.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    const hourlyHeatmap = hourlyCount.map((count, hour) => ({
      hour,
      count,
      avg_duration: durationBuckets[hour].count 
        ? +(durationBuckets[hour].sum / durationBuckets[hour].count).toFixed(2)
        : 0,
      is_night: hour >= night_start || hour < night_end
    }));

    // Top noisy messages
    const topNoisyAlerts = Array.from(messageFrequency.entries())
      .map(([message, data]) => ({
        message,
        count: data.count,
        avg_duration: +(data.durations.reduce((a, b) => a + b, 0) / data.durations.length).toFixed(2),
        false_positive_rate: +((data.durations.filter(d => d <= false_wakeup_threshold).length * 100) / data.count).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Duration distribution
    const durationDistribution = [
      { category: 'Short', range: `≤${dur_short_max}s`, count: shortAlerts },
      { category: 'Medium', range: `${dur_short_max + 1}-${dur_medium_max}s`, count: mediumAlerts },
      { category: 'Long', range: `>${dur_medium_max}s`, count: longAlerts }
    ];

    // Calculate velocity (alerts per day)
    const daysInRange = dailyTrend.length || 1;
    const alertsPerDay = +(total / daysInRange).toFixed(2);

    // Trend analysis (first half vs second half)
    let trendDirection = 'stable';
    if (dailyTrend.length >= 4) {
      const midpoint = Math.floor(dailyTrend.length / 2);
      const firstHalf = dailyTrend.slice(0, midpoint);
      const secondHalf = dailyTrend.slice(midpoint);
      const firstAvg = firstHalf.reduce((sum, d) => sum + d.count, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, d) => sum + d.count, 0) / secondHalf.length;
      const change = ((secondAvg - firstAvg) / firstAvg) * 100;
      
      if (change > 15) trendDirection = 'increasing';
      else if (change < -15) trendDirection = 'decreasing';
    }

    return {
      summary: {
        total_alerts: total,
        avg_duration: total ? +(sumDuration / total).toFixed(2) : 0,
        false_positive_count: falsePositives,
        false_positive_rate: total ? +((falsePositives * 100) / total).toFixed(1) : 0,
        night_alerts: nightAlerts,
        night_wakeups: nightWakeups,
        night_false_wakeups: nightFalseWakeups,
        day_alerts: dayAlerts,
        alerts_per_day: alertsPerDay,
        trend_direction: trendDirection
      },
      duration_distribution: durationDistribution,
      daily_trend: dailyTrend,
      hourly_heatmap: hourlyHeatmap,
      top_noisy_alerts: topNoisyAlerts,
      recommendations: this._generateRecommendations({
        total,
        falsePositives,
        nightWakeups,
        nightFalseWakeups,
        shortAlerts,
        alertsPerDay,
        trendDirection,
        topNoisyAlerts,
        hourlyHeatmap
      }, params)
    };
  }

  // Generate intelligent recommendations
  _generateRecommendations(metrics, params) {
    const recommendations = [];
    const {
      total, falsePositives, nightWakeups, nightFalseWakeups,
      shortAlerts, alertsPerDay, trendDirection, topNoisyAlerts, hourlyHeatmap
    } = metrics;

    const falsePositiveRate = total ? (falsePositives * 100) / total : 0;

    // Rule 1: High false positive rate
    if (falsePositiveRate > 60) {
      recommendations.push({
        severity: 'high',
        category: 'threshold',
        message: `${falsePositiveRate.toFixed(1)}% of alerts are false positives (<${params.false_wakeup_threshold || 120}s)`,
        action: 'Consider increasing alert threshold or implementing correlation rules',
        impact: 'High team disruption with low-value alerts'
      });
    } else if (falsePositiveRate > 40) {
      recommendations.push({
        severity: 'medium',
        category: 'threshold',
        message: `${falsePositiveRate.toFixed(1)}% false positive rate detected`,
        action: 'Review alert thresholds for top noisy sources',
        impact: 'Moderate noise affecting team efficiency'
      });
    }

    // Rule 2: Night disruption analysis
    if (nightFalseWakeups > 20) {
      recommendations.push({
        severity: 'high',
        category: 'night-operations',
        message: `${nightFalseWakeups} false night wakeups detected`,
        action: 'Implement night-specific thresholds or suppress non-critical alerts during night hours',
        impact: 'Team fatigue and reduced on-call effectiveness'
      });
    }

    if (nightWakeups > 50) {
      recommendations.push({
        severity: 'medium',
        category: 'night-operations',
        message: `${nightWakeups} legitimate night wakeups (high frequency)`,
        action: 'Review SRE practices and automation opportunities to reduce night incidents',
        impact: 'Unsustainable on-call load'
      });
    }

    // Rule 3: Alert volume trend
    if (trendDirection === 'increasing') {
      recommendations.push({
        severity: 'medium',
        category: 'trend',
        message: 'Alert volume is trending upward',
        action: 'Investigate root causes - possible system degradation or monitoring misconfiguration',
        impact: 'Increasing operational burden'
      });
    }

    // Rule 4: High alert velocity
    if (alertsPerDay > 50) {
      recommendations.push({
        severity: 'high',
        category: 'velocity',
        message: `${alertsPerDay.toFixed(1)} alerts per day (high volume)`,
        action: 'Review alert definitions and consider implementing alert aggregation',
        impact: 'Alert fatigue and potential for missed critical issues'
      });
    }

    // Rule 5: Noisy alert concentration
    if (topNoisyAlerts.length > 0 && topNoisyAlerts[0].count > total * 0.25) {
      recommendations.push({
        severity: 'high',
        category: 'noise-concentration',
        message: `Single alert type "${topNoisyAlerts[0].message}" accounts for ${((topNoisyAlerts[0].count * 100) / total).toFixed(1)}% of all alerts`,
        action: 'Priority: Address this specific alert - likely misconfigured threshold or needs correlation',
        impact: 'Extreme noise from single source'
      });
    }

    // Rule 6: Time pattern analysis
    const nightHours = hourlyHeatmap.filter(h => h.is_night);
    const nightTotal = nightHours.reduce((sum, h) => sum + h.count, 0);
    const peakNightHour = nightHours.reduce((max, h) => h.count > max.count ? h : max, nightHours[0]);
    
    if (peakNightHour && peakNightHour.count > nightTotal * 0.4) {
      recommendations.push({
        severity: 'medium',
        category: 'time-pattern',
        message: `Peak night activity at ${peakNightHour.hour}:00 (${peakNightHour.count} alerts)`,
        action: 'Investigate scheduled jobs or batch processes that may be causing alerts',
        impact: 'Predictable disruption pattern'
      });
    }

    // Rule 7: Positive feedback
    if (falsePositiveRate < 20 && nightWakeups < 20) {
      recommendations.push({
        severity: 'low',
        category: 'health',
        message: 'Panel health looks good - low false positive rate and minimal night disruption',
        action: 'Continue current monitoring practices',
        impact: 'Well-tuned alerting'
      });
    }

    return recommendations;
  }
}

module.exports = AlertService;