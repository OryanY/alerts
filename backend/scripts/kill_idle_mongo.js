/**
 * Usage: node scripts/kill_idle_mongo.js
 * 
 * This script identifies and terminates idle MongoDB connections.
 * Useful when other services (or this one) leak connections or hold them too long.
 */

require('dotenv').config({ path: '../.env' }); // Adjust if run from 'backend/' root or 'scripts/'
// Fallback if running from root
if (!process.env.MONGO_URI) {
    require('dotenv').config();
}

const { MongoClient } = require('mongodb');

// --- CONFIGURATION ---
const IDLE_LIMIT_SEC = 300;     // 5 Minutes (Connections idle longer than this will be killed)
const DRY_RUN = false;          // Set to true to just list them without killing
const EXCLUDED_APPS = ['MongoDB Shell', 'ClusterMonitor']; // Don't kill these

async function cleanupIdleConnections() {
    console.log('🧹 MongoDB Idle Connection Cleaner');
    console.log('==================================');

    const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
    if (!uri) {
        console.error('❌ MONGO_URI not found in environment.');
        process.exit(1);
    }

    const client = new MongoClient(uri);

    try {
        console.log('Connecting to MongoDB...');
        await client.connect();

        // We need admin privileges to run currentOp and killOp
        const adminDb = client.db().admin();

        console.log(`Searching for connections idle > ${IDLE_LIMIT_SEC}s...`);

        // Fetch all operations including idle connections ("$all": true)
        const ops = await adminDb.command({ currentOp: 1, "$all": true });

        const idleOps = ops.inprog.filter(op => {
            // Must be inactive
            if (op.active) return false;

            // Must be running longer than limit
            if (op.secs_running < IDLE_LIMIT_SEC) return false;

            // Must have an opid to kill
            if (!op.opid) return false;

            // Don't kill ourselves or excluded apps
            if (op.appName && EXCLUDED_APPS.includes(op.appName)) return false;
            if (op.clientMetadata?.application?.name && EXCLUDED_APPS.includes(op.clientMetadata.application.name)) return false;

            return true;
        });

        if (idleOps.length === 0) {
            console.log('✅ No idle connections found.');
        } else {
            console.log(`⚠️  Found ${idleOps.length} idle connections.`);

            for (const op of idleOps) {
                const appName = op.appName || op.clientMetadata?.application?.name || 'Unknown';
                const clientIp = op.client || 'Unknown IP';

                console.log(`   - [${op.opid}] Client: ${clientIp} | App: ${appName} | Idle: ${op.secs_running}s`);

                if (!DRY_RUN) {
                    try {
                        await adminDb.command({ killOp: 1, op: op.opid });
                        console.log(`     ⚡ Killed.`);
                    } catch (err) {
                        console.error(`     ❌ Failed to kill: ${err.message}`);
                    }
                }
            }
        }

        if (DRY_RUN && idleOps.length > 0) {
            console.log('\n(Dry run enabled - no connections were actually killed)');
        } else if (idleOps.length > 0) {
            console.log('\n✅ Cleanup complete.');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await client.close();
        console.log('Disconnected.');
    }
}

cleanupIdleConnections();
