// middleware/adAuth.js
// ---------------------------------------------------------------------------
// Gate for DESTRUCTIVE actions (deletes + rule toggle): verifies the signed
// login token issued by POST /api/auth/login (LDAP bind + ADAPI group check),
// then re-checks group membership through the cached ADAPI lookup so a user
// removed from the group loses access within minutes, not at token expiry.
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

  const header = req.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  const payload = AuthService.verifyToken(token);
  if (!payload) {
    return res.status(401).json({
      success: false,
      error: 'Login required',
      details: 'This action requires a valid login (Settings → user login). Your session may have expired.'
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
