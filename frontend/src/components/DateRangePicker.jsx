import { Calendar } from '../icons';
import { S } from '../utils/styles';

export const DateRangePicker = ({
  dateRange,
  onChange,
  setPresetRange,
  rightSlot,   
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
        padding: '12px 16px',
        background: 'white',
        borderRadius: 8,
        border: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        direction: 'rtl',
        flexWrap: 'wrap',
      }}
    >
      <Calendar size={16} style={{ color: '#6B7280' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="date"
          value={dateRange.start_date || ''}
          onChange={(e) => onChange({ ...dateRange, start_date: e.target.value || '' })}
          style={S.input}
        />
        <span style={{ color: '#6B7280' }}>עד</span>
        <input
          type="date"
          value={dateRange.end_date || ''}
          onChange={(e) => onChange({ ...dateRange, end_date: e.target.value || '' })}
          style={S.input}
        />
      </div>

      <button
        onClick={() => setPresetRange(1)}
        style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 4, background: 'white', cursor: 'pointer' }}
      >
        היום
      </button>

      <button
        onClick={() => setPresetRange(7)}
        style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 4, background: 'white', cursor: 'pointer' }}
      >
        7 ימים אחרונים
      </button>

      <button
        onClick={() => setPresetRange(30)}
        style={{ padding: '4px 8px', fontSize: 12, border: '1px solid #D1D5DB', borderRadius: 4, background: 'white', cursor: 'pointer' }}
      >
        30 ימים אחרונים
      </button>

      {rightSlot && (
        <div style={{ marginInlineStart: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {rightSlot}
        </div>
      )}
    </div>
  );
};
