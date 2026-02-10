// controllers/AuthController.js
const { CONFIG } = require('../config');

class AuthController {
    /**
     * Get current user information
     * Returns user details if authenticated, or guest info if not
     */
    getCurrentUser(req, res) {
        try {
            // If user is authenticated (populated by middleware)
            if (req.user) {
                return res.json({
                    success: true,
                    data: {
                        ...req.user,
                        isAuthenticated: true,
                        // Check against centralized config
                        isAdmin: (req.user.groups || []).some(g => {
                            const group = typeof g === 'string' ? g.toLowerCase() : '';
                            return CONFIG.auth.adminGroups.some(allowed =>
                                group.includes(allowed.toLowerCase()) || group.endsWith(`\\${allowed.toLowerCase()}`)
                            );
                        }),
                        // Add helpful display name logic
                        displayName: req.user.fullName || req.user.username || 'Unknown User',
                        initials: (req.user.fullName || req.user.username || '?')
                            .split(/[\s\\]+/)
                            .map(n => n[0])
                            .join('')
                            .toUpperCase()
                            .slice(0, 2)
                    }
                });
            }

            // If not authenticated (Guest)
            return res.json({
                success: true,
                data: {
                    username: 'guest',
                    fullName: 'Guest User',
                    displayName: 'Guest',
                    initials: 'G',
                    groups: [],
                    isAuthenticated: false,
                    isDev: false
                }
            });
        } catch (error) {
            console.error('Auth Controller Error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve user information'
            });
        }
    }
}

module.exports = new AuthController();
