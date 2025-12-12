import { memo } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle } from '../../icons';
import { LoadingSkeleton } from './LoadingSkeleton';
import { useTheme } from '../../contexts/ThemeContext';
import { createThemedStyles } from '../../utils/themedStyles';

export const MetricCard = memo(function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  logoColor = 'blue',
  loading = false,
  error,
}) {
  const { colors } = useTheme();
  const S = createThemedStyles(colors);

  const palette = {
    blue: colors.brand?.primary || '#3B82F6',
    purple: '#8B5CF6',
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
      <div style={S.card({ border: '1px solid #FCA5A5' })}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: '#991B1B',
        }}>
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
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 12,
        }}>
          <LoadingSkeleton width={48} height={48} style={{ borderRadius: 8 }} />
          <LoadingSkeleton width={40} height={16} />
          <LoadingSkeleton width={80} height={28} />
          <LoadingSkeleton width={120} height={14} />
        </div>
      </div>
    );
  }

  /* ---------- NORMAL STATE ---------- */
  return (
    <div style={S.card()}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: 12
      }}>

        {/* Icon */}
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          background: `${c}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Icon size={24} style={{ color: c }} />
        </div>

        {/* Trend */}
        {typeof trend === 'number' && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            color: trend > 0
              ? colors.semantic.success
              : colors.semantic.error
          }}>
            {trend > 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            <span style={{ fontSize: 12, fontWeight: 500 }}>
              {Math.abs(trend)}%
            </span>
          </div>
        )}

        {/* Value */}
        <h3 style={{
          fontSize: 28,
          fontWeight: 700,
          margin: 0,
          color: textPrimary
        }}>
          {value}
        </h3>

        {/* Title */}
        <p style={{
          fontSize: 14,
          fontWeight: 600,
          color: textPrimary,
          margin: 0,
          lineHeight: 1.3
        }}>
          {title}
        </p>

        {/* Subtitle */}
        {subtitle && (
          <p style={{
            fontSize: 12,
            color: textSecondary,
            margin: 0,
            lineHeight: 1.4,
            maxWidth: '90%'
          }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
});
