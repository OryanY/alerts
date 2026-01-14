const { initializeSqlDatabase, closeConnections } = require('./database/connection');

async function inspect() {
    try {
        const pool = await initializeSqlDatabase();
        const result = await pool.request().query("SELECT TOP 1 * FROM dbo.historicalAlerts");
        console.log(result.recordset[0]);
    } catch (err) {
        console.error(err);
    } finally {
        await closeConnections();
    }
}
inspect();
