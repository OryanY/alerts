// utils/SqlTemplates.js - Centralized SQL query templates
// All SQL statements in one place for security review and maintenance

/**
 * SQL Template Builder
 * Provides safe, reusable SQL query templates with placeholder replacement
 */
class SqlBuilder {
  constructor(template) {
    this.sql = template;
    this.placeholders = new Set(
      (template.match(/\{[A-Z_]+\}/g) || []).map(p => p.slice(1, -1))
    );
  }

  replace(placeholder, value) {
    if (!this.placeholders.has(placeholder)) {
      throw new Error(`Unknown placeholder: {${placeholder}}`);
    }

    this.sql = this.sql.replace(`{${placeholder}}`, value || '');
    this.placeholders.delete(placeholder);
    return this;
  }

  build() {
    // Validate all placeholders were replaced
    if (this.placeholders.size > 0) {
      throw new Error(`Unreplaced placeholders: ${[...this.placeholders].join(', ')}`);
    }

    let finalSql = this.sql.trim().replace(/\s+/g, ' ');

    // Remove any leftover curly braces (e.g., '{WHERE_CLAUSE}' or '{TOP_CLAUSE}' that might have been missed)
    finalSql = finalSql.replace(/{.*?}/g, '');  // This will strip any leftover placeholders

    return finalSql;
  }

}

/**
 * Centralized SQL Templates
 * All queries go through here for consistency and security
 */
class SqlTemplates {
  // ============ ALERT QUERIES ============

  static SELECT_ALERTS = `
    SELECT {TOP_CLAUSE}
      incident_id,
      panel_title,
      application,
      node_name,
      network,
      object,
      operator,
      time_fired,
      time_resolved,
      duration_sec,
      message,
      key_field,
      incident_number,
      history_id
    FROM dbo.historicalAlerts
    {WHERE_CLAUSE}
    {ORDER_CLAUSE}
    {PAGINATION_CLAUSE}
  `;

  static SELECT_BASIC_RECORDS = `
    SELECT TOP (@cap_param) {FIELDS}
    FROM dbo.historicalAlerts
    {WHERE_CLAUSE}
    ORDER BY time_fired DESC
  `;

  static COUNT_ALERTS = `
    SELECT COUNT(*) as total
    FROM dbo.historicalAlerts
    {WHERE_CLAUSE}
  `;

  // ============ STATISTICS QUERIES ============

  static HOURLY_HEATMAP = `
    WITH HourBuckets AS (
      SELECT 
        DATEPART(HOUR, time_fired) AS hour,
        COUNT(*) AS count,
        AVG(CAST(duration_sec AS FLOAT)) AS avg_duration
      FROM dbo.historicalAlerts
      {WHERE_CLAUSE}
      GROUP BY DATEPART(HOUR, time_fired)
    ),
    AllHours AS (
      SELECT TOP 24 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS hour
      FROM sys.objects
    )
    SELECT 
      ah.hour,
      ISNULL(hb.count, 0) AS count,
      ISNULL(hb.avg_duration, 0) AS avg_duration
    FROM AllHours ah
    LEFT JOIN HourBuckets hb ON ah.hour = hb.hour
    ORDER BY ah.hour
  `;

  static DURATION_HISTOGRAM = `
    SELECT 
      COUNT(CASE WHEN duration_sec <= @dur_short_max THEN 1 END) AS short_count,
      COUNT(CASE WHEN duration_sec > @dur_short_max AND duration_sec <= @dur_medium_max THEN 1 END) AS medium_count,
      COUNT(CASE WHEN duration_sec > @dur_medium_max THEN 1 END) AS long_count
    FROM dbo.historicalAlerts
    {WHERE_CLAUSE}
  `;

