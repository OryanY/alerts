// frontend/src/contexts/ThemeContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

// Define your theme tokens
export const themes = {
  light: {
    // Background colors
    bg: {
      primary: '#F9FAFB',
      secondary: '#FFFFFF',
      tertiary: '#F3F4F6',
      elevated: '#FFFFFF',
      overlay: 'rgba(0, 0, 0, 0.5)',
    },
    // Text colors
    text: {
      primary: '#111827',
      secondary: '#6B7280',
      tertiary: '#9CA3AF',
      inverse: '#FFFFFF',
      link: '#3B82F6',
    },
    // Border colors
    border: {
      primary: '#E5E7EB',
      secondary: '#D1D5DB',
      focus: '#3B82F6',
    },
    // Brand colors
    brand: {
      primary: '#3B82F6',
      primaryHover: '#2563EB',
      primaryActive: '#1D4ED8',
      secondary: '#8B5CF6',
      secondaryHover: '#7C3AED',
    },
    // Semantic colors
    semantic: {
      success: '#10B981',
      successBg: '#D1FAE5',
      successText: '#065F46',
      warning: '#F59E0B',
      warningBg: '#FEF3C7',
      warningText: '#92400E',
      error: '#EF4444',
      errorBg: '#FEE2E2',
      errorText: '#991B1B',
      info: '#3B82F6',
      infoBg: '#DBEAFE',
      infoText: '#1E40AF',
    },
    // Chart colors
    chart: {
      primary: '#3B82F6',
      secondary: '#8B5CF6',
      tertiary: '#10B981',
      quaternary: '#F59E0B',
      quinary: '#EF4444',
    },
    // Shadow
    shadow: {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
    },
  },
  dark: {
    // Background colors
    bg: {
      primary: '#111827',
      secondary: '#1F2937',
      tertiary: '#374151',
      elevated: '#1F2937',
      overlay: 'rgba(0, 0, 0, 0.8)',
    },
    // Text colors
    text: {
      primary: '#F9FAFB',
      secondary: '#D1D5DB',
      tertiary: '#9CA3AF',
      inverse: '#111827',
      link: '#60A5FA',
    },
    // Border colors
    border: {
      primary: '#374151',
      secondary: '#4B5563',
      focus: '#60A5FA',
    },
    // Brand colors
    brand: {
      primary: '#3B82F6',
      primaryHover: '#60A5FA',
      primaryActive: '#93C5FD',
      secondary: '#A78BFA',
      secondaryHover: '#C4B5FD',
    },
    // Semantic colors
    semantic: {
      success: '#34D399',
      successBg: '#064E3B',
      successText: '#A7F3D0',
      warning: '#FBBF24',
      warningBg: '#78350F',
      warningText: '#FDE68A',
      error: '#F87171',
      errorBg: '#7F1D1D',
      errorText: '#FECACA',
      info: '#60A5FA',
      infoBg: '#1E3A8A',
      infoText: '#BFDBFE',
    },
    // Chart colors (brighter for dark mode)
    chart: {
      primary: '#1c5aa6ff',
      secondary: '#A78BFA',
      tertiary: '#139346ff',
      quaternary: '#FBBF24',
      quinary: '#962121ff',
    },
    // Shadow
    shadow: {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.5), 0 4px 6px -2px rgba(0, 0, 0, 0.4)',
      xl: '0 20px 25px -5px rgba(0, 0, 0, 0.6), 0 10px 10px -5px rgba(0, 0, 0, 0.5)',
    },
  },
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem('theme');
      return saved || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    } catch (e) {
      console.warn('Failed to save theme:', e);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const value = {
    theme,
    setTheme,
    toggleTheme,
    colors: themes[theme],
    isDark: theme === 'dark',
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};