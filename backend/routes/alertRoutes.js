// routes/alertRoutes.js - Extracted from your original server
const express = require('express');
const sql = require('mssql');
const Joi = require('joi');
const { DateTime } = require('luxon');
const { CONFIG } = require('../config');
const { getSqlPool } = require('../database/connection');

const router = express.Router();

// Cache implementation
const cache = new Map();

// Timezone and SQL utilities (moved from main server)
const IL_TZ_SQL = CONFIG.tz.IL_WIN;
const SQL_IL_DT_OFFSET = `(time_fired AT TIME ZONE 'UTC' AT TIME ZONE '${IL_TZ_SQL}')`;
const SQL_IL_HOUR = `DATEPART(HOUR, ${SQL_IL_DT_OFFSET})`;
const SQL_IL_DATE = `CAST(${SQL_IL_DT_OFFSET} AS DATE)`;

// All your existing validation schemas
const customDateValidator = Joi.alternatives().try(
  Joi.date().iso(),
  Joi.string().pattern(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/)
    .custom((value, helpers) => {
      const dt = DateTime.fromISO(value, { zone: CONFIG.tz.IANA });
      if (!dt.isValid) return helpers.error('any.invalid');
      return value;
    })
);

const thresholdSchema = {
  day_start: Joi.number().integer().min(0).max(23),
  day_end: Joi.number().integer().min(0).max(23),
  night_start: Joi.number().integer().min(0).max(23),
  night_end: Joi.number().integer().min(0).max(23),
  false_wakeup_threshold: Joi.number().integer().min(0),
  dur_short_max: Joi.number().integer().min(0),
  dur_medium_max: Joi.number().integer().min(0),
};

const alertsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1),
  limit: Joi.number().integer().min(1).max(1000).default(100),
  panel_title: Joi.string().max(255).trim(),
  application: Joi.string().max(255).trim(),
  node_name: Joi.string().max(255).trim(),
  network: Joi.string().max(255).trim(),
  object: Joi.string().max(255).trim(),
  operator: Joi.string().max(255).trim(),
  min_duration: Joi.number().integer().min(0),
  max_duration: Joi.number().integer().min(0),
  start_date: customDateValidator,
  end_date: customDateValidator,
  sort_by: Joi.string().valid('time_fired', 'duration_sec', 'panel_title').default('time_fired'),
  sort_order: Joi.string().uppercase().valid('ASC', 'DESC').default('DESC'),
  ...thresholdSchema
}).custom((value, helpers) => {
  if (value.start_date && value.end_date) {
    const start = DateTime.fromISO(String(value.start_date), { zone: CONFIG.tz.IANA });
    const end = DateTime.fromISO(String(value.end_date), { zone: CONFIG.tz.IANA });
    if (start.isValid && end.isValid && start > end) {
      return helpers.error('custom.invalidDateRange', { message: 'start_date must be <= end_date' });
    }
  }
  return value;
});

const statsQuerySchema = Joi.object({
  start_date: customDateValidator,
  end_date: customDateValidator,
  limit: Joi.number().integer().min(1).max(100),
  ...thresholdSchema
}).custom((value, helpers) => {
  if (value.start_date && value.end_date) {
    const start = DateTime.fromISO(String(value.start_date), { zone: CONFIG.tz.IANA });
    const end = DateTime.fromISO(String(value.end_date), { zone: CONFIG.tz.IANA });
    if (start.isValid && end.isValid && start > end) {
      return helpers.error('custom.invalidDateRange', { message: 'start_date must be <= end_date' });
    }
  }
  return value;
});

const recentAlertsSchema = Joi.object({
  hours: Joi.number().integer().min(1).max(168).default(24),
  limit: Joi.number().integer().min(1).max(100).default(15),
  ...thresholdSchema
});

// Utility functions (moved from main server)
function buildCacheKey(prefix, params) {
  return `${prefix}:${JSON.stringify(params)}`;
}

function getFromCache(key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CONFIG.cache.ttl * 1000) return cached.data;
  cache.delete(key);
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() });
  if (cache.size > CONFIG.cache.maxEntries) {
    const firstKey = cache.keys().next().value;
    cache.delete(firstKey);
  }
}