  static SHIFT_ANALYSIS = `
    SELECT 
      CASE 
        WHEN DATEPART(HOUR, time_fired) >= @day_start AND DATEPART(HOUR, time_fired) < @day_end 
        THEN 'Day'
        ELSE 'Night'
      END AS shift,
      COUNT(*) AS alert_count,
      AVG(CAST(duration_sec AS FLOAT)) AS avg_duration,
      MIN(duration_sec) AS min_duration,
      MAX(duration_sec) AS max_duration,
      COUNT(CASE WHEN duration_sec <= @false_wakeup_threshold THEN 1 END) AS false_wakeups,
      COUNT(CASE WHEN duration_sec > @false_wakeup_threshold THEN 1 END) AS true_alerts,
      COUNT(DISTINCT panel_title) AS unique_panels,
      COUNT(DISTINCT operator) AS unique_operators
    FROM dbo.historicalAlerts
    {WHERE_CLAUSE}
    GROUP BY 
      CASE 
        WHEN DATEPART(HOUR, time_fired) >= @day_start AND DATEPART(HOUR, time_fired) < @day_end 
        THEN 'Day'
        ELSE 'Night'
      END
  `;

  static OVERVIEW_STATS = `
    SELECT 
      COUNT(*) AS total_alerts,
      AVG(CAST(duration_sec AS FLOAT)) AS avg_duration,
      MIN(duration_sec) AS min_duration,
      MAX(duration_sec) AS max_duration,
      COUNT(CASE WHEN duration_sec <= @dur_short_max THEN 1 END) AS short_alerts,
      COUNT(CASE WHEN duration_sec > @dur_short_max AND duration_sec <= @dur_medium_max THEN 1 END) AS medium_alerts,
      COUNT(CASE WHEN duration_sec > @dur_medium_max THEN 1 END) AS long_alerts
    FROM dbo.historicalAlerts
    {WHERE_CLAUSE}
  `;

  // ============ PANEL QUERIES ============

  static PANEL_LIST = `
    SELECT 
      panel_title,
      COUNT(*) AS alert_count,
      COUNT(CASE WHEN duration_sec <= @false_wakeup_threshold THEN 1 END) AS false_positive_count,
      ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration,
      COUNT(DISTINCT application) AS application_count
    FROM dbo.historicalAlerts
    {WHERE_CLAUSE}
    GROUP BY panel_title
    ORDER BY alert_count DESC
  `;

  static PANEL_STATS = `
    SELECT {TOP_CLAUSE}
      panel_title,
      application,
      COUNT(*) AS alert_count,
      ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration,
      MIN(duration_sec) AS min_duration,
      MAX(duration_sec) AS max_duration,
      COUNT(CASE WHEN duration_sec <= @dur_short_max THEN 1 END) AS short_alerts,
      COUNT(CASE WHEN duration_sec > @dur_short_max AND duration_sec <= @dur_medium_max THEN 1 END) AS medium_alerts,
      COUNT(CASE WHEN duration_sec > @dur_medium_max THEN 1 END) AS long_alerts
    FROM dbo.historicalAlerts
    {WHERE_CLAUSE}
    GROUP BY panel_title, application
    ORDER BY alert_count DESC
  `;

  static TOP_NOISY_NODES = `
    WITH TotalAlerts AS (
      SELECT COUNT(*) AS total_count
      FROM dbo.historicalAlerts
      {WHERE_CLAUSE}
    )
    SELECT TOP (@limit_param)
      node_name,
      object,
      COUNT(*) AS alert_count,
      ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration_sec,
      CAST((COUNT(*) * 100.0) / NULLIF((SELECT total_count FROM TotalAlerts), 0) AS DECIMAL(5, 2)) AS alert_percent
    FROM dbo.historicalAlerts
    {WHERE_CLAUSE}
    GROUP BY node_name, object
    HAVING node_name IS NOT NULL AND object IS NOT NULL
    ORDER BY alert_count DESC
  `;

