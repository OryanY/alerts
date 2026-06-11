
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { ensureCacheIndex } = require('./utils/cache.js');

// Import configuration and database connections
const { CONFIG } = require('./config');
const { initializeSqlDatabase, initializeMongoDatabase, closeConnections } = require('./database/connection');

const alertRoutes = require('./routes/alertRoutes');
const incidentRoutes = require('./routes/incidentRoutes');
const metricsRoutes = require('./routes/metrics');
// No external error handler needed

// Import utilities
const { validateEnvironmentVariables } = require('./config/validateEnv');
const { queryLogger } = require('./middleware/queryLogger');

// Setup global handlers

// Validate environment variables
validateEnvironmentVariables();

// App setup
const app = express();
const PORT = CONFIG?.server?.port || process.env.PORT || 3000;

// ================== SECURITY & PERFORMANCE MIDDLEWARE ==================

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false // Allow for development - configure for production
}));

// CORS configuration
const publicCors = cors(CONFIG.cors.public);

app.use('/api/health', publicCors);

// Compression and parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Query logger: filters internally by env and route (see middleware/queryLogger.js)
app.use(queryLogger);

// ================== API ROUTES ==================

// No /api/config proxy endpoint needed. Frontends should own their own config bounds.

// Health check endpoint (simple, inline)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/from-grafana', publicCors, incidentRoutes);

app.use('/api', publicCors, alertRoutes);
app.use('/api/incidents', publicCors, incidentRoutes);

app.use('/metrics', metricsRoutes);


// ================== ERROR HANDLING ==================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: { message: 'Endpoint not found', path: req.path } });
});

// Global Error handler
app.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const isDev = process.env.NODE_ENV === 'development';
  const status = err.status || 500;

  if (status >= 500) {
    console.error(`[Server Error] ${req.method} ${req.path}`, err);
  } else {
    console.warn(`[Client Error] ${req.method} ${req.path}`, err.message);
  }

  res.status(status).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      code: err.code || 'INTERNAL_ERROR',
      ...(isDev && { stack: err.stack })
    }
  });
});

// ================== SERVER LIFECYCLE ==================

let server;
let isShuttingDown = false;

async function startServer() {
  try {
    //Connect to mongo
    console.log('Starting Alert Management API...');
    await initializeSqlDatabase();
    await initializeMongoDatabase();
    await ensureCacheIndex();
    console.log('Databases initialized.');

    // Pre-warm ServiceNow data cache in the background
    console.log('Pre-warming ServiceNow reference caches...');
    incidentRoutes.incidentService.getAssignmentGroups().catch(e => console.error('Failed to pre-cache groups:', e.message));
    incidentRoutes.incidentService.getServiceOfferings().catch(e => console.error('Failed to pre-cache offerings:', e.message));
    incidentRoutes.incidentService.getBusinessServices().catch(e => console.error('Failed to pre-cache business services:', e.message));
    incidentRoutes.incidentService.getNetworks().catch(e => console.error('Failed to pre-cache networks:', e.message));

    server = app.listen(PORT, () => {
      console.log(`Alert Management API Server Started on Port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('Shutting down server...');
  if (server) await new Promise(resolve => server.close(resolve));
  await closeConnections();
  process.exit(0);
}

// ================== PROCESS HANDLERS ==================

process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());

if (require.main === module) {
  startServer();
}

module.exports = { app, startServer, shutdown };