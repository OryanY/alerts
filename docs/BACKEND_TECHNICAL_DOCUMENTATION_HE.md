# 1. מבוא והקשר מערכת
- **מטרת המערכת**
  - המערכת מספקת שני תתי-תחומים עיקריים בצד ה-backend:
    1. API אנליטי לקריאת נתוני התראות מתוך `dbo.historicalAlerts` ב-Microsoft SQL Server, כולל פילטור, Clustering אופציונלי, חישובי KPI, Heatmap, Timeseries, ניתוח פאנלים וניתוח כיסוי אינסידנטים.
    2. API לניהול Incident Automation מול MongoDB ו-ServiceNow: מיפויי מערכת (`system_mappings_new`), חוקי אינסידנטים (`incident_rules_new`), סנכרון קבוצות שיוך (`assignment_groups`), סימולציה ויצירת אינסידנטים בפועל.
  - נקודת הכניסה היחידה ל-backend היא `backend/server.js` שמעלה Express, מחבר SQL ו-Mongo, ורושם את כל ה-routes. המודול `backend/config/index.js` מרכז ספי זמן, הגדרות CORS, Shift Hours ופרטי חיבור למסדי הנתונים.
- **הבעיה העסקית שהמערכת פותרת**
  - בצד האנליטי: המערכת נועדה לנתח עומס התראות, לזהות חלונות זמן רועשים, לחשב false wakeups לפי סף משך (`false_wakeup_threshold`), למדוד כיסוי אינסידנטים ב-ServiceNow, ולספק drill-down לפי Panel, Application, Node ו-Timeline.
  - בצד האוטומציה: המערכת ממפה `application` שמגיע מהתראה ליישות עסקית/שירות ב-ServiceNow דרך `system_mappings_new`, בודקת חוקי override מתוך `incident_rules_new`, ובונה payload מלא ליצירת Incident ב-ServiceNow. בנוסף היא שומרת היסטוריית יצירה ב-`incident_logs` ב-Mongo.
- **הארכיטקטורה הכללית**
  - היישום בנוי בשכבות:
    - `routes/` – מיפוי URL ל-controller.
    - `middleware/` – ולידציית קלט ולוגים.
    - `controllers/` – טיפול HTTP דק והחזרת JSON/HTML.
    - `services/alert/` – לוגיקה עסקית אנליטית והרצת SQL.
    - `services/incident/` – לוגיקת מיפויים, חוקים, ServiceNow והיסטוריה.
    - `database/` – חיבורי MSSQL ו-Mongo.
    - `schemas/` – סכימות Joi.
    - `utils/` – קבועים, שגיאות, תבניות HTML, טיפול זמן, ולידציית env.
  - אין שכבת repository נפרדת; `AlertService` מריץ SQL ישירות דרך `mssql`, ושירותי incident עובדים ישירות מול אוספים ב-Mongo.
  - אין ORM. עבור SQL נעשה שימוש ב-raw SQL templates בתוך `backend/database/queries/alertQueries.js`. עבור Mongo נעשה שימוש ישיר ב-driver הרשמי `mongodb`.
- **זרימת מידע מקצה לקצה**
  - זרימת analytics טיפוסית:
    - `GET /api/stats/executive-kpis`
    - `validateQuery(statsSchema)` ב-`backend/middleware/validation.js`
    - `AlertController.getExecutiveKPIs()`
    - `AlertService.getExecutiveKPIs()`
    - `_getClusteringConfig()` קובע האם לעבוד ב-clustered או unclustered
    - `_execute()` בונה `WHERE` + bind של thresholds + החלפת placeholders
    - SQL רץ מול `dbo.historicalAlerts`
    - התוצאה מעובדת ל-KPI נגזרים ומוחזרת כ-JSON.
  - זרימת incident creation טיפוסית:
    - `POST /api/incidents/incident`
    - `validateBody(alertQuerySchema)`
    - `IncidentController.createIncidentFromAlertPOST()`
    - `IncidentService.createIncidentFromAlert()`
    - `SystemMappingService.getMappingByApplication()` מאתר mapping לפי `grafana_names`
    - `IncidentRuleService.getIncidentRules()` מושך את כל החוקים + `$lookup` למיפויים
    - `incidentHelpers.findAllMatches()` מדרג התאמות
    - `incidentHelpers.buildIncidentData()` בונה payload סופי
    - `ServiceNowClient.createIncident()` מבצע POST ל-ServiceNow
    - `IncidentService` כותב log ל-`incident_logs`
    - controller מחזיר JSON, או במקרה GET redirect/HTML error page.
- **שירותים חיצוניים**
  - Microsoft SQL Server דרך `mssql`.
  - MongoDB דרך `mongodb`.
  - ServiceNow REST API דרך `ServiceNowClient` ו-`axios` בתוך `backend/services/incident/ServiceNowClient.js`. בקוד הייבוא קיים, אך `axios` לא מופיע ב-`backend/package.json`; זו תלות קוד שנמצאה בקוד אך לא הוצהרה בקובץ ה-dependencies.
  - Frontend URL נצרך לצורכי CORS ויצירת קישור UI ב-error HTML (`FRONTEND_URL`).
- **תלות ב-n8n, מסד נתונים, cron jobs, APIs, queues, cache, webhooks, authentication, authorization**
  - **n8n**: לא נמצא בקוד שסופק. אין workflow files, אין exports, אין webhooks ל-n8n.
  - **מסד נתונים**: כן. SQL Server לטבלת `dbo.historicalAlerts`; MongoDB לאוספים `system_mappings_new`, `incident_rules_new`, `assignment_groups`, `incident_logs`.
  - **cron jobs / scheduler**: לא נמצא בקוד שסופק. אין `node-cron`, אין timers ייעודיים.
  - **queues / cache**: אין queue. יש section `cache` ב-`CONFIG`, אבל אין מנגנון cache פעיל ב-backend למעט cache פנימי ב-`TimeUtils`.
  - **webhooks**: כן, חלקית. `GET /api/incidents/incident` מתואר בקוד כמשמש ל-Grafana webhooks/query-triggered flow.
  - **authentication / authorization**: לא נמצא מנגנון auth אמיתי בקוד שסופק. יש הערות על “authenticated users” ב-`incidentRoutes.js`, אך אין middleware שמבצע אימות או הרשאות בפועל.

# 2. מבנה הפרויקט המלא
- **Tree מלא של התיקיות והקבצים**
```text
.
├── .gitignore
├── package.json
├── backend
│   ├── .gitignore
│   ├── CONFLUENCE_DOCS.md
│   ├── README.md
│   ├── package.json
│   ├── server.js
│   ├── config
│   │   └── index.js
│   ├── controllers
│   │   ├── AlertController.js
│   │   └── IncidentController.js
│   ├── database
│   │   ├── connection.js
│   │   └── queries
│   │       └── alertQueries.js
│   ├── middleware
│   │   ├── queryLogger.js
│   │   └── validation.js
│   ├── routes
│   │   ├── alertRoutes.js
│   │   └── incidentRoutes.js
│   ├── schemas
│   │   ├── alertSchemas.js
│   │   └── incidentSchemas.js
│   ├── services
│   │   ├── alert
│   │   │   └── AlertService.js
│   │   └── incident
│   │       ├── IncidentRuleService.js
│   │       ├── IncidentService.js
│   │       ├── ServiceNowClient.js
│   │       ├── SystemMappingService.js
│   │       └── incidentHelpers.js
│   └── utils
│       ├── TimeUtils.js
│       ├── constants.js
│       ├── errors.js
│       ├── htmlTemplates.js
│       └── validateEnv.js
├── docs
│   ├── ADDING_METRICS.md
│   ├── DATABASE_GUIDE.md
│   ├── FRONTEND_GUIDE.md
│   ├── INCIDENT_LOGIC.md
│   └── BACKEND_TECHNICAL_DOCUMENTATION_HE.md
└── frontend
    ├── .gitignore
    ├── README.md
    ├── package.json
    ├── public
    │   ├── favicon.ico
    │   ├── index.html
    │   ├── logo192.png
    │   ├── logo512.png
    │   ├── manifest.json
    │   └── robots.txt
    └── src
        ├── App.jsx
        ├── icons.js
        ├── index.css
        ├── index.js
        ├── components
        ├── contexts
        ├── hooks
        ├── pages
        └── utils
```
- **עבור כל תיקייה: תפקידה**
  - `backend/` – השרת, שירותי API, חיבורים למסדי נתונים וכל הלוגיקה השרתית.
  - `backend/config/` – קונפיגורציה סטטית ונגזרת מ-env.
  - `backend/controllers/` – שכבת HTTP.
  - `backend/database/` – singleton connections ותבניות SQL.
  - `backend/middleware/` – ולידציה ולוגים.
  - `backend/routes/` – הגדרת endpoints בפועל.
  - `backend/schemas/` – סכימות Joi עבור query/body.
  - `backend/services/alert/` – לוגיקה אנליטית על SQL.
  - `backend/services/incident/` – אוטומציית אינסידנטים, מיפויים, חוקים, ServiceNow.
  - `backend/utils/` – פונקציות עזר ותשתיות משותפות.
  - `docs/` – תיעוד קיים בריפו. חלקו אינו תואם במדויק לקוד הנוכחי ולכן יש להתייחס אליו כ-reference משני בלבד.
  - `frontend/` – אפליקציית React. לא חלק מה-backend, אך משפיעה על CORS, על `FRONTEND_URL`, ועל צריכת ה-API.
- **עבור כל קובץ: תפקידו, נקודת הכניסה שלו, במי הוא תלוי, מי תלוי בו**
  - פירוט מלא מופיע בסעיף 10. כאן מוצגים הקבצים הקריטיים:
    - `backend/server.js` – bootstrap של כל השרת; תלוי ב-config, DB, routes, middleware, validateEnv.
    - `backend/config/index.js` – מקור האמת לקונפיגורציה runtime; תלוי ב-`process.env`; כל השירותים תלויים בו.
    - `backend/database/connection.js` – מנהל חיבורי MSSQL/Mongo singleton; תלוי ב-`mssql`, `mongodb`, `config`.
    - `backend/database/queries/alertQueries.js` – repository של raw SQL; `AlertService` תלוי בו.
    - `backend/services/alert/AlertService.js` – שכבת הלוגיקה האנליטית המרכזית.
    - `backend/services/incident/IncidentService.js` – orchestrator של Incident creation.
    - `backend/services/incident/SystemMappingService.js` + `IncidentRuleService.js` – persistence ו-business rules של Mongo.
    - `backend/services/incident/incidentHelpers.js` – rule engine + template substitution.
    - `backend/services/incident/ServiceNowClient.js` – I/O חיצוני ל-ServiceNow.
    - `backend/routes/*.js` – נקודות חשיפה HTTP.
- **ציין קבצים קריטיים במיוחד**
  - `backend/server.js`
  - `backend/config/index.js`
  - `backend/database/connection.js`
  - `backend/database/queries/alertQueries.js`
  - `backend/services/alert/AlertService.js`
  - `backend/services/incident/IncidentService.js`
  - `backend/services/incident/incidentHelpers.js`
  - `backend/services/incident/ServiceNowClient.js`

# 3. נקודת הכניסה של המערכת
- **server/app/bootstrap**
  - נקודת הכניסה היא `backend/server.js`.
  - השרת מתחיל ב-`require('dotenv').config()` כדי לטעון `.env` לפני טעינת `CONFIG` או כל מודול אחר שצורך env.
- **initialization sequence**
  1. טעינת `dotenv`.
  2. `require()` של Express, `cors`, `helmet`, `compression`, `luxon`.
  3. import של `CONFIG`, פונקציות DB, routes, utilities.
  4. קריאה ל-`validateEnvironmentVariables()`.
  5. יצירת `app = express()` וחישוב `PORT`.
  6. רישום middleware אבטחה, CORS, compression ו-body parsers.
  7. רישום `queryLogger` רק ב-development תחת `/api`.
  8. הגדרת `/api/health` inline.
  9. חיבור `alertRoutes` תחת `/api` עם restricted CORS.
  10. חיבור `incidentRoutes` תחת `/api/incidents` עם public CORS.
  11. רישום 404 handler.
  12. רישום global error handler.
  13. `startServer()` מחבר SQL, אחר כך Mongo, ואז מפעיל `app.listen()`.
- **config loading**
  - `backend/config/index.js` בונה אובייקט `CONFIG` קפוא (`Object.freeze`) עם sections: `cache`, `duration`, `cors`, `shifts`, `tz`, `server`, `limits`, `clustering`.
  - באותו קובץ מוגדרים גם `dbConfig` ל-SQL Server ו-`mongoConfig` ל-Mongo.
