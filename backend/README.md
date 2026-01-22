# Alert Management Backend

A production-ready Node.js/Express backend for managing Grafana alerts and creating ServiceNow incidents.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your values
# ...

# Start development server
npm run dev

# Start production server
npm start
```

## 📁 Project Structure

```
backend/
├── controllers/          # HTTP request handlers
│   ├── AlertController.js
│   ├── IncidentController.js
│   └── StatsController.js
├── routes/               # Route definitions (path mapping only)
│   ├── alertRoutes.js
│   ├── incidentRoutes.js
│   ├── statsRoutes.js
│   └── healthRoutes.js
├── services/             # Business logic
│   ├── alert/
│   │   └── AlertService.js
│   └── incident/
│       ├── IncidentService.js
│       ├── IncidentQueryService.js
│       ├── ServiceNowClient.js
│       └── ...
├── middleware/           # Express middleware
│   ├── errorHandler.js
│   ├── validation.js
│   └── requestId.js
├── utils/                # Utilities
│   ├── constants.js      # Centralized constants
│   ├── errors.js         # Custom error classes
│   ├── response.js       # API response helpers
│   └── validateEnv.js    # Environment validation
├── config/               # Configuration
├── database/             # Database connections
├── schemas/              # Joi validation schemas
└── server.js             # Application entry point
```

## 🔑 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SQL_SERVER` | ✅ | SQL Server hostname |
| `SQL_DATABASE` | ✅ | Database name |
| `SQL_USER` | ✅ | Database username |
| `SQL_PASSWORD` | ✅ | Database password |
| `MONGO_URI` | ✅ | MongoDB connection string |
| `SERVICENOW_URL` | ⚠️ | ServiceNow instance URL |
| `SERVICENOW_USERNAME` | ⚠️ | ServiceNow API username |
| `SERVICENOW_PASSWORD` | ⚠️ | ServiceNow API password |

## 📡 API Endpoints

### Health Checks
- `GET /api/health` - Basic health check
- `GET /api/health/ready` - Readiness check (DB connections)
- `GET /api/health/live` - Liveness check (process info)

### Alerts
- `GET /api/alerts` - List alerts with filtering

### Statistics
- `GET /api/stats/executive-kpis` - Executive KPIs
- `GET /api/stats/overview` - Overview statistics
- `GET /api/stats/*` - Various statistics endpoints

### Incidents
- `GET /api/incidents/incident` - Create incident (GET for webhooks)
- `POST /api/incidents/incident` - Create incident
- `POST /api/incidents/incident/simulate` - Simulate without creating
- `GET /api/incidents/incident-logs` - Incident history

### Configuration
- `GET /api/incidents/system-mappings` - CRUD for system mappings
- `GET /api/incidents/incident-rules` - CRUD for incident rules

## 📝 Architecture Principles

1. **Controller-Service Pattern**: Routes delegate to controllers, controllers orchestrate services
2. **Dependency Injection**: Services receive dependencies via constructors
3. **Custom Errors**: Use `NotFoundError`, `ValidationError`, etc. from `utils/errors.js`
4. **Consistent Responses**: Use helpers from `utils/response.js`
5. **No Magic Strings**: Use constants from `utils/constants.js`
