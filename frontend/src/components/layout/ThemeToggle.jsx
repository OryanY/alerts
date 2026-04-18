import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

export const ThemeToggle = ({ variant = 'default' }) => {
  const { theme, toggleTheme, colors } = useTheme();
  const isDark = theme === 'dark';

  // ── Switch (pill) variant — used in sidebar ────────
  if (variant === 'switch') {
    return (
      <button
        onClick={toggleTheme}
        title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          padding: '8px 10px',
          background: 'none',
          border: `1px solid ${colors.border.primary}`,
          borderRadius: 8,
          cursor: 'pointer',
          color: colors.text.secondary,
          fontSize: 12,
          fontWeight: 500,
          fontFamily: 'inherit',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = colors.bg.tertiary; e.currentTarget.style.color = colors.text.primary; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = colors.text.secondary; }}
      >
        {/* Pill toggle */}
        <div style={{
          position: 'relative',
          width: 40,
          height: 22,
          borderRadius: 11,
          background: isDark ? colors.brand.cyan : colors.bg.tertiary,
          border: `1px solid ${isDark ? colors.brand.cyan : colors.border.secondary}`,
          transition: 'all 0.3s ease',
          flexShrink: 0,
          boxShadow: isDark ? `0 0 8px ${colors.brand.cyan}60` : 'none',
        }}>
          <div style={{
            position: 'absolute',
            top: 2,
            left: isDark ? 20 : 2,
            width: 16, height: 16,
            borderRadius: '50%',
            background: isDark ? colors.bg.primary : '#FFFFFF',
            transition: 'left 0.3s cubic-bezier(0.4,0,0.2,1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}>
            {isDark
              ? <Moon size={9} color={colors.brand.cyan} />
              : <Sun  size={9} color="#D97706" />
            }
          </div>
        </div>
        <span>{isDark ? 'Dark' : 'Light'}</span>
      </button>
    );
  }

  // ── Default / Compact icon button ─────────────────
  const size = variant === 'compact' ? 32 : 38;
  const iconSize = variant === 'compact' ? 15 : 18;

  return (
    <button
      onClick={toggleTheme}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size,
        border: `1px solid ${colors.border.primary}`,
        borderRadius: 8,
        background: colors.bg.secondary,
        color: colors.text.secondary,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        fontFamily: 'inherit',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = colors.bg.tertiary; e.currentTarget.style.color = colors.text.primary; e.currentTarget.style.borderColor = colors.border.secondary; }}
      onMouseLeave={e => { e.currentTarget.style.background = colors.bg.secondary; e.currentTarget.style.color = colors.text.secondary; e.currentTarget.style.borderColor = colors.border.primary; }}
    >
      {isDark ? <Sun size={iconSize} /> : <Moon size={iconSize} />}
    </button>
  );
};