- **env validation**
  - `backend/utils/validateEnv.js`:
    - ב-production חסרון של אחד מ-`REQUIRED_ENV_VARS` גורם ל-`process.exit(1)`.
    - ב-development חסרונות רק מודפסים כ-warning.
    - env מומלצים (`SQL_POOL_MAX`, `SQL_POOL_MIN`, `SQL_PORT`) תמיד רק מודפסים.
  - חשוב: הקוד דורש `MONGO_URI` ב-production לפי validator, אבל `config/index.js` יודע לבנות URI גם משדות מפורקים. כלומר יש mismatch בין יכולת ה-config לבין validator.
- **database connection**
  - `initializeSqlDatabase()`:
    - יוצר `new sql.ConnectionPool(dbConfig).connect()`.
    - מריץ בדיקת קישוריות: `SELECT COUNT(*) as total_records FROM dbo.historicalAlerts`.
    - במקרה כשל – מדפיס שגיאה ויוצא מה-process.
  - `initializeMongoDatabase()`:
    - בונה `MongoClient(mongoConfig.uri)`.
    - מתחבר ל-db `mongoConfig.database`.
    - סופר documents ב-`system_mappings_new` כבדיקת תקינות.
    - במקרה כשל – מדפיס שגיאה ויוצא מה-process.
- **middleware registration**
  - `helmet` עם `crossOriginResourcePolicy: cross-origin` ו-`contentSecurityPolicy: false`.
  - `app.use('/api/health', publicCors)`.
  - `compression()`.
  - `express.json({ limit: '10mb' })`.
  - `express.urlencoded({ extended: true, limit: '10mb' })`.
  - `queryLogger` רק אם `NODE_ENV === 'development'`.
- **route registration**
  - `app.use('/api', restrictedCors, alertRoutes)`.
  - `app.use('/api/incidents', publicCors, incidentRoutes)`.
  - המשמעות היא שכל routes של alerts/statistics דורשים origin מורשה ב-production, וכל routes של incidents פתוחים ב-CORS לכל origin.
- **scheduler/workflow initialization**
  - לא נמצא בקוד שסופק. אין bootstrap של cron / n8n / queue worker.
- **error handlers**
  - 404 handler מחזיר `{ success: false, error: { message: 'Endpoint not found', path: req.path } }`.
  - global error handler:
    - משתמש ב-`err.status || 500`.
    - אם status >= 500 כותב `console.error`; אחרת `console.warn`.
    - מחזיר `{ success: false, error: { message, code, stack? } }`.
    - stack מוחזר רק ב-development.
- **graceful shutdown**
  - `shutdown()` מגן מפני ריצה כפולה עם `isShuttingDown`.
  - סוגר קודם את השרת (`server.close`) ואז `closeConnections()` למסדי הנתונים.
  - מופעל על `SIGINT` ו-`SIGTERM`.

# 4. תיעוד מלא לפי שכבות
## 4.1 Routes
### `backend/routes/alertRoutes.js`
- **תפקיד**: הגדרת כל endpoints האנליטיקה/alerts תחת prefix `/api`.
- **אתחול פנימי**:
  - יוצר `alertService = new AlertService()`.
  - יוצר `controller = new AlertController(alertService)`.
- **Endpoints**
  1. `GET /api/alerts`
     - middleware chain: `restrictedCors` ב-server → `validateQuery(alertsSchema)` → `AlertController.getAlerts`
     - query params: `start_date`, `end_date`, `day_start`, `day_end`, `night_start`, `night_end`, `dur_short_max`, `dur_medium_max`, `false_wakeup_threshold`, `limit`, `page`, `sort_by`, `sort_order`, `panel_title`, `application`, `node_name`, `network`, `object`, `operator`, `min_duration`, `max_duration`, `clustering_enabled`, `clustering_threshold`, `duration_metric`.
     - response: `{ success, data: Alert[], meta, count }`.
     - validation: Joi לפי `alertsSchema`.
     - auth/authz: לא נמצא בקוד שסופק.
     - side effects: אין write; query בלבד.
  2. `GET /api/stats/executive-kpis`
     - chain: `validateQuery(statsSchema)` → `getExecutiveKPIs`
     - response: KPI aggregate.
  3. `GET /api/stats/hourly-heatmap`
     - chain: `validateQuery(statsSchema)` → `getHourlyHeatmap`
  4. `GET /api/stats/timeseries`
     - chain: `validateQuery(timeseriesSchema)` → `getTimeseriesStats`
     - דורש `start_date` ו-`end_date`.
  5. `GET /api/stats/duration-histogram`
     - chain: `validateQuery(statsSchema)` → `getDurationHistogram`
  6. `GET /api/stats/shift-analysis`
     - chain: `validateQuery(statsSchema)` → `getShiftAnalysis`
  7. `GET /api/stats/by-panel`
     - chain: `validateQuery(panelStatsSchema)` → `getPanelStats`
  8. `GET /api/stats/panels`
     - chain: `validateQuery(panelResearchSchema)` → `getPanelList`
  9. `GET /api/stats/panel-analysis`
     - chain: `validateQuery(panelResearchSchema)` → `getPanelAnalysis`
     - אם `panel_title` חסר, השכבה השירותית מחזירה `{ success: false }` וה-controller מחזיר HTTP 500.
  10. `GET /api/stats/top-applications`
      - chain: `validateQuery(statsSchema)` → `getTopApplications`
  11. `GET /api/stats/top-nodes-by-app`
      - chain: `validateQuery(statsSchema)` → `getTopNodesByApp`
  12. `GET /api/stats/consecutive-days`
      - chain: `validateQuery(statsSchema)` → `getConsecutiveDaysNodes`
  13. `GET /api/stats/incident-stats`
      - chain: `validateQuery(statsSchema)` → `getIncidentStats`
- **הערות**
  - כל endpoints הללו רצים על אותו service singleton-in-module, בלי cache.
  - אין validation של whitelist ל-`sort_by` מעבר למה שב-Joi; לכן SQL injection דרך `sort_by` מוגבל לסט ערכים ידוע.

### `backend/routes/incidentRoutes.js`
- **תפקיד**: הגדרת endpoints של incident automation תחת `/api/incidents`.
- **אתחול פנימי**:
  - `mappingService = new SystemMappingService()`
  - `ruleService = new IncidentRuleService()`
  - `incidentService = new IncidentService(mappingService, ruleService)`
  - `controller = new IncidentController(incidentService, mappingService, ruleService)`
- **Endpoints**
  1. `GET /api/incidents/assignment-groups`
     - middleware: רק `publicCors`
     - handler: `getAssignmentGroups`
     - response: `{ success, data, count }`
  2. `GET /api/incidents/assignment-groups/sync`
     - handler: `syncAssignmentGroups`
     - side effect: fetch מ-ServiceNow + `updateOne(..., { upsert: true })` ל-`assignment_groups`.
     - שימו לב: comment בקוד אומר `POST`, אבל route בפועל הוא `GET`.
  3. `GET /api/incidents/incident`
     - middleware: `validateQuery(alertQuerySchema)`
     - handler: `createIncidentFromAlertGET`
     - side effect: יצירת Incident ב-ServiceNow + כתיבת log ל-Mongo + redirect ל-ServiceNow ב-success.
  4. `POST /api/incidents/incident`
     - middleware: `validateBody(alertQuerySchema)`
     - handler: `createIncidentFromAlertPOST`
  5. `POST /api/incidents/incident/simulate`
     - middleware: `validateBody(alertQuerySchema)`
     - handler: `simulateIncidentCreation`
     - side effect: אין קריאה ל-ServiceNow; no write ל-log.
  6. `GET /api/incidents/system-mappings`
     - handler: `getSystemMappings`
  7. `POST /api/incidents/system-mappings`
     - middleware: `validateBody(systemMappingSchema)`
     - handler: `createSystemMapping`
     - side effect: `insertOne` ל-`system_mappings_new`.
  8. `PUT /api/incidents/system-mappings/:id`
     - middleware: `validateBody(systemMappingSchema.fork(['grafana_names'], optional))`
     - handler: `updateSystemMapping`
     - side effect: `updateOne` ל-`system_mappings_new`.
  9. `DELETE /api/incidents/system-mappings/:id`
     - handler: `deleteSystemMapping`
     - side effect: `deleteOne` ל-`system_mappings_new` אם אין חוקים תלויים.
  10. `GET /api/incidents/incident-rules`
      - handler: `getIncidentRules`
      - query optional: `application`
  11. `POST /api/incidents/incident-rules`
      - middleware: `validateBody(incidentRuleSchema)`
      - handler: `createIncidentRule`
  12. `PUT /api/incidents/incident-rules/:id`
      - middleware: `validateBody(incidentRuleSchema.fork(['system_mapping_id'], optional))`
      - handler: `updateIncidentRule`
  13. `DELETE /api/incidents/incident-rules/:id`
      - handler: `deleteIncidentRule`
  14. `PATCH /api/incidents/incident-rules/:id/toggle`
      - handler: `toggleIncidentRule`
      - body requirement: `{ enabled: boolean }` נבדק ידנית ב-controller.
  15. `GET /api/incidents/incident-logs`
      - handler: `getIncidentLogs`
      - query: `limit`, `skip`, `search`
- **validation / auth / side effects**
  - auth/authz: לא נמצא בקוד שסופק.
  - חלק מה-routes מבצעים כתיבה ל-Mongo וחלקם גם ל-ServiceNow.
  - ה-CORS עבור כל `/api/incidents` public לחלוטין.

## 4.2 Middleware
### `backend/middleware/validation.js`
- **שם**: `validateQuery`, `validateBody`, `validateParams`.
- **מיקום**: `backend/middleware/validation.js`.
- **מטרה**: ולידציה כללית מול Joi והזרקת ערך validated ל-request.
- **מתי הוא רץ**: לפני controller בכל route שבו חובר middleware מתאים.
- **מה הוא קורא מה-request**
  - `validateQuery`: `req.query`
  - `validateBody`: `req.body`
  - `validateParams`: `req.params`
- **מה הוא מוסיף ל-request / response**
  - `req.validatedQuery`, `req.validatedBody`, `req.validatedParams`.
- **תנאי חסימה**
  - כל שגיאת Joi גורמת ל-HTTP 400.
- **שגיאות אפשריות**
  - שגיאת validation מחזירה:
    - `success: false`
    - `error: 'Request validation failed'` / `Request body validation failed` / `Request parameters validation failed`
    - `details: error.details.map(d => d.message)`
- **תלותים**
  - תלוי רק ב-schema שנמסר מה-route.
- **דוגמאות לזרימה**
  - `GET /api/alerts?sort_by=hacker_field` → Joi reject → controller לא רץ.
  - `POST /api/incidents/incident` בלי `application` → `validateBody(alertQuerySchema)` מחזיר 400.

### `backend/middleware/queryLogger.js`
- **שם**: `queryLogger`.
- **מטרה**: לוג פיתוח של query params, זמן ריצה, וכמות rows מוחזרת.
- **מתי הוא רץ**: רק אם `NODE_ENV === 'development'`, ורק תחת prefix `/api`.
- **מה הוא קורא מה-request**
  - `req.method`, `req.path`, `req.query`.
- **מה הוא מוסיף ל-request / response**
  - לא מוסיף שדות ל-request.
  - עוטף את `res.json` כדי למדוד duration ולחשב count.
- **תנאי חסימה**: לא חוסם.
- **שגיאות אפשריות**: אין try/catch; אם `res.json` מקבל מבנה חריג, הלוג עדיין מנסה לקרוא `body.success`, `body.data`, `body.count`.
- **תלותים**
  - `SENSITIVE_KEYS` redaction עבור `password`, `token`, `secret`, `key`, `auth`.
- **דוגמאות לזרימה**
  - request מוצלח עם array data → לוג `✓ X rows — Yms`.
  - response error → לוג `✗ error message — Yms`.
- **hidden coupling**
  - מניח שמבנה response הוא `{ success, data, count }`. controllers בפרויקט אכן בנויים כך.

## 4.3 Controllers
### `backend/controllers/AlertController.js`
- **תפקיד**: שכבת HTTP דקה לכל endpoints של analytics.
- **מבנה**
  - constructor(alertService) קושר את כל המתודות ל-`this`.
