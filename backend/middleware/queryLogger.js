// middleware/queryLogger.js
// ---------------------------------------------------------------
//  Query logger – prints request, execution time and row count.
//  Skips everything that contains "/health" or "/metrics" in the URL.
//  In production it only logs incident‑related routes.
// ---------------------------------------------------------------

const IS_PROD = process.env.NODE_ENV === 'production';

// 1️⃣  Skip any URL that contains "/health" or "/metrics" (e.g. /api/health,
//     /healthz, /metrics, /api/metrics/line-failures, etc.)
const SKIP_PATHS = [/\/health/, /\/metrics/];

// 2️⃣  In production we only want to log routes that are incident‑related.
const PROD_ALLOW_PATTERNS = [
  /\/incidents/,
  /\/incident/,
  /\/mappings/,
  /\/rules/,
  /\/assignment-groups/,
  /\/sync/,
  /\/from-grafana/,
];

// 3️⃣  Sensitive query‑string keys that should be redacted.
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'key',
  'auth',
]);

/**
 * Remove sensitive values from the request query before logging.
 */
function sanitizeParams(params) {
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return out;
}

/**
 * Express middleware – logs the request line, then replaces `res.json`
 * so we can log the row count and elapsed time when the response is sent.
 */
function queryLogger(req, res, next) {
  // `originalUrl` contains the full path the client called, including any
  // mount prefix (e.g. "/api/health" or "/metrics/line-failures").
  const url = req.originalUrl;

  // ---------------------------------------------------------------
  // Skip logging for health & metrics endpoints
  // ---------------------------------------------------------------
  if (SKIP_PATHS.some(rx => rx.test(url))) return next();

  // In production, ignore everything that is not incident‑related
  if (IS_PROD && !PROD_ALLOW_PATTERNS.some(rx => rx.test(url))) return next();

  // ---------------------------------------------------------------
  // Start logging
  // ---------------------------------------------------------------
  const start = Date.now();

  const params = Object.keys(req.query).length
    ? sanitizeParams(req.query)
    : null;
  const paramsStr = params ? ` ${JSON.stringify(params)}` : '';

  const ts = new Date().toISOString();
  //console.log(`[${ts}] ${req.method} ${url}${paramsStr}`);

  // Wrap `res.json` so we can log the result metadata when the response
  // is finally sent.
  const originalJson = res.json.bind(res);
  res.json = body => {
    const ms = Date.now() - start;

    // Successful responses → count rows
    if (body?.success !== false) {
      const rows = Array.isArray(body?.data)
        ? body.data.length
        : body?.count ?? (body?.data ? 1 : 0);
    } else {
      // Error responses → log the message
      const errMsg = body?.error?.message || body?.error || 'error';
      console.log(`[${ts}] ✗ ${errMsg} — ${ms}ms`);
    }
    return originalJson(body);
  };

  next();
}

// ---------------------------------------------------------------
module.exports = { queryLogger };