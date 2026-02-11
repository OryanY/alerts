// server.js - Main server with modularized structure and improved error handling
require('dotenv').config();  // Load .env file FIRST

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const swaggerUi = require('swagger-ui-express');
const { DateTime } = require('luxon');


// Import configuration and database connections
const { CONFIG } = require('./config');
const { swaggerSpec } = require('./config/swagger');
const { initializeSqlDatabase, initializeMongoDatabase, closeConnections } = require('./database/connection');

// Import route modules
const alertRoutes = require('./routes/alertRoutes');
const statsRoutes = require('./routes/statsRoutes');
const incidentRoutes = require('./routes/incidentRoutes');
const authRoutes = require('./routes/authRoutes');

// Import middleware
const { errorMiddleware, setupGlobalErrorHandlers } = require('./middleware/errorHandler');

// Import utilities
const { validateEnvironmentVariables } = require('./utils/validateEnv');

// Setup global handlers
setupGlobalErrorHandlers();

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
const restrictedCors = cors(CONFIG.cors.restricted);
const publicCors = cors(CONFIG.cors.public);

// Apply public CORS to health check by default (or restricted? Health usually open for load balancers)
app.use('/api/health', publicCors);

// Compression and parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


// Request Logger
app.use((req, res, next) => {
  const start = Date.now();
  const { method, originalUrl } = req;

  const isDev = process.env.NODE_ENV === 'development';

  if (isDev) {
    console.log(`[REQ] ${method} ${originalUrl}`);
  }

  // Hook into response finish to log duration
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;

    // Check if this is part of the NTLM handshake (401 with WWW-Authenticate)
    const isHandshake = statusCode === 401 && res.getHeader('WWW-Authenticate');

    // LOGGING STRATEGY:
    // Dev: Log everything
    // Prod: Log ONLY errors

    const isError = statusCode >= 400;
    const shouldLog = isDev ? !isHandshake : (isError && !isHandshake);

    if (shouldLog) {
      const statusLabel = isHandshake ? '401 (Auth Handshake)' : statusCode; // Should rarely see this label now due to logic above
      // Use console.error for actual errors to make them stand out
      const logFn = isError ? console.error : console.log;
      logFn(`[RES] ${method} ${originalUrl} ${statusLabel} (${duration}ms)`);
    }
  });

  next();
});

// ================== API ROUTES ==================

// Configuration endpoint (Restricted)
app.get('/api/config', restrictedCors, (req, res) => {
  try {
    res.json({
      success: true,
      // ... (lines omitted for brevity, logic remains same, just modifying the app.get line)

      data: {
        shifts: CONFIG?.shifts || {
          day: { start: 8, end: 22 },
          night: { start: 22, end: 8 }
        },
        duration: CONFIG?.duration || {
          short_max: 30,
          medium_max: 300
        },
        timezone: CONFIG?.tz || { IANA: 'Asia/Jerusalem' },
        cache: {
          enabled: CONFIG?.cache?.enabled !== false
        },
        version: '4.0.0',
        features: ['alerts', 'statistics', 'incidents', 'system_mappings', 'incident_rules']
      },
      meta: {
        timezone: CONFIG?.tz?.IANA || 'Asia/Jerusalem',
        cached: false,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Config endpoint error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONFIG_ERROR',
        message: 'Failed to load configuration',
        status: 500,
        timestamp: new Date().toISOString()
      }
    });
  }
});

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
app.use('/api/auth', restrictedCors, authRoutes);
app.use('/api/alerts', restrictedCors, alertRoutes);
app.use('/api/stats', restrictedCors, statsRoutes);
app.use('/api/incidents', publicCors, incidentRoutes);

// Swagger UI at root
app.use('/', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Alert Management API'
}));

// ================== ERROR HANDLING ==================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      status: 404,
      timestamp: new Date().toISOString(),
      details: {
        path: req.path,
        method: req.method,
        available_endpoints: [
          '/api/config',
          '/api/alerts',
          '/api/stats/*',
          '/api/incidents/*'
        ]
      }
    }
  });
});

// Global error handler
app.use(errorMiddleware);

// ================== SERVER LIFECYCLE ==================

let server;
let isShuttingDown = false;

async function startServer() {
  try {
    console.log('Starting Alert Management API...');

    // Initialize databases with timeout
    console.log('Initializing databases...');

    const dbTimeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database initialization timeout')), 30000)
    );

    await Promise.race([
      Promise.all([
        initializeSqlDatabase(),
        initializeMongoDatabase()
      ]),
      dbTimeout
    ]);

    console.log('✓ Databases initialized successfully');

    // Start HTTP server
    server = app.listen(PORT, () => {
      const startTime = DateTime.now().setZone(CONFIG?.tz?.IANA || 'Asia/Jerusalem');

      console.log('\n🚀 Alert Management API Server Started');
      console.log('==========================================');
      console.log(`Port: ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Started at: ${startTime.toFormat('yyyy-MM-dd HH:mm:ss ZZZZ')}`);
      console.log(`Timezone: ${CONFIG?.tz?.IANA || 'Asia/Jerusalem'} (DB stored in UTC)`);
      console.log('');
      console.log('Available Endpoints:');
      console.log(`├── Config: http://localhost:${PORT}/api/config`);
      console.log(`├── Alerts: http://localhost:${PORT}/api/alerts`);
      console.log(`├── Stats: http://localhost:${PORT}/api/stats/*`);
      console.log(`└── Incidents: http://localhost:${PORT}/api/incidents/*`);
      console.log('');
      console.log('Configuration:');
      console.log(`├── Shifts: ${JSON.stringify(CONFIG?.shifts || 'default')}`);
      console.log(`├── Duration thresholds: ${JSON.stringify(CONFIG?.duration || 'default')}`);
      console.log('==========================================\n');
    });

    // Server error handling
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

async function shutdown(signal = 'SIGINT') {
  if (isShuttingDown) {
    console.log('Already shutting down...');
    return;
  }

  isShuttingDown = true;
  console.log(`\n🔄 Shutting down server gracefully (${signal})...`);

  const shutdownTimeout = setTimeout(() => {
    console.log('❌ Shutdown timeout - forcing exit');
    process.exit(1);
  }, 10000); // 10 second timeout

  try {
    // Stop accepting new requests
    if (server) {
      console.log('├── Closing HTTP server...');
      await new Promise((resolve) => server.close(resolve));
      console.log('├── ✓ HTTP server closed');
    }

    // Close database connections
    console.log('├── Closing database connections...');
    await closeConnections();
    console.log('├── ✓ Database connections closed');

    clearTimeout(shutdownTimeout);
    console.log('└── ✅ Server shutdown complete');
    process.exit(0);

  } catch (error) {
    clearTimeout(shutdownTimeout);
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

// ================== PROCESS HANDLERS ==================

// Graceful shutdown handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Error handlers
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit immediately, but log the error
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  shutdown('uncaughtException');
});

// Handle Windows CTRL+C
if (process.platform === 'win32') {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on('SIGINT', () => {
    process.emit('SIGINT');
  });
}

// ================== START SERVER ==================

// Start server
if (require.main === module) {
  startServer().catch((error) => {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  });
}

module.exports = { app, startServer, shutdown };