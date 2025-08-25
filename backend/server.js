'use strict';

/**
 * Express + MS SQL Server Alert Analytics API
 *
 * Endpoints:
 *  GET  /health
 *  GET  /api/alerts                     — list with filters + pagination (ROW_NUMBER CTE)
 *  GET  /api/alerts/export              — export CSV/JSON (full, with upper cap)
 *  GET  /api/stats/overview             — totals/avg/min/max/short/medium/long
 *  GET  /api/stats/by-panel             — top panels
 *  GET  /api/stats/by-application       — top applications
 *  GET  /api/filters/:field             — distinct values (allow-listed)
 */

const express = require('express');
const sql = require('mssql');
const cors = require('cors');
require('dotenv').config();

// ---------- App & Config ----------
const app = express();
// Default to 5000 to match a common CRA frontend default
const PORT = Number(process.env.PORT) || 5000;

app.set('trust proxy', true);
app.use(cors());               // adjust origin/credentials if needed
app.use(express.json());

// ---------- DB Config ----------
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined, // optional
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true' || true,       // Azure/modern SQL defaults
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true' || true, // dev/local
  },
  pool: {
    max: Number(process.env.DB_POOL_MAX || 10),
    min: Number(process.env.DB_POOL_MIN || 0),
    idleTimeoutMillis: Number(process.env.DB_POOL_IDLE || 30000),
  },
};

// Table name via env so you can switch dev/prod easily.
// e.g. DB_TABLE=[dbo].[historicalAlerts]
const TABLE = process.env.DB_TABLE || '[dbo].[historicalAlerts]';

// Basic env sanity logs (don’t crash, just warn)
['DB_USER', 'DB_PASSWORD', 'DB_SERVER', 'DB_NAME'].forEach((key) => {
  if (!process.env[key]) console.error(`⚠ Missing required env: ${key}`);
});

// ---------- DB Connection Pool ----------
let pool;
let poolReady = false;

sql
  .connect(dbConfig)
  .then((p) => {
    pool = p;
    poolReady = true;
    console.log('✅ Connected to SQL Server');
  })
  .catch((err) => {
    console.error('❌ Database connection failed:', err);
  });

// Block requests until pool is ready
app.use((req, res, next) => {
  if (!poolReady) return res.status(503).json({ error: 'DB not ready' });
  return next();
});

// ---------- Helpers ----------
const isProd = process.env.NODE_ENV === 'production';
const dbg = (...args) => { if (!isProd) console.log(...args); };

// Escape LIKE special chars (\ % _), use ESCAPE clause
function sanitizeLike(val) {
  if (typeof val !== 'string') return val;
  return val.replace(/[\\%_]/g, (m) => '\\' + m);
}

/**
 * Build WHERE clause + param inputs based on query filters
 * Supports: text LIKE fields, duration min/max (duration_sec),
 *           date range (start_date/end_date on [time_fired]).
 */

