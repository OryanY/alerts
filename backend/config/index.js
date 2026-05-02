// config/index.js
require('dotenv').config();

const CONFIG = Object.freeze({
  cache: {
    maxEntries: 1000,
    enabled: true,
  },

  duration: {
    short: parseInt(process.env.DURATION_SHORT_MAX, 10) || 30,
    medium: parseInt(process.env.DURATION_MEDIUM_MAX, 10) || 300,
    falseWakeupThreshold: parseInt(process.env.DURATION_FALSE_WAKEUP, 10) || 120,
  },

  cors: {
    restricted: {
      origin: process.env.NODE_ENV === 'production'
        ? (process.env.ALLOWED_ORIGINS
          ? [...process.env.ALLOWED_ORIGINS.split(','), process.env.FRONTEND_URL].filter(Boolean)
          : [process.env.FRONTEND_URL]) // Fallback to just Frontend URL if no extra origins list
        : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control']
    },
    public: {
      origin: true, // Allow any origin to connect (needed for external incident creation)
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control']
    }
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
    maxDateRangeDays: parseInt(process.env.QUERY_MAX_DATE_RANGE_DAYS, 10) || 100000, // Legacy value, consider lowering
    queryTimeout: parseInt(process.env.SQL_QUERY_TIMEOUT_MS, 10) || 30000
  },

  clustering: {
    enabledByDefault: process.env.CLUSTER_ENABLED_DEFAULT !== 'false', // Default to true
    defaultThreshold: parseInt(process.env.CLUSTER_THRESHOLD_MINUTES, 10) || 15
  }
});

const encode = encodeURIComponent;

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
    max: process.env.SQL_POOL_MAX || 10,
    min: process.env.SQL_POOL_MIN || 2,
    idleTimeoutMillis: 30000
  }
};


// Mongo
const mongoUser = process.env.MONGO_USER;
const mongoPassword = process.env.MONGO_PASSWORD;
const mongoHost = process.env.MONGO_HOST;
const mongoDb = process.env.MONGO_DB;
const mongoConfig = {
  uri: mongoHost.includes('localhost') ? `mongodb://${encode(mongoUser)}:${encode(mongoPassword)}@${mongoHost}/${mongoDb}?authSource=admin` : `mongodb://${encode(mongoUser)}:${encode(mongoPassword)}@${mongoHost}/${mongoDb}?authMechanism=SCRAM-SHA-1&tls=true&tlsAllowInvalidCertificates=true&replicaSet=mgk-grafana2sn-znp`,
  database: process.env.MONGO_DB,
  collections: {
    systemMappings: 'system_mappings_new',
    incidentRules: 'incident_rules_new',
    assignmentGroups: 'assignment_groups',
    incidentLogs: 'incident_logs'

  }
};
module.exports = {
  CONFIG,
  dbConfig,
  mongoConfig
};
