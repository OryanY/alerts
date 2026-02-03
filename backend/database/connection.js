// database/connection.js
const sql = require('mssql');
const { MongoClient } = require('mongodb');
const { dbConfig, mongoConfig } = require('../config');

let sqlPool;
let mongoClient;
let mongoDb;

// Initialize SQL Server connection
async function initializeSqlDatabase() {
  try {
    sqlPool = await new sql.ConnectionPool(dbConfig).connect();
    console.log('Connected to SQL Server.');

    // Test connection with record count
    const result = await sqlPool.request().query(
      `SELECT COUNT(*) as total_records FROM dbo.historicalAlerts`
    );
    console.log(
      `Database contains ${result.recordset[0].total_records} historical alerts`
    );

    return sqlPool;
  } catch (err) {
    console.error('Failed to connect to SQL Server:', err);
    process.exit(1);
  }
}

// Initialize MongoDB connection
async function initializeMongoDatabase() {
  try {
    mongoClient = new MongoClient(mongoConfig.uri);
    console.log(mongoConfig.uri);
    await mongoClient.connect();
    mongoDb = mongoClient.db(mongoConfig.database);

    console.log('Connected to MongoDB.');

    // Test connection by counting system mappings
    const count = await mongoDb
      .collection(mongoConfig.collections.systemMappings)
      .countDocuments();
    console.log(`MongoDB contains ${count} system mapping documents`);

    return mongoDb;
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
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
      sqlPool.close().then(() => console.log('SQL Server connection closed'))
    );
  }

  if (mongoClient) {
    promises.push(
      mongoClient.close().then(() => console.log('MongoDB connection closed'))
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
