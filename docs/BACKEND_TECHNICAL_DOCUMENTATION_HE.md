# 1. מבוא והקשר מערכת
- **מטרת המערכת**
  - המערכת מספקת backend ב-Node.js/Express עבור שני תחומים עיקריים:
    1. חשיפת נתוני `dbo.historicalAlerts` ממסד SQL Server כ-API אנליטי עבור dashboard-ים, KPI-ים, heatmap-ים, histogram-ים, ניתוח צוותים/אפליקציות וניתוח לפי `panel_title`.
    2. יצירת incidents ב-ServiceNow על בסיס התראות נכנסות, תוך שימוש במיפויי מערכת (`system_mappings_new`) וחוקי override (`incident_rules_new`) השמורים ב-MongoDB. המימוש נמצא ב-`backend/server.js`, `backend/routes/*.js`, `backend/controllers/*.js`, `backend/services/**/*.js`. 
- **הבעיה העסקית שהמערכת פותרת**
  - בצד האנליטי: מאפשרת למדוד רעש התראות, false wakeups, השפעת משמרות יום/לילה, רצפים של ימים, חלוקת משכים, כיסוי incidents ואיכות פאנלים/אפליקציות, ישירות מעל `dbo.historicalAlerts`. 
  - בצד האופרציוני: מאפשרת לקחת alert עם שדות כמו `application`, `object_name`, `node_name`, `message`, `operator` ולתרגם אותו אוטומטית ל-incident ב-ServiceNow לפי mapping בסיסי וחוקי override. 
- **הארכיטקטורה הכללית**
  - Entry point יחיד: `backend/server.js`.
  - שכבת HTTP: `routes` → `controllers`.
  - שכבת לוגיקה עסקית: `services/alert/AlertService.js`, `services/incident/*.js`.
  - שכבת עזר: `utils/*.js`, `middleware/*.js`, `schemas/*.js`.
  - שכבת SQL: `backend/database/connection.js` + `backend/database/queries/alertQueries.js`.
  - שכבת MongoDB: אותן פונקציות connection דרך `getMongoDb()` וצריכה ישירה ב-services של incident.
  - אינטגרציה חיצונית: `ServiceNowClient` שולח HTTP ל-ServiceNow.
- **זרימת מידע מקצה לקצה**
  - זרימת אנליטיקה:
    - Client → route ב-`alertRoutes.js` → `validateQuery(...)` → `AlertController` → `AlertService` → `mssql` query מול `dbo.historicalAlerts` → format ב-service → JSON response.
  - זרימת יצירת incident:
    - Grafana/Client → `/api/incidents/incident` (`GET`/`POST`) → validation → `IncidentController` → `IncidentService.createIncidentFromAlert()` → `SystemMappingService.getMappingByApplication()` → `IncidentRuleService.getIncidentRules()` → `incidentHelpers.findAllMatches()` + `buildIncidentData()` → `ServiceNowClient.createIncident()` → כתיבת log ל-`incident_logs` ב-MongoDB → redirect או JSON response.
  - זרימת cache/TTL:
    - אין cache middleware גלובלי פעיל. יש cache פנימי ב-`TimeUtils` בלבד, מסוג `Map` עם eviction ידני.
    - ל-`incident_logs` מוגדר TTL index דינמי בזמן ריצה ב-`IncidentService.db`.
- **שירותים חיצוניים**
  - SQL Server דרך `mssql`.
  - MongoDB דרך `mongodb` driver.
  - ServiceNow REST API דרך `ServiceNowClient`.
  - `luxon` עבור timezone conversion ל-`Asia/Jerusalem` ול-`Israel Standard Time`.
- **תלות ב-n8n, מסד נתונים, cron jobs, APIs, queues, cache, webhooks, authentication, authorization**
  - `n8n`: **לא נמצא בקוד שסופק**. אין תיקיית workflow, אין exports של n8n, ואין webhook registration של n8n.
  - מסד נתונים: כן. SQL Server + MongoDB.
  - cron jobs: **לא נמצא בקוד שסופק**.
  - queues: **לא נמצא בקוד שסופק**.
  - cache: קיים cache מקומי ב-`TimeUtils`; אין Redis ואין cache service חיצוני.
  - webhooks: בפועל `GET /api/incidents/incident` ו-`POST /api/incidents/incident` מיועדים לקליטת alert payload, והקוד מציין שימוש של Grafana webhook/comment-level behavior. 
  - authentication/authorization: **לא מיושם בקוד שסופק**. אין auth middleware, אין token validation, אין role enforcement, אף על פי שהערות במסלולים מדברות על "authenticated users".

# 2. מבנה הפרויקט המלא
- **Tree מלא של התיקיות והקבצים**
```text
alerts/
  .gitignore
  package.json
  backend/
    .gitignore
    CONFLUENCE_DOCS.md
    README.md
    package.json
    server.js
    config/
      index.js
    controllers/
      AlertController.js
      IncidentController.js
    database/
      connection.js
      queries/
        alertQueries.js
    middleware/
      queryLogger.js
      validation.js
    routes/
      alertRoutes.js
      incidentRoutes.js
    schemas/
      alertSchemas.js
      incidentSchemas.js
    services/
      alert/
        AlertService.js
      incident/
        IncidentRuleService.js
        IncidentService.js
        ServiceNowClient.js
        SystemMappingService.js
        incidentHelpers.js
    utils/
      TimeUtils.js
      constants.js
      errors.js
      htmlTemplates.js
      validateEnv.js
  docs/
    ADDING_METRICS.md
    DATABASE_GUIDE.md
    FRONTEND_GUIDE.md
    INCIDENT_LOGIC.md
  frontend/
    .gitignore
    README.md
    package.json
    public/
      favicon.ico
      index.html
      logo192.png
      logo512.png
      manifest.json
      robots.txt
    src/
      App.jsx
      icons.js
      index.css
      index.js
      components/
        IncidentMappings/
          IncidentMappingsHeader.jsx
          MappingCard.jsx
          MappingForm.jsx
          MappingFormPatternBuilder.jsx
        IncidentRules/
          ConditionBuilder.jsx
          EmptyState.jsx
          IncidentOverrides.jsx
          IncidentRulesHeader.jsx
          RuleCard.jsx
          RuleForm.jsx
          RuleSimulator.jsx
          constants.js
        PanelResearch/
          ConsecutiveDaysTable.jsx
          ResearchHourlyHeatmap.jsx
          ResearchSummaryCards.jsx
          ResearchTrendCharts.jsx
          TopApplicationsChart.jsx
          TopNoisyAlertsList.jsx
          TopNoisyNodesTable.jsx
        dashboard/
          AlertTable.jsx
          WakeupGauge.jsx
        layout/
          ColumnVisibilityPanel.jsx
          Layout.jsx
          ThemeToggle.jsx
        ui/
          ChartCard.jsx
          CustomSelect.jsx
          DateRangePicker.jsx
          ErrorBoundary.jsx
          ErrorCallout.jsx
          LabeledInput.jsx
          LazyInput.jsx
          LoadingSkeleton.jsx
          LoadingSpinner.jsx
          MetricCard.jsx
          Tooltip.jsx
      contexts/
        ClientConfigContext.jsx
        ThemeContext.jsx
      hooks/
        useApiData.js
        useDurationBands.js
        useUrlState.js
      pages/
        ExplorerPage.jsx
        HowToUsePage.jsx
        IncidentHistoryPage.jsx
        IncidentManagment.jsx
        IncidentRules.jsx
        Incidentstatspage.jsx
        NOCDashboard.jsx
        NotFoundPage.jsx
        PanelResearchPage.jsx
        SettingsPage.jsx
        IncidentMappings/
          IncidentMappings.jsx
          IncidentMappingsList.jsx
      utils/
        api.js
        chartConfig.js
        constants.js
        dateUtils.js
        formatters.js
        themedStyles.jsx
```
- **עבור כל תיקייה: תפקידה**
  - `backend/`: כל השרת, ה-API, גישה ל-SQL/Mongo ו-ServiceNow.
  - `backend/config/`: בניית אובייקטי קונפיגורציה מה-`process.env`.
  - `backend/controllers/`: שכבת HTTP דקה שמחזירה responses ומעבירה שגיאות ל-Express.
  - `backend/database/`: אתחול חיבורים ושמירת SQL templates.
  - `backend/middleware/`: Joi validation + dev logging.
  - `backend/routes/`: מיפוי paths ל-controller methods.
  - `backend/schemas/`: הגדרות Joi ל-query/body.
  - `backend/services/alert/`: לוגיקת SQL analytics.
  - `backend/services/incident/`: לוגיקת mapping/rules/ServiceNow/logging.
  - `backend/utils/`: utilities, constants, errors, HTML template.
  - `docs/`: מסמכי פרויקט קיימים. אינם נטענים ע"י runtime.
  - `frontend/`: יישום ה-React הצורך את ה-backend. לא חלק מ-runtime ה-backend, אבל תלוי ב-API שלו.
- **עבור כל קובץ: תפקידו, נקודת הכניסה שלו, במי הוא תלוי, מי תלוי בו**
  - קבצי backend מתועדים בהרחבה בסעיף 10.
  - `package.json` בשורש: script יחיד שמריץ frontend + backend יחד. לא נקודת כניסה runtime ישירה לשרת.
  - `backend/server.js`: נקודת הכניסה האמיתית ל-backend.
  - `backend/config/index.js`: תלוי ב-`dotenv`; נצרך ע"י server/services/connection.
  - `backend/database/connection.js`: נצרך ע"י `server.js`, `AlertService`, `IncidentService`, `SystemMappingService`, `IncidentRuleService`.
  - `backend/database/queries/alertQueries.js`: נצרך רק ע"י `AlertService`.
  - `backend/routes/*.js`: נצרכים ע"י `server.js`.
  - `backend/controllers/*.js`: נצרכים ע"י routes.
  - `backend/services/alert/AlertService.js`: נצרך ע"י `alertRoutes.js`.
  - `backend/services/incident/*`: נצרכים ע"י `incidentRoutes.js` / בינם לבין עצמם.
  - `backend/schemas/*.js`: נצרכים ע"י routes דרך middleware validation.
  - `backend/utils/htmlTemplates.js`: נצרך רק ע"י `IncidentController` עבור error page HTML.
  - `backend/utils/TimeUtils.js`: נצרך רק ע"י `AlertService` בקוד שסופק.
  - `backend/utils/errors.js` ו-`backend/utils/constants.js`: מוגדרים אך כמעט אינם משולבים בזרימת runtime הנוכחית.
- **קבצים קריטיים במיוחד**
  - `backend/server.js`: bootstrap, middleware registration, routing, startup/shutdown.
  - `backend/services/alert/AlertService.js`: מרכז כל הלוגיקה האנליטית והחיבור ל-SQL.
  - `backend/database/queries/alertQueries.js`: כל ה-SQL templates כולל clustering.
  - `backend/services/incident/IncidentService.js`: orchestrator מלא ליצירת incidents.
  - `backend/services/incident/incidentHelpers.js`: הלוגיקה של התאמת חוקים והרכבת payload.
  - `backend/services/incident/SystemMappingService.js`: resolution של application → mapping.
  - `backend/services/incident/IncidentRuleService.js`: חיפוש/CRUD לחוקים והצמדת snapshot של `grafana_names`.

# 3. נקודת הכניסה של המערכת
- **server/app/bootstrap**
  - הקובץ `backend/server.js` עושה `require('dotenv').config()` לפני כל import אחר, ולכן טעינת `.env` מתרחשת ראשון.
  - לאחר מכן נטענים Express, middleware ספרייתיים, `CONFIG`, חיבורי DB, routes ו-utilities.
- **initialization sequence**
  1. טעינת `.env`.
  2. טעינת `CONFIG` מתוך `backend/config/index.js`.
  3. `validateEnvironmentVariables()` מופעל מיד בזמן import/boot.
  4. יצירת `app = express()`.
  5. רישום middleware: `helmet`, CORS, `compression`, body parsers, `queryLogger` ב-dev.
  6. רישום health endpoint inline.
  7. רישום `alertRoutes` תחת `/api` ו-`incidentRoutes` תחת `/api/incidents`.
  8. רישום 404 handler.
  9. רישום global error handler.
  10. אם הקובץ הורץ ישירות (`require.main === module`) מופעל `startServer()`.
  11. `startServer()` מחבר SQL ואז Mongo ואז מתחיל `app.listen(PORT)`.
