import { memo } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle } from '../../icons';
import { LoadingSkeleton } from './LoadingSkeleton';
import { useTheme } from '../../contexts/ThemeContext';
import { createThemedStyles } from '../../utils/themedStyles';
import Tooltip from './Tooltip';

export const MetricCard = memo(function MetricCard({
  title,
  value,
  subtitle,
  trend,
  tooltip,
  trendTooltip,
  icon: Icon,
  logoColor = 'blue',
  loading = false,
  error,
  invertTrend = false,
  onClick,
  viz,
}) {
  const { colors } = useTheme();
  const S = createThemedStyles(colors);

  const palette = {
    blue: colors.brand?.primary || '#3B82F6',
    purple: colors.brand?.purple || '#8B5CF6',
    red: colors.semantic?.error || '#EF4444',
    green: colors.semantic?.success || '#10B981',
    orange: colors.semantic?.warning || '#F59E0B',
    yellow: '#EAB308',
  };
  const c = palette[logoColor] || palette.blue;
  const textPrimary = colors.text.primary;
  const textSecondary = colors.text.secondary;

  /* ---------- ERROR STATE ---------- */
  if (error) {
    return (
      <div style={S.card({ border: `1px solid ${colors.semantic.error}` })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.semantic.error }}>
          <AlertTriangle size={16} />
          <span style={{ fontWeight: 600 }}>Error loading metric</span>
        </div>
      </div>
    );
  }

  /* ---------- LOADING STATE ---------- */
  if (loading) {
    return (
      <div style={S.card()}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <LoadingSkeleton width={90} height={16} />
          <LoadingSkeleton width={70} height={26} />
          <LoadingSkeleton width="100%" height={34} />
        </div>
      </div>
    );
  }

  const trendPositive = (trend > 0 && !invertTrend) || (trend < 0 && invertTrend);

  /* ---------- NORMAL STATE ---------- */
  return (
    <div
      style={{ ...S.card(), cursor: onClick ? 'pointer' : 'default', transition: 'transform 0.2s ease, box-shadow 0.2s ease', display: 'flex', flexDirection: 'column', gap: 10 }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (onClick) {
          e.currentTarget.style.transform = 'none';
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
      title={onClick ? 'לחץ לצפייה בהתראות האלו בטבלה צף (Drilldown)' : undefined}
    >
      {/* Header: icon + title + optional trend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {Icon && (
          <Tooltip content={tooltip} position="bottom">
            <span style={{ width: 28, height: 28, borderRadius: 6, background: `${c}20`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: tooltip ? 'help' : 'default' }}>
              <Icon size={16} style={{ color: c }} />
            </span>
          </Tooltip>
        )}
        <span style={{ fontSize: 13, fontWeight: 600, color: textSecondary }}>{title}</span>
        {typeof trend === 'number' && (
          <Tooltip content={trendTooltip} position="bottom">
            <span style={{ marginInlineStart: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 500, color: trendPositive ? colors.semantic.success : colors.semantic.error, cursor: trendTooltip ? 'help' : 'default' }}>
              {trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {Math.abs(trend)}%
            </span>
          </Tooltip>
        )}
      </div>

      {/* Value */}
      <div style={{ fontSize: 26, fontWeight: 700, color: textPrimary, lineHeight: 1.1 }}>{value}</div>

      {/* Subtitle */}
      {subtitle && (
        <div style={{ fontSize: 12, color: textSecondary, lineHeight: 1.4 }}>{subtitle}</div>
      )}

      {/* Per-metric micro-visualization */}
      {viz && <div style={{ marginTop: 2 }}>{viz}</div>}
    </div>
  );
});
