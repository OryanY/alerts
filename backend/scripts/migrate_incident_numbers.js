// migrate_incident_numbers.js
// Production migration script to:
//   1. Add incident_sys_id column to SQL Server
//   2. Fix misplaced sys_ids in incident_number column
//   3. Create incident_logs collection in MongoDB
// Run with: node migrate_incident_numbers.js

require('dotenv').config();
const sql = require('mssql');
const { MongoClient } = require('mongodb');

// Configuration - UPDATE THESE FOR PRODUCTION
const CONFIG = {
    sql: {
        server: process.env.SQL_SERVER || 'localhost',
        port: parseInt(process.env.SQL_PORT, 10) || 1433,
        database: process.env.SQL_DATABASE || 'master',
        user: process.env.SQL_USER || 'sa',
        password: process.env.SQL_PASSWORD,
        options: {
            encrypt: process.env.SQL_ENCRYPT === 'true',
            trustServerCertificate: true
        }
    },
    mongo: {
        uri: process.env.MONGO_URI || 'mongodb://localhost:27017/grafana_snow_dev',
        database: process.env.MONGO_DB || 'grafana_snow_dev'
    },
    servicenow: {
        instance: process.env.SERVICENOW_INSTANCE || 'your-instance.service-now.com',
        username: process.env.SERVICENOW_USERNAME,
        password: process.env.SERVICENOW_PASSWORD,
        // For testing with mock
        useMock: process.env.MOCK_SERVICENOW === 'true',
        mockUrl: process.env.SERVICENOW_URL || 'http://localhost:8000'
    }
};

async function main() {
    console.log('\n🔄 PRODUCTION MIGRATION');
    console.log('='.repeat(60));

    // Step 1: Connect to SQL Server
    console.log('📊 Step 1: Connecting to SQL Server...');
    const pool = await sql.connect(CONFIG.sql);
    console.log('   Connected!\n');

    // Step 2: Connect to MongoDB and create incident_logs collection
    console.log('🍃 Step 2: Setting up MongoDB incident_logs collection...');
    const mongoClient = new MongoClient(CONFIG.mongo.uri);
    await mongoClient.connect();
    const db = mongoClient.db(CONFIG.mongo.database);

    // Check if collection exists
    const collections = await db.listCollections({ name: 'incident_logs' }).toArray();
    if (collections.length === 0) {
        await db.createCollection('incident_logs');
        console.log('   Created incident_logs collection');
    } else {
        console.log('   incident_logs collection already exists');
    }

    // Create indexes
    const incidentLogsCollection = db.collection('incident_logs');
    await incidentLogsCollection.createIndex({ incident_number: 1 });
    await incidentLogsCollection.createIndex({ sys_id: 1 });
    await incidentLogsCollection.createIndex({ created_at: -1 });
    console.log('   Indexes created\n');

    // Step 3: Add incident_sys_id column if not exists
    console.log('📋 Step 3: Checking/Adding incident_sys_id column...');
    await addColumnIfNotExists(pool, 'activeAlerts');
    await addColumnIfNotExists(pool, 'historicalAlerts');
    console.log('   Done!\n');

    // Step 4: Find all records with sys_id in incident_number
    console.log('🔍 Step 4: Finding records with sys_id in incident_number...');
    const activeRecords = await findMisplacedSysIds(pool, 'activeAlerts');
    const historyRecords = await findMisplacedSysIds(pool, 'historicalAlerts');
    console.log(`   activeAlerts: ${activeRecords.length} records`);
    console.log(`   historicalAlerts: ${historyRecords.length} records\n`);

    // Combine unique sys_ids
    const allSysIds = [...new Set([
        ...activeRecords.map(r => r.incident_number),
        ...historyRecords.map(r => r.incident_number)
    ])];
    console.log(`   Total unique sys_ids: ${allSysIds.length}\n`);

    if (allSysIds.length === 0) {
        console.log('✅ No migration needed - no sys_ids found in incident_number column');
        await pool.close();
        await mongoClient.close();
        return;
    }

    // Step 5: Query ServiceNow for INC numbers
    console.log('🌐 Step 5: Fetching INC numbers from ServiceNow...');
    const sysIdToIncMap = await fetchIncidentNumbers(allSysIds);
    console.log(`   Found ${Object.keys(sysIdToIncMap).length} mappings\n`);

    // Show mappings
    console.log('📝 Mappings:');
    for (const [sysId, incNumber] of Object.entries(sysIdToIncMap)) {
        console.log(`   ${sysId} → ${incNumber}`);
    }
    console.log('');

    // Step 6: Update SQL records
    console.log('💾 Step 6: Updating SQL records...');
    await updateRecords(pool, 'activeAlerts', activeRecords, sysIdToIncMap);
    await updateRecords(pool, 'historicalAlerts', historyRecords, sysIdToIncMap);
    console.log('   Done!\n');

    // Step 7: Verify
    console.log('✅ Step 7: Verification...');
    const activeAfter = await findMisplacedSysIds(pool, 'activeAlerts');
    const historyAfter = await findMisplacedSysIds(pool, 'historicalAlerts');
    console.log(`   activeAlerts remaining: ${activeAfter.length}`);
    console.log(`   historicalAlerts remaining: ${historyAfter.length}\n`);

    console.log('='.repeat(60));
    console.log('🎉 Migration complete!');

    await pool.close();
    await mongoClient.close();
}

