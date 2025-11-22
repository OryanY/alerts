// frontend/src/components/ThemeToggle.jsx
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export const ThemeToggle = ({ variant = 'default' }) => {
  const { theme, toggleTheme, colors } = useTheme();
  const isDark = theme === 'dark';

  const variants = {
    // Default: Icon button
    default: {
      button: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40,
        border: `1px solid ${colors.border.primary}`,
        borderRadius: 8,
        background: colors.bg.secondary,
        color: colors.text.primary,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
      icon: 20,
    },
    // Compact: Smaller button
    compact: {
      button: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        border: `1px solid ${colors.border.primary}`,
        borderRadius: 6,
        background: colors.bg.secondary,
        color: colors.text.primary,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      },
      icon: 16,
    },
    // Switch: iOS-style toggle
    switch: {
      button: {
        position: 'relative',
        width: 56,
        height: 28,
        border: 'none',
        borderRadius: 14,
        background: isDark ? colors.brand.primary : colors.bg.tertiary,
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        padding: 0,
      },
      icon: 14,
    },
  };

  const currentVariant = variants[variant];

  const handleClick = () => {
    toggleTheme();
  };

  const handleMouseEnter = (e) => {
    if (variant !== 'switch') {
      e.currentTarget.style.background = colors.bg.tertiary;
      e.currentTarget.style.transform = 'scale(1.05)';
    }
  };

  const handleMouseLeave = (e) => {
    if (variant !== 'switch') {
      e.currentTarget.style.background = colors.bg.secondary;
      e.currentTarget.style.transform = 'scale(1)';
    }
  };

  if (variant === 'switch') {
    return (
      <button
        onClick={handleClick}
        style={currentVariant.button}
        title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
        aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: isDark ? 30 : 2,
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: colors.bg.secondary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s ease',
            boxShadow: colors.shadow.sm,
          }}
        >
          {isDark ? (
            <Moon size={currentVariant.icon} color={colors.brand.primary} />
          ) : (
            <Sun size={currentVariant.icon} color={colors.semantic.warning} />
          )}
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={currentVariant.button}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {isDark ? (
        <Sun size={currentVariant.icon} />
      ) : (
        <Moon size={currentVariant.icon} />
      )}
    </button>
  );
};