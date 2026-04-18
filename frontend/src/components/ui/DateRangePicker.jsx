import { useState, useEffect, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const DAYS_HE = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']; // Sun–Sat in Hebrew
const MONTHS_HE = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'
];

const pad  = (n) => String(n).padStart(2, '0');
const toYMD = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromYMD = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const fmtHe = (s) => {
  if (!s) return '—';
  const d = fromYMD(s);
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: 'short', year: 'numeric' });
};
const sameDay  = (a, b) => a && b && toYMD(a) === toYMD(b);
const between  = (d, s, e) => s && e && d > s && d < e;

const PRESETS = [
  { label: 'היום',          days: 1 },
  { label: 'אתמול',         days: -1 },
  { label: 'שבוע אחרון',   days: 7 },
  { label: 'חודש אחרון',   days: 30 },
  { label: '90 יום',        days: 90 },
];

// ─── Mini calendar ────────────────────────────────────────────────────────────
const MiniCal = ({ year, month, startDate, endDate, hover, onDay, onHover, onNav, colors }) => {
  const accent  = colors.brand.cyan;
  const textPri = colors.text.primary;
  const textSec = colors.text.secondary;

  const firstDow   = new Date(year, month, 1).getDay();
  const daysInMo   = new Date(year, month + 1, 0).getDate();
  const cells      = [];

  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMo; d++) cells.push(new Date(year, month, d));

  const rangeEnd = hover || endDate;

  return (
    <div dir="rtl">
      {/* Month nav — RTL: next (›) on LEFT, prev (‹) on RIGHT */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        {/* Next month — visually left in RTL */}
        <button onClick={() => onNav(1)} style={navBtn(colors)}>‹</button>
        <span style={{ fontWeight: 700, fontSize: 14, color: textPri }}>
          {MONTHS_HE[month]} {year}
        </span>
        {/* Prev month — visually right in RTL */}
        <button onClick={() => onNav(-1)} style={navBtn(colors)}>›</button>
      </div>

      {/* Day names */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
        {DAYS_HE.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: textSec, padding: '4px 0', letterSpacing: '0.5px' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`e${i}`} />;
          const isStart = sameDay(day, startDate);
          const isEnd   = sameDay(day, endDate);
          const isHov   = !endDate && sameDay(day, hover);
          const inRange = between(day, startDate, rangeEnd);
          const isToday = sameDay(day, new Date());
          const isSel   = isStart || isEnd;

          const bg = isSel   ? accent
                   : isHov   ? `${accent}55`
                   : inRange ? `${accent}18`
                   : 'transparent';

          const br = isStart ? '0 8px 8px 0'    // RTL: start is on right
                   : isEnd   ? '8px 0 0 8px'    // RTL: end is on left
                   : inRange ? '0'
                   : 8;

          return (
            <button
              key={day.toISOString()}
              onClick={() => onDay(day)}
              onMouseEnter={() => onHover(day)}
              style={{
                height: 32, width: '100%',
                border: isToday && !isSel ? `1px solid ${accent}55` : 'none',
                borderRadius: br,
                background: bg,
                color: isSel ? '#080C14' : isToday ? accent : textPri,
                fontSize: 12,
                fontWeight: isSel ? 700 : isToday ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isSel ? `0 0 8px ${accent}60` : 'none',
                fontFamily: 'inherit',
              }}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const navBtn = (colors) => ({
  background: 'none',
  border: `1px solid ${colors.border.primary}`,
  borderRadius: 6,
  width: 28, height: 28,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
  color: colors.text.secondary,
  fontSize: 15,
  lineHeight: 1,
  transition: 'all 0.15s ease',
  fontFamily: 'inherit',
});

// ─── Main Component ───────────────────────────────────────────────────────────
export const DateRangePicker = ({ dateRange, onChange, setPresetRange, rightSlot }) => {
  const { colors, isDark } = useTheme();
  const [open, setOpen]         = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [tmpS, setTmpS]         = useState(null);
  const [tmpE, setTmpE]         = useState(null);
  const [hover, setHover]       = useState(null);
  const [viewMo, setViewMo]     = useState(new Date().getMonth());
  const [viewYr, setViewYr]     = useState(new Date().getFullYear());
  const [activePreset, setActiveP] = useState(null);
  const wrapRef = useRef(null);

  const accent = colors.brand.cyan;

  // Sync from props
  useEffect(() => {
    setTmpS(fromYMD(dateRange.start_date));
    setTmpE(fromYMD(dateRange.end_date));
  }, [dateRange.start_date, dateRange.end_date]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const h = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false); setSelecting(false); setHover(null);
        setTmpS(fromYMD(dateRange.start_date));
        setTmpE(fromYMD(dateRange.end_date));
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open, dateRange]);

  const handleDay = (day) => {
    if (!selecting || !tmpS) {
      setTmpS(day); setTmpE(null); setSelecting(true); setActiveP(null);
    } else {
      let s = tmpS, e = day;
      if (e < s) [s, e] = [e, s];
      setTmpE(e); setSelecting(false); setHover(null); setActiveP(null);
      onChange({ start_date: toYMD(s), end_date: toYMD(e) });
      setTimeout(() => setOpen(false), 120);
    }
  };

  const handleNav = (dir) => {
    let m = viewMo + dir, y = viewYr;
    if (m > 11) { m = 0;  y++; }
    if (m < 0)  { m = 11; y--; }
    setViewMo(m); setViewYr(y);
  };

  const handlePreset = (p) => {
    setActiveP(p.days); setSelecting(false); setHover(null);
    if (p.days === -1) {
      const y = new Date(); y.setDate(y.getDate() - 1);
      const yStr = toYMD(y);
      setTmpS(y); setTmpE(y);
      onChange({ start_date: yStr, end_date: yStr });
    } else {
      setPresetRange(p.days);
    }
    setTimeout(() => setOpen(false), 150);
  };

  const label = (tmpS && tmpE && !selecting)
    ? `${fmtHe(toYMD(tmpS))} — ${fmtHe(toYMD(tmpE))}`
    : selecting
      ? `${fmtHe(toYMD(tmpS))} — בחר סיום`
      : 'בחר טווח תאריכים';

  const panelBg = isDark ? 'rgba(10,16,26,0.97)' : 'rgba(255,255,255,0.98)';

  return (
    <div
      ref={wrapRef}
      dir="rtl"
      style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
    >
      {/* ── Trigger pill ── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 14px',
          background: open ? `${accent}15` : colors.bg.card,
          border: `1px solid ${open ? accent : colors.border.primary}`,
          borderRadius: 10,
          cursor: 'pointer',
          fontSize: 13, fontWeight: 500,
          color: open ? accent : colors.text.primary,
          transition: 'all 0.2s ease',
          boxShadow: open ? `0 0 16px ${accent}30` : colors.shadow.sm,
          fontFamily: "'JetBrains Mono', monospace",
          whiteSpace: 'nowrap',
          direction: 'rtl',
        }}
      >
        {/* Chevron — right side in RTL means it's the "start" */}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={colors.text.tertiary} strokeWidth="2" strokeLinecap="round">
          <polyline points={open ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
        </svg>
        <span style={{ fontSize: 12 }}>{label}</span>
        {/* Calendar icon — left side in RTL */}
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={open ? accent : colors.text.secondary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>

      {/* ── Preset chips ── */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {PRESETS.map((p) => {
          const act = activePreset === p.days;
          return (
            <button
              key={p.label}
              onClick={() => handlePreset(p)}
              style={{
                padding: '6px 12px', fontSize: 12, fontWeight: 600,
                borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                border: `1px solid ${act ? accent : colors.border.primary}`,
                background: act ? `${accent}20` : colors.bg.secondary,
                color: act ? accent : colors.text.secondary,
                transition: 'all 0.18s ease',
                boxShadow: act ? `0 0 8px ${accent}40` : 'none',
              }}
              onMouseEnter={e => { if (!act) { e.currentTarget.style.borderColor = `${accent}60`; e.currentTarget.style.color = colors.text.primary; } }}
              onMouseLeave={e => { if (!act) { e.currentTarget.style.borderColor = colors.border.primary; e.currentTarget.style.color = colors.text.secondary; } }}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* ── Right slot ── */}
      {rightSlot && (
        <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {rightSlot}
        </div>
      )}

      {/* ── Floating calendar panel ── */}
      {open && (
        <div
          dir="rtl"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,           // ← RTL: anchor to RIGHT edge
            zIndex: 500,
            background: panelBg,
            border: `1px solid ${colors.border.secondary}`,
            borderRadius: 14,
            padding: 20,
            boxShadow: `${colors.shadow.xl}, 0 0 40px ${accent}15`,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            minWidth: 300,
            animation: 'fadeSlideIn 0.18s ease both',
          }}
        >
          {/* Panel header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, paddingBottom: 12, borderBottom: `1px solid ${colors.border.primary}` }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 2 }}>
                {selecting ? '⬤ בחר תאריך סיום' : 'טווח תאריכים'}
              </div>
              <div style={{ fontSize: 11, color: colors.text.secondary, fontFamily: "'JetBrains Mono', monospace" }}>
                {tmpS && tmpE ? `${fmtHe(toYMD(tmpS))} — ${fmtHe(toYMD(tmpE))}`
                  : tmpS ? `מ: ${fmtHe(toYMD(tmpS))}`
                  : 'בחר תאריך התחלה'}
              </div>
            </div>
            {(tmpS || tmpE) && (
              <button
                onClick={() => { setTmpS(null); setTmpE(null); setSelecting(false); setHover(null); setActiveP(null); onChange({ start_date: '', end_date: '' }); }}
                style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', border: `1px solid ${colors.semantic.error}40`, borderRadius: 20, background: `${colors.semantic.error}10`, color: colors.semantic.error, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                נקה
              </button>
            )}
          </div>

          {/* Calendar */}
          <MiniCal
            year={viewYr} month={viewMo}
            startDate={tmpS}
            endDate={selecting ? null : tmpE}
            hover={selecting ? hover : null}
            onDay={handleDay}
            onHover={setHover}
            onNav={handleNav}
            colors={colors}
          />

          {/* Quick presets inside panel */}
          <div style={{ display: 'flex', gap: 6, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${colors.border.primary}`, flexWrap: 'wrap' }}>
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => handlePreset(p)}
                style={{
                  padding: '5px 12px', fontSize: 11, fontWeight: 600,
                  borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${activePreset === p.days ? accent : colors.border.primary}`,
                  background: activePreset === p.days ? `${accent}20` : colors.bg.tertiary,
                  color: activePreset === p.days ? accent : colors.text.secondary,
                  transition: 'all 0.15s ease',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
