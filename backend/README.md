# Alerts Analytics Backend

This is the backend service for the Alerts Analytics Dashboard. It provides APIs for retrieving, filtering, and analyzing alert data from the SQL Server database.

## 📂 Directory Structure

```
backend/
├── config/             # Configuration files (DB, limits, etc.)
├── database/           # Database connection and pool management
├── middleware/         # Express Middleware (Auth, Error Handling, Route Factory)
├── routes/             # API Routes (Express routers)
├── services/           # Business Logic Layer
│   ├── alert/          # Alert-specific services (Core Logic)
│   └── incident/       # Incident-specific services
├── utils/              # Shared utilities (Formatting, SQL Builders, Time)
└── server.js           # Entry point
```

## 🚀 Getting Started

### Prerequisites
- Node.js (v14+)
- SQL Server Instance
- Properly configured `.env` file (see below)

### Installation
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Server
- **Development Mode** (with Nodemon):
  ```bash
  npm run dev
  ```
- **Production Mode**:
  ```bash
  npm start
  ```
- **Port**: Defaults to `5000`

## 🛠 Key Services

### Alert Service (`services/alert/`)
The core logic is refactored into specialized services for better maintainability:

- **`AlertService.js`**: The orchestrator. It handles client requests, parameter grouping, and coordinates between data fetching and analysis. It is the main entry point for the controller.
- **`AlertQueryService.js`**: Pure Data Access Layer. Responsible **only** for executing SQL queries. It contains no business logic.
- **`AlertAnalysisService.js`**: Pure Business Logic. Responsible for "Smart Clustering", KPI calculation, and trend analysis in memory.
- **`AlertTransformService.js`**: formats data for the frontend (API response shaping).

## 📊 API Endpoints

The API is exposed via `server.js` and defined in `routes/`.
Key prefixes:
- `/api/alerts` - Raw alert search and retrieval
- `/api/stats` - Statistical analysis, KPIs, and graphs
- `/api/incidents` - Incident management (ServiceNow integration)

## 🗄 Database

The application connects to a MSSQL database defined in `config/db.js`.
The primary table queried is `dbo.historicalAlerts`.