function bindThresholdParamsToRequest(request, query) {
  const dayStart   = Number.isFinite(+query.day_start) ? +query.day_start : CONFIG.shifts.dayStart;
  const dayEnd     = Number.isFinite(+query.day_end) ? +query.day_end : CONFIG.shifts.dayEnd;
  const nightStart = Number.isFinite(+query.night_start) ? +query.night_start : CONFIG.shifts.nightStart;
  const nightEnd   = Number.isFinite(+query.night_end) ? +query.night_end : CONFIG.shifts.nightEnd;

  const durShortMax  = Number.isFinite(+query.dur_short_max) ? +query.dur_short_max : CONFIG.duration.short;
  const durMediumMax = Number.isFinite(+query.dur_medium_max) ? +query.dur_medium_max : CONFIG.duration.medium;
  const falseWakeupTh= Number.isFinite(+query.false_wakeup_threshold) ? +query.false_wakeup_threshold : CONFIG.duration.falseWakeupThreshold;

  request.input('day_start', sql.Int, dayStart);
  request.input('day_end', sql.Int, dayEnd);
  request.input('night_start', sql.Int, nightStart);
  request.input('night_end', sql.Int, nightEnd);
  request.input('dur_short_max', sql.Int, durShortMax);
  request.input('dur_medium_max', sql.Int, durMediumMax);
  request.input('false_wakeup_th', sql.Int, falseWakeupTh);

  return { dayStart, dayEnd, nightStart, nightEnd, durShortMax, durMediumMax, falseWakeupTh };
}

function toUtcRangeFromIL(startRaw, endRaw) {
  if (!(startRaw && endRaw)) return null;

  const parseToILDateTime = (raw) => {
    const str = raw instanceof Date ? raw.toISOString() : String(raw).trim();
    const hasTZ = /[zZ]|[+\-]\d{2}:\d{2}$/.test(str);
    if (hasTZ) {
      const dt = DateTime.fromISO(str, { setZone: true });
      return dt.isValid ? dt : null;
    } else {
      const dt = DateTime.fromISO(str, { zone: CONFIG.tz.IANA });
      return dt.isValid ? dt : null;
    }
  };

  const startDT = parseToILDateTime(startRaw);
  const endDT = parseToILDateTime(endRaw);
  if (!startDT || !endDT) return null;

  const endStr = endRaw instanceof Date ? endRaw.toISOString() : String(endRaw).trim();
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(endStr);
  const finalEndDT = isDateOnly ? endDT.endOf('day') : endDT;

  return { utcStart: startDT.toUTC().toJSDate(), utcEnd: finalEndDT.toUTC().toJSDate() };
}

function addUtcDateFilter(request, params) {
  const range = toUtcRangeFromIL(params.start_date, params.end_date);
  if (!range) return '';
  request.input('utc_start', sql.DateTime2, range.utcStart);
  request.input('utc_end', sql.DateTime2, range.utcEnd);
  return ' AND time_fired BETWEEN @utc_start AND @utc_end';
}

function validateRequest(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message)
      });
    }
    req.validatedQuery = value;
    next();
  };
}

async function handleError(res, error, message = 'Internal server error') {
  console.error(`${message}:`, error);
  res.status(500).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { details: error.message })
  });
}

function buildSelectList() {
  return `
    incident_id AS id,
    panel_title, application, node_name, network, object, operator,
    time_fired                                AS time_fired_utc,
    ${SQL_IL_DT_OFFSET}                       AS time_fired_il,
    ${SQL_IL_HOUR}                            AS il_hour,
    CASE WHEN ${SQL_IL_HOUR} >= @day_start AND ${SQL_IL_HOUR} < @day_end
      THEN 'Day' ELSE 'Night' END             AS il_shift,
    time_resolved, duration_sec, message, key_field, history_id,
    CASE
      WHEN duration_sec <= @dur_short_max  THEN 'short'
      WHEN duration_sec <= @dur_medium_max THEN 'medium'
      ELSE 'long'
    END AS duration_category
  `;
}

function createStandardResponse(data, pagination = null, meta = {}) {
  return {
    data,
    pagination,
    meta: { timezone: CONFIG.tz.IANA, cached: false, ...meta }
  };
}

