/**
 * Clustering Logic Verification Script
 * Compares SQL-based vs Clustered-based outputs for all stats endpoints
 * 
 * Usage: node verify_clustering.js
 */

require('dotenv').config();
const { initializeSqlDatabase, closeConnections } = require('./database/connection');

// Import services - AlertService is exported directly, not destructured
const AlertService = require('./services/alert/AlertService');

// Test parameters
const TEST_PARAMS = {
    start_date: '2026-01-01',
    end_date: '2026-02-01',
    application: null,
    panel_title: null,
    false_wakeup_threshold: 120,
    dur_short_max: 59,
    dur_medium_max: 299,
    night_start: 22,
    night_end: 6,
    day_start: 6,
    day_end: 22
};

async function compareOutputs(name, sqlResult, clusteredResult) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 ${name}`);
    console.log('='.repeat(60));

    const sqlData = sqlResult.data || sqlResult;
    const clusteredData = clusteredResult.data || clusteredResult;

    // --- Statistical Analysis ---
    let sqlCount = 0;
    let clusteredCount = 0;
    let sqlDuration = 0;
    let clusteredDuration = 0;

    // Helper to extract stats based on endpoint type
    if (name === 'Duration Histogram') {
        sqlCount = sqlData.reduce((acc, b) => acc + b.count, 0);
        clusteredCount = clusteredData.reduce((acc, b) => acc + b.count, 0);
    } else if (name === 'Hourly Heatmap') {
        sqlCount = sqlData.reduce((acc, b) => acc + b.count, 0);
        clusteredCount = clusteredData.reduce((acc, b) => acc + b.count, 0);
    } else if (name === 'Shift Analysis') {
        sqlCount = sqlData.reduce((acc, b) => acc + b.alert_count, 0);
        clusteredCount = clusteredData.reduce((acc, b) => acc + b.alert_count, 0); // Using alert_count (total)
    } else if (name === 'Timeseries Stats') {
        sqlCount = sqlData.reduce((acc, b) => acc + b.alert_count, 0);
        clusteredCount = clusteredData.reduce((acc, b) => acc + b.alert_count, 0);
    }

    if (sqlCount > 0) {
        const reduction = ((sqlCount - clusteredCount) / sqlCount * 100).toFixed(1);
        console.log(`\n📉 Impact Analysis:`);
        console.log(`   - Raw Alerts:      ${sqlCount}`);
        console.log(`   - Clustered Incidents: ${clusteredCount}`);
        console.log(`   - Reduction:       ${reduction}% (Compressed noise)`);

        if (clusteredCount > sqlCount) {
            console.log(`   ⚠️  WARNING: Clustered count is HIGHER than raw count! This indicates a logic error.`);
        }
    } else if (Array.isArray(sqlData)) {
        console.log(`   - No data found for analysis period.`);
    }

    console.log(`SQL Records: ${Array.isArray(sqlData) ? sqlData.length : 'object'}`);
    console.log(`Clustered Records: ${Array.isArray(clusteredData) ? clusteredData.length : 'object'}`);

    // Compare field names
    if (Array.isArray(sqlData) && sqlData.length > 0 && Array.isArray(clusteredData) && clusteredData.length > 0) {
        const sqlFields = Object.keys(sqlData[0]).sort();
        const clusteredFields = Object.keys(clusteredData[0]).sort();

        const missingInClustered = sqlFields.filter(f => !clusteredFields.includes(f));
        const extraInClustered = clusteredFields.filter(f => !sqlFields.includes(f));

        if (missingInClustered.length > 0) {
            console.log(`⚠️  Missing in clustered: ${missingInClustered.join(', ')}`);
        }
        if (extraInClustered.length > 0) {
            console.log(`ℹ️  Extra in clustered: ${extraInClustered.join(', ')}`);
        }
        if (missingInClustered.length === 0 && extraInClustered.length === 0) {
            console.log(`✅ Field names match!`);
        }

        // Show sample data
        console.log('\n--- Sample SQL Output ---');
        console.log(JSON.stringify(sqlData[0], null, 2));
        console.log('\n--- Sample Clustered Output ---');
        console.log(JSON.stringify(clusteredData[0], null, 2));
    } else if (!Array.isArray(sqlData)) {
        console.log('\n--- SQL Output ---');
        console.log(JSON.stringify(sqlData, null, 2));
        console.log('\n--- Clustered Output ---');
        console.log(JSON.stringify(clusteredData, null, 2));
    }

    return { sqlData, clusteredData };
}

async function runVerification() {
    console.log('🔍 Clustering Logic Verification Script');
    console.log('======================================\n');

    try {
        // Initialize database
        console.log('Connecting to database...');
        await initializeSqlDatabase();

        const alertService = new AlertService();
        const issues = [];

        // Test 1: Duration Histogram
        console.log('\n⏳ Testing getDurationHistogram...');
        const durationSql = await alertService.getDurationHistogram({
            ...TEST_PARAMS,
            clustering_enabled: false
        });
        const durationClustered = await alertService.getDurationHistogram({
            ...TEST_PARAMS,
            clustering_enabled: true
        });
        await compareOutputs('Duration Histogram', durationSql, durationClustered);

        // Test 2: Hourly Heatmap
        console.log('\n⏳ Testing getHourlyHeatmap...');
        const heatmapSql = await alertService.getHourlyHeatmap({
            ...TEST_PARAMS,
            clustering_enabled: false
        });
        const heatmapClustered = await alertService.getHourlyHeatmap({
            ...TEST_PARAMS,
            clustering_enabled: true
        });
        const heatmapResult = await compareOutputs('Hourly Heatmap', heatmapSql, heatmapClustered);

        // Verify heatmap has 24 hours
        const clusteredHours = heatmapResult.clusteredData?.length || 0;
        if (clusteredHours !== 24) {
            issues.push(`Hourly Heatmap: Expected 24 hours, got ${clusteredHours}`);
        }

        // Test 3: Shift Analysis
        console.log('\n⏳ Testing getShiftAnalysis...');
        const shiftSql = await alertService.getShiftAnalysis({
            ...TEST_PARAMS,
            clustering_enabled: false
        });
        const shiftClustered = await alertService.getShiftAnalysis({
            ...TEST_PARAMS,
            clustering_enabled: true
        });
        const shiftResult = await compareOutputs('Shift Analysis', shiftSql, shiftClustered);

        // Check if shift field is correct
        if (shiftResult.clusteredData?.[0]) {
            if (!('shift' in shiftResult.clusteredData[0])) {
                issues.push("Shift Analysis: Missing 'shift' field");
            }
            if (!('true_alerts' in shiftResult.clusteredData[0])) {
                issues.push("Shift Analysis: Missing 'true_alerts' field");
            }
        }

        // Test 4: Timeseries Stats
        console.log('\n⏳ Testing getTimeseriesStats...');
        const timeseriesSql = await alertService.getTimeseriesStats({
            ...TEST_PARAMS,
            clustering_enabled: false
        });
        const timeseriesClustered = await alertService.getTimeseriesStats({
            ...TEST_PARAMS,
            clustering_enabled: true
        });
        await compareOutputs('Timeseries Stats', timeseriesSql, timeseriesClustered);

        // Test 5: Consecutive Days Nodes
        console.log('\n⏳ Testing getConsecutiveDaysNodes...');
        const consecutiveSql = await alertService.getConsecutiveDaysNodes({
            ...TEST_PARAMS,
            clustering_enabled: false
        });
        const consecutiveClustered = await alertService.getConsecutiveDaysNodes({
            ...TEST_PARAMS,
            clustering_enabled: true
        });
        await compareOutputs('Consecutive Days Nodes', consecutiveSql, consecutiveClustered);

        // Test 6: Top Nodes By App
        console.log('\n⏳ Testing getTopNodesByApp...');
        const topNodesSql = await alertService.getTopNodesByApp({
            ...TEST_PARAMS,
            clustering_enabled: false
        });
        const topNodesClustered = await alertService.getTopNodesByApp({
            ...TEST_PARAMS,
            clustering_enabled: true
        });
        await compareOutputs('Top Nodes By App', topNodesSql, topNodesClustered);

        // Test 7: Panel Stats
        console.log('\n⏳ Testing getPanelStats...');
        const panelStatsSql = await alertService.getPanelStats({
            ...TEST_PARAMS,
            clustering_enabled: false
        });
        const panelStatsClustered = await alertService.getPanelStats({
            ...TEST_PARAMS,
            clustering_enabled: true
        });
        await compareOutputs('Panel Stats', panelStatsSql, panelStatsClustered);

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📋 VERIFICATION SUMMARY');
        console.log('='.repeat(60));

        if (issues.length === 0) {
            console.log('✅ All checks passed! Clustering logic looks correct.');
        } else {
            console.log('⚠️  Issues found:');
            issues.forEach(issue => console.log(`   - ${issue}`));
        }

    } catch (error) {
        console.error('❌ Error during verification:', error);
    } finally {
        await closeConnections();
        console.log('\n✅ Database connection closed.');
    }
}

runVerification();
