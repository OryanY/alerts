
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { ensureCacheIndex } = require('./utils/cache.js');

// Import configuration and database connections
const { CONFIG } = require('./config');
const { initializeSqlDatabase, initializeMongoDatabase, closeConnections } = require('./database/connection');

const alertRoutes = require('./routes/alertRoutes');
const incidentRoutes = require('./routes/incidentRoutes');
const metricsRoutes = require('./routes/metrics');
const authRoutes = require('./routes/authRoutes');
// No external error handler needed

// Import utilities
const { validateEnvironmentVariables } = require('./config/validateEnv');
const { queryLogger } = require('./middleware/queryLogger');
const { logger } = require('./utils/logger');

const log = logger.tagged('server');

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

// CORS — one allow-any-origin config for every route. The UI and API run as
// separate pods (different origins), so the browser needs these headers to read
// API responses; CORS is browser-only and never gates Postman/curl/server
// clients. origin:true + credentials:true is required for the auth-session
// cookie (see middleware/adAuth.js) to be readable cross-origin.
app.use(cors(CONFIG.cors));

// Compression and parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());


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

// API Routes (CORS applied globally above)
app.use('/from-grafana', incidentRoutes);
app.use('/api', alertRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/auth', authRoutes);

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
    log.error(`${req.method} ${req.path}`, { message: err.message, stack: err.stack });
  } else {
    log.warn(`${req.method} ${req.path}`, err.message);
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
    log.info('Starting Alert Management API...');
    await initializeSqlDatabase();
    await initializeMongoDatabase();
    await ensureCacheIndex();
    log.info('Databases initialized');

    // Pre-warm ServiceNow data cache in the background
    log.info('Pre-warming ServiceNow reference caches...');
    incidentRoutes.incidentService.getAssignmentGroups().catch(e => log.error('failed to pre-cache groups', e.message));
    incidentRoutes.incidentService.getServiceOfferings().catch(e => log.error('failed to pre-cache offerings', e.message));
    incidentRoutes.incidentService.getBusinessServices().catch(e => log.error('failed to pre-cache business services', e.message));
    incidentRoutes.incidentService.getNetworks().catch(e => log.error('failed to pre-cache networks', e.message));
    incidentRoutes.incidentService.getServiceRelationships().catch(e => log.error('failed to pre-cache service relationships', e.message));

    server = app.listen(PORT, () => {
      log.info(`Server started on port ${PORT} (log level: ${logger.level})`);
    });
  } catch (error) {
    log.error('failed to start server', error.message);
    process.exit(1);
  }
}

async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log.info('Shutting down server...');
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