- **config loading**
  - `backend/config/index.js` קורא את env vars ומרכיב:
    - `CONFIG.cache`
    - `CONFIG.duration`
    - `CONFIG.cors`
    - `CONFIG.shifts`
    - `CONFIG.tz`
    - `CONFIG.server`
    - `CONFIG.limits`
    - `CONFIG.clustering`
    - `dbConfig`
    - `mongoConfig`
  - ערכי ברירת מחדל נקבעים עם `parseInt(... ) || default`, ולכן `0` אינו נתמך כערך תקף ברובם גם אם תיאורטית רצוי.
- **env validation**
  - `validateEnvironmentVariables()` בודק רשימות required/recommended.
  - ב-production: חוסר ב-env required גורם ל-`process.exit(1)`.
  - ב-development: רק `console.warn`.
  - אין ולידציה של format, רק presence.
- **database connection**
  - SQL: `initializeSqlDatabase()` פותח `new sql.ConnectionPool(dbConfig).connect()`, ואז מריץ query בדיקה `SELECT COUNT(*) as total_records FROM dbo.historicalAlerts`.
  - Mongo: `initializeMongoDatabase()` יוצר `new MongoClient(mongoConfig.uri)`, מתחבר, בוחר DB לפי `mongoConfig.database`, ואז מבצע `countDocuments()` על collection `system_mappings_new`.
  - אם אחת מההתחברויות נכשלת: מודפס log ו-`process.exit(1)`.
- **middleware registration**
  - `helmet` עם `crossOriginResourcePolicy: cross-origin`, ו-`contentSecurityPolicy: false`.
  - CORS נרשם פעמיים:
    - `/api/health` עם `publicCors`.
    - `/api` עם `restrictedCors`.
    - `/api/incidents` עם `publicCors`.
  - סדר זה יוצר בפועל גישה פתוחה יותר ל-routes של incidents.
- **route registration**
  - `/api/health` מוגדר inline.
  - `/api` → `alertRoutes`.
  - `/api/incidents` → `incidentRoutes`.
- **scheduler/workflow initialization**
  - **לא נמצא בקוד שסופק**. אין cron registration, אין n8n bootstrap, אין queue consumers.
- **error handlers**
  - 404 handler מחזיר JSON אחיד: `{ success: false, error: { message, path } }`.
  - global error handler:
    - בודק `res.headersSent`.
    - משתמש ב-`err.status || 500`.
    - status>=500 → `console.error`, אחרת `console.warn`.
    - response JSON כולל `message`, `code`, וב-development גם `stack`.
- **graceful shutdown**
  - listeners ל-`SIGINT` ו-`SIGTERM` מפעילים `shutdown()`.
  - `shutdown()` מונע re-entry דרך `isShuttingDown`.
  - סוגר `server.close()` ואז `closeConnections()` על SQL ו-Mongo ואז `process.exit(0)`.

# 4. תיעוד מלא לפי שכבות
## 4.1 Routes
### `backend/routes/alertRoutes.js`
- **תפקיד**: רישום כל endpoints האנליטיקה תחת `/api`.
- **יצירת תלותים**: יוצר `new AlertService()` ו-`new AlertController(alertService)` בזמן import. אין DI container חיצוני.
- **Endpoints**
  - `GET /api/alerts`
    - middleware chain: `validateQuery(alertsSchema)`.
    - handler: `AlertController.getAlerts`.
    - request query:
      - `start_date`, `end_date`
      - `day_start`, `day_end`, `night_start`, `night_end`
      - `dur_short_max`, `dur_medium_max`, `false_wakeup_threshold`
      - `limit`, `page`, `sort_by`, `sort_order`
      - `panel_title`, `application`, `node_name`, `network`, `object`, `operator`
      - `min_duration`, `max_duration`
      - `clustering_enabled`, `clustering_threshold`, `duration_metric`
    - response: `{ success, data[], meta?, count }`.
    - validation: Joi. אין auth.
    - side effects: none.
  - `GET /api/stats/executive-kpis`
    - middleware: `validateQuery(statsSchema)`.
    - handler: `getExecutiveKPIs`.
    - response: KPI summary.
  - `GET /api/stats/hourly-heatmap`
    - middleware: `validateQuery(statsSchema)`.
    - handler: `getHourlyHeatmap`.
  - `GET /api/stats/timeseries`
    - middleware: `validateQuery(timeseriesSchema)`.
    - handler: `getTimeseriesStats`.
    - validation מחייב `start_date` + `end_date`.
  - `GET /api/stats/duration-histogram`
    - middleware: `validateQuery(statsSchema)`.
    - handler: `getDurationHistogram`.
  - `GET /api/stats/shift-analysis`
    - middleware: `validateQuery(statsSchema)`.
    - handler: `getShiftAnalysis`.
  - `GET /api/stats/by-panel`
    - middleware: `validateQuery(panelStatsSchema)`.
    - handler: `getPanelStats`.
  - `GET /api/stats/panels`
    - middleware: `validateQuery(panelResearchSchema)`.
    - handler: `getPanelList`.
  - `GET /api/stats/panel-analysis`
    - middleware: `validateQuery(panelResearchSchema)`.
    - handler: `getPanelAnalysis`.
    - בפועל `panel_title` נדרש ב-service אבל לא נדרש ב-schema; חוסר גורם ל-`success:false` או 500 downstream.
  - `GET /api/stats/top-applications`
    - middleware: `validateQuery(statsSchema)`.
    - handler: `getTopApplications`.
  - `GET /api/stats/top-nodes-by-app`
    - middleware: `validateQuery(statsSchema)`.
    - handler: `getTopNodesByApp`.
  - `GET /api/stats/consecutive-days`
    - middleware: `validateQuery(statsSchema)`.
    - handler: `getConsecutiveDaysNodes`.
  - `GET /api/stats/incident-stats`
    - middleware: `validateQuery(statsSchema)`.
    - handler: `getIncidentStats`.

### `backend/routes/incidentRoutes.js`
- **תפקיד**: רישום endpoints ליצירת incidents, CRUD למיפויים/חוקים, לוגים ו-sync של assignment groups.
- **תלותים**: יוצר `mappingService`, `ruleService`, `incidentService`, `controller` בזמן import.
- **Endpoints**
  - `GET /api/incidents/assignment-groups`
    - middleware: none.
    - handler: `getAssignmentGroups`.
    - response: `{ success, data: groups[], count }`.
  - `GET /api/incidents/assignment-groups/sync`
    - middleware: none.
    - handler: `syncAssignmentGroups`.
    - side effect: fetch מ-ServiceNow + upsert ל-Mongo.
    - הערת הקוד ב-controller אומרת POST, אבל בפועל route הוא GET.
  - `GET /api/incidents/incident`
    - middleware: `validateQuery(alertQuerySchema)`.
    - handler: `createIncidentFromAlertGET`.
    - query required: `application`, `object_name`, `node_name`, `message`, `operator`; optional `time_created`, `network`, `user`.
    - response: redirect ל-ServiceNow אם קיים `link`, אחרת JSON success, או HTML error page.
    - auth: none.
    - side effects: יצירת incident חיצוני + logging ב-Mongo.
  - `POST /api/incidents/incident`
    - middleware: `validateBody(alertQuerySchema)`.
    - handler: `createIncidentFromAlertPOST`.
    - response: JSON success גם אם ServiceNow החזיר `{ success:false }` בתוך payload.
  - `POST /api/incidents/incident/simulate`
    - middleware: `validateBody(alertQuerySchema)`.
    - handler: `simulateIncidentCreation`.
    - side effects: none, אין קריאה ל-ServiceNow.
  - `GET /api/incidents/system-mappings`
    - middleware: none.
    - handler: `getSystemMappings`.
  - `POST /api/incidents/system-mappings`
    - middleware: `validateBody(systemMappingSchema)`.
    - handler: `createSystemMapping`.
    - side effect: insert document ב-Mongo.
  - `PUT /api/incidents/system-mappings/:id`
    - middleware: `validateBody(systemMappingSchema.fork(['grafana_names'], schema => schema.optional()))`.
    - handler: `updateSystemMapping`.
    - validation: כל שאר שדות schema נשארים required; כלומר update חלקי מוגבל.
  - `DELETE /api/incidents/system-mappings/:id`
    - middleware: none.
    - handler: `deleteSystemMapping`.
    - side effect: delete document אם אין incident rules תלויים.
  - `GET /api/incidents/incident-rules`
    - middleware: none.
    - handler: `getIncidentRules`.
    - query optional: `application`.
  - `POST /api/incidents/incident-rules`
    - middleware: `validateBody(incidentRuleSchema)`.
    - handler: `createIncidentRule`.
  - `PUT /api/incidents/incident-rules/:id`
    - middleware: `validateBody(incidentRuleSchema.fork(['system_mapping_id'], schema => schema.optional()))`.
    - handler: `updateIncidentRule`.
    - גם כאן זה לא update חלקי אמיתי; רוב השדות עדיין required.
  - `DELETE /api/incidents/incident-rules/:id`
    - middleware: none.
    - handler: `deleteIncidentRule`.
  - `PATCH /api/incidents/incident-rules/:id/toggle`
    - middleware: none.
    - handler: `toggleIncidentRule`.
    - body expected: `{ enabled: boolean }`.
  - `GET /api/incidents/incident-logs`
    - middleware: none.
    - handler: `getIncidentLogs`.
    - query optional: `limit`, `skip`, `search`.

## 4.2 Middleware
### `backend/middleware/validation.js`
- **שם**: `validateQuery`, `validateBody`, `validateParams`.
- **מיקום**: `backend/middleware/validation.js`.
- **מטרה**: ולידציה גנרית מול Joi schema והנחת תוצאה מנורמלת על `req.validatedQuery` / `req.validatedBody` / `req.validatedParams`.
- **מתי הוא רץ**: לפי route registration.
- **מה הוא קורא מה-request**
  - `validateQuery`: קורא `req.query`.
  - `validateBody`: קורא `req.body`.
  - `validateParams`: קורא `req.params`.
- **מה הוא מוסיף ל-request / response**
  - request: אחד מהשדות `validatedQuery`, `validatedBody`, `validatedParams`.
  - response: במקרה כשל מחזיר `400` עם `{ success:false, error, details[] }`.
- **תנאי חסימה**: כל `schema.validate(...)` שמחזיר `error`.
- **שגיאות אפשריות**: שגיאות Joi בלבד; אין try/catch מסביב.
- **תלותים**: Joi schema caller-supplied.
- **דוגמאות לזרימה**
  - `GET /api/alerts?day_start=22&day_end=8` → schema custom validation נכשל → middleware מחזיר 400 → controller לא רץ.

### `backend/middleware/queryLogger.js`
- **שם**: `queryLogger`.
- **מטרה**: logging ב-development של query params וזמן תגובה, כולל הערכת row count.
- **מתי הוא רץ**: רק אם `NODE_ENV === 'development'`, ורק על `/api` כי `server.js` רושם `app.use('/api', queryLogger)`.
- **מה הוא קורא מה-request**: `req.method`, `req.path`, `req.query`.
- **מה הוא מוסיף**: לא משנה request; override זמני ל-`res.json` כדי להדפיס log ביציאה.
- **תנאי חסימה**: אין חסימה.
- **שגיאות אפשריות**: לא מטפל בשגיאות ישירות. אם response אינו JSON או handler משתמש `res.redirect`/`res.send`, הלוגר לא יראה `rows` ביציאה.
- **תלותים**: relies on routes using `res.json`.
- **התנהגות סנסיטיבית**
  - Redaction מבוצע לפי שם מפתח מדויק lowercased מתוך ה-set `password`, `token`, `secret`, `key`, `auth`.
  - שדות אחרים לא מצונזרים.
