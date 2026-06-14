// frontend/src/contexts/ThemeContext.jsx
import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { withAlpha } from '../utils/formatters';
import { createThemedStyles } from '../utils/themedStyles';
import { palette, scale } from '../theme/tokens';

const ThemeContext = createContext();

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

// Mirror every token onto <html> as a CSS custom property, so stylesheets read
// the exact same values the JS does (e.g. --color-bg-primary, --radius-md).
const applyCssVariables = (mode) => {
  const root = document.documentElement;
  const base = palette[mode];
  for (const group of Object.keys(base)) {
    const entries = base[group];
    for (const key of Object.keys(entries)) {
      root.style.setProperty(`--color-${group}-${key}`, entries[key]);
    }
  }
  for (const [k, v] of Object.entries(scale.radius)) root.style.setProperty(`--radius-${k}`, `${v}px`);
  for (const [k, v] of Object.entries(scale.space)) root.style.setProperty(`--space-${k}`, `${v}px`);
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('theme') || 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
    } catch { }
    document.documentElement.setAttribute('data-theme', theme);
    applyCssVariables(theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  const computed = useMemo(() => {
    const base = palette[theme];

    // Flat: kept as keys for backward compatibility, each resolves to one solid color.
    const gradients = {
      infoGradient: base.semantic.infoBg,
      warningGradient: base.semantic.warningBg,
      successGradient: base.semantic.successBg,
      errorGradient: base.semantic.errorBg,
      neutralSoftGradient: base.bg.tertiary,
      headerBarGradient: base.border.primary,
    };

    const PATTERN_COLORS = {
      exact: {
        main: base.brand.primary,
        softBg: withAlpha(base.brand.primary, '15'),
        strongBg: withAlpha(base.brand.primary, '25'),
        border: base.brand.primary,
      },
      contains: {
        main: base.brand.purple,
        softBg: withAlpha(base.brand.purple, '15'),
        strongBg: withAlpha(base.brand.purple, '25'),
        border: base.brand.purple,
      },
      regex: {
        main: base.brand.yellow,
        softBg: withAlpha(base.brand.yellow, '15'),
        strongBg: withAlpha(base.brand.yellow, '25'),
        border: base.brand.yellowBorder || base.brand.yellow,
      },
    };

    return {
      colors: base,
      gradients,
      PATTERN_COLORS,
      styles: createThemedStyles(base),
    };
  }, [theme]);

  const value = {
    theme,
    setTheme,
    toggleTheme,
    scale,
    colors: computed.colors,
    gradients: computed.gradients,
    PATTERN_COLORS: computed.PATTERN_COLORS,
    styles: computed.styles,
    isDark: theme === 'dark',
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export default ThemeContext;
