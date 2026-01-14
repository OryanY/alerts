// backend/verify_clustering.js
// Usage: node verify_clustering.js [days_back]
// Example: node verify_clustering.js 30

const { initializeSqlDatabase, closeConnections } = require('./database/connection');
const AlertService = require('./services/alert/AlertService');
const { AlertAnalysisService } = require('./services/alert/AlertAnalysisService');

async function runVerification() {
    try {
        console.log('Connecting to database...');
        await initializeSqlDatabase();

        const alertService = new AlertService();
        const analysisService = new AlertAnalysisService();

        const daysBack = process.argv[2] ? parseInt(process.argv[2]) : 30;

        console.log(`\n=== Verifying Clustering Logic (Last ${daysBack} days) ===\n`);

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);

        const params = {
            start_date: startDate.toISOString(),
            end_date: endDate.toISOString(),
            false_wakeup_threshold: 120
        };

        console.log('Fetching RAW records...');
        const rawRecords = await alertService.queryService.fetchBasicRecords(
            params,
            'time_fired, duration_sec, application, panel_title'
        );
        console.log(`> Fetched ${rawRecords.length} raw alerts.`);

        console.log('\nRunning Clustering (15m sliding window)...');
        const clusters = analysisService.clusterAlerts(rawRecords, 15);
        console.log(`> Condensed into ${clusters.length} Incidents.`);

        const reduction = rawRecords.length > 0
            ? ((rawRecords.length - clusters.length) / rawRecords.length * 100).toFixed(1)
            : 0;
        console.log(`> Noise Reduction: ${reduction}%`);

        // Detailed Report of Top Clusters
        console.log('\n--- Top 5 Biggest Clusters (Most merged alerts) ---');
        const significantClusters = clusters
            .filter(c => c.cluster_count > 1)
            .sort((a, b) => b.cluster_count - a.cluster_count)
            .slice(0, 5);

        if (significantClusters.length === 0) {
            console.log('No multi-alert clusters found. All alerts were isolated.');
        } else {
            significantClusters.forEach((c, idx) => {
                console.log(`\n${idx + 1}. [${c.application}] ${c.panel_title || '(No Panel)'}`);
                console.log(`   Time: ${c.startTime.toISOString().replace('T', ' ').substring(0, 16)} -> ${c.endTime.toISOString().replace('T', ' ').substring(0, 16)}`);
                console.log(`   Merged: ${c.cluster_count} raw alerts`);
                console.log(`   Total Duration: ${c.duration_sec}s`);

                // Show sample of merged
                console.log('   Samples:');
                c.raw_alerts.slice(0, 3).forEach(r => {
                    console.log(`     - ${r.time_fired.toISOString().substring(11, 19)} (${r.duration_sec}s)`);
                });
                if (c.raw_alerts.length > 3) console.log(`     ... and ${c.raw_alerts.length - 3} more`);
            });
        }

        // Median vs Average Check
        console.log('\n--- Metric Comparison (Median vs Average) ---');

        // Raw Avearge
        const rawSum = rawRecords.reduce((acc, r) => acc + r.duration_sec, 0);
        const rawAvg = rawRecords.length ? (rawSum / rawRecords.length).toFixed(0) : 0;

        // Cluster Median
        const clusterDurations = clusters.map(c => c.duration_sec).sort((a, b) => a - b);
        const mid = Math.floor(clusterDurations.length / 2);
        const median = clusterDurations.length > 0 ? clusterDurations[mid] : 0;

        console.log(`Raw Average Duration: ${rawAvg}s`);
        console.log(`Cluster Median Duration: ${median}s`);

        if (parseInt(rawAvg) > parseInt(median) * 2) {
            console.log('✅ PASS: Median successfully filtered out skew from outliers.');
        } else {
            console.log('ℹ️ INFO: Median and Average are close (no extreme outliers).');
        }

    } catch (err) {
        console.error('Error running verification:', err);
    } finally {
        await closeConnections();
    }
}

runVerification();
