// frontend/src/contexts/ThemeContext.jsx
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { withAlpha } from '../utils/formatters';
import { createThemedStyles } from '../utils/themedStyles';

const ThemeContext = createContext();

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

const baseThemes = {
  light: {
    bg: {
      primary:   '#F9FAFB',
      secondary: '#FFFFFF',
      tertiary:  '#F3F4F6',
      card:      '#FFFFFF',
      glass:     'rgba(255,255,255,0.90)',
      elevated:  '#FFFFFF',
      overlay:   'rgba(0,0,0,0.5)',
    },
    text: {
      primary:   '#111827',
      secondary: '#6B7280',
      tertiary:  '#9CA3AF',
      inverse:   '#FFFFFF',
      link:      '#3B82F6',
    },
    border: {
      primary:   '#E5E7EB',
      secondary: '#D1D5DB',
      tertiary:  '#F3F4F6',
      focus:     '#3B82F6',
    },
    brand: {
      primary:      '#3B82F6',
      primaryHover: '#2563EB',
      primaryActive:'#1D4ED8',
      cyan:         '#3B82F6',
      purple:       '#8B5CF6',
      purpleDark:   '#6D28D9',
      purpleLight:  '#EDE9FE',
      yellow:       '#FACC15',
      yellowBorder: '#EAB308',
    },
    semantic: {
      success:     '#10B981',
      successBg:   '#D1FAE5',
      successText: '#065F46',
      warning:     '#F59E0B',
      warningBg:   '#FEF3C7',
      warningText: '#92400E',
      error:       '#EF4444',
      errorBg:     '#FEE2E2',
      errorText:   '#991B1B',
      info:        '#3B82F6',
      infoBg:      '#DBEAFE',
      infoText:    '#1E40AF',
    },
    chart: {
      primary:   '#3B82F6',
      secondary: '#8B5CF6',
      tertiary:  '#10B981',
      quaternary:'#F59E0B',
      quinary:   '#EF4444',
    },
    shadow: {
      sm: '0 1px 2px rgba(0,0,0,0.05)',
      md: '0 4px 6px rgba(0,0,0,0.1)',
      lg: '0 10px 15px rgba(0,0,0,0.1)',
      xl: '0 20px 25px rgba(0,0,0,0.1)',
    },
    glow: {
      cyan:   '0 0 12px rgba(59,130,246,0.20)',
      purple: '0 0 12px rgba(139,92,246,0.20)',
      green:  '0 0 12px rgba(16,185,129,0.20)',
      red:    '0 0 12px rgba(239,68,68,0.20)',
    },
  },

  dark: {
    bg: {
      primary:   '#111827',
      secondary: '#1F2937',
      tertiary:  '#374151',
      card:      '#1F2937',
      glass:     'rgba(31,41,55,0.85)',
      elevated:  '#1F2937',
      overlay:   'rgba(0,0,0,0.8)',
    },
    text: {
      primary:   '#F9FAFB',
      secondary: '#D1D5DB',
      tertiary:  '#9CA3AF',
      inverse:   '#111827',
      link:      '#60A5FA',
    },
    border: {
      primary:   '#374151',
      secondary: '#4B5563',
      tertiary:  '#1F2937',
      focus:     '#60A5FA',
    },
    brand: {
      primary:      '#3B82F6',
      primaryHover: '#60A5FA',
      primaryActive:'#93C5FD',
      cyan:         '#60A5FA',
      purple:       '#A78BFA',
      purpleDark:   '#7C3AED',
      purpleLight:  '#4C1D95',
      yellow:       '#FBBF24',
      yellowBorder: '#F59E0B',
    },
    semantic: {
      success:     '#34D399',
      successBg:   '#064E3B',
      successText: '#A7F3D0',
      warning:     '#FBBF24',
      warningBg:   '#78350F',
      warningText: '#FDE68A',
      error:       '#F87171',
      errorBg:     '#7F1D1D',
      errorText:   '#FECACA',
      info:        '#60A5FA',
      infoBg:      '#1E3A8A',
      infoText:    '#BFDBFE',
    },
    chart: {
      primary:   '#1c5aa6',
      secondary: '#A78BFA',
      tertiary:  '#139346',
      quaternary:'#FBBF24',
      quinary:   '#962121',
    },
    shadow: {
      sm: '0 1px 2px rgba(0,0,0,0.3)',
      md: '0 4px 6px rgba(0,0,0,0.4)',
      lg: '0 10px 15px rgba(0,0,0,0.5)',
      xl: '0 20px 25px rgba(0,0,0,0.6)',
    },
    glow: {
      cyan:   '0 0 12px rgba(96,165,250,0.20)',
      purple: '0 0 12px rgba(167,139,250,0.20)',
      green:  '0 0 12px rgba(52,211,153,0.20)',
      red:    '0 0 12px rgba(248,113,113,0.20)',
    },
  },
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('theme') || 'light'; } catch { return 'light'; }
  });

  useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
      document.documentElement.setAttribute('data-theme', theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  const computed = useMemo(() => {
    const base = baseThemes[theme];

    const gradients = {
      infoGradient:        `linear-gradient(135deg, ${base.semantic.infoBg} 0%, ${withAlpha(base.semantic.info, '10')} 100%)`,
      warningGradient:     `linear-gradient(135deg, ${base.semantic.warningBg} 0%, ${withAlpha(base.semantic.warning, '10')} 100%)`,
      successGradient:     `linear-gradient(135deg, ${base.semantic.successBg} 0%, ${withAlpha(base.semantic.success, '10')} 100%)`,
      errorGradient:       `linear-gradient(135deg, ${base.semantic.errorBg} 0%, ${withAlpha(base.semantic.error, '10')} 100%)`,
      neutralSoftGradient: `linear-gradient(135deg, ${base.bg.secondary} 0%, ${base.bg.tertiary} 100%)`,
      headerBarGradient:   `linear-gradient(90deg, ${base.brand.primary}, ${base.brand.purple}, ${base.semantic.info})`,
      cardGradient:        `linear-gradient(135deg, ${base.bg.card} 0%, ${base.bg.secondary} 100%)`,
    };

    const PATTERN_COLORS = {
      exact:    { main: base.brand.primary, softBg: withAlpha(base.brand.primary, '15'), strongBg: withAlpha(base.brand.primary, '25'), border: base.brand.primary },
      contains: { main: base.brand.purple,  softBg: withAlpha(base.brand.purple,  '15'), strongBg: withAlpha(base.brand.purple,  '25'), border: base.brand.purple },
      regex:    { main: base.brand.yellow,  softBg: withAlpha(base.brand.yellow,  '15'), strongBg: withAlpha(base.brand.yellow,  '25'), border: base.brand.yellowBorder || base.brand.yellow },
    };

    const styles = createThemedStyles(base);
    return { colors: base, gradients, PATTERN_COLORS, styles };
  }, [theme]);

  const value = {
    theme,
    setTheme,
    toggleTheme,
    colors:         computed.colors,
    gradients:      computed.gradients,
    PATTERN_COLORS: computed.PATTERN_COLORS,
    styles:         computed.styles,
    isDark:         theme === 'dark',
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};