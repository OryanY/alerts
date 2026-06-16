import { useTheme } from '../../contexts/ThemeContext';

export const LoadingSkeleton = ({ width = '100%', height = 20, style }) => {
  const { colors, isDark } = useTheme();

  return (
    <div
      style={{
        backgroundColor: isDark ? colors.bg.tertiary : '#E2E8F0',
        height,
        width,
        borderRadius: 4,
        animation: 'pulse 1.8s ease-in-out infinite',
        ...style
      }}
    />
  );
};