- **פונקציות**
  - `async getAlerts(req, res, next)`
    - input: `req.validatedQuery || req.query`
    - service: `alertService.getAlerts()`
    - branching: אין
    - response: `{ success, data, meta, count }`
    - error handling: `catch => next(error)`
  - `getExecutiveKPIs`, `getIncidentStats`, `getHourlyHeatmap`, `getTimeseriesStats`, `getDurationHistogram`, `getShiftAnalysis`, `getPanelStats`, `getPanelList`, `getTopApplications`, `getTopNodesByApp`, `getConsecutiveDaysNodes`
    - כולן בעלות אותו pattern: service call → `res.json({ success: true, data, meta })`.
  - `async getPanelAnalysis(req, res, next)`
    - input: validated query
    - branching: אם `result.success` false מחזיר `res.status(500).json(result)` ולא `next(error)`.
    - hidden assumption: service יחזיר error envelope במקום לזרוק exception.
- **logging behavior**
  - אין logging מובנה בתוך controller זה.
- **hidden assumptions**
  - מניח שכל services מחזירים אובייקט עם `success` ו-`data`.
  - לא מבצע נרמול שגיאות מעבר ל-pass through.

### `backend/controllers/IncidentController.js`
- **תפקיד**: handling HTTP עבור assignment groups, incident creation, mappings, rules ו-history.
- **מתודות helper**
  - `_getErrorAction(error)`
    - מחזיר CTA ל-frontend (`${FRONTEND_URL}/incident`) אם `error.message` כולל `No system mapping`.
- **פונקציות**
  - `getAssignmentGroups(req, res, next)`
    - service: `incidentService.getAssignmentGroups()`
    - branching: אם `groups` אינו array → 500 עם הודעת invalid groups data.
  - `syncAssignmentGroups(req, res, next)`
    - service: `incidentService.syncAssignmentGroups()`
    - side effect: ServiceNow + Mongo write
    - success response כולל `meta.syncedAt`, `meta.source='servicenow'`
    - branching: אם return לא array → 500
  - `createIncidentFromAlertGET(req, res, next)`
    - input: `req.validatedQuery`
    - service: `incidentService.createIncidentFromAlert(alertData)`
    - branching:
      - אם `serviceNowResult.link` קיים → `res.redirect(link)`
      - אחרת JSON success
      - ב-catch: אם mapping חסר → status 404, אחרת 500, ומחזיר HTML via `getErrorHtml()`
    - hidden assumption: endpoint נקרא בדפדפן/חלון popup ולכן HTML error page שימושי.
  - `createIncidentFromAlertPOST(req, res, next)`
    - ב-catch: אם message כולל `No system mapping` או `not found` → 404 JSON, אחרת `next(error)`.
  - `simulateIncidentCreation(req, res, next)`
    - service dry-run
  - `getSystemMappings(req, res, next)`
    - service: `mappingService.getSystemMappings()`
  - `createSystemMapping(req, res, next)`
    - conflict detection: אם error כולל `already exist` → 409
  - `updateSystemMapping(req, res, next)`
    - אם error כולל `not found` → 404
  - `deleteSystemMapping(req, res, next)`
    - response success message משתמש `result.message`, אבל `SystemMappingService.deleteSystemMapping()` מחזיר רק `{ deletedCount }`, לכן `message` יהיה `undefined`.
  - `getIncidentRules(req, res, next)`
    - קורא `req.query.application` ושולח ל-`ruleService.getIncidentRules(application)`.
  - `createIncidentRule`, `updateIncidentRule`, `deleteIncidentRule`, `toggleIncidentRule`
    - ממפים שגיאות `not found` ו-`System mapping not found` ל-404.
    - `toggleIncidentRule` בודק ידנית ש-`enabled` הוא boolean.
  - `getIncidentLogs(req, res, next)`
    - ממיר `limit` ו-`skip` עם `parseInt` ללא radix explicit.
- **logging behavior**
  - משתמש ב-`console.log` ו-`console.error` באופן ידני במספר endpoints.
- **hidden assumptions**
  - אין auth, אף על פי שיש הערות “authenticated users”.
  - `deleteSystemMapping` ו-`deleteIncidentRule` מניחים שירות שמחזיר `message`, אך השירותים מחזירים counts בלבד.

## 4.4 Services
### `backend/services/alert/AlertService.js`
- **Responsibility**
  - שירות אנליטי יחיד עבור כל קריאות SQL מול `historicalAlerts`.
  - בונה WHERE clauses, bind של ספים, החלפת placeholders בתבניות SQL, עיצוב התוצאות ל-shape שה-frontend מצפה לו.
- **exact internal flow step by step**
  - `constructor(sqlPool = null)`
    - שומר pool אם הוזרק.
    - מאתחל `constants` מתוך `CONFIG`: default cap, max page size, שעות יום/לילה, ספי duration.
  - `getPool()`
    - lazy-load של singleton SQL pool מ-`getSqlPool()`.
  - `_buildWhereClause(params, request)`
    - אם `start_date` קיים: ממיר עם `luxon` מ-Asia/Jerusalem ל-UTC תחילת יום, עושה bind ל-`@start_date`, מוסיף `time_fired >= @start_date`.
    - אם `end_date` קיים: ממיר לסוף יום, bind `@end_date`, מוסיף `time_fired <= @end_date`.
    - אם `panel_title` קיים: שוויון מלא `panel_title = @panel_title`.
    - עבור `application`, `node_name`, `network`, `object`, `operator`: עושה prefix search עם `LIKE '${value}%'`.
    - עבור `min_duration`/`max_duration`: פילטר על `duration_sec` בלבד, גם כאשר clustering enabled. הערת קוד מציינת שזה אולי לא אידיאלי עבור clustered.
    - מחזיר מחרוזת `WHERE ...` או ריק.
  - `_bindThresholds(request, params)`
    - קובע thresholds runtime עם fallback ל-config.
    - עושה bind ל-`@day_start`, `@day_end`, `@dur_short_max`, `@dur_medium_max`, `@false_wakeup_threshold`.
  - `_getClusteringConfig(params)`
    - `enabled`:
      - אם נשלח `clustering_enabled` → false רק אם הערך שווה `'false'` או `false`.
      - אחרת fallback ל-`CONFIG.clustering.enabledByDefault`.
    - `threshold`: parseInt של `params.clustering_threshold`, fallback ל-`CONFIG.clustering.defaultThreshold`.
  - `_execute(queryTemplate, params, overrides = {})`
    - יוצר request.
    - בונה where clause.
    - קושר thresholds + `cluster_threshold` תמיד.
    - אם `overrides.limit` מוגדר – bind ל-`limit_param`.
    - מחליף `{WHERE_CLAUSE}` ו-placeholder נוספים מ-`overrides.replace`.
    - מסיר כל placeholder באותיות גדולות שלא הוחלף דרך regex `/\{[A-Z_]+\}/g`.
    - מריץ query ומחזיר `recordset` בלבד.
- **פונקציות ציבוריות**
  - `getExecutiveKPIs(params)`
    - בוחר `CLUSTERED_KPI_STATS` או `UNCLUSTERED_KPI_STATS`.
    - מחשב fields נגזרים:
      - `false_positive_rate_247 = false_wakeups / total_alerts * 100`
      - `true_wakeups = night_true_wakeups`
      - `signal_ratio = true_alerts / total_alerts * 100`
    - מחזיר `success + data`.
  - `getAlerts(params)`
    - קורא pagination (`page`,`limit`) ו-sorting.
    - ב-clustered: קושר thresholds ו-`cluster_threshold`.
    - אם יש page+limit משתמש `OFFSET ... FETCH NEXT limit+1` כדי לזהות `hasNext`; אחרת `TOP (@limit_param)`.
    - בוחר `queries.CLUSTERED_ALERTS` או `SELECT_ALERTS`.
    - `rawOrderClause` נועד ל-CTE הפנימי; `finalOrderClause` ב-clustered משתמש ב-`c.time_fired` כש-sort_by הוא `time_fired`.
    - לאחר query:
      - אם pagination, חותך record extra עבור `hasNext`.
      - ממפה כל רשומה ל-object API.
      - מחשב `duration_category` עם ספים hard-coded 30/300 ולא עם `dur_short_max`/`dur_medium_max` מה-query/config.
      - מחשב `shift` ע"י `TimeUtils.getILHour(r.time_fired)` לעומת `day_start/day_end`.
      - אם `raw_alerts_json` קיים – עושה `JSON.parse`, בשגיאה רק לוג.
      - `is_cluster = cluster_count > 1`.
  - `getPanelList(params)`
    - בוחר `CLUSTERED_PANEL_LIST` או `PANEL_LIST`.
    - מוסיף `health_score = 100 - false_positive_rate%` עם floor ל-0.
  - `getTimeseriesStats(params)` – בוחר clustered/unclustered timeseries ומחזיר raw rows.
  - `getIncidentStats(params)`
    - בוחר 4 queries לפי clustering: coverage/team/app/trend.
    - מריץ במקביל עם `Promise.all`.
    - מחזיר מבנה `{ coverage, by_team, by_application, daily_trend }`.
  - `getDurationHistogram(params)`
    - בוחר histogram query.
    - ממפה לקטגוריות `Short`, `Medium`, `Long` עם טווחים לפי `this.constants` בלבד, לא לפי פרמטר query שנשלח.
  - `getHourlyHeatmap(params)`
    - בוחר query.
    - מוסיף `hour_display` ו-`is_night` לפי `day_start/day_end` מהפרמטרים.
  - `getShiftAnalysis(params)` – מחזיר rows כפי שה-SQL יצר.
  - `getPanelAnalysis(params)`
    - דורש `panel_title`; אחרת מחזיר envelope שגיאה ולא exception.
    - בוחר batch query clustered/unclustered.
    - query batch מחזיר 5 recordsets: KPIs, trend, heatmap, duration, noisy.
    - אם לא חזרו לפחות 5 recordsets → throw.
    - בונה `summary` עם:
      - `false_positive_rate`
      - `night_wakeups`
      - `night_false_wakeups`
      - `alerts_per_day = Math.round(total / trendResult.length)`
      - `trend_direction: 'stable'` קבוע hard-coded.
    - duration formatting כאן כן משתמש ב-query params אם נשלחו.
  - `getPanelStats(params)` – מריץ `PANEL_STATS` עם `TOP (@limit_param)` אם יש limit.
  - `getTopApplications(params)` – `TOP_APPLICATIONS`.
  - `getTopNodesByApp(params)` – `TOP_NODES_BY_APP`.
  - `getConsecutiveDaysNodes(params)` – `CONSECUTIVE_DAYS_NODES`.
- **business rules**
  - Shift day מוגדר בברירת מחדל 08:00–22:00.
  - false wakeup מוגדר כברירת מחדל כמשך ≤ 120 שניות.
  - clustering ברירת מחדל enabled אלא אם env `CLUSTER_ENABLED_DEFAULT='false'`.
  - cluster חדש נוצר כאשר פער הזמן בין `time_fired` נוכחי לקודם גדול מ-`cluster_threshold` דקות.
- **thresholds, clustering logic, shift-time logic, duration threshold logic**
  - `dur_short_max`: default 30 sec.
  - `dur_medium_max`: default 300 sec.
  - `false_wakeup_threshold`: default 120 sec.
  - `cluster_threshold`: default 15 דקות.
  - shift day/night מבוסס על זמן ישראל, גם ב-SQL וגם ב-Node.
- **retry / fallback / dedup logic**
  - אין retry על SQL.
  - fallback ל-default config ברוב הפונקציות.
  - dedup ברמת pagination בלבד (`limit+1`), לא ברמת נתונים.
- **edge cases**
  - `duration_category` משתמש בספים hard-coded ולא configurable.
  - `MAX_PAGE_SIZE` מוגדר ב-constants אך לא נאכף בפועל.
  - `TimeUtils.validateDateRange()` לא משולב; dates validated only by regex/Joi ובנייה ישירה של Luxon.
  - `_buildWhereClause()` משתמש prefix match בלבד לשדות מסוימים; אין contains כללי.

### `backend/services/incident/IncidentService.js`
- **responsibility**
  - orchestration של incident creation, assignment groups, ServiceNow shortcuts, simulation ו-history.
- **internal flow**
  - `constructor(mappingService, ruleService)` – dependency injection.
  - `get db()`
    - lazy init של collections `assignmentGroups` ו-`incidentLogs`.
    - יוצר TTL index על `incidentLogs.created_at` עם `expireAfterSeconds: 7776000` בשקט (`catch(() => {})`).
  - `get serviceNowClient()` – lazy init של `new ServiceNowClient()`.
