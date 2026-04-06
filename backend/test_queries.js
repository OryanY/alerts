require('dotenv').config({ path: '.env' });
const { initializeSqlDatabase } = require('./database/connection');
const queries = require('./database/queries/alertQueries');

async function test() {
  try {
    const pool = await initializeSqlDatabase();

    const request = pool.request();
    request.input('cluster_threshold', 15);
    
    // Replace placeholders just to make it runnable
    const unclusteredQuery = queries.UNCLUSTERED_INCIDENT_STATS_BATCH.replace(/{WHERE_CLAUSE}/g, '');
    const clusteredQuery = queries.CLUSTERED_INCIDENT_STATS_BATCH.replace(/{WHERE_CLAUSE}/g, '');

    console.log('--- UNCLUSTERED INCIDENT STATS ---');
    const uResult = await request.query(unclusteredQuery);
    console.log(uResult.recordsets[0]);

    console.log('\n--- CLUSTERED INCIDENT STATS ---');
    const cResult = await request.query(clusteredQuery);
    console.log(cResult.recordsets[0]);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

test();
