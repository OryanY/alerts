-- 001_alert_indexes.sql
-- Covering indexes for dbo.historicalAlerts, supporting the two BI access paths.
-- Run once against the SQL Server database (e.g. in SSMS). IF NOT EXISTS makes
-- this safe to re-run. On Enterprise / Azure SQL add WITH (ONLINE = ON) to the
-- CREATE statements so the build does not block writers.

-- 1) Clustering + single-panel browse + per-panel analytics.
--    Feeds the window functions (PARTITION BY panel_title, application
--    ORDER BY time_fired) pre-sorted, so SQL Server skips the Sort operator.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_histAlerts_panel_app_time'
      AND object_id = OBJECT_ID('dbo.historicalAlerts')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_histAlerts_panel_app_time
    ON dbo.historicalAlerts (panel_title, application, time_fired)
    INCLUDE (duration_sec, incident_number, node_name, network, object, operator, message);
END;
GO

-- 2) All-panels flat browse + time-series, ordered by time_fired.
--    Also the seek index that keyset/cursor pagination on (time_fired, incident_id)
--    would use if/when the list switches away from OFFSET paging.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_histAlerts_time_id'
      AND object_id = OBJECT_ID('dbo.historicalAlerts')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_histAlerts_time_id
    ON dbo.historicalAlerts (time_fired DESC, incident_id DESC)
    INCLUDE (panel_title, application, duration_sec, incident_number);
END;
GO

-- When dbo.historicalAlerts grows into the millions of rows, add a nonclustered
-- columnstore index so the clustering / KPI aggregations run in batch mode
-- (10-100x faster). Skip it at smaller scale — the rowstore indexes above are enough.
--
-- CREATE NONCLUSTERED COLUMNSTORE INDEX NCCI_histAlerts
-- ON dbo.historicalAlerts
--     (time_fired, panel_title, application, duration_sec, incident_number, node_name);
