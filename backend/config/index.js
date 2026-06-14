// config/index.js
require('dotenv').config();

const CONFIG = Object.freeze({
  cache: {
    maxEntries: 1000,
    enabled: true,
  },
  duration: {
    // Defaults must match the frontend's DEFAULT_CLIENT_CFG bands (frontend is
    // the source of truth for thresholds — see frontend/src/utils/constants.js)
    short: parseInt(process.env.DURATION_SHORT_MAX, 10) || 59,
    medium: parseInt(process.env.DURATION_MEDIUM_MAX, 10) || 299,
    falseWakeupThreshold: parseInt(process.env.DURATION_FALSE_WAKEUP, 10) || 120,
  },
  // Single allow-any-origin CORS config (UI and API are separate pods, so the
  // browser needs CORS; there's no auth for an origin allowlist to protect).
  // origin:true reflects the caller's origin — required because credentials
  // can't be combined with '*'. X-Settings-Key is a custom header, so it must be
  // whitelisted or the browser's preflight rejects PUT/DELETE /settings.
  cors: {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'X-Settings-Key']
  },
  shifts: {
    dayStart: parseInt(process.env.SHIFT_DAY_START, 10) || 8,
    dayEnd: parseInt(process.env.SHIFT_DAY_END, 10) || 22,
    nightStart: parseInt(process.env.SHIFT_NIGHT_START, 10) || 22,
    nightEnd: parseInt(process.env.SHIFT_NIGHT_END, 10) || 8,
  },
  server: {
    port: 8080,
    host: '0.0.0.0',
  },
  limits: {
    defaultCap: parseInt(process.env.QUERY_DEFAULT_CAP, 10) || 100000,
    maxPageSize: parseInt(process.env.QUERY_MAX_PAGE_SIZE, 10) || 1000,
    maxDateRangeDays: 365, // hard cap on a query's scanned window (enforced in AlertService._buildWhereClause)
    queryTimeout: parseInt(process.env.SQL_QUERY_TIMEOUT_MS, 10) || 30000
  },
  clustering: {
    enabledByDefault: process.env.CLUSTER_ENABLED_DEFAULT !== 'false',
    defaultThreshold: parseInt(process.env.CLUSTER_THRESHOLD_MINUTES, 10) || 15
  },
  // --- ServiceNow Configuration ---
  snow: {
    url: process.env.SERVICENOW_URL,
    username: process.env.SERVICENOW_USERNAME,
    password: process.env.SERVICENOW_PASSWORD,
    enabled: Boolean(process.env.SERVICENOW_URL)
  },
  metrics: {
    cacheKey: 'metrics:snow_incidents',
    cacheTTL: parseInt(process.env.METRICS_CACHE_TTL, 10) || 60000 // 60 seconds
  }
});

// SQL Server Configuration
const dbConfig = {
  server: process.env.SQL_SERVER,
  port: parseInt(process.env.SQL_PORT, 10) || 1433,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: process.env.SQL_ENCRYPT === 'true' || false,
    trustServerCertificate: true,
    connectTimeout: 30000,
    requestTimeout: 60000
  },
  pool: {
    max: parseInt(process.env.SQL_POOL_MAX, 10) || 10,
    min: parseInt(process.env.SQL_POOL_MIN, 10) || 2,
    idleTimeoutMillis: 30000
  }
};

// Mongo Configuration
const encode = encodeURIComponent;
const mongoUser = process.env.MONGO_USER;
const mongoPassword = process.env.MONGO_PASSWORD;
const mongoHost = process.env.MONGO_HOST;
const mongoDb = process.env.MONGO_DB;
// The replicaSet name must match the cluster's setName EXACTLY or the driver
// refuses to connect (startup fails). Overridable via env; the default is the
// known-good cluster name used before the recent refactor.
const mongoReplicaSet = process.env.MONGO_REPLICA_SET || 'mgk-grafana2sn-znp';
const mongoConfig = {
  uri: mongoHost.includes('localhost')
    ? `mongodb://${encode(mongoUser)}:${encode(mongoPassword)}@${mongoHost}/${mongoDb}?authSource=admin`
    : `mongodb://${encode(mongoUser)}:${encode(mongoPassword)}@${mongoHost}/${mongoDb}?authMechanism=SCRAM-SHA-1&tls=true&tlsAllowInvalidCertificates=true&replicaSet=${mongoReplicaSet}`,
  database: process.env.MONGO_DB,
  collections: {
    systemMappings: 'system_mappings_new',
    incidentRules: 'incident_rules_new',
    assignmentGroups: 'assignment_groups',
    incidentSettings: 'incident_settings'
  }
};

module.exports = {
  CONFIG,
  dbConfig,
  mongoConfig
};