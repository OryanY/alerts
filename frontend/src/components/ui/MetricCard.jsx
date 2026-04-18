import { memo } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle } from '../../icons';
import { useTheme } from '../../contexts/ThemeContext';
import Tooltip from './Tooltip';

const ACCENT_MAP = {
  blue: null,  // → brand.primary
  cyan: null,
  purple: '#8B5CF6',
  red: null,  // → semantic.error
  green: null,  // → semantic.success
  orange: null,  // → semantic.warning
  yellow: '#EAB308',
};

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
}) {
  const { colors } = useTheme();

  const resolvedAccent =
    logoColor === 'purple' ? '#8B5CF6'
      : logoColor === 'yellow' ? '#EAB308'
        : logoColor === 'red' ? colors.semantic.error
          : logoColor === 'green' ? colors.semantic.success
            : logoColor === 'orange' ? colors.semantic.warning
              : colors.brand.primary;

  /* ── ERROR ── */
  if (error) {
    return (
      <div style={{
        background: colors.bg.card || colors.bg.secondary,
        border: `1px solid ${colors.semantic.error}40`,
        borderLeft: `3px solid ${colors.semantic.error}`,
        borderRadius: 12,
        padding: '18px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: colors.semantic.error, fontSize: 13 }}>
          <AlertTriangle size={14} />
          <span style={{ fontWeight: 600 }}>Error loading metric</span>
        </div>
      </div>
    );
  }

  /* ── LOADING ── */
  if (loading) {
    return (
      <div style={{
        background: colors.bg.card || colors.bg.secondary,
        border: `1px solid ${colors.border.primary}`,
        borderLeft: `3px solid ${colors.border.secondary}`,
        borderRadius: 12,
        padding: '18px 20px',
        overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="skeleton" style={{ height: 11, width: '55%', borderRadius: 4 }} />
          <div className="skeleton" style={{ height: 28, width: '70%', borderRadius: 4 }} />
          <div className="skeleton" style={{ height: 10, width: '40%', borderRadius: 4 }} />
        </div>
      </div>
    );
  }

  const isTrendGood = typeof trend === 'number' &&
    ((trend > 0 && !invertTrend) || (trend < 0 && invertTrend));
  const trendColor = typeof trend === 'number'
    ? (isTrendGood ? colors.semantic.success : colors.semantic.error)
    : null;

  /* ── NORMAL ── */
  return (
    <div
      style={{
        background: colors.bg.card || colors.bg.secondary,
        border: `1px solid ${colors.border.primary}`,
        borderLeft: `3px solid ${resolvedAccent}`,
        borderRadius: 12,
        padding: '18px 20px',
        boxShadow: colors.shadow.sm,
        position: 'relative',
        overflow: 'hidden',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
      }}
      onClick={onClick}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = colors.shadow.md;
        e.currentTarget.style.borderTopColor = colors.border.secondary;
        e.currentTarget.style.borderRightColor = colors.border.secondary;
        e.currentTarget.style.borderBottomColor = colors.border.secondary;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = '';
        e.currentTarget.style.boxShadow = colors.shadow.sm;
        e.currentTarget.style.borderTopColor = colors.border.primary;
        e.currentTarget.style.borderRightColor = colors.border.primary;
        e.currentTarget.style.borderBottomColor = colors.border.primary;
      }}
      title={onClick ? 'לחץ לצפייה בהתראות (Drilldown)' : undefined}
    >
      {/* Subtle radial glow in top-right corner — decorative */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 80, height: 80,
        background: `radial-gradient(circle at top right, ${resolvedAccent}12, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {Icon && (
        <div style={{
          position: 'absolute',
          top: 14,
          right: 16,
          width: 32,
          height: 32,
          borderRadius: 8,
          background: `${resolvedAccent}18`,
          border: `1px solid ${resolvedAccent}28`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none', // card hover handles interaction
        }}>
          <Icon size={16} style={{ color: resolvedAccent }} />
        </div>
      )}

      {/* Title — tooltip lives here (in-flow, safe to wrap) */}
      <Tooltip content={tooltip}>
        <p style={{
          fontSize: 11,
          fontWeight: 600,
          color: colors.text.secondary,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          margin: '0 0 8px 0',
          /* leave room on the right so title doesn't overlap the icon */
          paddingRight: Icon ? 42 : 0,
          cursor: tooltip ? 'help' : 'default',
        }}>
          {title}
        </p>
      </Tooltip>

      {/* Value */}
      <h3 style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 26,
        fontWeight: 700,
        color: colors.text.primary,
        margin: '5px 0 4px 0',
        lineHeight: 1,
      }}>
        {value}
      </h3>

      {/* Subtitle */}
      {subtitle && (
        <p style={{
          fontSize: 11,
          color: colors.text.tertiary || colors.text.secondary,
          margin: '4px 0 0 0',
          lineHeight: 1.4,
        }}>
          {subtitle}
        </p>
      )}

      {/*
        Trend badge — also in normal flow (block below value).
        Wrapping in Tooltip is safe because it's a block/inline element, not absolutely positioned.
      */}
      {typeof trend === 'number' && (
        <Tooltip content={trendTooltip}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            marginTop: 8,
            padding: '2px 8px',
            borderRadius: 6,
            background: `${trendColor}15`,
            border: `1px solid ${trendColor}35`,
            color: trendColor,
            fontSize: 11,
            fontWeight: 600,
            cursor: trendTooltip ? 'help' : 'default',
          }}>
            {trend > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(trend)}%
          </div>
        </Tooltip>
      )}
    </div>
  );
});