function buildFilterConditions(params, request) {
  let conditions = '';
  const filters = [
    { param: 'panel_title', column: 'panel_title', type: sql.NVarChar },
    { param: 'application', column: 'application', type: sql.NVarChar },
    { param: 'node_name', column: 'node_name', type: sql.NVarChar },
    { param: 'network', column: 'network', type: sql.NVarChar },
    { param: 'object', column: 'object', type: sql.NVarChar },
    { param: 'operator', column: 'operator', type: sql.NVarChar },
  ];
  filters.forEach(f => {
    if (params[f.param]) {
      conditions += ` AND ${f.column} LIKE @${f.param}`;
      request.input(f.param, f.type, `${params[f.param]}%`);
    }
  });
  if (params.min_duration !== undefined) {
    conditions += ` AND duration_sec >= @min_duration`;
    request.input('min_duration', sql.Int, params.min_duration);
  }
  if (params.max_duration !== undefined) {
    conditions += ` AND duration_sec <= @max_duration`;
    request.input('max_duration', sql.Int, params.max_duration);
  }
  return conditions;
}

// Routes start here

// Alerts (list)
router.get('/alerts', validateRequest(alertsQuerySchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = buildCacheKey('alerts', params);
    const cached = getFromCache(cacheKey);
    if (cached) return res.json({ ...cached, meta: { ...cached.meta, cached: true }});

    const pool = getSqlPool();
    const validSortColumns = ['time_fired', 'duration_sec', 'panel_title'];
    const sortBy = validSortColumns.includes(params.sort_by) ? params.sort_by : 'time_fired';
    const sortOrder = params.sort_order === 'ASC' ? 'ASC' : 'DESC';

    const dataReq = pool.request();
    bindThresholdParamsToRequest(dataReq, params);

    let where = ' WHERE 1=1 ';
    where += buildFilterConditions(params, dataReq);
    where += addUtcDateFilter(dataReq, params);

    let dataSql;
    let pagination = null;

    if (params.page && params.limit) {
      dataReq.input('offset', sql.Int, (params.page - 1) * params.limit);
      dataReq.input('limit', sql.Int, params.limit + 1);
      dataSql = `
        SELECT ${buildSelectList()}
        FROM dbo.historicalAlerts
        ${where}
        ORDER BY ${sortBy} ${sortOrder}
        OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
      `;
      const dataResult = await dataReq.query(dataSql);
      const hasMore = dataResult.recordset.length > params.limit;
      const alerts = hasMore ? dataResult.recordset.slice(0, -1) : dataResult.recordset;

      pagination = { page: params.page, limit: params.limit, hasNext: hasMore, hasPrev: params.page > 1 };
      const response = createStandardResponse(alerts, pagination, { filters: params });
      setCache(cacheKey, response);
      return res.json(response);
    } else {
      dataReq.input('limit', sql.Int, params.limit);
      dataSql = `
        SELECT TOP (@limit) ${buildSelectList()}
        FROM dbo.historicalAlerts
        ${where}
        ORDER BY ${sortBy} ${sortOrder};
      `;
      const dataResult = await dataReq.query(dataSql);
      const response = createStandardResponse(dataResult.recordset, null, { filters: params });
      setCache(cacheKey, response);
      return res.json(response);
    }
  } catch (error) {
    await handleError(res, error, 'Error fetching alerts');
  }
});

