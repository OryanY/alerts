// middleware/queryLogger.js — Dev-only query logger
// Logs: endpoint + params → result count + duration
// Only active when NODE_ENV=development
//
// Example output:
//   [QUERY] GET /api/alerts { start_date: '2025-03-01', end_date: '2025-03-18', application: 'MyApp' }
//   [QUERY] ✓ 142 rows — 234ms

const SENSITIVE_KEYS = new Set(['password', 'token', 'secret', 'key', 'auth']);

/**
 * Sanitize query params for logging — redact sensitive keys.
 */
function sanitizeParams(params) {
    const out = {};
    for (const [k, v] of Object.entries(params)) {
        out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v;
    }
    return out;
}

/**
 * Dev query logger middleware.
 * Wraps res.json() to intercept the response and log result count + duration.
 */
const queryLogger = (req, res, next) => {
    const start = Date.now();
    const params = Object.keys(req.query).length ? sanitizeParams(req.query) : null;

    // Log the incoming request
    const paramsStr = params ? ` ${JSON.stringify(params)}` : '';
    console.log(`[QUERY] ${req.method} ${req.path}${paramsStr}`);

    // Wrap res.json to intercept the outgoing response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        const ms = Date.now() - start;

        if (body && body.success !== false) {
            // Count rows: data is usually an array, or has a count field
            const rows = Array.isArray(body.data)
                ? body.data.length
                : (body.count ?? (body.data ? 1 : 0));
            console.log(`[QUERY] ✓ ${rows} rows — ${ms}ms`);
        } else {
            const errMsg = body?.error?.message || body?.error || 'error';
            console.log(`[QUERY] ✗ ${errMsg} — ${ms}ms`);
        }

        return originalJson(body);
    };

    next();
};

module.exports = { queryLogger };
