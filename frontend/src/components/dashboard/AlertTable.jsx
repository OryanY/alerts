import { formatHourAndDay } from "../../utils/dateUtils";
import { useState, Fragment } from 'react';
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
  const renderCell = (alert, col, isFirstColumn) => {
    const key = col.key;
    const value = alert[key];

    // Helper to render clustering UI if this is the first visible column
    const renderClusteringUI = () => {
      if (!isFirstColumn) return null;

      const isCluster = alert.is_cluster;
      const isExpanded = expandedRows.has(alert.history_id || alert.incident_number);

      if (!isCluster) return null;

      return (
        <div
          onClick={(e) => {
            e.stopPropagation();
            toggleRow(alert.history_id || alert.incident_number);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 24,
            height: 24,
            marginRight: 8,
            borderRadius: 4,
            background: colors.bg.secondary,
            color: colors.text.secondary,
            cursor: 'pointer',
            border: `1px solid ${colors.border.secondary}`
          }}
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      );
    };

    const wrapperStyle = { display: 'flex', alignItems: 'center' };

    switch (key) {
      case 'incident_number': {
        const formatted = alert.incident_number;
        const sysId = alert.incident_sys_id;

        // If incident_number is visible but NOT first, it's just text
        // If it IS first, renderClusteringUI handles the chevron

        return (
          <td
            key={key}
            style={{
              padding: '16px',
              fontFamily: 'monospace',
              fontSize: 13,
              fontWeight: 600,
              color: colors.text.primary,
            }}
          >
            <div style={wrapperStyle}>
              {renderClusteringUI()}
              {formatted ? (
                  <a
                    href={`${process.env.REACT_APP_SERVICENOW_URL || 'https://servicenow.com'}/nav_to.do?uri=incident.do?${sysId ? `sys_id=${sysId}` : `sysparm_query=number=${formatted}`}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: colors.brand.primary,
                      textDecoration: 'none',
                      borderBottom: `1px dashed ${colors.brand.primary}50`,
                      transition: 'border-bottom-color 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderBottomStyle = 'solid')}
                    onMouseLeave={(e) => (e.currentTarget.style.borderBottomStyle = 'dashed')}
                    title={sysId ? `Open Incident in ServiceNow (sys_id: ${sysId})` : `Search Incident in ServiceNow (${formatted})`}
                  >
                    {formatted}
                  </a>
              ) : (
                <span style={{ fontStyle: 'italic', color: colors.text.tertiary }}>—</span>
              )}
              {/* Only show cluster badge if this is the expansion point column */}
              {isFirstColumn && alert.is_cluster && (
                <span style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  marginLeft: 8,
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
            <div style={wrapperStyle}>
              {renderClusteringUI()}
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
              {/* Fallback cluster badge if panel is first col */}
              {isFirstColumn && alert.is_cluster && key !== 'incident_number' && (
                <span style={{ marginLeft: 6, color: colors.brand.primary }}><Layers size={12} /> {alert.cluster_count}</span>
              )}
            </div>
          </td>
        );

      case 'application':
        return (
          <td key={key} style={{ padding: '16px', color: colors.text.secondary }}>
            <div style={wrapperStyle}>
              {renderClusteringUI()}
              {value ? (
                value
              ) : (
                <span style={{ fontStyle: 'italic', color: colors.text.tertiary }}>No application</span>
              )}
            </div>
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
            <div style={wrapperStyle}>
              {renderClusteringUI()}
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
            </div>
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
            <div style={wrapperStyle}>
              {renderClusteringUI()}
              {formatted || <span style={{ fontStyle: 'italic', color: colors.text.tertiary }}>—</span>}
            </div>
          </td>
        );
      }

      case 'duration_sec': {
        const d = value;
        // Duration is a bit small for the chevron, but we support it just in case
        if (d === null || d === undefined || d === '') {
          return (
            <td key={key} style={{ padding: '16px' }}>
              <div style={wrapperStyle}>
                {renderClusteringUI()}
                <span style={{ fontStyle: 'italic', color: colors.text.tertiary }}>—</span>
              </div>
            </td>
          );
        }
        const color = colorByDuration(d);
        return (
          <td key={key} style={{ padding: '16px' }}>
            <div style={wrapperStyle}>
              {renderClusteringUI()}
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
            </div>
          </td>
        );
      }

      case 'operator':
        return (
          <td key={key} style={{ padding: '16px', color: colors.text.secondary }}>
            <div style={wrapperStyle}>
              {renderClusteringUI()}
              {value || 'System'}
            </div>
          </td>
        );

      case 'shift':
        return (
          <td key={key} style={{ padding: '16px' }}>
            <div style={wrapperStyle}>
              {renderClusteringUI()}
              {renderShiftBadge(value)}
            </div>
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
            <div style={wrapperStyle}>
              {renderClusteringUI()}
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
            </div>
          </td>
        );
      }

      default:
        return (
          <td key={key} style={{ padding: '16px', color: colors.text.secondary }}>
            <div style={wrapperStyle}>
              {renderClusteringUI()}
              {value ?? <span style={{ fontStyle: 'italic', color: colors.text.tertiary }}>—</span>}
            </div>
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
            const rawId = alert.history_id || alert.incident_number || i;
            const uniqueKey = `${rawId}_${i}`;
            const isExpanded = expandedRows.has(rawId);

            return (
              <Fragment key={uniqueKey}>
                <tr
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
                  onClick={() => alert.is_cluster && toggleRow(rawId)}
                >
                  {visibleColumns.map((col, idx) => renderCell(alert, col, idx === 0))}
                </tr>
                {isExpanded && alert.is_cluster && alert.raw_alerts && (
                  <tr key={`${uniqueKey}-expanded`}>
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
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