// Executive KPIs
router.get('/stats/executive-kpis', validateRequest(statsQuerySchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = buildCacheKey('executive_kpis', params);
    const cached = getFromCache(cacheKey);
    if (cached) return res.json({ ...cached, meta: { ...cached.meta, cached: true }});

    const pool = getSqlPool();
    const request = pool.request();
    bindThresholdParamsToRequest(request, params);

    let where = ' WHERE 1=1 ';
    where += addUtcDateFilter(request, params);

    const query = `
      WITH AlertStats AS (
        SELECT 
          COUNT(*) as total_alerts,
          COUNT(CASE WHEN duration_sec <= @dur_short_max THEN 1 END) as noise_alerts,
          COUNT(CASE WHEN ${SQL_IL_HOUR} >= @night_start OR ${SQL_IL_HOUR} < @night_end THEN 1 END) as night_alerts,
          COUNT(CASE 
            WHEN (${SQL_IL_HOUR} >= @night_start OR ${SQL_IL_HOUR} < @night_end) 
             AND duration_sec > @false_wakeup_th THEN 1 
          END) as true_wakeups,
          COUNT(CASE 
            WHEN (${SQL_IL_HOUR} >= @night_start OR ${SQL_IL_HOUR} < @night_end) 
             AND duration_sec <= @false_wakeup_th THEN 1 
          END) as false_wakeups
        FROM dbo.historicalAlerts
        ${where}
      )
      SELECT 
        total_alerts,
        noise_alerts,
        night_alerts,
        true_wakeups,
        false_wakeups,
        CASE WHEN total_alerts > 0 THEN ROUND( (total_alerts - noise_alerts) * 100.0 / total_alerts, 1) ELSE 0 END as signal_to_noise_ratio,
        CASE WHEN (true_wakeups + false_wakeups) > 0 THEN ROUND(false_wakeups * 100.0 / (true_wakeups + false_wakeups), 1) ELSE 0 END as false_wakeup_rate
      FROM AlertStats;
    `;
    const result = await request.query(query);
    const response = createStandardResponse(result.recordset[0], null, {
      date_range: params.start_date && params.end_date ? { start: params.start_date, end: params.end_date } : null
    });
    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    await handleError(res, error, 'Error fetching executive KPIs');
  }
});

router.get('/stats/recent-alerts', validateRequest(recentAlertsSchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = buildCacheKey('recent_alerts', params);
    const cached = getFromCache(cacheKey);
    if (cached) return res.json({ ...cached, meta: { ...cached.meta, cached: true }});

    const pool = getSqlPool();
    const request = pool.request();
    bindThresholdParamsToRequest(request, params);
    request.input('hours', sql.Int, params.hours);
    request.input('limit', sql.Int, params.limit);

    const query = `
      SELECT TOP (@limit) ${buildSelectList()}
      FROM dbo.historicalAlerts
      WHERE time_fired >= DATEADD(HOUR, -@hours, GETUTCDATE())
      ORDER BY time_fired DESC
    `;
    const result = await request.query(query);
    const response = createStandardResponse(result.recordset);
    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    await handleError(res, error, 'Error fetching recent alerts');
  }
});

// Weekend vs Weekday
router.get('/stats/weekend-weekday', validateRequest(statsQuerySchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = buildCacheKey('weekend_weekday', params);
    const cached = getFromCache(cacheKey);
    if (cached) return res.json({ ...cached, meta: { ...cached.meta, cached: true }});

    const pool = getSqlPool();
    const request = pool.request();
    bindThresholdParamsToRequest(request, params);

    let where = ' WHERE 1=1 ';
    where += addUtcDateFilter(request, params);

    const query = `
      SELECT 
        CASE DATENAME(WEEKDAY, ${SQL_IL_DT_OFFSET})
          WHEN 'Friday'   THEN 'Weekend'
          WHEN 'Saturday' THEN 'Weekend'
          WHEN N'שישי'   THEN 'Weekend'
          WHEN N'שבת'    THEN 'Weekend'
          ELSE 'Weekdays'
        END as period,
        COUNT(*) as alert_count,
        ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) as avg_duration,
        COUNT(CASE WHEN duration_sec <= @dur_short_max THEN 1 END) as short_alerts,
        COUNT(CASE WHEN duration_sec > @dur_medium_max THEN 1 END) as long_alerts,
        COUNT(CASE WHEN ${SQL_IL_HOUR} >= @night_start OR ${SQL_IL_HOUR} < @night_end THEN 1 END) as night_alerts
      FROM dbo.historicalAlerts
      ${where}
      GROUP BY CASE DATENAME(WEEKDAY, ${SQL_IL_DT_OFFSET})
        WHEN 'Friday'   THEN 'Weekend'
        WHEN 'Saturday' THEN 'Weekend'
        WHEN N'שישי'   THEN 'Weekend'
        WHEN N'שבת'    THEN 'Weekend'
        ELSE 'Weekdays'
      END
      ORDER BY period DESC
    `;
    const result = await request.query(query);
    const response = createStandardResponse(result.recordset);
    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    await handleError(res, error, 'Error fetching weekend/weekday stats');
  }
});