async function addColumnIfNotExists(pool, tableName) {
    const checkQuery = `
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_NAME = '${tableName}' AND COLUMN_NAME = 'incident_sys_id'
    `;
    const result = await pool.request().query(checkQuery);

    if (result.recordset.length === 0) {
        console.log(`   Adding incident_sys_id to ${tableName}...`);
        await pool.request().query(`ALTER TABLE ${tableName} ADD incident_sys_id NVARCHAR(100) NULL`);
    } else {
        console.log(`   ${tableName} already has incident_sys_id column`);
    }
}

async function findMisplacedSysIds(pool, tableName) {
    // Find records where incident_number is NOT an INC number (it's actually a sys_id)
    // Real INC numbers start with "INC" like INC0001234
    const query = `
        SELECT id, incident_number 
        FROM ${tableName} 
        WHERE incident_number IS NOT NULL 
          AND incident_number != ''
          AND incident_number NOT LIKE 'INC%'
    `;
    const result = await pool.request().query(query);
    return result.recordset;
}

async function fetchIncidentNumbers(sysIds) {
    const mapping = {};

    if (CONFIG.servicenow.useMock) {
        // Query mock ServiceNow
        const url = `${CONFIG.servicenow.mockUrl}/api/now/table/incident?sysparm_query=${sysIds.map(id => `sys_id=${id}`).join('^OR')}`;
        const response = await fetch(url);
        const data = await response.json();

        for (const inc of data.result || []) {
            mapping[inc.sys_id] = inc.incident_number;
        }
    } else {
        // Query real ServiceNow (batch in groups of 50)
        const batchSize = 50;
        for (let i = 0; i < sysIds.length; i += batchSize) {
            const batch = sysIds.slice(i, i + batchSize);
            const query = batch.map(id => `sys_id=${id}`).join('^OR');

            const url = `https://${CONFIG.servicenow.instance}/api/now/table/incident?sysparm_query=${encodeURIComponent(query)}&sysparm_fields=sys_id,incident_number`;

            const response = await fetch(url, {
                headers: {
                    'Authorization': 'Basic ' + Buffer.from(`${CONFIG.servicenow.username}:${CONFIG.servicenow.password}`).toString('base64'),
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                console.error(`   ServiceNow API error: ${response.status}`);
                continue;
            }

            const data = await response.json();
            for (const inc of data.result || []) {
                mapping[inc.sys_id] = inc.incident_number;
            }
        }
    }

    return mapping;
}

async function updateRecords(pool, tableName, records, sysIdToIncMap) {
    let updated = 0;
    let skipped = 0;

    for (const record of records) {
        const sysId = record.incident_number;
        const incNumber = sysIdToIncMap[sysId];

        if (!incNumber) {
            console.log(`   ⚠️  No INC found for ${sysId}, skipping`);
            skipped++;
            continue;
        }

        const updateQuery = `
            UPDATE ${tableName}
            SET incident_number = @incNumber,
                incident_sys_id = @sysId
            WHERE id = @id
        `;

        await pool.request()
            .input('incNumber', sql.NVarChar, incNumber)
            .input('sysId', sql.NVarChar, sysId)
            .input('id', sql.Int, record.id)
            .query(updateQuery);

        updated++;
    }

    console.log(`   ${tableName}: ${updated} updated, ${skipped} skipped`);
}

main().catch(err => {
    console.error('❌ Error:', err);
    process.exit(1);
});
