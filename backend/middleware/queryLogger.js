// middleware/queryLogger.js
// Logs incident/mapping/assignment activity with timing in all environments.
// Skips /health and /metrics entirely.
// In production: logs only actionable incident-related routes.
// In development: logs all /api routes.

const IS_PROD = process.env.NODE_ENV === 'production';

// Routes to never log (infrastructure noise)
const SKIP_PATHS = ['/health', '/metrics'];

// In production, only log incident-related routes
const PROD_ALLOW_PATTERNS = [
  /\/incidents/,
  /\/incident/,
  /\/mappings/,
  /\/rules/,
  /\/assignment-groups/,
  /\/sync/,
  /\/from-grafana/,
];

const SENSITIVE_KEYS = new Set(['password', 'token', 'secret', 'key', 'auth']);

function sanitizeParams(params) {
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return out;
}

const queryLogger = (req, res, next) => {
  const path = req.path;

  // Never log health/metrics
  if (SKIP_PATHS.some(p => path.startsWith(p))) return next();

  // In production, skip non-incident routes
  if (IS_PROD && !PROD_ALLOW_PATTERNS.some(re => re.test(path))) return next();

  const start = Date.now();
  const params = Object.keys(req.query).length ? sanitizeParams(req.query) : null;
  const paramsStr = params ? ` ${JSON.stringify(params)}` : '';
  const ts = new Date().toISOString();

  console.log(`[${ts}] ${req.method} ${path}${paramsStr}`);

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const ms = Date.now() - start;
    if (body?.success !== false) {
      const rows = Array.isArray(body?.data) ? body.data.length : (body?.count ?? (body?.data ? 1 : 0));
      console.log(`[${ts}] ✓ ${rows} rows — ${ms}ms`);
    } else {
      const errMsg = body?.error?.message || body?.error || 'error';
      console.log(`[${ts}] ✗ ${errMsg} — ${ms}ms`);
    }
    return originalJson(body);
  };

  next();
};

module.exports = { queryLogger };