// Duration histogram
router.get('/stats/duration-histogram', validateRequest(statsQuerySchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = buildCacheKey('duration_histogram', params);
    const cached = getFromCache(cacheKey);
    if (cached) return res.json({ ...cached, meta: { ...cached.meta, cached: true }});

    const pool = getSqlPool();
    const request = pool.request();
    bindThresholdParamsToRequest(request, params);

    let where = ' WHERE 1=1 ';
    where += addUtcDateFilter(request, params);

    const query = `
      SELECT '<=short' as duration_range, COUNT(CASE WHEN duration_sec <= @dur_short_max THEN 1 END) as count, 1 as sort_order
      FROM dbo.historicalAlerts ${where}
      UNION ALL
      SELECT 'short..medium', COUNT(CASE WHEN duration_sec > @dur_short_max AND duration_sec <= @dur_medium_max THEN 1 END), 2
      FROM dbo.historicalAlerts ${where}
      UNION ALL
      SELECT '>medium', COUNT(CASE WHEN duration_sec > @dur_medium_max THEN 1 END), 3
      FROM dbo.historicalAlerts ${where}
      ORDER BY sort_order
    `;
    const result = await request.query(query);
    const data = result.recordset.map(r => ({ range: r.duration_range, count: r.count }));
    const response = createStandardResponse(data);
    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    await handleError(res, error, 'Error fetching duration histogram');
  }
});

// Hourly heatmap
router.get('/stats/hourly-heatmap', validateRequest(statsQuerySchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = buildCacheKey('hourly_heatmap', params);
    const cached = getFromCache(cacheKey);
    if (cached) return res.json({ ...cached, meta: { ...cached.meta, cached: true }});

    const pool = getSqlPool();
    const request = pool.request();
    bindThresholdParamsToRequest(request, params);

    let where = ' WHERE 1=1 ';
    where += addUtcDateFilter(request, params);

    const query = `
      SELECT 
        ${SQL_IL_HOUR} as hour,
        COUNT(*) as count,
        CASE WHEN ${SQL_IL_HOUR} >= @night_start OR ${SQL_IL_HOUR} < @night_end THEN 1 ELSE 0 END as is_night
      FROM dbo.historicalAlerts
      ${where}
      GROUP BY ${SQL_IL_HOUR}
      ORDER BY hour
    `;
    const result = await request.query(query);

    const fullHours = Array.from({ length: 24 }, (_, i) => {
      const existing = result.recordset.find(r => r.hour === i);
      return {
        hour: i,
        hour_display: `${String(i).padStart(2,'0')}:00`,
        count: existing ? existing.count : 0,
        is_night: i >= (params.night_start ?? CONFIG.shifts.nightStart) || i < (params.night_end ?? CONFIG.shifts.nightEnd)
      };
    });

    const response = createStandardResponse(fullHours);
    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    await handleError(res, error, 'Error fetching hourly heatmap');
  }
});

// Shift analysis
router.get('/stats/shift-analysis', validateRequest(statsQuerySchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = buildCacheKey('stats_shift', params);
    const cached = getFromCache(cacheKey);
    if (cached) return res.json({ ...cached, meta: { ...cached.meta, cached: true }});

    const pool = getSqlPool();
    const request = pool.request();
    bindThresholdParamsToRequest(request, params);

    let where = ' WHERE 1=1 ';
    where += addUtcDateFilter(request, params);

    const query = `
      SELECT 
        CASE WHEN ${SQL_IL_HOUR} >= @day_start AND ${SQL_IL_HOUR} < @day_end THEN 'Day' ELSE 'Night' END as shift,
        COUNT(*) as alert_count,
        ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) as avg_duration,
        MIN(duration_sec) as min_duration,
        MAX(duration_sec) as max_duration,
        COUNT(CASE WHEN duration_sec <= @false_wakeup_th THEN 1 END) as false_wakeups,
        COUNT(CASE WHEN duration_sec > @false_wakeup_th THEN 1 END) as true_alerts,
        COUNT(DISTINCT panel_title) as unique_panels,
        COUNT(DISTINCT operator) as unique_operators,
        CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(CASE WHEN duration_sec <= @false_wakeup_th THEN 1 END) * 100.0 / COUNT(*), 1) ELSE 0 END as false_wakeup_rate
      FROM dbo.historicalAlerts
      ${where}
      GROUP BY CASE WHEN ${SQL_IL_HOUR} >= @day_start AND ${SQL_IL_HOUR} < @day_end THEN 'Day' ELSE 'Night' END
      ORDER BY shift
    `;
    const result = await request.query(query);
    const response = createStandardResponse(result.recordset);
    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    await handleError(res, error, 'Error fetching shift analysis');
  }
});

