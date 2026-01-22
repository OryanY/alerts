import { useState, useEffect, useRef } from 'react';
import { Columns, ChevronDown, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const ALL_COLUMNS = [
  { key: 'incident_number', label: 'INC #', width: '100px', sortable: true, defaultVisible: true },
  { key: 'panel_title', label: 'Panel', width: '180px', sortable: true, defaultVisible: true },
  { key: 'application', label: 'Application', width: '140px', sortable: true, defaultVisible: true },
  { key: 'message', label: 'Message', width: '250px', sortable: false, defaultVisible: true },
  { key: 'time_fired', label: 'Time Fired', width: '140px', sortable: true, defaultVisible: true },
  { key: 'duration_sec', label: 'Duration', width: '110px', sortable: true, defaultVisible: true },
  { key: 'operator', label: 'Operator', width: '120px', sortable: true, defaultVisible: true },
  { key: 'node_name', label: 'Node', width: '120px', sortable: true, defaultVisible: false },
  { key: 'network', label: 'Network', width: '120px', sortable: true, defaultVisible: false },
  { key: 'object', label: 'Object', width: '120px', sortable: true, defaultVisible: false },
  { key: 'shift', label: 'Shift', width: '100px', sortable: true, defaultVisible: false },
  { key: 'time_resolved', label: 'Time Resolved', width: '140px', sortable: true, defaultVisible: false },
];

export const getDefaultVisibleColumns = () => {
  const initial = {};
  ALL_COLUMNS.forEach((col) => {
    initial[col.key] = col.defaultVisible;
  });
  return initial;
};

export const getAllColumns = () => ALL_COLUMNS;

export const ColumnVisibilityPanel = ({ visibleColumns, onToggle }) => {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const visibleCount = Object.values(visibleColumns).filter(Boolean).length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '10px 16px',
          background: colors.bg.secondary,
          border: `1px solid ${colors.border.primary}`,
          borderRadius: 8,
          fontSize: 14,
          color: colors.text.primary,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = colors.border.secondary;
          e.currentTarget.style.background = colors.bg.tertiary;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = colors.border.primary;
          e.currentTarget.style.background = colors.bg.secondary;
        }}
      >
        <Columns size={16} />
        <span>Columns ({visibleCount})</span>
        <ChevronDown
          size={14}
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
            transition: 'transform 0.2s ease',
          }}
        />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: 8,
            background: colors.bg.elevated,
            border: `1px solid ${colors.border.primary}`,
            borderRadius: 8,
            minWidth: 250,
            maxHeight: 400,
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: colors.shadow.lg,
            padding: 8,
          }}
        >
          <div
            style={{
              padding: '8px 12px',
              borderBottom: `1px solid ${colors.border.primary}`,
              marginBottom: 8,
              fontWeight: 600,
              fontSize: 13,
              color: colors.text.secondary,
            }}
          >
            Select Columns to Display
          </div>
          {ALL_COLUMNS.map((col) => (
            <label
              key={col.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                cursor: 'pointer',
                borderRadius: 6,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.bg.tertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <input
                type="checkbox"
                checked={visibleColumns[col.key]}
                onChange={() => onToggle(col.key)}
                style={{
                  width: 18,
                  height: 18,
                  cursor: 'pointer',
                  accentColor: colors.brand.primary,
                }}
              />
              <span
                style={{
                  fontSize: 14,
                  color: colors.text.primary,
                  flex: 1,
                }}
              >
                {col.label}
              </span>
              {visibleColumns[col.key] ? (
                <Eye size={14} style={{ color: colors.brand.primary }} />
              ) : (
                <EyeOff size={14} style={{ color: colors.text.tertiary }} />
              )}
            </label>
          ))}
        </div>
      )}
    </div>
  );
};

