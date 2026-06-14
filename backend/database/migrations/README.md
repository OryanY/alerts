# Database migrations

Plain `.sql` files, applied in filename order. There is no migration runner yet —
run each new file once against the SQL Server database (e.g. in SSMS). Every file
uses `IF NOT EXISTS`, so re-running is safe.

| File | What it does |
|------|--------------|
| `001_alert_indexes.sql` | Covering indexes on `dbo.historicalAlerts` for the alert-browse and clustering/BI access paths. |

When you outgrow hand-running files, promote this folder to a real runner
(node-mssql-migrate, Flyway, or a tiny `applied_migrations` table that the app
checks on startup). The naming convention (`NNN_description.sql`) is already
runner-compatible.
