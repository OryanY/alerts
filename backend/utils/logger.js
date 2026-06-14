// utils/logger.js
// -------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH for all backend logging.
//
// Two things live here:
//   1. The logger itself (levels gated by LOG_LEVEL).
//   2. REQUEST_LOG_POLICY — the one place that decides which HTTP
//      requests get logged (used by middleware/queryLogger.js).
//
// Do not call console.* directly elsewhere — use this logger so that
// (a) levels are respected, (b) output format is consistent, and
// (c) what shows up in prod is controlled from one place.
//
// Levels (most → least severe): error, warn, info, debug.
//   LOG_LEVEL=info (default in prod) hides debug.
//   LOG_LEVEL=debug (default in dev) shows everything.
// -------------------------------------------------------------------

const IS_PROD = process.env.NODE_ENV === 'production';

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const DEFAULT_LEVEL = IS_PROD ? 'info' : 'debug';
const activeLevelName = (process.env.LOG_LEVEL || DEFAULT_LEVEL).toLowerCase();
const activeLevel = LEVELS[activeLevelName] ?? LEVELS[DEFAULT_LEVEL];

// console method to use per level
const SINKS = { error: console.error, warn: console.warn, info: console.log, debug: console.log };

function emit(levelName, tag, message, meta) {
    if (LEVELS[levelName] > activeLevel) return; // below threshold → dropped

    const ts = new Date().toISOString();
    const label = levelName.toUpperCase().padEnd(5);
    const prefix = tag ? `[${tag}] ` : '';
    const line = `${ts} ${label} ${prefix}${message}`;

    if (meta !== undefined) {
        // Keep meta on the same logical record; pretty in dev, compact in prod.
        SINKS[levelName](line, IS_PROD ? safeJson(meta) : meta);
    } else {
        SINKS[levelName](line);
    }
}

function safeJson(value) {
    try { return JSON.stringify(value); }
    catch { return String(value); }
}

function makeLogger(tag = null) {
    return {
        error: (msg, meta) => emit('error', tag, msg, meta),
        warn: (msg, meta) => emit('warn', tag, msg, meta),
        info: (msg, meta) => emit('info', tag, msg, meta),
        debug: (msg, meta) => emit('debug', tag, msg, meta),
        /** Namespaced child logger, e.g. logger.tagged('ServiceNow'). */
        tagged: (childTag) => makeLogger(childTag),
        level: activeLevelName
    };
}

const logger = makeLogger();

// -------------------------------------------------------------------
// REQUEST LOG POLICY — single source of truth for HTTP request logging.
//
// Rules applied by middleware/queryLogger.js, in order:
//   1. silentPaths        → never logged, any outcome (e.g. health checks).
//   2. errors (>=400)     → ALWAYS logged (warn for 4xx, error for 5xx).
//   3. successful (<400)  → logged at info only when logSuccess is true.
//                           Tune per-env with LOG_HTTP_SUCCESS=false to keep
//                           prod quiet (errors still logged).
// -------------------------------------------------------------------
const REQUEST_LOG_POLICY = {
    silentPaths: [/\/health/, /\/favicon/, /\/metrics(\/|$)/],
    logSuccess: process.env.LOG_HTTP_SUCCESS
        ? process.env.LOG_HTTP_SUCCESS !== 'false'
        : !IS_PROD, // dev: log successes; prod: errors only, unless opted in
    // Query-string keys whose values are redacted before logging.
    sensitiveKeys: new Set(['password', 'token', 'secret', 'key', 'auth'])
};

module.exports = { logger, REQUEST_LOG_POLICY, LEVELS };