- **פונקציות**
  - `createIncidentFromAlert(alertData)`
    1. מאמת קיום `application`, אחרת throw.
    2. מושך mapping לפי `application`.
    3. אם לא נמצא mapping → throw `No system mapping found...`.
    4. מושך את כל rules הרלוונטיים עם `ruleService.getIncidentRules(application)`.
    5. מסנן `enabled !== false`.
    6. מחשב התאמות עם `helpers.findAllMatches(alertData, enabledRules)`.
    7. עושה `reverse()` ואז `map(m => m.rule)`.
    8. ממזג `incident_overrides` של כל החוקים לפי הסדר. override מאוחר דורס מוקדם.
    9. בונה `incidentData` מתוך mapping + overrides + alert.
    10. יוצר incident ב-ServiceNow.
    11. בוחר `matchedRule` בתור החוק האחרון במערך לאחר reverse, כלומר בפועל החוק הכי חלש לאחר תהליך reverse, לא בהכרח הכי ספציפי. זו תלות עדינה בסדר המיון.
    12. כותב log אסינכרוני ל-`incidentLogs.insertOne(...).catch(console.error)` בלי להמתין.
    13. מחזיר `incidentData`, `serviceNowResult`, `mapping_used`, `rule_used`, `rule_name`, `applied_rules`, `matched_applications`.
  - `getAssignmentGroups()`
    - מחפש `_id: 'assignment_groups_store'` ב-collection.
    - מחזיר `doc.groups` או `[]`.
  - `syncAssignmentGroups()`
    - קורא `serviceNowClient.fetchAssignmentGroups()`.
    - מבצע `updateOne` עם `upsert` ל-`assignment_groups`.
  - `createServiceNowAlert(alertData)`
    - מחפש mapping לפי `application`.
    - אם לא נמצא mapping – טוען את כל המיפויים ויוצר הודעת שגיאה ארוכה עם כל pattern values הזמינים.
    - בונה payload מינימלי:
      - `short_description = message`
      - `service_offering`
      - `u_prevented_incident = Boolean(prevented)`
      - `caller_id` אם `user`
      - `parent_incident` אם `prevented && incident_sys_id`
    - יוצר Incident דרך אותו endpoint של ServiceNow, כלומר “alert” הוא למעשה incident נוסף עם שדות שונים.
  - `createIncidentWithAlert(alertData, createAlert = true, linkToIncident = true)`
    - יוצר incident רגיל.
    - אם `createAlert=false`, מחזיר רק תוצאת incident.
    - אחרת יוצר גם prevented alert ומקשר parent incident אם התבקש.
    - route ישיר לפונקציה זו לא נמצא בקוד שסופק.
  - `simulateIncidentCreation(alertData)`
    - לא קורא ל-ServiceNow ולא כותב DB.
    - מחזיר `system_mapping`, `applied_rules`, `total_rules_checked`, `generated_incident`, `hierarchy_explanation`.
  - `getIncidentHistory(limit = 50, skip = 0, search = null)`
    - בונה query ריק או `$or` regex case-insensitive על `application` ו-`servicenow_result.incident_number`.
    - מחזיר `{ logs, total }` עם sort descending על `created_at`.
- **business rules**
  - mapping הוא תנאי חובה לכל incident creation אמיתי.
  - רק חוקים `enabled !== false` משתתפים.
  - applied rules נבנים כסכימת override מצטברת.
- **retry / fallback / dedup logic**
  - אין retry ל-ServiceNow.
  - אין dedup של incident מול אינסידנט קיים בקוד הנוכחי.
  - logging ל-Mongo הוא best-effort בלבד.
- **edge cases**
  - `matchedRule` עשוי לא לייצג את החוק בעל העדיפות הגבוהה ביותר בגלל `reverse()`.
  - `createIncidentFromAlert()` לא בודק `serviceNowResult.success`; גם כשל נרשם בלוג ומוחזר ללקוח כמבנה תוצאה רגיל.

### `backend/services/incident/IncidentRuleService.js`
- **responsibility**: CRUD ו-fetching של חוקי Incident ב-Mongo.
- **internal flow**
  - `collection` getter → `incident_rules_new`
  - `mappingCollection` getter → `system_mappings_new`
  - `getIncidentRules(grafanaName = null)`
    - aggregate pipeline:
      1. `$match: {}`
      2. `$lookup` מ-system mappings
      3. `$unwind` עם `preserveNullAndEmptyArrays`
      4. `$sort created_at: -1`
    - אם אין `grafanaName`, מחזיר כל החוקים.
    - אם יש `grafanaName`:
      - global rules תמיד נשמרים.
      - non-global rules נבדקים מול `rule.grafana_names`. אם אין array כזה → false.
      - matching מתבצע דרך `helpers.matchesGrafanaPattern()`.
  - `createIncidentRule(ruleData)`
    - אם לא global:
      - דורש `system_mapping_id`.
      - טוען mapping קיים.
      - אם לא נמצא → throw.
    - `helpers.validateRuleConditions(ruleData.conditions)`.
    - אם override כולל `u_system_failure` → parseBoolean.
    - שומר document עם `grafana_names` מועתקים מהמיפוי, `is_global`, `logic_operator`, timestamps.
  - `updateIncidentRule(id, ruleData)`
    - מתעלם מ-`_id`, `created_at`, `system_mapping_id` המקוריים דרך destructuring.
    - אם הגיע `system_mapping_id` חדש – טוען mapping ומעתיק `grafana_names`.
    - validate conditions + parseBoolean.
    - `updateOne` + בדיקת `matchedCount`.
    - מחזיר `findOne` מעודכן.
  - `deleteIncidentRule(id)` – `deleteOne`, בודק `deletedCount`.
  - `toggleIncidentRule(id, enabled)` – `updateOne` של `enabled` ו-`updated_at`.
- **business rules**
  - global rule לא חייב system mapping.
  - non-global rule חייב system mapping, ויורש ממנו `grafana_names` snapshot.
- **edge cases**
  - אם mapping מתעדכן אחר כך, rules קיימים שומרים snapshot של `grafana_names`, ולאו דווקא מתעדכנים רטרואקטיבית.

### `backend/services/incident/SystemMappingService.js`
- **responsibility**: CRUD ואיתור mapping לפי application.
- **functions**
  - `getSystemMappings()` – `find({}).toArray()`.
  - `getMappingByApplication(grafanaName)`
    - טוען *את כל* המיפויים לזיכרון.
    - עובר על כל `grafana_names` בכל mapping.
    - לכל pattern string בונה `{ value, type: 'exact' }`.
    - מחזיר mapping ראשון שמתאים.
  - `checkMappingConflicts(patterns, excludeId = null)`
    - בודק רק patterns מסוג `exact`.
    - query: `{'grafana_names.value': {$in: exactValues}, 'grafana_names.type': 'exact'}`.
    - אם יש mapping מתנגש – זורק error עם כל exact conflicts.
  - `createSystemMapping(mappingData)`
    - תומך ב-`grafana_names` או `grafana_name` legacy.
    - `validateGrafanaPatterns()` מנרמל lower-case ו-type.
    - `checkMappingConflicts()` לפני insert.
    - שומר `u_system_failure` כ-boolean + timestamps.
  - `updateSystemMapping(id, mappingData)`
    - אם מגיעים `grafana_names`, מבצע normalize + conflict check.
    - אם `u_system_failure` קיים, parseBoolean.
    - `updateOne` + `findOne`.
  - `deleteSystemMapping(id)`
    - בודק תלות חוקים ב-`incident_rules_new` לפי `system_mapping_id`.
    - אם `rulesCount > 0`, לא מאפשר מחיקה.
    - אחרת `deleteOne`.
- **business rules / risks**
  - conflict detection לא בודק `contains`/`regex`, רק exact.
  - lookup לפי application נטען בזיכרון ולא משתמש ב-query ייעודי.

### `backend/services/incident/incidentHelpers.js`
- **responsibility**: pure functions עבור parsing, validation, template replacement ו-rule matching.
- **functions**
  - `parseBoolean(value)` – תומך ב-boolean, מחרוזות `'true'`/`'1'`, אחרת `Boolean(value)`.
  - `sanitizeGrafanaPattern(pattern)` – ממיר string או object ל-`{ value: lower-case trimmed, type }`.
  - `validateGrafanaPatterns(patterns)`
    - תומך ב-string comma-separated.
    - דורש לפחות pattern אחד.
    - regex type נבדק ע"י `new RegExp`.
    - exact type דורש regex `/^[a-z0-9_-]+$/`.
  - `replaceTemplateVariables(template, alertData)`
    - מחליף placeholders בפורמט `{{ field }}` עבור השדות:
      `application`, `object_name`, `node_name`, `message`, `time_created`, `operator`, `network`.
    - שדות שלא ברשימה אינם מוחלפים.
  - `buildIncidentData(systemMapping, ruleOverrides = {}, alertData)`
    - required base fields: `service_offering`, `business_service`, `u_network`, `assignment_group`, `u_system_failure`.
    - עבור base fields:
      - אם override קיים, הוא גובר.
      - template substitution לא מבוצע עבור `assignment_group`, `service_offering`, `business_service`.
      - field ריק (מלבד `u_system_failure`) גורם throw.
    - מוסיף את כל שאר שדות ה-mapping שאינם `_id`, `grafana_names`, timestamps ואינם ריקים.
    - לאחר מכן overrides שאינם baseRequired דורסים שדות מה-mapping.
    - defaults אם חסרים:
      - `short_description = קפצה התראה על: ...`
      - `description = ההתראה:\n ...`
      - `u_operational_impact = "בבדיקה"`
  - `matchesGrafanaPattern(applicationName, pattern)`
    - exact → equality case-insensitive.
    - contains → substring.
    - regex → `new RegExp(normalizedPattern, 'i').test(applicationName)`.
  - `calculateRuleSpecificity(rule)`
    - `_exact` = 10 נקודות.
    - `_regex` = 7 נקודות.
    - `_contains` = 3 * count.
    - non-global bonus = 100.
  - `checkFieldConditions(value, conditions, fieldPrefix)`
    - מחזיר array של תוצאות boolean לכל condition בשדה.
  - `evaluateFieldResults(results, logicOperator)`
    - AND עם יותר מתוצאה אחת → every.
    - אחרת some.
  - `doesAlertMatchRule(alertData, rule)`
    - בודק fields: `message`, `node_name`, `object_name`, `operator`, `network`.
    - עבור network יש fallback legacy ל-`conditions.network` substring.
    - אם אין condition groups בכלל → false.
    - logic_operator AND/OR מוחל על קבוצות השדות.
  - `findAllMatches(alertData, rules)`
    - מסנן rules מתאימים.
    - מייצר objects עם `rule`, `score`, `is_global`.
    - sort descending לפי score.
  - `validateRuleConditions(conditions)`
    - בודק שה-regex fields הם regex תקין.
- **hidden coupling**
  - `buildIncidentData` מצפה למבנה שדות ספציפי במיפוי.
  - מערכת החוקים תלויה בשמות מפתחות suffix-based (`_contains`, `_exact`, `_regex`).

### `backend/services/incident/ServiceNowClient.js`
- **responsibility**: wrapper דק לקריאות REST ל-ServiceNow.
- **functions**
  - `constructor(config = {})`
    - קורא `SERVICENOW_URL`, `SERVICENOW_USERNAME`, `SERVICENOW_PASSWORD` או override שנמסר.
    - `enabled = Boolean(this.url)`.
  - `isEnabled()` – אמת רק אם `enabled` ו-`url` truthy.
  - `createIncident(incidentData)`
    - אם integration כבוי → מחזיר `{ success: false, message: 'ServiceNow integration disabled' }` בלי throw.
    - אחרת מבצע POST אל `${url}/api/now/table/incident` עם Basic Auth.
    - timeout = 10 שניות.
    - success response:
      - `success: true`
      - `incident_number`
      - `sys_id`
      - `link` לתצוגת incident ב-ServiceNow.
    - failure response:
      - `success: false`
      - `error`
      - `status`
      - שוב, ללא throw.
  - `fetchAssignmentGroups()`
    - אם integration כבוי → throw.
    - GET ל-`${url}/api/now/table/sys_user_group` עם `active=true`, fields `sys_id,name`, limit 1000.
    - ממפה ל-`{ value: sys_id, label: name }`.
    - בכשל → throw Error.
- **risks**
  - קריאה ל-`axios` קיימת אבל `axios` לא רשום ב-package dependencies.
  - `createIncident()` מחזיר failure envelope ולא exception; שכבות מעליו לא תמיד מטפלות בזה מפורשות.

## 4.5 Utils / Helpers / Constants
### `backend/utils/validateEnv.js`
- מכיל רשימות env חובה/מומלצים ופונקציית `validateEnvironmentVariables()`.
- בשימוש ב-`server.js` בלבד.
- חשוב כי הוא קובע fail-fast ב-production.
- coupling: mismatch מול `config/index.js` עבור Mongo URI כאמור.

