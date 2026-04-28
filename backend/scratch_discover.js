require('dotenv').config();
const axios = require('axios');
const { ServiceNowClient } = require('./services/incident/ServiceNowClient');

const client = new ServiceNowClient();

async function discover() {
  console.log("Starting ServiceNow Discovery...");

  // Let's test cmdb_rel_ci
  try {
    console.log("--- Fetching sample from cmdb_rel_ci (relationships) ---");
    const relRes = await axios({
        method: 'GET',
        url: `${client.url}/api/now/table/cmdb_rel_ci`,
        params: { sysparm_limit: 5 },
        auth: { username: client.username, password: client.password }
    });
    console.log("Sample relations:", JSON.stringify(relRes.data.result, null, 2));
  } catch(e) {
    console.log("Error fetching cmdb_rel_ci", e.response?.data || e.message);
  }

  // Let's test service_offering fields
  try {
    console.log("\n--- Fetching sample from service_offering ---");
    const soRes = await axios({
        method: 'GET',
        url: `${client.url}/api/now/table/service_offering`,
        params: { sysparm_limit: 1 },
        auth: { username: client.username, password: client.password }
    });
    if (soRes.data.result && soRes.data.result.length > 0) {
      const keys = Object.keys(soRes.data.result[0]).filter(k => k.includes('network') || k.startsWith('u_'));
      console.log("Custom/Network related fields on service_offering:", keys);
    }
  } catch(e) {
    console.log("Error fetching service_offering", e.response?.data || e.message);
  }

  // Let's test cmdb_ci_network or similar network tables
  const networkTables = ['cmdb_ci_network', 'u_network', 'u_network_ci', 'cmn_location'];
  for (const table of networkTables) {
    try {
      console.log(`\n--- Fetching sample from ${table} ---`);
      const netRes = await axios({
          method: 'GET',
          url: `${client.url}/api/now/table/${table}`,
          params: { sysparm_limit: 1 },
          auth: { username: client.username, password: client.password }
      });
      if (netRes.data.result && netRes.data.result.length > 0) {
          console.log(`Found table ${table}! Fields:`, Object.keys(netRes.data.result[0]).slice(0, 10));
      } else {
          console.log(`Table ${table} exists but is empty.`);
      }
    } catch(e) {
      console.log(`Table ${table} not found or error.`);
    }
  }
}

discover();
