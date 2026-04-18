import { AlertTriangle } from '../../icons';
import { useTheme } from '../../contexts/ThemeContext';

export const ChartCard = ({ title, icon: Icon, loading, error, children, height = 300, legend, action }) => {
  const { colors } = useTheme();

  if (error) {
    return (
      <div style={{
        background: colors.bg.card,
        border: `1px solid ${colors.semantic.error}40`,
        borderRadius: 12,
        padding: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.semantic.error, marginBottom: 6, fontSize: 13 }}>
          <AlertTriangle size={14} />
          <span style={{ fontWeight: 600 }}>Error loading data</span>
        </div>
        {error.message && (
          <p style={{ fontSize: 12, color: colors.text.secondary, margin: 0 }}>{error.message}</p>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        background: colors.bg.card,
        border: `1px solid ${colors.border.primary}`,
        borderRadius: 12,
        padding: 20,
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <div className="skeleton" style={{ width: 6, height: 6, borderRadius: '50%' }} />
          <div className="skeleton" style={{ height: 14, width: 140, borderRadius: 4 }} />
        </div>
        <div className="skeleton" style={{ width: '100%', height, borderRadius: 8 }} />
      </div>
    );
  }

  return (
    <div style={{
      background: colors.bg.card,
      border: `1px solid ${colors.border.primary}`,
      borderRadius: 12,
      padding: 20,
      boxShadow: colors.shadow.sm,
      overflow: 'hidden',
      transition: 'border-color 0.2s ease',
    }}
    onMouseEnter={e => e.currentTarget.style.borderColor = colors.border.secondary}
    onMouseLeave={e => e.currentTarget.style.borderColor = colors.border.primary}
    >
      {/* Card header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
        paddingBottom: 12,
        borderBottom: `1px solid ${colors.border.primary}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Cyan dot accent */}
          <div style={{
            width: 6, height: 6,
            borderRadius: '50%',
            background: colors.brand.cyan,
            boxShadow: `0 0 6px ${colors.brand.cyan}`,
            flexShrink: 0,
          }} />
          <h3 style={{
            fontSize: 13,
            fontWeight: 600,
            color: colors.text.primary,
            margin: 0,
            letterSpacing: '0.2px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            {Icon && <Icon size={14} style={{ color: colors.text.secondary }} />}
            {title}
          </h3>
        </div>
        {/* Optional header action (button, badge etc.) */}
        {action && <div>{action}</div>}
        {/* Legend */}
        {legend && <div>{legend}</div>}
      </div>

      <div style={{ width: '100%', height }}>
        {children}
      </div>
    </div>
  );
};