// Overview
router.get('/stats/overview', validateRequest(statsQuerySchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = buildCacheKey('stats_overview', params);
    const cached = getFromCache(cacheKey);
    if (cached) return res.json({ ...cached, meta: { ...cached.meta, cached: true }});

    const pool = getSqlPool();
    const request = pool.request();
    bindThresholdParamsToRequest(request, params);

    let where = ' WHERE 1=1 ';
    where += addUtcDateFilter(request, params);

    const query = `
      SELECT 
        COUNT(*) as total_alerts,
        ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) as avg_duration,
        MIN(duration_sec) as min_duration,
        MAX(duration_sec) as max_duration,
        COUNT(CASE WHEN duration_sec <= @dur_short_max THEN 1 END) as short_alerts,
        COUNT(CASE WHEN duration_sec > @dur_short_max AND duration_sec <= @dur_medium_max THEN 1 END) as medium_alerts,
        COUNT(CASE WHEN duration_sec > @dur_medium_max THEN 1 END) as long_alerts,
        COUNT(DISTINCT panel_title) as unique_panels,
        COUNT(DISTINCT application) as unique_applications,
        COUNT(DISTINCT node_name) as unique_nodes,
        COUNT(DISTINCT network) as unique_networks,
        COUNT(DISTINCT operator) as unique_operators,
        COUNT(CASE WHEN time_resolved IS NOT NULL THEN 1 END) as resolved_alerts,
        COUNT(CASE WHEN time_resolved IS NULL THEN 1 END) as unresolved_alerts,
        COUNT(CASE WHEN ${SQL_IL_HOUR} >= @night_start OR ${SQL_IL_HOUR} < @night_end THEN 1 END) as night_alerts,
        COUNT(CASE WHEN ${SQL_IL_HOUR} >= @day_start AND ${SQL_IL_HOUR} < @day_end THEN 1 END) as day_alerts,
        CASE WHEN COUNT(*) > 0 
             THEN ROUND( ( COUNT(*) - COUNT(CASE WHEN duration_sec <= @dur_short_max THEN 1 END) ) * 100.0 / COUNT(*), 1)
             ELSE 0 END as signal_to_noise_ratio
      FROM dbo.historicalAlerts
      ${where}
    `;
    const result = await request.query(query);
    const response = createStandardResponse(result.recordset[0], null, {
      date_range: params.start_date && params.end_date ? { start: params.start_date, end: params.end_date } : null
    });
    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    await handleError(res, error, 'Error fetching overview stats');
  }
});

// Hourly distribution
router.get('/stats/hourly', validateRequest(statsQuerySchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = buildCacheKey('stats_hourly', params);
    const cached = getFromCache(cacheKey);
    if (cached) return res.json({ ...cached, meta: { ...cached.meta, cached: true }});

    const pool = getSqlPool();
    const request = pool.request();
    bindThresholdParamsToRequest(request, params);

    let where = ' WHERE 1=1 ';
    where += addUtcDateFilter(request, params);

    const query = `
      SELECT 
        ${SQL_IL_HOUR} as hour,
        COUNT(*) as alert_count,
        ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) as avg_duration,
        COUNT(CASE WHEN duration_sec <= @dur_short_max THEN 1 END) as immediate_alerts,
        COUNT(CASE WHEN duration_sec > @dur_short_max AND duration_sec <= @dur_medium_max THEN 1 END) as short_alerts,
        COUNT(CASE WHEN duration_sec > @dur_medium_max THEN 1 END) as long_alerts
      FROM dbo.historicalAlerts
      ${where}
      GROUP BY ${SQL_IL_HOUR}
      ORDER BY hour
    `;
    const result = await request.query(query);
    const response = createStandardResponse(result.recordset);
    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    await handleError(res, error, 'Error fetching hourly stats');
  }
});

