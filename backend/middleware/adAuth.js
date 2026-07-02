// middleware/adAuth.js
// ---------------------------------------------------------------------------
// Gate for DESTRUCTIVE actions (deletes + rule toggle): verifies the signed
// login token issued by POST /api/auth/login (LDAP bind + ADAPI group check),
// then re-checks group membership through the cached ADAPI lookup so a user
// removed from the group loses access within minutes, not at token expiry.
//
// The token lives in an httpOnly cookie (never readable by page JS), sent
// automatically by the browser via credentials:'include'. Because that also
// means it's sent automatically on any cross-site request, every gated route
// additionally requires an X-CSRF-Token header matching the csrf value baked
// into the same signed token (double-submit — see routes/authRoutes.js).
//
// Reads, creates and updates are intentionally NOT gated, nor are the
// Grafana/n8n machine flows. See services/auth/AuthService.js for the whole
// authentication design (LDAP StartTLS bind, token format, caching, fail-closed).
// ---------------------------------------------------------------------------
const AuthService = require('../services/auth/AuthService');
const { logger } = require('../utils/logger');

const log = logger.tagged('auth');

const requireAuth = async (req, res, next) => {
  if (!AuthService.isEnabled()) return next(); // gate disabled (dev)

  const token = req.cookies?.auth_token || '';
  const payload = AuthService.verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      success: false,
      error: 'Login required',
      details: 'This action requires a valid login (Settings → user login). Your session may have expired.'
    });
  }

  const csrfHeader = req.get('X-CSRF-Token') || '';
  if (!csrfHeader || csrfHeader !== payload.csrf) {
    return res.status(403).json({
      success: false,
      error: 'CSRF check failed',
      details: 'Missing or invalid X-CSRF-Token header. Refresh the page and try again.'
    });
  }

  try {
    const member = await AuthService.isUserMemberOfGroup(payload.u);
    if (!member) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized',
        details: `User "${payload.u}" is not a member of the ${AuthService.ADAPI_ADMIN_GROUP} group.`
      });
    }
  } catch (e) {
    // ADAPI down = an incident. Deny (fail closed) and make noise in the logs.
    log.error(`ADAPI unreachable while re-checking ${payload.u}`, e.message);
    return res.status(503).json({
      success: false,
      error: 'Permission service unavailable',
      details: 'Could not verify group membership (ADAPI unreachable). This is treated as an incident — try again shortly.'
    });
  }

  req.adUsername = payload.u;
  return next();
};

module.exports = { requireAuth };
