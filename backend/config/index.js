// config/index.js
require('dotenv').config();

const CONFIG = Object.freeze({
  cache: {
    ttl: 300,
    maxEntries: 1000,
    enabled: true,
  },
  
  duration: {
    short: 30,
    medium: 300,
    falseWakeupThreshold: 120,
  },
  
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean)
      : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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
  }
});

const encode = encodeURIComponent;

// SQL Server Configuration
const dbConfig = {
  server: process.env.SQL_SERVER || 'localhost', 
  database: process.env.SQL_DATABASE || 'your_database_name', 
  user: process.env.SQL_USER || 'your_user', 
  password: process.env.SQL_PASSWORD || 'your_password', 
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
const mongoUser = process.env.MONGO_USER || 'grafana2sn'; 
const mongoPassword = process.env.MONGO_PASSWORD || 'YOUR_STRONG_PASSWORD'; 
const mongoHost = process.env.MONGO_HOST || 'localhost'; 
const mongoPort = process.env.MONGO_PORT || '27017'; 
const mongoDb = process.env.MONGO_DB || 'grafana_snow_dev'; 
const mongoAuthDb = process.env.MONGO_AUTH_DB || mongoDb; 

const mongoConfig = {
  uri: `mongodb://${encode(mongoUser)}:${encode(mongoPassword)}@${mongoHost}:${mongoPort}/${mongoDb}?authSource=${mongoAuthDb}`,
  database: mongoDb,
  collections: {
    systemMappings: 'system_mappings_new',
    incidentRules: 'incident_rules_new',
  }
};

// Validate shift configuration
if (CONFIG.shifts.dayStart >= CONFIG.shifts.dayEnd) {
  throw new Error('DAY_START must be less than DAY_END');
}

if (CONFIG.duration.short >= CONFIG.duration.medium) {
  throw new Error('DUR_SHORT_MAX must be less than DUR_MEDIUM_MAX');
}

module.exports = {
  CONFIG,
  dbConfig,
  mongoConfig
};