// Patterns (storms & correlations)
router.get('/stats/patterns', validateRequest(statsQuerySchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = buildCacheKey('stats_patterns', params);
    const cached = getFromCache(cacheKey);
    if (cached) return res.json({ ...cached, meta: { ...cached.meta, cached: true }});

    const pool = getSqlPool();
    
    // storms
    const stormsReq = pool.request();
    bindThresholdParamsToRequest(stormsReq, params);
    let stormsWhere = ' WHERE 1=1 ';
    stormsWhere += addUtcDateFilter(stormsReq, params);

    const stormQuery = `
      WITH Base AS (
        SELECT application, panel_title, time_fired
        FROM dbo.historicalAlerts
        ${stormsWhere}
      ),
      Storms AS (
        SELECT 
          b.application,
          b.panel_title,
          b.time_fired,
          (SELECT COUNT(*) 
             FROM dbo.historicalAlerts x
             WHERE x.application = b.application
               AND x.time_fired BETWEEN DATEADD(MINUTE, -10, b.time_fired) AND b.time_fired
          ) AS alerts_in_window
        FROM Base b
      )
      SELECT *
      FROM Storms
      WHERE alerts_in_window >= 5
      ORDER BY time_fired DESC
    `;

    // correlations
    const corrReq = pool.request();
    bindThresholdParamsToRequest(corrReq, params);
    let corrWhere = ' WHERE 1=1 ';
    corrWhere += addUtcDateFilter(corrReq, params);

    const correlationQuery = `
      SELECT TOP 20
        a1.application,
        a1.panel_title as panel1,
        a2.panel_title as panel2,
        COUNT(*) as correlation_count,
        ROUND(AVG(CAST(ABS(DATEDIFF(SECOND, a1.time_fired, a2.time_fired)) AS FLOAT)), 2) as avg_time_diff
      FROM dbo.historicalAlerts a1
      JOIN dbo.historicalAlerts a2 
        ON a1.application = a2.application
       AND a1.incident_id < a2.incident_id
       AND ABS(DATEDIFF(SECOND, a1.time_fired, a2.time_fired)) <= 300
      ${corrWhere.replace('WHERE 1=1', 'WHERE a1.time_fired IS NOT NULL AND a2.time_fired IS NOT NULL')}
      GROUP BY a1.application, a1.panel_title, a2.panel_title
      HAVING COUNT(*) >= 3
      ORDER BY correlation_count DESC
    `;

    const [stormResult, correlationResult] = await Promise.all([
      stormsReq.query(stormQuery),
      corrReq.query(correlationQuery)
    ]);

    const response = createStandardResponse({
      storms: stormResult.recordset,
      correlations: correlationResult.recordset
    });
    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    await handleError(res, error, 'Error fetching pattern analysis');
  }
});

// Operators
router.get('/stats/operators', validateRequest(statsQuerySchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = buildCacheKey('stats_operators', params);
    const cached = getFromCache(cacheKey);
    if (cached) return res.json({ ...cached, meta: { ...cached.meta, cached: true }});

    const pool = getSqlPool();
    const request = pool.request();
    bindThresholdParamsToRequest(request, params);

    let where = ' WHERE 1=1 ';
    where += addUtcDateFilter(request, params);

    const query = `
      SELECT 
        COALESCE(operator, 'System/Auto') as operator,
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN ${SQL_IL_HOUR} >= @night_start OR ${SQL_IL_HOUR} < @night_end THEN 1 END) as night_alerts,
        COUNT(CASE WHEN ${SQL_IL_HOUR} >= @day_start AND ${SQL_IL_HOUR} < @day_end THEN 1 END) as day_alerts,
        ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) as avg_resolution_time,
        COUNT(CASE WHEN duration_sec <= @dur_short_max THEN 1 END) as quick_resolutions,
        COUNT(CASE WHEN duration_sec > 900 THEN 1 END) as long_resolutions,
        COUNT(CASE WHEN time_resolved IS NOT NULL THEN 1 END) as resolved_count,
        COUNT(DISTINCT application) as apps_handled,
        MIN(time_fired) as first_alert_utc,
        MAX(time_fired) as last_alert_utc
      FROM dbo.historicalAlerts
      ${where}
      GROUP BY operator
      ORDER BY total_alerts DESC
    `;
    const result = await request.query(query);
    const response = createStandardResponse(result.recordset);
    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    await handleError(res, error, 'Error fetching operator stats');
  }
});

