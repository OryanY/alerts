# Alert Management Backend

Node.js/Express backend for the Alert & Incident Management dashboard: serves alert BI statistics from SQL Server and creates ServiceNow incidents from Grafana alerts using MongoDB-stored mappings and rules.

## Quick Start

```bash
npm install

# Copy environment template and fill in real values
cp .env.example .env

# Development (nodemon)
npm run dev

# Production
npm start
```

The server listens on port **8080** (`CONFIG.server.port`).

## Project Structure (actual)

```
backend/
├── config/
│   ├── index.js            # CONFIG object + SQL/Mongo connection configs (reads .env)
│   └── validateEnv.js      # Fail-fast env validation on startup
├── controllers/
│   ├── IncidentController.js  # HTTP handlers for incident/mapping/rule endpoints
│   └── htmlTemplates.js       # HTML error page for webhook (GET) flows
├── database/
│   ├── connection.js       # SQL Server pool + MongoDB client lifecycle
│   └── queries/alertQueries.js  # All T-SQL templates (clustered + unclustered)
├── middleware/
│   ├── validation.js       # Joi validateQuery/validateBody/validateParams
│   └── queryLogger.js      # Request/response logging
├── routes/
│   ├── alertRoutes.js      # /api/alerts + /api/stats/* (handlers inline, logic in AlertService)
│   ├── incidentRoutes.js   # /api/incidents/* + /from-grafana (controller pattern)
│   └── metrics.js          # /metrics — live ServiceNow incident counts for external dashboards
├── schemas/                # Joi schemas (alertSchemas, incidentSchemas)
├── services/
│   ├── alert/AlertService.js        # Alert BI orchestration, WHERE-clause building
│   └── incident/
│       ├── IncidentService.js       # Incident creation + history logs
│       ├── IncidentRuleService.js   # Rule CRUD + matching (Mongo)
│       ├── SystemMappingService.js  # Mapping CRUD + application lookup (Mongo)
│       ├── ServiceNowClient.js      # ServiceNow Table API client (axios)
│       └── incidentHelpers.js       # Pure rule-matching / payload-building functions
├── utils/sharedCache.js    # MongoDB-backed cross-replica cache (cacheGet/cacheSet)
└── server.js               # App wiring, startup, shutdown
```

## Environment Variables

See [.env.example](.env.example) for the full annotated list. Required:
`SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`, `SQL_PASSWORD`, `MONGO_HOST`, `MONGO_DB`, `MONGO_USER`, `MONGO_PASSWORD`, `SERVICENOW_URL`, `SERVICENOW_USERNAME`, `SERVICENOW_PASSWORD`, `NODE_ENV`, `FRONTEND_URL`.

Optional:
- `INCIDENT_SETTINGS_KEY` — team key to edit incident defaults (sent as `X-Settings-Key`).
- `LOG_LEVEL` — `error|warn|info|debug` (default `info` in prod, `debug` in dev).
- `LOG_HTTP_SUCCESS` — log successful HTTP requests? Default `false` in prod, `true` in dev (errors always logged).

## API Surface

### Observability
- All logging goes through `utils/logger.js` (levels gated by `LOG_LEVEL`); never `console.*` directly. HTTP request logging policy (silent paths, success logging, redaction) lives in `REQUEST_LOG_POLICY` in the same file.
- There is **no incident audit log**. To inspect what an alert would produce (mapping, rules, generated payload) without creating a ticket, use `POST /api/incidents/incident/simulate`.

### Health
- `GET /api/health`

### Alerts & BI (`/api`)
- `GET /api/alerts` — paginated alerts (clustered or raw), `GET /api/alerts/export.csv`
- `GET /api/stats/executive-kpis` — KPIs incl. previous-period trends (`total_trend_pct`, `noise_trend_pct`)
- `GET /api/stats/{timeseries|hourly-heatmap|duration-histogram|shift-analysis}`
- `GET /api/stats/{panels|by-panel|panel-analysis|top-applications|top-nodes-by-app|top-objects-by-app|consecutive-days|incident-stats|filter-options}`

All stats endpoints accept the client threshold params (`dur_short_max`, `dur_medium_max`, `false_wakeup_threshold`, `day_start`, `day_end`, `clustering_enabled`, `clustering_threshold`). **The frontend's user-tunable settings are the source of truth for these**; the Joi defaults (59 / 299 / 120 / 8 / 22) only apply to direct API callers and must stay aligned with `frontend/src/utils/constants.js`.

### Incidents (`/api/incidents`, also mounted at `/from-grafana`)
- `GET|POST /incident` — create ServiceNow incident from alert data (GET kept intentionally for Grafana click-through links)
- `POST /incident/simulate` — dry-run rule evaluation
- `GET|POST /alert` — create TIUD alert record
- `GET|POST /incident-with-alert` — combined creation
- CRUD: `/system-mappings`, `/incident-rules` (+ `PATCH /incident-rules/:id/toggle`)
- `GET|PUT|DELETE /settings` — incident field configuration (content templates + default field fillers). Stored in the `incident_settings` Mongo collection, edited from the UI (Incidents → Incident Defaults). Cached with a 30s local cache, invalidated on write, so changes apply within the TTL on every pod and immediately on the writing pod — no restart. **PUT/DELETE require the team key** (`INCIDENT_SETTINGS_KEY` env var, sent as `X-Settings-Key`); reading is open. Required fields, literal fields, and the legacy Grafana application rewrites are code-managed (`services/incident/incidentSettingsDefaults.js`, `incidentHelpers.js`).

### Metrics (`/metrics`)
ServiceNow live incident counts with team/state/tag filters, cached 60s in the shared (Mongo) cache tier. Consumed by external dashboards — treat its query/filter behavior as a frozen contract.

## Architecture Notes

1. **SQL safety invariant:** user values are ALWAYS bound via `request.input()`; query templates only ever interpolate code-controlled fragments (`{WHERE_CLAUSE}`, validated `sort_by`, etc.). Keep it that way.
2. **Deduplication is external:** an n8n workflow dedups alerts upstream. `createIncidentFromAlert` always creates a ticket.
3. **Caching:** all caching goes through `utils/cache.js` — the single source of truth. Two tiers: `createLocalCache(name, opts)` for per-process TTL caching of Mongo-sourced data (mappings, rules, settings, route responses), and the shared Mongo-backed tier (`cacheGet`/`cacheSet`/`cacheDelByPrefix`) for expensive *external* calls (ServiceNow reference data, metrics) so only one pod per TTL hits upstream. Never create ad-hoc `Map`/`lru-cache` instances — register a named cache instead.
4. **ServiceNow field names** like `u_perational_impact` are intentionally spelled to match the real instance schema (including typos). Placeholder values for mandatory fields (`u_phone_voip`, `u_computer_name`) are deliberate.