### `backend/utils/errors.js`
- מכיל מחלקות `AppError`, `NotFoundError`, `ValidationError`, `ConflictError`, `UnauthorizedError`, `DatabaseError`, `ServiceNowError`.
- בפועל לא נמצא שימוש מהותי במחלקות הללו בקוד הנתון; ה-global error handler תומך ב-`err.status` ו-`err.code`, אך השירותים בדרך כלל זורקים `Error` רגיל.
- משמעות: התשתית קיימת אך אינה מנוצלת.

### `backend/utils/constants.js`
- מכיל:
  - `DEFAULTS` – `RULE_NAME`, `OPERATIONAL_IMPACT`, `ASSIGNMENT_GROUP`.
  - `RULE_TYPES` – `global`, `specific`.
  - `HTTP_STATUS`, `ERROR_CODES`.
  - `TEMPLATE_EXCLUDED_FIELDS`.
  - `VALID_DISTINCT_FIELDS`.
  - `INCIDENT_LOG_TTL_SECONDS = 90 days`.
- בפועל שימוש עקיף בעיקר מ-`errors.js`; לא נמצא שימוש פעיל בשאר הקבועים בשירותים עצמם.
- hidden coupling: `INCIDENT_LOG_TTL_SECONDS` לא בשימוש, והשירות משתמש literal `7776000`.

### `backend/utils/TimeUtils.js`
- מכיל class סטטי `TimeUtils` ו-export של `IL_ZONE`.
- תפקידים:
  - cache LRU בסיסי עם `Map` פנימי וגודל 2000.
  - המרות UTC → Israel time (`utcToIL`, `getILHour`, `getILDate`, `getILWeekday`).
  - batch helpers לשעות/תאריכים.
  - parsing של תאריך קלט ישראלי ל-UTC (`parseILToUTC`).
  - validation של date range (`validateDateRange`).
  - בדיקות `isNightHour`, `isDayHour`.
  - זמן נוכחי בישראל, timezone info, formatting duration, cache stats.
- בשימוש בפועל ב-`AlertService.getAlerts()` עבור shift derivation בלבד.
- risky behavior:
  - cache אינו LRU מלא; הוא מוחק את key הראשון שנכנס, שזה FIFO לפי `Map`, לא עדכון על access.
  - `validateDateRange()` לא משולב ב-routes/services הנוכחיים.

### `backend/utils/htmlTemplates.js`
- מכיל `getErrorHtml(error, details = '', action = null)`.
- בשימוש ב-`IncidentController.createIncidentFromAlertGET()` בלבד.
- חשוב כי זה endpoint יחיד שמחזיר HTML ולא JSON בעת שגיאה.

# 5. Database documentation
## 5.1 Database overview
- **database type**
  - Microsoft SQL Server לנתוני alerts/analytics.
  - MongoDB לנתוני configuration/logging של incident automation.
- **schemas**
  - SQL: schema יחיד שנמצא בקוד הוא `dbo`, טבלה `historicalAlerts`.
  - Mongo: אין schema enforced בקוד מלבד Joi עבור חלק מהקלטים.
- **connection method**
  - SQL: `mssql.ConnectionPool(dbConfig).connect()`.
  - Mongo: `new MongoClient(mongoConfig.uri)` + `db(mongoConfig.database)`.
- **ORM/query builder/raw SQL usage**
  - SQL: raw SQL templates עם parameter binding דרך `request.input()`.
  - Mongo: driver native (`find`, `aggregate`, `insertOne`, `updateOne`, `deleteOne`).
- **migration strategy**
  - לא נמצא בקוד שסופק. אין תיקיית migrations ואין כלי migration.
- **seed strategy**
  - לא נמצא בקוד שסופק.

## 5.2 Full SQL schema
### טבלה `dbo.historicalAlerts`
- **purpose**
  - מקור הנתונים היחיד לכל ה-analytics ולניתוח כיסוי incident.
- **full column list שנמצאה בשאילתות**
  - `incident_id`
  - `panel_title`
  - `application`
  - `node_name`
  - `network`
  - `object`
  - `operator`
  - `time_fired`
  - `time_resolved`
  - `duration_sec`
  - `message`
  - `key_field`
  - `incident_number`
  - `history_id`
- **data types / nullable / defaults / PK / FK / indexes / constraints / unique rules**
  - לא נמצא בקוד שסופק. אין DDL, migration או introspection של `INFORMATION_SCHEMA`.
- **relationships**
  - בקוד הלוגי בלבד:
    - `incident_number` משמש לקישור לאינסידנטים.
    - `panel_title` נתפס כ-team.
    - `application` נתפס כ-system/application.
- **important examples of stored data**
  - לא נמצאו דוגמאות row מלאות בקוד שסופק.

### Mongo collection `system_mappings_new`
- **purpose**: מיפוי בין Grafana application patterns ל-ServiceNow context.
- **שדות שנצפו בקוד**
  - `_id`
  - `grafana_names` – array של strings או objects `{ value, type }`
  - `service_offering`
  - `business_service`
  - `u_network`
  - `u_impact_technology`
  - `assignment_group`
  - `u_system_failure`
  - שדות נוספים דינמיים שעשויים להישמר ולעבור ל-incident payload
  - `created_at`
  - `updated_at`
- **constraints/indexes**
  - לא נמצא index מוגדר בקוד.
  - conflict uniqueness נאכף לוגית רק עבור exact patterns.

### Mongo collection `incident_rules_new`
- **purpose**: חוקי override ליצירת incident.
- **שדות שנצפו בקוד**
  - `_id`
  - `system_mapping_id`
  - `grafana_names`
  - `is_global`
  - `rule_name`
  - `description`
  - `conditions` עם keys אפשריים:
    - `message_contains`, `message_regex`, `message_exact`
    - `node_name_contains`, `node_name_regex`, `node_name_exact`
    - `object_name_contains`, `object_name_regex`, `object_name_exact`
    - `network_contains`, `network_regex`, `network_exact`, `network`
    - `operator_contains`, `operator_regex`, `operator_exact`
  - `logic_operator`
  - `incident_overrides`
  - `enabled`
  - `created_at`
  - `updated_at`
- **constraints/indexes**
  - לא נמצא index מפורש בקוד.

### Mongo collection `assignment_groups`
- **purpose**: cache מקומי לקבוצות שיוך מ-ServiceNow.
- **שדות שנצפו**
  - `_id: 'assignment_groups_store'`
  - `groups` – array של `{ value, label }`
  - `lastSynced`
  - `count`

### Mongo collection `incident_logs`
- **purpose**: audit/history של ניסיונות יצירת incident.
- **שדות שנצפו**
  - `_id`
  - `application`
  - `alert_source`
  - `incident_payload`
  - `servicenow_result`
  - `process_info.mapping_used`
  - `process_info.mapping_name`
  - `process_info.applied_rules`
  - `process_info.rule_stack_snapshot`
  - `created_at`
- **indexes**
  - TTL index על `created_at` עם `expireAfterSeconds: 7776000`.

## 5.3 Queries
להלן כל השאילתות שנמצאו ב-`backend/database/queries/alertQueries.js` וכל אינטראקציה DB ב-Mongo:

### SQL queries
1. **`SELECT_ALERTS`**
   - location: `backend/database/queries/alertQueries.js`
   - type: raw SQL
   - trigger: `AlertService.getAlerts()` כאשר clustering disabled.
   - parameters: `{TOP_CLAUSE}`, `{WHERE_CLAUSE}`, `{ORDER_CLAUSE}`, `{PAGINATION_CLAUSE}` + binds ל-filter params.
   - returned fields: כל שדות ה-alert הבסיסיים.
   - business purpose: רשימת התראות raw.
   - performance: תלוי מאוד ב-index על `time_fired` ועמודות filter/sort.

2. **`CLUSTERED_ALERTS`**
   - trigger: `getAlerts()` כאשר clustering enabled.
   - internal logic:
     - `Filtered` – סינון/סידור/pagination.
     - `Marked` – סימון cluster חדש אם `ABS(DATEDIFF(MINUTE, prev, current)) > @cluster_threshold`.
     - `Grouped` – cumulative sum ל-`cluster_id`.
     - `Clusters` – aggregation per cluster.
     - subquery `FOR JSON PATH` מחזיר `raw_alerts_json`.
   - risks: clustering נעשה גלובלית על כל ה-recordset לאחר filtering, לא per panel/application.

3. **`SELECT_BASIC_RECORDS`**
   - trigger: לא נמצא שימוש בקוד שסופק.
   - purpose: כנראה legacy בסיס לרשומות מצומצמות.

4. **`HOURLY_HEATMAP`**
   - trigger: `getHourlyHeatmap()` unclustered.
   - logic: bucket by IL hour + fill all 24 hours מתוך `sys.objects`.

5. **`DURATION_HISTOGRAM`**
   - trigger: `getDurationHistogram()` unclustered.
   - logic: שלושה buckets לפי `@dur_short_max`, `@dur_medium_max`.

6. **`SHIFT_ANALYSIS`**
   - trigger: `getShiftAnalysis()` unclustered.
   - returned fields:
     - `shift`, `alert_count`, `avg_duration`, `min_duration`, `max_duration`, `false_wakeups`, `true_alerts`, `unique_panels`, `unique_operators`.

7. **`PANEL_LIST`**
   - trigger: `getPanelList()` unclustered.
   - logic: `GROUP BY panel_title` עם counts ו-avg duration.

8. **`CLUSTERED_PANEL_LIST`**
   - trigger: `getPanelList()` clustered.
   - logic: clustering גלובלי ואז aggregation per panel_title.
   - risk: cluster יכול לחצות panels אם filtered data מכיל panel_title שונים רצופים בזמן, אך `MAX(panel_title)` יבחר אחד מהם. מאחר שלא מתבצע partition לפי panel, זהו coupling משמעותי.

9. **`PANEL_STATS`**
   - trigger: `getPanelStats()`.
   - logic: `GROUP BY panel_title, application`.

10. **`TOP_APPLICATIONS`**
    - trigger: `getTopApplications()`.

11. **`TOP_NODES_BY_APP`**
    - trigger: `getTopNodesByApp()`.
    - note: השם מרמז על by app, אבל WHERE clause לא מחייב `application`; אפשר להריץ בלי filter ולקבל top nodes גלובליים.

12. **`CONSECUTIVE_DAYS_NODES`**
    - trigger: `getConsecutiveDaysNodes()`.
    - logic: מזהה רצפים של לפחות 3 ימים עם alerts לאותו node.

13. **`UNCLUSTERED_KPI_STATS`**
    - trigger: `getExecutiveKPIs()` unclustered.
    - logic: percentile median + false/true wakeups + night metrics.

14. **`TIMESERIES`**
    - trigger: `getTimeseriesStats()` unclustered.

15. **`CLUSTERED_KPI_STATS`**
    - trigger: `getExecutiveKPIs()` clustered.
    - logic: clusters → durations → median + wakeup metrics.

16. **`CLUSTERED_HOURLY_HEATMAP`**
17. **`CLUSTERED_DURATION_HISTOGRAM`**
18. **`CLUSTERED_SHIFT_ANALYSIS`**
19. **`CLUSTERED_TIMESERIES`**
    - כל אחת היא גרסת clustered לשאילתה unclustered המקבילה.

20. **`UNCLUSTERED_TOP_NOISY_ALERTS`**
21. **`CLUSTERED_TOP_NOISY_ALERTS`**
    - trigger: batch panel analysis.
    - logic: top 10 messages לפי count ו-false_positive_rate.

22. **`CLUSTERED_PANEL_ANALYSIS_BATCH`**
    - trigger: `getPanelAnalysis()` clustered.
    - logic:
      1. drop temp table אם קיימת.
      2. build clusters.
      3. `SELECT * INTO #TempClusters`.
      4. מחזיר 5 resultsets: KPIs, timeseries, heatmap, duration, noisy.
      5. drop temp table.
    - performance: חוסך 5 round-trips במחיר temp table.

23. **`UNCLUSTERED_PANEL_ANALYSIS_BATCH`**
    - trigger: `getPanelAnalysis()` unclustered.
    - logic דומה עם `#TempRaw`.

24. **`INCIDENT_COVERAGE_STATS`**
25. **`INCIDENTS_BY_TEAM`**
26. **`INCIDENTS_BY_APPLICATION`**
27. **`INCIDENT_DAILY_TREND`**
    - trigger: `getIncidentStats()` unclustered.
    - purpose: BI של coverage מול incident_number.

