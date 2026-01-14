// backend/verify_explorer_clustering.js
// Usage: node verify_explorer_clustering.js [days_back]

const { initializeSqlDatabase, closeConnections } = require('./database/connection');
const AlertService = require('./services/alert/AlertService');

async function runVerification() {
    try {
        console.log('Connecting to database...');
        await initializeSqlDatabase();

        const alertService = new AlertService();

        const daysBack = process.argv[2] ? parseInt(process.argv[2]) : 30;

        console.log(`\n=== Verifying Explorer Clustering (Last ${daysBack} days) ===\n`);

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        const params = {
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            limit: 50, // Typical page size
            sort_by: 'time_fired',
            sort_order: 'DESC'
        };

        console.log('Fetching Alerts (simulating Explorer page 1)...');
        const result = await alertService.getAlerts(params);

        // Debug logging
        console.log('DEBUG: Result keys:', Object.keys(result));
        if (result.data) console.log('DEBUG: Data type:', Array.isArray(result.data) ? 'Array' : typeof result.data);

        // Handle both response formats (direct array or paginated object)
        let records = [];
        if (Array.isArray(result.data)) {
            records = result.data;
        } else if (result.data && result.data.records) {
            records = result.data.records;
        }

        console.log(`> Returned ${records ? records.length : 0} records.`);

        const clusters = records.filter(r => r.is_cluster);
        const singles = records.filter(r => !r.is_cluster);

        console.log(`> Found ${clusters.length} clusters.`);
        console.log(`> Found ${singles.length} single alerts.`);

        if (clusters.length > 0) {
            console.log('\n--- Sample Cluster ---');
            const sample = clusters[0];
            console.log(`Type: ${sample.is_cluster ? 'CLUSTER' : 'SINGLE'}`);
            console.log(`Count: ${sample.cluster_count}`);
            console.log(`Duration: ${sample.duration_sec}s`);

            if (sample.cluster_count > 1) {
                console.log('✅ PASS: Cluster has > 1 alerts.');
            } else {
                console.log('❌ FAIL: Cluster has 1 alert!');
            }
        }

        if (singles.length > 0) {
            console.log('\n--- Sample Single Alert ---');
            const sample = singles[0];
            console.log(`Type: ${sample.is_cluster ? 'CLUSTER' : 'SINGLE'}`);
            console.log(`Count: ${sample.cluster_count}`);

            if (!sample.is_cluster) {
                console.log('✅ PASS: Single alert is NOT marked as cluster.');
            } else {
                console.log('❌ FAIL: Single alert IS marked as cluster.');
            }
        }

    } catch (err) {
        console.error('Error running verification:', err);
    } finally {
        await closeConnections();
    }
}

runVerification();
