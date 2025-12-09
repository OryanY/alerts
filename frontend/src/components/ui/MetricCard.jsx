import React, { memo } from 'react';
import { TrendingUp, TrendingDown } from '../../icons';
import { useTheme } from '../../contexts/ThemeContext';
import { createThemedStyles } from '../../utils/themedStyles';

export const MetricCard = memo(function MetricCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  color = 'blue',
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

  const c = palette[color] || palette.blue;

  const textPrimary = colors.text.primary;
  const textSecondary = colors.text.secondary;
  const textMuted = colors.text.tertiary || colors.text.secondary;

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
            color: trend > 0 ? colors.semantic.success : colors.semantic.error
          }}>
            {trend > 0 ? (
              <TrendingUp size={16} />
            ) : (
              <TrendingDown size={16} />
            )}
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