// By panel
router.get('/stats/by-panel', validateRequest(statsQuerySchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = buildCacheKey('stats_panel', params);
    const cached = getFromCache(cacheKey);
    if (cached) return res.json({ ...cached, meta: { ...cached.meta, cached: true }});

    const pool = getSqlPool();
    const request = pool.request();
    bindThresholdParamsToRequest(request, params);

    let where = ' WHERE 1=1 ';
    where += addUtcDateFilter(request, params);

    let query;
    if (params.limit) {
      request.input('limit', sql.Int, params.limit);
      query = `
        SELECT TOP (@limit)
          panel_title,
          application,
          COUNT(*) as alert_count,
          ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) as avg_duration,
          MIN(duration_sec) as min_duration,
          MAX(duration_sec) as max_duration,
          COUNT(CASE WHEN duration_sec <= @dur_short_max THEN 1 END) as short_alerts,
          COUNT(CASE WHEN duration_sec > @dur_short_max AND duration_sec <= @dur_medium_max THEN 1 END) as medium_alerts,
          COUNT(CASE WHEN duration_sec > @dur_medium_max THEN 1 END) as long_alerts
        FROM dbo.historicalAlerts
        ${where}
        GROUP BY panel_title, application
        ORDER BY alert_count DESC
      `;
    } else {
      query = `
        SELECT 
          panel_title,
          application,
          COUNT(*) as alert_count,
          ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) as avg_duration,
          MIN(duration_sec) as min_duration,
          MAX(duration_sec) as max_duration,
          COUNT(CASE WHEN duration_sec <= @dur_short_max THEN 1 END) as short_alerts,
          COUNT(CASE WHEN duration_sec > @dur_short_max AND duration_sec <= @dur_medium_max THEN 1 END) as medium_alerts,
          COUNT(CASE WHEN duration_sec > @dur_medium_max THEN 1 END) as long_alerts
        FROM dbo.historicalAlerts
        ${where}
        GROUP BY panel_title, application
        ORDER BY alert_count DESC
      `;
    }

    const result = await request.query(query);
    const response = createStandardResponse(result.recordset);
    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    await handleError(res, error, 'Error fetching panel stats');
  }
});

// Time series (per IL day) - THIS IS THE MISSING ENDPOINT
router.get('/stats/timeseries', validateRequest(statsQuerySchema), async (req, res) => {
  try {
    const params = req.validatedQuery;
    const cacheKey = buildCacheKey('stats_timeseries', params);
    const cached = getFromCache(cacheKey);
    if (cached) return res.json({ ...cached, meta: { ...cached.meta, cached: true }});

    const pool = getSqlPool();
    const request = pool.request();
    bindThresholdParamsToRequest(request, params);

    let where = ' WHERE 1=1 ';
    where += addUtcDateFilter(request, params);

    const query = `
      SELECT 
        ${SQL_IL_DATE} as date_il,
        COUNT(*) as alert_count,
        ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) as avg_duration,
        COUNT(CASE WHEN ${SQL_IL_HOUR} >= @night_start OR ${SQL_IL_HOUR} < @night_end THEN 1 END) as night_count,
        COUNT(CASE WHEN ${SQL_IL_HOUR} >= @day_start AND ${SQL_IL_HOUR} < @day_end THEN 1 END) as day_count
      FROM dbo.historicalAlerts
      ${where}
      GROUP BY ${SQL_IL_DATE}
      ORDER BY date_il
    `;
    const result = await request.query(query);
    const response = createStandardResponse(result.recordset);
    setCache(cacheKey, response);
    res.json(response);
  } catch (error) {
    await handleError(res, error, 'Error fetching time series data');
  }
});

module.exports = router;