- **דוגמאות לזרימה**
  - `GET /api/alerts?application=abc` → log כניסה עם params → בעת `res.json` log הצלחה `✓ n rows — Xms`.

## 4.3 Controllers
### `backend/controllers/AlertController.js`
- **תפקיד**: שכבת thin controller לכל endpoints של alerts/stats.
- **מבנה**: class עם constructor שמבצע bind לכל methods.
- **התנהגות כללית**
  - כל method קורא service מתאים עם `req.validatedQuery || req.query`.
  - כל method עוטף ב-try/catch ומעביר `next(error)`.
  - אין logging יזום כאן.
- **פונקציות**
  - `async getAlerts(req, res, next)`
    - inputs: validated query.
    - service: `alertService.getAlerts`.
    - branching: none.
    - response: `{ success, data, meta, count }`.
  - `async getExecutiveKPIs(...)`
    - service: `getExecutiveKPIs`.
    - response: `{ success:true, data, meta }`. `meta` בפועל לרוב `undefined` כי service לא מחזיר `meta`.
  - `async getIncidentStats(...)`
    - service: `getIncidentStats`.
  - `async getHourlyHeatmap(...)`
    - service: `getHourlyHeatmap`.
  - `async getTimeseriesStats(...)`
    - service: `getTimeseriesStats`.
  - `async getDurationHistogram(...)`
    - service: `getDurationHistogram`.
  - `async getShiftAnalysis(...)`
    - service: `getShiftAnalysis`.
  - `async getPanelStats(...)`
    - service: `getPanelStats`.
  - `async getPanelList(...)`
    - service: `getPanelList`.
  - `async getPanelAnalysis(...)`
    - service: `getPanelAnalysis`.
    - branching: אם `result.success` false מחזיר status 500 עם `result` במקום `next(error)`.
  - `async getTopApplications(...)`
    - service: `getTopApplications`.
  - `async getTopNodesByApp(...)`
    - service: `getTopNodesByApp`.
  - `async getConsecutiveDaysNodes(...)`
    - service: `getConsecutiveDaysNodes`.
- **hidden assumptions**
  - מניח שכל service יחזיר אובייקט `{ success, data, meta? }`.
  - אין התאמת status codes פרט ל-`getPanelAnalysis`.

### `backend/controllers/IncidentController.js`
- **תפקיד**: טיפול ב-HTTP ל-incident flows, system mappings, rules, assignment groups ו-history.
- **תלותים**: `incidentService`, `mappingService`, `ruleService`, `getErrorHtml`.
- **פונקציות**
  - `_getErrorAction(error)`
    - אם `error.message.includes('No system mapping')` מחזיר action עם URL `${FRONTEND_URL || 'http://localhost:3000'}/incident`.
    - אחרת מחזיר `null`.
  - `getAssignmentGroups(req,res,next)`
    - קורא `incidentService.getAssignmentGroups()`.
    - if result not array → 500.
    - response: `{ success:true, data, count }`.
  - `syncAssignmentGroups(...)`
    - logging ל-console.
    - קורא `incidentService.syncAssignmentGroups()`.
    - if not array → 500.
    - response כולל `message`, `meta.syncedAt`, `meta.source='servicenow'`.
  - `createIncidentFromAlertGET(...)`
    - inputs: `req.validatedQuery`.
    - logging של payload.
    - service: `createIncidentFromAlert`.
    - branching:
      - אם `result.serviceNowResult.link` קיים → `res.redirect(link)`.
      - אחרת JSON success.
      - catch:
        - אם message כולל `No system mapping` → status 404, userMessage בעברית.
        - אחרת status 500, userMessage generic.
        - response הוא HTML (`getErrorHtml`) ולא JSON.
  - `createIncidentFromAlertPOST(...)`
    - inputs: `req.validatedBody`.
    - service: `createIncidentFromAlert`.
    - on mapping/rules not found → 404 JSON.
    - אחרת success JSON.
  - `simulateIncidentCreation(...)`
    - service: `simulateIncidentCreation`.
    - תמיד מחזיר JSON success אם לא נזרקה שגיאה.
  - CRUD system mappings:
    - `getSystemMappings`: list all.
    - `createSystemMapping`: 201 on success, 409 on duplicate exact pattern.
    - `updateSystemMapping`: 404 on not found.
    - `deleteSystemMapping`: 404 on not found. אם service זורק dependency error הוא יעבור ל-global 500, לא ל-409/400.
  - CRUD incident rules:
    - `getIncidentRules`: query `application` optional.
    - `createIncidentRule`: 404 אם mapping לא נמצא.
    - `updateIncidentRule`: 404 אם rule לא נמצא.
    - `deleteIncidentRule`: 404 אם rule לא נמצא.
    - `toggleIncidentRule`: body validation ידנית בלבד (`typeof enabled === 'boolean'`).
  - `getIncidentLogs(...)`
    - ממיר `limit`/`skip` עם `parseInt`.
    - response data=`result.logs`, count=`result.total`, meta echo של query params.
- **logging behavior**
  - extensive `console.log/error` ב-flows של creation/sync.
- **hidden assumptions**
  - `createIncidentFromAlertPOST` מתייחס ל-`not found` גם לחוקים, אבל service לא זורק עבור no rules; הוא מאפשר zero rules.
  - `syncAssignmentGroups` route מוגדר GET בעוד docstring מציין POST.

## 4.4 Services
### `backend/services/alert/AlertService.js`
- **אחריות**: כל ה-SQL analytics וה-format של responses.
- **state פנימי**
  - `this.pool`: connection pool אופציונלי ל-DI/testing.
  - `this.constants`: snapshot של CONFIG בעת construction.
- **פונקציות**
  - `getPool()`
    - אם `this.pool` null → קורא `getSqlPool()`.
    - hidden assumption: השרת כבר ביצע `initializeSqlDatabase()`.
  - `_buildWhereClause(params, request)`
    - step-by-step:
      1. מייצר array `conditions`.
      2. `start_date` → מפורש ב-`Asia/Jerusalem`, `startOf('day')`, המרה ל-UTC, binding בשם `@start_date`, condition `time_fired >= @start_date`.
      3. `end_date` → `endOf('day')`, binding `@end_date`, condition `time_fired <= @end_date`.
      4. `panel_title` → equality exact (`panel_title = @panel_title`).
      5. שדות `application`, `node_name`, `network`, `object`, `operator` → binding כ-`LIKE prefix%` ולא exact match.
      6. `min_duration`/`max_duration` → filters על `duration_sec` בלבד.
    - business rules:
      - `application` filter הוא prefix search, לא exact.
      - clustering queries עדיין משתמשים באותם filters על raw `duration_sec` לפני clustering.
    - edge cases:
      - `min_duration=0` לא ייכנס כי הבדיקה היא truthy (`if (params.min_duration)`), לכן 0 אינו נתמך.
      - filter על `panel_title` exact אבל שאר fields prefix-only; זה coupling לא אחיד.
  - `_bindThresholds(request, params)`
    - binds `day_start`, `day_end`, `dur_short_max`, `dur_medium_max`, `false_wakeup_threshold`.
    - `night_start`/`night_end` מה-query לא נצרכים כלל ב-SQL queries.
  - `_getClusteringConfig(params)`
    - `enabled`:
      - אם `clustering_enabled` הועבר, כל ערך שאינו `'false'` ואינו `false` יחשב enabled.
      - אחרת default מ-`CONFIG.clustering.enabledByDefault`.
    - `threshold`: `parseInt(params.clustering_threshold, 10)` או default מ-`CONFIG.clustering.defaultThreshold`.
  - `_execute(queryTemplate, params, overrides={})`
    - generic executor:
      1. יוצר request חדש.
      2. בונה WHERE clause.
      3. bind thresholds.
      4. bind `@cluster_threshold` תמיד, גם אם query לא משתמש.
      5. optional `@limit_param`.
      6. מחליף placeholders `WHERE_CLAUSE` ושדות נוספים דרך `overrides.replace`.
      7. מסיר placeholders שלא הוחלפו regex `{[A-Z_]+}`.
      8. מריץ `req.query(finalQuery)` ומחזיר `recordset` בלבד.
    - hidden coupling: מי שמשתמש ב-batch query צריך לעקוף `_execute`, כי הוא מאבד `recordsets` מרובים.
  - `getExecutiveKPIs(params)`
    - בוחר clustered/unclustered query.
    - שולף row ראשון.
    - מחשב:
      - `total_alerts`
      - `avg_duration`
      - `median_duration`
      - `false_positive_rate_247 = false_wakeups / total_alerts * 100`
      - `true_wakeups = night_true_wakeups`
      - `signal_ratio = true_alerts / total_alerts * 100`
    - edge case: אם `total_alerts=0` מחזיר 0.
  - `getAlerts(params)`
    - קובע pagination:
      - אם `page` וגם `limit` קיימים → query עם `limit+1` כדי לחשב `hasNext`, ומשתמש `OFFSET ... FETCH NEXT`.
      - אחרת משתמש `TOP (@limit_param)` עם default cap.
    - בוחר query clustered או raw.
    - sorting:
      - rawOrderClause = `ORDER BY ${sort_by} ${sort_order}`.
      - ב-clustered, אם `sort_by === 'time_fired'`, final order clause משתמש `c.time_fired`; אחרת משתמש value גולמי של `sort_by`.
      - אין whitelist מעבר ל-schema.
    - format output:
      - `duration_category` מחושב hardcoded לפי 30/300 ולא לפי `dur_short_max`/`dur_medium_max` מה-request או config.
      - `shift` מחושב ב-JS דרך `TimeUtils.getILHour` והשוואה ל-`day_start`/`day_end`.
      - `is_cluster = r.cluster_count > 1`.
      - `raw_alerts_json` עובר `JSON.parse`, ואם נכשל רק console.error.
    - edge cases:
      - raw alerts cluster query אינו partitioned לפי application/panel, ולכן clustering גלובלי על כל ההתראות המסוננות.
  - `getPanelList(params)`
    - clustered/unclustered query.
    - מוסיף `health_score = max(0, 100 - false_positive_count/alert_count*100)`.
  - `getTimeseriesStats(params)`
    - מחזיר recordset as-is.
  - `getIncidentStats(params)`
    - בוחר 4 queries לפי מצב clustering:
      - coverage
      - by team
      - by application
      - daily trend
    - מריץ `Promise.all` עם `_execute` לכל אחד.
    - response data מורכב מארבעה מבנים.
  - `getDurationHistogram(params)`
    - מחזיר שלושה buckets: Short/Medium/Long.
    - כאן ה-range labels משתמשים ב-`this.constants` ולא ב-values שב-query params, למרות שה-counts עצמם כן מחושבים לפי query params דרך SQL bind. זה יוצר mismatch תצוגתי אם הלקוח שולח thresholds custom.
  - `getHourlyHeatmap(params)`
    - בוחר query clustered/unclustered.
    - מוסיף `hour_display` ו-`is_night` לפי `day_start`/`day_end`.
  - `getShiftAnalysis(params)`
    - passthrough ל-SQL result.
  - `getPanelAnalysis(params)`
    - אם אין `panel_title` → מחזיר `{ success:false, error:{ message } }` בלי throw.
    - אחרת:
      1. בוחר batch query clustered/unclustered.
      2. יוצר request, WHERE clause, bind thresholds, bind cluster threshold אם רלוונטי.
      3. query מחזיר 5 recordsets חובה: KPIs, timeseries, heatmap, duration, noisy alerts.
      4. אם פחות מ-5 recordsets → throw.
      5. בונה `summary`:
         - `total_alerts`, `avg_duration`, `median_duration`
         - `false_positive_rate`
         - `night_wakeups = sqlKpis.night_alerts`
         - `night_false_wakeups`
         - `alerts_per_day = total / trendResult.length`
         - `trend_direction = 'stable'` hardcoded.
      6. מעצב duration histogram ו-heatmap.
    - catch: מחזיר `{ success:false, error:{ message:'Failed to fetch panel analysis' } }` ולא זורק.
  - `getPanelStats(params)`
    - query `PANEL_STATS`, limit default 20, TOP clause רק אם `limit` exists.
  - `getTopApplications(params)`
    - query `TOP_APPLICATIONS`, limit default 10.
  - `getTopNodesByApp(params)`
    - query `TOP_NODES_BY_APP`, limit default 10.
  - `getConsecutiveDaysNodes(params)`
    - query `CONSECUTIVE_DAYS_NODES`, limit default 10.