function buildFilters(q) {
  const where = [];
  const inputs = [];

  const like = (name, valRaw) => {
    const val = sanitizeLike(String(valRaw));
    where.push(`[${name}] LIKE @${name} ESCAPE '\\'`);
    inputs.push({ name, type: sql.NVarChar, value: `%${val}%` });
  };

  const cmpNumber = (column, paramName, value, op) => {
    where.push(`[${column}] ${op} @${paramName}`);
    inputs.push({ name: paramName, type: sql.Int, value });
  };

  const cmpDate = (column, paramName, value, op) => {
    where.push(`[${column}] ${op} @${paramName}`);
    inputs.push({ name: paramName, type: sql.DateTime2, value });
  };

  // LIKE filters for text fields
  if (q.panel_title) like('panel_title', q.panel_title);
  if (q.application) like('application', q.application);
  if (q.node_name)   like('node_name',   q.node_name);
  if (q.network)     like('network',     q.network);
  if (q.object)      like('object',      q.object);
  if (q.operator)    like('operator',    q.operator);

  // Duration range (seconds) - FIXED LOGIC
  const minDur = (q.min_duration !== undefined && q.min_duration !== '')
    ? parseInt(q.min_duration, 10)
    : null;
  const maxDur = (q.max_duration !== undefined && q.max_duration !== '')
    ? parseInt(q.max_duration, 10)
    : null;

  // Handle duration filtering correctly
  if (minDur !== null && !Number.isNaN(minDur) && maxDur !== null && !Number.isNaN(maxDur)) {
    // Both min and max specified
    where.push(`[duration_sec] BETWEEN @min_duration AND @max_duration`);
    inputs.push({ name: 'min_duration', type: sql.Int, value: Math.max(0, minDur) });
    inputs.push({ name: 'max_duration', type: sql.Int, value: Math.max(0, maxDur) });
  } else if (minDur !== null && !Number.isNaN(minDur)) {
    // Only min specified - THIS IS YOUR CASE
    where.push(`[duration_sec] >= @min_duration`);
    inputs.push({ name: 'min_duration', type: sql.Int, value: Math.max(0, minDur) });
  } else if (maxDur !== null && !Number.isNaN(maxDur)) {
    // Only max specified
    where.push(`[duration_sec] <= @max_duration`);
    inputs.push({ name: 'max_duration', type: sql.Int, value: Math.max(0, maxDur) });
  }

  // Date range on time_fired (ISO in, Date out)
  const startDate = q.start_date ? new Date(q.start_date) : null;
  const endDate   = q.end_date   ? new Date(q.end_date)   : null;

  const validStart = startDate && !Number.isNaN(startDate.getTime()) ? startDate : null;
  const validEnd   = endDate   && !Number.isNaN(endDate.getTime())   ? endDate   : null;

  if (validStart && validEnd) {
    where.push(`[time_fired] BETWEEN @start_date AND @end_date`);
    inputs.push({ name: 'start_date', type: sql.DateTime2, value: validStart });
    inputs.push({ name: 'end_date',   type: sql.DateTime2, value: validEnd });
  } else if (validStart) {
    where.push(`[time_fired] >= @start_date`);
    inputs.push({ name: 'start_date', type: sql.DateTime2, value: validStart });
  } else if (validEnd) {
    where.push(`[time_fired] <= @end_date`);
    inputs.push({ name: 'end_date', type: sql.DateTime2, value: validEnd });
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // Debug logging
  dbg('Generated WHERE:', whereSql);
  dbg('Parameters:', inputs.map(i => ({ name: i.name, value: i.value, type: i.type?.name })));

  return { whereSql, inputs };
}

function applyInputs(request, inputs) {
  inputs.forEach((i) => request.input(i.name, i.type, i.value));
}

// explicit columns for performance & stability
const COLUMNS = [
  '[incident_id]',
  '[panel_title]',
  '[application]',
  '[node_name]',
  '[network]',
  '[object]',
  '[history_id]',
  '[message]',
  '[operator]',
  '[key_field]',
  '[time_fired]',
  '[time_resolved]',
  '[duration_sec]',
  '[source_time_created]',
].join(', ');

// Input validation
function validateRangeInputs(q) {
  const errors = [];

  const have = (v) => v !== undefined && v !== null && v !== '';

  if (have(q.min_duration)) {
    const n = parseInt(q.min_duration, 10);
    if (Number.isNaN(n)) errors.push('min_duration must be an integer');
    else if (n < 0) errors.push('min_duration cannot be negative');
  }

  if (have(q.max_duration)) {
    const n = parseInt(q.max_duration, 10);
    if (Number.isNaN(n)) errors.push('max_duration must be an integer');
    else if (n < 0) errors.push('max_duration cannot be negative');
  }

  if (have(q.min_duration) && have(q.max_duration)) {
    const a = parseInt(q.min_duration, 10);
    const b = parseInt(q.max_duration, 10);
    if (!Number.isNaN(a) && !Number.isNaN(b) && a > b) {
      errors.push('min_duration cannot be greater than max_duration');
    }
  }

  if (have(q.start_date)) {
    const d = new Date(q.start_date);
    if (!d || Number.isNaN(d.getTime())) errors.push('start_date is invalid');
  }
  if (have(q.end_date)) {
    const d = new Date(q.end_date);
    if (!d || Number.isNaN(d.getTime())) errors.push('end_date is invalid');
  }
  if (have(q.start_date) && have(q.end_date)) {
    const s = new Date(q.start_date);
    const e = new Date(q.end_date);
    if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && s > e) {
      errors.push('start_date cannot be after end_date');
    }
  }

  return errors;
}

// ---------- Routes ----------

