// server.js — Main server with modularized structure
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { DateTime } = require('luxon');

// Import modules
const { CONFIG } = require('./config');
const { initializeSqlDatabase, initializeMongoDatabase, closeConnections } = require('./database/connection');
const incidentRoutes = require('./routes/incidentRoutes');

// Import existing alert routes (you can split these too later)
const alertRoutes = require('./routes/alertRoutes'); // We'll create this next

// App setup
const app = express();
const PORT = CONFIG.server.port;

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(CONFIG.cors));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${res.statusCode} - ${ms}ms`);
  });
  next();
});

// Routes
app.use('/api/incidents', incidentRoutes);
app.use('/api', alertRoutes);

// Config endpoint
app.get('/api/config', (req, res) => {
  res.json({
    data: {
      shifts: CONFIG.shifts,
      duration: CONFIG.duration,
      timezone: CONFIG.tz,
      cache: { ttl: CONFIG.cache.ttl },
      version: '4.0.0-modular-with-incidents'
    },
    meta: { timezone: CONFIG.tz.IANA, cached: false }
  });
});

// Health endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test both SQL and MongoDB connections
    const { getSqlPool, getMongoDb } = require('./database/connection');
    
    await getSqlPool().request().query('SELECT 1');
    await getMongoDb().admin().ping();
    
    res.json({
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        timezone: CONFIG.tz.IANA,
        databases: {
          sql: 'connected',
          mongodb: 'connected'
        }
      },
      meta: { timezone: CONFIG.tz.IANA }
    });
  } catch (error) {
    res.status(503).json({ 
      data: { 
        status: 'unhealthy', 
        error: error.message,
        databases: {
          sql: 'error',
          mongodb: 'error'
        }
      }, 
      meta: { timezone: CONFIG.tz.IANA } 
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found', 
    path: req.path, 
    method: req.method 
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error', 
    ...(process.env.NODE_ENV === 'development' && { details: error.message }) 
  });
});

// Server lifecycle
let server;

async function startServer() {
  try {
    // Initialize databases
    await initializeSqlDatabase();
    await initializeMongoDatabase();
    
    // Start HTTP server
    server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`API at http://localhost:${PORT}/api/`);
      console.log(`Incident Management at http://localhost:${PORT}/api/incidents/`);
      console.log(`Shifts (defaults): ${JSON.stringify(CONFIG.shifts)}`);
      console.log(`Timezone: ${CONFIG.tz.IANA} (DB stored in UTC)`);
      console.log(`CORS: ${process.env.NODE_ENV === 'production' ? 'Restricted' : 'Development (Allow All)'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function shutdown(signal = 'SIGINT') {
  console.log(`\nShutting down server gracefully (${signal})...`);
  
  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log('HTTP server closed');
    }
    
    await closeConnections();
    console.log('Server shutdown complete');
    process.exit(0);
  } catch (e) {
    console.error('Error during shutdown:', e);
    process.exit(1);
  }
}

// Process handlers
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  shutdown('uncaughtException');
});

// Start server
startServer().catch(console.error);