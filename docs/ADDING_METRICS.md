# 📈 Extending the System: Adding Metrics

This guide details the standard procedure for adding new statistical metrics or charts to the application.

## The Data Pipeline

When adding a feature, you are essentially building a pipeline that moves data from the database to the user's screen. We follow a strict **3-Layer Pattern**. Do not skip layers; shortcuts lead to technical debt.

### Layer 1: The Query (Data Access)
**Context:** `backend/services/alert/AlertQueryService.js`

Your goal here is to fetch *raw* data efficiently. Use MSSQL's strengths (aggregations, grouping) rather than fetching millions of rows to process in Node.js.

**Design Pattern:**
1.  **Context Building**: Use `QueryContextBuilder` to automatically handle standard filters (Date Range, Shift times, etc.).
2.  **Safety**: Use `SqlBuilder` to construct your query. **Never** concatenate strings.

```javascript
/* AlertQueryService.js */
async fetchNewMetric(params) {
    const request = this.pool.request();
    
    // Auto-apply standard filters (dates, shifts)
    const context = QueryContextBuilder.fromParams(params, this.constants);
    context.applyToRequest(request);

    // Write your SQL
    const sql = `
        SELECT count(*) as total, avg(duration_sec) as average
        FROM incident_logs
        WHERE WHERE_CLAUSE
    `;

    // inject query parts safely
    const query = new SqlBuilder(sql)
        .replace('WHERE_CLAUSE', context.getWhereClause())
        .build();

    const result = await request.query(query);
    return result.recordset[0];
}
```

### Layer 2: The Service (Business Logic)
**Context:** `backend/services/alert/AlertService.js`

The service layer's job is to make the raw data *useful*. It should guard against `null` values, handle business rules, and format the output.

```javascript
/* AlertService.js */
async getNewMetric(params) {
    // 1. Fetch raw data
    const rawData = await this.queryService.fetchNewMetric(params);

    // 2. Format / Handle Defaults
    return {
        totalAlerts: rawData?.total || 0,
        avgDuration: Math.round(rawData?.average || 0),
        trend: this._calculateTrend(rawData?.total, previousData?.total) // Reuse internal helpers
    };
}
```

### Layer 3: The Controller (API Exposure)
**Context:** `backend/controllers/StatsController.js` and `backend/routes/statsRoutes.js`

This layer simply exposes your logic to the HTTP world. Keep it thin.

```javascript
/* StatsController.js */
async getNewMetric(req, res, next) {
    try {
        const result = await this.alertService.getNewMetric(req.query);
        res.json({ success: true, data: result });
    } catch (err) {
        next(err); // Always pass errors to the global handler
    }
}
```

---

## Pro Tips

*   **Validation**: Add input validation in the route definition using middleware (e.g., `checkSchema`) if your metric requires specific parameters.
*   **Caching**: If your query is expensive, utilize the `CacheService` in the controller to cache the response for a few minutes.
*   **Error Handling**: Let SQL errors propagate up. The global error handler in `server.js` will catch them and log them appropriately.
*   **Performance**: Use `SET ARITHABORT ON` in your SQL templates if you notice parameter sniffing issues (a common MSSQL quirk).