28. **`CLUSTERED_INCIDENT_COVERAGE_STATS`**
29. **`CLUSTERED_INCIDENTS_BY_TEAM`**
30. **`CLUSTERED_INCIDENTS_BY_APPLICATION`**
31. **`CLUSTERED_INCIDENT_DAILY_TREND`**
    - trigger: `getIncidentStats()` clustered.
    - logic: אירוע = cluster; עדיין `unique_incidents` נספר מהטבלה raw.
- **performance considerations כלליים**
  - כל השאילתות מתבססות על `time_fired` + `AT TIME ZONE`, CTEs, window functions ו-`PERCENTILE_CONT`; אלה עלולים להיות כבדים על טבלאות גדולות.
  - שאילתות clustered אינן מבצעות `PARTITION BY` לפי panel/application ולכן clustering נעשה גלובלית על ה-resultset המסונן בלבד.
  - batch panel analysis משתמש temp tables, דבר שיכול להגדיל לחץ על tempdb.
- **risks**
  - placeholders כגון sort/order מוכנסים כמחרוזת, אך מוגבלים דרך Joi.
  - שימוש ב-`WHERE_CLAUSE` חוזר פעמיים בכמה שאילתות clustered incident coverage. אותו פילטר מוזרק פעמיים, וזה תקין אבל עלול לייקר query.

### Mongo queries
1. `incidentLogs.createIndex({ created_at: 1 }, { expireAfterSeconds: 7776000, background: true })`
   - trigger: lazy getter `IncidentService.db`.
   - purpose: TTL 90 יום.
2. `assignmentGroups.findOne({ _id: 'assignment_groups_store' })`
   - trigger: `getAssignmentGroups()`.
3. `assignmentGroups.updateOne(..., { upsert: true })`
   - trigger: `syncAssignmentGroups()`.
4. `incidentLogs.insertOne(...)`
   - trigger: `createIncidentFromAlert()`.
5. `incidentLogs.countDocuments(query)` + `find(query).sort({ created_at: -1 }).skip(skip).limit(limit)`
   - trigger: `getIncidentHistory()`.
6. `incidentRules.aggregate([...])`
   - trigger: `getIncidentRules()`.
7. `incidentRules.insertOne(dataToInsert)`
8. `incidentRules.updateOne({ _id }, { $set: updateData })`
9. `incidentRules.deleteOne({ _id })`
10. `incidentRules.updateOne({ _id }, { $set: { enabled, updated_at } })`
11. `systemMappings.find({}).toArray()`
12. `systemMappings.findOne(query)` עבור conflict check
13. `systemMappings.insertOne(dataToInsert)`
14. `systemMappings.updateOne({ _id }, { $set: updateData })`
15. `db.collection(incidentRules).countDocuments({ system_mapping_id: objId })`
16. `systemMappings.deleteOne({ _id: objId })`

## 5.4 Stored procedures / functions / views / triggers
- לא נמצא בקוד שסופק שימוש ב-stored procedures, SQL functions מוגדרות DB-side, views מפורשים, או triggers.
- `PERCENTILE_CONT` ו-`AT TIME ZONE` הם built-in SQL functions בתוך השאילתות, לא אובייקטי DB ייעודיים.

## 5.5 Migrations
- לא נמצא בקוד שסופק.

# 6. n8n documentation
## 6.1 Overview
- n8n לא נמצא בקוד שסופק.
- לא נמצאו workflows, exports, URLs, webhooks, credentials references או integration code.
- לכן אין אינטראקציה מוכחת בין backend זה ל-n8n.

## 6.2 Workflow inventory
- לא נמצא בקוד שסופק.

## 6.3 SQL and procedures used by n8n
- לא נמצא בקוד שסופק.

## 6.4 Maintenance
- לא רלוונטי לקוד שסופק כי n8n לא קיים בריפו.

# 7. Core business logic explanation
- **מה זה clustering במערכת הזאת**
  - clustering הוא מנגנון שממיר רצף התראות סמוכות בזמן לישות אנליטית אחת (“cluster” / “event”). המימוש מופיע כמעט בכל שאילתות ה-clustered ב-`alertQueries.js`.
- **איך clustering מחושב בפועל**
  - בכל ה-queries clustered:
    1. מסדרים לפי `time_fired`.
    2. משווים כל רשומה ל-`LAG(time_fired)`.
    3. אם `DATEDIFF(MINUTE, previous, current) > @cluster_threshold` אז `is_new_cluster = 1`, אחרת 0.
    4. `SUM(is_new_cluster) OVER (ORDER BY time_fired)` יוצר `cluster_id` מצטבר.
    5. מבצעים aggregation לפי `cluster_id`.
  - בכמה שאילתות נעשה `ABS(DATEDIFF(...))`, ובאחרות לא. בפועל, בגלל המיון העולה, התוצאה אמורה להיות חיובית גם בלי `ABS`.
- **מה המשמעות העסקית שלו**
  - הקטנת רעש: במקום לספור עשר התראות צפופות בזמן כעשר יחידות, אפשר להתייחס אליהן כאירוע אחד.
  - זה משנה KPI, false wakeups, coverage stats, heatmap, panel list, panel analysis ו-incident coverage.
- **מה זה shifts time impact**
  - “Shift” הוא חלוקה בינארית של התראות ל-`Day` או `Night` לפי שעות ישראל.
  - Day מוגדר כברירת מחדל `08:00 <= hour < 22:00`.
  - Night הוא כל היתר.
- **איך משמרות משפיעות על החישוב/תיעדוף/aggregation**
  - KPI queries מחשבות:
    - `night_alerts`
    - `night_true_wakeups`
    - `night_false_wakeups`
  - shift analysis מחזיר metrics נפרדים ל-Day/Night.
  - timeseries מחזיר `day_count` ו-`night_count` לכל יום.
  - `AlertService.getAlerts()` מוסיף לכל alert field `shift` ל-front-end.
- **מהו duration threshold**
  - במערכת יש כמה thresholds:
    - `dur_short_max` – גבול עליון ל-Short.
    - `dur_medium_max` – גבול עליון ל-Medium; מעליו Long.
    - `false_wakeup_threshold` – סף שמגדיר false wakeup מול true alert.
- **איפה הוא מוגדר**
  - ברירת מחדל ב-`backend/config/index.js`.
  - schema defaults גם ב-`backend/schemas/alertSchemas.js`.
  - bind לכל query דרך `_bindThresholds()` ב-`AlertService`.
- **איך שינוי threshold משפיע על התוצאה**
  - שינוי `false_wakeup_threshold`:
    - ישנה `false_wakeups`, `true_alerts`, `false_positive_rate_247`, `signal_ratio`, panel false positive count, top noisy false positive rate, shift analysis ו-summary panel analysis.
  - שינוי `dur_short_max`/`dur_medium_max`:
    - ישנה histograms, panel stats חלוקה short/medium/long, duration_category בחלק מהqueries. שימו לב: `duration_category` ב-`getAlerts()` עצמו *לא* ישתנה כי הוא hard-coded 30/300.
  - שינוי `cluster_threshold`:
    - יגדיל/יקטין כמות clusters.
    - סף גבוה יותר יוצר פחות clusters, durations ארוכים יותר, total_alerts clustered נמוך יותר.
- **KPI logic**
  - `total_alerts`: raw count או count של clusters.
  - `avg_duration`: average של `duration_sec` או `cluster_duration`.
  - `median_duration`: median SQL via `PERCENTILE_CONT`.
  - `false_positive_rate_247`: `false_wakeups / total_alerts * 100`.
  - `true_wakeups`: `night_true_wakeups`.
  - `signal_ratio`: `true_alerts / total_alerts * 100`.
- **aggregation logic**
  - רובן ב-SQL דרך `GROUP BY`, CTEs ו-window functions.
  - panel analysis batch מאגד 5 ויזואליזציות ב-query אחד.
- **filters**
  - date range על `time_fired`.
  - exact panel_title.
  - prefix match עבור application/node_name/network/object/operator.
  - min/max duration raw.
- **time windows**
  - dates נפרשים ל-start/end of day ב-Asia/Jerusalem ומומרים ל-UTC לפני query.
  - clustering threshold בדקות.
  - correlation/storm windows ב-schema קיימים אך לא נמצא consumer בקוד שסופק.
- **deduplication**
  - אין dedup incident creation מול incident קיים.
  - clustering משמש כסוג של dedup אנליטי.
- **anomaly / threshold / segmentation logic if exists**
  - anomaly detection לא נמצא בקוד שסופק.
  - segmentation קיים רק ברמות shift, duration bands, panel/application/node ו-clustered/unclustered.

# 8. KPI documentation
### KPI `total_alerts`
- **business meaning**: סך האירועים בטווח. ב-clustered זה מספר clusters; ב-unclustered מספר שורות raw.
- **exact formula**
  - unclustered: `COUNT(*)`
  - clustered: `COUNT(*) FROM FilteredClusters` או `COUNT(*) FROM ClusterStats`
- **source**: `UNCLUSTERED_KPI_STATS`, `CLUSTERED_KPI_STATS`, `INCIDENT_COVERAGE_STATS`, `CLUSTERED_INCIDENT_COVERAGE_STATS`, batch panel queries.
- **filters and exclusions**: WHERE dynamic לפי query params.
- **update frequency**: realtime per request.
- **exposed in**: `/api/stats/executive-kpis`, `/api/stats/panel-analysis`, `/api/stats/incident-stats`.
- **edge cases**: ב-clustered total תלוי בסף cluster threshold.

### KPI `avg_duration`
- **meaning**: משך ממוצע של alert/cluster.
- **formula**: `AVG(CAST(duration_sec AS FLOAT))` או `AVG(CAST(cluster_duration AS FLOAT))`.
- **source**: KPI queries, timeseries, heatmap, panel list, top noisy.
- **edge cases**: `NULL duration_sec` מומר ל-0 בחלק מהשאילתות clustered דרך `ISNULL`.

### KPI `median_duration`
- **meaning**: median duration ליציבות מול outliers.
- **formula**: `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration)`.
- **source**: KPI queries ו-batch panel analysis.
- **edge cases**: אם אין רשומות, SQL מחזיר `NULL`, service ממיר ל-0.

### KPI `false_wakeups`
- **meaning**: alerts/cluster duration <= `false_wakeup_threshold`.
- **formula**: `COUNT(CASE WHEN duration <= threshold THEN 1 END)`.
- **source**: KPI queries, shift analysis, panel list, top noisy, panel analysis.

### KPI `true_alerts`
- **meaning**: alerts/cluster duration > `false_wakeup_threshold`.
- **formula**: `COUNT(CASE WHEN duration > threshold THEN 1 END)`.

### KPI `false_positive_rate_247`
- **meaning**: אחוז false wakeups מכלל ה-alerts.
- **formula**: `(false_wakeups * 100) / total_alerts`, rounded to 1 decimal ב-service.
- **source**: `AlertService.getExecutiveKPIs()`.
- **exposed in**: `/api/stats/executive-kpis`.

### KPI `signal_ratio`
- **meaning**: אחוז true alerts מכלל ה-alerts.
- **formula**: `(true_alerts * 100) / total_alerts`.
- **source**: `AlertService.getExecutiveKPIs()`.

### KPI `true_wakeups`
- **meaning**: מספר night alerts שחצו את false wakeup threshold.
- **formula**: `night_true_wakeups` מתוך SQL.
- **source**: KPI queries.

### KPI `coverage_pct`
- **meaning**: שיעור events/alerts שיש להם `incident_number`.
- **formula**
  - unclustered: `COUNT(incident_number) * 100 / COUNT(*)`
  - clustered: `SUM(CASE WHEN unique_tickets_in_cluster > 0 THEN 1 ELSE 0 END) * 100 / COUNT(*)`
- **source**: incident coverage queries.
- **exposed in**: `/api/stats/incident-stats`.

### KPI `incident_creation_rate`
- **meaning**: מספר incident numbers ייחודיים ביחס לכלל alerts raw.
- **formula**: `COUNT(DISTINCT incident_number) * 100 / COUNT(*)`.
- **source**: רק `INCIDENT_COVERAGE_STATS` unclustered.
- **edge cases**: ב-clustered KPI זה לא מוחזר כלל.

### KPI `avg_alerts_per_incident`
- **meaning**: כמה alerts/events בממוצע לכל incident.
- **formula**
  - unclustered: `COUNT(incident_number) / COUNT(DISTINCT incident_number)`
  - clustered variants: covered clusters / unique incidents.
- **source**: coverage/team/application queries.

### KPI `health_score`
- **meaning**: ציון בריאות panel על בסיס רעש בלבד.
- **formula**: `max(0, 100 - ((false_positive_count / alert_count) * 100))`.
- **source**: `AlertService.getPanelList()`.
- **exposed in**: `/api/stats/panels`.