  static ALERT_MESSAGE_BREAKDOWN = `
    SELECT 
      message,
      COUNT(*) AS occurrence_count,
      ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration,
      MIN(duration_sec) AS min_duration,
      MAX(duration_sec) AS max_duration,
      COUNT(CASE WHEN duration_sec <= @false_wakeup_threshold THEN 1 END) AS false_positive_count
    FROM dbo.historicalAlerts
    {WHERE_CLAUSE}
    GROUP BY message
    ORDER BY occurrence_count DESC
  `;

  static TOP_APPLICATIONS = `
    SELECT TOP (@limit_param)
      application,
      COUNT(*) AS alert_count,
      COUNT(DISTINCT node_name) AS node_count,
      ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration
    FROM dbo.historicalAlerts
    {WHERE_CLAUSE}
    GROUP BY application
    ORDER BY alert_count DESC
  `;

  static TOP_NODES_BY_APP = `
    SELECT TOP (@limit_param)
      node_name,
      CASE 
        WHEN COUNT(DISTINCT object) > 1 THEN 'Multiple (' + CAST(COUNT(DISTINCT object) AS VARCHAR) + ')' 
        ELSE MAX(object) 
      END AS object,
      COUNT(*) AS alert_count,
      MAX(time_fired) AS last_alert,
      ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration
    FROM dbo.historicalAlerts
    {WHERE_CLAUSE}
    GROUP BY node_name
    ORDER BY alert_count DESC
  `;

  static CONSECUTIVE_DAYS_NODES = `
    WITH DailyAlerts AS (
      SELECT
        node_name,
        CAST(time_fired AS DATE) AS alert_date,
        COUNT(*) as daily_count
      FROM dbo.historicalAlerts
      {WHERE_CLAUSE}
      GROUP BY node_name, CAST(time_fired AS DATE)
    ),
    ConsecutiveGroups AS (
      SELECT
        node_name,
        alert_date,
        daily_count,
        DATEADD(day, -DENSE_RANK() OVER (PARTITION BY node_name ORDER BY alert_date), alert_date) AS grp
      FROM DailyAlerts
    ),
    Grouped AS (
      SELECT
        node_name,
        grp,
        COUNT(*) AS consecutive_days,
        SUM(daily_count) as total_alerts,
        MIN(alert_date) AS first_alert_date,
        MAX(alert_date) AS last_alert_date
      FROM ConsecutiveGroups
      GROUP BY node_name, grp
    )
    SELECT TOP (@limit_param)
      node_name,
      consecutive_days,
      total_alerts,
      first_alert_date,
      last_alert_date
    FROM Grouped
    WHERE consecutive_days >= 3
    ORDER BY consecutive_days DESC
  `;

  // ============ HELPER METHODS ============

  /**
   * Build TOP clause for SQL Server
   */
  static buildTopClause(limit) {
    return limit ? `TOP (@limit_param)` : '';
  }

  /**
   * Build ORDER BY clause
   */
  static buildOrderClause(sortBy, sortOrder, validColumns = []) {
    if (!sortBy) return '';

    // Validate column name to prevent SQL injection
    if (validColumns.length > 0 && !validColumns.includes(sortBy)) {
      throw new Error(`Invalid sort column: ${sortBy}`);
    }

    const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';
    return `ORDER BY ${sortBy} ${order}`;
  }

  /**
   * Build OFFSET/FETCH pagination for SQL Server 2012+
   */
  static buildPaginationClause(page, limit) {
    if (!page || !limit) return '';

    const offset = (page - 1) * limit;
    return `OFFSET ${offset} ROWS FETCH NEXT ${limit + 1} ROWS ONLY`;
  }

  /**
   * Validate field name against whitelist
   */
  static validateFieldName(fieldName, allowedFields) {
    if (!allowedFields.includes(fieldName)) {
      throw new Error(`Invalid field name: ${fieldName}`);
    }
    return fieldName;
  }
}

module.exports = { SqlTemplates, SqlBuilder };