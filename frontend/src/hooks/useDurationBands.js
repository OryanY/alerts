import { DEFAULT_CLIENT_CFG } from '../utils/constants';
import { useTheme } from '../contexts/ThemeContext';

export const useDurationBands = (cfg = DEFAULT_CLIENT_CFG) => {
  const { colors } = useTheme();
  const safeCfg = (cfg && typeof cfg === 'object') ? cfg : DEFAULT_CLIENT_CFG;
  const bands = (Array.isArray(safeCfg.bands) && safeCfg.bands.length)
    ? safeCfg.bands
    : DEFAULT_CLIENT_CFG.bands;

  const colorByDuration = (s) => {
    if (!Number.isFinite(s)) return colors.text.tertiary;
    for (const b of bands) if (s >= b.min && s <= b.max) return b.color;
    return colors.text.tertiary;
  };

  const Legend = () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, marginTop: 8 }}>
      {(bands || []).map(b => (
        <span key={b.key} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '2px 8px', borderRadius: 12, background: `${b.color}20`,
          color: b.color, fontWeight: 600
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: b.color }} />
          {b.label}
        </span>
      ))}
    </div>
  );
  const getDurationColorFromBands = (entry, bands) => {
    const band = bands.find(
      b => b.label.trim().toLowerCase() === entry.category.toLowerCase()
    );

    return band ? band.color : colors.text.tertiary;
  };

  return { bands, getDurationColorFromBands,colorByDuration, Legend };
};
