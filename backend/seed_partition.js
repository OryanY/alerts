require('dotenv').config({ path: '.env' });
const { initializeSqlDatabase } = require('./database/connection');

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

const teams_apps = [
  { team: 'Database Team', app: 'PostgreSQL Core' },
  { team: 'Database Team', app: 'Redis Cache' },
  { team: 'Auth Team', app: 'Cognito Sync' },
  { team: 'Auth Team', app: 'OAuth Serv' },
  { team: 'Frontend Team', app: 'Client App' },
  { team: 'Frontend Team', app: 'Admin Panel' },
  { team: 'Network Team', app: 'Firewall Policy' },
  { team: 'Network Team', app: 'VPN Gateway' }
];

const messages = ['High CPU', 'OOM Error', 'Disk Full', 'Link Down', 'Timeout', '502 Bad Gateway'];

// Target 1000 alerts
// Let's generate storms (clusters) and some singletons.

let alerts = [];
let incidentCounter = 1;

const startTimestamp = new Date('2026-01-01T00:00:00Z').getTime();
const endTimestamp = new Date('2026-04-01T00:00:00Z').getTime();

while (alerts.length < 1000) {
    const stormTime = randomInt(startTimestamp, endTimestamp);
    
    // Pick an app
    const { team, app } = randomElement(teams_apps);
    const hasIncident = Math.random() > 0.3; // 70% chance this storm has an incident
    const incNumber = hasIncident ? `INC${String(incidentCounter++).padStart(7, '0')}` : null;

    // Is it a cluster storm (2-10 alerts) or a single alert?
    const isStorm = Math.random() > 0.4; // 60% chance it's a storm
    const stormSize = isStorm ? randomInt(2, 10) : 1;

    for (let i = 0; i < stormSize; i++) {
        if (alerts.length >= 1000) break;
        
        // Offset within the 15 min window (900 seconds)
        // A cluster is formed if alerts are < 15min apart. We'll bunch them within 5 minutes.
        const offsetSecs = randomInt(0, 300); 
        const firedDate = new Date(stormTime + (offsetSecs * 1000));
        
        const durationSecs = randomInt(60, 3600);
        const resolvedDate = new Date(firedDate.getTime() + (durationSecs * 1000));

        alerts.push({
            incident_id: `sys_gen_${alerts.length + 1}`,
            panel_title: team,
            application: app,
            node_name: `node-${randomInt(1, 20)}`,
            network: 'Production',
            object: 'System',
            operator: 'Grafana',
            time_fired: firedDate.toISOString(),
            time_resolved: resolvedDate.toISOString(),
            duration_sec: durationSecs,
            message: randomElement(messages),
            incident_number: incNumber
        });
    }
}

async function seed() {
  try {
    const pool = await initializeSqlDatabase();
    
    console.log('Wiping historicalAlerts...');
    await pool.request().query('DELETE FROM dbo.historicalAlerts');

    console.log(`Inserting ${alerts.length} mock alerts for Q1 2026...`);
    
    // Batch inserts (100 at a time) to avoid SQL injection max parameter issues
    const batchSize = 100;
    for (let i = 0; i < alerts.length; i += batchSize) {
        const batch = alerts.slice(i, i + batchSize);
        let query = `
          INSERT INTO dbo.historicalAlerts 
          (incident_id, panel_title, application, node_name, network, object, operator, time_fired, time_resolved, duration_sec, message, incident_number)
          VALUES
        `;
        const values = batch.map(a => `('${a.incident_id}', '${a.panel_title}', '${a.application}', '${a.node_name}', '${a.network}', '${a.object}', '${a.operator}', '${a.time_fired}', '${a.time_resolved}', ${a.duration_sec}, '${a.message}', ${a.incident_number ? `'${a.incident_number}'` : 'NULL'})`);
        query += values.join(',\n');
        await pool.request().query(query);
    }

    console.log('Seed complete! 1000 realistic alerts inserted.');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

seed();