### KPI `alerts_per_day`
- **meaning**: ממוצע alerts ליום עבור panel analysis.
- **formula**: `Math.round(total / trendResult.length)`.
- **source**: `AlertService.getPanelAnalysis()`.
- **edge cases**: אם `trendResult.length` 0 → 0.

### איך להוסיף KPI חדש end to end
1. להוסיף query חדש ב-`backend/database/queries/alertQueries.js`.
2. להוסיף method ב-`AlertService` שמבצע `_execute()` ומחשב payload נגזר.
3. להוסיף method תואם ב-`AlertController`.
4. להוסיף route ב-`alertRoutes.js` + schema מתאים.
5. אם KPI שייך ל-panel analysis batch, לעדכן batch query ואת parsing ה-recordsets.
6. לעדכן תיעוד `docs/BACKEND_TECHNICAL_DOCUMENTATION_HE.md`.

# 9. How to add or change functionality
## 9.1 How to add a new query
- **where to place it**
  - SQL template חדש ב-`backend/database/queries/alertQueries.js`.
- **how to structure it**
  - להשתמש ב-placeholders קיימים כמו `{WHERE_CLAUSE}` ופרמטרים bound via `request.input()`.
  - אם נדרש limit, להשתמש ב-`@limit_param` ולא string concat.
- **how to wire it from DB to service to controller to route**
  1. template ב-queries.
  2. method ב-`AlertService` או service incident מתאים.
  3. controller method.
  4. route.
  5. schema Joi אם יש פרמטרים חדשים.
- **validation**
  - להוסיף field ב-schema המתאים ב-`schemas/`.
- **test considerations**
  - לפחות `node --check` ותרחיש ידני עם query params תקפים/שגויים.
- **performance considerations**
  - להעדיף aggregation ב-SQL.
  - לשקול אינדקס על עמודות filter/order חדשות.
  - אם query batch מחזיר הרבה נתונים, לשקול cap/limit.

## 9.2 How to add a new KPI
- **DB/query layer** – להוסיף query/להרחיב query קיים.
- **service layer** – לחשב defaults ו-derived fields.
- **controller/API exposure** – endpoint חדש או הרחבה ל-endpoint קיים.
- **n8n updates if relevant** – לא רלוונטי; n8n לא נמצא.
- **config/constants updates** – אם KPI תלוי threshold חדש, להוסיף ל-`CONFIG` ול-schema.
- **tests** – validation + shape response + cluster/unclustered parity אם נדרש.
- **docs to update** – מסמך זה וכל תיעוד usage רלוונטי.

## 9.3 How to add a new route
1. להחליט אם הוא analytics (`alertRoutes.js`) או incidents (`incidentRoutes.js`).
2. לכתוב schema ב-`backend/schemas/*.js` אם צריך.
3. להוסיף method ב-controller המתאים.
4. להוסיף service method.
5. לרשום route עם `validateQuery`/`validateBody`.
6. להחליט איזה CORS הוא יורש לפי mount path.

## 9.4 How to add a new service
1. ליצור קובץ תחת `backend/services/alert` או `backend/services/incident`.
2. להזריק dependencies דרך constructor אם נדרש.
3. לחבר אותו ב-route module ולמסור ל-controller.
4. אם יש DB access, להשתמש ב-`getSqlPool()`/`getMongoDb()` או service קיים.

## 9.5 How to add a new n8n workflow
- לא רלוונטי לקוד שסופק. אין n8n בריפו.

## 9.6 How to change thresholds safely
1. לעדכן defaults ב-`backend/config/index.js`.
2. לעדכן defaults/validation ב-`backend/schemas/alertSchemas.js` אם הערך exposed ל-API.
3. לבדוק impact על queries שמשתמשות ב-`_bindThresholds()`.
4. לבדוק `getAlerts()` כי `duration_category` שם hard-coded ולא מבוסס config.
5. לבדוק תלויות UI שצורכות ranges.
6. לתעד במפורש את השינוי במסמך זה.

# 10. File-by-file documentation
להלן תיעוד לכל קובץ backend בריפו, כולל קבצי תיעוד/metadata שבתיקיית backend.

### `backend/server.js`
- **file purpose**: bootstrap של שרת Express וכל lifecycle היישום.
- **exported items**: `{ app, startServer, shutdown }`.
- **imports and dependencies**: `dotenv`, `express`, `cors`, `helmet`, `compression`, `luxon`, `./config`, `./database/connection`, `./routes/alertRoutes`, `./routes/incidentRoutes`, `./utils/validateEnv`, `./middleware/queryLogger`.
- **functions/classes inside**
  - `startServer()` – מחבר מסדי נתונים ומרים listener.
  - `shutdown()` – סוגר server ו-connections.
- **what calls it**
  - בעת `node server.js`, `if (require.main === module) startServer()`.
  - tests/imports פוטנציאליים יכולים לייבא `app` בלי start.
- **what it calls**
  - `validateEnvironmentVariables()`, `initializeSqlDatabase()`, `initializeMongoDatabase()`, `closeConnections()`.
- **important notes**
  - import של `DateTime` מ-luxon לא נמצא בשימוש.
  - `CONFIG.server.port` קבוע 5000, אבל `PORT` בפועל מעדיף `CONFIG?.server?.port || process.env.PORT || 3000`, כלומר `process.env.PORT` לא יכול לגבור אם `CONFIG.server.port` קיים.

### `backend/config/index.js`
- **purpose**: מקור הקונפיגורציה המרכזי.
- **exports**: `CONFIG`, `dbConfig`, `mongoConfig`.
- **dependencies**: `dotenv` ו-`process.env`.
- **details**
  - `CONFIG.cache` כרגע לא בשימוש חוץ מהצהרה.
  - `CONFIG.duration`, `CONFIG.shifts`, `CONFIG.limits`, `CONFIG.clustering` מניעים את לוגיקת analytics.
  - `dbConfig.options.requestTimeout` ו-`connectTimeout` קבועים 30000.
  - `mongoConfig.uri` יכול להיבנות ממרכיבים אם `MONGO_URI` לא נמסר.

### `backend/database/connection.js`
- **purpose**: singleton connections ל-SQL/Mongo.
- **exports**: `initializeSqlDatabase`, `initializeMongoDatabase`, `getSqlPool`, `getMongoDb`, `closeConnections`.
- **details**
  - `initializeSqlDatabase()` מריץ query בדיקה על `dbo.historicalAlerts`.
  - `initializeMongoDatabase()` מדפיס את `mongoConfig.uri` ללוג, כולל credentials אם קיימים – סיכון אבטחה.
  - `getSqlPool()` ו-`getMongoDb()` זורקים שגיאה אם init לא בוצע.

### `backend/database/queries/alertQueries.js`
- **purpose**: מחסן כל raw SQL templates של analytics.
- **exports**: object עם 31 queries.
- **what calls it**: `AlertService` בלבד.
- **important notes**
  - כל השאילתות מכוונות לטבלת `dbo.historicalAlerts`.
  - clustering מופיע כחזרה על pattern SQL בכמה שאילתות במקום helper central.
  - אין pagination/limit בחלק מהשאילתות הסטטיסטיות כי הן מחזירות aggregates.

### `backend/controllers/AlertController.js`
- **purpose**: adapters של HTTP לשירות analytics.
- **exports**: `{ AlertController }`.
- **functions/classes**: class `AlertController` ו-12 handlers.
- **coupling**: תלוי בצורה חזקה בכך ש-`AlertService` מחזיר `{ success, data, meta }`.

### `backend/controllers/IncidentController.js`
- **purpose**: adapters של HTTP ל-incident automation.
- **exports**: `{ IncidentController }`.
- **dependencies**: `getErrorHtml`, `IncidentService`, `SystemMappingService`, `IncidentRuleService` דרך injection.
- **caveats**
  - מחזיר HTML ב-GET incident errors אבל JSON בכל שאר ה-endpoints.
  - יש mismatch messages ב-delete endpoints.

### `backend/routes/alertRoutes.js`
- **purpose**: registration של analytics routes.
- **exports**: `router`.
- **dependencies**: schemas, `AlertService`, `AlertController`, `validateQuery`.
- **notes**: route module עצמו אחראי ל-DI instantiation.

### `backend/routes/incidentRoutes.js`
- **purpose**: registration של incident routes.
- **exports**: `router`.
- **dependencies**: services, controller, validation, schemas.
- **notes**: comments על “protected routes” אינן מגובות ב-middleware כלשהו.

### `backend/middleware/validation.js`
- **purpose**: wrappers ל-Joi validation.
- **exports**: `validateQuery`, `validateBody`, `validateParams`.
- **caveats**: `schema.validate()` נקרא בלי `abortEarly: false` מפורש, אך Joi מחזיר ברירת מחדל errors לפי config default.

### `backend/middleware/queryLogger.js`
- **purpose**: dev-only logging middleware.
- **exports**: `{ queryLogger }`.
- **caveats**: עוטף `res.json`; אם handler משתמש ב-`res.send` הוא לא יתפוס זאת.

### `backend/schemas/alertSchemas.js`
- **purpose**: כל Joi schemas ל-alert endpoints.
- **exports**: `alertsSchema`, `statsSchema`, `statsSchemaRequiredPanel`, `panelStatsSchema`, `timeseriesSchema`, `panelResearchSchema`, `patternSchema`.
- **notes**
  - `patternSchema` לא נמצא בשימוש.
  - `duration_metric` קיים ב-baseSchema אך לא נצרך ב-service.
  - `night_start` ו-`night_end` validated אך לא נצרכים בפועל ברוב ה-SQL analytics, שמסתמכות על day_start/day_end בלבד.

### `backend/schemas/incidentSchemas.js`
- **purpose**: Joi schemas ל-incident routes.
- **exports**: `alertQuerySchema`, `serviceNowAlertSchema`, `combinedCreateSchema`, `systemMappingSchema`, `incidentRuleSchema`.
- **notes**
  - `serviceNowAlertSchema` ו-`combinedCreateSchema` לא נמצאו בשימוש ב-routes הנוכחיים.
  - `systemMappingSchema` מאפשר `.unknown(true)`, כלומר שדות נוספים מותרים ויישמרו ב-Mongo.

### `backend/services/alert/AlertService.js`
- **purpose**: analytics service יחיד.
- **exports**: class `AlertService`.
- **imports**: `mssql`, `getSqlPool`, `queries`, `CONFIG`, `TimeUtils`.
- **what calls it**: `alertRoutes.js` דרך `AlertController`.
- **what it calls**: raw SQL מול SQL Server.
- **critical caveats**
  - שימוש ב-Luxon ישירות במקום `TimeUtils.parseILToUTC()`.
  - `MAX_PAGE_SIZE` לא נאכף.
  - clustering גלובלי ולא מפולח.

### `backend/services/incident/IncidentService.js`
- **purpose**: orchestrator של אינסידנטים ו-history.
- **exports**: class `IncidentService`.
- **imports**: `getMongoDb`, `mongoConfig`, `ServiceNowClient`, `helpers`.
- **notes**
  - createIncidentWithAlert לא מחובר ל-route.
  - insert log הוא fire-and-forget.

### `backend/services/incident/IncidentRuleService.js`
- **purpose**: CRUD rules.
- **exports**: class `IncidentRuleService`.
- **notes**
  - aggregate pipeline מחזיר גם `system_mapping`, אך filter בהמשך מבוסס על `rule.grafana_names` ולא על `system_mapping.grafana_names`.

### `backend/services/incident/SystemMappingService.js`
- **purpose**: CRUD mappings.
- **exports**: class `SystemMappingService`.
- **notes**
  - `getMappingByApplication()` מבצע scan מלא; complexity ליניארית במספר mappings.

### `backend/services/incident/ServiceNowClient.js`
- **purpose**: REST client ל-ServiceNow.
- **exports**: `{ ServiceNowClient }`.
- **notes**
  - password ו-username לא נבדקים לפני request; אם חסרים, axios עדיין ינסה.

### `backend/services/incident/incidentHelpers.js`
- **purpose**: pure business logic עזר.
- **exports**: כל helper functions.
- **critical coupling**
  - suffix naming של rule condition keys.
  - buildIncidentData מעביר אוטומטית כל שדה דינמי מהמיפוי ל-ServiceNow payload.

### `backend/utils/TimeUtils.js`
- **purpose**: זמן/אזור זמן/cache.
- **exports**: `{ TimeUtils, IL_ZONE }`.
- **notes**: רוב היכולות לא מנוצלות כיום, אך מהוות infrastructure לפיתוח נוסף.

