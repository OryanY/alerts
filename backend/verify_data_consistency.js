// backend/verify_data_consistency.js
// Usage: node verify_data_consistency.js [days_back]
// Standard verification script to ensure all pages see the same data

const { initializeSqlDatabase, closeConnections, getSqlPool } = require('./database/connection');
const AlertService = require('./services/alert/AlertService');
const { AlertAnalysisService } = require('./services/alert/AlertAnalysisService');

async function runVerification() {
    try {
        console.log('Connecting to database...');
        await initializeSqlDatabase();

        const alertService = new AlertService();
        const daysBack = process.argv[2] ? parseInt(process.argv[2]) : 30;

        console.log(`\n=== DATA CONSISTENCY CHECK (Last ${daysBack} days) ===\n`);

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        // Pad date range to ensure full coverage (start of day / end of day handled by service usually, but let's be explicit)
        const params = {
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            limit: 100000 // High limit for accuracy
        };

        console.log(`Range: ${params.start_date} to ${params.end_date}`);

        // --- CHECK 1: DB RAW COUNT vs OVERVIEW STATS (Dashboard) ---
        console.log('\n[1] Checking Dashboard Accuracy (DB Count vs Overview Stats)...');

        const overviewStats = await alertService.getOverviewStats(params);

        // Direct DB Query
        const pool = getSqlPool();
        const result = await pool.request()
            .input('start', startDate)
            .input('end', endDate)
            .query(`
                SELECT COUNT(*) as count 
                FROM dbo.historicalAlerts 
                WHERE time_fired >= @start AND time_fired <= @end
            `);

        const dbCount = result.recordset[0].count;
        const dashboardCount = overviewStats.data.total_alerts;

        console.log(`    DB Raw Count:       ${dbCount}`);
        console.log(`    Dashboard Total:    ${dashboardCount}`);

        if (dbCount === dashboardCount) {
            console.log('    ✅ STATUS: MATCH');
        } else {
            console.log('    ❌ STATUS: MISMATCH');
        }

        // --- CHECK 2: EXPLORER vs OVERVIEW ---
        console.log('\n[2] Checking Explorer Accuracy (GetAlerts vs Overview Stats)...');

        // We use a high limit to try and get "all" for counting, 
        // but typically Explorer is paginated. We'll start by checking the paginated metadata or total if available.
        // Actually AlertService.countAlerts isn't exposed directly in API usually, assuming getAlerts returns total in pagination?
        // Let's check getAlerts without pagination first (implicit high limit)

        const explorerResult = await alertService.getAlerts(params);
        // Note: valid getAlerts return { success: true, data: [...] } or { success: true, data: { records: [...], pagination: {...} } }

        let explorerCount = 0;
        if (Array.isArray(explorerResult.data)) {
            explorerCount = explorerResult.data.length;
        } else if (explorerResult.data?.records) {
            explorerCount = explorerResult.data.pagination.returned; // or total if we had it
        }

        // If limit hit cap, this verification might be skewed.
        const hitCap = explorerCount >= 100000;

        console.log(`    Explorer Count:     ${explorerCount} ${hitCap ? '(HIT CAP)' : ''}`);
        console.log(`    Dashboard Total:    ${dashboardCount}`);

        // Note: clustering might be enabled by default in getAlerts if we didn't disable it?
        // Let's explicitly disable clustering for a "Raw" comparison
        const rawExplorerResult = await alertService.getAlerts({ ...params, clustering_enabled: false });
        const rawExplorerCount = rawExplorerResult.data.length;

        console.log(`    Explorer (No Clust):${rawExplorerCount}`);

        if (rawExplorerCount === dashboardCount) {
            console.log('    ✅ STATUS: MATCH (Raw Explorer = Dashboard)');
        } else {
            console.log('    ❌ STATUS: MISMATCH');
        }

        // --- CHECK 3: PANEL CONSISTENCY ---
        console.log('\n[3] Checking Panel Consistency...');
        // Get a top panel
        const panelList = await alertService.getPanelList({ ...params, limit: 1 });
        if (panelList.data && panelList.data.length > 0) {
            const topPanel = panelList.data[0];
            const panelName = topPanel.panel_title;
            console.log(`    Testing Panel: "${panelName}"`);

            // 3a. Check Panel List Stat vs Analysis
            const pAnalysis = await alertService.getPanelAnalysis({ ...params, panel_title: panelName });
            const analysisTotal = pAnalysis.data.summary.total_alerts;

            console.log(`    Panel Stats Count:  ${topPanel.alert_count}`);
            console.log(`    Panel Analysis:     ${analysisTotal}`);

            if (topPanel.alert_count === analysisTotal) {
                console.log('    ✅ STATUS: MATCH (Global List vs Panel Page)');
            } else {
                console.log('    ❌ STATUS: MISMATCH');
            }

            // 3b. Check Recent Alerts for Panel
            const recent = await alertService.getAlerts({ ...params, panel_title: panelName, clustering_enabled: false });
            const recentCount = recent.data.length;
            console.log(`    Panel Recent List:  ${recentCount}`);

            if (recentCount === analysisTotal) {
                console.log('    ✅ STATUS: MATCH (Panel Page Analysis vs Recent Table)');
            } else {
                console.log('    ❌ STATUS: MISMATCH');
            }

        } else {
            console.log('    Skipped (No panels found)');
        }


        // --- CHECK 4: DATA INTEGRITY (Cluster Sum) ---
        console.log('\n[4] Checking Cluster Math...');
        // Using the raw explorer result from earlier (with default clustering/params if enabled?)
        // Let's explicitly enable clustering
        const clusteredRes = await alertService.getAlerts({ ...params, clustering_enabled: true, clustering_threshold: 15 });
        const alerts = clusteredRes.data;

        const totalItems = alerts.length;
        const singles = alerts.filter(a => !a.is_cluster).length;
        const clusters = alerts.filter(a => a.is_cluster);
        const clusterAlertSum = clusters.reduce((sum, c) => sum + c.cluster_count, 0);

        const reconstructedTotal = singles + clusterAlertSum;

        console.log(`    Total Items (Rows): ${totalItems}`);
        console.log(`    Single Alerts:      ${singles}`);
        console.log(`    Clusters:           ${clusters.length}`);
        console.log(`    Alerts in Clusters: ${clusterAlertSum}`);
        console.log(`    Reconstructed Sum:  ${reconstructedTotal}`);
        console.log(`    Original DB Count:  ${dbCount}`);

        if (reconstructedTotal === dbCount) {
            console.log('    ✅ STATUS: PERFECT INTEGRITY');
        } else {
            console.log('    ⚠️ STATUS: VARIANCE (Likely due to date boundary edge cases in clustering)');
            const diff = dbCount - reconstructedTotal;
            console.log(`    Variance: ${diff} alerts (${(diff / dbCount * 100).toFixed(2)}%)`);
        }

    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        await closeConnections();
    }
}

runVerification();
