import { useState, useEffect, useRef, useMemo } from 'react';
import { Columns, ChevronDown, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react';
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

export const ColumnVisibilityPanel = ({ visibleColumns, onToggle, columnOrder = [], onReorder }) => {
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

  const orderedColumns = useMemo(() => {
    const mapped = columnOrder
      .map((key) => ALL_COLUMNS.find((c) => c.key === key))
      .filter(Boolean);
    const missing = ALL_COLUMNS.filter((c) => !columnOrder.includes(c.key));
    return [...mapped, ...missing];
  }, [columnOrder]);

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
            minWidth: 260,
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
          {orderedColumns.map((col, index) => {
            const isFirst = index === 0;
            const isLast = index === orderedColumns.length - 1;
            return (
              <div
                key={col.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
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
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flex: 1,
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns[col.key]}
                    onChange={() => onToggle(col.key)}
                    style={{
                      width: 16,
                      height: 16,
                      cursor: 'pointer',
                      accentColor: colors.brand.primary,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 13,
                      color: colors.text.primary,
                      fontWeight: 500,
                    }}
                  >
                    {col.label}
                  </span>
                </label>

                {/* Reordering Controls */}
                {onReorder && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button
                      disabled={isFirst}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onReorder(col.key, 'up');
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 4,
                        cursor: isFirst ? 'not-allowed' : 'pointer',
                        color: isFirst ? colors.text.tertiary : colors.text.secondary,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isFirst) {
                          e.currentTarget.style.background = colors.bg.secondary;
                          e.currentTarget.style.color = colors.brand.primary;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isFirst) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = colors.text.secondary;
                        }
                      }}
                      title="Move Up"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      disabled={isLast}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onReorder(col.key, 'down');
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 4,
                        cursor: isLast ? 'not-allowed' : 'pointer',
                        color: isLast ? colors.text.tertiary : colors.text.secondary,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isLast) {
                          e.currentTarget.style.background = colors.bg.secondary;
                          e.currentTarget.style.color = colors.brand.primary;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isLast) {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = colors.text.secondary;
                        }
                      }}
                      title="Move Down"
                    >
                      <ArrowDown size={13} />
                    </button>
                  </div>
                )}

                {/* Visibility Indicator */}
                <div style={{ display: 'flex', alignItems: 'center', paddingLeft: 4 }}>
                  {visibleColumns[col.key] ? (
                    <Eye size={13} style={{ color: colors.brand.primary }} />
                  ) : (
                    <EyeOff size={13} style={{ color: colors.text.tertiary }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

