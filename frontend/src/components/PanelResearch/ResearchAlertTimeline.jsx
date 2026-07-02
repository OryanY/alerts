import { useMemo, useState } from 'react';
import { formatDuration } from '../../utils/formatters';

const DOT_MIN = 8;
const DOT_MAX = 22;

// Storm size (cluster_count) → dot diameter. In unclustered mode every count is
// 1, so all dots are DOT_MIN.
const dotSize = (count) => Math.min(DOT_MAX, DOT_MIN + Math.max(0, (count || 1) - 1) * 1.5);

// Recent alerts plotted on a single time axis: X = when it fired, color = duration
// band, dot size = storm size. Reveals bursts, gaps and severity at a glance;
// hover a dot for the details a scatter can't show inline.
const ResearchAlertTimeline = ({ alerts = [], colorByDuration, bands = [], colors }) => {
  const [hover, setHover] = useState(null); // { left, alert }

  const { points, ticks } = useMemo(() => {
    const PAD = 3; // % inset so edge dots aren't clipped by the card
    const spread = (frac) => PAD + Math.max(0, Math.min(1, frac)) * (100 - 2 * PAD);
    const bySize = (x, y) => (x.a.cluster_count || 1) - (y.a.cluster_count || 1);

    // Tolerant parse: backend sends "YYYY-MM-DDTHH:mm:ss.SSS", but some engines
    // choke on a space separator or a trailing zone — normalize before Date.
    const parseTime = (v) => {
      if (!v) return NaN;
      const s = String(v).trim();
      let ms = new Date(s).getTime();
      if (Number.isNaN(ms)) ms = new Date(s.replace(' ', 'T')).getTime();
      return ms;
    };

    const valid = alerts
      .map((a) => ({ a, t: parseTime(a.time_fired) }))
      .filter((p) => Number.isFinite(p.t));

    // Real time axis when we have a usable range.
    if (valid.length >= 2) {
      const ts = valid.map((p) => p.t);
      let start = Math.min(...ts);
      let end = Math.max(...ts);
      if (end === start) { start -= 3600000; end += 3600000; }
      const span = end - start;

      const pts = valid.map(({ a, t }) => ({ a, left: spread((t - start) / span) })).sort(bySize);

      // Adaptive labels: include the time when the whole span is within a few
      // days, otherwise the 5 date labels would all read the same.
      const spanDays = span / 86400000;
      const fmt = spanDays > 3
        ? (ms) => new Date(ms).toLocaleDateString('en-IL', { day: 'numeric', month: 'short' })
        : (ms) => new Date(ms).toLocaleString('en-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const tk = [];
      for (let i = 0; i <= 4; i++) tk.push(fmt(start + (span * i) / 4));
      return { points: pts, ticks: tk };
    }

    // Fallback: timestamps unusable — space dots by recency so they never vanish.
    // alerts arrive newest-first, so map the newest to the right.
    const n = alerts.length;
    const pts = alerts
      .map((a, i) => ({ a, left: spread(n > 1 ? (n - 1 - i) / (n - 1) : 0.5) }))
      .sort(bySize);
    return { points: pts, ticks: ['ישן יותר', '', '', '', 'עדכני'] };
  }, [alerts]);

  const tipLeft = hover ? Math.min(88, Math.max(12, hover.left)) : 0;

  return (
    <div style={{ border: `1px solid ${colors.border.primary}`, borderRadius: 8, background: colors.bg.secondary, padding: 16 }}>
      <div style={{ position: 'relative' }}>
        {/* Hover tooltip */}
        {hover && (
          <div
            style={{
              position: 'absolute', left: `${tipLeft}%`, top: 0, transform: 'translate(-50%, calc(-100% - 8px))',
              background: colors.bg.tertiary, border: `1px solid ${colors.border.primary}`, borderRadius: 8,
              padding: '8px 10px', fontSize: 12, color: colors.text.primary, whiteSpace: 'nowrap', zIndex: 5,
              pointerEvents: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              {hover.alert.message}
              {hover.alert.cluster_count > 1 && (
                <span style={{ color: colors.text.tertiary, fontWeight: 400 }}> · ×{hover.alert.cluster_count}</span>
              )}
            </div>
            <div style={{ color: colors.text.secondary }}>
              {String(hover.alert.time_fired || '').slice(0, 10)} {String(hover.alert.time_fired || '').slice(11, 16)}
              {' · '}{hover.alert.node_name}
              {' · '}{formatDuration(hover.alert.duration_sec)}
            </div>
          </div>
        )}

        {/* Axis + dots */}
        <div style={{ position: 'relative', height: 64 }}>
          <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 1, background: colors.border.secondary }} />
          {points.map(({ a, left }, i) => {
            const size = dotSize(a.cluster_count);
            return (
              <span
                key={a.id ?? i}
                role="img"
                aria-label={`${a.message}, ${formatDuration(a.duration_sec)}${a.cluster_count > 1 ? `, ${a.cluster_count} alerts` : ''}`}
                onMouseEnter={() => setHover({ left, alert: a })}
                onMouseLeave={() => setHover(null)}
                style={{
                  position: 'absolute', left: `${left}%`, top: '50%',
                  width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2,
                  borderRadius: '50%', background: colorByDuration(Number(a.duration_sec)),
                  border: `1px solid ${colors.bg.secondary}`, cursor: 'pointer',
                  opacity: hover && hover.alert !== a ? 0.55 : 0.9,
                }}
              />
            );
          })}
        </div>

        {/* Date axis ticks */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: colors.text.muted || colors.text.tertiary, marginTop: 4 }}>
          {ticks.map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 12, fontSize: 11, color: colors.text.secondary, flexWrap: 'wrap' }}>
        {bands.map((b) => (
          <span key={b.key || b.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.color }} />
            {String(b.label).trim()}
          </span>
        ))}
        <span style={{ color: colors.text.tertiary }}>· dot size = storm size (×N)</span>
      </div>
    </div>
  );
};

export default ResearchAlertTimeline;