// Health
app.get('/health', (req, res) => {
  res.json({ ok: true, db: poolReady, table: TABLE });
});

// Alerts with filters + pagination (ROW_NUMBER)
app.get('/api/alerts', async (req, res) => {
  try {
    dbg('Received query params:', req.query);

    const errors = validateRangeInputs(req.query);
    if (errors.length) {
      return res.status(400).json({ error: 'Invalid input parameters', details: errors });
    }

    const {
      page = '1',
      limit = '100',
      panel_title,
      application,
      node_name,
      network,
      object,
      operator,
      min_duration,
      max_duration,
      start_date,
      end_date,
    } = req.query;

    const { whereSql, inputs } = buildFilters({
      panel_title,
      application,
      node_name,
      network,
      object,
      operator,
      min_duration,
      max_duration,
      start_date,
      end_date,
    });

    const pageNum  = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit, 10) || 100));
    const offsetNum = (pageNum - 1) * limitNum;

    // --- ROW_NUMBER CTE pagination ---
    const dataSql = `
      WITH cte AS (
        SELECT
          ${COLUMNS},
          ROW_NUMBER() OVER (ORDER BY [time_fired] DESC, [history_id] DESC) AS rn
        FROM ${TABLE}
        ${whereSql}
      )
      SELECT ${COLUMNS}
      FROM cte
      WHERE rn BETWEEN (@offset + 1) AND (@offset + @limit)
      ORDER BY rn;
    `;

    const dataReq = pool.request();
    applyInputs(dataReq, inputs);
    dataReq.input('offset', sql.Int, offsetNum);
    dataReq.input('limit', sql.Int, limitNum);

    const rowsRes = await dataReq.query(dataSql);

    const countSql = `
      SELECT COUNT(1) AS total
      FROM ${TABLE}
      ${whereSql};
    `;
    const countReq = pool.request();
    applyInputs(countReq, inputs);
    const countRes = await countReq.query(countSql);
    const total = countRes.recordset[0]?.total ?? 0;

    dbg(`Query returned ${rowsRes.recordset.length} row(s), total: ${total}`);

    return res.json({
      alerts: rowsRes.recordset,
      total,
      page: pageNum,
      totalPages: Math.max(1, Math.ceil(total / limitNum)),
      appliedFilters: {
        where: whereSql,
        parameters: inputs.map(i => i.name),
      },
    });
  } catch (err) {
    console.error('Error fetching alerts:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Export alerts (CSV / JSON) with upper cap
app.get('/api/alerts/export', async (req, res) => {
  try {
    const {
      panel_title,
      application,
      node_name,
      network,
      object,
      operator,
      min_duration,
      max_duration,
      start_date,
      end_date,
      format = 'csv',
      limit = '200000', // upper bound; tune for your infra
    } = req.query;

    const errors = validateRangeInputs(req.query);
    if (errors.length) {
      return res.status(400).json({ error: 'Invalid input parameters', details: errors });
    }

    const { whereSql, inputs } = buildFilters({
      panel_title,
      application,
      node_name,
      network,
      object,
      operator,
      min_duration,
      max_duration,
      start_date,
      end_date,
    });

    const cap = Math.min(1_000_000, Math.max(1, parseInt(limit, 10) || 200_000));

    const sqlText = `
      SELECT TOP (@cap)
        ${COLUMNS}
      FROM ${TABLE}
      ${whereSql}
      ORDER BY [time_fired] DESC, [history_id] DESC;
    `;

    const request = pool.request();
    applyInputs(request, inputs);
    request.input('cap', sql.Int, cap);

    const result = await request.query(sqlText);
    const rows = result.recordset || [];
    const filenameBase = `alerts_${Date.now()}`;

    if (String(format).toLowerCase() === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.json"`);
      // Stream JSON array
      res.write('[');
      for (let i = 0; i < rows.length; i++) {
        if (i) res.write(',');
        res.write(JSON.stringify(rows[i]));
      }
      res.write(']');
      return res.end();
    }

    // Default CSV
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filenameBase}.csv"`);

    const headers = COLUMNS.split(',').map(s => s.trim().replace(/^\[|\]$/g, '')); // strip [col]
    res.write(headers.join(',') + '\n');

    const esc = (v) => {
      if (v == null) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    for (const row of rows) {
      const line = headers.map((h) => esc(row[h])).join(',');
      res.write(line + '\n');
    }
    return res.end();
  } catch (err) {
    console.error('Error exporting alerts:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// Stats: overview (range-aware)
app.get('/api/stats/overview', async (req, res) => {
  try {
    const errors = validateRangeInputs(req.query);
    if (errors.length) {
      return res.status(400).json({ error: 'Invalid date/duration range', details: errors });
    }

    // We honor only time range + duration filters here (you can extend to text filters if desired)
    const { whereSql, inputs } = buildFilters({
      start_date: req.query.start_date,
      end_date: req.query.end_date,
      min_duration: req.query.min_duration,
      max_duration: req.query.max_duration,
    });

    const sqlText = `
      SELECT 
        COUNT(*) AS total_alerts,
        AVG(CAST([duration_sec] AS FLOAT)) AS avg_duration,
        MIN([duration_sec]) AS min_duration,
        MAX([duration_sec]) AS max_duration,
        COUNT(CASE WHEN [duration_sec] <= 30 THEN 1 END) AS short_alerts,
        COUNT(CASE WHEN [duration_sec] > 30 AND [duration_sec] <= 300 THEN 1 END) AS medium_alerts,
        COUNT(CASE WHEN [duration_sec] > 300 THEN 1 END) AS long_alerts
      FROM ${TABLE}
      ${whereSql};
    `;

    const request = pool.request();
    applyInputs(request, inputs);
    const result = await request.query(sqlText);

    return res.json(result.recordset[0] || {});
  } catch (err) {
    console.error('Error fetching overview stats:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Stats: by panel (top N)
app.get('/api/stats/by-panel', async (req, res) => {
  try {
    const { start_date, end_date, min_duration, max_duration, limit = '10' } = req.query;

    const { whereSql, inputs } = buildFilters({ start_date, end_date, min_duration, max_duration });
    const top = Math.min(1000, Math.max(1, parseInt(limit, 10) || 10));

    const sqlText = `
      SELECT TOP (@limit)
        [panel_title],
        COUNT(*) AS alert_count,
        AVG(CAST([duration_sec] AS FLOAT)) AS avg_duration
      FROM ${TABLE}
      ${whereSql}
      GROUP BY [panel_title]
      ORDER BY alert_count DESC;
    `;

    const request = pool.request();
    applyInputs(request, inputs);
    request.input('limit', sql.Int, top);

    const result = await request.query(sqlText);
    return res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching panel stats:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Stats: by application (top N)
app.get('/api/stats/by-application', async (req, res) => {
  try {
    const { start_date, end_date, min_duration, max_duration, limit = '10' } = req.query;

    const { whereSql, inputs } = buildFilters({ start_date, end_date, min_duration, max_duration });
    const top = Math.min(1000, Math.max(1, parseInt(limit, 10) || 10));

    const sqlText = `
      SELECT TOP (@limit)
        [application],
        COUNT(*) AS alert_count,
        AVG(CAST([duration_sec] AS FLOAT)) AS avg_duration
      FROM ${TABLE}
      ${whereSql}
      GROUP BY [application]
      ORDER BY alert_count DESC;
    `;

    const request = pool.request();
    applyInputs(request, inputs);
    request.input('limit', sql.Int, top);

    const result = await request.query(sqlText);
    return res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching application stats:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Distinct values for filters (allow-list)
app.get('/api/filters/:field', async (req, res) => {
  try {
    const allowed = [
      'panel_title',
      'application',
      'node_name',
      'network',
      'object',
      'operator',
    ];
    const { field } = req.params;
    if (!allowed.includes(field)) {
      return res.status(400).json({ error: 'Invalid field' });
    }

    const sqlText = `
      SELECT DISTINCT [${field}]
      FROM ${TABLE}
      WHERE [${field}] IS NOT NULL
      ORDER BY [${field}];
    `;
    const result = await pool.request().query(sqlText);
    return res.json(result.recordset.map((r) => r[field]));
  } catch (err) {
    console.error('Error fetching filter values:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ---------- Start Server ----------
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// ---------- Graceful Shutdown ----------
process.on('SIGINT', async () => {
  console.log('\nShutting down server…');
  try { if (pool) await pool.close(); } catch {}
  process.exit(0);
});