- **thresholds, clustering logic, shift-time logic, duration threshold logic**
  - clustering threshold נמדד בדקות ב-SQL (`DATEDIFF(MINUTE, LAG(...), time_fired) > @cluster_threshold`).
  - shift מחושב לפי שעה ישראלית של `time_fired` או `cluster_start`.
  - false wakeup threshold נמדד בשניות (`duration_sec`/`cluster_duration <= @false_wakeup_threshold`).
  - histogram short/medium/long נמדד בשניות.
- **retry / fallback / dedup logic**
  - retry: **לא קיים**.
  - fallback: בחירת clustered/unclustered.
  - dedup: clustering משמש event aggregation, אך אינו dedup לפי מפתח ייחודי אלא grouping לפי proximity בזמן בלבד.
- **edge cases מרכזיים**
  - clustering חוצה panel/application/operator.
  - `night_start`/`night_end` עוברים validation אבל לא נצרכים.
  - `duration_metric` קיים ב-schema אך לא נצרך בשום מקום.
  - `fill_gaps` ו-`granularity` ב-timeseries schema אינם נצרכים ב-service/query.

### `backend/services/incident/IncidentService.js`
- **אחריות**: orchestration של mapping + rules + ServiceNow + incident logging + assignment groups.
- **state פנימי**
  - `_collections`: cache מקומי לאוספי Mongo.
  - `_serviceNowClient`: lazy singleton פר-instance.
- **פונקציות**
  - getter `db`
    - lazy-load אוספים:
      - `assignmentGroups`
      - `incidentLogs`
    - side effect חד-פעמי/חוזר אפשרי: `incidentLogs.createIndex({ created_at: 1 }, { expireAfterSeconds: 7776000, background: true }).catch(() => {})`.
    - כשל ביצירת index נבלע בשקט.
  - getter `serviceNowClient`
    - יוצר `new ServiceNowClient()` לפי env vars.
  - `async createIncidentFromAlert(alertData)`
    - flow step-by-step:
      1. דורש `application`.
      2. `mappingService.getMappingByApplication(application)`.
      3. אם אין mapping → throw.
      4. `ruleService.getIncidentRules(application)`.
      5. מסנן enabled rules בלבד (`r.enabled !== false`).
      6. `helpers.findAllMatches(alertData, enabledRules)` מחזיר matches sorted descending specificity.
      7. `reverse().map(m => m.rule)` הופך את הסדר כך שהחוקים הפחות ספציפיים מיושמים קודם, והיותר ספציפיים מאוחר יותר, כדי ש-overrides מאוחרים ידרסו קודמים.
      8. merge של `incident_overrides` מכל כלל לתוך `finalOverrides`.
      9. `helpers.buildIncidentData(systemMapping, finalOverrides, alertData)`.
      10. `serviceNowClient.createIncident(incidentData)`.
      11. בחירת `matchedRule` כאחרון ב-array `matchingRules`, כלומר הכלל בעל הקדימות הגבוהה ביותר אחרי ה-merge.
      12. כתיבת log async ל-`incidentLogs.insertOne(...)` בלי await ובלי להשפיע על response.
    - output:
      - `incidentData`
      - `serviceNowResult`
      - `mapping_used`
      - `rule_used`
      - `rule_name`
      - `applied_rules`
      - `matched_applications`
    - failure behavior:
      - אם ServiceNow מחזיר object עם `success:false`, לא נזרקת שגיאה; ה-flow עדיין נחשב success מבחינת controller.
  - `getAssignmentGroups()`
    - קורא document `_id='assignment_groups_store'` ומחזיר `doc.groups` או `[]`.
  - `syncAssignmentGroups()`
    - `serviceNowClient.fetchAssignmentGroups()`.
    - `updateOne` עם `upsert:true` ל-doc `_id='assignment_groups_store'`.
  - `createServiceNowAlert(alertData)`
    - יוצר payload מצומצם ל-ServiceNow:
      - `short_description = message`
      - `service_offering` מהמיפוי
      - `u_prevented_incident = Boolean(prevented)`
      - optional `caller_id`, `parent_incident`
    - בפועל משתמש באותו endpoint `createIncident` של ServiceNowClient, אין endpoint שונה ל-alert.
  - `createIncidentWithAlert(alertData, createAlert=true, linkToIncident=true)`
    - יוצר incident רגיל ואז optional alert linked.
    - **לא מחובר ל-route כלשהו בקוד שסופק**.
  - `simulateIncidentCreation(alertData)`
    - מחזיר preview של mapping, רשימת חוקים מוחלים ו-generated incident ללא קריאה ל-ServiceNow.
    - אם mapping לא קיים, `generated_incident` יהיה `null` ולא נזרקת שגיאה.
  - `getIncidentHistory(limit=50, skip=0, search=null)`
    - אם `search` קיים → `$or` regex case-insensitive על `application` או `servicenow_result.incident_number`.
    - מחזיר `{ logs, total }` עם sort descending על `created_at`.
- **business rules**
  - אין incident ללא mapping.
  - חוקים disabled לא נלקחים.
  - global rules ו-specific rules יכולים לחול יחד; precedence מחושבת ב-helper.
  - כתיבת log היא best effort בלבד.

### `backend/services/incident/SystemMappingService.js`
- **אחריות**: CRUD ו-resolution של system mappings.
- **פונקציות**
  - getter `collection`
    - lazy `getMongoDb().collection(mongoConfig.collections.systemMappings)`.
  - `getSystemMappings()`
    - `find({}).toArray()`.
  - `getMappingByApplication(grafanaName)`
    - אם אין ערך → `null`.
    - שולף **את כל המיפויים** ואז מבצע loop nested על `grafana_names`.
    - כל pattern string ישן מומר זמנית ל-`{ value, type:'exact' }`.
    - match מבוצע דרך `helpers.matchesGrafanaPattern`.
    - hidden cost: O(number_of_mappings * patterns_per_mapping), ללא query-level filtering.
  - `checkMappingConflicts(patterns, excludeId=null)`
    - בודק **רק patterns מסוג `exact`**.
    - יוצר query על `grafana_names.value` ו-`grafana_names.type`.
    - על update אפשר exclusion לפי `_id != excludeId`.
    - אם נמצא conflict → throw עם רשימת values.
    - patterns מסוג `contains`/`regex` אינם נבדקים לקונפליקטים.
  - `createSystemMapping(mappingData)`
    - תומך גם fallback ל-`mappingData.grafana_name`, למרות schema דורש `grafana_names`.
    - `helpers.validateGrafanaPatterns`.
    - conflict check.
    - `u_system_failure` מומר עם `parseBoolean`.
    - מוסיף timestamps.
    - מוחק `grafana_name` מהמסמך.
  - `updateSystemMapping(id, mappingData)`
    - מסיר `_id`, `created_at` מה-update.
    - אם `grafana_names` קיים → sanitize + conflict check.
    - ממיר `u_system_failure` אם קיים.
    - מוסיף `updated_at`.
    - `updateOne` ואז `findOne` חוזר.
  - `deleteSystemMapping(id)`
    - לפני delete סופר חוקים תלויים ב-collection `incident_rules_new` לפי `system_mapping_id: objId`.
    - אם count>0 → throw.
    - אחרת deleteOne.
- **edge cases**
  - delete/update/create ייפלו אם `id` אינו ObjectId תקין; אין try/catch ייעודי ולכן יגיע כ-500.

### `backend/services/incident/IncidentRuleService.js`
- **אחריות**: CRUD של incident rules + filtering לפי application.
- **פונקציות**
  - getters `collection`, `mappingCollection`: lazy collection handles.
  - `getIncidentRules(grafanaName = null)`
    - aggregate pipeline:
      1. `$match: {}`
      2. `$lookup` מ-`system_mappings_new` לפי `system_mapping_id`
      3. `$unwind` עם `preserveNullAndEmptyArrays:true`
      4. `$sort: { created_at: -1 }`
    - אם `grafanaName` לא הועבר → מחזיר הכל.
    - אם הועבר:
      - global rules מוחזרים תמיד.
      - non-global rules נבדקים מול `rule.grafana_names` **השמור בתוך המסמך של rule**, לא מול `rule.system_mapping.grafana_names` מה-lookup.
      - זה coupling קריטי: שינוי mapping לא משנה אוטומטית rules קיימים.
  - `createIncidentRule(ruleData)`
    - אם `!ruleData.is_global`:
      - דורש `system_mapping_id`.
      - שולף mapping; אם אין → throw.
    - `helpers.validateRuleConditions` על regex fields.
    - ממיר override `u_system_failure` אם קיים.
    - dataToInsert כולל snapshot של `grafana_names` מהמיפוי או `[]` לכלל גלובלי.
    - שומר `logic_operator` עם default `OR`, timestamps.
  - `updateIncidentRule(id, ruleData)`
    - אם הועבר `system_mapping_id`, שולף mapping ומרענן `grafana_names`.
    - validates conditions ו-boolean conversion.
    - `updateOne`, ואז `findOne`.
  - `deleteIncidentRule(id)`
    - `deleteOne`.
  - `toggleIncidentRule(id, enabled)`
    - `updateOne` רק ל-`enabled` + `updated_at`.
- **business rules**
  - non-global rule חייב mapping.
  - global rule יכול לחול על כל application, subject to conditions.
  - specificity מחושבת ב-helper, לא כאן.

### `backend/services/incident/ServiceNowClient.js`
- **אחריות**: תקשורת HTTP מול ServiceNow.
- **פונקציות**
  - constructor(config={})
    - לוקח `url`, `username`, `password` מ-arg או env.
    - `enabled = Boolean(this.url)` בלבד. כלומר user/pass ריקים לא מבטלים integration.
  - `isEnabled()`
    - מחזיר `this.enabled && this.url`.
  - `async createIncident(incidentData)`
    - אם integration disabled → מחזיר object `{ success:false, message:'ServiceNow integration disabled' }` בלי throw.
    - אחרת POST ל-`{url}/api/now/table/incident` עם basic auth, timeout 10s.
    - on success מחזיר `{ success:true, incident_number, sys_id, link }`.
    - on failure מחזיר `{ success:false, error, status }` בלי throw.
  - `async fetchAssignmentGroups()`
    - דורש enabled, אחרת throw.
    - GET ל-`{url}/api/now/table/sys_user_group` עם query של `active=true`, fields `sys_id,name`, limit 1000.
    - ממפה ל-`{ value: sys_id, label: name }`.
    - failure → throw error חדש.
- **risks**
  - הקובץ דורש `axios`, אך `axios` לא מופיע ב-`backend/package.json` בקוד שסופק.

