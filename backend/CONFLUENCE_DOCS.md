# Backend Technical Documentation

## 📚 Overview
This document provides a detailed technical reference for the Alerts Analytics Backend. It is intended for developers and maintainers.

---

## 🏗 Services Layer (`backend/services/`)

The application uses a **Layered Architecture**. The `services` layer holds the business logic.

### 🚨 Alert Domain (`services/alert/`)

#### `AlertService.js`
**Role**: Orchestration Layer.
**Responsibility**:
- Validates and prepares parameters strings into typed configuration objects.
- Decides whether to use "clustering" or raw SQL queries.
- Calls `AlertQueryService` to get data.
- Calls `AlertAnalysisService` to process data.
- Calls `AlertTransformService` to format responses.

| Function | Description |
| :--- | :--- |
| `getAlerts(params)` | Main search endpoint. Handles fetching, pagination formatting, and applying legacy clustering if requested. |
| `getExecutiveKPIs(params)` | Calculates Dashboard KPIs (Total, Noise, Trends). *Crucial*: Fetches current AND previous period data to calculate trends (Total Trend vs False Alert Rate Trend). |
| `getDurationHistogram(params)` | Fetches distribution of alerts by duration (Short/Medium/Long). |
| `getHourlyHeatmap(params)` | Returns alert counts grid by Hour of Day. |
| `getShiftAnalysis(params)` | Compares Day vs Night shifts (Alert Counts, True vs False). |
| `getPanelList(params)` | Returns list of panels with their specific stats. *Logic*: Supports in-memory clustering to calculate "False Positives" per panel more accurately than SQL alone. |
| `getTopApplications(params)` | Returns top apps by alert volume. |

#### `AlertQueryService.js`
**Role**: Data Access Layer (DAO).
**Responsibility**: Builds and executes SQL queries. **No business logic allowed.**

| Function | Description |
| :--- | :--- |
| `fetchAlerts(params)` | Executes `SELECT_ALERTS` with dynamic filters. |
| `fetchBasicRecords(params, fields)` | optimized fetch for analysis. Only selects columns needed for in-memory processing (e.g. `time_fired`, `duration_sec`). |
| `fetchHourlyHeatmap(params)` | Executes SQL CTE for hourly aggregation. |
| `fetchShiftAnalysis(params)` | Aggregates data by Day/Night shift in SQL. |

#### `AlertAnalysisService.js`
**Role**: Domain Logic & Pure Calculation.
**Responsibility**: In-memory processing, clustering algorithms, and statistical math.

| Function | Description |
| :--- | :--- |
| `clusterAlerts(records, enabled, threshold)` | **Smart Clustering Algorithm**. Groups alerts occurring within `threshold` minutes into a single "Incident" to reduce noise. |
| `computeKPIs(records, thresholds)` | Iterates through records to count: Total, Noise, Night Alerts, True Wakeups, False Wakeups, and calculates 24/7 False Positive Rate. |
| `calculateTrend(current, previous)` | (Internal helper) Standard percentage change formula. |

### 🛠 Utilities & Middleware (`backend/utils/`, `backend/middleware/`)

#### `routeHandler.js` (Middleware)
**Role**: DRY Route Factory.
**Responsibility**: Creates consistent route handlers that combine:
1. Joi Validation
2. Cache Check (Get)
3. Service Call
4. Cache Set
5. Error Handling

#### `SqlTemplates.js`
**Role**: Security & Query Store.
**Responsibility**:
- Stores all SQL queries as named constants (`SELECT_ALERTS`, `SHIFT_ANALYSIS`).
- `SqlBuilder` class: safely replaces placeholders (`{WHERE_CLAUSE}`) to prevent injection and ensure valid SQL.

#### `ResponseFormatter.js`
**Role**: API Consistency.
**Responsibility**: Standardizes all API responses.
- `success(data, pagination)`: Returns `{ status: 'success', data, pagination }`.
- `error(code, message)`: Returns `{ status: 'error', error: { code, message } }`.

#### `TimeUtils.js`
**Role**: Timezone Management.
**Responsibility**: Handling the specific "Israeli Time" requirements for the dashboard.
- `getILHour(date)`: Converts UTC date to Israel Hour (0-23).
- `isNightHour(hour)`: Determines if an hour is within the user-configured Night Shift.

---

## 📡 API Routes (`backend/routes/`)

#### `alertRoutes.js`
- `GET /` -> `AlertController.getAlerts`
- `GET /filters` -> Returns available filter values (Panels, Operators).

#### `statsRoutes.js`
- `GET /executive-kpis` -> Dashboard Header metrics.
- `GET /duration-histogram` -> Distribution chart.
- `GET /hourly-heatmap` -> Heatmap chart.
- `GET /shift-analysis` -> Morning vs Night chart.
- `GET /panels` -> Panel Research list.

---

## 🗃 Database (`backend/database/`)

#### `connection.js`
- Manages the specific `mssql` connection pool.
- Reads headers from `process.env`.
- Exports `getSqlPool()` for singleton usage.
