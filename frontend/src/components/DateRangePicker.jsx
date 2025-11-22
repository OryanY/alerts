import { Calendar } from '../icons';
import { useTheme } from '../contexts/ThemeContext';
import { createThemedStyles } from '../utils/themedStyles';

export const DateRangePicker = ({
  dateRange,
  onChange,
  setPresetRange,
  rightSlot,
}) => {
  const { colors } = useTheme();
  const S = createThemedStyles(colors);

  const presetButtonStyle = {
    padding: '6px 12px',
    fontSize: 12,
    borderRadius: 6,
    cursor: 'pointer',

    background: colors.bg.secondary,
    color: colors.text.primary,

    // no border shorthand: avoid React warning
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border.secondary,
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        padding: '12px 16px',

        background: colors.bg.secondary,
        borderRadius: 8,
        border: `1px solid ${colors.border.primary}`,
        boxShadow: colors.shadow.sm,

        direction: 'rtl',
        flexWrap: 'wrap',
      }}
    >
      {/* Icon */}
      <Calendar size={16} style={{ color: colors.text.secondary }} />

      {/* Date inputs */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="date"
          value={dateRange.start_date || ''}
          onChange={(e) =>
            onChange({ ...dateRange, start_date: e.target.value || '' })
          }
          style={S.input}
        />

        <span style={{ color: colors.text.secondary }}>עד</span>

        <input
          type="date"
          value={dateRange.end_date || ''}
          onChange={(e) =>
            onChange({ ...dateRange, end_date: e.target.value || '' })
          }
          style={S.input}
        />
      </div>

      {/* Preset buttons */}
      <button
        onClick={() => setPresetRange(1)}
        style={presetButtonStyle}
      >
        היום
      </button>

      <button
        onClick={() => setPresetRange(7)}
        style={presetButtonStyle}
      >
        7 ימים אחרונים
      </button>

      <button
        onClick={() => setPresetRange(30)}
        style={presetButtonStyle}
      >
        30 ימים אחרונים
      </button>

      {/* Optional right slot */}
      {rightSlot && (
        <div
          style={{
            marginInlineStart: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {rightSlot}
        </div>
      )}
    </div>
  );
};
