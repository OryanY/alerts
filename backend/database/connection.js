// database/connection.js
const sql = require('mssql');
const { MongoClient } = require('mongodb');
const { dbConfig, mongoConfig } = require('../config');
const { logger } = require('../utils/logger');

const log = logger.tagged('db');

let sqlPool;
let mongoClient;
let mongoDb;

// Initialize SQL Server connection
async function initializeSqlDatabase() {
  try {
    sqlPool = await new sql.ConnectionPool(dbConfig).connect();
    // Test connection with record count
    const result = await sqlPool.request().query(
      `SELECT COUNT(*) as total_records FROM dbo.historicalAlerts`
    );
    log.info(`SQL connected — ${result.recordset[0].total_records} historical alerts`);

    return sqlPool;
  } catch (err) {
    log.error('failed to connect to SQL Server', err.message);
    process.exit(1);
  }
}

// Initialize MongoDB connection
async function initializeMongoDatabase() {
  try {
    mongoClient = new MongoClient(mongoConfig.uri);
    await mongoClient.connect();
    mongoDb = mongoClient.db(mongoConfig.database);

    // Test connection by counting system mappings
    const count = await mongoDb
      .collection(mongoConfig.collections.systemMappings)
      .countDocuments();
    log.info(`MongoDB connected — ${count} system mapping documents`);

    return mongoDb;
  } catch (err) {
    log.error('failed to connect to MongoDB', err.message);
    process.exit(1);
  }
}

// Get SQL pool instance
function getSqlPool() {
  if (!sqlPool) {
    throw new Error('SQL pool not initialized. Call initializeSqlDatabase first.');
  }
  return sqlPool;
}

// Get MongoDB instance
function getMongoDb() {
  if (!mongoDb) {
    throw new Error('MongoDB not initialized. Call initializeMongoDatabase first.');
  }
  return mongoDb;
}

// Close all connections
async function closeConnections() {
  const promises = [];

  if (sqlPool) {
    promises.push(
      sqlPool.close().then(() => log.info('SQL Server connection closed'))
    );
  }

  if (mongoClient) {
    promises.push(
      mongoClient.close().then(() => log.info('MongoDB connection closed'))
    );
  }

  await Promise.all(promises);
}

module.exports = {
  initializeSqlDatabase,
  initializeMongoDatabase,
  getSqlPool,
  getMongoDb,
  closeConnections,
};
