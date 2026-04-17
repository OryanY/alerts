// compare.js
require('dotenv').config();               // loads env vars
const {
  initializeSqlDatabase,
  initializeMongoDatabase,
  getSqlPool,
  getMongoDb,
  closeConnections,
} = require('./database/connection');

const APP_COLUMN = process.env.MSQL_APP_COLUMN || 'application'; // column that holds the app name

/** -----------------------------------------------------------------
 *  Normalise a string for case‑insensitive comparison.
 *  Returns empty string for non‑string values.
 * ----------------------------------------------------------------- */
const norm = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

(async () => {
  try {
    // -------------------------------------------------
    // 1️⃣ Initialise DB engines
    // -------------------------------------------------
    await Promise.all([initializeSqlDatabase(), initializeMongoDatabase()]);
    const sqlPool = getSqlPool();
    const mongo   = getMongoDb();

    const {
      collections,
    } = require('../grafana_to_servicenow/config').mongoConfig;

    // -------------------------------------------------
    // 2️⃣ Pull distinct applications from SQL
    // -------------------------------------------------
    const sqlResult = await sqlPool
      .request()
      .query(`
        SELECT DISTINCT ${APP_COLUMN} AS application
        FROM dbo.historicalAlerts
      `);
    const sqlApps = sqlResult.recordset
      .map(r => norm(r.application))
      .filter(Boolean); // drop empty strings / nulls

    // -------------------------------------------------
    // 3️⃣ Pull system‑mapping docs from Mongo (only fields we need)
    // -------------------------------------------------
    const sysMapDocs = await mongo
      .collection(collections.systemMappings)
      .find(
        {}, // no filter
        {
          projection: {
            _id: 0,
            service_offering: 1,
            grafana_names: 1, // keep the whole array
          },
        }
      )
      .toArray();

    // -------------------------------------------------
    // 4️⃣ Build a *matcher* for each Mongo doc
    // -------------------------------------------------
    // For each doc we create an object with three helpers:
    //  - exactSet : Set of exact strings (service_offering + exact grafana_names)
    //  - contains : Array of substrings that must be found inside the SQL value
    //  - regexes  : Array of RegExp objects
    const matchers = sysMapDocs.map((doc) => {
      const exactSet = new Set();
      const contains = [];
      const regexes = [];

      // service_offering itself is always an exact match
      if (doc.service_offering) exactSet.add(norm(doc.service_offering));

      // process grafana_names
      if (Array.isArray(doc.grafana_names)) {
        for (const gn of doc.grafana_names) {
          const val = norm(gn.value);
          if (!val) continue;
          switch (gn.type) {
            case 'exact':
              exactSet.add(val);
              break;
            case 'contains':
              contains.push(val);               // we will use .includes()
              break;
            case 'regex':
              try {
                regexes.push(new RegExp(gn.value, 'i')); // keep original pattern (case‑insensitive)
              } catch (e) {
                console.warn(
                  `⚠️ Invalid regex in doc (service_offering=${doc.service_offering}):`,
                  gn.value,
                  e.message
                );
              }
              break;
            default:
              // ignore unknown types
              break;
          }
        }
      }

      return { exactSet, contains, regexes };
    });

    /** -------------------------------------------------
     *  Returns true if *app* matches **any** matcher.
     * ------------------------------------------------- */
    const matchesMongo = (app) => {
      for (const m of matchers) {
        // 1️⃣ exact match
        if (m.exactSet.has(app)) return true;

        // 2️⃣ contains logic – either side may contain the other
        for (const sub of m.contains) {
          if (app.includes(sub) || sub.includes(app)) return true;
        }

        // 3️⃣ regex
        for (const rgx of m.regexes) {
          if (rgx.test(app)) return true;
        }
      }
      return false;
    };

    // -------------------------------------------------
    // 5️⃣ Compute missing apps (SQL – Mongo)
    // -------------------------------------------------
    const missing = sqlApps.filter((app) => !matchesMongo(app));

    // -------------------------------------------------
    // 6️⃣ Report
    // -------------------------------------------------
    if (missing.length === 0) {
      console.log('✅ All SQL applications are present in MongoDB.');
    } else {
      console.log(`⚠️ ${missing.length} application(s) missing in MongoDB:`);
      missing.forEach((a) => console.log('  -', a));
    }

    // -------------------------------------------------
    // 7️⃣ OPTIONAL: auto‑create placeholder docs for the missing ones
    // -------------------------------------------------
    /*
    const placeholderDocs = missing.map((app) => ({
      service_offering: app,
      grafana_names: [{ value: app, type: 'exact' }],
      createdAt: new Date(),
    }));

    const res = await mongo
      .collection(collections.systemMappings)
      .insertMany(placeholderDocs);
    console.log(`Inserted ${res.insertedCount} placeholder document(s).`);
    */
  } catch (err) {
    console.error('❌ Unexpected error:', err);
  } finally {
    await closeConnections();
    process.exit(0);
  }
})();