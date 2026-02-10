# 💾 Data Access Layer

The application relies on **Microsoft SQL Server (MSSQL)** as its primary data store.
To maintain security, performance, and maintainability, all database interactions must adhere to the following standards.

## Security First: SQL Injection

SQL Injection is the #1 vulnerability in web applications. To mitigate this, we enforce a strict policy:

> **Strict Rule:** User input is **NEVER** concatenated directly into SQL strings.

### The Problem
```javascript
// ❌ VULNERABLE
const query = "SELECT * FROM users WHERE name = '" + req.query.name + "'";
// If name is "Oryan'; DROP TABLE users; --", you lose your data.
```

### The Solution: `SqlBuilder`
We have implemented a utility class `SqlBuilder` combined with `mssql` parameters to handle this safely.

```javascript
// ✅ SECURE
const request = pool.request();
request.input('userName', sql.NVarChar, req.query.name); // Parameterized
const query = new SqlBuilder("SELECT * FROM users WHERE name = @userName").build();
```

---

## Query Context & Filtering

Most statistics in this application require a standard set of filters:
*   Time Range (Start/End)
*   Shift Timing (Day/Night)
*   Duration Thresholds
*   Clustering Settings

Start every query method by building a **QueryContext**. This object encapsulates all the logic required to parse these parameters and generate the correct WHERE clauses.

```javascript
const context = QueryContextBuilder.fromParams(params, this.constants);
context.applyToRequest(request); // Binds inputs like @start_date, @day_start
const whereSql = context.getWhereClause(); // Generates "time_fired >= @start_date AND ..."
```

## Performance Best Practices

1.  **Cluster Your Queries**: When possible, use the **Clustering Engine** logic (handled in `AlertService`) to group noisy alerts before sending them to the frontend. This reduces network payload and client-side processing.
2.  **Indexing**: Ensure that columns used in `WHERE` and `ORDER BY` clauses (specifically `time_fired`, `node_name`, `application`) are indexed in MSSQL.
3.  **UTC Dates**: The database stores times in UTC. The `TimeUtils` class handles conversion to Israel Time (IDT) for display, but **logic** should always happen in UTC.
4.  **Limits**: Always apply a `TOP (@limit)` to queries that return lists. Never return unbounded result sets.
