// debug_clustering.js - Analyze clustering behavior
require('dotenv').config();
const { initializeSqlDatabase, getSqlPool, closeSqlPool } = require('./database/connection');
const { AlertAnalysisService } = require('./services/alert/AlertAnalysisService');

async function analyzeClustering() {
    // Initialize database first
    await initializeSqlDatabase();
    const pool = getSqlPool();
    const analysisService = new AlertAnalysisService();

    console.log('\n🔍 CLUSTERING ANALYSIS');
    console.log('='.repeat(60));

    // Fetch all alerts for Error Rate panel
    const result = await pool.request().query(`
        SELECT 
            history_id,
            panel_title,
            application,
            node_name,
            message,
            time_fired,
            time_resolved,
            duration_sec
        FROM historicalAlerts
        WHERE panel_title = 'Error Rate'
        ORDER BY application, time_fired
    `);

    const rawAlerts = result.recordset.map(r => ({
        ...r,
        time_fired: new Date(r.time_fired)
    }));

    console.log(`\n📊 RAW ALERTS: ${rawAlerts.length}`);

    // Group by application for raw count
    const rawByApp = {};
    rawAlerts.forEach(a => {
        rawByApp[a.application] = (rawByApp[a.application] || 0) + 1;
    });
    console.log('\nBy Application (Raw):');
    Object.entries(rawByApp).sort((a, b) => b[1] - a[1]).forEach(([app, count]) => {
        console.log(`  ${app}: ${count}`);
    });

    // Run clustering with 15 min threshold
    const clustered = analysisService.clusterAlerts(rawAlerts, true, 15);

    console.log(`\n📦 CLUSTERED INCIDENTS: ${clustered.length}`);
    console.log(`   Reduction: ${rawAlerts.length} → ${clustered.length} (${rawAlerts.length - clustered.length} alerts merged)`);

    // Group by application for clustered count
    const clusteredByApp = {};
    clustered.forEach(c => {
        clusteredByApp[c.application] = (clusteredByApp[c.application] || 0) + 1;
    });
    console.log('\nBy Application (Clustered):');
    Object.entries(clusteredByApp).sort((a, b) => b[1] - a[1]).forEach(([app, count]) => {
        const raw = rawByApp[app] || 0;
        const diff = raw - count;
        console.log(`  ${app}: ${count} (was ${raw}${diff > 0 ? `, -${diff} merged` : ''})`);
    });

    // Find and show merged alerts
    console.log('\n🔗 MERGED ALERTS (clusters with >1 alert):');
    const mergedClusters = clustered.filter(c => c.cluster_count > 1);

    if (mergedClusters.length === 0) {
        console.log('  None found!');
    } else {
        mergedClusters.forEach((cluster, i) => {
            console.log(`\n  Cluster ${i + 1}:`);
            console.log(`    Application: ${cluster.application}`);
            console.log(`    Panel: ${cluster.panel_title}`);
            console.log(`    Alerts merged: ${cluster.cluster_count}`);
            console.log(`    Time range: ${cluster.time_fired.toISOString()} → ${cluster.endTime?.toISOString() || 'N/A'}`);
            console.log(`    Duration: ${cluster.duration_sec}s`);
            if (cluster.child_alerts) {
                console.log('    Child alerts:');
                cluster.child_alerts.forEach(child => {
                    console.log(`      - ${child.node_name}: ${child.message?.substring(0, 50)}...`);
                });
            }
        });
    }

    // FALSE POSITIVE ANALYSIS
    const FP_THRESHOLD = 120; // seconds
    console.log(`\n⚠️  FALSE POSITIVE ANALYSIS (threshold: ${FP_THRESHOLD}s)`);

    // Count FP in raw alerts
    const rawFP = rawAlerts.filter(a => a.duration_sec <= FP_THRESHOLD);
    console.log(`\n  Raw alerts with duration <= ${FP_THRESHOLD}s: ${rawFP.length}`);

    // Count FP in clustered alerts
    const clusteredFP = clustered.filter(c => c.duration_sec <= FP_THRESHOLD);
    console.log(`  Clustered incidents with duration <= ${FP_THRESHOLD}s: ${clusteredFP.length}`);
    console.log(`  Difference: ${rawFP.length} → ${clusteredFP.length} (${rawFP.length - clusteredFP.length} "lost")`);

    // Show the merged cluster's individual alert durations
    if (mergedClusters.length > 0) {
        console.log('\n  📋 Merged cluster duration breakdown:');
        for (const cluster of mergedClusters) {
            console.log(`\n    Cluster: ${cluster.application}`);
            console.log(`      Cluster duration: ${cluster.duration_sec}s ${cluster.duration_sec <= FP_THRESHOLD ? '(FP)' : '(NOT FP)'}`);

            // Find the original alerts that were merged
            const originalAlerts = rawAlerts.filter(a =>
                a.application === cluster.application &&
                a.time_fired >= cluster.time_fired &&
                a.time_fired <= cluster.endTime
            );

            console.log(`      Original alerts in cluster:`);
            let fpCount = 0;
            originalAlerts.forEach(a => {
                const isFP = a.duration_sec <= FP_THRESHOLD;
                if (isFP) fpCount++;
                console.log(`        - ${a.duration_sec}s ${isFP ? '(FP)' : ''} @ ${a.time_fired.toISOString()}`);
            });
            console.log(`      Individual FP count: ${fpCount}`);
            console.log(`      After clustering: ${cluster.duration_sec <= FP_THRESHOLD ? 1 : 0} FP`);
            console.log(`      FP reduction: ${fpCount - (cluster.duration_sec <= FP_THRESHOLD ? 1 : 0)}`);
        }
    }

    console.log('\n' + '='.repeat(60));
    process.exit(0);
}

analyzeClustering().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