### `backend/services/incident/incidentHelpers.js`
- **אחריות**: pure functions עבור parsing, validation, matching, template replacement ו-build payload.
- **פונקציות**
  - `parseBoolean(value)`
    - `boolean` → 그대로.
    - string `'true'` או `'1'` → true.
    - אחרת `Boolean(value)`.
  - `sanitizeGrafanaPattern(pattern)`
    - string או falsy → exact lowercase trimmed.
    - object → `{ value, type }` normalized.
  - `validateGrafanaPatterns(patterns)`
    - string יחיד מפוצל ב-`,`.
    - דורש array לא ריק.
    - sanitize לכל item.
    - `regex` patterns נבדקים עם `new RegExp`.
    - `exact` patterns דורשים regex `^[a-z0-9_-]+$`.
  - `replaceTemplateVariables(template, alertData)`
    - מחליף placeholders `{{ application }}`, `{{ object_name }}` וכו' עבור fields מוגדרים hardcoded.
    - fields supported: `application`, `object_name`, `node_name`, `message`, `time_created`, `operator`, `network`.
  - `buildIncidentData(systemMapping, ruleOverrides = {}, alertData)`
    - fields בסיס חובה: `service_offering`, `business_service`, `u_network`, `assignment_group`, `u_system_failure`.
    - precedence:
      1. override value אם קיים.
      2. אחרת value מהמיפוי.
    - עבור `u_system_failure`: parseBoolean.
    - עבור strings שאינם `assignment_group`, `service_offering`, `business_service`: מבצע template replacement.
    - אם field required חסר או ריק אחרי template → throw.
    - מעתיק כל שדה נוסף מהמיפוי שאינו `_id`, `grafana_names`, `created_at`, `updated_at` ואינו ריק.
    - לאחר מכן ruleOverrides יכולים לדרוס כל שדה נוסף.
    - defaults אם חסרים:
      - `short_description = קפצה התראה על: ...`
      - `description = ההתראה: ...`
      - `u_operational_impact = "בבדיקה"`
  - `matchesGrafanaPattern(applicationName, pattern)`
    - `exact`: equality lowercase.
    - `contains`: includes lowercase.
    - `regex`: `new RegExp(normalizedPattern, 'i').test(applicationName)`.
  - `calculateRuleSpecificity(rule)`
    - scoring:
      - `_exact` = +10
      - `_regex` = +7
      - `_contains` = +3 * count or 1
      - non-global rule = +100
    - ככל שהציון גבוה יותר, הכלל ספציפי יותר.
  - `checkFieldConditions(value, conditions, fieldPrefix)`
    - יוצר array של תוצאות bool עבור contains/exact/regex של field מסוים.
  - `evaluateFieldResults(results, logicOperator)`
    - no results → null.
    - AND עם יותר מתוצאה אחת → every.
    - אחרת some.
  - `doesAlertMatchRule(alertData, rule)`
    - בודק fields: `message`, `node_name`, `object_name`, `operator`, `network`.
    - network: אם אין results structured אבל יש `conditions.network`, מבצע includes פשוט.
    - אם אין condition groups בכלל → false.
    - אם `logic_operator === 'AND'` → כל groups חייבים true; אחרת מספיק some.
  - `findAllMatches(alertData, rules)`
    - מסנן rules matching.
    - ממפה ל-`{ rule, score, is_global }`.
    - sort descending by score.
  - `validateRuleConditions(conditions)`
    - בודק regex validity לחמישה regex fields.
- **coupling/risk**
  - `findAllMatches` לא מבטל חוקים חופפים; כל match מיושם.
  - `replaceTemplateVariables` אינו escaped/validated, רק replace.

## 4.5 Utils / Helpers / Constants
### `backend/utils/constants.js`
- **מה הוא מכיל**
  - `DEFAULTS`, `RULE_TYPES`, `HTTP_STATUS`, `ERROR_CODES`, `TEMPLATE_EXCLUDED_FIELDS`, `VALID_DISTINCT_FIELDS`, `INCIDENT_LOG_TTL_SECONDS`.
- **היכן בשימוש**
  - `errors.js` משתמש ב-`HTTP_STATUS`, `ERROR_CODES`.
  - שאר הקבועים אינם נצרכים בקוד runtime שסופק.
- **למה חשוב**
  - מראה כוונת ארכיטקטורה לקוד מסודר יותר, אך בפועל חלקו לא מוטמע.
- **hidden coupling / risk**
  - `INCIDENT_LOG_TTL_SECONDS` מוגדר אך `IncidentService` hardcodes אותו כ-`7776000` במקום להשתמש בקבוע.

### `backend/utils/TimeUtils.js`
- **מה הוא מכיל**
  - המרות timezone ו-cache פנימי.
- **שימושים בפועל**
  - `AlertService.getAlerts()` משתמש `getILHour`.
  - יתר הפונקציות זמינות אך אינן בשימוש בקוד שסופק.
- **למה חשוב**
  - shift calculation בצד JS תלוי בו.
- **risk**
  - cache הוא `Map` process-local, לא thread-safe across processes, לא shared across instances.

### `backend/utils/validateEnv.js`
- **מה הוא מכיל**
  - required/recommended env lists + runtime validator.
- **שימושים**
  - `server.js` מפעיל startup validation.
- **למה חשוב**
  - מונע עליית production בלי credentials required.

### `backend/utils/errors.js`
- **מה הוא מכיל**
  - hierarchy של errors מותאמי HTTP.
- **שימושים בפועל**
  - **לא נמצא שימוש פעיל בקוד שסופק**. controllers/services זורקים `Error` רגיל.
- **למה חשוב**
  - פוטנציאל לשיפור error discipline.

### `backend/utils/htmlTemplates.js`
- **מה הוא מכיל**
  - `getErrorHtml(error, details='', action=null)` שמייצר HTML RTL styled.
- **שימושים**
  - `IncidentController.createIncidentFromAlertGET` ב-error path בלבד.
- **למה חשוב**
  - route זה עשוי להיפתח בדפדפן דרך webhook/manual operation ולכן מחזיר דף קריא ולא JSON.
- **risk**
  - interpolates strings לתוך HTML ללא escaping, ולכן אם `error.message` כולל HTML הוא יוזרק לדף.

# 5. Database documentation
## 5.1 Database overview
- **database type**
  - SQL Server דרך `mssql`.
  - MongoDB דרך native `mongodb` driver.
- **schemas**
  - SQL: schema יחיד שנצפה הוא `dbo`.
  - MongoDB: אין schema enforced בקוד; collections מוגדרים ב-`mongoConfig.collections`.
- **connection method**
  - SQL: `new sql.ConnectionPool(dbConfig).connect()`.
  - Mongo: `new MongoClient(mongoConfig.uri).connect()`.
- **ORM/query builder/raw SQL usage**
  - SQL: raw SQL templates עם placeholder replacement + parameter binding.
  - Mongo: native collection API + aggregate pipeline.
- **migration strategy**
  - SQL migrations: **לא נמצא בקוד שסופק**.
  - Mongo migrations: **לא נמצא בקוד שסופק**.
- **seed strategy**
  - **לא נמצא בקוד שסופק**.

## 5.2 Full SQL schema
### SQL table: `dbo.historicalAlerts`
- **purpose**
  - טבלת המקור לכל analytics וגם למידע על `incident_number` עבור incident coverage stats.
- **full column list שנצפתה בקוד**
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
- **data types**
  - `time_fired`, `time_resolved`: נראים כשדות datetime כי נעשה עליהם `AT TIME ZONE`, `DATEDIFF`, `DATEADD`. טיפוס מדויק **לא נמצא בקוד שסופק**.
  - `duration_sec`: numeric/integer-like, כי נעשה עליו `AVG(CAST(... AS FLOAT))`, `MIN`, `MAX`, comparisons. טיפוס מדויק **לא נמצא בקוד שסופק**.
  - `incident_number`, `panel_title`, `application`, `node_name`, `network`, `object`, `operator`, `message`, `key_field`: string-like. טיפוס SQL מדויק **לא נמצא בקוד שסופק**.
  - `incident_id`, `history_id`: identifier-like. טיפוס מדויק **לא נמצא בקוד שסופק**.
- **nullable / default values / primary keys / foreign keys / indexes / constraints / unique rules**
  - **לא נמצא בקוד שסופק**.
- **relationships**
  - בקוד אין FK מפורש. `incident_number` מקשר לוגית ל-ServiceNow ticket number בלבד.
- **important examples of stored data**
  - שורה מכילה התראה היסטורית עם זמני firing/resolution, משך, שיוך ל-panel/application/node/operator, וייתכן `incident_number` אם ההתראה כוסתה ע"י incident.

### MongoDB collections
#### Collection: `system_mappings_new`
- **purpose**: מיפוי Grafana application pattern(s) לשדות ServiceNow.
- **fields שנצפו**
  - `_id`
  - `grafana_names` (array של string או `{ value, type }`)
  - `service_offering`
  - `business_service`
  - `u_network`
  - `u_impact_technology`
  - `assignment_group`
  - `u_system_failure`
  - שדות נוספים מותרים (`unknown(true)` ב-schema)
  - `created_at`
  - `updated_at`
- **indexes/constraints**: לא מוגדרים בקוד, מלבד conflict check לוגי על exact patterns.

#### Collection: `incident_rules_new`
- **purpose**: חוקים ל-override של incident payload.
- **fields שנצפו**
  - `_id`
  - `system_mapping_id`
  - `grafana_names` (snapshot מהמיפוי)
  - `is_global`
  - `rule_name`
  - `description`
  - `conditions`
  - `logic_operator`
  - `incident_overrides`
  - `enabled`
  - `created_at`
  - `updated_at`
- **indexes**: **לא נמצא בקוד שסופק**.

#### Collection: `assignment_groups`
- **purpose**: cache של רשימת קבוצות שיוך מ-ServiceNow.
- **document shape**
  - `_id: 'assignment_groups_store'`
  - `groups: [{ value, label }]`
  - `lastSynced`
  - `count`

#### Collection: `incident_logs`
- **purpose**: audit/log של כל attempt ליצירת incident.
- **document shape**
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
  - TTL index על `created_at` עם `expireAfterSeconds = 7776000` (90 ימים), נוצר lazy בזמן runtime.

## 5.3 Queries
### מיקום כללי
- כל שאילתות ה-SQL מרוכזות ב-`backend/database/queries/alertQueries.js` ומופעלות מ-`AlertService`.
- Mongo queries כתובות inline ב-services של incident.

### SQL queries עיקריות
- `SELECT_ALERTS`
  - raw SQL.
  - trigger: `AlertService.getAlerts()` כאשר clustering כבוי.
  - parameters: `WHERE_CLAUSE`, `ORDER_CLAUSE`, `PAGINATION_CLAUSE`, `TOP_CLAUSE`.
  - returned fields: כל שדות raw alert שנבחרו.
  - business purpose: רשימת alerts גולמית.
  - performance: תלוי ב-index על `time_fired` ובשדות filter. ללא index על sorting/filters query עשוי להיות יקר.
- `CLUSTERED_ALERTS`
  - משתמש ב-CTE-ים `Filtered`, `Marked`, `Grouped`, `Clusters`.
  - trigger: `getAlerts()` כאשר clustering פעיל.
  - parameters: בנוסף `@cluster_threshold`.
  - clustering rule: `LAG(time_fired)` גלובלי על הסט המסונן, ו-cluster חדש אם הפער בדקות גדול מה-threshold.
  - returned extra fields: `cluster_count`, `raw_alerts_json`.
  - risk: אין partition by panel/application ולכן alerts לא קשורים יכולים להיכנס לאותו cluster אם סמוכים בזמן.
- `HOURLY_HEATMAP` / `CLUSTERED_HOURLY_HEATMAP`
  - trigger: `getHourlyHeatmap()`.
  - purpose: buckets של 24 שעות, כולל שעות ללא נתונים ע"י `AllHours`.
- `DURATION_HISTOGRAM` / `CLUSTERED_DURATION_HISTOGRAM`
  - trigger: `getDurationHistogram()`.
  - purpose: short/medium/long counts.
- `SHIFT_ANALYSIS` / `CLUSTERED_SHIFT_ANALYSIS`
  - trigger: `getShiftAnalysis()`.
  - purpose: day vs night metrics.
- `PANEL_LIST` / `CLUSTERED_PANEL_LIST`
  - trigger: `getPanelList()`.
  - purpose: רשימת פאנלים + alert counts + false positives + avg duration.
- `PANEL_STATS`
  - trigger: `getPanelStats()`.
  - purpose: breakdown לפי `panel_title, application`.
- `TOP_APPLICATIONS`
  - trigger: `getTopApplications()`.
  - purpose: top noisy applications.
- `TOP_NODES_BY_APP`
  - trigger: `getTopNodesByApp()`.
  - purpose: top nodes תחת המסנן הנוכחי.
  - hidden assumption: endpoint name by app, אבל query מתבסס רק על `WHERE_CLAUSE`; אם client לא שולח `application`, זו רשימת nodes כללית.
- `CONSECUTIVE_DAYS_NODES`
  - trigger: `getConsecutiveDaysNodes()`.
  - purpose: nodes עם לפחות 3 ימים רצופים של alerts.
