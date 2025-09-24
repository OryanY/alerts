// server.js - Main server with modularized structure and improved error handling
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { DateTime } = require('luxon');

// Import configuration and database connections
const { CONFIG } = require('./config');
const { initializeSqlDatabase, initializeMongoDatabase, closeConnections } = require('./database/connection');

// Import route modules
const alertRoutes = require('./routes/alertRoutes');
const incidentRoutes = require('./routes/incidentRoutes');

// Import middleware
const { globalErrorHandler } = require('./middleware/errorHandler');

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
app.use(cors(CONFIG?.cors || {
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.ALLOWED_ORIGINS?.split(',') || false
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression and parsing
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ================== API ROUTES ==================

// Health check endpoint (before other routes for quick response)
app.get('/api/health', async (req, res) => {
  try {
    // Test both SQL and MongoDB connections
    const { getSqlPool, getMongoDb } = require('./database/connection');
    
    // Quick connection tests
    const sqlPromise = getSqlPool().request().query('SELECT 1 as test');
    const mongoPromise = getMongoDb().admin().ping();
    
    // Set timeout for health checks
    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Health check timeout')), 5000)
    );
    
    await Promise.race([
      Promise.all([sqlPromise, mongoPromise]),
      timeout
    ]);
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: Math.floor(process.uptime()),
        timezone: CONFIG?.tz?.IANA || 'Asia/Jerusalem',
        version: '4.0.0-modular-with-incidents',
        databases: {
          sql: 'connected',
          mongodb: 'connected'
        },
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB',
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + 'MB'
        }
      },
      meta: { 
        timezone: CONFIG?.tz?.IANA || 'Asia/Jerusalem',
        cached: false,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Health check failed:', error.message);
    res.status(503).json({ 
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Service unhealthy',
        status: 503,
        timestamp: new Date().toISOString(),
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      data: { 
        status: 'unhealthy',
        databases: {
          sql: 'error',
          mongodb: 'error'
        }
      }, 
      meta: { 
        timezone: CONFIG?.tz?.IANA || 'Asia/Jerusalem',
        cached: false,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Configuration endpoint
app.get('/api/config', (req, res) => {
  try {
    res.json({
      success: true,
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
          ttl: CONFIG?.cache?.ttl || 300,
          enabled: CONFIG?.cache?.enabled !== false
        },
        version: '4.0.0-modular-with-incidents',
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

// Main API routes
app.use('/api', alertRoutes);
app.use('/api/incidents', incidentRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      message: 'Alert Management API',
      version: '4.0.0-modular-with-incidents',
      endpoints: {
        health: '/api/health',
        config: '/api/config',
        alerts: '/api/alerts',
        statistics: '/api/stats/*',
        incidents: '/api/incidents/*'
      },
      documentation: {
        alerts: 'GET /api/alerts - List alerts with filtering',
        recent: 'GET /api/stats/recent-alerts - Recent alerts',
        kpis: 'GET /api/stats/executive-kpis - Executive KPIs',
        incident_creation: 'GET /api/incidents/alert - Create incident from alert',
        system_mappings: 'GET /api/incidents/system-mappings - Manage system mappings',
        incident_rules: 'GET /api/incidents/incident-rules - Manage incident rules'
      }
    },
    meta: {
      timezone: CONFIG?.tz?.IANA || 'Asia/Jerusalem',
      timestamp: new Date().toISOString()
    }
  });
});

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
          '/api/health',
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
app.use(globalErrorHandler || ((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  // Don't expose internal errors in production
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(error.status || 500).json({ 
    success: false,
    error: {
      code: error.code || 'INTERNAL_ERROR',
      message: isDev ? error.message : 'Internal server error',
      status: error.status || 500,
      timestamp: new Date().toISOString(),
      ...(isDev && { stack: error.stack, details: error.details })
    }
  });
}));

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
      console.log(`├── Health: http://localhost:${PORT}/api/health`);
      console.log(`├── Config: http://localhost:${PORT}/api/config`);
      console.log(`├── Alerts: http://localhost:${PORT}/api/alerts`);
      console.log(`├── Stats: http://localhost:${PORT}/api/stats/*`);
      console.log(`└── Incidents: http://localhost:${PORT}/api/incidents/*`);
      console.log('');
      console.log('Configuration:');
      console.log(`├── Shifts: ${JSON.stringify(CONFIG?.shifts || 'default')}`);
      console.log(`├── Duration thresholds: ${JSON.stringify(CONFIG?.duration || 'default')}`);
      console.log(`├── Cache TTL: ${CONFIG?.cache?.ttl || 300}s`);
      console.log(`└── CORS: ${process.env.NODE_ENV === 'production' ? 'Restricted' : 'Development (Allow All)'}`);
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