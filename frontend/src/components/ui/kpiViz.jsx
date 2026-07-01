import { useTheme } from '../../contexts/ThemeContext';

// Small, self-contained KPI micro-visualizations. Each reads theme colors itself
// so callers just pass data. Designed to sit in a MetricCard's `viz` slot.

// Sparkline — a value-per-bucket line. Zeros render on the baseline, so a quiet
// stretch (e.g. an alert source going silent) shows as a visible dip to 0 rather
// than disappearing. Pass the zero-filled trend series.
export const Sparkline = ({ data = [], color, height = 34 }) => {
  const { colors } = useTheme();
  const stroke = color || colors.chart.primary;
  const nums = data.map((n) => (Number.isFinite(n) ? n : 0));
  if (nums.length < 2) return null;

  const W = 120;
  const H = height;
  const pad = 3;
  const max = Math.max(...nums, 1);
  const step = W / (nums.length - 1);
  const y = (v) => H - pad - (v / max) * (H - 2 * pad);
  const pts = nums.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
      <line x1="0" y1={H - pad} x2={W} y2={H - pad} stroke={colors.border.secondary} strokeWidth="1" strokeDasharray="2 3" />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

// RadialGauge — a percentage as a filled arc with the value in the centre.
export const RadialGauge = ({ value = 0, max = 100, color, size = 58, label }) => {
  const { colors } = useTheme();
  const c = color || colors.brand.primary;
  const r = 26;
  const circ = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, (value || 0) / (max || 100)));
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} style={{ flex: 'none' }}>
      <circle cx="32" cy="32" r={r} fill="none" stroke={colors.border.primary} strokeWidth="7" />
      <circle
        cx="32" cy="32" r={r} fill="none" stroke={c} strokeWidth="7" strokeLinecap="round"
        strokeDasharray={`${(frac * circ).toFixed(1)} ${circ.toFixed(1)}`}
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="37" textAnchor="middle" style={{ fill: colors.text.primary, fontSize: 15, fontWeight: 700 }}>
        {label ?? `${Math.round(value)}%`}
      </text>
    </svg>
  );
};

// CompareBars — a few labelled horizontal bars scaled to the largest, for
// comparing related quantities (avg vs median, day vs night, covered vs not).
export const CompareBars = ({ items = [] }) => {
  const { colors } = useTheme();
  const max = Math.max(...items.map((i) => i.value || 0), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
      {items.map((it, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: colors.text.tertiary, width: 52, flexShrink: 0, textAlign: 'start' }}>{it.label}</span>
          <span style={{ flex: 1, height: 6, borderRadius: 3, background: colors.bg.tertiary, overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${((it.value || 0) / max) * 100}%`, background: it.color || colors.chart.primary }} />
          </span>
        </div>
      ))}
    </div>
  );
};
