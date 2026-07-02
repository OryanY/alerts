// routes/authRoutes.js — login endpoint for the destructive-action gate.
// POST /api/auth/login { username, password } sets two cookies and returns
// { username, expires_at }. The signed session token is httpOnly (never
// readable by page JS); a separate, non-httpOnly csrf cookie is mirrored so
// the frontend can read it and echo it back as X-CSRF-Token on gated
// requests (double-submit pattern — see middleware/adAuth.js). The password
// is used for one LDAP bind and never stored or logged.
const express = require('express');
const Joi = require('joi');
const { validateBody } = require('../middleware/validation');
const AuthService = require('../services/auth/AuthService');
const { logger } = require('../utils/logger');

const log = logger.tagged('auth');
const router = express.Router();

const AUTH_COOKIE = 'auth_token';
const CSRF_COOKIE = 'csrf_token';

const loginSchema = Joi.object({
  username: Joi.string().trim().max(100).required(),
  password: Joi.string().max(200).required()
});

// sameSite:'strict'/'lax' cookies are only sent by the browser on same-site
// requests (same registrable domain, port ignored) — fine when the UI and API
// share a domain behind different ports. If they're deployed on genuinely
// different domains, set AUTH_COOKIE_SAMESITE=none (which additionally
// requires Secure, i.e. HTTPS — set AUTH_COOKIE_SECURE=true if TLS is
// terminated by a reverse proxy in front of this service).
const SAMESITE = process.env.AUTH_COOKIE_SAMESITE || 'lax';
const FORCE_SECURE = process.env.AUTH_COOKIE_SECURE === 'true';
if (SAMESITE === 'none' && !FORCE_SECURE) {
  log.warn('AUTH_COOKIE_SAMESITE=none requires AUTH_COOKIE_SECURE=true (browsers reject SameSite=None without Secure) — the auth cookie will be silently dropped by the browser until this is set.');
}
const cookieOpts = (req, maxAge) => ({
  httpOnly: true,
  sameSite: SAMESITE,
  secure: FORCE_SECURE || req.secure,
  maxAge,
  path: '/',
});

// Public: lets the UI know whether the login gate is active, so it only shows
// "login required" hints when destructive actions are actually gated.
router.get('/status', (req, res) => {
  res.json({ success: true, data: { enabled: AuthService.isEnabled() } });
});

router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  if (!AuthService.isEnabled()) {
    return res.status(503).json({
      success: false,
      error: 'Login disabled',
      details: 'LDAP_URL is not configured on the server, so login is disabled and destructive actions are open.'
    });
  }

  const { username, password } = req.validatedBody;
  try {
    const result = await AuthService.login(username, password);
    const maxAge = result.ttl_ms;
    res.cookie(AUTH_COOKIE, result.token, cookieOpts(req, maxAge));
    res.cookie(CSRF_COOKIE, result.csrf, { ...cookieOpts(req, maxAge), httpOnly: false });
    return res.json({
      success: true,
      data: { username: result.username, expires_at: result.expires_at, group: result.group }
    });
  } catch (e) {
    if (e instanceof AuthService.ThrottledError) {
      return res.status(429).json({ success: false, error: 'Too many attempts', details: e.message });
    }
    if (e instanceof AuthService.BadCredentialsError) {
      return res.status(401).json({ success: false, error: 'Invalid credentials', details: e.message });
    }
    if (e instanceof AuthService.NotGroupMemberError) {
      return res.status(403).json({ success: false, error: 'Not authorized', details: e.message });
    }
    if (e instanceof AuthService.AuthUnavailableError) {
      return res.status(503).json({ success: false, error: 'Authentication service unavailable', details: e.message });
    }
    return next(e);
  }
});

router.post('/logout', (req, res) => {
  // Must match the sameSite/secure/path attributes used when the cookies
  // were set (cookieOpts above) — some browsers/proxies key cookie identity
  // on the full attribute set, not just name+path, and won't clear a cookie
  // set with SameSite=None;Secure if the clearing Set-Cookie omits them.
  const clearOpts = { sameSite: SAMESITE, secure: FORCE_SECURE || req.secure, path: '/' };
  res.clearCookie(AUTH_COOKIE, clearOpts);
  res.clearCookie(CSRF_COOKIE, clearOpts);
  res.json({ success: true });
});

module.exports = router;
