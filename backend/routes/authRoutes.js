// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/AuthController');
const { optionalAuth } = require('../middleware/auth');

/**
 * @route GET /api/auth/me
 * @desc Get current user information
 * @access Public (returns Guest if not authenticated)
 */
// Use optionalAuth to try and get user creds, but don't block if missing
router.get('/me', optionalAuth, AuthController.getCurrentUser);

module.exports = router;
