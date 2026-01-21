const AlertService = require('./services/alert/AlertService');
const { initializeSqlDatabase, getSqlPool } = require('./database/connection');

async function debugAlertService() {
    try {
        console.log('Connecting to DB...');
        await initializeSqlDatabase();

        const service = new AlertService();

        console.log('Fetching panel list to find a valid panel...');
        const panels = await service.getPanelList({ limit: 5 });

        if (panels.data.length === 0) {
            console.log('No panels found. Cannot proceed.');
            return;
        }

        const testPanel = panels.data[0].panel_title;
        console.log(`Testing with panel: "${testPanel}"`);

        const params = {
            panel_title: testPanel,
            limit: 10,
            sort_by: 'time_fired',
            sort_order: 'DESC',
            start_date: '2020-01-01', // Wide range to ensure hits
            end_date: new Date().toISOString()
        };

        console.log('Calling getAlerts with params:', params);

        const alerts = await service.getAlerts(params);

        console.log('Result Success:', alerts.success);
        console.log('Returned Alerts Count:', alerts.data.length);

        if (alerts.data.length > 0) {
            console.log('First Alert:', JSON.stringify(alerts.data[0], null, 2));
        } else {
            // If empty, try without panel filter for sanity check
            console.log('No alerts found for panel. Trying without panel filter...');
            const allAlerts = await service.getAlerts({ ...params, panel_title: undefined });
            console.log('All Alerts Count:', allAlerts.data.length);
        }

    } catch (err) {
        console.error('Debug failed:', err);
    } finally {
        process.exit();
    }
}

debugAlertService();
