'use strict';

const express = require('express');
const sql = require('mssql');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// ===== Middleware =====
app.use(cors());
app.use(express.json());

// ===== DB config =====
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME, // אל תשתמש ב-master לפרודקשן
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

// שם הטבלה ← קבע דרך ENV כדי להבדיל בין DEV/PROD
// למשל בדב: DB_TABLE=[dbo].[historicalAlerts]
// בפרוד:     DB_TABLE=[dbo].[alerts]
const TABLE = process.env.DB_TABLE || '[dbo].[historicalAlerts]';

// דרישות חובה למניעת ברירות־מחדל שגויות
['DB_USER', 'DB_PASSWORD', 'DB_SERVER', 'DB_NAME'].forEach((key) => {
  if (!process.env[key]) {
    console.error(`Missing required env: ${key}`);
  }
});

// ===== Connect to DB =====
let pool;
let poolReady = false;

sql
  .connect(dbConfig)
  .then((p) => {
    pool = p;
    poolReady = true;
    console.log('Connected to SQL Server');
  })
  .catch((err) => {
    console.error('Database connection failed:', err);
  });

// Middleware: חסימת בקשות עד שה־pool מוכן
app.use((req, res, next) => {
  if (!poolReady) return res.status(503).json({ error: 'DB not ready' });
  return next();
});

// ===== Helpers =====

// בניית פילטרים לכל הראוטים מאותו מקום (מונע כפילויות)
function buildFilters(q) {
  const where = [];
  const inputs = [];

  const like = (name, val) => {
    where.push(`[${name}] LIKE @${name}`);
    inputs.push({ name, type: sql.NVarChar, value: `%${val}%` });
  };

  const eqInt = (name, val, op = '>=') => {
    where.push(`[${name}] ${op} @${name}`);
    inputs.push({ name, type: sql.Int, value: val });
  };

  const dateCmp = (name, val, op) => {
    where.push(`[${name}] ${op} @${name}`);
    inputs.push({ name, type: sql.DateTime, value: val });
  };

  // LIKE פילטרים טקסטואליים
  if (q.panel_title) like('panel_title', q.panel_title);
  if (q.application) like('application', q.application);
  if (q.node_name) like('node_name', q.node_name);
  if (q.network) like('network', q.network);
  // שמות עמודות שמורות ← עטופים בסוגריים מרובעים
  if (q.object) like('object', q.object);
  if (q.operator) like('operator', q.operator);

  // מספרים
  if (q.min_duration && !Number.isNaN(parseInt(q.min_duration))) {
    eqInt('duration_sec', parseInt(q.min_duration, 10), '>=');
  }
  if (q.max_duration && !Number.isNaN(parseInt(q.max_duration))) {
    eqInt('duration_sec', parseInt(q.max_duration, 10), '<=');
  }

  // תאריכים
  if (q.start_date) {
    const d = new Date(q.start_date);
    if (!Number.isNaN(d.getTime())) dateCmp('time_fired', d, '>=');
  }
  if (q.end_date) {
    const d = new Date(q.end_date);
    if (!Number.isNaN(d.getTime())) dateCmp('time_fired', d, '<=');
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  return { whereSql, inputs };
}

function applyInputs(request, inputs) {
  inputs.forEach((i) => request.input(i.name, i.type, i.value));
}

// רשימת עמודות מפורשת (יציב ומהיר מ-*SELECT)
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

// ===== Routes =====

// בריאות
app.get('/health', (req, res) => {
  res.json({ ok: true, db: poolReady, table: TABLE });
});

// Get all alerts with pagination and filtering
app.get('/api/alerts', async (req, res) => {
  try {
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

    // בניית פילטרים
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

    // פאג’ינציה בטוחה
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(1000, Math.max(1, parseInt(limit, 10) || 100));
    const offsetNum = (pageNum - 1) * limitNum;

    // נתונים
    let dataSql = `
      SELECT ${COLUMNS}
      FROM ${TABLE}
      ${whereSql}
      ORDER BY [time_fired] DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
    `;

    const dataReq = pool.request();
    applyInputs(dataReq, inputs);
    dataReq.input('offset', sql.Int, offsetNum);
    dataReq.input('limit', sql.Int, limitNum);
    const result = await dataReq.query(dataSql);

    // ספירה
    let countSql = `
      SELECT COUNT(1) AS total
      FROM ${TABLE}
      ${whereSql};
    `;
    const countReq = pool.request();
    applyInputs(countReq, inputs);
    const countResult = await countReq.query(countSql);

    const total = countResult.recordset[0]?.total ?? 0;

    res.json({
      alerts: result.recordset,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    console.error('Error fetching alerts:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get statistics overview
app.get('/api/stats/overview', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const filters = {};
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;

    const { whereSql, inputs } = buildFilters(filters);

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
    res.json(result.recordset[0] || {});
  } catch (err) {
    console.error('Error fetching overview stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get alerts by panel title
app.get('/api/stats/by-panel', async (req, res) => {
  try {
    const { start_date, end_date, limit = '10' } = req.query;

    const filters = {};
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;

    const { whereSql, inputs } = buildFilters(filters);

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
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching panel stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get alerts by application
app.get('/api/stats/by-application', async (req, res) => {
  try {
    const { start_date, end_date, limit = '10' } = req.query;

    const filters = {};
    if (start_date) filters.start_date = start_date;
    if (end_date) filters.end_date = end_date;

    const { whereSql, inputs } = buildFilters(filters);

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
    res.json(result.recordset);
  } catch (err) {
    console.error('Error fetching application stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get unique values for filters
app.get('/api/filters/:field', async (req, res) => {
  try {
    const { field } = req.params;
    // allow-list בלבד
    const allowedFields = [
      'panel_title',
      'application',
      'node_name',
      'network',
      'object',
      'operator',
    ];

    if (!allowedFields.includes(field)) {
      return res.status(400).json({ error: 'Invalid field' });
    }

    const sqlText = `
      SELECT DISTINCT [${field}]
      FROM ${TABLE}
      WHERE [${field}] IS NOT NULL
      ORDER BY [${field}];
    `;
    const result = await pool.request().query(sqlText);

    res.json(result.recordset.map((row) => row[field]));
  } catch (err) {
    console.error('Error fetching filter values:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// ===== Graceful shutdown =====
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  try {
    if (pool) await pool.close();
  } catch (e) {
    // ignore
  }
  process.exit(0);
});