- `UNCLUSTERED_KPI_STATS` / `CLUSTERED_KPI_STATS`
  - trigger: `getExecutiveKPIs()` וכן batch panel analysis.
  - purpose: summary KPIs כולל median.
- `TIMESERIES` / `CLUSTERED_TIMESERIES`
  - trigger: `getTimeseriesStats()`.
  - purpose: daily aggregation.
- `UNCLUSTERED_TOP_NOISY_ALERTS` / `CLUSTERED_TOP_NOISY_ALERTS`
  - trigger: חלק מ-`getPanelAnalysis()`.
  - purpose: top 10 messages.
- `CLUSTERED_PANEL_ANALYSIS_BATCH` / `UNCLUSTERED_PANEL_ANALYSIS_BATCH`
  - trigger: `getPanelAnalysis()`.
  - purpose: להחזיר 5 recordsets ב-query אחד.
  - side effects: שימוש ב-temp tables `#TempClusters` / `#TempRaw`.
- `INCIDENT_COVERAGE_STATS`, `INCIDENTS_BY_TEAM`, `INCIDENTS_BY_APPLICATION`, `INCIDENT_DAILY_TREND`
  - trigger: `getIncidentStats()` כאשר clustering כבוי.
  - purpose: BI על קשר בין alerts ל-incident_number.
- `CLUSTERED_INCIDENT_COVERAGE_STATS`, `CLUSTERED_INCIDENTS_BY_TEAM`, `CLUSTERED_INCIDENTS_BY_APPLICATION`, `CLUSTERED_INCIDENT_DAILY_TREND`
  - trigger: `getIncidentStats()` כאשר clustering פעיל.
  - purpose: אותם מדדים אבל ברמת cluster/event.

### Mongo queries
- `assignmentGroups.findOne({ _id: 'assignment_groups_store' })`
  - trigger: `IncidentService.getAssignmentGroups()`.
- `assignmentGroups.updateOne(..., { upsert: true })`
  - trigger: `syncAssignmentGroups()`.
- `incidentLogs.insertOne({...})`
  - trigger: `createIncidentFromAlert()` best effort logging.
- `incidentLogs.countDocuments(query)` / `.find(query).sort({created_at:-1}).skip(skip).limit(limit)`
  - trigger: `getIncidentHistory()`.
- `system_mappings_new.find({}).toArray()`
  - trigger: `getSystemMappings()` וגם `getMappingByApplication()`.
- `system_mappings_new.findOne(query)`
  - trigger: conflict check, find-by-id.
- `system_mappings_new.insertOne/updateOne/deleteOne`
  - trigger: CRUD mappings.
- `incident_rules_new.aggregate([...])`
  - trigger: `getIncidentRules()`.
- `incident_rules_new.insertOne/updateOne/deleteOne/countDocuments`
  - trigger: CRUD rules + dependency check.

## 5.4 Stored procedures / functions / views / triggers
- SQL stored procedures: **לא נמצא בקוד שסופק**.
- SQL functions/views/triggers: **לא נמצא בקוד שסופק**.
- Mongo triggers/change streams: **לא נמצא בקוד שסופק**.

## 5.5 Migrations
- קבצי migrations: **לא נמצא בקוד שסופק**.

# 6. n8n documentation
## 6.1 Overview
- **what n8n is doing in this project**
  - **לא נמצא בקוד שסופק**.
- **how backend and n8n interact**
  - **לא נמצא בקוד שסופק**.
- **entry points: webhook / schedule / manual / internal trigger**
  - **לא נמצא בקוד שסופק**.

## 6.2 Workflow inventory
- Workflows: **לא נמצא בקוד שסופק**.

## 6.3 SQL and procedures used by n8n
- **לא נמצא בקוד שסופק**.

## 6.4 Maintenance
- שכפול workflow / שינוי query / הוספת node / testing workflow / common failure points:
  - **לא נמצא בקוד שסופק**.

# 7. Core business logic explanation
- **מה זה clustering במערכת הזאת**
  - clustering הוא מנגנון אגרגציה שהופך רצף alerts סמוכים בזמן ל-event יחיד. הוא מופעל ברמת SQL ולא ב-JS.
- **איך clustering מחושב בפועל**
  - בכל query clustered:
    1. נלקחות השורות המסוננות.
    2. מחושב `LAG(time_fired) OVER (ORDER BY time_fired)`.
    3. אם `DATEDIFF(MINUTE, previous_time_fired, current_time_fired) > @cluster_threshold` אז מתחיל cluster חדש.
    4. `SUM(is_new_cluster) OVER (ORDER BY time_fired)` יוצר `cluster_id`.
    5. מתבצעת אגרגציה לפי `cluster_id`.
  - משך cluster מחושב לרוב כך:
    - `DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec,0), time_fired)))`.
  - כלומר cluster duration הוא מה-start של ה-alert הראשון עד סוף ה-alert האחרון (ולא סכום משכים), פרט ל-query `CLUSTERED_ALERTS` שבו `duration_sec` ב-`Clusters` הוא `SUM(ISNULL(duration_sec,0))`. זה יוצר חוסר אחידות בין endpoint list לבין KPI/stat endpoints.
- **מה המשמעות העסקית שלו**
  - לצמצם "רעש" של bursts סמוכים ולהציג event count במקום raw alert count.
  - לעזור למדוד false wakeups ותפיסת incidents ברמת אירוע.
- **מה זה shifts time impact**
  - המערכת מחלקת alerts ל-`Day` או `Night` לפי שעה מקומית בישראל.
  - Day מוגדר `hour >= day_start AND hour < day_end`.
  - Night הוא המשלים.
- **איך משמרות משפיעות על החישוב/תיעדוף/aggregation**
  - KPI queries מחשבים `night_alerts`, `night_true_wakeups`, `night_false_wakeups`.
  - heatmap מסמן `is_night`.
  - shift analysis מקבץ day/night ומחזיר counts/durations.
  - אין priority engine שונה בין משמרות מעבר למדדים.
- **מהו duration threshold**
  - קיימים שלושה thresholds:
    - `dur_short_max`
    - `dur_medium_max`
    - `false_wakeup_threshold`
  - מוגדרים ב-`CONFIG.duration` עם defaults 30/300/120, ניתנים override ב-query params, ומקבלים validation דרך Joi.
- **איפה הוא מוגדר**
  - config: `backend/config/index.js`.
  - request-level override: `backend/schemas/alertSchemas.js` + `AlertService._bindThresholds()`.
- **איך שינוי threshold משפיע על התוצאה**
  - `false_wakeup_threshold` משנה KPI-ים, panel health, false_positive_rate, shift stats, top noisy false_positive_rate, incident metrics מבוססי cluster לא מושפעים ישירות.
  - `dur_short_max`/`dur_medium_max` משנים histogram counts ו-panel stats buckets.
  - `cluster_threshold` משנה grouping events ולכן משפיע כמעט על כל clustered endpoint.
- **KPI logic**
  - מבוסס SQL aggregates + post-processing מינימלי ב-service.
  - median מחושב עם `PERCENTILE_CONT(0.5)`.
  - signal ratio = true alerts / total alerts.
- **aggregation logic**
  - daily trend: cast date ב-Israel timezone.
  - heatmap: 24 buckets עם שעות חסרות כמספר 0.
  - top noisy: top 10 לפי `message` count.
- **filters**
  - date range על `time_fired`.
  - `panel_title` exact.
  - `application`, `node_name`, `network`, `object`, `operator` כ-prefix `LIKE value%`.
  - duration filters על raw `duration_sec` בלבד.
- **time windows**
  - start/end date נחתכים ל-start/end of day בישראל.
  - timeseries ב-query הוא daily בלבד גם אם schema מכיל `granularity='hour'`.
- **deduplication**
  - אין dedup לפי מזהה unique. יש רק clustering temporal.
- **anomaly / threshold / segmentation logic if exists**
  - anomaly detection אמיתי: **לא נמצא בקוד שסופק**.
  - segmentation קיים לפי shift, duration bands, panel/application/node/message.

# 8. KPI documentation
- **KPI: `total_alerts`**
  - business meaning: מספר alerts או מספר clusters, תלוי אם clustering enabled.
  - exact formula:
    - raw: `COUNT(*)`
    - clustered: `COUNT(*)` על `FilteredClusters`.
  - source: `UNCLUSTERED_KPI_STATS` / `CLUSTERED_KPI_STATS`.
  - filters/exclusions: כל `WHERE_CLAUSE`, וב-clustered גם `CLUSTER_FILTER` כרגע ריק.
  - update frequency: בזמן כל קריאת API.
  - exposed in: `GET /api/stats/executive-kpis`, `GET /api/stats/panel-analysis` (summary).
  - edge cases: zero results returns 0.
- **KPI: `avg_duration`**
  - formula: `AVG(CAST(duration_sec AS FLOAT))` או `AVG(CAST(cluster_duration AS FLOAT))`.
- **KPI: `median_duration`**
  - formula: `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_sec|cluster_duration) OVER ()`.
- **KPI: `false_positive_rate_247` / `false_positive_rate`**
  - business meaning: אחוז alerts/events שמתחת או שווה ל-`false_wakeup_threshold`.
  - formula: `false_wakeups / total_alerts * 100`.
- **KPI: `true_wakeups`**
  - business meaning: מספר night alerts/events שחצו את `false_wakeup_threshold`.
  - source field: `night_true_wakeups`.
- **KPI: `signal_ratio`**
  - business meaning: אחוז alerts/events שנחשבים true alerts ביחס לכלל alerts/events.
  - formula: `true_alerts / total_alerts * 100`.
- **KPI: `health_score`**
  - business meaning: ציון בריאות panel לפי שיעור false positives.
  - formula: `max(0, 100 - ((false_positive_count / alert_count) * 100))`.
  - source: `getPanelList()` post-processing.
- **KPI: `coverage_pct`**
  - business meaning: אחוז alerts/events המכוסים ע"י incident number.
  - formula raw: `COUNT(incident_number) / COUNT(*) * 100`.
  - formula clustered: `clusters_with_any_ticket / total_clusters * 100`.
- **KPI: `incident_creation_rate`**
  - business meaning: incidents distinct per total alerts raw.
  - formula raw only: `COUNT(DISTINCT incident_number) / COUNT(*) * 100`.
  - clustered coverage query לא מחזיר field זהה; שם מוחזרים metrics אחרים.
- **KPI: `avg_alerts_per_incident`**
  - business meaning: עומס alerts לכל ticket.
  - formula raw: `COUNT(incident_number) / COUNT(DISTINCT incident_number)`.
  - clustered: `clusters_with_ticket / unique_incidents`.
- **KPI: `alerts_per_day`**
  - business meaning: ממוצע alerts/events ליום בטווח panel analysis.
  - formula JS: `Math.round(total / trendResult.length)`.
- **KPI: `night_wakeups` / `night_false_wakeups`**
  - source: `panel-analysis` summary; `night_wakeups` בפועל ממופה מ-`night_alerts`, לא מ-`night_true_wakeups`.
  - זה mismatch סמנטי חשוב.
- **how to add a new KPI end to end**
  1. להוסיף aggregate ל-query SQL המתאים או ל-batch query.
  2. לעדכן `AlertService` שימפה את השדה החדש ל-response.
  3. אם KPI מופיע גם ב-panel analysis וגם executive KPIs, לעדכן שני flows.
  4. לעדכן Joi schema אם נדרש query param חדש.
  5. לעדכן frontend consumer אם קיים. 
  6. אין test suite ייעודי בקוד שסופק, ולכן יש להוסיף בדיקות ידניות/אוטומטיות מחוץ להיקף הקוד הקיים.

