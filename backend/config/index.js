// config/index.js
require('dotenv').config();

const CONFIG = Object.freeze({
  cache: {
    maxEntries: 1000,
    enabled: true,
  },

  duration: {
    short: 30,
    medium: 300,
    falseWakeupThreshold: 120,
  },

  cors: {
    restricted: {
      origin: process.env.NODE_ENV === 'production'
        ? [...(process.env.ALLOWED_ORIGINS || '').split(','), process.env.FRONTEND_URL].filter(Boolean)
        : true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    },
    public: {
      origin: true, // Allow any origin to connect (needed for external incident creation)
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }
  },

  shifts: {
    dayStart: 8,
    dayEnd: 22,
    nightStart: 22,
    nightEnd: 8,
  },

  tz: {
    IL_WIN: 'Israel Standard Time',
    IANA: 'Asia/Jerusalem'
  },

  server: {
    port: 5000,
    host: '0.0.0.0',
  },

  limits: {
    defaultCap: 100000,
    maxPageSize: 1000,
    maxDateRangeDays: 100000,
  },

  auth: {
    // Centralized list of groups that have Admin access
    adminGroups: ['Admins', 'Administrators', 'Domain Admins'],
    // Default groups for development mode
    devGroups: ['Admins']
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
    requestTimeout: 30000
  },
  pool: {
    max: process.env.SQL_POOL_MAX || 10,
    min: process.env.SQL_POOL_MIN || 2,
    idleTimeoutMillis: 30000
  }
};

// MongoDB Configuration
// MongoDB Configuration
const mongoConfig = {
  // If MONGO_URI is provided, use it. Otherwise construct from parts (all must be present)
  uri: process.env.MONGO_URI ||
    `mongodb://${encode(process.env.MONGO_USER)}:${encode(process.env.MONGO_PASSWORD)}@${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${process.env.MONGO_DB}?authSource=${process.env.MONGO_AUTH_DB || process.env.MONGO_DB}`,
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
