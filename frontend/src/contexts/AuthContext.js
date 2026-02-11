// contexts/AuthContext.js — Enhanced Global Authentication State Management
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE } from '../utils/constants';

const AuthContext = createContext(null);

/**
 * AuthProvider Component
 * Enhanced with:
 * - Page Visibility API (pauses polling when tab inactive)
 * - Manual refetch capability
 * - Better error handling
 * - Initial load tracking
 */
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Track if this is the first load vs. background polling
    const isInitialLoad = useRef(true);
    const isMounted = useRef(true);

    /**
     * Core auth check function - memoized so it can be called externally
     */
    const checkAuth = useCallback(async (options = {}) => {
        const { showLoading = false } = options;

        try {
            // Only show loading spinner on initial load or manual refetch
            if (showLoading && isMounted.current) setLoading(true);

            const res = await fetch(`${API_BASE}/auth/me`, {
                credentials: 'include',
                // Add cache control to prevent stale data
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });

            if (!res.ok) {
                // Handle specific HTTP errors
                if (res.status === 401) {
                    throw new Error('Not authenticated');
                }
                throw new Error(`Auth check failed: ${res.status}`);
            }

            const json = await res.json();

            if (!isMounted.current) return;

            if (json.success && json.data) {
                setUser(json.data);
                setError(null); // Clear any previous errors on success
            } else {
                // API returned success: false or no data
                setUser({
                    name: 'Guest',
                    fullName: 'Guest User',
                    isAuthenticated: false,
                    groups: []
                });
                setError(null);
            }
        } catch (err) {
            console.error('Auth Check Failed:', err);

            if (isMounted.current) {
                setError(err.message);

                // Fallback to guest on error
                setUser({
                    name: 'Guest',
                    fullName: 'Guest User',
                    isAuthenticated: false,
                    groups: [],
                    error: err.message
                });
            }
        } finally {
            if (isMounted.current) {
                setLoading(false);
                isInitialLoad.current = false;
            }
        }
    }, []);

    /**
     * Manual refetch function exposed to consumers
     * Useful after login, logout, or profile updates
     */
    const refetch = useCallback(() => {
        return checkAuth({ showLoading: true });
    }, [checkAuth]);

    // Initial check + Polling with Page Visibility optimization
    useEffect(() => {
        // Initial auth check
        checkAuth({ showLoading: true });

        // Polling interval (2 minutes)
        const POLL_INTERVAL = 2 * 60 * 1000;
        let intervalId;

        const startPolling = () => {
            intervalId = setInterval(() => {
                // Only poll if document is visible
                if (document.visibilityState === 'visible') {
                    checkAuth({ showLoading: false });
                }
            }, POLL_INTERVAL);
        };

        const stopPolling = () => {
            if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };

        // Start polling
        startPolling();

        // Handle visibility changes - pause/resume polling
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Tab became active - check auth immediately then resume polling
                checkAuth({ showLoading: false });
                if (!intervalId) startPolling();
            } else {
                // Tab became inactive - stop polling to save resources
                stopPolling();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Cleanup
        return () => {
            isMounted.current = false;
            stopPolling();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [checkAuth]);

    // Value exposed to consumers
    const value = {
        user,
        loading,
        error,
        isAuthenticated: user?.isAuthenticated || false,
        isAdmin: user?.isAdmin || false,
        refetch, // New: allow manual auth refresh
        clearError: () => setError(null) // New: allow manual error clearing
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

/**
 * Custom hook to use the auth context
 * Usage: const { user, loading, isAdmin, refetch } = useUser();
 */
export const useUser = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useUser must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
