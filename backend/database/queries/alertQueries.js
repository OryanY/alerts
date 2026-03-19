// database/queries/alertQueries.js
module.exports = {
  SELECT_ALERTS: `
    SELECT {TOP_CLAUSE}
      incident_id, panel_title, application, node_name, network, object, operator, time_fired, time_resolved, duration_sec, message, key_field, incident_number, history_id
    FROM dbo.historicalAlerts {WHERE_CLAUSE} {ORDER_CLAUSE} {PAGINATION_CLAUSE}
  `,
  CLUSTERED_ALERTS: `
    WITH Filtered AS (
        SELECT {TOP_CLAUSE} incident_id, panel_title, application, node_name, network, object, operator, time_fired, time_resolved, duration_sec, message, key_field, incident_number, history_id
        FROM dbo.historicalAlerts {WHERE_CLAUSE} {RAW_ORDER_CLAUSE} {PAGINATION_CLAUSE}
    ),
    Marked AS (
        SELECT *,
        CASE WHEN ABS(DATEDIFF(MINUTE, LAG(time_fired) OVER (ORDER BY time_fired), time_fired)) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster
        FROM Filtered
    ),
    Grouped AS (
        SELECT *, SUM(is_new_cluster) OVER (ORDER BY time_fired) AS cluster_id FROM Marked
    ),
    Clusters AS (
        SELECT 
            cluster_id, MIN(time_fired) AS time_fired, MAX(time_resolved) AS time_resolved,
            SUM(ISNULL(duration_sec, 0)) AS duration_sec, COUNT(*) AS cluster_count,
            MAX(panel_title) AS panel_title, MAX(application) AS application, MAX(node_name) AS node_name,
            MAX(network) AS network, MAX(object) AS object, MAX(operator) AS operator,
            MAX(message) AS message, MIN(incident_id) AS incident_id, MIN(incident_number) AS incident_number,
            MIN(history_id) AS history_id, MAX(key_field) AS key_field
        FROM Grouped GROUP BY cluster_id
    )
    SELECT 
        c.incident_id, c.panel_title, c.application, c.node_name, c.network, c.object, c.operator, 
        c.time_fired, c.time_resolved, c.duration_sec, c.message, c.key_field, c.incident_number, 
        c.history_id, c.cluster_count,
        (
            SELECT time_fired, duration_sec, message 
            FROM Grouped g WHERE g.cluster_id = c.cluster_id 
            ORDER BY time_fired ASC FOR JSON PATH
        ) AS raw_alerts_json
    FROM Clusters c
    {ORDER_CLAUSE}
  `,
  SELECT_BASIC_RECORDS: `SELECT TOP (@limit_param) {FIELDS} FROM dbo.historicalAlerts {WHERE_CLAUSE} ORDER BY time_fired DESC`,
  HOURLY_HEATMAP: `
    WITH HourBuckets AS (
      SELECT DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS hour,
             COUNT(*) AS count, AVG(CAST(duration_sec AS FLOAT)) AS avg_duration
      FROM dbo.historicalAlerts {WHERE_CLAUSE}
      GROUP BY DATEPART(HOUR, time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time')
    ),
    AllHours AS (SELECT TOP 24 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS hour FROM sys.objects)
    SELECT ah.hour, ISNULL(hb.count, 0) AS count, ISNULL(hb.avg_duration, 0) AS avg_duration
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
        CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster 
        FROM dbo.historicalAlerts {WHERE_CLAUSE}
    ),
    Grouped AS (
        SELECT time_fired, duration_sec, panel_title, application, SUM(is_new_cluster) OVER (ORDER BY time_fired) AS cluster_id 
        FROM Marked
    ),
    Clusters AS (
        SELECT 
            MAX(panel_title) AS panel_title,
            MAX(application) AS application,
            DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration 
        FROM Grouped GROUP BY cluster_id
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
    SELECT {TOP_CLAUSE} panel_title, application, COUNT(*) AS alert_count, ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration, MIN(duration_sec) AS min_duration, MAX(duration_sec) AS max_duration,
      COUNT(CASE WHEN duration_sec <= @dur_short_max THEN 1 END) AS short_alerts, COUNT(CASE WHEN duration_sec > @dur_short_max AND duration_sec <= @dur_medium_max THEN 1 END) AS medium_alerts, COUNT(CASE WHEN duration_sec > @dur_medium_max THEN 1 END) AS long_alerts
    FROM dbo.historicalAlerts {WHERE_CLAUSE} GROUP BY panel_title, application ORDER BY alert_count DESC
  `,
  TOP_APPLICATIONS: `
    SELECT TOP (@limit_param) application, COUNT(*) AS alert_count, COUNT(DISTINCT node_name) AS node_count, ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration
    FROM dbo.historicalAlerts {WHERE_CLAUSE} GROUP BY application ORDER BY alert_count DESC
  `,
  TOP_NODES_BY_APP: `
    SELECT TOP (@limit_param) node_name, CASE WHEN COUNT(DISTINCT object) > 1 THEN 'Multiple (' + CAST(COUNT(DISTINCT object) AS VARCHAR) + ')' ELSE MAX(object) END AS object,
      COUNT(*) AS alert_count,
      MAX(time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS last_alert,
      ROUND(AVG(CAST(duration_sec AS FLOAT)), 2) AS avg_duration
    FROM dbo.historicalAlerts {WHERE_CLAUSE} GROUP BY node_name ORDER BY alert_count DESC
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
    WITH Marked AS (SELECT time_fired, duration_sec, CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster FROM dbo.historicalAlerts {WHERE_CLAUSE}),
    Grouped AS (SELECT time_fired, duration_sec, SUM(is_new_cluster) OVER (ORDER BY time_fired) AS cluster_id FROM Marked),
    Clusters AS (SELECT cluster_id, MIN(time_fired) AS cluster_start, DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration FROM Grouped GROUP BY cluster_id),
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
    WITH Marked AS (SELECT time_fired, duration_sec, CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster FROM dbo.historicalAlerts {WHERE_CLAUSE}),
    Grouped AS (SELECT time_fired, duration_sec, SUM(is_new_cluster) OVER (ORDER BY time_fired) AS cluster_id FROM Marked),
    Clusters AS (SELECT MIN(time_fired) AS cluster_start, DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration FROM Grouped GROUP BY cluster_id),
    HourBuckets AS (SELECT DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS hour, cluster_duration FROM Clusters),
    AllHours AS (SELECT TOP 24 ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) - 1 AS hour FROM sys.objects)
    SELECT ah.hour, ISNULL(COUNT(hb.hour), 0) AS count, ISNULL(AVG(CAST(hb.cluster_duration AS FLOAT)), 0) AS avg_duration
    FROM AllHours ah LEFT JOIN HourBuckets hb ON ah.hour = hb.hour GROUP BY ah.hour ORDER BY ah.hour
  `,
  CLUSTERED_DURATION_HISTOGRAM: `
    WITH Marked AS (SELECT time_fired, duration_sec, CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster FROM dbo.historicalAlerts {WHERE_CLAUSE}),
    Grouped AS (SELECT time_fired, duration_sec, SUM(is_new_cluster) OVER (ORDER BY time_fired) AS cluster_id FROM Marked),
    Clusters AS (SELECT DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration FROM Grouped GROUP BY cluster_id)
    SELECT COUNT(CASE WHEN cluster_duration <= @dur_short_max THEN 1 END) AS short_count, COUNT(CASE WHEN cluster_duration > @dur_short_max AND cluster_duration <= @dur_medium_max THEN 1 END) AS medium_count, COUNT(CASE WHEN cluster_duration > @dur_medium_max THEN 1 END) AS long_count FROM Clusters
  `,
  CLUSTERED_SHIFT_ANALYSIS: `
    WITH Marked AS (SELECT time_fired, duration_sec, panel_title, operator, CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster FROM dbo.historicalAlerts {WHERE_CLAUSE}),
    Grouped AS (SELECT time_fired, duration_sec, panel_title, operator, SUM(is_new_cluster) OVER (ORDER BY time_fired) AS cluster_id FROM Marked),
    Clusters AS (SELECT MIN(time_fired) AS cluster_start, DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration, MAX(panel_title) AS panel_title, MAX(operator) AS operator FROM Grouped GROUP BY cluster_id)
    SELECT CASE WHEN DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_start AND DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_end THEN 'Day' ELSE 'Night' END AS shift,
      COUNT(*) AS alert_count, AVG(CAST(cluster_duration AS FLOAT)) AS avg_duration, MIN(cluster_duration) AS min_duration, MAX(cluster_duration) AS max_duration,
      COUNT(CASE WHEN cluster_duration <= @false_wakeup_threshold THEN 1 END) AS false_wakeups, COUNT(CASE WHEN cluster_duration > @false_wakeup_threshold THEN 1 END) AS true_alerts
    FROM Clusters GROUP BY CASE WHEN DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_start AND DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_end THEN 'Day' ELSE 'Night' END
  `,
  CLUSTERED_TIMESERIES: `
    WITH Marked AS (SELECT time_fired, duration_sec, CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster FROM dbo.historicalAlerts {WHERE_CLAUSE}),
    Grouped AS (SELECT time_fired, duration_sec, SUM(is_new_cluster) OVER (ORDER BY time_fired) AS cluster_id FROM Marked),
    Clusters AS (SELECT MIN(time_fired) AS cluster_start, DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration FROM Grouped GROUP BY cluster_id)
    SELECT CAST((cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE) AS date_il, COUNT(*) AS alert_count, AVG(CAST(cluster_duration AS FLOAT)) AS avg_duration,
      COUNT(CASE WHEN DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_start AND DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_end THEN 1 END) AS day_count,
      COUNT(CASE WHEN DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') < @day_start OR DATEPART(HOUR, cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') >= @day_end THEN 1 END) AS night_count
    FROM Clusters GROUP BY CAST((cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE) ORDER BY date_il
  `,
  UNCLUSTERED_TOP_NOISY_ALERTS: `
    SELECT TOP 10
        message,
        COUNT(*) as count,
        ISNULL(AVG(CAST(duration_sec AS FLOAT)), 0) as avg_duration,
        CAST(
            SUM(CASE WHEN duration_sec <= @false_wakeup_threshold THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0)
        AS DECIMAL(5,2)) as false_positive_rate
    FROM dbo.historicalAlerts {WHERE_CLAUSE}
    GROUP BY message
    ORDER BY count DESC
  `,
  CLUSTERED_TOP_NOISY_ALERTS: `
    WITH Marked AS (
        SELECT 
            time_fired,
            duration_sec,
            message,
            CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster
        FROM dbo.historicalAlerts {WHERE_CLAUSE}
    ),
    Grouped AS (
        SELECT time_fired, duration_sec, message, SUM(is_new_cluster) OVER (ORDER BY time_fired) AS cluster_id FROM Marked
    ),
    Clusters AS (
        SELECT 
            MAX(message) as message,
            DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration 
        FROM Grouped GROUP BY cluster_id
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
        SELECT time_fired, duration_sec, panel_title, operator, message,
        CASE WHEN ABS(DATEDIFF(MINUTE, LAG(time_fired) OVER (ORDER BY time_fired), time_fired)) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster 
        FROM dbo.historicalAlerts {WHERE_CLAUSE}
    ),
    Grouped AS (
        SELECT *, SUM(is_new_cluster) OVER (ORDER BY time_fired) AS cluster_id FROM Marked
    ),
    Clusters AS (
        SELECT 
            MIN(time_fired) AS cluster_start, 
            DATEDIFF(SECOND, MIN(time_fired), MAX(DATEADD(SECOND, ISNULL(duration_sec, 0), time_fired))) AS cluster_duration,
            MAX(message) AS message
        FROM Grouped GROUP BY cluster_id
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
    SELECT TOP 10 message, COUNT(*) as count, ISNULL(AVG(CAST(cluster_duration AS FLOAT)), 0) as avg_duration,
        CAST(SUM(CASE WHEN cluster_duration <= @false_wakeup_threshold THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0) AS DECIMAL(5,2)) as false_positive_rate
    FROM #TempClusters GROUP BY message ORDER BY count DESC;

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
    SELECT TOP 10 message, COUNT(*) as count, ISNULL(AVG(CAST(duration_sec AS FLOAT)), 0) as avg_duration,
        CAST(SUM(CASE WHEN duration_sec <= @false_wakeup_threshold THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0) AS DECIMAL(5,2)) as false_positive_rate
    FROM #TempRaw GROUP BY message ORDER BY count DESC;

    DROP TABLE #TempRaw;
  `,

  // ==========================================
  // INCIDENT BI QUERIES (UNCLUSTERED)
  // ==========================================
  INCIDENT_COVERAGE_STATS: `
    SELECT
      COUNT(*) AS total_alerts,
      COUNT(incident_number) AS alerts_covered,
      COUNT(DISTINCT incident_number) AS unique_incidents,
      COUNT(*) - COUNT(incident_number) AS alerts_no_incident,
      CAST(COUNT(incident_number) * 100.0 / NULLIF(COUNT(*), 0) AS DECIMAL(5,1)) AS coverage_pct,
      CAST(COUNT(DISTINCT incident_number) * 100.0 / NULLIF(COUNT(*), 0) AS DECIMAL(5,1)) AS incident_creation_rate,
      COUNT(DISTINCT panel_title) AS total_teams,
      COUNT(DISTINCT CASE WHEN incident_number IS NOT NULL THEN panel_title END) AS teams_with_incidents,
      COUNT(DISTINCT application) AS total_apps,
      COUNT(DISTINCT CASE WHEN incident_number IS NOT NULL THEN application END) AS apps_with_incidents,
      CAST(COUNT(incident_number) * 1.0 / NULLIF(COUNT(DISTINCT incident_number), 0) AS DECIMAL(5,1)) AS avg_alerts_per_incident
    FROM dbo.historicalAlerts {WHERE_CLAUSE}
  `,

  INCIDENTS_BY_TEAM: `
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
    ORDER BY unique_incidents DESC
  `,

  INCIDENTS_BY_APPLICATION: `
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
    ORDER BY unique_incidents DESC
  `,

  INCIDENT_DAILY_TREND: `
    SELECT
      CAST(time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time' AS DATE) AS date_il,
      COUNT(*) AS total_alerts,
      COUNT(incident_number) AS alerts_covered,
      COUNT(DISTINCT incident_number) AS unique_incidents
    FROM dbo.historicalAlerts {WHERE_CLAUSE}
    GROUP BY CAST(time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time' AS DATE)
    ORDER BY date_il
  `,

  // ==========================================
  // INCIDENT BI QUERIES (CLUSTERED / EVENT-BASED)
  // ==========================================
  CLUSTERED_INCIDENT_COVERAGE_STATS: `
    WITH Marked AS (
        SELECT time_fired, incident_number, panel_title, application,
        CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster
        FROM dbo.historicalAlerts {WHERE_CLAUSE}
    ),
    Grouped AS (
        SELECT *, SUM(is_new_cluster) OVER (ORDER BY time_fired) AS cluster_id FROM Marked
    ),
    ClusterStats AS (
        SELECT 
            cluster_id, 
            MAX(panel_title) AS panel_title, 
            MAX(application) AS application,
            COUNT(DISTINCT incident_number) AS unique_tickets_in_cluster
        FROM Grouped 
        GROUP BY cluster_id
    )
    SELECT 
      COUNT(*) AS total_alerts,
      SUM(CASE WHEN unique_tickets_in_cluster > 0 THEN 1 ELSE 0 END) AS alerts_covered, 
      (SELECT COUNT(DISTINCT incident_number) FROM dbo.historicalAlerts {WHERE_CLAUSE}) AS unique_incidents,
      SUM(CASE WHEN unique_tickets_in_cluster = 0 THEN 1 ELSE 0 END) AS alerts_no_incident,
      CAST(SUM(CASE WHEN unique_tickets_in_cluster > 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(*), 0) AS DECIMAL(5,1)) AS coverage_pct,
      COUNT(DISTINCT panel_title) AS total_teams,
      COUNT(DISTINCT CASE WHEN unique_tickets_in_cluster > 0 THEN panel_title END) AS teams_with_incidents,
      COUNT(DISTINCT application) AS total_apps,
      COUNT(DISTINCT CASE WHEN unique_tickets_in_cluster > 0 THEN application END) AS apps_with_incidents,
      CAST((SELECT COUNT(DISTINCT incident_number) FROM dbo.historicalAlerts {WHERE_CLAUSE}) * 1.0 / NULLIF(COUNT(*), 0) AS DECIMAL(5,1)) AS avg_alerts_per_incident
    FROM ClusterStats
  `,

  CLUSTERED_INCIDENTS_BY_TEAM: `
    WITH Marked AS (
        SELECT time_fired, incident_number, panel_title, 
        CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster
        FROM dbo.historicalAlerts {WHERE_CLAUSE}
    ),
    Grouped AS (
        SELECT *, SUM(is_new_cluster) OVER (ORDER BY time_fired) AS cluster_id FROM Marked
    ),
    ClusterStats AS (
        SELECT 
            cluster_id, 
            MAX(panel_title) AS panel_title, 
            COUNT(DISTINCT incident_number) AS unique_tickets_in_cluster
        FROM Grouped 
        GROUP BY cluster_id
    ),
    UniqueTickets AS (
        SELECT panel_title, COUNT(DISTINCT incident_number) AS unique_incidents 
        FROM dbo.historicalAlerts {WHERE_CLAUSE} 
        GROUP BY panel_title
    )
    SELECT TOP 25
      c.panel_title, 
      COUNT(c.cluster_id) AS total_alerts, 
      SUM(CASE WHEN c.unique_tickets_in_cluster > 0 THEN 1 ELSE 0 END) AS alerts_covered,
      MAX(ISNULL(u.unique_incidents, 0)) AS unique_incidents,
      SUM(CASE WHEN c.unique_tickets_in_cluster = 0 THEN 1 ELSE 0 END) AS no_incident,
      CAST(SUM(CASE WHEN c.unique_tickets_in_cluster > 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(c.cluster_id), 0) AS DECIMAL(5,1)) AS coverage_pct,
      CAST(MAX(ISNULL(u.unique_incidents, 0)) * 1.0 / NULLIF(COUNT(c.cluster_id), 0) AS DECIMAL(5,1)) AS avg_alerts_per_incident
    FROM ClusterStats c 
    LEFT JOIN UniqueTickets u ON c.panel_title = u.panel_title
    WHERE c.panel_title IS NOT NULL
    GROUP BY c.panel_title 
    ORDER BY unique_incidents DESC
  `,

  CLUSTERED_INCIDENTS_BY_APPLICATION: `
    WITH Marked AS (
        SELECT time_fired, incident_number, application, 
        CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster
        FROM dbo.historicalAlerts {WHERE_CLAUSE}
    ),
    Grouped AS (
        SELECT *, SUM(is_new_cluster) OVER (ORDER BY time_fired) AS cluster_id FROM Marked
    ),
    ClusterStats AS (
        SELECT 
            cluster_id, 
            MAX(application) AS application, 
            COUNT(DISTINCT incident_number) AS unique_tickets_in_cluster
        FROM Grouped 
        GROUP BY cluster_id
    ),
    UniqueTickets AS (
        SELECT application, COUNT(DISTINCT incident_number) AS unique_incidents 
        FROM dbo.historicalAlerts {WHERE_CLAUSE} 
        GROUP BY application
    )
    SELECT TOP 25
      c.application, 
      COUNT(c.cluster_id) AS total_alerts, 
      SUM(CASE WHEN c.unique_tickets_in_cluster > 0 THEN 1 ELSE 0 END) AS alerts_covered,
      MAX(ISNULL(u.unique_incidents, 0)) AS unique_incidents,
      SUM(CASE WHEN c.unique_tickets_in_cluster = 0 THEN 1 ELSE 0 END) AS no_incident,
      CAST(SUM(CASE WHEN c.unique_tickets_in_cluster > 0 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(c.cluster_id), 0) AS DECIMAL(5,1)) AS coverage_pct,
      CAST(MAX(ISNULL(u.unique_incidents, 0)) * 1.0 / NULLIF(COUNT(c.cluster_id), 0) AS DECIMAL(5,1)) AS avg_alerts_per_incident
    FROM ClusterStats c 
    LEFT JOIN UniqueTickets u ON c.application = u.application
    WHERE c.application IS NOT NULL
    GROUP BY c.application 
    ORDER BY unique_incidents DESC
  `,

  CLUSTERED_INCIDENT_DAILY_TREND: `
    WITH Marked AS (
        SELECT time_fired, incident_number, 
        CASE WHEN DATEDIFF(MINUTE, LAG(time_fired) OVER (ORDER BY time_fired), time_fired) > @cluster_threshold THEN 1 ELSE 0 END AS is_new_cluster
        FROM dbo.historicalAlerts {WHERE_CLAUSE}
    ),
    Grouped AS (
        SELECT *, SUM(is_new_cluster) OVER (ORDER BY time_fired) AS cluster_id FROM Marked
    ),
    ClusterStats AS (
        SELECT 
            cluster_id, 
            MIN(time_fired) AS cluster_start, 
            COUNT(DISTINCT incident_number) AS unique_tickets_in_cluster
        FROM Grouped 
        GROUP BY cluster_id
    ),
    UniqueTickets AS (
        SELECT CAST((time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE) AS date_il, 
        COUNT(DISTINCT incident_number) AS unique_incidents 
        FROM dbo.historicalAlerts {WHERE_CLAUSE} 
        GROUP BY CAST((time_fired AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE)
    )
    SELECT 
      CAST((c.cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE) AS date_il,
      COUNT(c.cluster_id) AS total_alerts, 
      SUM(CASE WHEN c.unique_tickets_in_cluster > 0 THEN 1 ELSE 0 END) AS alerts_covered,
      MAX(ISNULL(u.unique_incidents, 0)) AS unique_incidents
    FROM ClusterStats c 
    LEFT JOIN UniqueTickets u ON CAST((c.cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE) = u.date_il
    GROUP BY CAST((c.cluster_start AT TIME ZONE 'UTC' AT TIME ZONE 'Israel Standard Time') AS DATE) 
    ORDER BY date_il
  `
};