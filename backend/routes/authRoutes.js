// routes/authRoutes.js — login endpoint for the destructive-action gate.
// POST /api/auth/login { username, password } → { token, username, expires_at }.
// The password is used for one LDAP bind and never stored or logged.
const express = require('express');
const Joi = require('joi');
const { validateBody } = require('../middleware/validation');
const AuthService = require('../services/auth/AuthService');

const router = express.Router();

const loginSchema = Joi.object({
  username: Joi.string().trim().max(100).required(),
  password: Joi.string().max(200).required()
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
    return res.json({ success: true, data: result });
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

module.exports = router;