### `backend/utils/constants.js`
- **purpose**: constants כלליים.
- **exports**: constants objects.
- **notes**: שימוש חלקי בלבד.

### `backend/utils/errors.js`
- **purpose**: custom errors.
- **exports**: error classes.
- **notes**: לא מנוצל בפועל ברוב שכבות הקוד.

### `backend/utils/htmlTemplates.js`
- **purpose**: HTML error page RTL.
- **exports**: `{ getErrorHtml }`.
- **notes**: קובץ תצוגה backend-side יחיד.

### `backend/utils/validateEnv.js`
- **purpose**: env validation.
- **exports**: `validateEnvironmentVariables`, `REQUIRED_ENV_VARS`, `RECOMMENDED_ENV_VARS`.
- **notes**: validator מחמיר יותר מה-config builder בתחום Mongo.

### `backend/README.md`
- **purpose**: תיעוד high-level.
- **notes**: לא תואם במלואו לקוד הנוכחי; מוזכרים קבצים/routes שלא קיימים (`StatsController.js`, `health/ready`, `health/live`, `response.js` ועוד).
- **risk**: עלול להטעות אם נשען עליו בלי לבדוק קוד.

### `backend/CONFLUENCE_DOCS.md`
- **purpose**: תיעוד ארכיטקטוני כללי.
- **notes**: גם הוא מתאר שירותים (`AlertQueryService`, `AlertAnalysisService`, `routeHandler.js`) שלא קיימים בריפו הנוכחי.
- **risk**: מסמך legacy שאינו מייצג את המימוש בפועל.

### `backend/package.json`
- **purpose**: הגדרת package backend.
- **scripts**: `start`, `dev`, `test`, `test:watch`, `test:coverage`.
- **dependencies**: `compression`, `cors`, `dotenv`, `express`, `helmet`, `joi`, `lru-cache`, `luxon`, `mongodb`, `mssql`.
- **notes**: `axios` לא מופיע למרות import בקוד.

### `backend/.gitignore`
- **purpose**: git ignore מקומי ל-backend.
- **implementation detail**: קובץ boilerplate; לא משפיע על runtime.

# 11. Configuration and environment
- **all env vars found in code**
  - `DURATION_SHORT_MAX`
  - `DURATION_MEDIUM_MAX`
  - `DURATION_FALSE_WAKEUP`
  - `NODE_ENV`
  - `ALLOWED_ORIGINS`
  - `FRONTEND_URL`
  - `SHIFT_DAY_START`
  - `SHIFT_DAY_END`
  - `SHIFT_NIGHT_START`
  - `SHIFT_NIGHT_END`
  - `QUERY_DEFAULT_CAP`
  - `QUERY_MAX_PAGE_SIZE`
  - `QUERY_MAX_DATE_RANGE_DAYS`
  - `SQL_QUERY_TIMEOUT_MS`
  - `CLUSTER_ENABLED_DEFAULT`
  - `CLUSTER_THRESHOLD_MINUTES`
  - `SQL_SERVER`
  - `SQL_PORT`
  - `SQL_DATABASE`
  - `SQL_USER`
  - `SQL_PASSWORD`
  - `SQL_ENCRYPT`
  - `SQL_POOL_MAX`
  - `SQL_POOL_MIN`
  - `MONGO_URI`
  - `MONGO_USER`
  - `MONGO_PASSWORD`
  - `MONGO_HOST`
  - `MONGO_PORT`
  - `MONGO_DB`
  - `MONGO_AUTH_DB`
  - `SERVICENOW_URL`
  - `SERVICENOW_USERNAME`
  - `SERVICENOW_PASSWORD`
  - `PORT`
- **where each one is used / required / optional / defaults / impact**
  - `SQL_*` – חובה בפועל לחיבור MSSQL. ללא ערכים נכונים השרת ייפול ב-startup.
  - `MONGO_URI` – חובה ב-validator production, אופציונלי לפי config builder אם שדות `MONGO_*` קיימים.
  - `SERVICENOW_*` – נדרשים פונקציונלית ל-incident integration; ללא URL, `createIncident()` תחזיר disabled result.
  - `FRONTEND_URL` – נצרך ל-CORS restricted ול-error action link.
  - `ALLOWED_ORIGINS` – רשימת origins מופרדת בפסיקים ל-production restricted CORS.
  - `PORT` – למעשה בעל עדיפות נמוכה מ-`CONFIG.server.port` הקשיח 5000.
  - `SHIFT_*`, `DURATION_*`, `CLUSTER_*`, `QUERY_*` – defaults מובנים קיימים.
- **secrets handling**
  - סיסמאות SQL, Mongo ו-ServiceNow נקראות ישירות מ-env.
  - אין secrets manager.
  - יש סיכון ל-leak בלוגים: `initializeMongoDatabase()` מדפיס URI מלא.

# 12. Error handling and observability
- **global error flow**
  - middleware/controller יכולים לקרוא `next(error)`.
  - global handler ב-`server.js` ממפה ל-HTTP status מתוך `err.status` או 500.
- **try/catch strategy**
  - controllers עוטפים כמעט כל handler ב-try/catch.
  - services עצמם לרוב לא עוטפים; הם זורקים `Error` רגיל או מחזירים envelope failure.
- **custom errors**
  - קיימים ב-`utils/errors.js` אך כמעט לא בשימוש.
- **logging**
  - `console.log`, `console.warn`, `console.error` בלבד.
  - `queryLogger` נותן observability בסיסי ב-development בלבד.
- **monitoring**
  - health endpoint יחיד: `/api/health`.
  - readiness/liveness מפורטים לא נמצאו בקוד שסופק.
- **alerting**
  - לא נמצא בקוד שסופק.
- **missing observability gaps**
  - אין request IDs.
  - אין structured logging.
  - אין metrics exporter.
  - אין tracing.
  - failure של `incidentLogs.insertOne` רק מודפס ולא מנוטר.

# 13. Security
- **auth/authz flow**
  - לא נמצא בקוד שסופק.
  - כל routes זמינים ללא auth middleware.
- **middleware protections**
  - `helmet` headers.
  - `cors` restricted/public לפי path.
  - Joi validation.
- **validation**
  - query/body schemas מגבילים שדות וערכים ידועים.
  - sort fields whitelist מגבילה injection במסלולי SQL.
- **injection risks**
  - SQL injection: parameter binding קיים לרוב השדות; placeholders של SQL מורכבים מסטים מבוקרים דרך Joi.
  - Mongo regex search ב-`getIncidentHistory` משתמש input ישירות ל-`$regex`, דבר שעלול לגרום ReDoS או regex heavy query.
- **sensitive data handling**
  - `queryLogger` מצנזר keys רגישים.
  - אך Mongo URI מודפס ללוג ללא צנזורה.
- **permission boundaries**
  - אין enforcement של הרשאות על CRUD mappings/rules.
- **webhook security**
  - `GET /api/incidents/incident` פתוח ב-CORS public וללא auth. אם נחשף חיצונית, כל מי שמכיר payload תקין יכול לנסות ליצור incident.
- **DB access risks**
  - טבלת analytics נקראת בקריאות כבדות ללא rate limiting.
  - Mongo writes מתבצעים ללא schema enforcement server-side מעבר ל-Joi ב-inputs מסוימים.

# 14. Performance and technical debt
- **heavy queries**
  - clustered KPI/coverage queries עם `LAG`, `SUM OVER`, `PERCENTILE_CONT`.
  - batch panel analysis עם temp tables.
  - `getMappingByApplication()` ו-`getIncidentRules(application)` מבצעים scan/filter בזיכרון.
- **repeated logic**
  - נוסחת clustering משוכפלת בהרבה שאילתות.
  - conversion ל-Israel time משוכפל גם ב-SQL וגם ב-Node.
- **tight coupling**
  - controllers מצפים ל-shape ספציפי מה-services.
  - schema field names suffix-based קשורים ישירות ל-incidentHelpers.
  - ServiceNow payload structure תלוי בשמות fields במיפוי Mongo.
- **fragile areas**
  - `deleteSystemMapping` / `deleteIncidentRule` success message undefined.
  - `duration_category` hard-coded.
  - `PORT` env לא באמת גובר על config constant.
  - lack of auth על endpoints מסוכנים.
  - `axios` missing dependency declaration.
  - logging of `mongoConfig.uri` exposes secrets.
- **scalability risks**
  - unbounded/large default limit (`100000`).
  - clustering queries global across whole filtered dataset.
  - lack of page size enforcement.
  - no cache for expensive statistics למרות section config.
- **likely bug-prone files**
  - `backend/services/alert/AlertService.js`
  - `backend/database/queries/alertQueries.js`
  - `backend/controllers/IncidentController.js`
  - `backend/database/connection.js`
- **recommendations grounded in current code**
  - להכריח auth/authz לפחות על CRUD incident mappings/rules ועל incident creation endpoints.
  - להפסיק להדפיס `mongoConfig.uri` בלוג.
  - להוסיף `axios` ל-`backend/package.json` או להסיר תלות לא מוצהרת.
  - לאכוף `MAX_PAGE_SIZE` ב-`AlertService.getAlerts()`.
  - לאחד את לוגיקת clustering helper-side או SQL macro-style כדי לצמצם divergence.
  - לבחון clustering עם `PARTITION BY` אם עסקית cluster צריך להיות תחום לפי panel/application.
  - להחליף `duration_category` hard-coded לשימוש ב-thresholds runtime.

# 15. Appendix
- **glossary of project-specific terms**
  - `historicalAlerts` – טבלת SQL המרכזית של כל התראות ההיסטוריות.
  - `false wakeup` – alert/cluster עם duration קטן או שווה ל-`false_wakeup_threshold`.
  - `cluster` – קיבוץ alerts סמוכים בזמן לאירוע יחיד.
  - `system mapping` – mapping בין `application` מהתראה ל-ServiceNow business context.
  - `incident rule` – חוק override שמשנה payload ל-ServiceNow לפי תנאים על התראה.
  - `assignment group` – קבוצה ב-ServiceNow שנשמרת גם ב-Mongo cache.
- **request/response examples**
  - `GET /api/alerts?start_date=2026-03-01&end_date=2026-03-07&application=app1&clustering_enabled=true`
    - response shape:
```json
{
  "success": true,
  "data": [
    {
      "id": 123,
      "panel_title": "NOC Team",
      "application": "app1",
      "node_name": "node-01",
      "network": "prod",
      "object": "cpu",
      "operator": "gt",
      "time_fired": "2026-03-01T01:00:00.000Z",
      "time_resolved": "2026-03-01T01:03:00.000Z",
      "duration_sec": 180,
      "duration_category": "medium",
      "shift": "Night",
      "message": "CPU high",
      "key_field": "...",
      "incident_number": "INC0012345",
      "history_id": 999,
      "is_cluster": true,
      "cluster_count": 4,
      "raw_alerts": []
    }
  ],
  "meta": {},
  "count": 1
}
```
  - `POST /api/incidents/incident`
```json
{
  "application": "app1",
  "object_name": "db-prod-01",
  "node_name": "node-01",
  "message": "CPU high",
  "time_created": "2026-03-20T10:00:00Z",
  "operator": "gt",
  "network": "prod",
  "user": "monitoring.user"
}
```
- **SQL examples**
  - false wakeup histogram raw:
```sql
SELECT 
  COUNT(CASE WHEN duration_sec <= @dur_short_max THEN 1 END) AS short_count,
  COUNT(CASE WHEN duration_sec > @dur_short_max AND duration_sec <= @dur_medium_max THEN 1 END) AS medium_count,
  COUNT(CASE WHEN duration_sec > @dur_medium_max THEN 1 END) AS long_count
FROM dbo.historicalAlerts {WHERE_CLAUSE}
```
  - cluster detection core:
```sql
CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (ORDER BY time_fired), time_fired) > @cluster_threshold
THEN 1 ELSE 0 END AS is_new_cluster
```
- **dependency graph summaries**
  - analytics graph:
    - `server.js` → `alertRoutes.js` → `AlertController.js` → `AlertService.js` → `alertQueries.js` + `database/connection.js` → SQL Server.
  - incident graph:
    - `server.js` → `incidentRoutes.js` → `IncidentController.js` → `IncidentService.js` / `SystemMappingService.js` / `IncidentRuleService.js` → MongoDB / `ServiceNowClient.js` → ServiceNow.
  - utilities graph:
    - `AlertService.js` → `TimeUtils.js`
    - `IncidentController.js` → `htmlTemplates.js`
    - `server.js` → `validateEnv.js`, `queryLogger.js`
