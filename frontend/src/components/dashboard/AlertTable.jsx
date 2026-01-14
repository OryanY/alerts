import { formatHourAndDay } from "../../utils/helpers";
import { useState } from 'react';
import { ChevronDown, ChevronRight, Layers } from 'lucide-react';

export const AlertTable = ({
  alerts,
  visibleColumns,
  sortConfig,
  onSort,
  colorByDuration,
  colors,
  renderShiftBadge
}) => {
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleRow = (id) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  const renderCell = (alert, col) => {
    const key = col.key;
    const value = alert[key];

    switch (key) {
      case 'incident_number': {
        const formatted = alert.incident_number;
        const isCluster = alert.is_cluster;
        const isExpanded = expandedRows.has(alert.history_id || alert.incident_number);

        return (
          <td
            key={key}
            onClick={(e) => {
              if (isCluster) {
                e.stopPropagation();
                toggleRow(alert.history_id || alert.incident_number);
              }
            }}
            style={{
              padding: '16px',
              fontFamily: 'monospace',
              fontSize: 13,
              fontWeight: 600,
              color: colors.text.primary,
              cursor: isCluster ? 'pointer' : 'inherit'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isCluster && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    background: colors.bg.secondary,
                    color: colors.text.secondary
                  }}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              )}
              {formatted ? formatted : <span style={{ fontStyle: 'italic', color: colors.text.tertiary }}>—</span>}
              {isCluster && (
                <span style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  background: colors.brand.primary + '20',
                  color: colors.brand.primary,
                  borderRadius: 99,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}>
                  <Layers size={10} />
                  {alert.cluster_count}
                </span>
              )}
            </div>
          </td>
        );
      }

      case 'panel_title':
        return (
          <td
            key={key}
            style={{ padding: '16px', color: colors.text.primary }}
            title={value || ''}
          >
            {value ? (
              <div
                style={{
                  maxWidth: 180,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontWeight: 500,
                }}
              >
                {value}
              </div>
            ) : (
              <span style={{ fontStyle: 'italic', color: colors.text.tertiary }}>No panel</span>
            )}
          </td>
        );

      case 'application':
        return (
          <td key={key} style={{ padding: '16px', color: colors.text.secondary }}>
            {value ? (
              value
            ) : (
              <span style={{ fontStyle: 'italic', color: colors.text.tertiary }}>No application</span>
            )}
          </td>
        );

      case 'message': {
        const hasMessage = !!value;
        return (
          <td
            key={key}
            style={{
              padding: '16px',
              color: hasMessage ? colors.text.secondary : colors.text.tertiary,
              fontSize: 13,
            }}
            title={hasMessage ? value : 'No message'}
          >
            {hasMessage ? (
              <div
                style={{
                  maxWidth: 350,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {value}
              </div>
            ) : (
              <span style={{ fontStyle: 'italic' }}>No message</span>
            )}
          </td>
        );
      }

      case 'time_fired':
      case 'time_resolved': {
        const formatted = formatHourAndDay(value);
        return (
          <td
            key={key}
            style={{
              padding: '16px',
              fontSize: 13,
              fontFamily: 'monospace',
              color: colors.text.primary,
            }}
          >
            {formatted || <span style={{ fontStyle: 'italic', color: colors.text.tertiary }}>—</span>}
          </td>
        );
      }

      case 'duration_sec': {
        const d = value;
        if (d === null || d === undefined || d === '') {
          return (
            <td key={key} style={{ padding: '16px' }}>
              <span style={{ fontStyle: 'italic', color: colors.text.tertiary }}>—</span>
            </td>
          );
        }
        const color = colorByDuration(d);
        return (
          <td key={key} style={{ padding: '16px' }}>
            <span
              style={{
                background: color + '20',
                color,
                padding: '6px 12px',
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 700,
                display: 'inline-block',
              }}
            >
              {d}s
            </span>
          </td>
        );
      }

      case 'operator':
        return (
          <td key={key} style={{ padding: '16px', color: colors.text.secondary }}>
            {value || 'System'}
          </td>
        );

      case 'shift':
        return (
          <td key={key} style={{ padding: '16px' }}>
            {renderShiftBadge(value)}
          </td>
        );

      case 'node_name':
      case 'network':
      case 'object': {
        return (
          <td
            key={key}
            style={{ padding: '16px', color: colors.text.secondary }}
            title={value || ''}
          >
            {value ? (
              <div
                style={{
                  maxWidth: 180,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {value}
              </div>
            ) : (
              <span style={{ fontStyle: 'italic', color: colors.text.tertiary }}>—</span>
            )}
          </td>
        );
      }

      default:
        return (
          <td key={key} style={{ padding: '16px', color: colors.text.secondary }}>
            {value ?? <span style={{ fontStyle: 'italic', color: colors.text.tertiary }}>—</span>}
          </td>
        );
    }
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 14,
          minWidth: 1100,
        }}
      >
        <thead>
          <tr
            style={{
              background: colors.bg.tertiary,
              borderBottom: `2px solid ${colors.border.secondary}`,
            }}
          >
            {visibleColumns.map(({ key, label, width }) => {
              const isSorted = sortConfig.sort_by === key;
              const colDef = visibleColumns.find((c) => c.key === key);
              const sortable = colDef?.sortable;

              return (
                <th
                  key={key}
                  onClick={() => sortable && onSort(key)}
                  style={{
                    padding: '14px 16px',
                    textAlign: 'left',
                    fontWeight: 700,
                    fontSize: 12,
                    color: isSorted ? colors.brand.primary : colors.text.secondary,
                    cursor: sortable ? 'pointer' : 'default',
                    background: isSorted ? colors.brand.primary + '10' : colors.bg.tertiary,
                    width,
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {label}
                    {isSorted && sortable && (
                      <span style={{ fontSize: 11 }}>
                        {sortConfig.sort_order === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {alerts.map((alert, i) => {
            const rowId = alert.history_id || alert.incident_number || i;
            const isExpanded = expandedRows.has(rowId);

            return (
              <>
                <tr
                  key={rowId}
                  style={{
                    borderBottom: isExpanded ? 'none' : `1px solid ${colors.border.primary}`,
                    transition: 'background 0.15s ease',
                    background: isExpanded ? colors.bg.secondary : 'transparent'
                  }}
                  onMouseEnter={(e) => {
                    if (!isExpanded) e.currentTarget.style.background = colors.bg.tertiary;
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded) e.currentTarget.style.background = 'transparent';
                  }}
                  onClick={() => alert.is_cluster && toggleRow(rowId)}
                >
                  {visibleColumns.map((col) => renderCell(alert, col))}
                </tr>
                {isExpanded && alert.is_cluster && alert.raw_alerts && (
                  <tr key={`${rowId}-expanded`}>
                    <td colSpan={visibleColumns.length} style={{ padding: 0, borderBottom: `1px solid ${colors.border.primary}` }}>
                      <div style={{
                        background: colors.bg.secondary,
                        padding: '12px 24px',
                        borderLeft: `4px solid ${colors.brand.primary}`
                      }}>
                        <div style={{
                          marginBottom: 8,
                          fontSize: 12,
                          fontWeight: 700,
                          color: colors.text.secondary,
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em'
                        }}>
                          CLustered Incident Details ({alert.cluster_count} alerts)
                        </div>
                        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: 'left', padding: '8px 0', color: colors.text.tertiary, fontSize: 11 }}>Time</th>
                              <th style={{ textAlign: 'left', padding: '8px 0', color: colors.text.tertiary, fontSize: 11 }}>Duration</th>
                              <th style={{ textAlign: 'left', padding: '8px 0', color: colors.text.tertiary, fontSize: 11 }}>Message</th>
                            </tr>
                          </thead>
                          <tbody>
                            {alert.raw_alerts.map((sub, idx) => (
                              <tr key={idx} style={{ borderTop: `1px solid ${colors.border.secondary}40` }}>
                                <td style={{ padding: '8px 0', color: colors.text.primary, fontFamily: 'monospace' }}>
                                  {formatHourAndDay(sub.time_fired)}
                                </td>
                                <td style={{ padding: '8px 0' }}>
                                  <span style={{
                                    color: colorByDuration(sub.duration_sec),
                                    fontWeight: 600
                                  }}>
                                    {sub.duration_sec}s
                                  </span>
                                </td>
                                <td style={{ padding: '8px 0', color: colors.text.secondary }}>
                                  {sub.message}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

