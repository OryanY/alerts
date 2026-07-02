import { useTheme } from '../../contexts/ThemeContext';

export const LoadingSpinner = ({ size = 40 }) => {
  const { colors } = useTheme();
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40
    }}>
      <div style={{
        width: size,
        height: size,
        border: `3px solid ${colors.bg.tertiary}`,
        borderTop: `3px solid ${colors.brand.primary}`,
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }} />
    </div>
  );
};