# 9. How to add or change functionality
## 9.1 How to add a new query
- להוסיף SQL template חדש ב-`backend/database/queries/alertQueries.js`.
- להשתמש ב-placeholders קיימים (`{WHERE_CLAUSE}`, `{TOP_CLAUSE}` וכו') אם מתאים.
- אם צריך multi-recordset, להימנע מ-`_execute()` או להרחיב אותו.
- לחבר ב-`AlertService` דרך method חדש או הרחבת method קיים.
- לחשוף ב-controller מתאים.
- לרשום route חדש ב-`backend/routes/alertRoutes.js`.
- להוסיף Joi schema/query params מתאימים ב-`backend/schemas/alertSchemas.js`.
- לשקול performance: filters על `time_fired`, `application`, `panel_title`, `incident_number` תלויים באינדקסים שלא מופיעים בקוד.

## 9.2 How to add a new KPI
- **DB/query layer**: להוסיף aggregate ל-`UNCLUSTERED_KPI_STATS` וכנראה גם ל-`CLUSTERED_KPI_STATS`.
- **service layer**: לעדכן `getExecutiveKPIs()` ו/או `getPanelAnalysis()`.
- **controller/API exposure**: בדרך כלל אין שינוי controller אם ה-service מחזיר data חדש באותו endpoint.
- **n8n updates if relevant**: לא רלוונטי בקוד שסופק.
- **config/constants updates**: אם KPI דורש threshold חדש, להוסיף ב-`config/index.js` וב-schema.
- **tests**: להוסיף test files חדשים. כרגע **לא נמצא test code שסופק**.
- **docs to update**: המסמך הזה וכל docs צרכניים רלוונטיים.

## 9.3 How to add a new route
1. לבחור router קיים או ליצור חדש תחת `backend/routes/`.
2. להוסיף Joi schema מתאים.
3. להוסיף method ב-controller עם try/catch ו-`next(error)`.
4. להוסיף/להרחיב service.
5. לרשום את ה-router ב-`server.js` אם זה router חדש.
6. אם route אמור להיות public/restricted, לשים לב ל-mount path ול-CORS ב-`server.js`.

## 9.4 How to add a new service
1. ליצור קובץ חדש תחת `backend/services/...`.
2. אם יש גישה ל-SQL, להשתמש ב-`getSqlPool()`; אם Mongo, `getMongoDb()`.
3. לשמור business logic ב-service ולא ב-controller.
4. אם נדרש helper pure, להעדיף `incidentHelpers.js`-style file.
5. אם הוא route-facing, instantiate אותו ב-route file הנכון.

## 9.5 How to add a new n8n workflow
- **לא נמצא בקוד שסופק**; אין integration surface מתועד מול n8n.

## 9.6 How to change thresholds safely
- לעדכן default ב-`backend/config/index.js`.
- לעדכן Joi schema ב-`backend/schemas/alertSchemas.js` אם range/min/max משתנים.
- לבדוק את כל SQL queries שמשתמשות ב-threshold.
- לבדוק labels ב-`getDurationHistogram()` ו-`getPanelAnalysis()` כדי למנוע mismatch.
- אם threshold חדש קשור למשמרות, לעדכן גם JS formatting וגם SQL logic.

# 10. File-by-file documentation
## `backend/.gitignore`
- **file purpose**: קובץ ignore מקומי של חבילת ה-backend.
- **exported items**: אין.
- **imports and dependencies**: אין.
- **functions/classes inside**: אין.
- **what calls it**: Git בלבד.
- **what it calls**: nothing.
- **important notes**
  - מתעלם מ-`node_modules`, `coverage`, `build`, קבצי `.env*`, לוגי npm/yarn, וגם `.package-lock.json`.
  - זהו קובץ boilerplate תשתיתי ולא runtime code.

## `backend/package.json`
- **file purpose**: manifest של חבילת ה-backend.
- **exported items**: אין.
- **imports and dependencies**: מגדיר dependencies/devDependencies/scripts בלבד.
- **functions/classes inside**: אין.
- **important notes**
  - scripts:
    - `start`: `node server.js`
    - `dev`: `nodemon server.js`
    - `test`: `jest`
    - `test:watch`
    - `test:coverage`
  - dependencies declared:
    - `compression`, `cors`, `dotenv`, `express`, `helmet`, `joi`, `lru-cache`, `luxon`, `mongodb`, `mssql`
  - devDependencies:
    - `jest`, `nodemon`, `supertest`
  - פער חשוב: `ServiceNowClient.js` דורש `axios`, אך `axios` לא מוגדר כאן.
  - `lru-cache` מוגדר אך לא נצרך בקוד שסופק; `TimeUtils` משתמש ב-`Map` רגיל.

## `backend/README.md`
- **file purpose**: תיעוד onboarding/overview של ה-backend.
- **exported items**: אין.
- **functions/classes inside**: אין.
- **what calls it**: בני אדם בלבד.
- **important notes**
  - מתאר מבנה פרויקט אידיאלי הכולל קבצים/שכבות שלא קיימים בפועל בקוד שסופק, כגון `StatsController.js`, `statsRoutes.js`, `healthRoutes.js`, `errorHandler.js`, `requestId.js`, `response.js`.
  - לכן המסמך אינו source of truth למימוש הנוכחי.

## `backend/CONFLUENCE_DOCS.md`
- **file purpose**: מסמך תיעוד נוסף בתוך המאגר.
- **exported items**: אין.
- **functions/classes inside**: אין.
- **what calls it**: בני אדם בלבד.
- **important notes**
  - גם מסמך זה מתאר ארכיטקטורה עם קבצים שאינם קיימים בקוד שסופק, לדוגמה `AlertQueryService`, `AlertAnalysisService`, `routeHandler.js`, `SqlTemplates.js`, `ResponseFormatter.js`.
  - יש לראות בו מסמך היסטורי/שאיפות ארכיטקטוניות, לא תיאור runtime מדויק.

## `backend/server.js`
- **file purpose**: bootstrap מלא של Express app.
- **exported items**: `{ app, startServer, shutdown }`.
- **imports and dependencies**: `dotenv`, `express`, `cors`, `helmet`, `compression`, `luxon` (נטען אך לא בשימוש), `CONFIG`, DB connection functions, two route modules, `validateEnvironmentVariables`, `queryLogger`.
- **functions/classes inside**
  - top-level startup code: env validation + middleware registration + routes + error handlers.
  - `async startServer()`.
  - `async shutdown()`.
- **what calls it**
  - Node process דרך `node server.js` או `nodemon server.js`.
  - tests/imports עתידיים יכולים לקרוא exports.
- **what it calls**
  - DB initializers, route handlers דרך Express runtime.
- **important notes**
  - `PORT` משתמש `CONFIG.server.port || process.env.PORT || 3000`; מאחר ש-`CONFIG.server.port` קבוע 5000, `process.env.PORT` לא באמת יעקוף אותו.
  - `/api/incidents` mounted with public CORS.

## `backend/config/index.js`
- **purpose**: בניית קונפיגורציה immutable.
- **exports**: `CONFIG`, `dbConfig`, `mongoConfig`.
- **notes**
  - `mongoConfig.uri` נבנה אוטומטית אם `MONGO_URI` חסר.
  - `CONFIG.cache.enabled` אינו נצרך בשום מקום.
  - `CONFIG.server.host` אינו נצרך ב-`server.listen`.

## `backend/database/connection.js`
- **purpose**: singleton-like connection holders.
- **exports**: `initializeSqlDatabase`, `initializeMongoDatabase`, `getSqlPool`, `getMongoDb`, `closeConnections`.
- **detailed behavior**
  - שומר `sqlPool`, `mongoClient`, `mongoDb` כמודול-גלובל.
  - getters זורקים `Error` רגיל אם לא אותחל.

## `backend/database/queries/alertQueries.js`
- **purpose**: repository של SQL templates.
- **exports**: object literal עם כל query names.
- **important coupling**
  - placeholders replaced string-wise; אין parser.
  - names כמו `{WHERE_CLAUSE}` חייבים להתאים ל-service replacement logic.

## `backend/routes/alertRoutes.js`
- **purpose**: wiring ל-alert analytics endpoints.
- **exports**: Express router.
- **dependencies**: schemas, service, controller, validation middleware.
- **risk**: service/controller instances נבנים בזמן require, לא per-request.

## `backend/routes/incidentRoutes.js`
- **purpose**: wiring ל-incident-related endpoints.
- **exports**: Express router.
- **important notes**
  - comments על protected routes אינן מגובות בקוד.
  - כל endpoints זמינים ללא auth middleware.

## `backend/controllers/AlertController.js`
- **purpose**: thin HTTP adapter.
- **exports**: `{ AlertController }`.
- **functions inside**: 12 async methods + constructor binding.
- **caveats**
  - אין שימוש ב-custom error classes.
  - `getPanelAnalysis` מטפל ב-failure שונה מכל היתר.

## `backend/controllers/IncidentController.js`
- **purpose**: thin HTTP adapter עם special-case HTML errors.
- **exports**: `{ IncidentController }`.
- **functions inside**: constructor, `_getErrorAction`, 13 handlers.
- **caveats**
  - mix של JSON, redirect ו-HTML response באותו resource `/incident`.
  - `toggleIncidentRule` מבצע validation ידנית מחוץ ל-Joi.

## `backend/middleware/validation.js`
- **purpose**: generic Joi wrappers.
- **exports**: `validateQuery`, `validateBody`, `validateParams`.
- **caveats**
  - משתמש `schema.validate(...)` בלי `abortEarly:false`, לכן Joi behavior default יחליט כמה שגיאות מתקבלות.

## `backend/middleware/queryLogger.js`
- **purpose**: dev-only access log with row estimation.
- **exports**: `{ queryLogger }`.
- **functions**: `sanitizeParams`, `queryLogger`.
- **caveats**
  - override ל-`res.json` בלבד, לא ל-`res.send`/`res.redirect`.

## `backend/schemas/alertSchemas.js`
- **purpose**: Joi query validation לאנליטיקה.
- **exports**: `alertsSchema`, `statsSchema`, `statsSchemaRequiredPanel`, `panelStatsSchema`, `timeseriesSchema`, `panelResearchSchema`, `patternSchema`.
- **important notes**
  - `patternSchema` ו-`statsSchemaRequiredPanel` אינם בשימוש בקוד שסופק.
  - `night_start`/`night_end`, `duration_metric`, `granularity`, `fill_gaps` לא נצרכים בהמשך.

## `backend/schemas/incidentSchemas.js`
- **purpose**: Joi schemas ל-incident endpoints.
- **exports**: `alertQuerySchema`, `serviceNowAlertSchema`, `combinedCreateSchema`, `systemMappingSchema`, `incidentRuleSchema`.
- **important notes**
  - `serviceNowAlertSchema` ו-`combinedCreateSchema` אינם מחוברים ל-routes בקוד שסופק.
  - `systemMappingSchema` מאפשר `unknown(true)` ולכן ניתן לשמור שדות נוספים במסמך.

## `backend/services/alert/AlertService.js`
- **purpose**: core analytics service.
- **exports**: class `AlertService`.
- **imports**: `mssql`, `getSqlPool`, SQL queries, `CONFIG`, `TimeUtils`.
- **functions inside**: `constructor`, `getPool`, `_buildWhereClause`, `_bindThresholds`, `_getClusteringConfig`, `_execute`, ועוד 10 public methods.
- **what calls it**: `AlertController`.
- **what it calls**: SQL Server through `mssql`.
- **important caveats**
  - duration label mismatch vs custom thresholds.
  - clustering duration inconsistent across queries.
  - timeseries schema features not implemented.

## `backend/services/incident/IncidentService.js`
- **purpose**: end-to-end incident orchestration.
- **exports**: class `IncidentService`.
- **imports**: `getMongoDb`, `mongoConfig`, `ServiceNowClient`, helpers.
- **functions inside**: `db`, `serviceNowClient`, `createIncidentFromAlert`, `getAssignmentGroups`, `syncAssignmentGroups`, `createServiceNowAlert`, `createIncidentWithAlert`, `simulateIncidentCreation`, `getIncidentHistory`.
- **important caveats**
  - best-effort logging without await.
  - ServiceNow failure does not necessarily fail HTTP request.

## `backend/services/incident/SystemMappingService.js`
- **purpose**: mapping CRUD + application resolution.
- **exports**: class `SystemMappingService`.
- **caveats**
  - full collection scan for every application resolution.
  - exact conflict detection only.

## `backend/services/incident/IncidentRuleService.js`
- **purpose**: incident rule CRUD and filtering.
- **exports**: class `IncidentRuleService`.
- **caveats**
  - rules store `grafana_names` snapshot and may drift from source mapping.

## `backend/services/incident/ServiceNowClient.js`
- **purpose**: HTTP client ל-ServiceNow.
- **exports**: `{ ServiceNowClient }`.
- **caveats**
  - missing `axios` dependency in package manifest.
  - createIncident returns failure object instead of throwing.

## `backend/services/incident/incidentHelpers.js`
- **purpose**: pure business helpers ל-matching/building.
- **exports**: 12 helper functions.
- **caveats**
  - no HTML escaping/template escaping.
  - matching precedence is score-based, then merged in reverse order.

## `backend/utils/TimeUtils.js`
- **purpose**: timezone conversion helpers with cache.
- **exports**: `{ TimeUtils, IL_ZONE }`.
- **functions**: `clearCache`, `_getOrCache`, `utcToIL`, `getILHour`, `getILDate`, `getILWeekday`, `batchGetILHours`, `batchGetILDates`, `parseILToUTC`, `validateDateRange`, `isNightHour`, `isDayHour`, `getCurrentILDate`, `getCurrentILTime`, `getTimezoneInfo`, `formatDuration`, `getCacheStats`.

## `backend/utils/constants.js`
- **purpose**: common constants.
- **exports**: seven frozen objects/constants.

## `backend/utils/errors.js`
- **purpose**: custom error hierarchy.
- **exports**: `AppError`, `NotFoundError`, `ValidationError`, `ConflictError`, `UnauthorizedError`, `DatabaseError`, `ServiceNowError`.
- **caveat**: currently mostly unused.

## `backend/utils/htmlTemplates.js`
- **purpose**: HTML error page generator.
- **exports**: `{ getErrorHtml }`.

## `backend/utils/validateEnv.js`
- **purpose**: env presence validation.
- **exports**: `validateEnvironmentVariables`, `REQUIRED_ENV_VARS`, `RECOMMENDED_ENV_VARS`.

## Non-backend files in repository
- `docs/*.md`: reference documentation בלבד, לא runtime.
- `frontend/**/*`: צרכן API. לא נכלל בפירוט implementation של backend מעבר למבנה פרויקט.
- `backend/README.md`, `backend/CONFLUENCE_DOCS.md`: תיעוד קיים; לא משפיעים על runtime.
- `.gitignore` files: boilerplate להגדרת ignore rules; לא נבדקו לפרטים מעבר לכך.

# 11. Configuration and environment
- **all env vars found in code**
  - SQL:
    - `SQL_SERVER`
    - `SQL_PORT`
    - `SQL_DATABASE`
    - `SQL_USER`
    - `SQL_PASSWORD`
    - `SQL_ENCRYPT`
    - `SQL_POOL_MAX`
    - `SQL_POOL_MIN`
    - `SQL_QUERY_TIMEOUT_MS`
  - Mongo:
    - `MONGO_URI`
    - `MONGO_USER`
    - `MONGO_PASSWORD`
    - `MONGO_HOST`
    - `MONGO_PORT`
    - `MONGO_DB`
    - `MONGO_AUTH_DB`
  - ServiceNow:
    - `SERVICENOW_URL`
    - `SERVICENOW_USERNAME`
    - `SERVICENOW_PASSWORD`
  - Server/App:
    - `NODE_ENV`
    - `PORT`
    - `FRONTEND_URL`
    - `ALLOWED_ORIGINS`
  - Thresholds/config:
    - `DURATION_SHORT_MAX`
    - `DURATION_MEDIUM_MAX`
    - `DURATION_FALSE_WAKEUP`
    - `SHIFT_DAY_START`
    - `SHIFT_DAY_END`
    - `SHIFT_NIGHT_START`
    - `SHIFT_NIGHT_END`
    - `QUERY_DEFAULT_CAP`
    - `QUERY_MAX_PAGE_SIZE`
    - `QUERY_MAX_DATE_RANGE_DAYS`
    - `CLUSTER_ENABLED_DEFAULT`
    - `CLUSTER_THRESHOLD_MINUTES`
- **where each one is used / required / optional / defaults / impact**
  - `SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`, `SQL_PASSWORD`
    - used in `dbConfig` and required in production by validator.
    - wrong values → SQL connection failure on startup.
  - `MONGO_URI`
    - preferred source for Mongo connection.
    - required in production validator, אף על פי שיש builder fallback. כלומר אם משתמשים רק ב-parts בלי `MONGO_URI`, validator עדיין יתריע/יכשיל production.
  - `MONGO_*` parts
    - used only אם `MONGO_URI` חסר.
  - `SERVICENOW_URL/USERNAME/PASSWORD`
    - validator דורש כולם ב-production.
    - `ServiceNowClient` בפועל צריך רק URL כדי `isEnabled` ייחשב true; missing credentials עלול לגרום 401 runtime.
  - `FRONTEND_URL`
    - used for restricted CORS production fallback ולבניית action link ב-error page.
  - `ALLOWED_ORIGINS`
    - CSV של origins נוספים.
  - `PORT`
    - intent to configure server port, אך בפועל `CONFIG.server.port=5000` גובר עליו.
  - threshold vars
    - משפיעים על defaults עבור duration/shifts/clustering/limits.
- **secrets handling**
  - credentials נטענים ישירות מ-env.
  - `initializeMongoDatabase()` מדפיס ל-console את `mongoConfig.uri`, מה שעלול לחשוף סיסמה בלוגים.
  - אין secret manager ואין redaction גלובלי.

# 12. Error handling and observability
- **global error flow**
  - route/controller זורק או קורא `next(error)` → global error middleware ב-`server.js`.
- **try/catch strategy**
  - controllers עוטפים כמעט כל handler ב-try/catch.
  - services לרוב לא עוטפים, אלא זורקים `Error` רגיל.
  - ServiceNowClient ב-`createIncident` בולע שגיאה ומחזיר object עם `success:false`.
- **custom errors**
  - קיימים ב-`utils/errors.js` אך **לא מיושמים בפועל**.
- **logging**
  - startup/shutdown logs.
  - queryLogger ב-development.
  - incident creation/sync logs ב-controller/service/client.
  - SQL/Mongo connection test logs.
- **monitoring**
  - **לא נמצא בקוד שסופק**.
- **alerting**
  - **לא נמצא בקוד שסופק**.
- **missing observability gaps**
  - אין correlation ID.
  - אין structured logging.
  - אין metrics endpoint.
  - אין tracing.
  - כשל ביצירת TTL index נבלע.
  - ServiceNow failure עשוי להיראות כ-success HTTP.

# 13. Security
- **auth/authz flow**
  - **לא מיושם**.
  - אין JWT/session/basic auth inbound.
- **middleware protections**
  - `helmet`.
  - CORS.
  - Joi validation.
- **validation**
  - query/body validation טובה יחסית ל-input structure.
  - אין validation ל-`req.params.id` כ-ObjectId.
- **injection risks**
  - SQL filters משתמשים parameter binding לערכים, מה שמפחית SQL injection.
  - אבל שמות עמודות ל-sorting מוכנסים כמחרוזת ישירה; Joi מגביל ל-whitelist ולכן הסיכון נשלט.
  - HTML template ב-`getErrorHtml` vulnerable ל-HTML injection מתוך error text.
  - template replacement ל-ServiceNow payload לא escaped; תלוי בצרכן.
- **sensitive data handling**
  - Mongo URI מודפס ל-log.
  - queryLogger מצנזר רק keys מסוימים.
- **permission boundaries**
  - אין. כל CRUD routes פתוחים למי שמגיע לשרת.
- **webhook security**
  - `/api/incidents/incident` public ללא secret/signature.
- **DB access risks**
  - backend process מחזיק credentials מלאים ל-SQL/Mongo.
  - אין rate limiting.

# 14. Performance and technical debt
- **heavy queries**
  - clustering queries עם window functions על כל הסט המסונן.
  - batch panel analysis יוצר temp table וסורק data מספר פעמים.
  - `getMappingByApplication()` ו-`getIncidentRules(application)` מבצעים full scans/load-all ב-Mongo.
- **repeated logic**
  - clustering SQL משוכפל בהרבה queries.
  - shift expressions משוכפלים שוב ושוב ב-SQL.
  - threshold labels מחושבים בכמה מקומות.
- **tight coupling**
  - rules מחזיקים snapshot של `grafana_names` מהמיפוי.
  - routes מייצרים services/controllers בזמן import.
  - response shapes hardcoded ב-controllers.
- **fragile areas**
  - ServiceNowClient dependency missing in package manifest.
  - port env override broken.
  - mismatches בין schema ל-service (`granularity`, `fill_gaps`, `duration_metric`, `night_start`, `night_end`).
  - `duration_category` hardcoded 30/300.
  - comments לא תואמות קוד (protected routes, POST sync).
- **scalability risks**
  - full collection scans ב-Mongo.
  - no pagination on many Mongo list endpoints.
  - no caching on expensive SQL KPI queries.
  - no connection health retries/backoff.
- **likely bug-prone files**
  - `AlertService.js`
  - `alertQueries.js`
  - `IncidentService.js`
  - `incidentHelpers.js`
  - `server.js`
- **recommendations grounded in current code**
  - להשתמש ב-`CONFIG.server.port` שמכבד `process.env.PORT`.
  - להוסיף auth middleware לפחות ל-CRUD endpoints.
  - לאחד clustering SQL ל-view/CTE generator אחד.
  - לעדכן labels לפי params בפועל.
  - להחליף logging של Mongo URI.
  - להוסיף אינדקסים/queries ממוקדים ל-Mongo במקום `find({}).toArray()`.

# 15. Appendix
- **glossary of project-specific terms**
  - `historicalAlerts`: טבלת SQL של התראות היסטוריות.
  - `false wakeup`: alert/event עם משך קטן או שווה ל-`false_wakeup_threshold`.
  - `cluster`: קבוצה של alerts סמוכים בזמן לפי `cluster_threshold`.
  - `system mapping`: מסמך Mongo הממפה application Grafana לשדות ServiceNow.
  - `incident rule`: מסמך Mongo המתאר תנאים ו-overrides ל-incident payload.
- **request/response examples**
  - `GET /api/alerts?start_date=2026-03-01&end_date=2026-03-20&application=app1&clustering_enabled=true`
    - response example high-level:
      - `success: true`
      - `data: [{ id, panel_title, application, node_name, ... is_cluster, cluster_count, raw_alerts }]`
  - `POST /api/incidents/incident`
    - body:
```json
{
  "application": "billing_app",
  "object_name": "db01",
  "node_name": "node-a",
  "message": "CPU critical",
  "operator": "noc",
  "network": "prod"
}
```
    - response success:
```json
{
  "success": true,
  "message": "Incident created successfully",
  "data": {
    "incidentData": {"service_offering": "..."},
    "serviceNowResult": {"success": true, "incident_number": "INC0012345"},
    "mapping_used": "...",
    "rule_used": "...",
    "rule_name": "Base Mapping"
  }
}
```
- **SQL examples**
  - clustering condition example:
```sql
CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (ORDER BY time_fired), time_fired) > @cluster_threshold
     THEN 1 ELSE 0 END AS is_new_cluster
```
  - day/night split example:
```sql
CASE WHEN DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_start
      AND DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_end
     THEN 'Day' ELSE 'Night' END
```
- **dependency graph summaries**
  - Alert flow:
    - `server.js` → `routes/alertRoutes.js` → `middleware/validation.js` → `controllers/AlertController.js` → `services/alert/AlertService.js` → `database/connection.js` + `database/queries/alertQueries.js` + `utils/TimeUtils.js`.
  - Incident flow:
    - `server.js` → `routes/incidentRoutes.js` → `middleware/validation.js` → `controllers/IncidentController.js` → `services/incident/IncidentService.js` → (`SystemMappingService.js` + `IncidentRuleService.js` + `incidentHelpers.js` + `ServiceNowClient.js`) → MongoDB / ServiceNow.
