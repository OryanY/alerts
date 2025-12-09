import { formatHourAndDay, formatIncidentId } from "../../utils/helpers";

export const AlertTable = ({
  alerts,
  visibleColumns,
  sortConfig,
  onSort,
  colorByDuration,
  colors,
  renderShiftBadge
}) => {
  const renderCell = (alert, col) => {
    const key = col.key;
    const value = alert[key];

    switch (key) {
      case 'history_id': {
        const formatted = formatIncidentId(alert.history_id);
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
            {formatted ? (
              formatted
            ) : (
              <span style={{ fontStyle: 'italic', color: colors.text.tertiary }}>—</span>
            )}
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
          {alerts.map((alert, i) => (
            <tr
              key={alert.history_id || i}
              style={{
                borderBottom: `1px solid ${colors.border.primary}`,
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.bg.tertiary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {visibleColumns.map((col) => renderCell(alert, col))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

