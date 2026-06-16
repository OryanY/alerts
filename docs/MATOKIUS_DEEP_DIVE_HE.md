# תיעוד מעמיק — מתוקיוס (Backend + Frontend)

> מסמך זה משלים את התיעוד הקיים (זרימת ה‑n8n, ה‑DB וה‑DevOps).
> כאן צוללים פנימה לקוד עצמו — קודם ה‑**Backend** ואז ה‑**Frontend**.
> כל מה שכתוב כאן משקף את הקוד בפועל נכון לכתיבת המסמך. אם משהו לא תואם — הקוד הוא מקור האמת.

---

# 🧱 חלק א' — Backend

## 1. מה ה‑Backend בעצם עושה

שני תפקידים, ותו לא:

1. **שכבת BI על ההתראות ההיסטוריות** — קריאה בלבד מטבלת `dbo.historicalAlerts` ב‑MSSQL, והפקת סטטיסטיקות (KPIs, היסטוגרמות, heatmap, ניתוח לפי פאנל, כיסוי תקלות וכו').
2. **יצירת תקלות ב‑ServiceNow** — endpoint שמקבל התראה, בונה payload לפי מיפוי + חוקים, ושולח ל‑ServiceNow. **ה‑n8n הוא שמחליט מתי לקרוא ל‑endpoint הזה** — כל ה‑dedup והקיבוץ קורים ב‑n8n, לא כאן. הפונקציה `createIncidentFromAlert` תמיד יוצרת תקלה חדשה, בלי שום dedup.

> נקודה קריטית: אל תוסיף לוגיקת dedup ב‑Backend. זה באחריות ה‑n8n.

---

## 2. ארכיטקטורה ושכבות

הזרימה הכללית של בקשה:

```
HTTP → queryLogger → CORS → Joi validation → handler/controller → service → (SQL / Mongo / ServiceNow) → envelope JSON
```

| שכבה | תיקייה | תפקיד |
|------|--------|-------|
| Routes | `routes/` | הגדרת הנתיב + הצמדת ולידציית Joi + הפניה ל‑handler |
| Controllers | `controllers/` | רק עבור התקלות (`IncidentController`) — תרגום בקשה→שירות וטיפול בשגיאות. ה‑Alerts לא משתמשים ב‑controller, ה‑handlers דקים ויושבים ב‑route |
| Services | `services/` | כל הלוגיקה העסקית |
| Queries | `database/queries/` | ריכוז כל ה‑SQL במקום אחד |
| Utils | `utils/` | cache, logger, errors (תשתיות חוצות‑מערכת) |

**הזרקת תלויות (DI):** ב‑`incidentRoutes.js` יוצרים את השירותים פעם אחת ומזריקים אותם ל‑controller:

```js
const mappingService  = new SystemMappingService();
const ruleService     = new IncidentRuleService();
const settingsService = new IncidentSettingsService();
const incidentService = new IncidentService(mappingService, ruleService, settingsService);
const controller      = new IncidentController(incidentService, mappingService, ruleService, settingsService);
```

---

## 3. מבנה התיקיות (בפועל)

```
backend/
├── config/
│   ├── index.js          # אובייקט CONFIG + הגדרות חיבור ל‑SQL/Mongo (קורא מ‑.env)
│   └── validateEnv.js    # ולידציית משתני סביבה בעלייה (fail-fast בפרוד)
├── controllers/
│   ├── IncidentController.js  # handlers ל‑incident/mapping/rule/settings
│   └── htmlTemplates.js       # דף שגיאה HTML לזרימות webhook (GET)
├── database/
│   ├── connection.js     # pool ל‑SQL Server + client ל‑MongoDB + מחזור חיים
│   └── queries/
│       └── alertQueries.js    # כל תבניות ה‑T‑SQL (clustered + unclustered)
├── middleware/
│   ├── validation.js     # validateQuery / validateBody / validateParams (Joi)
│   └── queryLogger.js     # לוג בקשות HTTP לפי REQUEST_LOG_POLICY
├── routes/
│   ├── alertRoutes.js     # /api/alerts + /api/stats/*  (handlers בתוך ה‑route)
│   ├── incidentRoutes.js  # /api/incidents/* + /from-grafana  (תבנית controller)
│   └── metrics.js         # /metrics — ספירת תקלות חיה מ‑ServiceNow לדאשבורדים חיצוניים
├── schemas/
│   ├── alertSchemas.js     # סכמות Joi ל‑BI
│   └── incidentSchemas.js  # סכמות Joi ליצירת תקלות + mappings/rules/settings
├── services/
│   ├── alert/
│   │   └── AlertService.js          # אורקסטרציה של ה‑BI, בניית WHERE, clustering
│   └── incident/
│       ├── IncidentService.js       # יצירת תקלות (pipeline) + סימולציה
│       ├── IncidentRuleService.js   # CRUD לחוקים + התאמת חוקים (Mongo)
│       ├── SystemMappingService.js  # CRUD למיפויים + חיפוש לפי application
│       ├── IncidentSettingsService.js  # תבניות + שדות ברירת מחדל (UI‑editable)
│       ├── incidentSettingsDefaults.js # ברירות המחדל בקוד (fallback)
│       ├── ServiceNowClient.js      # לקוח ל‑ServiceNow Table API (axios)
│       └── incidentHelpers.js       # פונקציות טהורות: התאמת חוקים + בניית payload
├── utils/
│   ├── cache.js          # מקור אמת יחיד לקאשינג (שתי שכבות)
│   ├── logger.js         # מקור אמת יחיד ללוגים + מדיניות לוג בקשות
│   └── errors.js         # מחלקות שגיאה ממופות ל‑HTTP
├── test/
│   └── incidentHelpers.test.js  # בדיקות characterization (node:test)
└── server.js             # חיווט האפליקציה, עלייה, כיבוי מסודר
```

---

## 4. חיבורי בסיסי נתונים — `database/connection.js`

- **SQL Server (MSSQL):** `ConnectionPool` יחיד שנוצר בעלייה. כל השאילתות עוברות דרכו (`getSqlPool()`). אם החיבור נכשל — `process.exit(1)` (fail‑fast).
- **MongoDB:** `MongoClient` יחיד (`getMongoDb()`). משמש למיפויים, חוקים, הגדרות תקלה, וה‑shared cache.

> שתי בסיסי הנתונים נפתחים פעם אחת בעלייה ונסגרים ב‑`SIGINT`/`SIGTERM` דרך `closeConnections()`.

---

## 5. שכבת השאילתות — `database/queries/alertQueries.js`

כל ה‑SQL יושב כאן כתבניות מחרוזת עם placeholders:

- `{WHERE_CLAUSE}` — נבנה דינמית ב‑`AlertService._buildWhereClause`.
- `{ORDER_CLAUSE}` / `{PAGINATION_CLAUSE}` / `{TOP_CLAUSE}` — מוזרקים לפי הצורך.

לכל שאילתה יש שתי גרסאות: **רגילה** (לפי שורות גולמיות) ו‑**clustered** (CTE שמקבץ סופות התראות לפי `(panel_title, application)` בחלון זמן). למשל `UNCLUSTERED_KPI_STATS` מול `CLUSTERED_KPI_STATS`.

### ⛔ חוק הברזל — מניעת SQL Injection
ערכי משתמש **אף פעם** לא משורשרים למחרוזת SQL. תמיד דרך פרמטרים:

```js
request.input('panel_title', sql.NVarChar, params.panel_title);
conditions.push('panel_title = @panel_title');
```

ה‑placeholders (`{WHERE_CLAUSE}` וכו') מוחלפים רק במקטעים שנשלטים על ידי הקוד. שדה המיון (`sort_by`) עובר whitelist ב‑Joi לפני שהוא נכנס ל‑`ORDER BY`.

> ⚠️ **duration שלילי (למשל ‑180):** חישוב ה‑`duration_sec` נעשה ב‑stored procedure `migrate_alert_to_history` (ב‑DB, מחוץ ל‑repo), והוא מחשב `DATEDIFF(SECOND, @time_created, @resolved_time)` כש‑`time_created` מגיע משעון **מקור הניטור** ו‑`@resolved_time` משעון ה‑**n8n** — חיסור בין שני שעונים שונים. כששעון המקור מקדים את שעון ה‑n8n ב‑~3 דקות, התראות קצרות מקבלות ~‑180. התיקון: (1) לחשב את המשך מ‑`time_processed` (שעון n8n, זהה ל‑resolved) ולא מ‑`time_created`; (2) להסיר את `time_processed` מרשימת ה‑SET ב‑UPDATE שב‑`upsert_active_alert`, כדי שיישאר "הפעם הראשונה שראינו" (כרגע הוא נדרס בכל מחזור). בנוסף, ה‑fallback `IF @resolved_time IS NULL SET @resolved_time = GETDATE()` משתמש בזמן מקומי בעוד כל השאר UTC — עדיף `GETUTCDATE()`.

---

## 6. `AlertService` — מנוע ה‑BI

`AlertService` מתרגם פרמטרים מה‑frontend לשאילתות ומעבד את התוצאה. נקודות מפתח:

- **ספים מגיעים מהלקוח.** `dur_short_max`, `dur_medium_max`, `false_wakeup_threshold`, `day_start/day_end`, `clustering_enabled`, `clustering_threshold` — כולם פרמטרים ב‑query. ברירות המחדל ב‑Joi/ENV הן רק ל‑callers ישירים, ו**חייבות להישאר תואמות** ל‑`DEFAULT_CLIENT_CFG` בפרונט (short ≤59 s, medium ≤299 s, false‑wakeup 120 s).
- **`_buildWhereClause`** — בונה את ה‑WHERE עם פרמטרים בלבד (תאריכים מומרים מ‑Asia/Jerusalem ל‑UTC ב‑luxon).
- **`_getClusteringConfig`** — מחליט בין הגרסה ה‑clustered לרגילה.
- **KPIs + מגמה:** `getExecutiveKPIs` שולף גם את **התקופה הקודמת בגודל זהה** (במקביל) ומחזיר `total_trend_pct` ו‑`noise_trend_pct` (שינוי באחוז התראות השווא). שני השדות מושמטים כשאין נתוני תקופה קודמת — כך שחץ המגמה פשוט לא מוצג.
- **חישובי אחוזים** מוגנים ב‑`NULLIF` ב‑SQL, ומעוגלים פעם אחת ב‑JS.

---

## 7. שירותי התקלות

### `IncidentService` — ה‑pipeline
`_evaluateAlert(alertData)` מרכז את כל ההערכה:
1. מציאת **מיפוי מערכת** לפי ה‑`application` (אם אין — `MappingNotFoundError`).
2. שליפת החוקים הפעילים והרצת התאמה (`findAllMatches`).
3. מיזוג ה‑overrides מהפחות‑ספציפי לכי‑ספציפי, כך שהחוק הספציפי ביותר מנצח בכל שדה.

`createIncidentFromAlert` קורא ל‑`_evaluateAlert` + `settingsService.getSettings()` במקביל, בונה payload דרך `buildIncidentData`, שולח ל‑ServiceNow, ומחזיר סיכום. **אין audit log** — אם רוצים לראות מה התראה הייתה מייצרת בלי ליצור תקלה, יש `POST /api/incidents/incident/simulate`.

### `SystemMappingService` — מיפויים
ממפה מזהים טכניים (`grafana_names` עם type: exact/contains/regex) להקשר עסקי (assignment_group, business_service, service_offering, u_network). `getMappingByApplication` מחפש קודם התאמה מדויקת ואז contains/regex. קאש מקומי קצר.

### `IncidentRuleService` — מנוע החוקים (specificity)
חוקים מקבלים ציון לפי סוג התנאי:
- **Exact = 10**, **Regex = 7**, **Contains = 3 לכל מונח**.
- חוק שאינו גלובלי (קשור למיפוי) מקבל **+100** — כלומר תמיד מנצח חוק גלובלי.
- החוק עם הציון הגבוה ביותר מנצח; ה‑overrides ממוזגים לפי סדר ספציפיות.

### `IncidentSettingsService` — תבניות ושדות ברירת מחדל (ניתן לעריכה מה‑UI)
מסמך יחיד באוסף `incident_settings` ב‑Mongo. מכיל:
- `content_templates` — תבניות ל‑short_description/description עם `{{משתנים}}`.
- `default_fields` — מילוי שדות חובה ב‑ServiceNow (למשל `u_phone_voip: "1234"`).

נקרא עם קאש מקומי קצר (30 שניות) שמתאפס מיידית בכתיבה — כך ששינוי ב‑UI חל על התקלה הבאה בלי restart. **`required_fields` ו‑`literal_fields` מנוהלים בקוד בלבד** (`incidentSettingsDefaults.js`), כי הם החוזה הקבוע של ServiceNow ולא קונפיגורציה. עריכה דורשת מפתח צוות (ראו §13).

### `ServiceNowClient` — הלקוח החיצוני
- `createIncident` / `createTiudAlert` — POST ל‑Table API.
- `fetch*` (assignmentGroups, networks, serviceOfferings, businessServices) — נתוני ייחוס, נשמרים ב‑**shared cache** (Mongo) ל‑24 שעות כך שרק pod אחד פונה ל‑ServiceNow לכל TTL.

### `incidentHelpers` — פונקציות טהורות
- `buildIncidentData` — בונה את ה‑payload לפי סדר עדיפויות: **override של חוק → מיפוי → content_templates → default_fields**. שדות `literal_fields` (assignment_group, service_offering, business_service) נשלחים מילולית בלי החלפת `{{משתנים}}`.
- `normalizeGrafanaAlert` — נירמול התראת Grafana נכנסת: החלפת `%` ב‑" percent ", lower‑case ל‑object_name, ושכתובי application מדור קודם (`LEGACY_APPLICATION_REWRITES`: `vmwere`→`virtu_cyber` כשיש "esx", `l-twix`→`twix`). השכתובים מקודדים בקוד בכוונה (legacy).

---

## 8. ולידציה — `schemas/` + `middleware/validation.js`
כל endpoint עוטף את ה‑body/query בסכמת Joi דרך `validateBody` / `validateQuery`. כישלון מחזיר 400 עם רשימת פרטים. הערך המאומת נשמר ב‑`req.validatedBody` / `req.validatedQuery`.

---

## 9. טיפול בשגיאות — `utils/errors.js`
מחלקות שגיאה ממופות ל‑HTTP, במקום בדיקת מחרוזות:

| מחלקה | HTTP | מתי |
|-------|------|-----|
| `ValidationError` | 400 | קלט שעבר סכמה אך נכשל בכלל עסקי |
| `MappingNotFoundError` | 404 | אין מיפוי ל‑application (זרימת webhook מציגה כפתור "צור מיפוי") |
| `NotFoundError` | 404 | משאב לא קיים |
| `ConflictError` | 409 | התנגשות / תלויות חוסמות |
| `ServiceNowError` | 502 | ServiceNow דחה/לא זמין — כדי שלעולם לא נחזיר 200 על תקלה שלא נוצרה |

ה‑controller ממפה: זרימות webhook (GET) → דף HTML עם הודעה בעברית (כל המחרוזות עוברות escape כנגד XSS); זרימות תוכנה → JSON. שגיאות לא מזוהות עוברות ל‑error middleware הגלובלי ב‑`server.js`.

---

## 10. קאשינג — `utils/cache.js` (מקור אמת יחיד)
שתי שכבות:

| שכבה | API | למה משמשת |
|------|-----|-----------|
| **מקומית** | `createLocalCache(name, { ttlMs, maxEntries })` | נתונים מ‑Mongo שחמים (מיפויים, חוקים, הגדרות, memoization של תגובות). זול, אך לכל pod עותק — TTL קצר + ביטול בכתיבה |
| **משותפת** | `cacheGet/cacheSet/cacheDelByPrefix` (Mongo) | קריאות **חיצוניות** יקרות בלבד (ServiceNow, /metrics) — רק ה‑pod הראשון שמחמיץ פונה ל‑upstream |

> אסור ליצור `Map`/`lru-cache` אד‑הוק. תמיד דרך cache בשם.

---

## 11. לוגים ותצפיתיות — `utils/logger.js` (מקור אמת יחיד)
- רמות: `error / warn / info / debug`, נשלטות ב‑`LOG_LEVEL` (ברירת מחדל `info` בפרוד, `debug` בפיתוח).
- `logger.tagged('area')` ל‑logger עם תגית.
- **לעולם לא `console.*` ישירות** (החריג היחיד: ה‑SINKS של ה‑logger עצמו).
- **מדיניות לוג בקשות HTTP** = `REQUEST_LOG_POLICY` באותו קובץ: `silentPaths` (כמו `/health`, `/metrics`) לא נרשמים אף פעם; שגיאות (≥400) תמיד נרשמות; הצלחות רק כש‑`LOG_HTTP_SUCCESS` מאפשר (כבוי בפרוד כברירת מחדל). מפתחות רגישים ב‑query עוברים redaction.

> כדי לראות מה קורה בפרוד: `LOG_LEVEL=info` נותן עליות, חיבורי DB, יצירת תקלות וכל השגיאות — בלי רעש per‑request. ל‑debug נקודתי: `LOG_LEVEL=debug`.

---

## 12. מטריקות — `routes/metrics.js`
ספירת תקלות חיה מ‑ServiceNow לפי צוות/state/tag, עם קאש של 60 שניות בשכבה המשותפת. נצרך על ידי דאשבורדים חיצוניים — להתייחס להתנהגות ה‑query/הפילטרים כחוזה קפוא (אל תשנו בלי אישור).

---

## 13. אבטחה ומשתני סביבה
- **אין אימות/הרשאות** במערכת (החלטה מודעת). מה שכן: עריכת **הגדרות התקלה** דורשת **מפתח צוות** — `INCIDENT_SETTINGS_KEY` ב‑`.env`, נשלח ב‑header `X-Settings-Key` (השוואה timing‑safe). קריאה פתוחה לכולם. אם המפתח לא מוגדר — עריכה פתוחה (פיתוח) ומודפסת אזהרה בעלייה. ה‑header הזה חייב להיות ב‑CORS `allowedHeaders` אחרת ה‑preflight נחסם.
- **CORS** — `config.cors`. בפרוד מצמצמים ל‑`FRONTEND_URL` + `ALLOWED_ORIGINS`.
- משתני סביבה עיקריים: `SQL_*`, `MONGO_*`, `SERVICENOW_*`, `NODE_ENV`, `FRONTEND_URL`. אופציונליים: `INCIDENT_SETTINGS_KEY`, `LOG_LEVEL`, `LOG_HTTP_SUCCESS`, ספי `DURATION_*`/`SHIFT_*`/`CLUSTER_*` (חייבים להישאר תואמים לפרונט).

---

## 14. בדיקות
`npm test --prefix backend` (מנוע `node:test` המובנה, בלי תלויות). הכיסוי הנוכחי: `incidentHelpers` — ניקוד ספציפיות, AND/OR, `buildIncidentData` (סדר העדיפויות + תבניות), `normalizeGrafanaAlert`, ולידציית patterns.

---

## 15. מדריך הוספות (Backend)

**להוסיף route חדש:**
1. סכמת Joi ב‑`schemas/` (או שימוש בקיימת).
2. פונקציה ב‑`services/` שמבצעת את הלוגיקה.
3. handler ב‑`controllers/` (לתקלות) או handler דק ב‑`routes/` (ל‑BI) — מחזיר `{ success:true, data:… }` ומזרים שגיאות ל‑`next(err)`.
4. רישום הנתיב ב‑`routes/` עם הולידציה לפני ה‑handler.

**להוסיף מדד חדש לדאשבורד:**
1. שאילתה ב‑`database/queries/alertQueries.js` עם `{WHERE_CLAUSE}` ו‑`@cluster_threshold` לפי הצורך.
2. לבדוק ישירות ב‑SSMS.
3. מתודה ב‑`AlertService` שמריצה ומחזירה.
4. route ב‑`alertRoutes.js`.
5. צד מקבל ב‑Frontend.

**להוסיף שדה חדש לתקלה ב‑ServiceNow:**
- אם זה שדה דינמי — אפשר להוסיף אותו ל‑`content_templates`/`default_fields` **דרך ה‑UI** (טאב "Incident Defaults"), בלי קוד.
- אם זה שדה חובה קבוע — להוסיף ל‑`required_fields` ב‑`incidentSettingsDefaults.js` ולוודא שהמיפויים מספקים אותו.

---
---

# 🎨 חלק ב' — Frontend

## 1. סקירה כללית
React 18 (CRA), React Router v6, React Query לשליפת נתונים, Recharts לגרפים. ה‑UI דו‑לשוני: עברית (RTL) בכרטיסים/טבלאות, אנגלית בניווט/פקדים. עיצוב דרך `ThemeContext` + inline styles (בלי Tailwind).

---

## 2. מבנה התיקיות

```
frontend/src/
├── App.jsx               # ניתוב ראשי + ספקי context
├── index.js / index.css  # נקודת כניסה + CSS גלובלי (shell, ניווט, פקדים)
├── contexts/
│   ├── ThemeContext.jsx        # ערכת צבעים בהירה/כהה + tokens + styles מחושבים
│   ├── ClientConfigContext.jsx # טווח תאריכים + ספים (localStorage) + getApiParams
│   └── TopBarContext.jsx       # "slots" שעמודים מזריקים ל‑topbar
├── hooks/
│   ├── useApiData.js     # שליפה עם abort (לעמודים שלא עברו ל‑React Query)
│   ├── useUrlState.js    # סנכרון פילטרים ל‑URL (Explorer)
│   └── useDurationBands.js # צבע/legend לפי רצועות משך
├── utils/
│   ├── api.js            # fetchApi / buildApiUrl
│   ├── constants.js      # API_BASE + DEFAULT_CLIENT_CFG (מקור אמת לספים בפרונט)
│   ├── dateUtils.js      # פורמט תאריכים (זמן ישראל)
│   ├── formatters.js     # formatDuration, withAlpha, escapeCsv
│   ├── chartConfig.js    # קונפיג אחיד ל‑Recharts
│   └── themedStyles.jsx  # מחולל אובייקטי style מה‑theme
├── components/
│   ├── ui/               # פרימיטיבים: MetricCard, ChartCard, AlertTable, DateRangePicker, Tooltip, LoadingSpinner/Skeleton, ErrorBoundary/Callout, LabeledInput, LazyInput, WakeupGauge
│   ├── layout/           # Layout (shell), ThemeToggle, ColumnVisibilityPanel
│   ├── common/           # SearchableSelect
│   ├── dashboard/        # widgets עם לוגיקה
│   ├── IncidentMappings/ # טופסי/כרטיסי מיפויים
│   ├── IncidentRules/    # טופסי/כרטיסי חוקים + RuleSimulator
│   ├── IncidentDefaults/ # IncidentDefaultsTab (תבניות + שדות ברירת מחדל)
│   └── PanelResearch/    # רכיבי עמוד המחקר
└── pages/                # עמודים (ראו §4)
```

---

## 3. ניתוב — `App.jsx`
כל העמודים תחת `Layout` (shell משותף). הספקים עוטפים: `QueryClientProvider` → `ThemeProvider` → `ClientConfigProvider` → `ErrorBoundary` → `Router`.

| נתיב | עמוד |
|------|------|
| `/dashboard` | NOCDashboard — לוח ה‑NOC הראשי |
| `/explorer` | ExplorerPage — חקירת התראות עם פילטרים וטבלה |
| `/research` | PanelResearchPage — מחקר לעומק לפי פאנל |
| `/incident` | IncidentManagementPage — טאבים: Mappings / Rules / Incident Defaults |
| `/incident-stats` | IncidentStatsPage — BI של כיסוי תקלות |
| `/how-to-use` | HowToUsePage — מדריך שימוש |
| `/settings` | SettingsPage — כיוונון ספים (localStorage) |

> שימו לב: עמוד ה‑History (`/history`) ואוסף ה‑incident‑logs **הוסרו** — אף אחד לא השתמש בהם. לבדיקת תקלה משתמשים ב‑simulate.

---

## 4. ה‑Shell — `components/layout/Layout.jsx`
- **Sidebar** אנכי עם אייקונים (ניווט) + toggle ערכת נושא.
- **Topbar** עם כותרת העמוד, פקדי תאריך (בעמודים שצריכים), ו‑slots ש‑עמודים מזריקים דרך `TopBarContext` (`setTopBarSlots`).
- `routesWithDateControls` קובע באילו עמודים מוצג בורר התאריכים.

---

## 5. State ו‑Context

### `ThemeContext`
מחזיק `theme` (light/dark, נשמר ב‑localStorage), חושף `colors`, `gradients`, `styles` מחושבים. `styles` נוצרים פעם אחת מ‑`createThemedStyles` (`themedStyles.jsx`) — card, input, button, badge וכו'.

### `ClientConfigContext` — **מקור האמת לספים בצד הלקוח**
- `config` — נטען מ‑`DEFAULT_CLIENT_CFG` + localStorage (ספים, רצועות, clustering).
- `dateRange` — טווח התאריכים הגלובלי (נשמר ב‑localStorage).
- `selectedPanel` — פאנל נבחר גלובלי.
- `getApiParams()` — ממיר את ה‑config לפרמטרי API (`day_start`, `false_wakeup_threshold`, `clustering_enabled`, `dur_short_max` וכו'). **זה מה שנשלח לכל בקשת BI**, ולכן הספים שהמשתמש קובע ב‑Settings הם שמנצחים. הערך ממומואיז (`useMemo`) כך שצרכנים לא נרנדרים מיותר.

### `TopBarContext`
מאפשר לעמוד להזריק פקדים ל‑topbar (`controls`, `actions`, `status`).

---

## 6. שליפת נתונים
- **React Query** (`@tanstack/react-query`) — הדרך המועדפת (משמש ב‑ExplorerPage). queryKey כולל את הפרמטרים, `placeholderData` לשמירת נתונים קודמים.
- **`useApiData`** — hook ידני ישן (עדיין בשימוש בחלק מהעמודים) שמזריק אוטומטית את `dateRange` + `getApiParams()`, עם abort על שינוי תלות.
- **`fetchApi` / `buildApiUrl`** (`utils/api.js`) — מסננים ערכים ריקים, מטפלים ב‑timeout/abort, וזורקים שגיאה עם הודעה ברורה. `API_BASE` מגיע מ‑`REACT_APP_API_BASE` (עם fallback ל‑localhost).

> כיוון עתידי: לאחד את כל העמודים על React Query ולהסיר את `useApiData`.

---

## 7. עיצוב
- **tokens/צבעים** — ב‑`ThemeContext` (light/dark). semantic colors (success/warning/error/info) שמורים לנתונים.
- **`themedStyles.jsx`** — מחולל אובייקטי style מה‑theme (card, button, input, badge, grid…).
- **`index.css`** — CSS גלובלי ל‑shell (`.ops-shell`, `.ops-sidebar`, `.ops-topbar`), פקדים בסיסיים, ו‑breakpoint ל‑900px (mobile: ה‑sidebar הופך אופקי).

---

## 8. העמודים

| עמוד | מה הוא מציג | endpoints עיקריים |
|------|-------------|-------------------|
| **NOCDashboard** | כרטיסי KPI (סה"כ התראות + מגמה, יחס אות/רעש, התראות לילה אמיתיות, אחוז שווא, משך ממוצע/חציון), גרפי משמרת/משך/heatmap/timeseries, רשימת מקורות מובילים | `/stats/executive-kpis`, `/stats/shift-analysis`, `/stats/duration-histogram`, `/stats/hourly-heatmap`, `/stats/timeseries`, `/stats/panels`, `/stats/by-panel` |
| **ExplorerPage** | טבלת התראות עם פילטרים (פאנל/אפליקציה/אופרטור/אובייקט/משך/משמרת/חיפוש), paging, ייצוא CSV. פילטרים מסונכרנים ל‑URL | `/alerts`, `/alerts/export.csv`, `/stats/filter-options` |
| **PanelResearchPage** | ניתוח לעומק לפי פאנל: כרטיסי סיכום, heatmap, מגמות, top noisy alerts/nodes/objects, ימים רצופים | `/stats/panel-analysis`, `/stats/panels`, `/stats/top-*`, `/stats/consecutive-days` |
| **IncidentStatsPage** | BI של כיסוי תקלות (clustered/unclustered): כיסוי לפי צוות/אפליקציה, מגמה יומית | `/stats/incident-stats` |
| **IncidentManagementPage** | מעטפת טאבים: **System Mappings**, **Smart Rules**, **Incident Defaults** | `/incidents/system-mappings`, `/incidents/incident-rules`, `/incidents/settings` + reference data |
| **SettingsPage** | כיוונון ספים (שעות משמרת, סף שווא, רצועות משך, clustering) — נשמר ב‑localStorage | — (מקומי) |
| **HowToUsePage** | מדריך שימוש | — |

---

## 9. רכיבים משותפים בולטים
- **`MetricCard`** — כרטיס KPI עם ערך, כותרת, tooltip, וחץ מגמה (מקבל `trend`; מוצג רק כשהבק מחזיר `*_trend_pct`).
- **`ChartCard`** — מעטפת אחידה לגרף עם כותרת/legend/loading/error.
- **`AlertTable`** — טבלת ההתראות (`@tanstack/react-table`), כולל הרחבת cluster לראות את ההתראות הגולמיות.
- **`SearchableSelect`** — select עם חיפוש (פאנלים/אפליקציות).
- **`DateRangePicker`** — בורר טווח עם presets.
- **`IncidentDefaultsTab`** — עורך התבניות + שדות ברירת המחדל; כולל שדה "Team key" (נשמר ב‑localStorage, נשלח כ‑`X-Settings-Key`).
- מצבי async: `LoadingSpinner` / `LoadingSkeleton` / `ErrorCallout` / `ErrorBoundary`.

---

## 10. hooks ו‑utils
- **`useDurationBands`** — מחזיר `Legend`, `getDurationColorFromBands`, `colorByDuration` לפי הרצועות שב‑config.
- **`useUrlState` / `useExplorerFilters`** — קורא/כותב פילטרים ל‑query string (שיתוף קישורים).
- **`dateUtils`** — `toYMD_IL`, `formatHourAndDay`, `formatDate`, `getPrevPeriodText`, `asArray`. הזמנים מהשרת כבר ב‑זמן ישראל; אין המרת TZ נוספת בצד הלקוח.
- **`formatters`** — `formatDuration` (שניות → "2m 30s"), `withAlpha`, `escapeCsv`.

---

## 11. חיבור לבק‑אנד
- `API_BASE` = `REACT_APP_API_BASE` (ברירת מחדל `http://localhost:8080/api`).
- כל בקשת BI נושאת את פרמטרי ה‑config (`getApiParams()`) + `dateRange` — ולכן הספים שנקבעים ב‑Settings משפיעים על כל ה‑KPIs.
- מעטפת התגובה האחידה: `{ success, data, meta }`. `fetchApi` מטפל בשגיאות ומחזיר את ה‑JSON.

---

## 12. מדריך הוספות (Frontend)

**להוסיף עמוד:** רכיב ב‑`pages/`, route ב‑`App.jsx`, פריט ניווט ב‑`Layout.jsx`.

**להוסיף כרטיס KPI/מדד:** לצרוך את ה‑endpoint דרך `useApiData`/React Query, להציג ב‑`MetricCard`/`ChartCard`, ולהשתמש ב‑`colors`/`styles` מ‑`useTheme` (בלי inline styles חדשים אם אפשר).

> כלל אצבע: להעתיק עמוד/רכיב קיים ולהתאים — אין שינויים דרסטיים צפויים בארכיטקטורה.
