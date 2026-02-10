import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE } from '../utils/constants';

// Create the context
const AuthContext = createContext(null);

/**
 * AuthProvider Component
 * Wrap your app with this to provide user state globally
 */
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch user on mount
    useEffect(() => {
        const checkAuth = async () => {
            try {
                setLoading(true);
                // credentials: 'include' is needed for Windows Auth cookies
                const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });

                if (!res.ok) throw new Error('Failed to check authentication');

                const json = await res.json();

                if (json.success) {
                    setUser(json.data);
                } else {
                    // Fallback to guest if API returns success: false
                    setUser({
                        name: 'Guest',
                        fullName: 'Guest User',
                        isAuthenticated: false,
                        groups: []
                    });
                }
            } catch (err) {
                console.error('Auth Check Failed:', err);
                setError(err.message);
                // Fallback to guest on error
                setUser({
                    name: 'Guest',
                    fullName: 'Guest User',
                    isAuthenticated: false,
                    groups: []
                });
            } finally {
                setLoading(false);
            }
        };

        checkAuth();
    }, []);

    // Value exposed to consumers
    const value = {
        user,
        loading,
        error,
        isAuthenticated: user?.isAuthenticated || false,
        isAdmin: user?.isAdmin || false
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

/**
 * Custom hook to use the auth context
 * Usage: const { user, loading, isAdmin } = useUser();
 */
export const useUser = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useUser must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
