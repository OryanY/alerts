/*
  Manual SQL Server indexes for /api/alerts paging, filtering, and export.

  Review with your DBA before running in production. These statements are
  idempotent and do not run automatically from the application.

  Rollback examples are included at the bottom.
*/

SET NOCOUNT ON;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_historicalAlerts_time_fired_incident'
      AND object_id = OBJECT_ID('dbo.historicalAlerts')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_historicalAlerts_time_fired_incident
    ON dbo.historicalAlerts (time_fired DESC, incident_id DESC)
    INCLUDE (
        panel_title, application, node_name, network, object, operator,
        time_resolved, duration_sec, message, key_field,
        incident_number, incident_sys_id, history_id
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_historicalAlerts_panel_application_time'
      AND object_id = OBJECT_ID('dbo.historicalAlerts')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_historicalAlerts_panel_application_time
    ON dbo.historicalAlerts (panel_title, application, time_fired DESC, incident_id DESC)
    INCLUDE (
        node_name, network, object, operator, time_resolved,
        duration_sec, message, key_field, incident_number,
        incident_sys_id, history_id
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_historicalAlerts_application_time'
      AND object_id = OBJECT_ID('dbo.historicalAlerts')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_historicalAlerts_application_time
    ON dbo.historicalAlerts (application, time_fired DESC, incident_id DESC)
    INCLUDE (
        panel_title, node_name, network, object, operator,
        time_resolved, duration_sec, message, key_field,
        incident_number, incident_sys_id, history_id
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_historicalAlerts_operator_time'
      AND object_id = OBJECT_ID('dbo.historicalAlerts')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_historicalAlerts_operator_time
    ON dbo.historicalAlerts (operator, time_fired DESC, incident_id DESC)
    INCLUDE (
        panel_title, application, node_name, network, object,
        time_resolved, duration_sec, message, key_field,
        incident_number, incident_sys_id, history_id
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_historicalAlerts_incident_present_time'
      AND object_id = OBJECT_ID('dbo.historicalAlerts')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_historicalAlerts_incident_present_time
    ON dbo.historicalAlerts (incident_number, time_fired DESC, incident_id DESC)
    INCLUDE (
        panel_title, application, node_name, network, object,
        operator, time_resolved, duration_sec, message,
        key_field, incident_sys_id, history_id
    )
    WHERE incident_number IS NOT NULL;
END;

/*
  Notes:
  - `message LIKE '%text%'` cannot use these normal b-tree indexes. If message
    search remains slow, review a SQL Server full-text index separately.
  - Clustered alert mode uses window functions over filtered date/app/panel sets,
    so date and panel/application selectivity matter most.

  Rollback:

  DROP INDEX IF EXISTS IX_historicalAlerts_incident_present_time ON dbo.historicalAlerts;
  DROP INDEX IF EXISTS IX_historicalAlerts_operator_time ON dbo.historicalAlerts;
  DROP INDEX IF EXISTS IX_historicalAlerts_application_time ON dbo.historicalAlerts;
  DROP INDEX IF EXISTS IX_historicalAlerts_panel_application_time ON dbo.historicalAlerts;
  DROP INDEX IF EXISTS IX_historicalAlerts_time_fired_incident ON dbo.historicalAlerts;
*/
