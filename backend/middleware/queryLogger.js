// middleware/queryLogger.js
// HTTP request logger. All policy decisions (which paths are silent,
// whether successes are logged, which query keys are redacted) come from
// REQUEST_LOG_POLICY in utils/logger.js — this file only applies them.

const { logger, REQUEST_LOG_POLICY } = require('../utils/logger');

const httpLog = logger.tagged('http');

/** Redact sensitive values from the query string before logging. */
function sanitizeParams(params) {
    const out = {};
    for (const [k, v] of Object.entries(params)) {
        out[k] = REQUEST_LOG_POLICY.sensitiveKeys.has(k.toLowerCase()) ? '[REDACTED]' : v;
    }
    return out;
}

function queryLogger(req, res, next) {
    const url = req.originalUrl;

    // Rule 1: silent paths are never logged, regardless of outcome.
    if (REQUEST_LOG_POLICY.silentPaths.some(rx => rx.test(url))) return next();

    const start = Date.now();

    res.on('finish', () => {
        const ms = Date.now() - start;
        const status = res.statusCode;
        const isError = status >= 400;

        // Rule 3: skip successful requests unless the policy logs them.
        if (!isError && !REQUEST_LOG_POLICY.logSuccess) return;

        const params = Object.keys(req.query).length ? sanitizeParams(req.query) : undefined;
        const meta = { status, ms, ...(params && { params }) };
        const line = `${req.method} ${url}`;

        // Rule 2: errors are always logged (warn 4xx, error 5xx).
        if (status >= 500) httpLog.error(line, meta);
        else if (status >= 400) httpLog.warn(line, meta);
        else httpLog.info(line, meta);
    });

    next();
}

module.exports = { queryLogger };
