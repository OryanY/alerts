// frontend/src/theme/tokens.js
// ---------------------------------------------------------------------------
// SINGLE SOURCE OF TRUTH for every design token.
//
//   JS  → ThemeContext turns `palette[mode]` into the `colors` object that
//         components and themedStyles read.
//   CSS → ThemeContext also writes every token to a CSS custom property on
//         <html> (e.g. --color-bg-primary, --radius-md), so index.css and any
//         stylesheet read the SAME values via var(--…).
//
// Change a value here once and it propagates to JS, CSS, and every component.
// ---------------------------------------------------------------------------

export const palette = {
  light: {
    bg: {
      primary: '#F9FAFB',
      secondary: '#FFFFFF',
      tertiary: '#F3F4F6',
      elevated: '#FFFFFF',
      overlay: 'rgba(0, 0, 0, 0.5)',
    },
    text: {
      primary: '#111827',
      secondary: '#6B7280',
      tertiary: '#9CA3AF',
      inverse: '#FFFFFF',
      link: '#2563EB',
    },
    border: {
      primary: '#E5E7EB',
      secondary: '#D1D5DB',
      tertiary: '#F3F4F6',
      focus: '#2563EB',
    },
    brand: {
      primary: '#2563EB',
      primaryHover: '#1D4ED8',
      primaryActive: '#1E40AF',
      purple: '#8B5CF6',
      purpleDark: '#6D28D9',
      purpleLight: '#EDE9FE',
      yellow: '#FACC15',
      yellowBorder: '#EAB308',
    },
    semantic: {
      success: '#10B981', successBg: '#D1FAE5', successText: '#065F46',
      warning: '#F59E0B', warningBg: '#FEF3C7', warningText: '#92400E',
      error: '#EF4444', errorBg: '#FEE2E2', errorText: '#991B1B',
      info: '#2563EB', infoBg: '#DBEAFE', infoText: '#1E40AF',
    },
    chart: {
      primary: '#2563EB', secondary: '#8B5CF6', tertiary: '#10B981',
      quaternary: '#F59E0B', quinary: '#EF4444',
    },
    shadow: {
      sm: '0 1px 2px rgba(0,0,0,0.04)',
      md: '0 1px 3px rgba(0,0,0,0.06)',
      lg: '0 2px 8px rgba(0,0,0,0.07)',
      xl: '0 4px 14px rgba(0,0,0,0.08)',
    },
  },

  dark: {
    bg: {
      primary: '#0F141C',
      secondary: '#161D27',
      tertiary: '#212B38',
      elevated: '#161D27',
      overlay: 'rgba(0, 0, 0, 0.8)',
    },
    text: {
      primary: '#F3F5F8',
      secondary: '#9AA6B6',
      tertiary: '#6B7686',
      inverse: '#0F141C',
      link: '#7AA7F0',
    },
    border: {
      primary: '#283342',
      secondary: '#36435480',
      tertiary: '#222C39',
      focus: '#7AA7F0',
    },
    brand: {
      primary: '#5B8DEF',
      primaryHover: '#7AA7F0',
      primaryActive: '#9CC0F7',
      purple: '#A78BFA',
      purpleDark: '#7C3AED',
      purpleLight: '#4C1D95',
      yellow: '#FBBF24',
      yellowBorder: '#F59E0B',
    },
    semantic: {
      success: '#34D399', successBg: '#064E3B', successText: '#A7F3D0',
      warning: '#FBBF24', warningBg: '#78350F', warningText: '#FDE68A',
      error: '#F87171', errorBg: '#7F1D1D', errorText: '#FECACA',
      info: '#5B8DEF', infoBg: '#1E3A8A', infoText: '#BFDBFE',
    },
    chart: {
      primary: '#5B8DEF', secondary: '#A78BFA', tertiary: '#34D399',
      quaternary: '#FBBF24', quinary: '#F87171',
    },
    shadow: {
      sm: '0 1px 2px rgba(0,0,0,0.2)',
      md: '0 1px 3px rgba(0,0,0,0.3)',
      lg: '0 2px 8px rgba(0,0,0,0.35)',
      xl: '0 4px 14px rgba(0,0,0,0.4)',
    },
  },
};

// Mode-independent scales.
export const scale = {
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  radius: { sm: 4, md: 6, lg: 8, pill: 999 },
  font: { xs: 11, sm: 12, md: 13, base: 14, lg: 16, xl: 20, xxl: 24 },
  weight: { regular: 400, medium: 500 },
};
