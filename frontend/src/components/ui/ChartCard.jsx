import { AlertTriangle } from '../../icons';
import { LoadingSkeleton } from './LoadingSkeleton';
import { useTheme } from '../../contexts/ThemeContext';
import { createThemedStyles } from '../../utils/themedStyles';

export const ChartCard = ({ title, icon: Icon, loading, error, children, height = 300, legend }) => {

  const { colors } = useTheme();
  const S = createThemedStyles(colors);
  if (error) {
    return (
      <div style={S.card({ border: '1px solid #FCA5A5' })}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: '#991B1B',
          marginBottom: 8
        }}>
          <AlertTriangle size={16} />
          <span style={{ fontWeight: 600 }}>Error loading data</span>
        </div>
        <p style={{ color: '#B91C1C', fontSize: 13 }}>
          {error.message}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={S.card()}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16
        }}>
          <LoadingSkeleton width={24} height={24} />
          <LoadingSkeleton width={120} height={20} />
        </div>
        <LoadingSkeleton width="100%" height={height} style={{ borderRadius: 8 }} />
      </div>
    );
  }

  return (
    <div style={S.card()}>
      <h3 style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontSize: 16,
        fontWeight: 600,
        margin: '0 0 12px 0'
      }}>
        {Icon && <Icon size={16} />} {title}
      </h3>
      {legend && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          {legend}
        </div>
      )}
      <div style={{ width: '100%', height }}>
        {children}
      </div>
    </div>
  );
};