// config/index.js
require('dotenv').config();

const CONFIG = {
  cache: { ttl: 300, maxEntries: 1000 },
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
  },
  shifts: { dayStart: 8, dayEnd: 22, nightStart: 22, nightEnd: 8 },
  tz: { IL_WIN: 'Israel Standard Time', IANA: 'Asia/Jerusalem' },
  server: {
    port: process.env.PORT || 5000,
  }
};
const encode = encodeURIComponent; // כדי להגן אם בעתיד יהיו תווים מיוחדים בסיסמה

// SQL
const dbConfig = {
  server: process.env.SQL_SERVER,
  database: process.env.SQL_DATABASE,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  options: {
    encrypt: process.env.SQL_ENCRYPT === 'true', 
    trustServerCertificate: true
  }
};

// Mongo
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
    systemMappings: 'system_mappings',
    incidentRules: 'incident_rules',
    requiredFields: 'service_offering_required_fields'
  }
};

module.exports = {
  CONFIG,
  dbConfig,
  mongoConfig
};
