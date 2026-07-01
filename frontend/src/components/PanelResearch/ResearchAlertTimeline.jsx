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
    const times = alerts
      .map((a) => ({ a, t: new Date(a.time_fired).getTime() }))
      .filter((p) => Number.isFinite(p.t));

    // Fit the axis to the span of the shown alerts so the 100 dots spread across
    // the full width. (Pinning to a wide selected range crams them into a corner.)
    const ts = times.map((p) => p.t);
    let start = ts.length ? Math.min(...ts) : Date.now();
    let end = ts.length ? Math.max(...ts) : Date.now();
    if (end === start) { start -= 3600000; end += 3600000; }
    const span = end - start || 1;

    const PAD = 3; // % inset so edge dots aren't clipped by the card
    const pts = times
      .map(({ a, t }) => ({ a, left: PAD + ((t - start) / span) * (100 - 2 * PAD) }))
      // Draw bigger storms last so they sit on top of the noise.
      .sort((x, y) => (x.a.cluster_count || 1) - (y.a.cluster_count || 1));

    const tk = [];
    for (let i = 0; i <= 4; i++) {
      const d = new Date(start + (span * i) / 4);
      tk.push(d.toLocaleDateString('en-IL', { day: 'numeric', month: 'short' }));
    }
    return { points: pts, ticks: tk };
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
                  borderRadius: '50%', background: colorByDuration(a.duration_sec),
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
