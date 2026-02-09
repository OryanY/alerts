import { useState, useEffect } from 'react';
import { Calendar } from '../../icons';
import { useTheme } from '../../contexts/ThemeContext';
import { createThemedStyles } from '../../utils/themedStyles';

export const DateRangePicker = ({
  dateRange,
  onChange,
  setPresetRange,
  rightSlot,
}) => {
  const { colors } = useTheme();
  const S = createThemedStyles(colors);

  const [localStart, setLocalStart] = useState(dateRange.start_date || '');
  const [localEnd, setLocalEnd] = useState(dateRange.end_date || '');

  // Sync from props
  useEffect(() => {
    setLocalStart(dateRange.start_date || '');
    setLocalEnd(dateRange.end_date || '');
  }, [dateRange.start_date, dateRange.end_date]);

  const commitChanges = () => {
    if (localStart !== dateRange.start_date || localEnd !== dateRange.end_date) {
      onChange({ ...dateRange, start_date: localStart, end_date: localEnd });
    }
  };

  const handleBlur = () => {
    commitChanges();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      commitChanges();
      e.target.blur();
    }
  };

  const presetButtonStyle = {
    padding: '6px 12px',
    fontSize: 12,
    borderRadius: 6,
    cursor: 'pointer',
    background: colors.bg.secondary,
    color: colors.text.primary,
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
          value={localStart}
          onChange={(e) => setLocalStart(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          style={S.input}
        />

        <span style={{ color: colors.text.secondary }}>עד</span>

        <input
          type="date"
          value={localEnd}
          onChange={(e) => setLocalEnd(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
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
