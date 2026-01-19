const AlertService = require('./services/alert/AlertService');
const { initializeSqlDatabase, closeConnections } = require('./database/connection');

async function runVerification() {
    console.log('=== Verifying Configurable Clustering ===');
    await initializeSqlDatabase();
    const alertService = new AlertService();

    try {
        console.log('\n--- Test 1: Clustering ENABLED (Default) ---');
        // Use demo data app name 'ClusterTestApp' to filter focus
        const resEnabled = await alertService.getAlerts({
            clustering_enabled: 'true',
            days: 30,
            limit: 100
        });

        const clustersEnabled = resEnabled.data.filter(r => r.is_cluster);
        console.log(`> Found ${clustersEnabled.length} clusters.`);

        if (clustersEnabled.length > 0) {
            console.log('✅ PASS: Clusters found when enabled.');
        } else {
            console.log('⚠️ WARNING: No clusters found (check if demo data exists).');
        }

        console.log('\n--- Test 2: Clustering DISABLED ---');
        const resDisabled = await alertService.getAlerts({
            clustering_enabled: 'false',
            days: 30,
            limit: 100
        });

        const clustersDisabled = resDisabled.data.filter(r => r.is_cluster);
        console.log(`> Found ${clustersDisabled.length} clusters.`);

        if (clustersDisabled.length === 0) {
            console.log('✅ PASS: No clusters found when disabled.');
        } else {
            console.log('❌ FAIL: Found clusters even when disabled!');
        }

        // Compare counts
        console.log(`\nStats: Enabled Total: ${resEnabled.data.length}, Disabled Total: ${resDisabled.data.length}`);
        if (resDisabled.data.length >= resEnabled.data.length) {
            console.log('✅ PASS: Disabled count >= Enabled count (Logic holds).');
        } else {
            console.log('❌ FAIL: Enabled count is higher than disabled count? Impossible.');
        }

    } catch (err) {
        console.error('❌ Verification failed:', err);
    } finally {
        await closeConnections();
    }
}

runVerification();
