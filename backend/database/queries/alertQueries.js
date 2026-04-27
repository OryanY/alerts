// database/queries/alertQueries.js
module.exports = {
  SELECT_ALERTS: `
    SELECT {TOP_CLAUSE}
      incident_id, panel_title, application, node_name, network, object, operator,
      CONVERT(varchar(23), time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time', 126) AS time_fired,
      CONVERT(varchar(23), time_resolved AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time', 126) AS time_resolved,
      duration_sec, message, key_field, incident_number, incident_sys_id, history_id
    FROM dbo.historicalAlerts {WHERE_CLAUSE} {ORDER_CLAUSE} {PAGINATION_CLAUSE}
  `,
  CLUSTERED_ALERTS: `
    WITH Filtered AS (
        SELECT {TOP_CLAUSE} incident_id, panel_title, application, node_name, network, object, operator, time_fired, time_resolved, duration_sec, message, key_field, incident_number, incident_sys_id, history_id
        FROM dbo.historicalAlerts {WHERE_CLAUSE} {RAW_ORDER_CLAUSE} {PAGINATION_CLAUSE}
    ),
    Marked AS (
        SELECT *,
        CASE WHEN ABS(DATEDIFF(MINUTE, LAG(time_fired) OVER (PARTITION BY panel_title, application ORDER BY time_fired), time_fired)) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster
        FROM Filtered
    ),
    Grouped AS (
        SELECT *, SUM(is_new_cluster) OVER (PARTITION BY panel_title, application ORDER BY time_fired) AS cluster_id FROM Marked
    ),
    Clusters AS (
        SELECT 
            cluster_id, panel_title, application, MIN(time_fired) AS time_fired, MAX(time_resolved) AS time_resolved,
            DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS duration_sec, 
            COUNT(*) AS cluster_count,
            MAX(node_name) AS node_name,
            MAX(network) AS network, MAX(object) AS object, MAX(operator) AS operator,
            MAX(message) AS message, MIN(incident_id) AS incident_id, MIN(incident_number) AS incident_number,
            MIN(incident_sys_id) AS incident_sys_id,
            MIN(history_id) AS history_id, MAX(key_field) AS key_field
        FROM Grouped GROUP BY cluster_id, panel_title, application
    )
    SELECT 
        c.incident_id, c.panel_title, c.application, c.node_name, c.network, c.object, c.operator, 
        CONVERT(varchar(23), c.time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time', 126) AS time_fired,
        CONVERT(varchar(23), c.time_resolved AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time', 126) AS time_resolved,
        c.duration_sec, c.message, c.key_field, c.incident_number, 
        c.incident_sys_id, c.history_id, c.cluster_count,
        (
            SELECT
                CONVERT(varchar(23), g.time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time', 126) AS time_fired,
                g.duration_sec, g.message, g.object, g.node_name
            FROM Grouped g 
            WHERE g.cluster_id = c.cluster_id 
              AND g.panel_title = c.panel_title
              AND g.application = c.application
            ORDER BY g.time_fired ASC FOR JSON PATH
        ) AS raw_alerts_json
    FROM Clusters c
    {ORDER_CLAUSE}
  `,
  SELECT_BASIC_RECORDS: `SELECT TOP (@limit_param) {FIELDS} FROM dbo.historicalAlerts {WHERE_CLAUSE} ORDER BY time_fired DESC`,
  HOURLY_HEATMAP: `
    WITH FilteredAlerts AS (
      SELECT duration_sec, DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS hour FROM dbo.historicalAlerts {WHERE_CLAUSE}
    ),
    HourBuckets AS (
      SELECT DISTINCT hour,
             COUNT(*) OVER (PARTITION BY hour) AS count, 
             AVG(CAST(duration_sec AS FLOAT)) OVER (PARTITION BY hour) AS avg_duration,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_sec) OVER (PARTITION BY hour) AS median_duration
      FROM FilteredAlerts
    ),
    AllHours AS (SELECT TOP 24 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS hour FROM sys.objects)
    SELECT ah.hour, ISNULL(hb.count, 0) AS count, ISNULL(hb.avg_duration, 0) AS avg_duration, ISNULL(hb.median_duration, 0) AS median_duration
    FROM AllHours ah LEFT JOIN HourBuckets hb ON ah.hour = hb.hour ORDER BY ah.hour
  `,
  DURATION_HISTOGRAM: `
    SELECT 
      COUNT(CASE WHEN duration_sec <= @dur_short_max THEN 1 END) AS short_count,
      COUNT(CASE WHEN duration_sec > @dur_short_max AND duration_sec <= @dur_medium_max THEN 1 END) AS medium_count,
      COUNT(CASE WHEN duration_sec > @dur_medium_max THEN 1 END) AS long_count
    FROM dbo.historicalAlerts {WHERE_CLAUSE}
  `,
  SHIFT_ANALYSIS: `
    SELECT 
      CASE WHEN DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_start AND DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_end THEN 'Day' ELSE 'Night' END AS shift,
      COUNT(*) AS alert_count, AVG(CAST(duration_sec AS FLOAT)) AS avg_duration, MIN(duration_sec) AS min_duration, MAX(duration_sec) AS max_duration,
      COUNT(CASE WHEN duration_sec <= @false_wakeup_threshold THEN 1 END) AS false_wakeups, COUNT(CASE WHEN duration_sec > @false_wakeup_threshold THEN 1 END) AS true_alerts,
      COUNT(DISTINCT panel_title) AS unique_panels, COUNT(DISTINCT operator) AS unique_operators
    FROM dbo.historicalAlerts {WHERE_CLAUSE}
    GROUP BY CASE WHEN DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_start AND DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_end THEN 'Day' ELSE 'Night' END
  `,
  PANEL_LIST: `
    SELECT panel_title, COUNT(*) AS alert_count, COUNT(CASE WHEN duration_sec <= @false_wakeup_threshold THEN 1 END) AS false_positive_count, ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration, COUNT(DISTINCT application) AS application_count
    FROM dbo.historicalAlerts {WHERE_CLAUSE} GROUP BY panel_title ORDER BY alert_count DESC
  `,
  CLUSTERED_PANEL_LIST: `
    WITH Marked AS (
        SELECT time_fired, duration_sec, panel_title, application, 
        CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (PARTITION BY panel_title, application ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster 
        FROM dbo.historicalAlerts {WHERE_CLAUSE}
    ),
    Grouped AS (
        SELECT time_fired, duration_sec, panel_title, application, SUM(is_new_cluster) OVER (PARTITION BY panel_title, application ORDER BY time_fired) AS cluster_id 
        FROM Marked
    ),
    Clusters AS (
        SELECT 
            panel_title,
            application,
            DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration 
        FROM Grouped GROUP BY cluster_id, panel_title, application
    )
    SELECT 
        panel_title, 
        COUNT(*) AS alert_count, 
        COUNT(CASE WHEN cluster_duration <= @false_wakeup_threshold THEN 1 END) AS false_positive_count, 
        ROUND(AVG(CAST(cluster_duration AS FLOAT)), 2) AS avg_duration, 
        COUNT(DISTINCT application) AS application_count
    FROM Clusters 
    GROUP BY panel_title 
    ORDER BY alert_count DESC
  `,
  PANEL_STATS: `
    WITH PanelStats AS (
      SELECT panel_title, application, duration_sec,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_sec) OVER (PARTITION BY panel_title, application) AS median_duration
      FROM dbo.historicalAlerts {WHERE_CLAUSE}
    )
    SELECT {TOP_CLAUSE} panel_title, application, COUNT(*) AS alert_count, ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration,
      MAX(median_duration) AS median_duration,
      MIN(duration_sec) AS min_duration, MAX(duration_sec) AS max_duration,
      COUNT(CASE WHEN duration_sec <= @dur_short_max THEN 1 END) AS short_alerts, COUNT(CASE WHEN duration_sec > @dur_short_max AND duration_sec <= @dur_medium_max THEN 1 END) AS medium_alerts, COUNT(CASE WHEN duration_sec > @dur_medium_max THEN 1 END) AS long_alerts
    FROM PanelStats GROUP BY panel_title, application ORDER BY alert_count DESC
  `,
  CLUSTERED_PANEL_STATS: `
    WITH Marked AS (
        SELECT time_fired, duration_sec, panel_title, application, 
        CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (PARTITION BY panel_title, application ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster 
        FROM dbo.historicalAlerts {WHERE_CLAUSE}
    ),
    Grouped AS (
        SELECT time_fired, duration_sec, panel_title, application, SUM(is_new_cluster) OVER (PARTITION BY panel_title, application ORDER BY time_fired) AS cluster_id 
        FROM Marked
    ),
    Clusters AS (
        SELECT 
            panel_title, application,
            DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration
        FROM Grouped GROUP BY cluster_id, panel_title, application
    ),
    PanelStats AS (
      SELECT panel_title, application, cluster_duration,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cluster_duration) OVER (PARTITION BY panel_title, application) AS median_duration
      FROM Clusters
    )
    SELECT {TOP_CLAUSE} panel_title, application, COUNT(*) AS alert_count, ROUND(AVG(CAST(cluster_duration AS FLOAT)), 2) AS avg_duration,
      MAX(median_duration) AS median_duration,
      MIN(cluster_duration) AS min_duration, MAX(cluster_duration) AS max_duration,
      COUNT(CASE WHEN cluster_duration <= @dur_short_max THEN 1 END) AS short_alerts, COUNT(CASE WHEN cluster_duration > @dur_short_max AND cluster_duration <= @dur_medium_max THEN 1 END) AS medium_alerts, COUNT(CASE WHEN cluster_duration > @dur_medium_max THEN 1 END) AS long_alerts
    FROM PanelStats GROUP BY panel_title, application ORDER BY alert_count DESC
  `,
  TOP_APPLICATIONS: `
    SELECT TOP (@limit_param) application, COUNT(*) AS alert_count, COUNT(DISTINCT node_name) AS node_count, ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration
    FROM dbo.historicalAlerts {WHERE_CLAUSE} GROUP BY application ORDER BY alert_count DESC
  `,
  CLUSTERED_TOP_APPLICATIONS: `
    WITH Marked AS (SELECT time_fired, duration_sec, application, node_name, panel_title,
      CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (PARTITION BY panel_title, application ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster
      FROM dbo.historicalAlerts {WHERE_CLAUSE}),
    Grouped AS (SELECT *, SUM(is_new_cluster) OVER (PARTITION BY panel_title, application ORDER BY time_fired) AS cluster_id FROM Marked),
    Clusters AS (SELECT application, COUNT(DISTINCT node_name) AS node_count,
      DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration
      FROM Grouped GROUP BY cluster_id, application, panel_title)
    SELECT TOP (@limit_param) application, COUNT(*) AS alert_count, MAX(node_count) AS node_count, ROUND(AVG(CAST(cluster_duration AS FLOAT)), 2) AS avg_duration
    FROM Clusters GROUP BY application ORDER BY alert_count DESC
  `,
  TOP_NODES_BY_APP: `
    SELECT TOP (@limit_param) node_name, CASE WHEN COUNT(DISTINCT object) > 1 THEN 'Multiple (' + CAST(COUNT(DISTINCT object) AS VARCHAR) + ')' ELSE MAX(object) END AS object,
      COUNT(*) AS alert_count,
      MAX(time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS last_alert,
      ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration
    FROM dbo.historicalAlerts {WHERE_CLAUSE} GROUP BY node_name ORDER BY alert_count DESC
  `,
  CLUSTERED_TOP_NODES_BY_APP: `
    WITH Marked AS (SELECT time_fired, duration_sec, node_name, object, panel_title, application,
      CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (PARTITION BY panel_title, application ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster
      FROM dbo.historicalAlerts {WHERE_CLAUSE}),
    Grouped AS (SELECT *, SUM(is_new_cluster) OVER (PARTITION BY panel_title, application ORDER BY time_fired) AS cluster_id FROM Marked),
    Clusters AS (SELECT MIN(time_fired) AS cluster_start, DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration,
      MAX(node_name) AS node_name, MAX(object) AS object
      FROM Grouped GROUP BY cluster_id, panel_title, application)
    SELECT TOP (@limit_param) node_name,
      CASE WHEN COUNT(DISTINCT object) > 1 THEN 'Multiple (' + CAST(COUNT(DISTINCT object) AS VARCHAR) + ')' ELSE MAX(object) END AS object,
      COUNT(*) AS alert_count,
      MAX(cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS last_alert,
      ROUND(AVG(CAST(cluster_duration AS FLOAT)), 2) AS avg_duration
    FROM Clusters GROUP BY node_name ORDER BY alert_count DESC
  `,
  TOP_OBJECTS_BY_APP: `
    SELECT TOP (@limit_param) ISNULL(object, 'Unknown') AS object, 
      COUNT(*) AS alert_count,
      COUNT(DISTINCT node_name) AS node_count,
      MAX(time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS last_alert,
      ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration
    FROM dbo.historicalAlerts {WHERE_CLAUSE} GROUP BY ISNULL(object, 'Unknown') ORDER BY alert_count DESC
  `,
  CLUSTERED_TOP_OBJECTS_BY_APP: `
    WITH Marked AS (SELECT time_fired, duration_sec, node_name, object, panel_title, application,
      CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (PARTITION BY panel_title, application ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster
      FROM dbo.historicalAlerts {WHERE_CLAUSE}),
    Grouped AS (SELECT *, SUM(is_new_cluster) OVER (PARTITION BY panel_title, application ORDER BY time_fired) AS cluster_id FROM Marked),
    Clusters AS (SELECT MIN(time_fired) AS cluster_start, DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration,
      MAX(node_name) AS node_name, ISNULL(MAX(object), 'Unknown') AS object
      FROM Grouped GROUP BY cluster_id, panel_title, application)
    SELECT TOP (@limit_param) object, COUNT(*) AS alert_count,
      COUNT(DISTINCT node_name) AS node_count,
      MAX(cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS last_alert,
      ROUND(AVG(CAST(cluster_duration AS FLOAT)), 2) AS avg_duration
    FROM Clusters GROUP BY object ORDER BY alert_count DESC
  `,
  CONSECUTIVE_DAYS_NODES: `
    WITH DailyAlerts AS (
      SELECT node_name,
             CAST(time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time' AS DATE) AS alert_date,
             COUNT(*) as daily_count
      FROM dbo.historicalAlerts {WHERE_CLAUSE}
      GROUP BY node_name, CAST(time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time' AS DATE)
    ),
    ConsecutiveGroups AS (SELECT node_name, alert_date, daily_count, DATEADD(day, -DENSE_RANK() OVER (PARTITION BY node_name ORDER BY alert_date), alert_date) AS grp FROM DailyAlerts),
    Grouped AS (SELECT node_name, grp, COUNT(*) AS consecutive_days, SUM(daily_count) as total_alerts, MIN(alert_date) AS first_alert_date, MAX(alert_date) AS last_alert_date FROM ConsecutiveGroups GROUP BY node_name, grp)
    SELECT TOP (@limit_param) node_name, consecutive_days, total_alerts, first_alert_date, last_alert_date FROM Grouped WHERE consecutive_days >= 3 ORDER BY consecutive_days DESC
  `,
  CLUSTERED_CONSECUTIVE_DAYS_NODES: `
    WITH Marked AS (SELECT time_fired, duration_sec, node_name, panel_title, application,
      CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (PARTITION BY panel_title, application ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster
      FROM dbo.historicalAlerts {WHERE_CLAUSE}),
    Grouped AS (SELECT *, SUM(is_new_cluster) OVER (PARTITION BY panel_title, application ORDER BY time_fired) AS cluster_id FROM Marked),
    Clusters AS (SELECT MIN(time_fired) AS cluster_start, MAX(node_name) AS node_name FROM Grouped GROUP BY cluster_id, panel_title, application),
    DailyAlerts AS (
      SELECT node_name,
             CAST(cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time' AS DATE) AS alert_date,
             COUNT(*) as daily_count
      FROM Clusters
      GROUP BY node_name, CAST(cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time' AS DATE)
    ),
    ConsecutiveGroups AS (SELECT node_name, alert_date, daily_count, DATEADD(day, -DENSE_RANK() OVER (PARTITION BY node_name ORDER BY alert_date), alert_date) AS grp FROM DailyAlerts),
    GroupedCon AS (SELECT node_name, grp, COUNT(*) AS consecutive_days, SUM(daily_count) as total_alerts, MIN(alert_date) AS first_alert_date, MAX(alert_date) AS last_alert_date FROM ConsecutiveGroups GROUP BY node_name, grp)
    SELECT TOP (@limit_param) node_name, consecutive_days, total_alerts, first_alert_date, last_alert_date FROM GroupedCon WHERE consecutive_days >= 3 ORDER BY consecutive_days DESC
  `,
  UNCLUSTERED_KPI_STATS: `
    WITH FilteredAlerts AS (SELECT time_fired, ISNULL(duration_sec, 0) AS duration_sec FROM dbo.historicalAlerts {WHERE_CLAUSE}),
    MedianCTE AS (SELECT DISTINCT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_sec) OVER () AS median_val FROM FilteredAlerts)
    SELECT COUNT(*) AS total_alerts, AVG(CAST(duration_sec AS FLOAT)) AS avg_duration, ISNULL((SELECT TOP 1 median_val FROM MedianCTE), 0) AS median_duration, MIN(duration_sec) AS min_duration, MAX(duration_sec) AS max_duration,
      COUNT(CASE WHEN duration_sec <= @false_wakeup_threshold THEN 1 END) AS false_wakeups, COUNT(CASE WHEN duration_sec > @false_wakeup_threshold THEN 1 END) AS true_alerts,
      COUNT(CASE WHEN DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_start OR DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_end THEN 1 END) AS night_alerts,
      COUNT(CASE WHEN (DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_start OR DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_end) AND duration_sec > @false_wakeup_threshold THEN 1 END) AS night_true_wakeups,
      COUNT(CASE WHEN (DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_start OR DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_end) AND duration_sec <= @false_wakeup_threshold THEN 1 END) AS night_false_wakeups
    FROM FilteredAlerts
  `,
  TIMESERIES: `
    SELECT CAST((time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE) AS date_il, COUNT(*) AS alert_count, AVG(CAST(duration_sec AS FLOAT)) AS avg_duration,
      COUNT(CASE WHEN DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_start AND DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_end THEN 1 END) AS day_count,
      COUNT(CASE WHEN DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_start OR DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_end THEN 1 END) AS night_count
    FROM dbo.historicalAlerts {WHERE_CLAUSE} GROUP BY CAST((time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE) ORDER BY date_il
  `,
  CLUSTERED_KPI_STATS: `
    WITH Marked AS (SELECT time_fired, duration_sec, panel_title, application, CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (PARTITION BY panel_title, application ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster FROM dbo.historicalAlerts {WHERE_CLAUSE}),
    Grouped AS (SELECT time_fired, duration_sec, panel_title, application, SUM(is_new_cluster) OVER (PARTITION BY panel_title, application ORDER BY time_fired) AS cluster_id FROM Marked),
    Clusters AS (SELECT cluster_id, panel_title, application, MIN(time_fired) AS cluster_start, DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration FROM Grouped GROUP BY cluster_id, panel_title, application),
    FilteredClusters AS (SELECT * FROM Clusters {CLUSTER_FILTER}),
    MedianCTE AS (SELECT DISTINCT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cluster_duration) OVER () AS median_val FROM FilteredClusters)
    SELECT COUNT(*) AS total_alerts, AVG(CAST(cluster_duration AS FLOAT)) AS avg_duration, ISNULL((SELECT TOP 1 median_val FROM MedianCTE), 0) AS median_duration, MIN(cluster_duration) AS min_duration, MAX(cluster_duration) AS max_duration,
      COUNT(CASE WHEN cluster_duration <= @false_wakeup_threshold THEN 1 END) AS false_wakeups, COUNT(CASE WHEN cluster_duration > @false_wakeup_threshold THEN 1 END) AS true_alerts,
      COUNT(CASE WHEN DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_start OR DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_end THEN 1 END) AS night_alerts,
      COUNT(CASE WHEN (DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_start OR DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_end) AND cluster_duration > @false_wakeup_threshold THEN 1 END) AS night_true_wakeups,
      COUNT(CASE WHEN (DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_start OR DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_end) AND cluster_duration <= @false_wakeup_threshold THEN 1 END) AS night_false_wakeups
    FROM FilteredClusters
  `,
  CLUSTERED_HOURLY_HEATMAP: `
    WITH Marked AS (SELECT time_fired, duration_sec, panel_title, application, CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (PARTITION BY panel_title, application ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster FROM dbo.historicalAlerts {WHERE_CLAUSE}),
    Grouped AS (SELECT time_fired, duration_sec, panel_title, application, SUM(is_new_cluster) OVER (PARTITION BY panel_title, application ORDER BY time_fired) AS cluster_id FROM Marked),
    Clusters AS (SELECT MIN(time_fired) AS cluster_start, DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration FROM Grouped GROUP BY cluster_id, panel_title, application),
    FilteredAlerts AS (SELECT cluster_duration, DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS hour FROM Clusters),
    HourBuckets AS (
        SELECT DISTINCT hour,
            COUNT(*) OVER (PARTITION BY hour) AS count,
            AVG(CAST(cluster_duration AS FLOAT)) OVER (PARTITION BY hour) AS avg_duration,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cluster_duration) OVER (PARTITION BY hour) AS median_duration
        FROM FilteredAlerts
    ),
    AllHours AS (SELECT TOP 24 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS hour FROM sys.objects)
    SELECT ah.hour, ISNULL(hb.count, 0) AS count, ISNULL(hb.avg_duration, 0) AS avg_duration, ISNULL(hb.median_duration, 0) AS median_duration
    FROM AllHours ah LEFT JOIN HourBuckets hb ON ah.hour = hb.hour ORDER BY ah.hour
  `,
  CLUSTERED_DURATION_HISTOGRAM: `
    WITH Marked AS (SELECT time_fired, duration_sec, panel_title, application, CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (PARTITION BY panel_title, application ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster FROM dbo.historicalAlerts {WHERE_CLAUSE}),
    Grouped AS (SELECT time_fired, duration_sec, panel_title, application, SUM(is_new_cluster) OVER (PARTITION BY panel_title, application ORDER BY time_fired) AS cluster_id FROM Marked),
    Clusters AS (SELECT DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration FROM Grouped GROUP BY cluster_id, panel_title, application)
    SELECT COUNT(CASE WHEN cluster_duration <= @dur_short_max THEN 1 END) AS short_count, COUNT(CASE WHEN cluster_duration > @dur_short_max AND cluster_duration <= @dur_medium_max THEN 1 END) AS medium_count, COUNT(CASE WHEN cluster_duration > @dur_medium_max THEN 1 END) AS long_count FROM Clusters
  `,
  CLUSTERED_SHIFT_ANALYSIS: `
    WITH Marked AS (SELECT time_fired, duration_sec, panel_title, application, operator, CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (PARTITION BY panel_title, application ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster FROM dbo.historicalAlerts {WHERE_CLAUSE}),
    Grouped AS (SELECT time_fired, duration_sec, panel_title, application, operator, SUM(is_new_cluster) OVER (PARTITION BY panel_title, application ORDER BY time_fired) AS cluster_id FROM Marked),
    Clusters AS (SELECT MIN(time_fired) AS cluster_start, DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration, panel_title, MAX(operator) AS operator FROM Grouped GROUP BY cluster_id, panel_title, application)
    SELECT CASE WHEN DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_start AND DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_end THEN 'Day' ELSE 'Night' END AS shift,
      COUNT(*) AS alert_count, AVG(CAST(cluster_duration AS FLOAT)) AS avg_duration, MIN(cluster_duration) AS min_duration, MAX(cluster_duration) AS max_duration,
      COUNT(CASE WHEN cluster_duration <= @false_wakeup_threshold THEN 1 END) AS false_wakeups, COUNT(CASE WHEN cluster_duration > @false_wakeup_threshold THEN 1 END) AS true_alerts
    FROM Clusters GROUP BY CASE WHEN DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_start AND DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_end THEN 'Day' ELSE 'Night' END
  `,
  CLUSTERED_TIMESERIES: `
    WITH Marked AS (SELECT time_fired, duration_sec, panel_title, application, CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (PARTITION BY panel_title, application ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster FROM dbo.historicalAlerts {WHERE_CLAUSE}),
    Grouped AS (SELECT time_fired, duration_sec, panel_title, application, SUM(is_new_cluster) OVER (PARTITION BY panel_title, application ORDER BY time_fired) AS cluster_id FROM Marked),
    Clusters AS (SELECT MIN(time_fired) AS cluster_start, DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration FROM Grouped GROUP BY cluster_id, panel_title, application)
    SELECT CAST((cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE) AS date_il, COUNT(*) AS alert_count, AVG(CAST(cluster_duration AS FLOAT)) AS avg_duration,
      COUNT(CASE WHEN DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_start AND DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_end THEN 1 END) AS day_count,
      COUNT(CASE WHEN DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_start OR DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_end THEN 1 END) AS night_count
    FROM Clusters GROUP BY CAST((cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE) ORDER BY date_il
  `,
  UNCLUSTERED_TOP_NOISY_ALERTS: `
    WITH MessageStats AS (
      SELECT message, duration_sec,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_sec) OVER (PARTITION BY message) AS median_duration,
             CASE WHEN duration_sec <= @false_wakeup_threshold THEN 1 ELSE 0 END as is_false_wakeup
      FROM dbo.historicalAlerts {WHERE_CLAUSE}
    )
    SELECT TOP 10 message, COUNT(*) as count, ISNULL(AVG(CAST(duration_sec AS FLOAT)), 0) as avg_duration,
        MAX(median_duration) as median_duration,
        CAST(SUM(is_false_wakeup) * 100.0 / NULLIF(COUNT(*), 0) AS DECIMAL(5,2)) as false_positive_rate
    FROM MessageStats GROUP BY message ORDER BY count DESC
  `,
  CLUSTERED_TOP_NOISY_ALERTS: `
    WITH Marked AS (
        SELECT 
            time_fired,
            duration_sec,
            message,
            panel_title, application,
            CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (PARTITION BY panel_title, application ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster
        FROM dbo.historicalAlerts {WHERE_CLAUSE}
    ),
    Grouped AS (
        SELECT time_fired, duration_sec, message, panel_title, application, SUM(is_new_cluster) OVER (PARTITION BY panel_title, application ORDER BY time_fired) AS cluster_id FROM Marked
    ),
    Clusters AS (
        SELECT 
            MAX(message) as message,
            DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration 
        FROM Grouped GROUP BY cluster_id, panel_title, application
    )
    SELECT TOP 10
        message,
        COUNT(*) as count,
        ISNULL(AVG(CAST(cluster_duration AS FLOAT)), 0) as avg_duration,
        CAST(
            SUM(CASE WHEN cluster_duration <= @false_wakeup_threshold THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0)
        AS DECIMAL(5,2)) as false_positive_rate
    FROM Clusters
    GROUP BY message
    ORDER BY count DESC
  `,
  CLUSTERED_PANEL_ANALYSIS_BATCH: `
    IF OBJECT_ID('tempdb..#TempClusters') IS NOT NULL DROP TABLE #TempClusters;

    WITH Marked AS (
        SELECT time_fired, duration_sec, panel_title, application, operator, message,
        CASE WHEN ABS(DATEDIFF(MINUTE, LAG(time_fired) OVER (PARTITION BY panel_title, application ORDER BY time_fired), time_fired)) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster 
        FROM dbo.historicalAlerts {WHERE_CLAUSE}
    ),
    Grouped AS (
        SELECT *, SUM(is_new_cluster) OVER (PARTITION BY panel_title, application ORDER BY time_fired) AS cluster_id FROM Marked
    ),
    Clusters AS (
        SELECT 
            MIN(time_fired) AS cluster_start, 
            DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration,
            MAX(message) AS message
        FROM Grouped GROUP BY cluster_id, panel_title, application
    )
    SELECT * INTO #TempClusters FROM Clusters;

    -- 1. KPIs
    WITH MedianCTE AS (SELECT DISTINCT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cluster_duration) OVER () AS median_val FROM #TempClusters)
    SELECT COUNT(*) AS total_alerts, AVG(CAST(cluster_duration AS FLOAT)) AS avg_duration, ISNULL((SELECT TOP 1 median_val FROM MedianCTE), 0) AS median_duration, MIN(cluster_duration) AS min_duration, MAX(cluster_duration) AS max_duration,
      COUNT(CASE WHEN cluster_duration <= @false_wakeup_threshold THEN 1 END) AS false_wakeups, COUNT(CASE WHEN cluster_duration > @false_wakeup_threshold THEN 1 END) AS true_alerts,
      COUNT(CASE WHEN DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_start OR DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_end THEN 1 END) AS night_alerts,
      COUNT(CASE WHEN (DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_start OR DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_end) AND cluster_duration > @false_wakeup_threshold THEN 1 END) AS night_true_wakeups,
      COUNT(CASE WHEN (DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_start OR DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_end) AND cluster_duration <= @false_wakeup_threshold THEN 1 END) AS night_false_wakeups
    FROM #TempClusters;

    -- 2. Timeseries
    SELECT CAST((cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE) AS date_il, COUNT(*) AS alert_count, AVG(CAST(cluster_duration AS FLOAT)) AS avg_duration,
      COUNT(CASE WHEN DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_start AND DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_end THEN 1 END) AS day_count,
      COUNT(CASE WHEN DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_start OR DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_end THEN 1 END) AS night_count
    FROM #TempClusters GROUP BY CAST((cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE) ORDER BY date_il;

    -- 3. Heatmap
    WITH HourBuckets AS (SELECT DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS hour, cluster_duration FROM #TempClusters),
    AllHours AS (SELECT TOP 24 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS hour FROM sys.objects)
    SELECT ah.hour, ISNULL(COUNT(hb.hour), 0) AS count, ISNULL(AVG(CAST(hb.cluster_duration AS FLOAT)), 0) AS avg_duration
    FROM AllHours ah LEFT JOIN HourBuckets hb ON ah.hour = hb.hour GROUP BY ah.hour ORDER BY ah.hour;

    -- 4. Duration
    SELECT COUNT(CASE WHEN cluster_duration <= @dur_short_max THEN 1 END) AS short_count, COUNT(CASE WHEN cluster_duration > @dur_short_max AND cluster_duration <= @dur_medium_max THEN 1 END) AS medium_count, COUNT(CASE WHEN cluster_duration > @dur_medium_max THEN 1 END) AS long_count FROM #TempClusters;

    -- 5. Noisy
    WITH MessageStats AS (
      SELECT message, cluster_duration,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cluster_duration) OVER (PARTITION BY message) AS median_duration,
             CASE WHEN cluster_duration <= @false_wakeup_threshold THEN 1 ELSE 0 END as is_false_wakeup
      FROM #TempClusters
    )
    SELECT TOP 10 message, COUNT(*) as count, ISNULL(AVG(CAST(cluster_duration AS FLOAT)), 0) as avg_duration,
        MAX(median_duration) as median_duration,
        CAST(SUM(is_false_wakeup) * 100.0 / NULLIF(COUNT(*), 0) AS DECIMAL(5,2)) as false_positive_rate
    FROM MessageStats GROUP BY message ORDER BY count DESC;

    DROP TABLE #TempClusters;
  `,
  UNCLUSTERED_PANEL_ANALYSIS_BATCH: `
    IF OBJECT_ID('tempdb..#TempRaw') IS NOT NULL DROP TABLE #TempRaw;
    SELECT duration_sec, time_fired, message INTO #TempRaw FROM dbo.historicalAlerts {WHERE_CLAUSE};

    -- 1. KPIs
    WITH MedianCTE AS (SELECT DISTINCT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_sec) OVER () AS median_val FROM #TempRaw)
    SELECT COUNT(*) AS total_alerts, AVG(CAST(duration_sec AS FLOAT)) AS avg_duration, ISNULL((SELECT TOP 1 median_val FROM MedianCTE), 0) AS median_duration, MIN(duration_sec) AS min_duration, MAX(duration_sec) AS max_duration,
      COUNT(CASE WHEN duration_sec <= @false_wakeup_threshold THEN 1 END) AS false_wakeups, COUNT(CASE WHEN duration_sec > @false_wakeup_threshold THEN 1 END) AS true_alerts,
      COUNT(CASE WHEN DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_start OR DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_end THEN 1 END) AS night_alerts,
      COUNT(CASE WHEN (DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_start OR DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_end) AND duration_sec > @false_wakeup_threshold THEN 1 END) AS night_true_wakeups,
      COUNT(CASE WHEN (DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_start OR DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_end) AND duration_sec <= @false_wakeup_threshold THEN 1 END) AS night_false_wakeups
    FROM #TempRaw;

    -- 2. Timeseries
    SELECT CAST((time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE) AS date_il, COUNT(*) AS alert_count, AVG(CAST(duration_sec AS FLOAT)) AS avg_duration,
      COUNT(CASE WHEN DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_start AND DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_end THEN 1 END) AS day_count,
      COUNT(CASE WHEN DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_start OR DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_end THEN 1 END) AS night_count
    FROM #TempRaw GROUP BY CAST((time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE) ORDER BY date_il;

    -- 3. Heatmap
    WITH HourBuckets AS (SELECT DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS hour, duration_sec FROM #TempRaw),
    AllHours AS (SELECT TOP 24 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS hour FROM sys.objects)
    SELECT ah.hour, ISNULL(COUNT(hb.hour), 0) AS count, ISNULL(AVG(CAST(hb.duration_sec AS FLOAT)), 0) AS avg_duration
    FROM AllHours ah LEFT JOIN HourBuckets hb ON ah.hour = hb.hour GROUP BY ah.hour ORDER BY ah.hour;

    -- 4. Duration
    SELECT COUNT(CASE WHEN duration_sec <= @dur_short_max THEN 1 END) AS short_count, COUNT(CASE WHEN duration_sec > @dur_short_max AND duration_sec <= @dur_medium_max THEN 1 END) AS medium_count, COUNT(CASE WHEN duration_sec > @dur_medium_max THEN 1 END) AS long_count FROM #TempRaw;

    -- 5. Noisy
    WITH MessageStats AS (
      SELECT message, duration_sec,
             PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_sec) OVER (PARTITION BY message) AS median_duration,
             CASE WHEN duration_sec <= @false_wakeup_threshold THEN 1 ELSE 0 END as is_false_wakeup
      FROM #TempRaw
    )
    SELECT TOP 10 message, COUNT(*) as count, ISNULL(AVG(CAST(duration_sec AS FLOAT)), 0) as avg_duration,
        MAX(median_duration) as median_duration,
        CAST(SUM(is_false_wakeup) * 100.0 / NULLIF(COUNT(*), 0) AS DECIMAL(5,2)) as false_positive_rate
    FROM MessageStats GROUP BY message ORDER BY count DESC;

    DROP TABLE #TempRaw;
  `,

  // ==========================================
  // INCIDENT BI QUERIES (UNCLUSTERED)
  // ==========================================
  UNCLUSTERED_INCIDENT_STATS_BATCH: `
    -- 1. Coverage Stats
    SELECT
      COUNT(*) AS total_alerts,
      COUNT(incident_number) AS alerts_covered,
      COUNT(DISTINCT incident_number) AS unique_incidents,
      COUNT(*) - COUNT(incident_number) AS alerts_no_incident,
      CAST(COUNT(incident_number) * 100.0 / NULLIF(COUNT(*), 0) AS DECIMAL(5,1)) AS coverage_pct,
      COUNT(DISTINCT panel_title) AS total_teams,
      COUNT(DISTINCT CASE WHEN incident_number IS NOT NULL THEN panel_title END) AS teams_with_incidents,
      COUNT(DISTINCT application) AS total_apps,
      COUNT(DISTINCT CASE WHEN incident_number IS NOT NULL THEN application END) AS apps_with_incidents,
      CAST(COUNT(incident_number) * 1.0 / NULLIF(COUNT(DISTINCT incident_number), 0) AS DECIMAL(5,1)) AS avg_alerts_per_incident
    FROM dbo.historicalAlerts {WHERE_CLAUSE};

    -- 2. By Team
    SELECT TOP 25
      panel_title,
      COUNT(*) AS total_alerts,
      COUNT(incident_number) AS alerts_covered,
      COUNT(DISTINCT incident_number) AS unique_incidents,
      COUNT(*) - COUNT(incident_number) AS no_incident,
      CAST(COUNT(incident_number) * 100.0 / NULLIF(COUNT(*), 0) AS DECIMAL(5,1)) AS coverage_pct,
      CAST(COUNT(incident_number) * 1.0 / NULLIF(COUNT(DISTINCT incident_number), 0) AS DECIMAL(5,1)) AS avg_alerts_per_incident
    FROM dbo.historicalAlerts {WHERE_CLAUSE}
    GROUP BY panel_title
    ORDER BY unique_incidents DESC;

    -- 3. By Application
    SELECT TOP 25
      application,
      COUNT(*) AS total_alerts,
      COUNT(incident_number) AS alerts_covered,
      COUNT(DISTINCT incident_number) AS unique_incidents,
      COUNT(*) - COUNT(incident_number) AS no_incident,
      CAST(COUNT(incident_number) * 100.0 / NULLIF(COUNT(*), 0) AS DECIMAL(5,1)) AS coverage_pct,
      CAST(COUNT(incident_number) * 1.0 / NULLIF(COUNT(DISTINCT incident_number), 0) AS DECIMAL(5,1)) AS avg_alerts_per_incident
    FROM dbo.historicalAlerts {WHERE_CLAUSE}
    GROUP BY application
    ORDER BY unique_incidents DESC;

    -- 4. Daily Trend
    SELECT
      CAST(time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time' AS DATE) AS date_il,
      COUNT(*) AS total_alerts,
      COUNT(incident_number) AS alerts_covered,
      COUNT(DISTINCT incident_number) AS unique_incidents
    FROM dbo.historicalAlerts {WHERE_CLAUSE}
    GROUP BY CAST(time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time' AS DATE)
    ORDER BY date_il;
  `,

  CLUSTERED_INCIDENT_STATS_BATCH: `
    IF OBJECT_ID('tempdb..#TempIncidentClusters') IS NOT NULL DROP TABLE #TempIncidentClusters;

    WITH Marked AS (
        SELECT time_fired, incident_number, panel_title, application,
        CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (PARTITION BY panel_title, application ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster
        FROM dbo.historicalAlerts {WHERE_CLAUSE}
    ),
    Grouped AS (
        SELECT *, SUM(is_new_cluster) OVER (PARTITION BY panel_title, application ORDER BY time_fired) AS cluster_id FROM Marked
    ),
    ClusterStats AS (
        SELECT 
            cluster_id, 
            panel_title, 
            application,
            MIN(time_fired) AS cluster_start,
            COUNT(DISTINCT incident_number) AS unique_tickets_in_cluster,
            COUNT(*) AS alerts_in_cluster
        FROM Grouped 
        GROUP BY cluster_id, panel_title, application
    )
    SELECT * INTO #TempIncidentClusters FROM ClusterStats;

    -- 1. Coverage Stats
    SELECT 
      (SELECT COUNT(*) FROM #TempIncidentClusters) AS total_alerts,
      SUM(CASE WHEN unique_tickets_in_cluster > 0 THEN 1 ELSE 0 END) AS alerts_covered, 
      (SELECT COUNT(DISTINCT incident_number) FROM dbo.historicalAlerts {WHERE_CLAUSE}) AS unique_incidents,
      SUM(CASE WHEN unique_tickets_in_cluster = 0 THEN 1 ELSE 0 END) AS alerts_no_incident,
      CAST(SUM(CASE WHEN unique_tickets_in_cluster > 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF((SELECT COUNT(*) FROM #TempIncidentClusters), 0) AS DECIMAL(5,1)) AS coverage_pct,
      COUNT(DISTINCT panel_title) AS total_teams,
      COUNT(DISTINCT CASE WHEN unique_tickets_in_cluster > 0 THEN panel_title END) AS teams_with_incidents,
      COUNT(DISTINCT application) AS total_apps,
      COUNT(DISTINCT CASE WHEN unique_tickets_in_cluster > 0 THEN application END) AS apps_with_incidents,
      CAST(SUM(CASE WHEN unique_tickets_in_cluster > 0 THEN 1 ELSE 0 END) * 1.0 / NULLIF((SELECT COUNT(DISTINCT incident_number) FROM dbo.historicalAlerts {WHERE_CLAUSE}), 0) AS DECIMAL(5,1)) AS avg_alerts_per_incident
    FROM #TempIncidentClusters;

    -- 2. By Team
    SELECT TOP 25
      c.panel_title, 
      COUNT(c.cluster_id) AS total_alerts, 
      SUM(CASE WHEN c.unique_tickets_in_cluster > 0 THEN 1 ELSE 0 END) AS alerts_covered,
      MAX(ISNULL(u.unique_incidents, 0)) AS unique_incidents,
      SUM(CASE WHEN c.unique_tickets_in_cluster = 0 THEN 1 ELSE 0 END) AS no_incident,
      CAST(SUM(CASE WHEN c.unique_tickets_in_cluster > 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(c.cluster_id), 0) AS DECIMAL(5,1)) AS coverage_pct,
      CAST(SUM(CASE WHEN c.unique_tickets_in_cluster > 0 THEN 1 ELSE 0 END) * 1.0 / NULLIF(MAX(ISNULL(u.unique_incidents, 0)), 0) AS DECIMAL(5,1)) AS avg_alerts_per_incident
    FROM #TempIncidentClusters c 
    LEFT JOIN (SELECT panel_title, COUNT(DISTINCT incident_number) AS unique_incidents FROM dbo.historicalAlerts {WHERE_CLAUSE} GROUP BY panel_title) u ON c.panel_title = u.panel_title
    WHERE c.panel_title IS NOT NULL
    GROUP BY c.panel_title 
    ORDER BY unique_incidents DESC;

    -- 3. By Application
    SELECT TOP 25
      c.application, 
      COUNT(c.cluster_id) AS total_alerts, 
      SUM(CASE WHEN c.unique_tickets_in_cluster > 0 THEN 1 ELSE 0 END) AS alerts_covered,
      MAX(ISNULL(u.unique_incidents, 0)) AS unique_incidents,
      SUM(CASE WHEN c.unique_tickets_in_cluster = 0 THEN 1 ELSE 0 END) AS no_incident,
      CAST(SUM(CASE WHEN c.unique_tickets_in_cluster > 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(c.cluster_id), 0) AS DECIMAL(5,1)) AS coverage_pct,
      CAST(SUM(CASE WHEN c.unique_tickets_in_cluster > 0 THEN 1 ELSE 0 END) * 1.0 / NULLIF(MAX(ISNULL(u.unique_incidents, 0)), 0) AS DECIMAL(5,1)) AS avg_alerts_per_incident
    FROM #TempIncidentClusters c 
    LEFT JOIN (SELECT application, COUNT(DISTINCT incident_number) AS unique_incidents FROM dbo.historicalAlerts {WHERE_CLAUSE} GROUP BY application) u ON c.application = u.application
    WHERE c.application IS NOT NULL
    GROUP BY c.application 
    ORDER BY unique_incidents DESC;

    -- 4. Daily Trend
    SELECT 
      CAST((c.cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE) AS date_il,
      COUNT(c.cluster_id) AS total_alerts, 
      SUM(CASE WHEN c.unique_tickets_in_cluster > 0 THEN 1 ELSE 0 END) AS alerts_covered,
      MAX(ISNULL(u.unique_incidents, 0)) AS unique_incidents
    FROM #TempIncidentClusters c 
    LEFT JOIN (SELECT CAST((time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE) AS date_il, COUNT(DISTINCT incident_number) AS unique_incidents FROM dbo.historicalAlerts {WHERE_CLAUSE} GROUP BY CAST((time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE)) u ON CAST((c.cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE) = u.date_il
    GROUP BY CAST((c.cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE) 
    ORDER BY date_il;

    DROP TABLE #TempIncidentClusters;
  `
};