import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { createThemedStyles } from '../../utils/themedStyles';
import { formatHourAndDay } from '../../utils/helpers';
import { LoadingSkeleton } from '../ui/LoadingSkeleton';

const RecentAlertsTable = ({ alerts, loading, selectedNode }) => {
    const { colors } = useTheme();
    const S = createThemedStyles(colors);

    // Format time for IL
    const formatTime = formatHourAndDay;

    if (loading) {
        return (
            <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: colors.text.primary, marginBottom: 12 }}>
                    Recent Alerts (Last 100)
                </h3>
                <LoadingSkeleton width="100%" height={400} />
            </div>
        );
    }

    return (
        <div style={{ marginTop: 24 }}>
            <h3
                style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: colors.text.primary,
                    marginBottom: 12,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10
                }}
            >
                Recent Alerts (Last 100)
                {selectedNode && (
                    <span style={{ fontSize: 12, fontWeight: 400, color: colors.semantic.infoText, background: colors.semantic.infoBg, padding: '2px 8px', borderRadius: 4 }}>
                        Filtered by: {selectedNode}
                    </span>
                )}
            </h3>

            {alerts && alerts.length > 0 ? (
                <>
                    <div
                        style={{
                            overflowX: 'auto',
                            border: `1px solid ${colors.border.primary}`,
                            borderRadius: 8,
                            background: colors.bg.secondary,
                        }}
                    >
                        <table
                            style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                fontSize: 13,
                            }}
                        >
                            <thead>
                                <tr
                                    style={{
                                        background: colors.bg.tertiary,
                                        borderBottom: `2px solid ${colors.border.primary}`,
                                    }}
                                >
                                    <th
                                        style={{
                                            ...S.tableHeadCell,
                                            textAlign: 'left',
                                        }}
                                    >
                                        Time Fired (IL)
                                    </th>
                                    <th
                                        style={{
                                            ...S.tableHeadCell,
                                            textAlign: 'left',
                                        }}
                                    >
                                        Node
                                    </th>
                                    <th
                                        style={{
                                            ...S.tableHeadCell,
                                            textAlign: 'left',
                                        }}
                                    >
                                        Object
                                    </th>
                                    <th
                                        style={{
                                            ...S.tableHeadCell,
                                            textAlign: 'left',
                                        }}
                                    >
                                        Message
                                    </th>
                                    <th
                                        style={{
                                            ...S.tableHeadCell,
                                            textAlign: 'center',
                                        }}
                                    >
                                        Duration
                                    </th>
                                    <th
                                        style={{
                                            ...S.tableHeadCell,
                                            textAlign: 'center',
                                        }}
                                    >
                                        Shift
                                    </th>

                                </tr>
                            </thead>
                            <tbody>
                                {alerts.map((alert, idx) => (
                                    <tr
                                        key={alert.id || idx}
                                        style={{
                                            borderBottom: `1px solid ${colors.border.primary}`,
                                        }}
                                    >
                                        <td
                                            style={{
                                                ...S.tableCell,
                                                whiteSpace: 'nowrap',
                                                color: colors.text.secondary,
                                            }}
                                        >
                                            {formatTime(alert.time_fired)}
                                        </td>
                                        <td style={{ ...S.tableCell, fontWeight: 500, color: colors.text.primary }}>
                                            {alert.node_name || alert.node || '-'}
                                        </td>
                                        <td style={S.tableCell}>
                                            {alert.object || '-'}
                                        </td>
                                        <td
                                            style={{
                                                ...S.tableCell,
                                                fontWeight: 500,
                                                color: colors.text.primary,
                                            }}
                                            title={alert.message}
                                        >
                                            {alert.message}
                                        </td>
                                        <td
                                            style={{
                                                ...S.tableCell,
                                                textAlign: 'center',
                                            }}
                                        >
                                            <span
                                                style={{
                                                    background:
                                                        alert.duration_sec > 1800
                                                            ? colors.semantic.errorBg
                                                            : alert.duration_sec > 600
                                                                ? colors.semantic.warningBg
                                                                : colors.bg.tertiary,
                                                    color:
                                                        alert.duration_sec > 1800
                                                            ? colors.semantic.error
                                                            : alert.duration_sec > 600
                                                                ? colors.semantic.warning
                                                                : colors.text.secondary,
                                                    padding: '2px 6px',
                                                    borderRadius: 12,
                                                    fontSize: 11,
                                                    fontWeight: 600,
                                                }}
                                            >
                                                {alert.duration_sec}s
                                            </span>
                                        </td>
                                        <td
                                            style={{
                                                ...S.tableCell,
                                                textAlign: 'center',
                                            }}
                                        >
                                            {alert.shift === 'Night' ? (
                                                <Moon
                                                    size={14}
                                                    style={{ color: colors.brand.secondary }}
                                                />
                                            ) : (
                                                <Sun
                                                    size={14}
                                                    style={{ color: colors.semantic.warning }}
                                                />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            ) : (
                <div
                    style={{
                        padding: 40,
                        textAlign: 'center',
                        color: colors.text.secondary,
                    }}
                >
                    No recent alerts found for this panel
                </div>
            )}
        </div>
    );
};

export default RecentAlertsTable;
